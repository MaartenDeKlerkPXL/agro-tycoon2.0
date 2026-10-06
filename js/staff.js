// Agro Tycoon 2.0 — personeel en automatisering
// - Vaste werknemers met eigen vaardigheden en dagloon
// - Wachtrij met opdrachten ("ploeg veld 3, daarna zaai maïs")
// - Automatische veldcyclus per veld
// - Route over de wegen zodat werknemers echt naar het veld rijden
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const S = () => AT.state;
  const G = () => AT.game;

  // ---------- werknemers ----------
  const FIRST = ['Jan', 'Pieter', 'Sanne', 'Lotte', 'Bram', 'Fleur', 'Daan', 'Emma', 'Ruben', 'Noor', 'Joris', 'Femke',
    'Tim', 'Lisa', 'Koen', 'Anouk', 'Sem', 'Julia', 'Thijs', 'Eva', 'Wout', 'Ilse', 'Lars', 'Marieke'];
  const LAST = ['de Vries', 'Jansen', 'Bakker', 'Visser', 'Smit', 'Mulder', 'de Boer', 'Peeters', 'Maes', 'Claes',
    'Willems', 'Janssens', 'van Dijk', 'Hendriks', 'Verbeek', 'Dekker', 'Wouters', 'Goossens'];
  const pickOne = list => list[Math.floor(Math.random() * list.length)];

  function newCandidate() {
    const speed = Math.round((0.8 + Math.random() * 0.5) * 100) / 100;   // 0,8–1,3× zo snel
    const fuel = Math.round((0.75 + Math.random() * 0.45) * 100) / 100;  // 0,75–1,2× brandstof
    const salary = Math.round((110 + (speed - 0.8) * 420 + (1.2 - fuel) * 260) / 5) * 5;
    return { id: 'w' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), name: `${pickOne(FIRST)} ${pickOne(LAST)}`, speed, fuel, salary, xp: 0, status: 'idle', fieldId: null,
      energy: 1, freeDay: Math.floor(Math.random() * 7), stamina: Math.round((0.8 + Math.random() * 0.4) * 100) / 100 };
  }

  function ensure() {
    const s = S();
    if (!s.staff) s.staff = { employees: [], candidates: [], candidatesDay: 0, allowExternal: true };
    const st = s.staff;
    if (st.hours == null) st.hours = [6, 22];        // werktijden
    if (st.nightShift == null) st.nightShift = false;  // ook buiten werktijd (duurder)
    if (st.carter == null) st.carter = true;           // chauffeur met kipper meesturen bij oogsten
    for (const w of st.employees.concat(st.candidates)) {
      if (w.energy == null) w.energy = 1;
      if (w.freeDay == null) w.freeDay = Math.floor(Math.random() * 7);
      if (w.stamina == null) w.stamina = 1;
    }
    if (!s.chasers) s.chasers = [];
    if (s.chaser) { s.chasers.push(s.chaser); delete s.chaser; }
    if (!s.feedRuns) s.feedRuns = [];
    if (!s.queue) s.queue = [];
    if (!s.trips) s.trips = [];
    if (!s.deliveries) s.deliveries = [];
    if (!s.staff.candidates.length) refreshCandidates(true);
  }

  function refreshCandidates(free = false) {
    const s = S();
    if (!free) {
      if (s.money < D.staff.refreshCost) { G().log('Niet genoeg geld voor een nieuwe sollicitatieronde.', 'warn'); return; }
      G().spend(D.staff.refreshCost);
    }
    s.staff.candidates = Array.from({ length: 3 }, newCandidate);
    s.staff.candidatesDay = G().day();
    AT.emit('change');
  }

  const level = w => Math.min(D.staff.maxLevel, 1 + Math.floor(w.xp / D.staff.jobsPerLevel));
  // effectieve snelheid: talent + ervaring
  // effectieve snelheid: talent + ervaring, en wie moe is werkt trager
  const workSpeed = w => w.external ? 1 : w.speed * (1 + (level(w) - 1) * 0.05) * (w.energy < 0.3 ? 0.8 : 1);
  const DAYS = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'];
  const weekday = () => (G().day() - 1) % 7;
  const dayName = i => DAYS[i];
  // waarom kan deze werknemer nu geen nieuwe klus beginnen? (null = hij kan)
  function offDuty(w) {
    const st = S().staff, h = G().hour();
    if (w.freeDay === weekday()) return `vrije dag (${dayName(w.freeDay)})`;
    if (!st.nightShift && (h < st.hours[0] || h >= st.hours[1])) return `buiten werktijd (${st.hours[0]}:00–${st.hours[1]}:00)`;
    if (w.energy < 0.15) return 'moe, rust uit';
    return null;
  }

  function hire(id) {
    const s = S(), c = s.staff.candidates.find(x => x.id === id);
    if (!c) return;
    if (s.staff.employees.length >= D.staff.max) { G().log(`Je hebt al ${D.staff.max} werknemers.`, 'warn'); return; }
    s.staff.employees.push(c);
    s.staff.candidates = s.staff.candidates.filter(x => x.id !== id);
    G().log(`${c.name} werkt nu voor je (${AT.fmtMoney(c.salary)} per dag).`, 'money');
    AT.emit('change');
  }

  function fire(id) {
    const s = S(), w = s.staff.employees.find(x => x.id === id);
    if (!w || w.status !== 'idle') return;
    s.staff.employees = s.staff.employees.filter(x => x.id !== id);
    G().log(`${w.name} is ontslagen.`);
    AT.emit('change');
  }

  const employee = id => S().staff.employees.find(w => w.id === id);
  const EXTERNAL = { id: 'ext', name: 'Loonwerker', external: true, speed: 1, fuel: 1 };
  function workerById(id) { return id === 'ext' ? EXTERNAL : employee(id); }

  function freeWorker() {
    const free = S().staff.employees.filter(w => w.status === 'idle' && !offDuty(w));
    if (free.length) return free.sort((a, b) => workSpeed(b) - workSpeed(a))[0];
    return S().staff.allowExternal ? EXTERNAL : null;
  }

  function payday() {
    const s = S(), total = s.staff.employees.reduce((a, w) => a + w.salary, 0) * (s.staff.nightShift ? 1.4 : 1);
    if (total > 0) {
      G().spend(total);
      G().log(`Lonen betaald aan ${s.staff.employees.length} werknemer(s): ${AT.fmtMoney(total)}.`, 'money');
    }
    if (G().day() - s.staff.candidatesDay >= 7) refreshCandidates(true);
  }

  // ---------- wachtrij ----------
  let qid = 1;
  function enqueue(fieldId, task, crop, auto = false) {
    ensure();
    S().queue.push({ id: 'q' + Date.now().toString(36) + (qid++), fieldId, task, crop: crop || null, auto, status: 'in de wachtrij' });
    if (!auto) G().log(`Opdracht toegevoegd: ${TASK_LABEL(task, crop)} op Veld ${fieldId}.`);
    AT.emit('change');
  }
  function removeTask(id) { S().queue = S().queue.filter(q => q.id !== id); AT.emit('change'); }
  function moveTask(id, dir) {
    const q = S().queue, i = q.findIndex(t => t.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= q.length) return;
    [q[i], q[j]] = [q[j], q[i]];
    AT.emit('change');
  }

  const TASK_LABEL = (task, crop) => ({
    plow: 'Ploegen', sow: 'Zaaien' + (crop ? ' (' + D.crops[crop].name.toLowerCase() + ')' : ''), harvest: 'Oogsten',
    fertilize: 'Kunstmest strooien', manure: 'Mest uitrijden', mow: 'Gras maaien', ted: 'Gras schudden', bale: 'Hooi persen',
    lime: 'Kalk strooien', spray: 'Spuiten', roll: 'Rollen', stones: 'Stenen rapen',
  })[task];

  // Kan deze taak nu starten? Geeft { ok } of { wait: 'reden' } of { drop: 'reden' }
  function taskState(t, earlierForField) {
    const f = G().field(t.fieldId);
    if (!f || !f.owned) return { drop: 'veld is niet van jou' };
    if (earlierForField) return { wait: 'wacht op de vorige opdracht voor dit veld' };
    if (f.job) return { wait: 'veld is bezig' };
    if (S().trips.some(tr => tr.fieldId === t.fieldId && tr.phase === 'work')) return { wait: 'veld is bezig' };
    const sum = G().summary(f);
    if (t.task === 'plow' && !(sum.stubble + sum.clover)) return sum.growing || sum.ready || sum.mown ? { drop: 'er staat een gewas op het veld' } : { drop: 'veld is al geploegd' };
    if (t.task === 'mow' && !sum.readyCrops.grass) return sum.grass ? { wait: 'gras groeit nog' } : { drop: 'geen gras op dit veld' };
    if (t.task === 'ted' && !sum.needTed) return { drop: 'niets te schudden' };
    if (t.task === 'bale' && !sum.dryHay) return sum.mown ? { wait: 'gras droogt nog' } : { drop: 'niets te persen' };
    if (t.task === 'sow') {
      if (!sum.plowed) return sum.stubble ? { wait: 'veld moet eerst geploegd worden' } : { drop: 'niets meer te zaaien' };
      if (!G().canSowNow(t.crop)) return { wait: `wacht op de zaaimaand van ${D.crops[t.crop].name.toLowerCase()}` };
    }
    if (t.task === 'harvest' && !(sum.ready - (sum.readyCrops.grass || 0))) return sum.growing ? { wait: 'gewas groeit nog' } : { drop: 'niets te oogsten' };
    if (t.task === 'fertilize' && !sum.needFert) return { drop: 'al bemest' };
    if (t.task === 'manure' && !sum.needManure) return { drop: 'al bemest' };
    if (t.task === 'lime' && !sum.needLime) return { drop: 'al gekalkt' };
    if (t.task === 'roll' && !sum.needRoll) return { drop: 'niets (meer) te rollen' };
    if (t.task === 'stones' && !sum.stones) return { drop: 'geen stenen' };
    if (t.task === 'spray' && !sum.needSpray) return sum.ready ? { drop: 'gewas is al rijp' } : { drop: 'niets te spuiten' };
    const rig = G().bestRig(t.task, t.fieldId, t.crop);
    if (!rig) return { wait: G().missingFor(t.task, t.fieldId, t.crop) };
    const worker = freeWorker();
    if (!worker) return { wait: whyNoWorker() };
    return { ok: true, worker };
  }

  function whyNoWorker() {
    const emps = S().staff.employees;
    if (!emps.length) return 'wacht op een werknemer (neem iemand aan of sta loonwerkers toe)';
    const idle = emps.filter(w => w.status === 'idle');
    if (!idle.length) return 'iedereen is bezig';
    return 'wacht: ' + [...new Set(idle.map(offDuty))].join(', ');
  }

  // energie: werken maakt moe, rusten (vooral 's nachts) laadt weer op
  function updateEnergy(dtHours) {
    const h = G().hour(), night = h < 6 || h >= 22;
    for (const w of S().staff.employees) {
      if (w.status === 'idle') w.energy = Math.min(1, w.energy + dtHours * (night ? 0.16 : 0.1));
      else w.energy = Math.max(0, w.energy - dtHours * 0.06 / (w.stamina || 1));
      if (w.energy < 0.2 && !w.tiredWarned) { w.tiredWarned = true; G().log(`${w.name} is moe en werkt trager. Na deze klus rust hij/zij uit.`, 'warn'); }
      if (w.energy > 0.6) w.tiredWarned = false;
    }
  }

  function processQueue() {
    const s = S(), seen = new Set();
    for (const t of [...s.queue]) {
      const st = taskState(t, seen.has(t.fieldId));
      seen.add(t.fieldId);
      if (st.drop) {
        s.queue = s.queue.filter(q => q !== t);
        if (!t.auto) G().log(`Opdracht ${TASK_LABEL(t.task, t.crop).toLowerCase()} op Veld ${t.fieldId} vervalt: ${st.drop}.`);
        AT.emit('change');
        continue;
      }
      if (st.wait) { t.status = st.wait; continue; }
      const res = G().startJob(t.fieldId, t.task, t.crop, { worker: st.worker, quiet: true });
      if (res === true) { s.queue = s.queue.filter(q => q !== t); AT.emit('change'); }
      else t.status = res || 'kan niet starten';
    }
  }

  // ---------- automatische veldcyclus ----------
  function setAuto(fieldId, patch) {
    const f = G().field(fieldId);
    f.auto = Object.assign({ on: false, crop: 'rotate', fert: false, status: '' }, f.auto || {}, patch);
    AT.emit('change');
  }

  // beste gewas voor wisselbouw: nu zaaibaar, anders dan het vorige gewas, oogstmachine aanwezig
  function rotationCrop(f) {
    const sum = G().summary(f);
    const prev = G().mainCrop({ crops: sum.prev });
    const owned = new Set(S().machines.map(m => D.machines[m.type].harvests).filter(Boolean));
    const planters = new Set(S().machines.map(m => D.machines[m.type].sows).filter(Boolean));
    const options = Object.entries(D.crops).filter(([k, c]) => G().canSowNow(k) && k !== prev && !c.perennial &&
      planters.has(c.planter || 'seeder') && (c.harvester ? owned.has(c.harvester) : f.soil < 0.55));
    if (!options.length) return null;
    // waarde per dag groeitijd, en klaver als de bodem slecht is
    const score = ([k, c]) => c.greenManure ? 1e9 : (c.yieldPerHa * G().cropPrice(k) - c.seedCostPerHa) / c.growDays;
    return options.sort((a, b) => score(b) - score(a))[0][0];
  }

  function autoStep() {
    const s = S();
    for (const f of s.fields) {
      if (!f.owned || !f.auto || !f.auto.on) continue;
      if (f.job || s.queue.some(q => q.fieldId === f.id)) continue;
      const sum = G().summary(f), half = sum.total * 0.5;
      const readyCrop = G().mainCrop({ crops: sum.readyCrops });
      let msg = '';
      const hasKind = k => s.machines.some(m => D.machines[m.type].kind === k);
      if (sum.grass || sum.mown) {
        // grasland: maaien → (schudden) → persen; het gras groeit vanzelf weer aan
        if (sum.dryHay > sum.mown * 0.8 && sum.dryHay) enqueue(f.id, 'bale', null, true);
        else if (sum.needTed > half * 0.5 && hasKind('tedder')) enqueue(f.id, 'ted', null, true);
        else if (sum.readyCrops.grass > half) enqueue(f.id, 'mow', null, true);
        else msg = sum.mown ? 'hooi droogt' : 'gras groeit';
        f.auto.status = msg;
        continue;
      }
      const health = Math.max(f.weeds || 0, f.disease || 0, f.pests || 0);
      if (sum.growing > half && health > 0.25 && hasKind('sprayer') && sum.needSpray > half) { enqueue(f.id, 'spray', null, true); f.auto.status = 'spuiten'; continue; }
      if (sum.stones > sum.total * 0.12 && hasKind('stonepicker') && sum.stubble + sum.plowed > half) { enqueue(f.id, 'stones', null, true); f.auto.status = 'stenen rapen'; continue; }
      if (sum.needRoll > half && hasKind('roller')) { enqueue(f.id, 'roll', null, true); f.auto.status = 'rollen'; continue; }
      if ((f.ph ?? 7) < 6.0 && hasKind('lime') && sum.needLime > half && sum.stubble + sum.plowed > half) { enqueue(f.id, 'lime', null, true); f.auto.status = 'kalken'; continue; }
      if (sum.ready > half * 0.2 && readyCrop && !D.crops[readyCrop].greenManure && !sum.growing) enqueue(f.id, 'harvest', null, true);
      else if (sum.ready && readyCrop && D.crops[readyCrop].greenManure && !sum.growing) enqueue(f.id, 'plow', null, true);
      else if (sum.stubble > half) enqueue(f.id, 'plow', null, true);
      else if (sum.plowed > half) {
        const hasSpreader = s.machines.some(m => D.machines[m.type].kind === 'spreader');
        const crop = f.auto.crop === 'rotate' ? rotationCrop(f) : f.auto.crop;
        const manureNeed = D.manurePerHa * G().fieldDef(f.id).ha * sum.needManure / sum.total;
        if (f.auto.manure && hasKind('manure') && sum.needManure > half && s.goods.manure >= manureNeed) enqueue(f.id, 'manure', null, true);
        else if (f.auto.fert && hasSpreader && sum.needFert > half) enqueue(f.id, 'fertilize', null, true);
        else if (!crop) msg = 'geen gewas dat nu gezaaid kan worden';
        else if (!G().canSowNow(crop)) msg = `wacht op de zaaimaand van ${D.crops[crop].name.toLowerCase()}`;
        else enqueue(f.id, 'sow', crop, true);
      } else if (sum.growing) msg = 'gewas groeit';
      f.auto.status = msg;
    }
  }

  // ---------- route over de wegen ----------
  let graph = null;
  function buildGraph() {
    const segs = D.roads.map(r => r.w > r.h
      ? { h: true, c: r.y + r.h / 2, a: r.x, b: r.x + r.w }
      : { h: false, c: r.x + r.w / 2, a: r.y, b: r.y + r.h });
    const nodes = [];
    const nodeAt = (x, y) => {
      let n = nodes.find(n => Math.abs(n.x - x) < 0.5 && Math.abs(n.y - y) < 0.5);
      if (!n) { n = { x, y, id: nodes.length, edges: [] }; nodes.push(n); }
      return n;
    };
    segs.forEach(sg => { sg.nodes = [sg.h ? nodeAt(sg.a, sg.c) : nodeAt(sg.c, sg.a), sg.h ? nodeAt(sg.b, sg.c) : nodeAt(sg.c, sg.b)]; });
    for (const h of segs.filter(x => x.h)) for (const v of segs.filter(x => !x.h)) {
      if (v.c >= h.a && v.c <= h.b && h.c >= v.a && h.c <= v.b) {
        const n = nodeAt(v.c, h.c);
        h.nodes.push(n); v.nodes.push(n);
      }
    }
    for (const sg of segs) {
      const uniq = [...new Set(sg.nodes)].sort((p, q) => sg.h ? p.x - q.x : p.y - q.y);
      sg.nodes = uniq;
      for (let i = 1; i < uniq.length; i++) link(uniq[i - 1], uniq[i]);
    }
    return { segs, nodes };
  }
  function link(a, b) {
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    a.edges.push({ to: b, d }); b.edges.push({ to: a, d });
  }

  // dichtstbijzijnde punt op een weg
  function project(p) {
    let best = null;
    for (const sg of graph.segs) {
      const x = sg.h ? Math.max(sg.a, Math.min(sg.b, p.x)) : sg.c;
      const y = sg.h ? sg.c : Math.max(sg.a, Math.min(sg.b, p.y));
      const d = Math.hypot(p.x - x, p.y - y);
      if (!best || d < best.d) best = { x, y, d, sg };
    }
    return best;
  }

  function shortest(from, to) {
    // tijdelijke knopen op de wegen, verbonden met hun buren op dat wegstuk
    const temp = [from, to].map(pr => {
      const n = { x: pr.x, y: pr.y, edges: [], temp: true };
      const along = v => pr.sg.h ? v.x : v.y, here = along(n);
      const before = pr.sg.nodes.filter(m => along(m) <= here).pop();
      const after = pr.sg.nodes.find(m => along(m) > here);
      [before, after].filter(Boolean).forEach(m => {
        const d = Math.hypot(m.x - n.x, m.y - n.y);
        n.edges.push({ to: m, d });
        m.edges.push({ to: n, d, temp: true });
      });
      return n;
    });
    const [A, B] = temp;
    if (from.sg === to.sg) { const d = Math.hypot(A.x - B.x, A.y - B.y); A.edges.push({ to: B, d }); }
    const dist = new Map([[A, 0]]), prev = new Map(), open = new Set([A]);
    while (open.size) {
      let u = null;
      for (const n of open) if (u === null || dist.get(n) < dist.get(u)) u = n;
      open.delete(u);
      if (u === B) break;
      for (const e of u.edges) {
        const nd = dist.get(u) + e.d;
        if (nd < (dist.has(e.to) ? dist.get(e.to) : Infinity)) { dist.set(e.to, nd); prev.set(e.to, u); open.add(e.to); }
      }
    }
    // tijdelijke verbindingen weer opruimen
    for (const n of graph.nodes) n.edges = n.edges.filter(e => !e.temp);
    const path = [];
    for (let n = B; n; n = prev.get(n)) path.unshift({ x: n.x, y: n.y });
    return path.length && path[0].x === A.x && path[0].y === A.y ? path : [A, B].map(n => ({ x: n.x, y: n.y }));
  }

  const Y = () => D.yard;
  const inYard = p => p.x >= Y().x && p.x <= Y().x + Y().w && p.y >= Y().y && p.y <= Y().y + Y().h;
  function gatePoints() {
    const gy = Y().gate.y + Y().gate.h / 2;
    return [{ x: Y().x + Y().w - 30, y: gy }, { x: Y().x + Y().w + 12, y: gy }];
  }

  // route van a naar b: via de poort als je op het erf bent, verder over de wegen
  function route(a, b) {
    if (!graph) graph = buildGraph();
    const pre = inYard(a) ? gatePoints() : [];
    const post = inYard(b) ? gatePoints().reverse() : [];
    const start = pre.length ? pre[pre.length - 1] : a;
    const end = post.length ? post[0] : b;
    const pa = project(start), pb = project(end);
    const mid = shortest(pa, pb);
    const pts = [a, ...pre, ...mid, ...post, b];
    // dubbele punten weghalen
    return pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) > 0.5);
  }

  // beweeg een object (met .path, .seg, .pos) een afstand langs zijn route; true als aangekomen
  function moveAlong(o, dist) {
    if (!o.pos) o.pos = { x: o.path[0].x, y: o.path[0].y, angle: 0 };
    if (o.seg == null) o.seg = 0;
    while (dist > 0 && o.seg < o.path.length - 1) {
      const t = o.path[o.seg + 1];
      const dx = t.x - o.pos.x, dy = t.y - o.pos.y, d = Math.hypot(dx, dy);
      if (d > 0.01) o.pos.angle = Math.atan2(dy, dx);
      if (d <= dist) { o.pos.x = t.x; o.pos.y = t.y; dist -= d; o.seg++; }
      else { o.pos.x += dx / d * dist; o.pos.y += dy / d * dist; dist = 0; }
    }
    return o.seg >= o.path.length - 1;
  }

  // ---------- leveren met de vrachtwagen ----------
  // Een werknemer haalt de vrachtwagen, laadt bij het laadperron wat het meest waard is,
  // rijdt naar het verkooppunt dat er het meest voor betaalt en komt terug.
  const dockPoint = () => ({ x: D.dock.x + D.dock.w / 2, y: D.dock.y + D.dock.h + 10 });
  const pitPoint = sp => { const pit = D.sellPoints[sp].pit; return { x: pit.x + pit.w / 2, y: pit.y + pit.h / 2 }; };
  const pathBetween = (a, b) => inYard(a) && inYard(b) ? [{ x: a.x, y: a.y }, { x: b.x, y: b.y }] : route(a, b);
  const pathLen = path => path.reduce((sum, p, i) => i ? sum + Math.hypot(p.x - path[i - 1].x, p.y - path[i - 1].y) : 0, 0);

  function loadTruck(cap) {
    const s = S(), cargo = {};
    let room = cap;
    const keys = Object.keys(D.products).filter(k => D.products[k].perPallet && s.goods[k] > 0.01)
      .sort((a, b) => G().price(b) * D.products[b].perPallet - G().price(a) * D.products[a].perPallet);
    for (const k of keys) {
      if (room <= 0.001) break;
      const amt = Math.min(s.goods[k], room * D.products[k].perPallet);
      s.goods[k] -= amt; cargo[k] = amt; room -= amt / D.products[k].perPallet;
    }
    return cargo;
  }
  function cargoValue(sp, cargo) {
    return Object.entries(cargo).reduce((v, [k, amt]) => v + (G().accepts(sp, k) ? amt * G().price(k, sp) : 0), 0);
  }
  function bestSellPoint(cargo) {
    let best = null, bv = 0;
    for (const [id, sp] of Object.entries(D.sellPoints)) {
      if (!sp.pit) continue;
      const v = cargoValue(id, cargo);
      if (v > bv) { bv = v; best = id; }
    }
    return best;
  }

  function startDelivery(quiet = false) {
    ensure();
    const s = S(), fail = msg => { if (!quiet) G().log(msg, 'warn'); return msg; };
    const truck = s.machines.find(m => D.machines[m.type].kind === 'truck' && !m.busy);
    if (!s.machines.some(m => D.machines[m.type].kind === 'truck')) return fail('Je hebt geen vrachtwagen (Winkel).');
    if (!truck) return fail('De vrachtwagen is bezig.');
    if (G().palletsUsed() < 0.5) return fail('Er staat bijna niets in de opslagloods.');
    const worker = freeWorker();
    if (!worker) return fail('Geen vrije werknemer.');
    truck.busy = 'delivery';
    const home = { x: truck.x, y: truck.y, angle: truck.angle };
    const path = pathBetween(home, dockPoint());
    s.deliveries.push({ id: 'd' + Date.now().toString(36), truck: truck.uid, workerId: worker.id, workerName: worker.name, external: !!worker.external,
      phase: 'dock', home, path, pos: { x: home.x, y: home.y, angle: home.angle }, seg: 0, cargo: {}, sp: null, dist: pathLen(path) });
    if (!worker.external) worker.status = 'delivery';
    G().log(`${worker.name} haalt de vrachtwagen om producten te leveren.`);
    AT.emit('change');
    return true;
  }

  function updateDeliveries(dtSec) {
    const s = S();
    for (const d of [...(s.deliveries || [])]) {
      const truck = G().machine(d.truck);
      if (!truck) { s.deliveries = s.deliveries.filter(x => x !== d); continue; }
      const speed = D.machines[truck.type].speed * D.kmhToPx * Math.min(s.speed, 20);
      if (!moveAlong(d, speed * dtSec)) continue;
      if (d.phase === 'dock') {
        d.cargo = loadTruck(D.machines[truck.type].pallets);
        d.sp = bestSellPoint(d.cargo);
        const from = dockPoint();
        d.path = d.sp ? route(from, pitPoint(d.sp)) : pathBetween(from, d.home);
        d.phase = d.sp ? 'sell' : 'home'; d.seg = 0; d.dist += pathLen(d.path);
        if (!d.sp) G().log(`${d.workerName}: niets in de loods dat een verkooppunt koopt.`, 'warn');
      } else if (d.phase === 'sell') {
        let money = 0;
        for (const [k, amt] of Object.entries(d.cargo)) {
          if (amt < 0.01 || !G().accepts(d.sp, k)) continue;
          money += G().sellAt(d.sp, k, amt).money;
          d.cargo[k] = 0;
        }
        s.stats.truckDeliveries++;
        G().log(`${d.workerName} heeft geleverd bij ${D.sellPoints[d.sp].name.toLowerCase()}: ${AT.fmtMoney(money)}.`, 'money');
        d.path = route(pitPoint(d.sp), d.home); d.seg = 0; d.phase = 'home'; d.dist += pathLen(d.path);
      } else {
        // terug: wat niet verkocht is gaat weer de loods in, brandstof en chauffeur betalen
        for (const [k, amt] of Object.entries(d.cargo)) if (amt > 0.01) G().addGood(k, amt);
        const fuel = d.dist / 1000 * 0.36 * D.fuelPrice;
        G().spend(fuel, 'brandstof');
        if (d.external) G().spend(D.truckDriverFee, 'loonwerk');
        Object.assign(truck, { busy: null, x: d.home.x, y: d.home.y, angle: d.home.angle });
        const w = employee(d.workerId);
        if (w) { w.status = 'idle'; w.xp++; }
        s.deliveries = s.deliveries.filter(x => x !== d);
        AT.emit('change');
      }
    }
  }
  function autoDeliver() {
    const s = S();
    if (!s.autoDeliver || (s.deliveries || []).length) return;
    if (G().palletsUsed() > G().warehouseCapacity() * 0.5) startDelivery(true);
  }

  // ---------- chauffeur: tractor + kipper rijdt naast een maaidorser ----------
  // Bij jou (K) of automatisch bij een werknemer die oogst. De maaidorser lost tijdens het rijden.
  // Is de kipper vol, dan rijdt de chauffeur naar de silo, lost en komt terug.
  const kindOf = m => D.machines[m.type].kind;
  // vrije tractor + kipper (eventueel losse kipper koppelen aan een vrije tractor)
  function freeCart() {
    const s = S();
    let tr = s.machines.find(m => kindOf(m) === 'tractor' && !m.busy && !m.broken && m.impl && kindOf(G().machine(m.impl)) === 'trailer' && !G().machine(m.impl).busy);
    if (tr) return { tr, trailer: G().machine(tr.impl) };
    for (const tl of s.machines.filter(m => kindOf(m) === 'trailer' && !m.busy && !m.attached)) {
      tr = s.machines.find(m => kindOf(m) === 'tractor' && !m.busy && !m.broken && !m.impl && D.machines[m.type].power >= D.machines[tl.type].minPower);
      if (tr) return { tr, trailer: tl, attach: true };
    }
    return null;
  }
  function startChaser(harvesterUid, worker, forJob = null) {
    const s = S(), cart = freeCart();
    if (!cart) return null;
    const { tr, trailer } = cart;
    if (cart.attach) { tr.impl = trailer.uid; trailer.attached = tr.uid; }
    tr.busy = 'chaser'; trailer.busy = 'chaser';
    const home = { x: tr.x, y: tr.y, angle: tr.angle };
    const c = { id: 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), tractor: tr.uid, trailer: trailer.uid, harvester: harvesterUid,
      workerId: worker.id, workerName: worker.name, external: !!worker.external, forJob, home, phase: 'come', pos: { ...home }, seg: 0, dist: 0, dismiss: false };
    c.path = route(home, chaserTarget(c));
    s.chasers.push(c);
    if (!worker.external) worker.status = 'chaser';
    return c;
  }
  const playerChaser = () => { const p = S().player; return (S().chasers || []).find(c => !c.forJob && c.harvester === p.vehicle); };
  function toggleChaser() {
    ensure();
    const s = S(), r = AT.vehicle.rig(), mine = playerChaser();
    if (mine) {
      mine.dismiss = true;
      if (mine.phase === 'follow' || mine.phase === 'come') goDeliver(mine);
      G().log(`${mine.workerName} brengt de kipper terug${G().getLoad(G().machine(mine.trailer)).tons > 0.01 ? ' en lost eerst in de silo' : ''}.`);
      return true;
    }
    if (!r || r.mainDef.kind !== 'harvester') return 'Stap eerst in een maaidorser, dan kun je een chauffeur met kipper roepen.';
    if (!freeCart()) return 'Geen vrije tractor met kipper (of losse kipper + vrije tractor).';
    const worker = freeWorker();
    if (!worker) return 'Geen vrije werknemer voor de chauffeursrol (' + whyNoWorker() + ').';
    const c = startChaser(r.main.uid, worker);
    G().log(`${worker.name} komt met de ${D.machines[G().machine(c.tractor).type].name} en ${D.machines[G().machine(c.trailer).type].name} naast je rijden. De maaidorser lost tijdens het rijden.`, 'good');
    AT.emit('change');
    return true;
  }
  // chauffeur voor een werknemer die gaat oogsten (als er een vrije kipper en werknemer is)
  function jobChaser(fieldId, harvesterUid) {
    const s = S();
    if (!s.staff.carter || !freeCart()) return null;
    const worker = freeWorker();
    if (!worker) return null;
    const c = startChaser(harvesterUid, worker, fieldId);
    if (c) G().log(`${worker.name} rijdt met de kipper mee naast de maaidorser op Veld ${fieldId}.`);
    return c;
  }
  // positie van de maaidorser: jij rijdt, een werknemer oogst (job), of hij staat stil
  function harvesterPose(c) {
    const h = G().machine(c.harvester), p = S().player;
    if (!h) return null;
    if (p.mode === 'drive' && p.vehicle === c.harvester) return { x: p.x, y: p.y, angle: p.angle };
    if (typeof h.busy === 'number') {
      const f = G().field(h.busy);
      if (f && f.job) return G().jobPose(G().fieldDef(f.id), f.job);
    }
    return { x: h.x, y: h.y, angle: h.angle };
  }
  // waar de tractor moet rijden: kipper precies onder de losbuis (links van de maaidorser)
  function chaserTarget(c) {
    const hp = harvesterPose(c) || c.pos;
    const { x, y, angle: a } = hp;
    const L = D.machines[G().machine(c.trailer).type].length;
    const ax = x + Math.cos(a) * -2 - Math.sin(a) * -26, ay = y + Math.sin(a) * -2 + Math.cos(a) * -26;
    const back = 12.5 + 3 + L / 2;
    return { x: ax + Math.cos(a) * back, y: ay + Math.sin(a) * back, angle: a, ax, ay };
  }
  const pitPoint2 = () => ({ x: D.siloPit.x + D.siloPit.w / 2, y: D.siloPit.y + D.siloPit.h + 30 });
  function goDeliver(c) { c.phase = 'deliver'; c.path = route(c.pos, pitPoint2()); c.seg = 0; }
  // graan in de silo; past het niet, dan naar de graanhandel
  function depositGrain(load, who) {
    const s = S();
    if (!load || load.tons < 0.01 || !load.crop) return;
    const room = G().siloRoom(), toSilo = Math.min(load.tons, room);
    if (toSilo > 0) { s.silo[load.crop] += toSilo; s.stats.deliveredTons += toSilo; }
    const rest = load.tons - toSilo;
    if (rest > 0.01) { const r = G().sellAt('trader', load.crop, rest); G().log(`Silo vol: ${who} verkocht ${AT.fmtTons(rest)} aan de graanhandel (${AT.fmtMoney(r.money)}).`, 'money'); }
    if (toSilo > 0.01) G().log(`${who} heeft ${AT.fmtTons(toSilo)} ${G().goodName(load.crop)} in de silo gelost.`, 'good');
    load.tons = 0; load.crop = null;
  }

  function updateChaser(c, dtSec) {
    const s = S();
    const tr = G().machine(c.tractor), tl = G().machine(c.trailer), h = G().machine(c.harvester);
    if (!tr || !tl) { s.chasers = s.chasers.filter(x => x !== c); return; }
    // de klus waarvoor hij meereed is klaar
    if (c.forJob && !c.dismiss && (!h || h.busy !== c.forJob)) { c.dismiss = true; if (c.phase !== 'deliver' && c.phase !== 'home') goDeliver(c); }
    const speed = D.machines[tr.type].speed * D.kmhToPx * Math.min(s.speed, 20);
    const T = G().getLoad(tl), cap = G().loadCap(tl);
    if (c.phase === 'come') {
      if (!h) { c.dismiss = true; goDeliver(c); }
      else {
        const tg = chaserTarget(c);
        if (moveAlong(c, speed * dtSec) || Math.hypot(c.pos.x - tg.x, c.pos.y - tg.y) < 30) c.phase = 'follow';
      }
    } else if (c.phase === 'follow') {
      const tg = chaserTarget(c), dx = tg.x - c.pos.x, dy = tg.y - c.pos.y, d = Math.hypot(dx, dy);
      if (d > 160) { c.phase = 'come'; c.path = route(c.pos, tg); c.seg = 0; }
      else {
        const step = Math.min(d, speed * 1.3 * dtSec + d * Math.min(1, dtSec * 2));
        if (d > 0.01) { c.pos.x += dx / d * step; c.pos.y += dy / d * step; }
        let da = tg.angle - c.pos.angle; da = Math.atan2(Math.sin(da), Math.cos(da));
        c.pos.angle += da * Math.min(1, dtSec * 4);
        // overladen tijdens het rijden
        const L = G().getLoad(h);
        if (d < 8 && L.tons > 0.01 && (!T.crop || T.tons < 0.001 || T.crop === L.crop) && T.tons < cap - 0.01) {
          const amt = Math.min(L.tons, cap - T.tons, D.unloadRate.harvester * dtSec * Math.min(s.speed, 20));
          const crop = L.crop;
          L.tons -= amt; if (L.tons < 0.001) { L.tons = 0; L.crop = null; }
          T.crop = crop; T.tons += amt;
          s.stats.chaserTons = (s.stats.chaserTons || 0) + amt;
          c.overloading = true;
          if (AT.fx) AT.fx.stream({ x: tg.ax, y: tg.ay }, G().trailerPose(tl).center, G().goodColor(T.crop), dtSec);
        } else c.overloading = false;
        if (T.tons >= cap * 0.95) { G().log(`${c.workerName}: kipper vol (${AT.fmtTons(T.tons)}), ik breng hem naar de silo.`); goDeliver(c); }
      }
    } else if (c.phase === 'deliver') {
      if (moveAlong(c, speed * dtSec)) {
        depositGrain(T, c.workerName);
        if (c.dismiss || !h) { c.phase = 'home'; c.path = route(c.pos, c.home); }
        else { c.phase = 'come'; c.path = route(c.pos, chaserTarget(c)); }
        c.seg = 0;
      }
    } else if (c.phase === 'home') {
      if (moveAlong(c, speed * dtSec)) {
        Object.assign(tr, { busy: null, x: c.home.x, y: c.home.y, angle: c.home.angle });
        tl.busy = null;
        G().spend(c.dist / 1000 * 0.4 * D.fuelPrice + (c.external ? 120 : 0), c.external ? 'loonwerk' : 'brandstof');
        const w = employee(c.workerId);
        if (w) { w.status = 'idle'; w.xp++; }
        s.chasers = s.chasers.filter(x => x !== c);
        AT.emit('change');
        return;
      }
    }
    c.dist += speed * dtSec;
    Object.assign(tr, { x: c.pos.x, y: c.pos.y, angle: c.pos.angle });
  }
  const chaserFor = harvesterUid => (S().chasers || []).find(c => c.harvester === harvesterUid && !c.dismiss);

  // ---------- voerbak vullen: werknemer brengt voer met tractor + kipper ----------
  function feedChoice(key) {
    const d = D.animals[key];
    return d.feeds.find(k => (D.crops[k] || k === 'hay' || k === 'silage' || k === 'feedmix') && G().stock(k) > 0.05) || null;
  }
  function startFeedRun(key, quiet = false) {
    ensure();
    const s = S(), d = D.animals[key], a = AT.farm.animal(key);
    const fail = msg => { if (!quiet) G().log(msg, 'warn'); return msg; };
    if (!a.owned) return fail('Je hebt deze stal nog niet.');
    if (s.feedRuns.some(r => r.key === key)) return fail('Er is al iemand onderweg met voer.');
    const room = d.trough * D.barnLevels[a.level] - AT.farm.troughTons(key);
    if (room < 0.2) return fail('De voerbak zit al (bijna) vol.');
    const feed = feedChoice(key);
    if (!feed) return fail(`Geen voer op voorraad voor de ${d.name.toLowerCase()}.`);
    if (!freeCart()) return fail('Geen vrije tractor met kipper.');
    const worker = freeWorker();
    if (!worker) return fail('Geen vrije werknemer (' + whyNoWorker() + ').');
    const { tr, trailer, attach } = freeCart();
    if (attach) { tr.impl = trailer.uid; trailer.attached = tr.uid; }
    tr.busy = 'feed'; trailer.busy = 'feed';
    const home = { x: tr.x, y: tr.y, angle: tr.angle };
    const loadPt = D.crops[feed] ? pitPoint2() : { x: D.dock.x + D.dock.w / 2, y: D.dock.y + D.dock.h + 12 };
    const run = { id: 'f' + Date.now().toString(36), key, feed, tractor: tr.uid, trailer: trailer.uid, workerId: worker.id, workerName: worker.name, external: !!worker.external,
      home, phase: 'load', pos: { ...home }, seg: 0, dist: 0, path: inYard(home) && inYard(loadPt) ? [home, loadPt] : route(home, loadPt) };
    s.feedRuns.push(run);
    if (!worker.external) worker.status = 'feed';
    if (!quiet) G().log(`${worker.name} haalt ${G().goodName(feed)} voor de ${d.building.toLowerCase()}.`);
    AT.emit('change');
    return true;
  }
  function troughPoint(key) {
    const t = AT.farm.troughRect(key);
    return { x: t.x + t.w / 2, y: t.y + t.h / 2 + 30 };
  }
  function updateFeedRun(run, dtSec) {
    const s = S(), tr = G().machine(run.tractor), tl = G().machine(run.trailer);
    if (!tr || !tl) { s.feedRuns = s.feedRuns.filter(x => x !== run); return; }
    const speed = D.machines[tr.type].speed * D.kmhToPx * Math.min(s.speed, 20) * 0.8;
    if (moveAlong(run, speed * dtSec)) {
      const d = D.animals[run.key], a = AT.farm.animal(run.key), L = G().getLoad(tl);
      if (run.phase === 'load') {
        const room = d.trough * D.barnLevels[a.level] - AT.farm.troughTons(run.key);
        const amt = Math.min(G().loadCap(tl), room, G().stock(run.feed));
        G().take(run.feed, amt);
        L.crop = run.feed; L.tons = amt;
        const gate = AT.farm.penGate(run.key), pen = d.pen;
        const from = { x: run.pos.x, y: run.pos.y }, gatePt = { x: (gate.x0 + gate.x1) / 2, y: pen.y - 14 };
        run.path = [...(inYard(from) ? [from, ...route(from, gatePt).slice(1)] : route(from, gatePt)), troughPoint(run.key)];
        run.seg = 0; run.phase = 'deliver';
      } else if (run.phase === 'deliver') {
        const put = AT.farm.fillTrough(run.key, L.crop, L.tons);
        if (put > 0.01) G().log(`${run.workerName} heeft ${AT.fmtTons(put)} ${G().goodName(L.crop)} in de voerbak van de ${d.building.toLowerCase()} gedaan.`, 'good');
        L.tons -= put; if (L.tons < 0.01) { L.tons = 0; L.crop = null; }
        const gate = AT.farm.penGate(run.key);
        run.path = [{ x: run.pos.x, y: run.pos.y }, { x: (gate.x0 + gate.x1) / 2, y: d.pen.y - 14 }, ...route({ x: (gate.x0 + gate.x1) / 2, y: d.pen.y - 14 }, run.home).slice(1)];
        run.seg = 0; run.phase = 'home';
      } else {
        // wat over is gaat terug in de voorraad
        if (L.tons > 0.01 && L.crop) { if (D.crops[L.crop]) s.silo[L.crop] += L.tons; else G().addGood(L.crop, L.tons); L.tons = 0; L.crop = null; }
        Object.assign(tr, { busy: null, x: run.home.x, y: run.home.y, angle: run.home.angle });
        tl.busy = null;
        G().spend(run.dist / 1000 * 0.4 * D.fuelPrice + (run.external ? 80 : 0), run.external ? 'loonwerk' : 'brandstof');
        const w = employee(run.workerId);
        if (w) { w.status = 'idle'; w.xp++; }
        s.feedRuns = s.feedRuns.filter(x => x !== run);
        AT.emit('change');
        return;
      }
    }
    run.dist += speed * dtSec;
    Object.assign(tr, { x: run.pos.x, y: run.pos.y, angle: run.pos.angle });
  }
  // stallen met "werknemer vult de voerbak": bijvullen als hij onder de 35% komt
  function autoFeedRuns() {
    const s = S();
    for (const key of Object.keys(D.animals)) {
      const a = s.animals[key];
      if (!a || !a.owned || !a.workerFeed || !a.count) continue;
      const cap = D.animals[key].trough * D.barnLevels[a.level || 0];
      if (AT.farm.troughTons(key) < cap * 0.35 && !s.feedRuns.some(r => r.key === key)) startFeedRun(key, true);
    }
  }

  // ---------- elke frame ----------
  let queueTimer = 0, autoTimer = 0;
  function update(dtSec) {
    ensure();
    queueTimer += dtSec; autoTimer += dtSec;
    if (autoTimer > 1) { autoTimer = 0; autoStep(); autoDeliver(); autoFeedRuns(); }
    updateDeliveries(dtSec);
    for (const c of [...S().chasers]) updateChaser(c, dtSec);
    for (const r of [...S().feedRuns]) updateFeedRun(r, dtSec);
    const s = S();
    if (!s.paused) updateEnergy(dtSec * D.hoursPerSecond * s.speed * ((s.settings && s.settings.timeScale) || 1));
    if (queueTimer > 0.4) { queueTimer = 0; processQueue(); }
  }

  AT.staff = {
    ensure, update, hire, fire, refreshCandidates, enqueue, removeTask, moveTask, setAuto, rotationCrop,
    workerById, freeWorker, level, workSpeed, payday, route, moveAlong, TASK_LABEL, startDelivery, toggleChaser, jobChaser, chaserFor, depositGrain, startFeedRun, offDuty, dayName, whyNoWorker, playerChaser,
  };
})();
