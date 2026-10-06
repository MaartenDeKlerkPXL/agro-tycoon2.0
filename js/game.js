// Agro Tycoon 2.0 — spellogica (geen tekenwerk, geen DOM)
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const SAVE_KEY = 'agro-tycoon-2-save';

  // ---------- kleine event-bus zodat UI kan reageren ----------
  const listeners = {};
  AT.on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); };
  AT.emit = (evt, payload) => { (listeners[evt] || []).forEach(fn => fn(payload)); };

  let uidCounter = 1;
  const newUid = () => uidCounter++;

  // ---------- nieuw spel ----------
  function createState() {
    const market = {};
    for (const key of Object.keys(D.crops)) market[key] = { factor: 1, history: [1] };

    const silo = {};
    for (const key of Object.keys(D.crops)) silo[key] = 0;

    return {
      version: D.version,
      money: D.start.money,
      time: D.start.hour, // totaal aantal speluren sinds start
      speed: 1,
      paused: false,
      siloLevel: D.start.siloLevel,
      silo,
      market,
      fields: D.fields.map(f => ({
        id: f.id, owned: !!f.owned, state: 'stubble', crop: null, growth: 0, job: null,
      })),
      machines: D.start.machines.map(type => ({ uid: newUid(), type, busy: null })),
      stats: { plowed: 0, sown: 0, harvested: 0, tonsHarvested: 0, earned: 0, spent: 0 },
      goalsDone: {},
      log: [],
    };
  }

  // ---------- helpers ----------
  const S = () => AT.state;
  const fieldDef = id => D.fields.find(f => f.id === id);
  const field = id => S().fields.find(f => f.id === id);
  const machineDef = m => D.machines[m.type];
  const day = () => Math.floor(S().time / 24) + 1;
  const hour = () => S().time % 24;

  function log(text, type = 'info') {
    const s = S();
    s.log.unshift({ day: day(), hour: Math.floor(hour()), text, type });
    if (s.log.length > 60) s.log.length = 60;
    AT.emit('log');
  }

  function spend(amount) {
    S().money -= amount;
    S().stats.spent += amount;
  }

  function earn(amount, countAsEarned = true) {
    S().money += amount;
    if (countAsEarned) S().stats.earned += amount;
  }

  function siloCapacity() { return D.silo[S().siloLevel].capacity; }
  function siloUsed() { return Object.values(S().silo).reduce((a, b) => a + b, 0); }

  // ruimte die al "gereserveerd" is door lopende oogsten
  function siloReserved() {
    return S().fields.reduce((sum, f) => {
      if (f.job && f.job.type === 'harvest') return sum + expectedYield(f);
      return sum;
    }, 0);
  }

  function expectedYield(f) {
    return fieldDef(f.id).ha * D.crops[f.crop].yieldPerHa;
  }

  function cropPrice(crop) {
    return Math.round(D.crops[crop].basePrice * S().market[crop].factor);
  }

  function fieldPrice(id) { return fieldDef(id).ha * D.landPricePerHa; }

  // ---------- machines kiezen voor een taak ----------
  const TASK_IMPLEMENT = { plow: 'plow', sow: 'seeder' };

  // snelheidsbonus als de tractor sterker is dan het werktuig nodig heeft
  function speedFactor(tractorDef, implDef) {
    const extra = (tractorDef.power - implDef.minPower) / implDef.minPower;
    return Math.min(1 + extra * 0.5, 1.75);
  }

  // Geeft de snelste vrije combinatie voor een taak, of null.
  // Resultaat: { machines: [m...], hours, cost }
  function bestRig(task, fieldId) {
    const ha = fieldDef(fieldId).ha;
    const free = S().machines.filter(m => !m.busy);

    if (task === 'harvest') {
      let best = null;
      for (const m of free) {
        const d = machineDef(m);
        if (d.kind !== 'harvester') continue;
        const hours = ha / d.rate;
        if (!best || hours < best.hours) {
          best = { machines: [m], hours, cost: hours * d.fuelPerHour * D.fuelPrice };
        }
      }
      return best;
    }

    const implKind = TASK_IMPLEMENT[task];
    let best = null;
    for (const t of free) {
      const td = machineDef(t);
      if (td.kind !== 'tractor') continue;
      for (const i of free) {
        const id = machineDef(i);
        if (id.kind !== implKind || td.power < id.minPower) continue;
        const hours = ha / (id.rate * speedFactor(td, id));
        if (!best || hours < best.hours) {
          best = { machines: [t, i], hours, cost: hours * td.fuelPerHour * D.fuelPrice };
        }
      }
    }
    return best;
  }

  // Waarom kan een taak niet? (voor duidelijke meldingen)
  function missingFor(task) {
    const all = S().machines;
    const has = kind => all.some(m => machineDef(m).kind === kind);
    if (task === 'harvest') return has('harvester') ? 'Alle maaidorsers zijn bezig.' : 'Je hebt geen maaidorser.';
    const implKind = TASK_IMPLEMENT[task];
    const implName = implKind === 'plow' ? 'ploeg' : 'zaaimachine';
    if (!has('tractor')) return 'Je hebt geen tractor.';
    if (!has(implKind)) return `Je hebt geen ${implName}.`;
    return `Geen vrije tractor + ${implName} (of tractor te zwak).`;
  }

  // ---------- acties ----------
  function startJob(fieldId, task, crop) {
    const f = field(fieldId);
    if (!f || !f.owned || f.job) return false;

    const needed = { plow: 'stubble', sow: 'plowed', harvest: 'ready' }[task];
    if (f.state !== needed) return false;

    const rig = bestRig(task, fieldId);
    if (!rig) { log(missingFor(task), 'warn'); return false; }

    let cost = rig.cost;
    if (task === 'sow') {
      if (!D.crops[crop]) return false;
      cost += D.crops[crop].seedCostPerHa * fieldDef(fieldId).ha;
    }
    if (task === 'harvest') {
      const room = siloCapacity() - siloUsed() - siloReserved();
      if (room < expectedYield(f)) {
        log(`Silo te vol om Veld ${fieldId} te oogsten. Verkoop graan of vergroot de silo.`, 'warn');
        return false;
      }
    }
    if (S().money < cost) { log(`Niet genoeg geld (nodig: ${AT.fmtMoney(cost)}).`, 'warn'); return false; }

    spend(cost);
    rig.machines.forEach(m => { m.busy = fieldId; });
    f.job = {
      type: task,
      crop: task === 'sow' ? crop : f.crop,
      machines: rig.machines.map(m => m.uid),
      hours: rig.hours,
      progress: 0,
    };
    const names = rig.machines.map(m => machineDef(m).name).join(' + ');
    const verb = { plow: 'ploegt', sow: 'zaait', harvest: 'oogst' }[task];
    log(`${names} ${verb} Veld ${fieldId} (${rig.hours.toFixed(1).replace('.', ',')} u, ${AT.fmtMoney(cost)}).`);
    AT.emit('change');
    return true;
  }

  function finishJob(f) {
    const job = f.job;
    const s = S();
    s.machines.forEach(m => { if (job.machines.includes(m.uid)) m.busy = null; });

    if (job.type === 'plow') {
      f.state = 'plowed';
      s.stats.plowed++;
      log(`Veld ${f.id} is geploegd.`, 'good');
    } else if (job.type === 'sow') {
      f.state = 'growing';
      f.crop = job.crop;
      f.growth = 0;
      s.stats.sown++;
      log(`Veld ${f.id} is ingezaaid met ${D.crops[job.crop].name.toLowerCase()}.`, 'good');
    } else if (job.type === 'harvest') {
      const variation = 0.9 + Math.random() * 0.2;
      let tons = expectedYield(f) * variation;
      const room = siloCapacity() - siloUsed();
      if (tons > room) {
        log(`Silo vol! ${AT.fmtTons(tons - room)} ${D.crops[f.crop].name.toLowerCase()} ging verloren.`, 'warn');
        tons = room;
      }
      s.silo[f.crop] += tons;
      s.stats.harvested++;
      s.stats.tonsHarvested += tons;
      log(`Veld ${f.id} geoogst: ${AT.fmtTons(tons)} ${D.crops[f.crop].name.toLowerCase()}.`, 'good');
      f.state = 'stubble';
      f.crop = null;
      f.growth = 0;
    }
    f.job = null;
    AT.emit('change');
  }

  function sell(crop, tons) {
    const s = S();
    tons = Math.min(tons ?? s.silo[crop], s.silo[crop]);
    if (tons <= 0.001) return;
    const revenue = tons * cropPrice(crop);
    s.silo[crop] -= tons;
    if (s.silo[crop] < 0.001) s.silo[crop] = 0;
    earn(revenue);
    log(`${AT.fmtTons(tons)} ${D.crops[crop].name.toLowerCase()} verkocht voor ${AT.fmtMoney(revenue)}.`, 'money');
    AT.emit('change');
  }

  function buyField(id) {
    const f = field(id);
    const price = fieldPrice(id);
    if (!f || f.owned) return;
    if (S().money < price) { log('Niet genoeg geld voor dit veld.', 'warn'); return; }
    spend(price);
    f.owned = true;
    log(`Veld ${id} gekocht (${fieldDef(id).ha} ha) voor ${AT.fmtMoney(price)}.`, 'money');
    AT.emit('change');
  }

  function buyMachine(type) {
    const d = D.machines[type];
    if (!d) return;
    if (S().money < d.price) { log(`Niet genoeg geld voor ${d.name}.`, 'warn'); return; }
    spend(d.price);
    S().machines.push({ uid: newUid(), type, busy: null });
    log(`${d.name} gekocht!`, 'money');
    AT.emit('change');
  }

  function sellMachine(uid) {
    const s = S();
    const m = s.machines.find(x => x.uid === uid);
    if (!m || m.busy) return;
    const value = Math.round(machineDef(m).price * 0.6);
    s.machines = s.machines.filter(x => x.uid !== uid);
    earn(value, false);
    log(`${machineDef(m).name} verkocht voor ${AT.fmtMoney(value)}.`, 'money');
    AT.emit('change');
  }

  function upgradeSilo() {
    const s = S();
    const next = D.silo[s.siloLevel + 1];
    if (!next) return;
    if (s.money < next.price) { log('Niet genoeg geld voor de silo-uitbreiding.', 'warn'); return; }
    spend(next.price);
    s.siloLevel++;
    log(`Silo uitgebreid naar ${next.capacity} t.`, 'money');
    AT.emit('change');
  }

  // ---------- tijd ----------
  function updateMarket() {
    const { minFactor, maxFactor, volatility } = D.market;
    for (const key of Object.keys(S().market)) {
      const m = S().market[key];
      // random walk met lichte trek terug naar 1.0
      const drift = (1 - m.factor) * 0.1;
      m.factor = Math.min(maxFactor, Math.max(minFactor, m.factor + drift + (Math.random() * 2 - 1) * volatility));
      m.history.push(m.factor);
      if (m.history.length > 30) m.history.shift();
    }
  }

  function checkGoals() {
    const s = S();
    for (const g of D.goals) {
      if (s.goalsDone[g.id] || !g.check(s)) continue;
      s.goalsDone[g.id] = true;
      if (g.reward) earn(g.reward, false);
      log(`Doel behaald: ${g.text}${g.reward ? ` (+${AT.fmtMoney(g.reward)})` : ''}`, 'goal');
      AT.emit('change');
    }
  }

  // dtSeconds = echte seconden sinds vorige frame
  function tick(dtSeconds) {
    const s = S();
    if (s.paused) return;
    const dtHours = dtSeconds * D.hoursPerSecond * s.speed;
    const prevDay = day();
    s.time += dtHours;

    for (const f of s.fields) {
      if (f.job) {
        f.job.progress += dtHours / f.job.hours;
        if (f.job.progress >= 1) finishJob(f);
      } else if (f.state === 'growing') {
        f.growth += dtHours / (D.crops[f.crop].growDays * 24);
        if (f.growth >= 1) {
          f.growth = 1;
          f.state = 'ready';
          log(`${D.crops[f.crop].name} op Veld ${f.id} is klaar om te oogsten!`, 'good');
          AT.emit('change');
        }
      }
    }

    if (day() !== prevDay) {
      updateMarket();
      save();
      AT.emit('newday');
    }
    checkGoals();
  }

  // ---------- opslaan / laden ----------
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S())); } catch (e) { /* geen opslag beschikbaar */ }
  }

  function load() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { saved = null; }
    const fresh = createState();
    if (!saved || saved.version !== D.version) return fresh;

    // samenvoegen zodat nieuwe velden/gewassen uit data.js ook in oude saves werken
    const state = Object.assign(fresh, saved);
    state.fields = fresh.fields.map(f => Object.assign(f, (saved.fields || []).find(sf => sf.id === f.id) || {}));
    state.silo = Object.assign(createState().silo, saved.silo);
    state.market = Object.assign(createState().market, saved.market);
    state.stats = Object.assign(createState().stats, saved.stats);
    state.machines = (saved.machines || []).filter(m => D.machines[m.type]);
    uidCounter = state.machines.reduce((max, m) => Math.max(max, m.uid), 0) + 1;
    return state;
  }

  function reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ok */ }
    uidCounter = 1;
    AT.state = createState();
    log('Welkom bij Agro Tycoon 2.0! Klik op Veld 1 om te beginnen met ploegen.', 'goal');
    AT.emit('change');
  }

  // ---------- formatters ----------
  AT.fmtMoney = n => '€' + Math.round(n).toLocaleString('nl-NL');
  AT.fmtTons = n => n.toFixed(1).replace('.', ',') + ' t';

  AT.game = {
    tick, startJob, sell, buyField, buyMachine, sellMachine, upgradeSilo,
    save, load, reset, bestRig, missingFor,
    day, hour, siloCapacity, siloUsed, siloReserved, cropPrice, fieldPrice, fieldDef, expectedYield,
  };
})();
