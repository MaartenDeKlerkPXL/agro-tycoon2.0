// Agro Tycoon 2.0 — spellogica (geen tekenwerk, geen DOM)
// Velden bestaan uit cellen; zowel jij (zelf rijden) als loonwerkers bewerken die cellen.
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const SAVE_KEY = 'agro-tycoon-2-save';
  const CROP_KEYS = Object.keys(D.crops);           // index+1 = gewas-id in cellen (0 = geen)
  const ST = { STUBBLE: 0, PLOWED: 1, SOWN: 2 };    // celtoestanden
  const FERT = 1, MANURE = 2;                        // bits in cells.fert
  const IMPLEMENT_KINDS = ['plow', 'seeder', 'spreader', 'manure', 'trailer'];
  const isImplement = kind => IMPLEMENT_KINDS.includes(kind);

  // ---------- kleine event-bus zodat UI kan reageren ----------
  const listeners = {};
  AT.on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); };
  AT.emit = (evt, payload) => { (listeners[evt] || []).forEach(fn => fn(payload)); };

  let uidCounter = 1;
  const newUid = () => uidCounter++;

  // ---------- nieuw spel ----------
  function newCells(def) {
    const n = def.cols * def.rows;
    // planted = stand van de groeiklok bij het zaaien, fert = kunstmest/mest-bits, prev = vorig gewas
    return { state: new Uint8Array(n), crop: new Uint8Array(n), planted: new Float32Array(n), dir: new Uint8Array(n), fert: new Uint8Array(n), prev: new Uint8Array(n) };
  }

  function startMachines() {
    const list = [];
    for (const m of D.start.machines) {
      const slot = D.slots[m.slot];
      const mm = { uid: newUid(), type: m.type, busy: null, x: slot.x, y: slot.y, angle: 0, impl: null, attached: null };
      list.push(mm);
      if (m.impl) {
        const im = { uid: newUid(), type: m.impl, busy: null, x: 0, y: 0, angle: 0, impl: null, attached: mm.uid };
        mm.impl = im.uid;
        list.push(im);
      }
    }
    return list;
  }

  function createState() {
    const market = {}, silo = {}, goods = {}, growClock = {};
    for (const key of CROP_KEYS) { market[key] = { factor: 1, history: [1] }; silo[key] = 0; growClock[key] = 0; }
    for (const key of Object.keys(D.products)) { market[key] = { factor: 1, history: [1] }; goods[key] = 0; }
    const animals = {}, factories = {};
    for (const key of Object.keys(D.animals)) animals[key] = { owned: false, count: 0, fed: 1, produced: {} };
    for (const key of Object.keys(D.factories)) factories[key] = { owned: false, on: true, progress: 0, status: '', made: 0 };

    return {
      version: D.version,
      money: D.start.money,
      time: D.start.hour, // totaal aantal speluren sinds start
      speed: 1,
      paused: false,
      siloLevel: D.start.siloLevel,
      silo,
      goods,      // producten van dieren en fabrieken
      market,
      growClock,  // per gewas: opgetelde "effectieve groei-uren" (seizoen + weer)
      weather: null,
      animals,
      factories,
      fields: D.fields.map(f => ({ id: f.id, owned: !!f.owned, cells: newCells(f), job: null, readyNotified: false, soil: D.startSoil, damage: 0 })),
      machines: startMachines(),
      // speler: te voet (mode 'foot') of in een machine (mode 'drive', vehicle = uid)
      player: { mode: 'foot', x: D.start.farmer.x, y: D.start.farmer.y, angle: Math.PI, speed: 0, vehicle: null, lowered: false, crop: CROP_KEYS[0] },
      stats: { drove: false, plowedHa: 0, sownHa: 0, harvestedHa: 0, tonsHarvested: 0, earned: 0, spent: 0, workerJobs: 0, fertHa: 0, rotationHa: 0, greenManureHa: 0, cropsHarvested: {}, deliveredTons: 0 },
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
  function cropPrice(crop) {
    const season = AT.weather ? AT.weather.priceFactor(crop) : 1;
    return Math.round(D.crops[crop].basePrice * S().market[crop].factor * season);
  }
  // prijs per eenheid van een gewas (per ton) of product (per L, st, kg, t)
  function price(key) {
    if (D.crops[key]) return cropPrice(key);
    return D.products[key].basePrice * S().market[key].factor;
  }
  // voorraad: gewassen zitten in de silo, producten in de opslag
  function stock(key) { return D.crops[key] ? S().silo[key] : S().goods[key]; }
  function take(key, amount) { if (D.crops[key]) S().silo[key] = Math.max(0, S().silo[key] - amount); else S().goods[key] = Math.max(0, S().goods[key] - amount); }
  function addGood(key, amount) { S().goods[key] += amount; }
  function fieldPrice(id) { return fieldDef(id).ha * D.landPricePerHa; }

  // ---------- cellen ----------
  const clock = cropIdx => S().growClock[CROP_KEYS[cropIdx - 1]];
  function isReady(f, i) {
    const c = f.cells;
    return c.state[i] === ST.SOWN && clock(c.crop[i]) >= c.planted[i] + growHours(c.crop[i]);
  }

  // hoe ver over de rijpheid heen (0 = net rijp); boven witherAfter verwelkt het gewas
  function overripe(f, i) {
    const c = f.cells;
    if (c.state[i] !== ST.SOWN) return 0;
    return Math.max(0, (clock(c.crop[i]) - c.planted[i]) / growHours(c.crop[i]) - 1);
  }
  const isWithering = (f, i) => overripe(f, i) > D.witherAfter;

  // 0..1 groei van een ingezaaide cel
  function cellGrowth(f, i) {
    const c = f.cells;
    if (c.state[i] !== ST.SOWN) return 0;
    // max(0): het zaaimoment wordt iets minder precies opgeslagen, dus nooit negatief
    return Math.max(0, Math.min(1, (clock(c.crop[i]) - c.planted[i]) / growHours(c.crop[i])));
  }

  // ---------- lading: graanbunker van de maaidorser of een aanhanger ----------
  function getLoad(m) {
    if (!m.load) m.load = { crop: null, tons: 0 };
    return m.load;
  }
  function loadCap(m) { const d = machineDef(m); return d.tank || d.capacity || 0; }

  // positie van een aanhanger: aan een tractor of los geparkeerd (x/y = trekoog)
  function trailerPose(m) {
    const d = machineDef(m);
    let hx = m.x, hy = m.y, a = m.angle;
    if (m.attached) { const t = machine(m.attached); const h = hitchPoint(t); hx = h.x; hy = h.y; a = t.angle; }
    const cx = Math.cos(a), cy = Math.sin(a);
    return {
      angle: a,
      center: { x: hx - cx * (3 + d.length / 2), y: hy - cy * (3 + d.length / 2) },
      rear: { x: hx - cx * (3 + d.length + 2), y: hy - cy * (3 + d.length + 2) },
    };
  }

  // ---------- bodem & opbrengst ----------
  // vermenigvuldiger op de basisopbrengst van één cel
  function yieldFactor(f, i) {
    const c = f.cells, crop = c.crop[i];
    let k = 0.6 + 0.6 * f.soil;                       // bodemkwaliteit 0..1 → ×0,6..×1,2
    if (c.fert[i] & FERT) k *= D.fertBonus;
    if (c.fert[i] & MANURE) k *= D.manureBonus;
    if (c.prev[i]) k *= c.prev[i] !== crop ? D.rotationBonus : D.monoculturePenalty;
    const cropDef = D.crops[CROP_KEYS[crop - 1]];
    if (AT.weather && AT.weather.drought() && !cropDef.droughtProof) k *= 0.85;
    const over = overripe(f, i);
    if (over > D.witherAfter) k *= Math.max(0.4, 1 - (over - D.witherAfter) * 0.6); // verwelkt
    return k * (1 - f.damage);
  }
  function cellYield(f, i) {
    const def = fieldDef(f.id);
    return cellHa(def) * D.crops[CROP_KEYS[f.cells.crop[i] - 1]].yieldPerHa * yieldFactor(f, i);
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
    const out = { total: n, stubble: 0, plowed: 0, growing: 0, ready: 0, crops: {}, readyTons: 0, minGrowth: 1,
      fert: 0, manure: 0, needFert: 0, needManure: 0, prev: {}, factorSum: 0, factorN: 0, readyCrops: {}, clover: 0, withering: 0 };
    for (let i = 0; i < n; i++) {
      const s = c.state[i];
      const fe = c.fert[i];
      if (fe & FERT) out.fert++;
      if (fe & MANURE) out.manure++;
      if (c.prev[i]) { const pk = CROP_KEYS[c.prev[i] - 1]; out.prev[pk] = (out.prev[pk] || 0) + 1; }
      if (s === ST.STUBBLE) out.stubble++;
      else if (s === ST.PLOWED) out.plowed++;
      else {
        const key = CROP_KEYS[c.crop[i] - 1];
        out.crops[key] = (out.crops[key] || 0) + 1;
        const fac = yieldFactor(f, i);
        out.factorSum += fac; out.factorN++;
        if (D.crops[key].greenManure) out.clover++;
        if (isReady(f, i)) {
          out.ready++; out.readyTons += cellYield(f, i);
          out.readyCrops[key] = (out.readyCrops[key] || 0) + 1;
          if (isWithering(f, i)) out.withering++;
        }
        else { out.growing++; out.minGrowth = Math.min(out.minGrowth, cellGrowth(f, i)); }
      }
      const ready = s === ST.SOWN && isReady(f, i);
      if (!ready && (s === ST.PLOWED || s === ST.SOWN) && !(fe & FERT)) out.needFert++;
      if (!ready && !(fe & MANURE)) out.needManure++;
    }
    out.avgFactor = out.factorN ? out.factorSum / out.factorN : null;
    return out;
  }

  function mainCrop(sum) {
    let best = null;
    for (const k in sum.crops) if (!best || sum.crops[k] > sum.crops[best]) best = k;
    return best;
  }

  function canSowNow(cropKey) { return !AT.weather || D.crops[cropKey].sow.includes(AT.weather.month()); }
  function tooWet() { return AT.weather && AT.weather.isWet(); }

  // Bewerk één cel. mode = 'player' (betaal direct) of 'worker' (vooruitbetaald).
  // tool = machine-definitie (voor oogsten: welke gewassen kan hij aan)
  // Geeft 'ok', 'skip', 'nomoney', 'full', 'season', 'wet', 'nomanure' of 'wrongtool' terug.
  // bunker = { load, cap }: als je zelf oogst gaat het graan in de bunker van de maaidorser
  function workCell(f, i, op, cropKey, mode, dir = 0, tool = null, bunker = null) {
    const c = f.cells, def = fieldDef(f.id), s = S();
    if (!f.owned) return 'skip';
    const ha = cellHa(def);

    if (op === 'plow') {
      const cropDef = c.state[i] === ST.SOWN ? D.crops[CROP_KEYS[c.crop[i] - 1]] : null;
      if (c.state[i] !== ST.STUBBLE && !(cropDef && cropDef.greenManure)) return 'skip';
      if (cropDef) {
        // groenbemester onderploegen: hoe verder gegroeid, hoe beter voor de bodem
        f.soil = Math.min(1, f.soil + cropDef.greenManure * cellGrowth(f, i) / (def.cols * def.rows));
        if (isReady(f, i)) s.stats.greenManureHa += ha;
        c.prev[i] = c.crop[i];
        c.crop[i] = 0;
      }
      c.state[i] = ST.PLOWED;
      c.dir[i] = dir;
      s.stats.plowedHa += ha;
    } else if (op === 'sow') {
      if (c.state[i] !== ST.PLOWED) return 'skip';
      if (!canSowNow(cropKey)) return 'season';
      if (mode === 'player') {
        const cost = D.crops[cropKey].seedCostPerHa * ha;
        if (s.money < cost) return 'nomoney';
        spend(cost);
      }
      c.state[i] = ST.SOWN;
      c.crop[i] = CROP_KEYS.indexOf(cropKey) + 1;
      c.planted[i] = s.growClock[cropKey];
      c.dir[i] = dir;
      s.stats.sownHa += ha;
    } else if (op === 'fertilize') {
      const ready = c.state[i] === ST.SOWN && isReady(f, i);
      if (c.state[i] === ST.STUBBLE || ready || (c.fert[i] & FERT)) return 'skip';
      if (mode === 'player') {
        const cost = D.fertCostPerHa * ha;
        if (s.money < cost) return 'nomoney';
        spend(cost);
      }
      c.fert[i] |= FERT;
      f.soil = Math.min(1, f.soil + 0.05 / (def.cols * def.rows));
      s.stats.fertHa += ha;
    } else if (op === 'manure') {
      const ready = c.state[i] === ST.SOWN && isReady(f, i);
      if (ready || (c.fert[i] & MANURE)) return 'skip';
      if (mode === 'player') {
        const need = D.manurePerHa * ha;
        if (s.goods.manure < need) return 'nomanure';
        s.goods.manure -= need;
      }
      c.fert[i] |= MANURE;
      f.soil = Math.min(1, f.soil + D.manureSoil / (def.cols * def.rows));
      s.stats.fertHa += ha;
    } else if (op === 'harvest') {
      if (!isReady(f, i)) return 'skip';
      const key = CROP_KEYS[c.crop[i] - 1];
      if (tool && tool.harvests !== D.crops[key].harvester) return 'wrongtool';
      if (mode === 'player' && tooWet()) return 'wet';
      const tons = cellYield(f, i) * (0.95 + Math.random() * 0.1);
      if (bunker) {
        const L = bunker.load;
        if (L.tons > 0.001 && L.crop && L.crop !== key) return 'mixed';
        if (L.tons + tons > bunker.cap) return 'tankfull';
        L.crop = key; L.tons += tons;
        s.stats.tonsHarvested += tons;
      } else if (siloRoom() < tons) {
        if (mode === 'player') return 'full';
        if (f.job) f.job.lost += tons; // loonwerker: overschot gaat verloren
      } else {
        s.silo[key] += tons;
        s.stats.tonsHarvested += tons;
      }
      if (c.prev[i] && c.prev[i] !== c.crop[i]) s.stats.rotationHa += ha;
      s.stats.cropsHarvested[key] = (s.stats.cropsHarvested[key] || 0) + tons;
      f.soil = Math.max(0.05, f.soil - D.crops[key].soilDemand / (def.cols * def.rows));
      c.prev[i] = c.crop[i];
      c.state[i] = ST.STUBBLE;
      c.crop[i] = 0;
      c.fert[i] = 0;
      c.dir[i] = dir;
      s.stats.harvestedHa += ha;
    }
    if (AT.cellChanged) AT.cellChanged(f.id, i);
    return 'ok';
  }

  // ---------- loonwerkers (automatische taken) ----------
  const TASK_IMPLEMENT = { plow: 'plow', sow: 'seeder', fertilize: 'spreader', manure: 'manure' };
  const TASK_OP = { plow: 'plow', sow: 'sow', harvest: 'harvest', fertilize: 'fertilize', manure: 'manure' };
  const IMPL_NAMES = { plow: 'ploeg', seeder: 'zaaimachine', spreader: 'kunstmeststrooier', manure: 'mestverspreider', trailer: 'aanhanger' };

  // snelheidsbonus als de tractor sterker is dan het werktuig nodig heeft
  function speedFactor(tractorDef, implDef) {
    const extra = (tractorDef.power - implDef.minPower) / implDef.minPower;
    return Math.min(1 + extra * 0.5, 1.75);
  }

  // Snelste vrije combinatie voor een taak: { machines, hours, cost, width } of null
  // welk gewas er op een veld het meest rijp staat (bepaalt welke oogstmachine nodig is)
  function readyCropOf(fieldId) {
    const sum = summary(field(fieldId));
    return mainCrop({ crops: sum.readyCrops });
  }
  const HARVESTER_NAMES = { combine: 'maaidorser', potato: 'aardappelrooier', beet: 'bietenrooier' };

  function bestRig(task, fieldId) {
    const ha = fieldDef(fieldId).ha;
    const free = S().machines.filter(m => !m.busy);
    const wage = D.workerWagePerHour;
    let best = null;

    if (task === 'harvest') {
      const crop = readyCropOf(fieldId);
      const need = crop ? D.crops[crop].harvester : 'combine';
      for (const m of free) {
        const d = machineDef(m);
        if (d.kind !== 'harvester' || d.harvests !== need) continue;
        const hours = ha / d.rate;
        if (!best || hours < best.hours) best = { machines: [m], hours, width: d.width, fuelPerHour: d.fuelPerHour, cost: hours * (d.fuelPerHour * D.fuelPrice + wage) };
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
        if (t.impl && t.impl !== i.uid && machine(t.impl).busy) continue; // ander werktuig in gebruik
        if (i.attached && i.attached !== t.uid) continue;  // werktuig hangt aan een andere tractor
        const hours = ha / (id.rate * speedFactor(td, id));
        if (!best || hours < best.hours) best = { machines: [t, i], hours, width: id.width, fuelPerHour: td.fuelPerHour, cost: hours * (td.fuelPerHour * D.fuelPrice + wage) };
      }
    }
    return best;
  }

  function missingFor(task, fieldId) {
    const all = S().machines;
    if (task === 'harvest' && fieldId) {
      const crop = readyCropOf(fieldId), need = crop && D.crops[crop].harvester;
      if (crop && !need) return `${D.crops[crop].name} oogst je niet: ploeg het onder voor een betere bodem.`;
      if (need && !all.some(m => machineDef(m).harvests === need)) return `Voor ${D.crops[crop].name.toLowerCase()} heb je een ${HARVESTER_NAMES[need]} nodig (Winkel).`;
    }
    const needKinds = task === 'harvest' ? ['harvester'] : ['tractor', TASK_IMPLEMENT[task]];
    if (all.some(m => m.busy === 'player' && needKinds.includes(machineDef(m).kind)))
      return 'Je rijdt zelf met de machine die hiervoor nodig is. Stap eerst uit (E).';
    const has = kind => all.some(m => machineDef(m).kind === kind);
    if (task === 'harvest') return has('harvester') ? 'Alle maaidorsers zijn bezig.' : 'Je hebt geen maaidorser.';
    const implKind = TASK_IMPLEMENT[task];
    const implName = IMPL_NAMES[implKind];
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

  // Start een opdracht. opts.worker = werknemer (of de externe loonwerker),
  // opts.quiet = geen meldingen (voor de wachtrij). Geeft true of een reden terug.
  function startJob(fieldId, task, crop, opts = {}) {
    const f = field(fieldId);
    const fail = (msg) => { if (!opts.quiet) log(msg, 'warn'); return msg; };
    if (!f || !f.owned || f.job) return 'veld is bezig';
    const sum = summary(f);
    const eligible = { plow: sum.stubble + sum.clover, sow: sum.plowed, harvest: sum.ready, fertilize: sum.needFert, manure: sum.needManure }[task];
    if (!eligible) return 'niets te doen';
    if (task === 'sow' && !canSowNow(crop)) return fail(`${D.crops[crop].name} kun je nu niet zaaien.`);

    const rig = bestRig(task, fieldId);
    if (!rig) return fail(missingFor(task, fieldId));
    const worker = opts.worker || (AT.staff && AT.staff.freeWorker());
    if (!worker) return fail('Geen vrije werknemer. Neem iemand aan in de tab Team of sta loonwerkers toe.');

    const def = fieldDef(fieldId);
    const speed = AT.staff ? AT.staff.workSpeed(worker) : 1;
    const hours = rig.hours / speed;
    // werknemers krijgen dagloon; een externe loonwerker kost uurloon
    let cost = hours * rig.fuelPerHour * D.fuelPrice * (worker.fuel || 1) + (worker.external ? hours * D.workerWagePerHour : 0);
    if (task === 'sow') {
      if (!D.crops[crop]) return 'onbekend gewas';
      cost += D.crops[crop].seedCostPerHa * cellHa(def) * eligible;
    }
    if (task === 'fertilize') cost += D.fertCostPerHa * cellHa(def) * eligible;
    const manureNeed = task === 'manure' ? D.manurePerHa * cellHa(def) * eligible : 0;
    if (manureNeed && S().goods.manure < manureNeed) return fail(`Niet genoeg mest (nodig: ${AT.fmtTons(manureNeed)}). Koeien en schapen maken mest.`);
    if (task === 'harvest' && siloRoom() < sum.readyTons) return fail(`Silo te vol om Veld ${fieldId} te oogsten. Verkoop graan of vergroot de silo.`);
    if (S().money < cost) return fail(`Niet genoeg geld (nodig: ${AT.fmtMoney(cost)}).`);

    spend(cost);
    if (manureNeed) S().goods.manure -= manureNeed;
    const snap = m => ({ uid: m.uid, x: m.x, y: m.y, angle: m.angle, impl: m.impl, attached: m.attached });
    const snapshot = rig.machines.map(snap);
    // de werknemer koppelt zo nodig het juiste werktuig aan (en zet het oude even neer)
    const [tr, im] = rig.machines;
    if (im && tr.impl !== im.uid) {
      if (tr.impl) {
        const old = machine(tr.impl), h = hitchPoint(tr);
        snapshot.push(snap(old));
        Object.assign(old, { attached: null, x: h.x, y: h.y, angle: tr.angle });
      }
      tr.impl = im.uid; im.attached = tr.uid;
    }
    rig.machines.forEach(m => { m.busy = fieldId; });
    const job = {
      snapshot,
      type: task, crop, machines: rig.machines.map(m => m.uid), hours,
      progress: 0, idx: 0, laneCols: Math.max(1, Math.round(rig.width / D.CELL)), lost: 0,
      tool: task === 'harvest' ? rig.machines[0].type : null,
      workerId: worker.id, workerName: worker.name, phase: 'work',
    };
    // eerst over de weg naar het veld rijden
    if (AT.staff) {
      const start = jobPosition(def, job);
      job.path = AT.staff.route({ x: tr.x, y: tr.y }, start);
      job.phase = 'to';
      job.pos = { x: tr.x, y: tr.y, angle: tr.angle };
      job.seg = 0;
    }
    f.job = job;
    if (!worker.external) { worker.status = 'job'; worker.fieldId = fieldId; }
    const names = rig.machines.map(m => machineDef(m).name).join(' + ');
    const verb = { plow: 'ploegt', sow: 'zaait', harvest: 'oogst', fertilize: 'strooit kunstmest op', manure: 'rijdt mest uit op' }[task];
    log(`${worker.name} ${verb} Veld ${fieldId} met ${names} (${AT.fmtHours(hours)}, ${AT.fmtMoney(cost)}).`);
    AT.emit('change');
    return true;
  }

  // rijsnelheid van een werknemer op de weg (px per echte seconde); bij snel-vooruit iets sneller
  function travelSpeed(machineUid) {
    const m = machine(machineUid);
    const kmh = m ? (machineDef(m).speed || 25) : 25;
    return kmh * D.kmhToPx * Math.min(S().speed, 20);
  }

  function advanceJob(f, dtHours, dtSec) {
    const job = f.job, def = fieldDef(f.id);
    if (job.phase === 'to') {
      if (AT.staff.moveAlong(job, travelSpeed(job.machines[0]) * dtSec)) job.phase = 'work';
      return;
    }
    if (job.type === 'harvest' && tooWet()) { job.waiting = true; return; } // wacht tot het droog is
    job.waiting = false;
    job.progress = Math.min(1, job.progress + dtHours / job.hours);
    const N = jobLength(def, job.laneCols);
    const target = job.progress >= 1 ? N : Math.floor(job.progress * N);
    for (; job.idx < target; job.idx++) {
      const i = jobCell(def, job.laneCols, job.idx);
      if (i >= 0) workCell(f, i, TASK_OP[job.type], job.crop, 'worker', 0, job.tool ? D.machines[job.tool] : null);
    }
    if (job.progress >= 1) finishJob(f);
  }

  // positie van een machine die bezig is (onderweg of op het veld)
  function jobPose(def, job) {
    if (job.phase === 'to' && job.pos) return job.pos;
    return jobPosition(def, job);
  }

  function finishJob(f) {
    const job = f.job, s = S();
    const def = fieldDef(f.id);
    s.stats.workerJobs++;
    const done = { plow: 'geploegd', sow: 'ingezaaid', harvest: 'geoogst', fertilize: 'bemest met kunstmest', manure: 'bemest met mest' }[job.type];
    log(`${job.workerName || 'Loonwerker'} klaar: Veld ${f.id} is ${done}.`, 'good');
    if (job.lost > 0) log(`Silo vol! ${AT.fmtTons(job.lost)} ging verloren.`, 'warn');
    f.job = null;
    // terugrijden naar waar de machine stond
    const end = jobPosition(def, Object.assign({}, job, { progress: 1 }));
    const home = (job.snapshot || []).find(x => x.uid === job.machines[0]);
    if (AT.staff && home) {
      s.machines.forEach(m => { if (job.machines.includes(m.uid)) m.busy = 'trip'; });
      s.trips.push({
        id: 't' + Date.now().toString(36) + Math.floor(Math.random() * 1e4),
        machines: job.machines, snapshot: job.snapshot, workerId: job.workerId, workerName: job.workerName,
        type: job.type, fieldId: f.id, path: AT.staff.route(end, { x: home.x, y: home.y }),
        pos: { x: end.x, y: end.y, angle: end.angle }, seg: 0,
      });
    } else {
      endTrip({ machines: job.machines, snapshot: job.snapshot, workerId: job.workerId });
    }
    AT.emit('change');
  }

  // werknemer is terug op het erf: machines terug op hun plek, werknemer weer vrij
  function endTrip(trip) {
    const s = S();
    s.machines.forEach(m => {
      if (trip.machines.includes(m.uid)) m.busy = null;
      const snap = (trip.snapshot || []).find(x => x.uid === m.uid);
      if (snap && !m.busy) Object.assign(m, snap);
    });
    const w = AT.staff && trip.workerId !== 'ext' ? s.staff.employees.find(e => e.id === trip.workerId) : null;
    if (w) {
      const before = AT.staff.level(w);
      w.status = 'idle'; w.fieldId = null; w.xp++;
      if (AT.staff.level(w) > before) log(`${w.name} heeft meer ervaring en werkt nu sneller (niveau ${AT.staff.level(w)}).`, 'good');
    }
  }

  function updateTrips(dtSec) {
    const s = S();
    for (const trip of [...s.trips]) {
      if (AT.staff.moveAlong(trip, travelSpeed(trip.machines[0]) * dtSec)) {
        s.trips = s.trips.filter(t => t !== trip);
        endTrip(trip);
        AT.emit('change');
      }
    }
  }

  // ---------- zelf rijden: in-/uitstappen en koppelen ----------
  const machine = uid => S().machines.find(m => m.uid === uid);
  const HITCH = -12.5; // trekhaak achter de tractor

  function canPull(tractor, impl) {
    return machineDef(tractor).kind === 'tractor' && isImplement(machineDef(impl).kind) &&
      machineDef(tractor).power >= machineDef(impl).minPower;
  }

  function hitchPoint(m) {
    return { x: m.x + Math.cos(m.angle) * HITCH, y: m.y + Math.sin(m.angle) * HITCH };
  }

  function enterVehicle(uid) {
    const s = S(), p = s.player;
    const m = machine(uid);
    if (!m || m.busy || p.mode !== 'foot') return false;
    const kind = machineDef(m).kind;
    if (kind !== 'tractor' && kind !== 'harvester') return false;
    m.busy = 'player';
    if (m.impl) machine(m.impl).busy = 'player';
    Object.assign(p, { mode: 'drive', vehicle: uid, x: m.x, y: m.y, angle: m.angle, speed: 0, lowered: false });
    s.stats.drove = true;
    const impl = m.impl ? machine(m.impl) : null;
    log(`Je stapt in de ${machineDef(m).name}${impl ? ' met ' + machineDef(impl).name : ''}.`);
    AT.emit('change');
    return true;
  }

  function exitVehicle() {
    const s = S(), p = s.player;
    if (p.mode !== 'drive') return;
    const m = machine(p.vehicle);
    m.busy = null;
    if (m.impl) machine(m.impl).busy = null;
    // boer stapt links naast de machine uit
    const side = 12;
    Object.assign(p, {
      mode: 'foot', vehicle: null, speed: 0, lowered: false,
      x: m.x + Math.cos(m.angle - Math.PI / 2) * side, y: m.y + Math.sin(m.angle - Math.PI / 2) * side,
    });
    AT.emit('change');
  }

  // F: werktuig aan- of afkoppelen
  function toggleHitch() {
    const s = S(), p = s.player;
    if (p.mode !== 'drive') return 'none';
    const t = machine(p.vehicle);
    if (machineDef(t).kind !== 'tractor') return 'none';
    if (t.impl) {
      const im = machine(t.impl);
      const h = hitchPoint(t);
      Object.assign(im, { x: h.x, y: h.y, angle: t.angle, attached: null, busy: null });
      t.impl = null;
      p.lowered = false;
      log(`${machineDef(im).name} afgekoppeld.`);
      AT.emit('change');
      return 'off';
    }
    const im = nearestImplement(t);
    if (!im) return 'far';
    if (!canPull(t, im)) { log(`De ${machineDef(t).name} is te zwak voor de ${machineDef(im).name}.`, 'warn'); return 'weak'; }
    t.impl = im.uid;
    im.attached = t.uid;
    im.busy = 'player';
    log(`${machineDef(im).name} aangekoppeld.`);
    AT.emit('change');
    return 'on';
  }

  function nearestImplement(t, maxDist = 14) {
    const h = hitchPoint(t);
    let best = null, bd = maxDist;
    for (const m of S().machines) {
      if (m.busy || m.attached || !isImplement(machineDef(m).kind)) continue;
      const d = Math.hypot(m.x - h.x, m.y - h.y);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  // dichtstbijzijnde vrije machine om in te stappen (te voet)
  function nearestVehicle(x, y, maxDist = 26) {
    let best = null, bd = maxDist;
    for (const m of S().machines) {
      const k = machineDef(m).kind;
      if (m.busy || (k !== 'tractor' && k !== 'harvester')) continue;
      const d = Math.hypot(m.x - x, m.y - y);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  // vrije parkeerplek op het erf voor een nieuwe machine
  function freeSlot() {
    for (const sl of D.slots) {
      const taken = S().machines.some(m => !m.attached && Math.hypot(m.x - sl.x, m.y - sl.y) < 14);
      if (!taken) return sl;
    }
    return { x: D.parking.x + 20 + Math.random() * (D.parking.w - 40), y: D.parking.y + 20 + Math.random() * (D.parking.h - 40) };
  }

  // ---------- acties ----------
  function sell(crop, tons) {
    const s = S();
    tons = Math.min(tons ?? s.silo[crop], s.silo[crop]);
    if (tons <= 0.001) return;
    const revenue = tons * cropPrice(crop) * (1 - D.pickupFee);
    s.silo[crop] -= tons;
    if (s.silo[crop] < 0.001) s.silo[crop] = 0;
    earn(revenue);
    log(`${AT.fmtTons(tons)} ${D.crops[crop].name.toLowerCase()} laten ophalen en verkocht voor ${AT.fmtMoney(revenue)} (−${Math.round(D.pickupFee * 100)}% ophaalkosten).`, 'money');
    AT.emit('change');
  }

  function sellGood(key, amount) {
    const s = S(), d = D.products[key];
    amount = Math.min(amount ?? s.goods[key], s.goods[key]);
    if (amount <= 0.0001) return;
    const revenue = amount * price(key);
    s.goods[key] -= amount;
    if (s.goods[key] < 0.0001) s.goods[key] = 0;
    earn(revenue);
    log(`${AT.fmtAmount(amount, key)} ${d.name.toLowerCase()} verkocht voor ${AT.fmtMoney(revenue)}.`, 'money');
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
    const sl = freeSlot();
    S().machines.push({ uid: newUid(), type, busy: null, x: sl.x, y: sl.y, angle: 0, impl: null, attached: null });
    log(`${d.name} gekocht! Hij staat op de parkeerplaats bij de schuur.`, 'money');
    AT.emit('change');
  }

  function sellMachine(uid) {
    const s = S();
    const m = s.machines.find(x => x.uid === uid);
    if (!m || m.busy) return;
    const value = Math.round(machineDef(m).price * 0.6);
    if (m.impl) { const im = machine(m.impl); const h = hitchPoint(m); Object.assign(im, { x: h.x, y: h.y, angle: m.angle, attached: null }); }
    if (m.attached) machine(m.attached).impl = null;
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
        const crop = D.crops[mainCrop({ crops: sum.readyCrops })];
        log(crop.greenManure ? `${crop.name} op Veld ${f.id} is volgroeid: ploeg het onder voor een betere bodem.` : `${crop.name} op Veld ${f.id} is klaar om te oogsten!`, 'good');
        AT.emit('change');
      }
      if (sum.withering > sum.total * 0.2 && !f.witherNotified) {
        f.witherNotified = true;
        log(`Het gewas op Veld ${f.id} begint te verwelken! Oogst snel, anders verlies je opbrengst.`, 'warn');
      }
      if (!sum.withering) f.witherNotified = false;
      if (sum.ready === 0) f.readyNotified = false;
      if (sum.ready + sum.growing === 0) f.damage = 0;
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
    if (AT.weather) AT.weather.update(dtHours);
    if (AT.farm) AT.farm.update(dtHours);

    for (const f of s.fields) if (f.job) advanceJob(f, dtHours, dtSeconds);
    if (AT.staff) { AT.staff.update(dtSeconds); updateTrips(dtSeconds); }
    if (AT.vehicle) AT.vehicle.update(dtSeconds, dtHours);

    readyTimer += dtSeconds;
    if (readyTimer > 0.5) { readyTimer = 0; checkReady(); }

    if (day() !== prevDay) {
      updateMarket();
      if (AT.staff) AT.staff.payday();
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
        id: f.id, owned: f.owned, job: f.job, readyNotified: f.readyNotified, soil: f.soil, damage: f.damage, auto: f.auto || null,
        state: packBytes(f.cells.state), crop: packBytes(f.cells.crop), dir: packBytes(f.cells.dir),
        fert: packBytes(f.cells.fert), prev: packBytes(f.cells.prev),
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
      const f = { id: def.id, owned: !!def.owned, cells: newCells(def), job: null, readyNotified: false, soil: D.startSoil, damage: 0 };
      if (!sf) return f;
      const n = def.cols * def.rows;
      f.owned = sf.owned; f.job = sf.job; f.readyNotified = sf.readyNotified;
      f.soil = sf.soil ?? D.startSoil; f.damage = sf.damage || 0; f.auto = sf.auto || null;
      f.cells.fert = unpackBytes(sf.fert || '', n);
      f.cells.prev = unpackBytes(sf.prev || '', n);
      f.cells.state = unpackBytes(sf.state || '', n);
      f.cells.crop = unpackBytes(sf.crop || '', n);
      f.cells.dir = unpackBytes(sf.dir || '', n);
      f.cells.planted = Float32Array.from({ length: n }, (_, i) => (sf.planted || [])[i] || 0);
      return f;
    });
    const base = createState();
    state.silo = Object.assign(base.silo, saved.silo);
    state.market = Object.assign(base.market, saved.market);
    state.goods = Object.assign(base.goods, saved.goods);
    state.growClock = Object.assign(base.growClock, saved.growClock);
    for (const k in base.animals) state.animals[k] = Object.assign(base.animals[k], (saved.animals || {})[k]);
    for (const k in base.factories) state.factories[k] = Object.assign(base.factories[k], (saved.factories || {})[k]);
    state.stats = Object.assign(base.stats, saved.stats);
    state.stats.cropsHarvested = state.stats.cropsHarvested || {};
    state.machines = (saved.machines || []).filter(m => D.machines[m.type]);
    uidCounter = state.machines.reduce((max, m) => Math.max(max, m.uid), 0) + 1;
    return state;
  }

  function reset() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ok */ }
    uidCounter = 1;
    AT.state = createState();
    if (AT.weather) AT.weather.init();
    if (AT.staff) AT.staff.ensure();
    log('Welkom bij Agro Tycoon 2.0! Loop met WASD naar je rode tractor en druk E om in te stappen.', 'goal');
    AT.emit('reset');
    AT.emit('change');
  }

  // ---------- formatters ----------
  AT.fmtMoney = n => '€' + Math.round(n).toLocaleString('nl-NL');
  AT.fmtTons = n => n.toFixed(1).replace('.', ',') + ' t';
  AT.fmtHa = n => String(n).replace('.', ',') + ' ha';
  AT.fmtHours = n => n.toFixed(1).replace('.', ',') + ' u';
  AT.fmtNum = (n, dec = 0) => n.toLocaleString('nl-NL', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  // hoeveelheid met eenheid voor een gewas (t) of product
  AT.fmtAmount = (n, key) => {
    if (D.crops[key]) return AT.fmtTons(n);
    const p = D.products[key];
    return AT.fmtNum(n, p.decimals) + ' ' + p.unit;
  };
  AT.fmtPrice = key => {
    const v = price(key);
    return '€' + v.toLocaleString('nl-NL', { minimumFractionDigits: v < 10 ? 2 : 0, maximumFractionDigits: v < 10 ? 2 : 0 });
  };

  AT.game = {
    ST, CROP_KEYS, FERT, MANURE, isImplement, IMPL_NAMES,
    price, stock, take, addGood, sellGood, yieldFactor, canSowNow, spend, earn,
    tick, startJob, sell, buyField, buyMachine, sellMachine, upgradeSilo, enterVehicle, exitVehicle,
    toggleHitch, nearestImplement, nearestVehicle, hitchPoint, machine, HITCH, getLoad, loadCap, trailerPose,
    save, load, reset, bestRig, missingFor, canPull, workCell, cellAt, summary, mainCrop,
    isReady, cellGrowth, overripe, isWithering, jobPosition, jobPose, log, readyCropOf, HARVESTER_NAMES,
    day, hour, siloCapacity, siloUsed, siloRoom, cropPrice, fieldPrice, fieldDef, field,
  };
})();
