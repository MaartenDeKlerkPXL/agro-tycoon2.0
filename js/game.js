// Agro Tycoon 2.0 — spellogica (geen tekenwerk, geen DOM)
// Velden bestaan uit cellen; zowel jij (zelf rijden) als loonwerkers bewerken die cellen.
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const SAVE_KEY = 'agro-tycoon-2-save';
  const CROP_KEYS = Object.keys(D.crops);           // index+1 = gewas-id in cellen (0 = geen)
  const ST = { STUBBLE: 0, PLOWED: 1, SOWN: 2 };    // celtoestanden

  // ---------- kleine event-bus zodat UI kan reageren ----------
  const listeners = {};
  AT.on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); };
  AT.emit = (evt, payload) => { (listeners[evt] || []).forEach(fn => fn(payload)); };

  let uidCounter = 1;
  const newUid = () => uidCounter++;

  // ---------- nieuw spel ----------
  function newCells(def) {
    const n = def.cols * def.rows;
    return { state: new Uint8Array(n), crop: new Uint8Array(n), planted: new Float32Array(n) };
  }

  function createState() {
    const market = {}, silo = {};
    for (const key of CROP_KEYS) { market[key] = { factor: 1, history: [1] }; silo[key] = 0; }

    return {
      version: D.version,
      money: D.start.money,
      time: D.start.hour, // totaal aantal speluren sinds start
      speed: 1,
      paused: false,
      siloLevel: D.start.siloLevel,
      silo,
      market,
      fields: D.fields.map(f => ({ id: f.id, owned: !!f.owned, cells: newCells(f), job: null, readyNotified: false })),
      machines: D.start.machines.map(type => ({ uid: newUid(), type, busy: null })),
      player: null,     // { uid, implUid, x, y, angle, speed, lowered, crop }
      lastRig: null,
      stats: { drove: false, plowedHa: 0, sownHa: 0, harvestedHa: 0, tonsHarvested: 0, earned: 0, spent: 0, workerJobs: 0 },
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
  const growHours = cropIdx => D.crops[CROP_KEYS[cropIdx - 1]].growDays * 24;
  const cellHa = def => def.ha / (def.cols * def.rows);

  function log(text, type = 'info') {
    const s = S();
    s.log.unshift({ day: day(), hour: Math.floor(hour()), text, type });
    if (s.log.length > 60) s.log.length = 60;
    AT.emit('log');
  }

  function spend(amount) { S().money -= amount; S().stats.spent += amount; }
  function earn(amount, countAsEarned = true) {
    S().money += amount;
    if (countAsEarned) S().stats.earned += amount;
  }

  function siloCapacity() { return D.silo[S().siloLevel].capacity; }
  function siloUsed() { return Object.values(S().silo).reduce((a, b) => a + b, 0); }
  function siloRoom() { return siloCapacity() - siloUsed(); }
  function cropPrice(crop) { return Math.round(D.crops[crop].basePrice * S().market[crop].factor); }
  function fieldPrice(id) { return fieldDef(id).ha * D.landPricePerHa; }

  // ---------- cellen ----------
  function isReady(f, i) {
    const c = f.cells;
    return c.state[i] === ST.SOWN && S().time >= c.planted[i] + growHours(c.crop[i]);
  }

  // 0..1 groei van een ingezaaide cel
  function cellGrowth(f, i) {
    const c = f.cells;
    if (c.state[i] !== ST.SOWN) return 0;
    return Math.min(1, (S().time - c.planted[i]) / growHours(c.crop[i]));
  }

  function cellAt(x, y) {
    const def = D.fields.find(f => x >= f.x && x < f.x + f.w && y >= f.y && y < f.y + f.h);
    if (!def) return null;
    const col = Math.floor((x - def.x) / D.CELL), row = Math.floor((y - def.y) / D.CELL);
    return { def, f: field(def.id), i: row * def.cols + col };
  }

  // Telling per toestand (voor UI, minimap en loonwerkers)
  function summary(f) {
    const c = f.cells, n = c.state.length;
    const out = { total: n, stubble: 0, plowed: 0, growing: 0, ready: 0, crops: {}, readyTons: 0, minGrowth: 1 };
    const def = fieldDef(f.id), ha = cellHa(def);
    for (let i = 0; i < n; i++) {
      const s = c.state[i];
      if (s === ST.STUBBLE) out.stubble++;
      else if (s === ST.PLOWED) out.plowed++;
      else {
        const key = CROP_KEYS[c.crop[i] - 1];
        out.crops[key] = (out.crops[key] || 0) + 1;
        if (isReady(f, i)) { out.ready++; out.readyTons += ha * D.crops[key].yieldPerHa; }
        else { out.growing++; out.minGrowth = Math.min(out.minGrowth, cellGrowth(f, i)); }
      }
    }
    return out;
  }

  function mainCrop(sum) {
    let best = null;
    for (const k in sum.crops) if (!best || sum.crops[k] > sum.crops[best]) best = k;
    return best;
  }

  // Bewerk één cel. mode = 'player' (betaal direct) of 'worker' (vooruitbetaald).
  // Geeft 'ok', 'skip', 'nomoney' of 'full' terug.
  function workCell(f, i, op, cropKey, mode) {
    const c = f.cells, def = fieldDef(f.id), s = S();
    if (!f.owned) return 'skip';
    const ha = cellHa(def);

    if (op === 'plow') {
      if (c.state[i] !== ST.STUBBLE) return 'skip';
      c.state[i] = ST.PLOWED;
      s.stats.plowedHa += ha;
    } else if (op === 'sow') {
      if (c.state[i] !== ST.PLOWED) return 'skip';
      if (mode === 'player') {
        const cost = D.crops[cropKey].seedCostPerHa * ha;
        if (s.money < cost) return 'nomoney';
        spend(cost);
      }
      c.state[i] = ST.SOWN;
      c.crop[i] = CROP_KEYS.indexOf(cropKey) + 1;
      c.planted[i] = s.time;
      s.stats.sownHa += ha;
    } else if (op === 'harvest') {
      if (!isReady(f, i)) return 'skip';
      const key = CROP_KEYS[c.crop[i] - 1];
      const tons = ha * D.crops[key].yieldPerHa * (0.9 + Math.random() * 0.2);
      if (siloRoom() < tons) {
        if (mode === 'player') return 'full';
        if (f.job) f.job.lost += tons; // loonwerker: overschot gaat verloren
      } else {
        s.silo[key] += tons;
        s.stats.tonsHarvested += tons;
      }
      c.state[i] = ST.STUBBLE;
      c.crop[i] = 0;
      s.stats.harvestedHa += ha;
    }
    if (AT.cellChanged) AT.cellChanged(f.id, i);
    return 'ok';
  }

  // ---------- loonwerkers (automatische taken) ----------
  const TASK_IMPLEMENT = { plow: 'plow', sow: 'seeder' };
  const TASK_OP = { plow: 'plow', sow: 'sow', harvest: 'harvest' };

  // snelheidsbonus als de tractor sterker is dan het werktuig nodig heeft
  function speedFactor(tractorDef, implDef) {
    const extra = (tractorDef.power - implDef.minPower) / implDef.minPower;
    return Math.min(1 + extra * 0.5, 1.75);
  }

  // Snelste vrije combinatie voor een taak: { machines, hours, cost, width } of null
  function bestRig(task, fieldId) {
    const ha = fieldDef(fieldId).ha;
    const free = S().machines.filter(m => !m.busy);
    const wage = D.workerWagePerHour;
    let best = null;

    if (task === 'harvest') {
      for (const m of free) {
        const d = machineDef(m);
        if (d.kind !== 'harvester') continue;
        const hours = ha / d.rate;
        if (!best || hours < best.hours) best = { machines: [m], hours, width: d.width, cost: hours * (d.fuelPerHour * D.fuelPrice + wage) };
      }
      return best;
    }

    const implKind = TASK_IMPLEMENT[task];
    for (const t of free) {
      const td = machineDef(t);
      if (td.kind !== 'tractor') continue;
      for (const i of free) {
        const id = machineDef(i);
        if (id.kind !== implKind || td.power < id.minPower) continue;
        const hours = ha / (id.rate * speedFactor(td, id));
        if (!best || hours < best.hours) best = { machines: [t, i], hours, width: id.width, cost: hours * (td.fuelPerHour * D.fuelPrice + wage) };
      }
    }
    return best;
  }

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

  // Volgorde waarin een loonwerker de cellen afrijdt: banen (slangpatroon)
  function jobCell(def, laneCols, k) {
    const perLane = def.rows * laneCols;
    const lane = Math.floor(k / perLane);
    const within = k % perLane;
    let row = Math.floor(within / laneCols);
    const col = lane * laneCols + (within % laneCols);
    if (lane % 2 === 1) row = def.rows - 1 - row;
    if (col >= def.cols) return -1;
    return row * def.cols + col;
  }

  function jobLength(def, laneCols) { return Math.ceil(def.cols / laneCols) * def.rows * laneCols; }

  // Positie van de loonwerker-machine (voor tekenen)
  function jobPosition(def, job) {
    const N = jobLength(def, job.laneCols);
    const k = Math.min(N - 1, Math.floor(job.progress * N));
    const perLane = def.rows * job.laneCols;
    const lane = Math.floor(k / perLane);
    const rowF = (k % perLane) / perLane * def.rows;
    const down = lane % 2 === 0;
    const x = def.x + Math.min(def.w, (lane + 0.5) * job.laneCols * D.CELL);
    const y = down ? def.y + rowF * D.CELL : def.y + def.h - rowF * D.CELL;
    return { x, y, angle: down ? Math.PI / 2 : -Math.PI / 2 };
  }

  function startJob(fieldId, task, crop) {
    const f = field(fieldId);
    if (!f || !f.owned || f.job) return false;
    const sum = summary(f);
    const eligible = { plow: sum.stubble, sow: sum.plowed, harvest: sum.ready }[task];
    if (!eligible) return false;

    const rig = bestRig(task, fieldId);
    if (!rig) { log(missingFor(task), 'warn'); return false; }

    const def = fieldDef(fieldId);
    let cost = rig.cost;
    if (task === 'sow') {
      if (!D.crops[crop]) return false;
      cost += D.crops[crop].seedCostPerHa * cellHa(def) * eligible;
    }
    if (task === 'harvest' && siloRoom() < sum.readyTons) {
      log(`Silo te vol om Veld ${fieldId} te oogsten. Verkoop graan of vergroot de silo.`, 'warn');
      return false;
    }
    if (S().money < cost) { log(`Niet genoeg geld (nodig: ${AT.fmtMoney(cost)}).`, 'warn'); return false; }

    spend(cost);
    rig.machines.forEach(m => { m.busy = fieldId; });
    f.job = {
      type: task, crop, machines: rig.machines.map(m => m.uid), hours: rig.hours,
      progress: 0, idx: 0, laneCols: Math.max(1, Math.round(rig.width / D.CELL)), lost: 0,
    };
    const names = rig.machines.map(m => machineDef(m).name).join(' + ');
    const verb = { plow: 'ploegt', sow: 'zaait', harvest: 'oogst' }[task];
    log(`Loonwerker ${verb} Veld ${fieldId} met ${names} (${AT.fmtHours(rig.hours)}, ${AT.fmtMoney(cost)}).`);
    AT.emit('change');
    return true;
  }

  function advanceJob(f, dtHours) {
    const job = f.job, def = fieldDef(f.id);
    job.progress = Math.min(1, job.progress + dtHours / job.hours);
    const N = jobLength(def, job.laneCols);
    const target = job.progress >= 1 ? N : Math.floor(job.progress * N);
    for (; job.idx < target; job.idx++) {
      const i = jobCell(def, job.laneCols, job.idx);
      if (i >= 0) workCell(f, i, TASK_OP[job.type], job.crop, 'worker');
    }
    if (job.progress >= 1) finishJob(f);
  }

  function finishJob(f) {
    const job = f.job, s = S();
    s.machines.forEach(m => { if (job.machines.includes(m.uid)) m.busy = null; });
    s.stats.workerJobs++;
    const done = { plow: 'geploegd', sow: 'ingezaaid', harvest: 'geoogst' }[job.type];
    log(`Loonwerker klaar: Veld ${f.id} is ${done}.`, 'good');
    if (job.lost > 0) log(`Silo vol! ${AT.fmtTons(job.lost)} ging verloren.`, 'warn');
    f.job = null;
    AT.emit('change');
  }

  // ---------- zelf rijden: in- en uitstappen ----------
  function canPull(tractor, impl) {
    return machineDef(tractor).kind === 'tractor' && ['plow', 'seeder'].includes(machineDef(impl).kind) &&
      machineDef(tractor).power >= machineDef(impl).minPower;
  }

  function enterVehicle(uid, implUid) {
    const s = S();
    if (s.player) exitVehicle();
    const m = s.machines.find(x => x.uid === uid);
    if (!m || m.busy) return false;
    const impl = implUid ? s.machines.find(x => x.uid === implUid) : null;
    if (impl && (impl.busy || !canPull(m, impl))) return false;
    if (machineDef(m).kind !== 'tractor' && machineDef(m).kind !== 'harvester') return false;

    m.busy = 'player';
    if (impl) impl.busy = 'player';
    const firstCrop = CROP_KEYS[0];
    s.player = {
      uid, implUid: impl ? impl.uid : null,
      x: D.shedExit.x, y: D.shedExit.y, angle: D.shedExit.angle,
      speed: 0, lowered: false, crop: (s.player && s.player.crop) || firstCrop,
    };
    s.lastRig = { uid, implUid: s.player.implUid };
    s.stats.drove = true;
    log(`Je stapt in de ${machineDef(m).name}${impl ? ' met ' + machineDef(impl).name : ''}.`);
    AT.emit('enter');
    AT.emit('change');
    return true;
  }

  function exitVehicle() {
    const s = S();
    if (!s.player) return;
    s.machines.forEach(m => { if (m.busy === 'player') m.busy = null; });
    s.player = null;
    log('Machine teruggezet in de schuur.');
    AT.emit('change');
  }

  // ---------- acties ----------
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
    log(`Veld ${id} gekocht (${AT.fmtHa(fieldDef(id).ha)}) voor ${AT.fmtMoney(price)}.`, 'money');
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
    for (const key of CROP_KEYS) {
      const m = S().market[key];
      const drift = (1 - m.factor) * 0.1; // lichte trek terug naar 1.0
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

  // melding als een veld helemaal rijp is
  function checkReady() {
    for (const f of S().fields) {
      if (!f.owned) continue;
      const sum = summary(f);
      if (sum.ready > 0 && sum.growing === 0 && !f.readyNotified) {
        f.readyNotified = true;
        log(`${D.crops[mainCrop(sum)].name} op Veld ${f.id} is klaar om te oogsten!`, 'good');
        AT.emit('change');
      }
      if (sum.ready === 0) f.readyNotified = false;
    }
  }

  let readyTimer = 0;
  // dtSeconds = echte seconden sinds vorige frame
  function tick(dtSeconds) {
    const s = S();
    if (s.paused) return;
    const dtHours = dtSeconds * D.hoursPerSecond * s.speed;
    const prevDay = day();
    s.time += dtHours;

    for (const f of s.fields) if (f.job) advanceJob(f, dtHours);
    if (s.player && AT.vehicle) AT.vehicle.update(dtSeconds, dtHours);

    readyTimer += dtSeconds;
    if (readyTimer > 0.5) { readyTimer = 0; checkReady(); }

    if (day() !== prevDay) {
      updateMarket();
      save();
      AT.emit('newday');
    }
    checkGoals();
  }

  // ---------- opslaan / laden ----------
  const packBytes = arr => Array.from(arr, v => String.fromCharCode(48 + v)).join('');
  const unpackBytes = (str, n) => { const a = new Uint8Array(n); for (let i = 0; i < n && i < str.length; i++) a[i] = str.charCodeAt(i) - 48; return a; };

  function save() {
    const s = S();
    const out = Object.assign({}, s, {
      fields: s.fields.map(f => ({
        id: f.id, owned: f.owned, job: f.job, readyNotified: f.readyNotified,
        state: packBytes(f.cells.state), crop: packBytes(f.cells.crop),
        planted: Array.from(f.cells.planted, (v, i) => f.cells.state[i] === ST.SOWN ? Math.round(v * 10) / 10 : 0),
      })),
    });
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(out)); } catch (e) { /* geen opslag beschikbaar */ }
  }

  function load() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { saved = null; }
    const fresh = createState();
    if (!saved || saved.version !== D.version) return fresh;

    const state = Object.assign(fresh, saved);
    state.fields = D.fields.map(def => {
      const sf = (saved.fields || []).find(x => x.id === def.id);
      const f = { id: def.id, owned: !!def.owned, cells: newCells(def), job: null, readyNotified: false };
      if (!sf) return f;
      const n = def.cols * def.rows;
      f.owned = sf.owned; f.job = sf.job; f.readyNotified = sf.readyNotified;
      f.cells.state = unpackBytes(sf.state || '', n);
      f.cells.crop = unpackBytes(sf.crop || '', n);
      f.cells.planted = Float32Array.from({ length: n }, (_, i) => (sf.planted || [])[i] || 0);
      return f;
    });
    const base = createState();
    state.silo = Object.assign(base.silo, saved.silo);
    state.market = Object.assign(base.market, saved.market);
    state.stats = Object.assign(base.stats, saved.stats);
    state.machines = (saved.machines || []).filter(m => D.machines[m.type]);
    uidCounter = state.machines.reduce((max, m) => Math.max(max, m.uid), 0) + 1;
    return state;
  }

  function reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ok */ }
    uidCounter = 1;
    AT.state = createState();
    log('Welkom bij Agro Tycoon 2.0! Ga naar Garage en stap in je tractor met ploeg.', 'goal');
    AT.emit('reset');
    AT.emit('change');
  }

  // ---------- formatters ----------
  AT.fmtMoney = n => '€' + Math.round(n).toLocaleString('nl-NL');
  AT.fmtTons = n => n.toFixed(1).replace('.', ',') + ' t';
  AT.fmtHa = n => String(n).replace('.', ',') + ' ha';
  AT.fmtHours = n => n.toFixed(1).replace('.', ',') + ' u';

  AT.game = {
    ST, CROP_KEYS,
    tick, startJob, sell, buyField, buyMachine, sellMachine, upgradeSilo, enterVehicle, exitVehicle,
    save, load, reset, bestRig, missingFor, canPull, workCell, cellAt, summary, mainCrop,
    isReady, cellGrowth, jobPosition, log,
    day, hour, siloCapacity, siloUsed, siloRoom, cropPrice, fieldPrice, fieldDef, field,
  };
})();
