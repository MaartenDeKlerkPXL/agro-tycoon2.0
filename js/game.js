// Agro Tycoon 2.0 — spellogica (geen tekenwerk, geen DOM)
// Velden bestaan uit cellen; zowel jij (zelf rijden) als loonwerkers bewerken die cellen.
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const SAVE_KEY = 'agro-tycoon-2-save';
  const CROP_KEYS = Object.keys(D.crops);           // index+1 = gewas-id in cellen (0 = geen)
  const ST = { STUBBLE: 0, PLOWED: 1, SOWN: 2, MOWN: 3 };  // celtoestanden (MOWN = gemaaid gras dat droogt)
  // bits in cells.fert: TEDDED = gras is geschud, LIME = gekalkt, SPRAYED = gespoten, COMPACT = verdicht (nat bereden)
  // STONE = stenen boven gekomen bij het ploegen, ROLLED = na het zaaien gerold
  const FERT = 1, MANURE = 2, TEDDED = 4, LIME = 8, SPRAYED = 16, COMPACT = 32, STONE = 64, ROLLED = 128;
  const IMPLEMENT_KINDS = ['plow', 'seeder', 'spreader', 'manure', 'trailer', 'mower', 'tedder', 'baler', 'lime', 'sprayer', 'cultivator', 'roller', 'stonepicker', 'mixer'];
  const DRIVABLE = ['tractor', 'harvester', 'truck', 'fruitharvester'];
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

  function newField(def) {
    return { id: def.id, owned: !!def.owned, cells: newCells(def), job: null, readyNotified: false, soil: (def.region && D.regionSoil[def.region]) || D.startSoil, damage: 0,
      ph: D.soilPh.start, weeds: 0, disease: 0, pests: 0, pestLoss: 0, irrigated: false, stoniness: stoninessOf(def.id) };
  }
  // hoe steenachtig een veld is (vast per veld)
  function stoninessOf(id) { return 0.04 + ((id * 2654435761) >>> 0) % 22 / 100; }
  // oudere saves: ontbrekende veldgegevens aanvullen
  function fieldDefaults(f) {
    if (f.stoniness == null) f.stoniness = stoninessOf(f.id);
    if (f.ph == null) f.ph = D.soilPh.start;
    for (const k of ['weeds', 'disease', 'pests', 'pestLoss']) if (f[k] == null) f[k] = 0;
    if (f.irrigated == null) f.irrigated = false;
    return f;
  }

  // instellingen voor een nieuw spel (gezet vlak voor het herladen)
  const NEWGAME_KEY = SAVE_KEY + '-newgame', MAP_KEY = 'agro-tycoon-2-map';
  function pendingNewGame() { try { return JSON.parse(localStorage.getItem(NEWGAME_KEY)) || null; } catch (e) { return null; } }
  const diff = () => D.difficulties[(S() && S().difficulty) || 'normal'] || D.difficulties.normal;
  const RUNNING = ['brandstof', 'zaaigoed', 'kunstmest', 'lonen', 'loonwerk', 'energie', 'onderhoud', 'voer', 'kalk', 'gewasbescherming', 'water', 'huur', 'pacht', 'dierenarts', 'verzekering'];

  function createState() {
    const market = {}, silo = {}, goods = {}, growClock = {};
    for (const key of CROP_KEYS) { market[key] = { factor: 1, history: [1] }; silo[key] = 0; growClock[key] = 0; }
    for (const key of Object.keys(D.products)) { market[key] = { factor: 1, history: [1] }; goods[key] = 0; }
    for (const key of Object.keys(market)) market[key].sat = 0;
    const animals = {}, factories = {};
    for (const key of Object.keys(D.animals)) animals[key] = { owned: false, count: 0, fed: 1, produced: {} };
    for (const key of Object.keys(D.factories)) factories[key] = { owned: false, on: true, progress: 0, status: '', made: 0 };

    const ng = pendingNewGame() || {};
    const dkey = D.difficulties[ng.difficulty] ? ng.difficulty : 'normal', dd = D.difficulties[dkey];
    return {
      version: D.version,
      difficulty: dkey,
      map: D.mapId,
      money: dd.money,
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
      fields: D.fields.map(f => Object.assign(newField(f), dd.allFields ? { owned: true } : {})),
      machines: startMachines(),
      // speler: te voet (mode 'foot') of in een machine (mode 'drive', vehicle = uid)
      player: { mode: 'foot', x: D.start.farmer.x, y: D.start.farmer.y, angle: Math.PI, speed: 0, vehicle: null, lowered: false, crop: CROP_KEYS[0] },
      stats: { drove: false, plowedHa: 0, sownHa: 0, harvestedHa: 0, tonsHarvested: 0, earned: 0, spent: 0, workerJobs: 0, fertHa: 0, rotationHa: 0, greenManureHa: 0, cropsHarvested: {}, deliveredTons: 0, hayTons: 0, contractsDone: 0, truckDeliveries: 0 },
      warehouseLevel: 0,
      dryClock: D.start.hour,   // droogklok voor hooi: loopt langzamer als het regent
      bales: [],                // hooibalen op het veld { id, x, y, t, a, field }
      buildings: [],            // zelf geplaatste gebouwen { id, type, x, y }
      loan: 0,
      ledger: [],          // per dag: inkomsten en uitgaven per categorie
      contracts: { offers: [], active: [], refreshed: -99 },
      insurance: { crops: false, paidOut: 0 },
      deliveries: [],     // vrachtwagenritten van werknemers
      settings: { timeScale: 1 },   // daglengte: 1 = een speldag duurt 24 minuten bij 1×
      tutorial: { step: 0, done: false },
      autoDeliver: false, // werknemers leveren automatisch als de loods voller raakt
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

  function ledgerToday() {
    const s = S(), d = day();
    if (!s.ledger) s.ledger = [];
    let e = s.ledger[s.ledger.length - 1];
    if (!e || e.day !== d) { e = { day: d, income: {}, expense: {} }; s.ledger.push(e); if (s.ledger.length > 40) s.ledger.shift(); }
    return e;
  }
  function spend(amount, cat = 'overig') {
    if (RUNNING.includes(cat)) amount *= diff().cost;   // moeilijkheid: lopende kosten
    S().money -= amount; S().stats.spent += amount;
    if (amount >= 1000 && ['machines', 'land', 'gebouwen', 'dieren'].includes(cat)) AT.emit('sfx', 'spend');
    const e = ledgerToday(); e.expense[cat] = (e.expense[cat] || 0) + amount;
  }
  function earn(amount, countAsEarned = true, cat = 'overig') {
    const e = ledgerToday(); e.income[cat] = (e.income[cat] || 0) + amount;
    S().money += amount;
    if (countAsEarned) S().stats.earned += amount;
    if (amount >= 50 && cat !== 'doelen') AT.emit('sfx', 'cash');
  }

  const builtOf = type => (S().buildings || []).filter(b => b.type === type);
  function siloCapacity() { return D.silo[S().siloLevel].capacity + builtOf('silo').length * D.buildables.silo.capacity; }
  function siloUsed() { return Object.values(S().silo).reduce((a, b) => a + b, 0); }
  function siloRoom() { return siloCapacity() - siloUsed(); }
  // prijs per eenheid: basisprijs × dagkoers × maand × (1 − verzadiging) × verkooppunt
  function rawPrice(key, point) {
    const base = (D.crops[key] || D.products[key]).basePrice;
    const m = S().market[key];
    const season = AT.weather ? AT.weather.priceFactor(key) : 1;
    const mult = point && D.sellPoints[point] ? (D.sellPoints[point].mult[key] || 1) : 1;
    return base * m.factor * season * (1 - (m.sat || 0)) * mult * diff().sell;
  }
  function cropPrice(crop, point) { return Math.round(rawPrice(crop, point)); }
  function price(key, point) { return D.crops[key] ? cropPrice(key, point) : rawPrice(key, point); }
  // verkopen drukt de prijs tijdelijk (marktverzadiging)
  function saturate(key, value) {
    const m = S().market[key], sat = D.saturation;
    m.sat = Math.min(sat.max, (m.sat || 0) + value * sat.perEuro);
  }
  // koopt dit verkooppunt dit product?
  function accepts(point, key) {
    const sp = D.sellPoints[point];
    if (!sp) return false;
    if (sp.only) return sp.only.includes(key);
    if (sp.kind === 'crops') return !!D.crops[key];
    if (sp.kind === 'products') return !!D.products[key] && key !== 'manure' && key !== 'wood';
    return true;
  }
  // verkopen bij een verkooppunt (zelf brengen: geen ophaalkosten); eerst lopende contracten
  function sellAt(point, key, amount) {
    let money = 0;
    const left = fillContracts(key, amount);
    const sold = amount - left.amount;
    money += left.money;
    if (left.amount > 0) {
      const v = left.amount * price(key, point);
      money += v;
      earn(v, true, D.crops[key] ? 'gewassen' : 'producten');
      saturate(key, v);
    }
    return { money, toContracts: sold };
  }

  // ---------- opslagloods (pallets) ----------
  function warehouseCapacity() { return D.warehouse[S().warehouseLevel || 0].pallets + builtOf('warehouse').length * D.buildables.warehouse.pallets; }
  function palletsUsed() {
    let p = 0;
    for (const [k, d] of Object.entries(D.products)) if (d.perPallet) p += S().goods[k] / d.perPallet;
    return p;
  }
  function warehouseRoom(key) {
    const d = D.products[key];
    if (!d || !d.perPallet) return Infinity;
    return Math.max(0, (warehouseCapacity() - palletsUsed()) * d.perPallet);
  }
  function upgradeWarehouse() {
    const s = S(), next = D.warehouse[(s.warehouseLevel || 0) + 1];
    if (!next) return;
    if (s.money < next.price) { log('Niet genoeg geld voor een grotere opslagloods.', 'warn'); return; }
    spend(next.price, 'gebouwen');
    s.warehouseLevel = (s.warehouseLevel || 0) + 1;
    log(`Opslagloods uitgebreid naar ${next.pallets} pallets.`, 'money');
    AT.emit('change');
  }
  // voorraad: gewassen zitten in de silo, producten in de opslag
  function stock(key) { return D.crops[key] ? S().silo[key] : S().goods[key]; }
  function take(key, amount) { if (D.crops[key]) S().silo[key] = Math.max(0, S().silo[key] - amount); else S().goods[key] = Math.max(0, S().goods[key] - amount); }
  // voegt toe zoveel als er in de opslagloods past; geeft terug hoeveel er echt bij kwam
  function addGood(key, amount) {
    const add = Math.min(amount, warehouseRoom(key));
    S().goods[key] += add;
    return add;
  }
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
    if (AT.weather && AT.weather.drought() && !cropDef.droughtProof && !f.irrigated) k *= 0.85;
    const over = overripe(f, i);
    if (over > D.witherAfter) k *= Math.max(0.4, 1 - (over - D.witherAfter) * 0.6); // verwelkt
    if (c.fert[i] & COMPACT) k *= D.compaction;
    if (c.fert[i] & STONE) k *= D.stoneYield;
    if (c.fert[i] & ROLLED) k *= D.rollBonus;
    k *= phFactor(f);
    return k * (1 - f.damage) * (1 - (f.pestLoss || 0));
  }
  // te zure bodem (lage pH) geeft minder opbrengst; boven 6,3 is het goed
  function phFactor(f) {
    const ph = f.ph ?? D.soilPh.start, P = D.soilPh;
    if (ph >= P.good) return ph > 7.3 ? 0.97 : 1;
    return Math.max(0.6, 1 - (P.good - ph) * 0.25);
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
      fert: 0, manure: 0, needFert: 0, needManure: 0, prev: {}, factorSum: 0, factorN: 0, readyCrops: {}, clover: 0, withering: 0,
      grass: 0, mown: 0, needTed: 0, dryHay: 0, hayTons: 0, needLime: 0, needSpray: 0, compact: 0, sprayed: 0, stones: 0, needRoll: 0 };
    for (let i = 0; i < n; i++) {
      const s = c.state[i];
      const fe = c.fert[i];
      if (fe & FERT) out.fert++;
      if (fe & MANURE) out.manure++;
      if (c.prev[i]) { const pk = CROP_KEYS[c.prev[i] - 1]; out.prev[pk] = (out.prev[pk] || 0) + 1; }
      if (s === ST.STUBBLE) out.stubble++;
      else if (s === ST.PLOWED) out.plowed++;
      else if (s === ST.MOWN) {
        out.mown++;
        if (hayDryness(f, i) >= 1) { out.dryHay++; out.hayTons += cellYield(f, i); }
        else if (!(fe & TEDDED)) out.needTed++;
      } else {
        const key = CROP_KEYS[c.crop[i] - 1];
        out.crops[key] = (out.crops[key] || 0) + 1;
        const fac = yieldFactor(f, i);
        out.factorSum += fac; out.factorN++;
        if (D.crops[key].greenManure) out.clover++;
        if (D.crops[key].perennial) out.grass++;
        if (isReady(f, i)) {
          out.ready++; out.readyTons += cellYield(f, i);
          out.readyCrops[key] = (out.readyCrops[key] || 0) + 1;
          if (isWithering(f, i)) out.withering++;
        }
        else { out.growing++; out.minGrowth = Math.min(out.minGrowth, cellGrowth(f, i)); }
      }
      const ready = s === ST.SOWN && isReady(f, i);
      if (!ready && (s === ST.PLOWED || s === ST.SOWN) && !(fe & FERT)) out.needFert++;
      if (!ready && s !== ST.MOWN && !(fe & MANURE)) out.needManure++;
      if (!ready && s !== ST.MOWN && !(fe & LIME)) out.needLime++;
      if (s === ST.SOWN && !ready && !(fe & SPRAYED)) out.needSpray++;
      if (fe & SPRAYED) out.sprayed++;
      if (fe & COMPACT) out.compact++;
      if (fe & STONE) out.stones++;
      if (s === ST.SOWN && !(fe & ROLLED) && !ready && !D.crops[CROP_KEYS[c.crop[i] - 1]].perennial && cellGrowth(f, i) < 0.5) out.needRoll++;
    }
    out.avgFactor = out.factorN ? out.factorSum / out.factorN : null;
    return out;
  }

  function mainCrop(sum) {
    let best = null;
    for (const k in sum.crops) if (!best || sum.crops[k] > sum.crops[best]) best = k;
    return best;
  }

  // 0..1+: hoe droog gemaaid gras is (≥1 = klaar om te persen)
  function hayDryness(f, i) {
    if (f.cells.state[i] !== ST.MOWN) return 0;
    const hours = (f.cells.fert[i] & TEDDED) ? D.hayDryHours * 0.375 : D.hayDryHours;
    return (S().dryClock - f.cells.planted[i]) / hours;
  }

  function canSowNow(cropKey) { return !AT.weather || D.crops[cropKey].sow.includes(AT.weather.month()); }
  function tooWet() { return AT.weather && AT.weather.isWet(); }
  // natte grond: het regent of de bodem is drijfnat
  function wetGround() { const w = S().weather; return !!AT.weather && (AT.weather.isWet() || (!!w && w.moisture > 0.85)); }
  // zelf rijden over een akker als het nat is: de cel onder de wielen raakt verdicht
  let compactWarned = 0;
  function compactAt(x, y) {
    if (!wetGround()) return;
    const hit = cellAt(x, y);
    if (!hit || !hit.f.owned || (hit.f.cells.fert[hit.i] & COMPACT)) return;
    hit.f.cells.fert[hit.i] |= COMPACT;
    if (AT.cellChanged) AT.cellChanged(hit.f.id, hit.i);
    if (compactWarned !== day()) {
      compactWarned = day();
      log('Natte grond! Rijden over je akkers verdicht de bodem (−15% opbrengst op die plekken tot je ploegt). Blijf zoveel mogelijk op de weg.', 'warn');
    }
  }

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
      const cult = tool && tool.kind === 'cultivator';   // cultivator: sneller, maar ploegt geen gras om en werkt minder diep
      if (c.state[i] === ST.MOWN) return 'skip';
      if (c.state[i] !== ST.STUBBLE && !(cropDef && (cropDef.greenManure || cropDef.perennial))) return 'skip';
      if (cult && cropDef && cropDef.perennial) return 'grass';
      if (cropDef) {
        // groenbemester onderploegen: hoe verder gegroeid, hoe beter voor de bodem
        f.soil = Math.min(1, f.soil + (cropDef.greenManure || 0.05) * cellGrowth(f, i) / (def.cols * def.rows));
        if (isReady(f, i)) s.stats.greenManureHa += ha;
        c.prev[i] = c.crop[i];
        c.crop[i] = 0;
      }
      c.state[i] = ST.PLOWED;
      c.dir[i] = dir;
      c.fert[i] &= ~(SPRAYED | LIME | ROLLED);
      if (!tooWet() && !cult) c.fert[i] &= ~COMPACT;     // ploegen maakt verdichte grond weer los (niet als het nat is; een cultivator gaat niet diep genoeg)
      f.weeds = Math.max(0, (f.weeds || 0) - (cult ? 0.5 : 1) / (def.cols * def.rows));   // onkruid wordt ondergewerkt
      // ploegen haalt stenen naar boven (cultivator minder)
      if (Math.random() < (f.stoniness || 0) * (cult ? 0.4 : 1)) c.fert[i] |= STONE;
      s.stats.plowedHa += ha;
    } else if (op === 'sow') {
      if (c.state[i] !== ST.PLOWED) return 'skip';
      if (tool && tool.sows !== (D.crops[cropKey].planter || 'seeder')) return 'wrongtool';
      if (!canSowNow(cropKey)) return 'season';
      if (mode === 'player') {
        const cost = D.crops[cropKey].seedCostPerHa * ha;
        if (s.money < cost) return 'nomoney';
        spend(cost, 'zaaigoed');
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
        spend(cost, 'kunstmest');
      }
      c.fert[i] |= FERT;
      f.soil = Math.min(1, f.soil + 0.05 / (def.cols * def.rows));
      f.ph = Math.max(D.soilPh.min, (f.ph ?? D.soilPh.start) - D.soilPh.perFert / (def.cols * def.rows));
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
    } else if (op === 'roll') {
      // rollen na het zaaien: betere kieming (+6%)
      if (c.state[i] !== ST.SOWN || (c.fert[i] & ROLLED) || isReady(f, i) || cellGrowth(f, i) >= 0.5) return 'skip';
      if (D.crops[CROP_KEYS[c.crop[i] - 1]].perennial) return 'skip';
      c.fert[i] |= ROLLED;
    } else if (op === 'stones') {
      if (!(c.fert[i] & STONE)) return 'skip';
      c.fert[i] &= ~STONE;
      s.stats.stonesHa = (s.stats.stonesHa || 0) + ha;
    } else if (op === 'lime') {
      const ready = c.state[i] === ST.SOWN && isReady(f, i);
      if (ready || c.state[i] === ST.MOWN || (c.fert[i] & LIME)) return 'skip';
      if (mode === 'player') {
        const cost = D.limeCostPerHa * ha;
        if (s.money < cost) return 'nomoney';
        spend(cost, 'kalk');
      }
      c.fert[i] |= LIME;
      f.ph = Math.min(D.soilPh.max, (f.ph ?? D.soilPh.start) + D.soilPh.perLime / (def.cols * def.rows));
      s.stats.limeHa = (s.stats.limeHa || 0) + ha;
    } else if (op === 'spray') {
      if (c.state[i] !== ST.SOWN || isReady(f, i) || (c.fert[i] & SPRAYED)) return 'skip';
      if (mode === 'player') {
        const cost = D.sprayCostPerHa * ha;
        if (s.money < cost) return 'nomoney';
        spend(cost, 'gewasbescherming');
      }
      c.fert[i] |= SPRAYED;
      const n = def.cols * def.rows;
      f.weeds = Math.max(0, (f.weeds || 0) - 1.2 / n);
      f.disease = Math.max(0, (f.disease || 0) - 1.2 / n);
      f.pests = Math.max(0, (f.pests || 0) - 1.2 / n);
      s.stats.sprayHa = (s.stats.sprayHa || 0) + ha;
    } else if (op === 'mow') {
      const key = c.state[i] === ST.SOWN ? CROP_KEYS[c.crop[i] - 1] : null;
      if (!key || !D.crops[key].perennial || !isReady(f, i)) return 'skip';
      c.state[i] = ST.MOWN;
      c.planted[i] = s.dryClock;      // maaimoment op de droogklok
      c.fert[i] &= ~TEDDED;
      c.dir[i] = dir;
    } else if (op === 'ted') {
      if (c.state[i] !== ST.MOWN || (c.fert[i] & TEDDED) || hayDryness(f, i) >= 1) return 'skip';
      c.fert[i] |= TEDDED;
    } else if (op === 'bale') {
      if (c.state[i] !== ST.MOWN || hayDryness(f, i) < 1) return 'skip';
      const tons = cellYield(f, i) * (0.95 + Math.random() * 0.1);
      if (bunker && bunker.baler) {
        // zelf persen: de pers vult een baal en laat hem achter op het veld
        bunker.m.baleAcc = (bunker.m.baleAcc || 0) + tons;
        s.stats.hayTons += tons;
      } else if (warehouseRoom('hay') < tons) { if (mode === 'player') return 'storefull'; if (f.job) f.job.lost += tons; }
      else { s.goods.hay += tons; s.stats.hayTons += tons; }
      f.soil = Math.max(0.05, f.soil - D.crops.grass.soilDemand / (def.cols * def.rows));
      // gras groeit vanzelf weer aan
      c.state[i] = ST.SOWN;
      c.planted[i] = s.growClock.grass;
      c.fert[i] &= ~(TEDDED | FERT);
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
      f.ph = Math.max(D.soilPh.min, (f.ph ?? D.soilPh.start) - D.soilPh.perHarvest / (def.cols * def.rows));
      f.disease = Math.max(0, (f.disease || 0) - 1 / (def.cols * def.rows));
      f.pests = Math.max(0, (f.pests || 0) - 1 / (def.cols * def.rows));
      c.prev[i] = c.crop[i];
      c.state[i] = ST.STUBBLE;
      c.crop[i] = 0;
      c.fert[i] &= COMPACT | STONE;   // verdichting en stenen blijven tot je ploegt/raapt
      if (tool && bunker && (c.fert[i] & STONE) && bunker.m) bunker.m.wear = Math.min(1, (bunker.m.wear || 0) + 0.0015);   // stenen beschadigen het maaibord
      c.dir[i] = dir;
      s.stats.harvestedHa += ha;
    }
    // werknemers die in de regen werken laten diepe sporen achter (de rest van de cellen rijden ze niet)
    if (mode === 'worker' && op !== 'plow' && tooWet() && ((i * 2654435761) >>> 0) % 10 < 3) c.fert[i] |= COMPACT;
    if (AT.cellChanged) AT.cellChanged(f.id, i);
    return 'ok';
  }

  // ---------- loonwerkers (automatische taken) ----------
  const TASK_IMPLEMENT = { plow: 'plow', sow: 'seeder', fertilize: 'spreader', manure: 'manure', mow: 'mower', ted: 'tedder', bale: 'baler', lime: 'lime', spray: 'sprayer', roll: 'roller', stones: 'stonepicker' };
  const TASK_OP = { plow: 'plow', sow: 'sow', harvest: 'harvest', fertilize: 'fertilize', manure: 'manure', mow: 'mow', ted: 'ted', bale: 'bale', lime: 'lime', spray: 'spray', roll: 'roll', stones: 'stones' };
  const IMPL_NAMES = { plow: 'ploeg', seeder: 'zaaimachine', spreader: 'kunstmeststrooier', manure: 'mestverspreider', trailer: 'aanhanger', mower: 'maaier', tedder: 'schudder', baler: 'balenpers', lime: 'kalkstrooier', sprayer: 'spuitmachine', cultivator: 'cultivator', roller: 'rol', stonepicker: 'stenenraper' };
  // welke werktuigen kunnen een taak doen (ploegen kan ook met een cultivator, behalve gras omploegen)
  const taskKinds = (task, grass) => task === 'plow' && !grass ? ['plow', 'cultivator'] : [TASK_IMPLEMENT[task]];
  const PLANTER_NAMES = { seeder: 'zaaimachine', potato: 'aardappelpootmachine', beet: 'bietenzaaier' };

  // snelheidsbonus als de tractor sterker is dan het werktuig nodig heeft
  function speedFactor(tractorDef, implDef) {
    const base = Math.max(implDef.minPower, 1);    // een oldtimer werkt trager dan een gewone tractor
    const extra = (tractorDef.power - base) / base;
    return Math.min(1 + extra * 0.5, 1.75);
  }

  // Snelste vrije combinatie voor een taak: { machines, hours, cost, width } of null
  // welk gewas er op een veld het meest rijp staat (bepaalt welke oogstmachine nodig is)
  function readyCropOf(fieldId) {
    const sum = summary(field(fieldId));
    return mainCrop({ crops: sum.readyCrops });
  }
  const HARVESTER_NAMES = { combine: 'maaidorser', potato: 'aardappelrooier', beet: 'bietenrooier', grass: 'maaier' };

  function bestRig(task, fieldId, crop, grass = false) {
    const ha = fieldDef(fieldId).ha;
    const free = S().machines.filter(m => !m.busy && !m.broken);
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

    const kinds = taskKinds(task, grass);
    for (const t of free) {
      const td = machineDef(t);
      if (td.kind !== 'tractor') continue;
      for (const i of free) {
        const id = machineDef(i);
        if (!kinds.includes(id.kind) || td.power < id.minPower) continue;
        if (task === 'sow' && crop && id.sows !== (D.crops[crop].planter || 'seeder')) continue;
        if (t.impl && t.impl !== i.uid && machine(t.impl).busy) continue; // ander werktuig in gebruik
        if (i.attached && i.attached !== t.uid) continue;  // werktuig hangt aan een andere tractor
        const hours = ha / (id.rate * speedFactor(td, id));
        if (!best || hours < best.hours) best = { machines: [t, i], hours, width: id.width, fuelPerHour: td.fuelPerHour, cost: hours * (td.fuelPerHour * D.fuelPrice + wage) };
      }
    }
    return best;
  }

  function missingFor(task, fieldId, crop) {
    const all = S().machines;
    if (task === 'harvest' && fieldId) {
      const crop = readyCropOf(fieldId), need = crop && D.crops[crop].harvester;
      if (crop && !need) return `${D.crops[crop].name} oogst je niet: ploeg het onder voor een betere bodem.`;
      if (need && !all.some(m => machineDef(m).harvests === need)) return `Voor ${D.crops[crop].name.toLowerCase()} heb je een ${HARVESTER_NAMES[need]} nodig (Winkel).`;
    }
    const needKinds = task === 'harvest' ? ['harvester'] : ['tractor', ...taskKinds(task)];
    if (all.some(m => m.busy === 'player' && needKinds.includes(machineDef(m).kind)))
      return 'Je rijdt zelf met de machine die hiervoor nodig is. Stap eerst uit (E).';
    const has = kind => all.some(m => machineDef(m).kind === kind);
    if (task === 'harvest') return has('harvester') ? 'Alle maaidorsers zijn bezig.' : 'Je hebt geen maaidorser.';
    const implKind = TASK_IMPLEMENT[task];
    const implName = IMPL_NAMES[implKind];
    if (task === 'sow' && crop) {
      const pl = D.crops[crop].planter || 'seeder';
      if (!all.some(m => machineDef(m).sows === pl)) return `Voor ${D.crops[crop].name.toLowerCase()} heb je een ${PLANTER_NAMES[pl]} nodig (Winkel).`;
    }
    if (!has('tractor')) return 'Je hebt geen tractor.';
    if (!taskKinds(task).some(has)) return `Je hebt geen ${implName}.`;
    if (all.some(m => m.broken)) return `Geen werkende tractor + ${implName}: er is een machine kapot (repareer in de Garage).`;
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
    const eligible = { plow: sum.stubble + sum.clover + (task === 'plow' && opts.plowGrass ? sum.grass : 0), sow: sum.plowed, harvest: sum.ready - (sum.readyCrops.grass || 0), fertilize: sum.needFert, manure: sum.needManure,
      mow: sum.readyCrops.grass || 0, ted: sum.needTed, bale: sum.dryHay, lime: sum.needLime, spray: sum.needSpray, roll: sum.needRoll, stones: sum.stones }[task];
    if (!eligible) return 'niets te doen';
    if (task === 'sow' && !canSowNow(crop)) return fail(`${D.crops[crop].name} kun je nu niet zaaien.`);

    const rig = bestRig(task, fieldId, crop, !!opts.plowGrass);
    if (!rig) return fail(missingFor(task, fieldId, crop));
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
    if (task === 'lime') cost += D.limeCostPerHa * cellHa(def) * eligible;
    if (task === 'spray') cost += D.sprayCostPerHa * cellHa(def) * eligible;
    const manureNeed = task === 'manure' ? D.manurePerHa * cellHa(def) * eligible : 0;
    if (manureNeed && S().goods.manure < manureNeed) return fail(`Niet genoeg mest (nodig: ${AT.fmtTons(manureNeed)}). Koeien en schapen maken mest.`);
    if (task === 'harvest' && siloRoom() < sum.readyTons - sum.hayTons) return fail(`Silo te vol om Veld ${fieldId} te oogsten. Verkoop graan of vergroot de silo.`);
    if (task === 'bale' && warehouseRoom('hay') < sum.hayTons) return fail('De opslagloods is te vol voor het hooi.');
    if (S().money < cost) return fail(`Niet genoeg geld (nodig: ${AT.fmtMoney(cost)}).`);

    spend(cost, worker.external ? 'loonwerk' : 'brandstof');
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
      tool: task === 'harvest' ? rig.machines[0].type : task === 'plow' && rig.machines[1] ? rig.machines[1].type : null,
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
    // bij het oogsten rijdt (als dat kan) een chauffeur met kipper mee
    if (task === 'harvest' && AT.staff) AT.staff.jobChaser(fieldId, rig.machines[0].uid);
    const names = rig.machines.map(m => machineDef(m).name).join(' + ');
    const verb = { plow: 'ploegt', sow: 'zaait', harvest: 'oogst', fertilize: 'strooit kunstmest op', manure: 'rijdt mest uit op', mow: 'maait', ted: 'schudt het gras op', bale: 'perst hooi op', lime: 'strooit kalk op', spray: 'spuit', roll: 'rolt', stones: 'raapt stenen op' }[task];
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
    // maaidorser rijdt zelf naar de silo om de bunker te legen, en weer terug
    if (job.phase === 'unload' || job.phase === 'back') {
      if (AT.staff.moveAlong(job, travelSpeed(job.machines[0]) * dtSec)) {
        if (job.phase === 'unload') {
          AT.staff.depositGrain(getLoad(machine(job.machines[0])), job.workerName || 'Loonwerker');
          job.path = AT.staff.route(job.pos, job.returnTo); job.seg = 0; job.phase = 'back';
        } else job.phase = 'work';
      }
      return;
    }
    // pech: de monteur is bezig
    if (job.breakdown) {
      job.breakdown.left -= dtHours;
      job.waiting = 'heeft pech, de monteur is bezig';
      if (job.breakdown.left <= 0) {
        const m = machine(job.breakdown.uid);
        if (m) { m.wear = Math.max(0, (m.wear || 0) - 0.4); m.broken = false; }
        log(`${job.workerName || 'Loonwerker'} kan weer verder op Veld ${f.id}: de ${m ? machineDef(m).name : 'machine'} is gemaakt.`, 'good');
        job.breakdown = null;
      }
      return;
    }
    if (job.type === 'harvest' && tooWet()) { job.waiting = true; return; } // wacht tot het droog is
    // diesel en slijtage van de machines van de werknemer
    for (const uid of job.machines) {
      const m = machine(uid);
      if (!m) continue;
      addWear(m, dtHours);
      const d = machineDef(m);
      if (d.fuelPerHour && fuelCap(m)) {
        m.fuel = Math.max(0, fuelOf(m) - d.fuelPerHour * dtHours * wearFuel(m));
        if (m.fuel <= 0) {   // tank leeg: tankservice komt (brandstof zat al in de prijs, alleen de service betaal je)
          spend(D.fuelService, 'brandstof');
          m.fuel = fuelCap(m);
          log(`${job.workerName || 'Loonwerker'} stond droog op Veld ${f.id}: tankservice kwam diesel brengen (${AT.fmtMoney(D.fuelService)}).`, 'warn');
        }
      }
      if ((m.wear || 0) > 0.85 && Math.random() < 0.15 * dtHours) {
        const cost = Math.round(D.repairCallOut + d.price * 0.04);
        spend(cost, 'onderhoud');
        job.breakdown = { uid, left: 2 };
        log(`Pech op Veld ${f.id}: de ${d.name} van ${job.workerName || 'de loonwerker'} is kapot. Een monteur komt (${AT.fmtMoney(cost)}, ±2 uur). Laat versleten machines op tijd repareren!`, 'warn');
        return;
      }
    }
    job.waiting = false;
    const harvester = job.type === 'harvest' ? machine(job.machines[0]) : null;
    const bunker = harvester ? { load: getLoad(harvester), cap: loadCap(harvester), m: harvester } : null;
    job.progress = Math.min(1, job.progress + dtHours / job.hours);
    const N = jobLength(def, job.laneCols);
    const target = job.progress >= 1 ? N : Math.floor(job.progress * N);
    for (; job.idx < target; job.idx++) {
      const i = jobCell(def, job.laneCols, job.idx);
      if (i < 0) continue;
      const res = workCell(f, i, TASK_OP[job.type], job.crop, 'worker', 0, job.tool ? D.machines[job.tool] : null, bunker);
      if (res === 'tankfull' || res === 'mixed') {
        job.progress = job.idx / N;   // hier blijft hij staan tot de bunker leeg is
        if (AT.staff.chaserFor(harvester.uid)) { job.waiting = 'wacht op de kipper'; return; }
        const here = jobPosition(def, job);
        job.returnTo = { x: here.x, y: here.y, angle: here.angle };
        job.pos = { x: here.x, y: here.y, angle: here.angle };
        job.path = AT.staff.route(here, { x: D.siloPit.x + D.siloPit.w / 2, y: D.siloPit.y + D.siloPit.h + 30 });
        job.seg = 0; job.phase = 'unload';
        return;
      }
    }
    if (job.progress >= 1) finishJob(f);
  }

  // positie van een machine die bezig is (onderweg of op het veld)
  function jobPose(def, job) {
    if ((job.phase === 'to' || job.phase === 'unload' || job.phase === 'back') && job.pos) return job.pos;
    return jobPosition(def, job);
  }

  function finishJob(f) {
    const job = f.job, s = S();
    const def = fieldDef(f.id);
    s.stats.workerJobs++;
    const done = { plow: 'geploegd', sow: 'ingezaaid', harvest: 'geoogst', fertilize: 'bemest met kunstmest', manure: 'bemest met mest', mow: 'gemaaid', ted: 'geschud', bale: 'tot hooi geperst', lime: 'gekalkt', spray: 'gespoten', roll: 'gerold', stones: 'steenvrij' }[job.type];
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
      if (trip.machines.includes(m.uid) && fuelCap(m)) m.fuel = fuelCap(m);   // werknemer tankt bij terugkomst op het erf (zat in de kosten)
      // wat er nog in de bunker zit gaat bij terugkomst de silo in
      if (trip.machines.includes(m.uid) && machineDef(m).kind === 'harvester' && m.load && m.load.tons > 0.01 && AT.staff) AT.staff.depositGrain(m.load, trip.workerName || 'Loonwerker');
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
    if (!DRIVABLE.includes(kind)) return false;
    m.busy = 'player';
    if (m.impl) machine(m.impl).busy = 'player';
    Object.assign(p, { mode: 'drive', vehicle: uid, x: m.x, y: m.y, angle: m.angle, speed: 0, lowered: false });
    s.stats.drove = true;
    AT.emit('sfx', 'door');
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
    AT.emit('sfx', 'door');
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
      AT.emit('sfx', 'hitch');
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
    AT.emit('sfx', 'hitch');
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
      if (m.busy || !DRIVABLE.includes(k)) continue;
      const d = Math.hypot(m.x - x, m.y - y);
      if (d < bd) { bd = d; best = m; }
    }
    return best;
  }

  // ---------- diesel, slijtage, reparatie, huur en GPS ----------
  const fuelCap = m => { const d = machineDef(m); return d.fuelPerHour ? (d.fuelTank || Math.round(d.fuelPerHour * D.tankHours)) : 0; };
  function fuelOf(m) { if (m.fuel == null) m.fuel = fuelCap(m); return m.fuel; }
  function addWear(m, hours) {
    if (!m) return;
    const d = machineDef(m);
    m.wear = Math.min(1, (m.wear || 0) + hours * D.wearPerHour * (d.wearRate || 1));
  }
  // versleten machines zijn trager en verbruiken meer
  const wearSpeed = m => 1 - 0.3 * Math.max(0, ((m && m.wear) || 0) - 0.5) / 0.5;
  const wearFuel = m => 1 + 0.5 * ((m && m.wear) || 0);
  function atYard(m) {
    const Y = D.yard;
    if (m.x >= Y.x && m.x <= Y.x + Y.w && m.y >= Y.y && m.y <= Y.y + Y.h) return true;
    // ook bij een eigen werkplaats
    return builtOf('shed').some(b => Math.hypot(m.x - (b.x + 40), m.y - (b.y + 25)) < 80);
  }
  // dieselpompen: op het erf en bij elke werkplaats
  function fuelPumps() { return [D.fuelPump, ...builtOf('shed').map(b => ({ x: b.x + D.buildables.shed.w + 8, y: b.y + D.buildables.shed.h / 2 }))]; }
  const nearPump = (x, y, r = 22) => fuelPumps().some(pp => Math.hypot(x - pp.x, y - pp.y) < r);
  // stortputten van zelf gebouwde silo's
  const siloPits = () => builtOf('silo').map(b => ({ x: b.x - 10, y: b.y + D.buildables.silo.h + 6, w: D.buildables.silo.w + 20, h: 14 }));

  // ---------- zelf bouwen ----------
  const rectHit = (a, b, m = 0) => a.x < b.x + b.w + m && a.x + a.w + m > b.x && a.y < b.y + b.h + m && a.y + a.h + m > b.y;
  function footprint(type, x, y) { const d = D.buildables[type]; return { x, y, w: d.w, h: d.h + (type === 'silo' ? 22 : 0) + (type === 'shed' ? 0 : 0), pw: type === 'shed' ? 16 : 0 }; }
  // mag het hier? geeft null (ja) of een reden
  function placeProblem(type, x, y) {
    const fp = footprint(type, x, y), r = { x: fp.x, y: fp.y, w: fp.w + fp.pw, h: fp.h };
    if (r.x < 4 || r.y < 4 || r.x + r.w > D.world.w - 4 || r.y + r.h > D.world.h - 4) return 'buiten de kaart';
    if (D.fields.some(f => rectHit(r, f, 4))) return 'niet op een akker';
    if (D.roads.some(q => rectHit(r, q, 3))) return 'niet op de weg';
    const lots = [D.yard, D.trader.lot, D.woodlot.area, ...D.greenhouse.lots, ...Object.values(D.animals).map(a => a.pen), ...Object.values(D.factories).map(f => f.lot),
      ...Object.values(D.sellPoints).filter(sp => sp.lot).map(sp => sp.lot), ...Object.values(D.plantations).map(p => p.area)];
    if (lots.some(l => rectHit(r, l, 4))) return 'daar staat al iets';
    const P = D.pond; if (rectHit(r, { x: P.x - P.rx, y: P.y - P.ry, w: P.rx * 2, h: P.ry * 2 }, 4)) return 'niet in de vijver';
    if ((S().buildings || []).some(b => { const o = footprint(b.type, b.x, b.y); return rectHit(r, { x: o.x, y: o.y, w: o.w + o.pw, h: o.h }, 6); })) return 'te dicht bij een ander gebouw';
    return null;
  }
  function placeBuilding(type, x, y) {
    const d = D.buildables[type], s = S();
    const why = placeProblem(type, x, y);
    if (why) { log(`Hier kun je niet bouwen: ${why}.`, 'warn'); return false; }
    if (s.money < d.price) { log(`Niet genoeg geld voor een ${d.name.toLowerCase()}.`, 'warn'); return false; }
    spend(d.price, 'gebouwen');
    s.buildings.push({ id: 'b' + Date.now().toString(36), type, x: Math.round(x), y: Math.round(y) });
    log(`${d.name} gebouwd!`, 'money');
    AT.emit('built');
    AT.emit('change');
    return true;
  }
  function demolish(id) {
    const s = S(), b = s.buildings.find(x => x.id === id);
    if (!b) return;
    const d = D.buildables[b.type];
    if (b.type === 'silo' && siloUsed() > siloCapacity() - d.capacity) { log('Haal eerst graan uit de silo: het past anders niet meer.', 'warn'); return; }
    if (b.type === 'warehouse' && palletsUsed() > warehouseCapacity() - d.pallets) { log('De opslagloods is te vol om een loods af te breken.', 'warn'); return; }
    s.buildings = s.buildings.filter(x => x !== b);
    earn(d.price * 0.5, false, 'gebouwen');
    log(`${d.name} afgebroken (${AT.fmtMoney(d.price * 0.5)} terug).`, 'money');
    AT.emit('built');
    AT.emit('change');
  }
  function repairCost(m) { return Math.round(machineDef(m).price * D.repairShare * (m.wear || 0) + (m.broken ? 300 : 0) + (atYard(m) ? 0 : D.repairCallOut)); }
  function repair(uid) {
    const m = machine(uid);
    if (!m || (m.busy && m.busy !== 'player')) return;
    const cost = repairCost(m);
    if (S().money < cost) { log('Niet genoeg geld voor de reparatie.', 'warn'); return; }
    spend(cost, 'onderhoud');
    m.wear = 0; m.broken = false;
    log(`${machineDef(m).name} is gerepareerd${atYard(m) ? ' in de werkplaats' : ' door de monteur ter plekke'} (${AT.fmtMoney(cost)}).`, 'money');
    AT.emit('change');
  }
  // tanken bij de dieselpomp (of de tankservice laten komen)
  function refuel(m, service = false) {
    const cap = fuelCap(m), need = cap - fuelOf(m);
    if (need < 0.5) return 0;
    const cost = need * D.fuelPrice + (service ? D.fuelService : 0);
    if (S().money < cost) { log('Niet genoeg geld om te tanken.', 'warn'); return 0; }
    spend(cost, 'brandstof');
    m.fuel = cap;
    S().stats.refuels = (S().stats.refuels || 0) + 1;
    log(`${machineDef(m).name} getankt: ${Math.round(need)} L diesel (${AT.fmtMoney(cost)}${service ? ', met tankservice' : ''}).`, 'money');
    AT.emit('change');
    return need;
  }
  const rentPrice = type => Math.max(40, Math.round(D.machines[type].price * D.rentPerDay));
  function rentMachine(type) {
    const d = D.machines[type], cost = rentPrice(type);
    if (S().money < cost) { log(`Niet genoeg geld om de ${d.name} te huren.`, 'warn'); return; }
    spend(cost, 'huur');
    const sl = freeSlot();
    S().machines.push({ uid: newUid(), type, busy: null, x: sl.x, y: sl.y, angle: 0, impl: null, attached: null, rented: true });
    log(`${d.name} gehuurd voor ${AT.fmtMoney(cost)} per dag. Breng hem terug in de Garage als je hem niet meer nodig hebt.`, 'money');
    AT.emit('change');
  }
  function returnMachine(uid) {
    const s = S(), m = machine(uid);
    if (!m || !m.rented || m.busy) return;
    if (m.impl) { const im = machine(m.impl); const h = hitchPoint(m); Object.assign(im, { x: h.x, y: h.y, angle: m.angle, attached: null }); }
    if (m.attached) machine(m.attached).impl = null;
    s.machines = s.machines.filter(x => x !== m);
    log(`${machineDef(m).name} teruggebracht naar de verhuur.`);
    AT.emit('change');
  }
  function buyGps(uid) {
    const m = machine(uid);
    if (!m || m.gps) return;
    if (S().money < D.gpsPrice) { log('Niet genoeg geld voor GPS.', 'warn'); return; }
    spend(D.gpsPrice, 'machines');
    m.gps = true;
    log(`GPS ingebouwd in de ${machineDef(m).name}. Druk G tijdens het rijden: hij houdt zelf een rechte lijn.`, 'money');
    AT.emit('change');
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
  // laten ophalen vanuit de silo of opslagloods: −10% ophaalkosten (eerst lopende contracten vullen)
  function sell(key, amount) {
    const s = S(), isCrop = !!D.crops[key];
    const have = isCrop ? s.silo[key] : s.goods[key];
    amount = Math.min(amount ?? have, have);
    if (amount <= 0.0001) return;
    if (isCrop) s.silo[key] -= amount; else s.goods[key] -= amount;
    const c = fillContracts(key, amount);
    let money = c.money;
    if (c.amount > 0) {
      const v = c.amount * price(key) * (1 - D.pickupFee);
      money += v;
      earn(v, true, isCrop ? 'gewassen' : 'producten');
      saturate(key, v);
    }
    const name = (D.crops[key] || D.products[key]).name.toLowerCase();
    log(`${AT.fmtAmount(amount, key)} ${name} laten ophalen voor ${AT.fmtMoney(money)}${c.amount > 0 ? ` (−${Math.round(D.pickupFee * 100)}% ophaalkosten)` : ''}.`, 'money');
    AT.emit('change');
  }
  const sellGood = (key, amount) => sell(key, amount);

  // ---------- contracten ----------
  function contractCandidates() {
    const s = S();
    const crops = Object.keys(D.crops).filter(k => D.crops[k].basePrice > 0);
    // producten alleen als je ze kunt maken
    const prods = new Set();
    if (s.machines.some(m => machineDef(m).kind === 'baler')) prods.add('hay');
    for (const [k, a] of Object.entries(D.animals)) if (s.animals[k].owned) [...Object.keys(a.produce), ...(a.fleece ? [a.fleece.good] : [])].forEach(p => p !== 'manure' && prods.add(p));
    for (const [k, f] of Object.entries(D.factories)) if (s.factories[k].owned) Object.keys(f.out).forEach(p => prods.add(p));
    if (AT.farm) AT.farm.allGreenhouses().forEach(({ g }) => g.owned && prods.add(g.crop));
    // ook wat je nog op voorraad hebt (bijv. na het omschakelen van een kas)
    for (const k of Object.keys(D.products)) if (k !== 'manure' && stock(k) > 0.5) prods.add(k);
    if (s.woodlot && s.woodlot.owned) prods.add('wood');
    for (const [k, pl] of Object.entries(D.plantations)) if (s.plantations && s.plantations[k] && s.plantations[k].owned) prods.add(pl.product);
    return { crops, prods: [...prods] };
  }

  function newOffer() {
    const { crops, prods } = contractCandidates();
    const useProd = prods.length && Math.random() < 0.35;
    const key = useProd ? prods[Math.floor(Math.random() * prods.length)] : crops[Math.floor(Math.random() * crops.length)];
    const unit = price(key);
    const value = 4000 + Math.random() * 16000;
    let amount = value / Math.max(unit, 0.01);
    const dec = D.crops[key] ? 0 : D.products[key].decimals;
    const round = dec ? 1 : D.crops[key] ? 1 : Math.pow(10, Math.max(0, Math.floor(Math.log10(amount)) - 1));
    amount = Math.max(round, Math.round(amount / round) * round);
    const C = D.contracts;
    const days = C.minDays + Math.floor(Math.random() * (C.maxDays - C.minDays + 1));
    return {
      id: 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4),
      key, amount, delivered: 0,
      pricePer: (D.crops[key] || D.products[key]).basePrice * (1.15 + Math.random() * 0.25),
      bonus: Math.round(value * (0.08 + Math.random() * 0.12) / 50) * 50,
      days, deadline: null,
    };
  }

  function refreshOffers() {
    const s = S(), C = s.contracts;
    C.offers = Array.from({ length: D.contracts.offers }, newOffer);
    C.refreshed = day();
  }

  function acceptContract(id) {
    const s = S(), C = s.contracts, o = C.offers.find(x => x.id === id);
    if (!o) return;
    if (C.active.length >= 5) { log('Je hebt al 5 lopende contracten.', 'warn'); return; }
    o.deadline = day() + o.days;
    C.active.push(o);
    C.offers = C.offers.filter(x => x !== o);
    log(`Contract aangenomen: ${AT.fmtAmount(o.amount, o.key)} ${(D.crops[o.key] || D.products[o.key]).name.toLowerCase()} vóór dag ${o.deadline}.`, 'good');
    AT.emit('change');
  }

  // vult lopende contracten met deze levering; geeft { amount (over), money } terug
  function fillContracts(key, amount) {
    const s = S();
    let money = 0;
    for (const c of (s.contracts ? s.contracts.active : [])) {
      if (c.key !== key || amount <= 0) continue;
      const take = Math.min(amount, c.amount - c.delivered);
      if (take <= 0) continue;
      c.delivered += take; amount -= take;
      const v = take * c.pricePer;
      money += v;
      earn(v, true, 'contracten');
      if (c.delivered >= c.amount - 1e-6) {
        earn(c.bonus, true, 'contracten');
        money += c.bonus;
        s.stats.contractsDone++;
        log(`Contract voltooid! Bonus ${AT.fmtMoney(c.bonus)}.`, 'goal');
      }
    }
    s.contracts.active = s.contracts.active.filter(c => c.delivered < c.amount - 1e-6);
    return { amount, money };
  }

  // leveren uit eigen voorraad (silo of opslagloods)
  function deliverContract(id) {
    const s = S(), c = s.contracts.active.find(x => x.id === id);
    if (!c) return;
    const isCrop = !!D.crops[c.key];
    const have = isCrop ? s.silo[c.key] : s.goods[c.key];
    const amt = Math.min(have, c.amount - c.delivered);
    if (amt <= 0.0001) { log('Je hebt hier niets van op voorraad.', 'warn'); return; }
    if (isCrop) s.silo[c.key] -= amt; else s.goods[c.key] -= amt;
    const r = fillContracts(c.key, amt);
    log(`${AT.fmtAmount(amt, c.key)} geleverd voor ${AT.fmtMoney(r.money)}.`, 'money');
    AT.emit('change');
  }

  function checkContracts() {
    const s = S(), C = s.contracts;
    for (const c of [...C.active]) {
      if (day() <= c.deadline) continue;
      const fine = (c.amount - c.delivered) * c.pricePer * D.contracts.fine;
      spend(fine, 'boetes');
      log(`Contract verlopen: ${AT.fmtAmount(c.amount - c.delivered, c.key)} niet geleverd. Boete ${AT.fmtMoney(fine)}.`, 'warn');
      C.active = C.active.filter(x => x !== c);
    }
    if (day() - C.refreshed >= D.contracts.refreshDays || !C.offers.length) refreshOffers();
  }

  // ---------- bank ----------
  function assetsValue() {
    const s = S();
    let v = 0;
    for (const f of s.fields) if (f.owned && !f.leased) v += fieldPrice(f.id);
    for (const m of s.machines) if (!m.rented) v += machineDef(m).price * 0.6;
    return v;
  }
  function maxLoan() { return Math.round((D.bank.base + assetsValue() * D.bank.maxShare) / 1000) * 1000; }
  function borrow(amount) {
    const s = S();
    amount = Math.min(amount, maxLoan() - s.loan);
    if (amount <= 0) { log('De bank leent je niet meer geld.', 'warn'); return; }
    s.loan += amount; s.money += amount;
    log(`Lening van ${AT.fmtMoney(amount)} afgesloten (rente ${(D.bank.ratePerDay * 100).toFixed(1).replace('.', ',')}% per dag).`, 'money');
    AT.emit('change');
  }
  function repay(amount) {
    const s = S();
    amount = Math.min(amount ?? s.loan, s.loan, Math.max(0, s.money));
    if (amount <= 0) return;
    s.loan -= amount; s.money -= amount;
    s.stats.loanRepaid = (s.stats.loanRepaid || 0) + amount;
    log(`${AT.fmtMoney(amount)} afgelost. Nog te betalen: ${AT.fmtMoney(s.loan)}.`, 'money');
    AT.emit('change');
  }

  function buyField(id) {
    const f = field(id);
    const price = fieldPrice(id);
    if (!f || (f.owned && !f.leased)) return;
    if (S().money < price) { log('Niet genoeg geld voor dit veld.', 'warn'); return; }
    spend(price, 'land');
    const wasLeased = f.leased;
    f.owned = true; f.leased = false;
    log(`Veld ${id} ${wasLeased ? 'gekocht (je pachtte het al)' : 'gekocht'} (${AT.fmtHa(fieldDef(id).ha)}) voor ${AT.fmtMoney(price)}.`, 'money');
    AT.emit('change');
  }

  // ---------- pacht ----------
  const leaseRent = id => Math.round(fieldPrice(id) * D.leaseRate);
  function leaseField(id) {
    const f = field(id);
    if (!f || f.owned) return;
    const rent = leaseRent(id);
    if (S().money < rent) { log('Niet genoeg geld voor de eerste pachtdag.', 'warn'); return; }
    spend(rent, 'pacht');
    f.owned = true; f.leased = true;
    log(`Veld ${id} gepacht voor ${AT.fmtMoney(rent)} per dag. Je kunt het later nog kopen.`, 'money');
    AT.emit('change');
  }
  function endLease(id) {
    const f = field(id);
    if (!f || !f.leased || f.job) return;
    f.owned = false; f.leased = false;
    if (f.auto) f.auto.on = false;
    S().queue = (S().queue || []).filter(q => q.fieldId !== id);
    log(`Pacht van Veld ${id} beëindigd. Wat er op het veld stond, ben je kwijt.`, 'warn');
    AT.emit('change');
  }

  // ---------- oogstverzekering ----------
  function toggleInsurance() {
    const ins = S().insurance;
    ins.crops = !ins.crops;
    log(ins.crops ? `Oogstverzekering afgesloten: ${AT.fmtMoney(insurancePremium())} per dag. Storm- en vorstschade wordt voor ${Math.round(D.insurance.cover * 100)}% vergoed.` : 'Oogstverzekering opgezegd.', ins.crops ? 'money' : 'info');
    AT.emit('change');
  }
  function insurancePremium() {
    return Math.round(S().fields.filter(f => f.owned).reduce((a, f) => a + fieldDef(f.id).ha, 0) * D.insurance.premiumPerHa);
  }
  // schade aan een veld: de verzekering vergoedt de verloren opbrengst
  function insuredDamage(f, hit, what) {
    const ins = S().insurance;
    if (!ins || !ins.crops) return;
    const sum = summary(f), crop = mainCrop(sum);
    if (!crop || !D.crops[crop].basePrice) return;
    const ha = fieldDef(f.id).ha * (sum.growing + sum.ready) / sum.total;
    const value = ha * D.crops[crop].yieldPerHa * cropPrice(crop) * hit * D.insurance.cover;
    if (value < 1) return;
    earn(value, false, 'uitkering');
    ins.paidOut = (ins.paidOut || 0) + value;
    log(`Verzekering keert ${AT.fmtMoney(value)} uit voor de ${what} op Veld ${f.id}.`, 'money');
  }

  // ---------- landbouwbeurs ----------
  function fair() {
    const s = S();
    if (!s.fair) s.fair = { year: 0, deals: {}, visited: false, active: false };
    return s.fair;
  }
  const fairActive = () => !!fair().active;
  // korting op een machine (0..1)
  function fairDiscount(type) {
    const f = fair();
    if (!f.active || !D.machines[type]) return 0;
    return Math.max(D.fair.discount, f.deals[type] || 0) + (f.visited ? D.fair.visitBonus : 0);
  }
  const machinePrice = type => Math.round(D.machines[type].price * (1 - fairDiscount(type)) / 10) * 10;
  // dagen tot de volgende beurs (0 = nu bezig)
  function daysToFair() {
    const m = AT.weather.month(), d = AT.weather.dayInMonth();
    if (fairActive()) return 0;
    const months = (D.fair.month - m + 12) % 12 || 12;
    return months * D.daysPerMonth - (d - 1);
  }
  function startFair() {
    const f = fair(), keys = Object.keys(D.machines).filter(k => !D.machines[k].old);
    f.deals = {};
    for (let i = 0; i < D.fair.deals && keys.length; i++) {
      const k = keys.splice(Math.floor(Math.random() * keys.length), 1)[0];
      f.deals[k] = Math.round((D.fair.dealMin + Math.random() * (D.fair.dealMax - D.fair.dealMin)) * 20) / 20;
    }
    f.active = true; f.visited = false; f.year = AT.weather.year();
    const top = Object.entries(f.deals).map(([k, v]) => `${D.machines[k].name} −${Math.round(v * 100)}%`).join(', ');
    log(`🎪 De landbouwbeurs is open (op de kade bij de haven)! Alle machines ${Math.round(D.fair.discount * 100)}% goedkoper. Beursaanbiedingen: ${top}. Ga zelf langs voor nog eens ${Math.round(D.fair.visitBonus * 100)}% extra.`, 'goal');
    AT.emit('sfx', 'goal');
  }
  function updateFair() {
    const f = fair(), m = AT.weather.month(), y = AT.weather.year();
    if (m === D.fair.month && !f.active && f.year !== y) startFair();
    else if (m !== D.fair.month && f.active) { f.active = false; f.deals = {}; log('De landbouwbeurs is voorbij. Volgend jaar in november weer!'); }
    else if (!f.active && (D.fair.month - m + 12) % 12 === 1 && AT.weather.dayInMonth() === 1) log(`🎪 Over ${D.daysPerMonth} dagen begint de landbouwbeurs bij de haven: korting op alle machines. Spaar maar vast!`);
  }
  // langs geweest op het beursterrein?
  function checkFairVisit(x, y) {
    const f = fair(), A = D.fair.area, L = D.sellPoints.harbor.lot;
    if (!f.active || f.visited) return;
    const inA = (r, m) => x > r.x - m && x < r.x + r.w + m && y > r.y - m && y < r.y + r.h + m;
    if (inA(A, 20) || inA(L, 0)) {
      f.visited = true;
      S().stats.fairVisits = (S().stats.fairVisits || 0) + 1;
      log(`🎪 Welkom op de landbouwbeurs! Als bezoeker krijg je ${Math.round(D.fair.visitBonus * 100)}% extra korting in de Winkel.`, 'good');
      AT.emit('sfx', 'goal');
      AT.emit('change');
    }
  }

  function buyMachine(type) {
    const d = D.machines[type];
    if (!d) return;
    const cost = machinePrice(type);
    if (S().money < cost) { log(`Niet genoeg geld voor ${d.name}.`, 'warn'); return; }
    spend(cost, 'machines');
    if (cost < d.price) { const st = S().stats; st.fairBuys = (st.fairBuys || 0) + 1; st.fairSaved = (st.fairSaved || 0) + d.price - cost; }
    const sl = freeSlot();
    S().machines.push({ uid: newUid(), type, busy: null, x: sl.x, y: sl.y, angle: 0, impl: null, attached: null });
    log(`${d.name} gekocht${cost < d.price ? ` met beurskorting (${AT.fmtMoney(d.price - cost)} bespaard)` : ''}! Hij staat op de parkeerplaats bij de schuur.`, 'money');
    AT.emit('change');
  }

  function sellMachine(uid) {
    const s = S();
    const m = s.machines.find(x => x.uid === uid);
    if (!m || m.busy || m.rented) return;
    const value = Math.round(machineDef(m).price * 0.6);
    if (m.impl) { const im = machine(m.impl); const h = hitchPoint(m); Object.assign(im, { x: h.x, y: h.y, angle: m.angle, attached: null }); }
    if (m.attached) machine(m.attached).impl = null;
    s.machines = s.machines.filter(x => x.uid !== uid);
    earn(value, false, 'machines verkocht');
    log(`${machineDef(m).name} verkocht voor ${AT.fmtMoney(value)}.`, 'money');
    AT.emit('change');
  }

  function upgradeSilo() {
    const s = S();
    const next = D.silo[s.siloLevel + 1];
    if (!next) return;
    if (s.money < next.price) { log('Niet genoeg geld voor de silo-uitbreiding.', 'warn'); return; }
    spend(next.price, 'gebouwen');
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
      m.sat = (m.sat || 0) * D.saturation.recovery;
      m.history.push(m.factor);
      if (m.history.length > 30) m.history.shift();
    }
  }

  function checkGoals() {
    const s = S();
    for (const g of D.goals) {
      if (s.goalsDone[g.id] || !g.check(s)) continue;
      s.goalsDone[g.id] = true;
      if (g.reward) earn(g.reward, false, 'doelen');
      AT.emit('sfx', 'goal');
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

  // ---------- onkruid, ziektes, plagen en irrigatie (elk speluur) ----------
  let healthHours = 0;
  function updateFieldHealth(dtHours) {
    healthHours += dtHours;
    if (healthHours < 1) return;
    const h = healthHours; healthHours = 0;
    const W = AT.weather, P = D.pests, se = W.season(), wet = W.isWet(), drought = W.drought();
    const type = S().weather ? S().weather.type : 'sun';
    const weedSeason = [1.3, 1, 0.6, 0][se];
    for (const f of S().fields) {
      if (!f.owned) continue;
      fieldDefaults(f);
      const c = f.cells, n = c.state.length;
      let sown = 0, sprayed = 0;
      for (let i = 0; i < n; i++) if (c.state[i] === ST.SOWN) { sown++; if (c.fert[i] & SPRAYED) sprayed++; }
      const frac = sown / n, protect = sown ? sprayed / sown * 0.9 : 0, d = h / 24;
      if (frac > 0) {
        f.weeds = Math.min(1, f.weeds + P.weedsPerDay * d * frac * weedSeason * (1 - protect));
        if (wet && se !== 3) f.disease = Math.min(1, f.disease + P.diseaseWet * d * frac * (1 - protect));
        else f.disease = Math.max(0, f.disease - 0.03 * d);
        if (se === 1 && !wet) f.pests = Math.min(1, f.pests + P.pestsSummer * d * frac * (type === 'sun' ? 1.3 : 1) * (1 - protect));
        else if (se === 0 && !wet) f.pests = Math.min(1, f.pests + P.pestsSummer * 0.35 * d * frac * (1 - protect));
        else f.pests = Math.max(0, f.pests - 0.04 * d);
        // zolang er onkruid, ziekte of plagen zijn, loopt de opbrengst terug
        const pressure = f.weeds * 0.8 + f.disease + f.pests * 0.8;
        f.pestLoss = Math.min(P.maxLoss, f.pestLoss + P.lossPerDay * d * pressure);
      } else {
        f.pestLoss = 0;
        f.disease = Math.max(0, f.disease - 0.1 * d);
        f.pests = Math.max(0, f.pests - 0.1 * d);
      }
      // meldingen als iets de grens over gaat
      f.warned = f.warned || {};
      for (const [k, txt] of [['weeds', 'veel onkruid'], ['disease', 'een schimmelziekte'], ['pests', 'plagen (insecten)']]) {
        if (f[k] > P.warnAt && !f.warned[k] && frac > 0.2) { f.warned[k] = true; log(`Veld ${f.id} heeft ${txt}! Spuit met een spuitmachine, anders verlies je opbrengst.`, 'warn'); }
        if (f[k] < P.warnAt * 0.5) f.warned[k] = false;
      }
      // irrigatie: compenseert de tragere groei bij droogte en kost water
      if (f.irrigated && drought && frac > 0) {
        const def = fieldDef(f.id);
        spend(D.irrigation.waterPerHaDay * def.ha * frac * d, 'water');
        const rates = {};
        for (let i = 0; i < n; i++) {
          if (c.state[i] !== ST.SOWN) continue;
          const key = CROP_KEYS[c.crop[i] - 1];
          if (D.crops[key].droughtProof) continue;
          if (rates[key] == null) rates[key] = W.growRate(key) * h;   // de helft die door droogte wegvalt
          c.planted[i] -= rates[key];
        }
      }
    }
  }

  function buyIrrigation(id) {
    const f = field(id), cost = D.irrigation.pricePerHa * fieldDef(id).ha;
    if (!f || !f.owned || f.irrigated) return;
    if (S().money < cost) { log('Niet genoeg geld voor irrigatie.', 'warn'); return; }
    spend(cost, 'gebouwen');
    f.irrigated = true;
    log(`Irrigatie aangelegd op Veld ${id}. Bij droogte groeit het gewas gewoon door (waterkosten ${AT.fmtMoney(D.irrigation.waterPerHaDay)}/ha per droge dag).`, 'money');
    AT.emit('change');
  }

  let readyTimer = 0;
  // dtSeconds = echte seconden sinds vorige frame
  function tick(dtSeconds) {
    const s = S();
    if (s.paused) return;
    const dtHours = dtSeconds * D.hoursPerSecond * s.speed * ((s.settings && s.settings.timeScale) || 1);
    const prevDay = day();
    s.time += dtHours;
    s.dryClock = (s.dryClock ?? s.time) + dtHours * (D.hayDryRate[s.weather ? s.weather.type : 'sun'] ?? 1);
    if (AT.weather) AT.weather.update(dtHours);
    if (AT.farm) AT.farm.update(dtHours);
    updateFieldHealth(dtHours);

    for (const f of s.fields) if (f.job) advanceJob(f, dtHours, dtSeconds);
    if (AT.staff) { AT.staff.update(dtSeconds); updateTrips(dtSeconds); }
    if (AT.vehicle) AT.vehicle.update(dtSeconds, dtHours);

    readyTimer += dtSeconds;
    if (readyTimer > 0.5) { readyTimer = 0; checkReady(); }

    if (day() !== prevDay) {
      updateMarket();
      if (AT.staff) AT.staff.payday();
      if (s.loan > 0) { const rente = s.loan * D.bank.ratePerDay * diff().interest; spend(rente, 'rente'); }
      for (const f of s.fields) if (f.leased) spend(leaseRent(f.id), 'pacht');
      const rented = s.machines.filter(m => m.rented);
      if (rented.length) spend(rented.reduce((a, m) => a + rentPrice(m.type), 0), 'huur');
      if (s.insurance && s.insurance.crops) spend(insurancePremium(), 'verzekering');
      checkContracts();
      updateFair();
      save();
      AT.emit('newday');
    }
    checkGoals();
  }

  // ---------- opslaan / laden ----------
  const packBytes = arr => Array.from(arr, v => String.fromCharCode(48 + v)).join('');
  const unpackBytes = (str, n) => { const a = new Uint8Array(n); for (let i = 0; i < n && i < str.length; i++) a[i] = str.charCodeAt(i) - 48; return a; };

  // de hele spelstand als tekst (voor opslaan, opslagplekken en exporteren)
  function serialize() {
    const s = S();
    const out = Object.assign({}, s, {
      version: D.version,
      cropKeys: CROP_KEYS,   // zodat een update met nieuwe gewassen de gewas-nummers kan omzetten
      // alle veldgegevens (pH, onkruid, pacht, irrigatie …) plus de ingepakte cellen
      fields: s.fields.map(({ cells, ...rest }) => Object.assign(rest, {
        n: cells.state.length, auto: rest.auto || null,
        state: packBytes(cells.state), crop: packBytes(cells.crop), dir: packBytes(cells.dir),
        fert: packBytes(cells.fert), prev: packBytes(cells.prev),
        // zaaimoment (ingezaaid) of maaimoment (gemaaid gras dat droogt)
        planted: Array.from(cells.planted, (v, i) => cells.state[i] === ST.SOWN || cells.state[i] === ST.MOWN ? Math.round(v * 10) / 10 : 0),
      })),
    });
    out.savedAt = Date.now();
    return JSON.stringify(out);
  }
  let saveBlocked = false;   // vlak voor herladen na een import/laden niet meer overschrijven
  function save() {
    if (saveBlocked || !S()) return;
    try { localStorage.setItem(SAVE_KEY, serialize()); } catch (e) { /* geen opslag beschikbaar */ }
  }

  // ---------- opslagplekken, exporteren en importeren ----------
  const SLOTS = 3, slotKey = n => SAVE_KEY + '-slot-' + n;
  function slotInfo(raw) {
    try {
      const sv = JSON.parse(raw);
      if (!sv || !Array.isArray(sv.fields)) return null;
      return { day: Math.floor((sv.time || 0) / 24) + 1, money: sv.money || 0, fields: sv.fields.filter(f => f.owned).length,
        name: sv.slotName || '', savedAt: sv.savedAt || null, version: sv.version };
    } catch (e) { return null; }
  }
  function listSlots() {
    const out = [];
    for (let n = 1; n <= SLOTS; n++) { let raw = null; try { raw = localStorage.getItem(slotKey(n)); } catch (e) { /* ok */ } out.push({ n, info: raw ? slotInfo(raw) : null }); }
    return out;
  }
  function saveSlot(n, name) {
    const s = S();
    s.slotName = name || `Spel ${n}`;
    try { localStorage.setItem(slotKey(n), serialize()); } catch (e) { log('Opslaan mislukt: de browser heeft geen ruimte meer.', 'warn'); return false; }
    log(`Opgeslagen op plek ${n} (${s.slotName}).`, 'good');
    AT.emit('change');
    return true;
  }
  // laden = de gekozen stand wordt de huidige stand, daarna de pagina opnieuw laden
  function loadRaw(raw) {
    if (!slotInfo(raw)) return false;
    save();
    try { const sv = JSON.parse(raw); localStorage.setItem(MAP_KEY, D.maps[sv.map] ? sv.map : 'standaard'); } catch (e) { /* ok */ }
    try { localStorage.setItem(SAVE_KEY + '-before-load', localStorage.getItem(SAVE_KEY) || ''); localStorage.setItem(SAVE_KEY, raw); } catch (e) { return false; }
    saveBlocked = true;
    location.reload();
    return true;
  }
  function loadSlot(n) { let raw = null; try { raw = localStorage.getItem(slotKey(n)); } catch (e) { /* ok */ } return raw ? loadRaw(raw) : false; }
  function deleteSlot(n) { try { localStorage.removeItem(slotKey(n)); } catch (e) { /* ok */ } AT.emit('change'); }
  function exportSave() { return serialize(); }
  function importSave(text) { return loadRaw(text); }

  // vult ontbrekende onderdelen aan met de standaardwaarden (nieuwe functies na een update)
  const isPlain = o => o && typeof o === 'object' && !Array.isArray(o) && !ArrayBuffer.isView(o);
  function fillDefaults(target, defaults) {
    for (const k of Object.keys(defaults)) {
      if (target[k] === undefined || target[k] === null && defaults[k] !== null) target[k] = defaults[k];
      else if (isPlain(target[k]) && isPlain(defaults[k])) fillDefaults(target[k], defaults[k]);
    }
    return target;
  }

  // Laden werkt ook met saves van oudere versies: wat er nieuw is krijgt een standaardwaarde,
  // wat er niet meer bestaat (machines, gewassen) valt weg. De oude save blijft als reservekopie bewaard.
  function load() {
    let raw = null, saved = null;
    try { raw = localStorage.getItem(SAVE_KEY); saved = JSON.parse(raw); } catch (e) { saved = null; }
    const fresh = createState();
    try { localStorage.removeItem(NEWGAME_KEY); } catch (e) { /* ok */ }
    if (!saved || typeof saved !== 'object' || !Array.isArray(saved.fields)) return fresh;
    const upgraded = saved.version !== D.version;
    if (upgraded) { try { localStorage.setItem(SAVE_KEY + '-backup-v' + saved.version, raw); } catch (e) { /* vol */ } }

    // gewas-nummers omzetten als er gewassen bij zijn gekomen of verschoven
    const oldKeys = Array.isArray(saved.cropKeys) ? saved.cropKeys : CROP_KEYS;
    const cropMap = oldKeys.map(k => CROP_KEYS.indexOf(k) + 1);   // 0 = bestaat niet meer
    const remap = arr => { for (let i = 0; i < arr.length; i++) if (arr[i]) arr[i] = cropMap[arr[i] - 1] || 0; return arr; };

    const state = Object.assign(fresh, saved);
    state.fields = D.fields.map(def => {
      const sf = saved.fields.find(x => x.id === def.id);
      const f = newField(def);
      if (!sf) return f;
      const n = def.cols * def.rows;
      // alle veld-gegevens overnemen (ook nieuwere zoals pH), behalve de ingepakte cellen
      const { state: _s, crop: _c, dir: _d, fert: _f, prev: _p, planted: _pl, n: _n, ...rest } = sf;
      Object.assign(f, rest);
      f.owned = !!sf.owned; f.soil = sf.soil ?? D.startSoil; f.damage = sf.damage || 0; f.auto = sf.auto || null;
      // celgegevens alleen overnemen als het veld even groot is gebleven
      const sameSize = (sf.n || (sf.state || '').length) === n;
      if (sameSize) {
        f.cells.fert = unpackBytes(sf.fert || '', n);
        f.cells.prev = remap(unpackBytes(sf.prev || '', n));
        f.cells.state = unpackBytes(sf.state || '', n);
        f.cells.crop = remap(unpackBytes(sf.crop || '', n));
        f.cells.dir = unpackBytes(sf.dir || '', n);
        f.cells.planted = Float32Array.from({ length: n }, (_, i) => (sf.planted || [])[i] || 0);
        // een gewas dat niet meer bestaat wordt stoppel
        for (let i = 0; i < n; i++) if (f.cells.state[i] === ST.SOWN && !f.cells.crop[i]) f.cells.state[i] = ST.STUBBLE;
      } else f.job = null;
      return fieldDefaults(f);
    });
    const base = createState();
    state.silo = Object.assign(base.silo, saved.silo);
    state.market = Object.assign(base.market, saved.market);
    for (const k of Object.keys(state.market)) if (!D.crops[k] && !D.products[k]) delete state.market[k];
    state.goods = Object.assign(base.goods, saved.goods);
    for (const k of Object.keys(state.silo)) if (!D.crops[k]) delete state.silo[k];
    for (const k of Object.keys(state.goods)) if (!D.products[k]) delete state.goods[k];
    state.contracts = Object.assign(base.contracts, saved.contracts);
    state.contracts.offers = state.contracts.offers.filter(c => D.crops[c.key] || D.products[c.key]);
    state.contracts.active = state.contracts.active.filter(c => D.crops[c.key] || D.products[c.key]);
    state.ledger = saved.ledger || [];
    state.growClock = Object.assign(base.growClock, saved.growClock);
    for (const k in base.animals) state.animals[k] = Object.assign(base.animals[k], (saved.animals || {})[k]);
    for (const k in base.factories) state.factories[k] = Object.assign(base.factories[k], (saved.factories || {})[k]);
    for (const k of Object.keys(state.animals)) if (!D.animals[k]) delete state.animals[k];
    for (const k of Object.keys(state.factories)) if (!D.factories[k]) delete state.factories[k];
    state.stats = Object.assign(base.stats, saved.stats);
    state.stats.cropsHarvested = state.stats.cropsHarvested || {};
    state.machines = (saved.machines || []).filter(m => D.machines[m.type]);
    const uids = new Set(state.machines.map(m => m.uid));
    for (const m of state.machines) {
      if (m.impl && !uids.has(m.impl)) m.impl = null;
      if (m.attached && !uids.has(m.attached)) m.attached = null;
      if (m.load && m.load.crop && !D.crops[m.load.crop] && !D.products[m.load.crop]) m.load = { crop: null, tons: 0 };
    }
    uidCounter = state.machines.reduce((max, m) => Math.max(max, m.uid), 0) + 1;
    // speler zat in een machine die niet meer bestaat
    const p = state.player;
    if (p.mode === 'drive' && !uids.has(p.vehicle)) Object.assign(p, { mode: 'foot', vehicle: null, speed: 0 });
    if (!D.crops[p.crop]) p.crop = CROP_KEYS[0];
    if (state.siloLevel >= D.silo.length) state.siloLevel = D.silo.length - 1;
    if ((state.warehouseLevel || 0) >= D.warehouse.length) state.warehouseLevel = D.warehouse.length - 1;
    if (saved.dryClock == null) state.dryClock = state.time;
    if (!saved.difficulty) state.difficulty = 'normal';
    state.map = D.mapId;
    // bestaande spellers hoeven de uitleg niet meer te zien
    if (!saved.tutorial) state.tutorial = { step: 0, done: !!(saved.stats && saved.stats.harvestedHa > 0) };
    fillDefaults(state, base);
    state.version = D.version;
    if (upgraded) state.log.unshift({ day: Math.floor(state.time / 24) + 1, hour: Math.floor(state.time % 24), text: `Het spel is bijgewerkt (versie ${saved.version || '?'} → ${D.version}). Je voortgang is bewaard.`, type: 'goal' });
    return state;
  }

  // nieuw spel met kaart en moeilijkheid: opslaan wat je kiest en de pagina opnieuw laden
  function newGame(opts = {}) {
    try {
      save();
      localStorage.setItem(SAVE_KEY + '-before-new', localStorage.getItem(SAVE_KEY) || '');
      localStorage.setItem(NEWGAME_KEY, JSON.stringify({ difficulty: opts.difficulty || 'normal' }));
      localStorage.setItem(MAP_KEY, D.maps[opts.map] ? opts.map : 'standaard');
      localStorage.removeItem(SAVE_KEY);
    } catch (e) { /* ok */ }
    saveBlocked = true;
    location.reload();
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

  // ---------- hooibalen ----------
  let baleId = 1;
  function dropBale(x, y, angle, tons) {
    const s = S(), hit = cellAt(x, y);
    s.bales.push({ id: Date.now().toString(36) + (baleId++), x, y, a: angle, t: tons, field: hit ? hit.def.id : null });
  }
  // balen laten ophalen: ze gaan meteen naar de opslagloods
  function collectBales(fieldId) {
    const s = S(), list = s.bales.filter(b => fieldId == null || b.field === fieldId);
    if (!list.length) return;
    let n = 0, tons = 0;
    for (const b of list) {
      if (s.money < D.baleCollectCost || warehouseRoom('hay') < b.t) break;
      spend(D.baleCollectCost, 'loonwerk');
      s.goods.hay += b.t; tons += b.t; n++;
      s.bales = s.bales.filter(x => x !== b);
    }
    if (n < list.length) log(n ? `${n} balen opgehaald; de rest past niet meer (opslagloods vol of geen geld).` : 'De opslagloods is vol of je hebt geen geld.', 'warn');
    if (n) log(`${n} hooibalen opgehaald (${AT.fmtTons(tons)}) voor ${AT.fmtMoney(n * D.baleCollectCost)}.`, 'money');
    AT.emit('change');
  }

  // naam en kleur van een gewas of product
  const goodDef = key => D.crops[key] || D.products[key] || null;
  const goodName = key => (goodDef(key) || { name: key }).name.toLowerCase();
  const goodColor = key => (goodDef(key) && goodDef(key).color) || '#d9c27a';

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
  // een willekeurige prijs netjes: kleine bedragen met centen
  AT.fmtPrice2 = (v, key) => '€' + v.toLocaleString('nl-NL', { minimumFractionDigits: v < 10 ? 2 : 0, maximumFractionDigits: v < 10 ? 2 : 0 });
  AT.fmtPrice = key => {
    const v = price(key);
    return '€' + v.toLocaleString('nl-NL', { minimumFractionDigits: v < 10 ? 2 : 0, maximumFractionDigits: v < 10 ? 2 : 0 });
  };

  AT.game = {
    placeBuilding, placeProblem, demolish, footprint, fuelPumps, nearPump, siloPits, builtOf,
    dropBale, collectBales, goodDef, goodName, goodColor, leaseField, endLease, leaseRent, toggleInsurance, insurancePremium, insuredDamage,
    fair, fairActive, fairDiscount, machinePrice, daysToFair, startFair, updateFair, checkFairVisit,
    STONE, ROLLED, fuelCap, fuelOf, addWear, wearSpeed, wearFuel, repairCost, repair, refuel, rentPrice, rentMachine, returnMachine, buyGps, atYard, taskKinds,
    ST, CROP_KEYS, FERT, MANURE, LIME, SPRAYED, COMPACT, isImplement, IMPL_NAMES, phFactor, compactAt, wetGround, buyIrrigation, fieldDefaults,
    price, stock, take, addGood, sellGood, yieldFactor, canSowNow, spend, earn, hayDryness, TEDDED, PLANTER_NAMES,
    accepts, sellAt, saturate, warehouseCapacity, palletsUsed, warehouseRoom, upgradeWarehouse,
    refreshOffers, acceptContract, deliverContract, fillContracts, maxLoan, borrow, repay, assetsValue, ledgerToday,
    tick, startJob, sell, buyField, buyMachine, sellMachine, upgradeSilo, enterVehicle, exitVehicle,
    toggleHitch, nearestImplement, nearestVehicle, hitchPoint, machine, HITCH, getLoad, loadCap, trailerPose,
    save, load, reset, newGame, serialize, listSlots, saveSlot, loadSlot, deleteSlot, exportSave, importSave, slotInfo, bestRig, missingFor, canPull, workCell, cellAt, summary, mainCrop,
    isReady, cellGrowth, overripe, isWithering, jobPosition, jobPose, log, readyCropOf, HARVESTER_NAMES,
    day, hour, siloCapacity, siloUsed, siloRoom, cropPrice, fieldPrice, fieldDef, field,
  };
})();
