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
    return { id: 'w' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), name: `${pickOne(FIRST)} ${pickOne(LAST)}`, speed, fuel, salary, xp: 0, status: 'idle', fieldId: null };
  }

  function ensure() {
    const s = S();
    if (!s.staff) s.staff = { employees: [], candidates: [], candidatesDay: 0, allowExternal: true };
    if (!s.queue) s.queue = [];
    if (!s.trips) s.trips = [];
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
  const workSpeed = w => w.external ? 1 : w.speed * (1 + (level(w) - 1) * 0.05);

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
    const free = S().staff.employees.filter(w => w.status === 'idle');
    if (free.length) return free.sort((a, b) => workSpeed(b) - workSpeed(a))[0];
    return S().staff.allowExternal ? EXTERNAL : null;
  }

  function payday() {
    const s = S(), total = s.staff.employees.reduce((a, w) => a + w.salary, 0);
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
    const rig = G().bestRig(t.task, t.fieldId, t.crop);
    if (!rig) return { wait: G().missingFor(t.task, t.fieldId, t.crop) };
    const worker = freeWorker();
    if (!worker) return { wait: 'wacht op een vrije werknemer' };
    return { ok: true, worker };
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
      if (sum.ready > half * 0.2 && readyCrop && !D.crops[readyCrop].greenManure && !sum.growing) enqueue(f.id, 'harvest', null, true);
      else if (sum.ready && readyCrop && D.crops[readyCrop].greenManure && !sum.growing) enqueue(f.id, 'plow', null, true);
      else if (sum.stubble > half) enqueue(f.id, 'plow', null, true);
      else if (sum.plowed > half) {
        const hasSpreader = s.machines.some(m => D.machines[m.type].kind === 'spreader');
        const crop = f.auto.crop === 'rotate' ? rotationCrop(f) : f.auto.crop;
        if (f.auto.fert && hasSpreader && sum.needFert > half) enqueue(f.id, 'fertilize', null, true);
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

  // ---------- elke frame ----------
  let queueTimer = 0, autoTimer = 0;
  function update(dtSec) {
    ensure();
    queueTimer += dtSec; autoTimer += dtSec;
    if (autoTimer > 1) { autoTimer = 0; autoStep(); }
    if (queueTimer > 0.4) { queueTimer = 0; processQueue(); }
  }

  AT.staff = {
    ensure, update, hire, fire, refreshCandidates, enqueue, removeTask, moveTask, setAuto, rotationCrop,
    workerById, freeWorker, level, workSpeed, payday, route, moveAlong, TASK_LABEL,
  };
})();
