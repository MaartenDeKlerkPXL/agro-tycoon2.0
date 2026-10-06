// Agro Tycoon 2.0 — speler: lopen als boer, zelf rijden met tractor of maaidorser
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const keys = new Set();
  AT.input = { keys, moved: 0 };

  const OP = { plow: 'plow', seeder: 'sow', harvester: 'harvest', spreader: 'fertilize', manure: 'manure', mower: 'mow', tedder: 'ted', baler: 'bale', lime: 'lime', sprayer: 'spray', cultivator: 'plow', roller: 'roll', stonepicker: 'stones' };
  const PX = D.kmhToPx;            // km/u -> pixels per seconde
  const KMH = 1 / D.kmhToPx;       // pixels per seconde -> km/u (snelheidsmeter)

  const pressed = (...codes) => codes.some(c => keys.has(c));
  const held = action => pressed(...AT.keys.codes(action));   // ingestelde toets (+ pijltjes)
  const K = (e, action) => AT.keys.is(e, action);
  const kn = action => AT.keys.name(action);
  const G = () => AT.game;

  // huidige machine-combinatie als je rijdt
  function rig() {
    const p = AT.state.player;
    if (p.mode !== 'drive') return null;
    const main = G().machine(p.vehicle);
    if (!main) return null;
    const impl = main.impl ? G().machine(main.impl) : null;
    const mainDef = D.machines[main.type];
    const toolDef = mainDef.kind === 'harvester' || mainDef.kind === 'fruitharvester' ? mainDef : impl ? D.machines[impl.type] : null;
    return { main, impl, mainDef, toolDef };
  }

  let warnText = '', warnTime = 0;
  function warn(text) {
    if (text !== warnText || warnTime < 1) AT.emit('sfx', 'warn');
    warnText = text; warnTime = 2.5;
  }

  function update(dt, dtHours) {
    const p = AT.state.player;
    if (p.mode === 'foot') updateFoot(p, dt);
    else updateDrive(p, dt, dtHours);
    if (warnTime > 0) warnTime -= dt;
  }

  // ---------- botsen met gebouwen, hekken en bomen ----------
  let obst = null, obstAge = 99;
  AT.on('change', () => { obstAge = 99; });
  AT.on('built', () => { obstAge = 99; obst = null; });
  function buildObstacles() {
    const s = AT.state, rects = [], circles = [], Y = D.yard, t = 2;
    // hek rond het erf, met de poort open
    rects.push({ x: Y.x - 1, y: Y.y - 1, w: Y.w + 2, h: t }, { x: Y.x - 1, y: Y.y + Y.h - 1, w: Y.w + 2, h: t }, { x: Y.x - 1, y: Y.y - 1, w: t, h: Y.h + 2 },
      { x: Y.x + Y.w - 1, y: Y.y - 1, w: t, h: Y.gate.y - Y.y + 1 }, { x: Y.x + Y.w - 1, y: Y.gate.y + Y.gate.h, w: t, h: Y.y + Y.h - Y.gate.y - Y.gate.h + 1 });
    rects.push(D.house, D.hall);
    const S = D.silos;
    for (let i = 0; i <= s.siloLevel; i++) circles.push({ x: S.x + (i % S.perRow) * S.dx, y: S.y + Math.floor(i / S.perRow) * S.dy, r: S.r });
    circles.push({ x: D.fuelPump.x, y: D.fuelPump.y, r: 3 });
    for (const b of s.buildings || []) {
      const d = D.buildables[b.type];
      if (b.type === 'silo') circles.push({ x: b.x + d.w / 2, y: b.y + d.h / 2, r: d.w / 2 });
      else rects.push({ x: b.x, y: b.y, w: d.w, h: d.h });
      if (b.type === 'shed') circles.push({ x: b.x + d.w + 8, y: b.y + d.h / 2, r: 3 });
    }
    // weides: hek met een poort bovenaan
    for (const [key, a] of Object.entries(D.animals)) {
      const P = a.pen, g = AT.farm.penGate(key);
      rects.push({ x: P.x - 1, y: P.y - 1, w: g.x0 - P.x + 1, h: t }, { x: g.x1, y: P.y - 1, w: P.x + P.w - g.x1 + 1, h: t },
        { x: P.x - 1, y: P.y + P.h - 1, w: P.w + 2, h: t }, { x: P.x - 1, y: P.y - 1, w: t, h: P.h + 2 }, { x: P.x + P.w - 1, y: P.y - 1, w: t, h: P.h + 2 });
      if (s.animals[key].owned) rects.push(a.barn);
    }
    for (const [key, d] of Object.entries(D.factories)) {
      if (!s.factories[key].owned) continue;
      const r = d.lot;
      rects.push({ x: r.x + 10, y: r.y + 10, w: r.w * 0.58, h: r.h - 20 });
    }
    AT.farm.greenhouses().forEach((gh, i) => { if (gh.owned) { const l = D.greenhouse.lots[i]; rects.push({ x: l.x + 6, y: l.y + 6, w: l.w - 12, h: l.h - 12 }); } });
    // bomen: alleen de stam
    for (const tr of (AT.render && AT.render.trees ? AT.render.trees() : [])) circles.push({ x: tr.x, y: tr.y, r: Math.max(2, tr.R * 0.28) });
    for (const tr of AT.farm.woodlot().trees) if (tr.growth > 0.4) circles.push({ x: tr.x, y: tr.y, r: 2.5 });
    for (const key of Object.keys(D.plantations)) if (key === 'orchard') for (const pl of AT.farm.plantation(key).plants) circles.push({ x: pl.x, y: pl.y, r: 2.2 });
    // raster zodat we alleen obstakels in de buurt testen
    const grid = new Map(), C = 64;
    const add = (o, x0, y0, x1, y1) => {
      for (let gx = Math.floor(x0 / C); gx <= Math.floor(x1 / C); gx++) for (let gy = Math.floor(y0 / C); gy <= Math.floor(y1 / C); gy++) {
        const k = gx * 1000 + gy; if (!grid.has(k)) grid.set(k, []); grid.get(k).push(o);
      }
    };
    for (const r of rects) add({ rect: r }, r.x, r.y, r.x + r.w, r.y + r.h);
    for (const c of circles) add({ circle: c }, c.x - c.r, c.y - c.r, c.x + c.r, c.y + c.r);
    return grid;
  }
  function blocked(x, y, rad) {
    if (!obst || obstAge > 3) { obst = buildObstacles(); obstAge = 0; }
    const list = obst.get(Math.floor(x / 64) * 1000 + Math.floor(y / 64)) || [];
    for (const o of list) {
      if (o.rect) {
        const r = o.rect, cx = Math.max(r.x, Math.min(x, r.x + r.w)), cy = Math.max(r.y, Math.min(y, r.y + r.h));
        if ((x - cx) ** 2 + (y - cy) ** 2 < rad * rad) return true;
      } else if ((x - o.circle.x) ** 2 + (y - o.circle.y) ** 2 < (rad + o.circle.r) ** 2) return true;
    }
    return false;
  }
  // probeer te bewegen; glij langs obstakels; geeft false als je vast zit
  let bumpT = 0;
  function tryMove(p, nx, ny, rad) {
    nx = Math.max(8, Math.min(D.world.w - 8, nx)); ny = Math.max(8, Math.min(D.world.h - 8, ny));
    if (!blocked(nx, ny, rad) || blocked(p.x, p.y, rad)) { p.x = nx; p.y = ny; return true; }
    if (!blocked(nx, p.y, rad)) { p.x = nx; return false; }
    if (!blocked(p.x, ny, rad)) { p.y = ny; return false; }
    if (bumpT <= 0) { AT.emit('sfx', 'hitch'); bumpT = 0.6; }
    return false;
  }
  const RADIUS = { tractor: 6, harvester: 9, truck: 7 };

  // ondergrond: weg/erf, akker of gras
  function surface(x, y) {
    if (D.roads.some(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)) return 'road';
    const Y = D.yard;
    if (x >= Y.x && x <= Y.x + Y.w && y >= Y.y && y <= Y.y + Y.h) return 'road';
    if (D.fields.some(f => x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h)) return 'field';
    return 'grass';
  }

  // ---------- lopen ----------
  function updateFoot(p, dt) {
    let dx = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
    let dy = (held('down') ? 1 : 0) - (held('up') ? 1 : 0);
    const len = Math.hypot(dx, dy);
    if (len) {
      const sp = (held('sprint') ? D.runSpeed : D.walkSpeed) * PX;
      tryMove(p, p.x + dx / len * sp * dt, p.y + dy / len * sp * dt, 2.5);
      p.angle = Math.atan2(dy, dx);
      p.speed = sp;
      p.walk = (p.walk || 0) + sp * dt;
      AT.input.moved = 1;
    } else p.speed = 0;
  }

  // ---------- rijden ----------
  function updateDrive(p, dt, dtHours) {
    const r = rig();
    if (!r) { p.mode = 'foot'; return; }

    const working = p.lowered && r.toolDef && r.toolDef.kind !== 'trailer' && r.toolDef.kind !== 'mixer';
    // een volle aanhanger maakt je trager
    const src = loadSource(r);
    const heavy = src && r.mainDef.kind === 'tractor' ? 1 - 0.25 * (src.load.tons / src.cap) : 1;
    // Shift = een stukje sneller (25%)
    const boost = held('sprint') ? D.shiftBoost : 1;
    // ondergrond: niet-werkend over akkers en gras gaat langzamer (rupsen hebben er minder last van)
    const surf = surface(p.x, p.y), tracks = !!r.mainDef.tracks;
    let ground = D.surfaceSpeed[surf];
    if (tracks) ground = 1 - (1 - ground) * 0.4;
    if (r.mainDef.kind === 'truck' && surf !== 'road') ground *= 0.75;
    const fuelLeft = G().fuelOf(r.main);
    const dead = fuelLeft <= 0 || r.main.broken;
    const maxSpeed = dead ? 0 : (working ? r.toolDef.workSpeed : r.mainDef.speed * ground) * PX * heavy * boost * G().wearSpeed(r.main);
    const throttle = (held('up') ? 1 : 0) - (held('down') ? 1 : 0);
    const steerIn = (held('right') ? 1 : 0) - (held('left') ? 1 : 0);
    if (throttle || steerIn) AT.input.moved = 1;

    // gas/rem: zware machines trekken rustig op
    const accel = 9;
    if (throttle !== 0) {
      const braking = Math.sign(throttle) !== Math.sign(p.speed) && Math.abs(p.speed) > 1;
      p.speed += throttle * accel * (braking ? 2.2 : 1) * dt;
    } else {
      const drag = 14 * dt;
      p.speed = Math.abs(p.speed) <= drag ? 0 : p.speed - Math.sign(p.speed) * drag;
    }
    // boven de topsnelheid (bijv. Shift losgelaten) rustig afremmen in plaats van abrupt
    if (p.speed > maxSpeed) p.speed = Math.max(maxSpeed, p.speed - 20 * dt);
    p.speed = Math.max(-maxSpeed * 0.4, p.speed);
    p.throttle = throttle;

    // sturen (wielen draaien zichtbaar mee)
    p.steer = (p.steer || 0) + (steerIn * 0.45 - (p.steer || 0)) * Math.min(1, dt * 8);
    const turnRate = r.mainDef.kind === 'harvester' ? 1.6 : 2.0;
    p.angle += steerIn * turnRate * dt * Math.max(-1, Math.min(1, p.speed / (8 * PX)));
    // GPS: zonder stuurinput trekt hij zelf recht op de dichtstbijzijnde rijrichting
    if (p.autosteer && !steerIn && Math.abs(p.speed) > 0.5) {
      const target = Math.round(p.angle / (Math.PI / 2)) * (Math.PI / 2);
      p.angle += (target - p.angle) * Math.min(1, dt * 3);
    }

    // kopakker-automaat: GPS aan + werktuig omlaag = aan het eind van het veld zelf keren naar de volgende baan
    if (p.autosteer && !p.headland) startHeadland(p, r);
    if (p.headland && steerIn) { p.lowered = p.headland.wasLowered; p.headland = null; }   // zelf sturen = automaat uit
    const step = p.speed * dt;
    if (p.headland) driveHeadland(p, dt);
    else {
      const free = tryMove(p, p.x + Math.cos(p.angle) * step, p.y + Math.sin(p.angle) * step, RADIUS[r.mainDef.kind] || 6);
      if (!free && Math.abs(p.speed) > 3) p.speed *= 0.5;
    }
    if (bumpT > 0) bumpT -= dt;
    p.dist = (p.dist || 0) + step;

    // machine staat waar jij rijdt
    Object.assign(r.main, { x: p.x, y: p.y, angle: p.angle });

    // diesel en slijtage
    if (Math.abs(p.speed) > 1) {
      r.main.fuel = Math.max(0, fuelLeft - r.mainDef.fuelPerHour * dtHours * G().wearFuel(r.main) * (working ? 1.2 : 1));
      G().addWear(r.main, dtHours);
      if (working && r.impl) G().addWear(r.impl, dtHours);
      if ((r.main.wear || 0) > 0.9 && !r.main.broken && Math.random() < 0.25 * dtHours) {
        r.main.broken = true;
        G().log(`${r.mainDef.name} is kapot! Laat hem repareren in de Garage (een monteur komt ook naar je toe).`, 'warn');
        AT.emit('change');
      }
      const cap = G().fuelCap(r.main);
      if (cap && r.main.fuel < cap * 0.1 && !r.main.lowWarned) { r.main.lowWarned = true; G().log(`Bijna geen diesel meer in de ${r.mainDef.name}! Tank bij de dieselpomp op het erf (T).`, 'warn'); }
      if (cap && r.main.fuel > cap * 0.2) r.main.lowWarned = false;
    }
    if (dead && throttle) warn(r.main.broken ? 'Deze machine is kapot. Laat hem repareren in de Garage.' : 'De tank is leeg! Bel de tankservice in de Garage of loop naar de dieselpomp.');
    if (working && p.speed > 3) {
      workUnderTool(p, r);
      const hr = G().hour();
      if (r.mainDef.kind === 'harvester' && (hr < 4 || hr >= 23)) AT.state.stats.nightHarvest = true;
    }
    if (Math.abs(p.speed) > 3 && (AT.state.snow || 0) > 0.6) AT.state.stats.snowDrive = true;
    if (Math.abs(p.speed) > 0.5) pickupBales(r);
    // rijden over natte akkers verdicht de grond (onder de machine en de aanhanger/het werktuig)
    if (Math.abs(p.speed) > 1 && r.mainDef.kind !== 'truck') {
      if (!r.mainDef.tracks) G().compactAt(p.x, p.y);
      if (r.impl && !r.mainDef.tracks) { const h = G().hitchPoint(r.main); G().compactAt(h.x - Math.cos(p.angle) * 6, h.y - Math.sin(p.angle) * 6); }
    }
    if (p.unloading) unload(p, r, dt);
  }

  // ---------- voermengwagen: ruwvoer + graan + eiwit = mengvoer ----------
  function mixFeed(m) {
    const cap = G().loadCap(m), s = AT.state;
    const parts = [[['silage', 'hay'], 0.5], [['corn', 'barley', 'wheat', 'oats'], 0.3], [['soy', 'beans'], 0.2]];
    const pick = keys => keys.slice().sort((a, b) => G().stock(b) - G().stock(a))[0];
    const plan = parts.map(([keys, share]) => { const k = pick(keys); return { k, want: cap * share, have: G().stock(k) }; });
    if (plan[0].have < 0.1 || plan[1].have < 0.1) { warn('Voor mengvoer heb je ruwvoer (kuilvoer of hooi) én graan nodig.'); return; }
    // wat ontbreekt aan eiwit vullen we aan met graan
    let total = 0; const used = [];
    plan.forEach((pl, i) => {
      let amt = Math.min(pl.want, pl.have);
      if (i === 1) amt = Math.min(pl.have, pl.want + Math.max(0, plan[2].want - plan[2].have));
      if (amt > 0.01) { G().take(pl.k, amt); total += amt; used.push(`${AT.fmtTons(amt)} ${G().goodName(pl.k)}`); }
    });
    m.load = { crop: 'feedmix', tons: total };
    AT.emit('sfx', 'hitch');
    G().log(`Voermengwagen gemengd: ${AT.fmtTons(total)} mengvoer (${used.join(', ')}). Breng het naar een voerbak (${kn('unload')}).`, 'good');
    AT.emit('change');
  }

  // ---------- fruit oogsten met een druivenoogster of boomschudder ----------
  let pickMsgT = 0, pickAcc = 0;
  function pickFruit(p, r) {
    const key = r.mainDef.harvests, d = D.plantations[key], pl = AT.farm.plantation(key);
    if (!pl.owned) { warn(`Koop eerst de ${d.name.toLowerCase()} (tab Bedrijf).`); return; }
    if (pl.phase !== 'ripe') { warn(`De ${d.name.toLowerCase()} is nog niet rijp (oogst in ${d.harvest.map(m => D.months[m].toLowerCase()).join(', ')}).`); return; }
    const half = r.mainDef.width / 2 + 3, fx = p.x + Math.cos(p.angle) * 10, fy = p.y + Math.sin(p.angle) * 10;
    for (const plant of pl.plants) {
      if (plant.picked || plant.fruit < 1 || Math.hypot(plant.x - fx, plant.y - fy) > half) continue;
      const got = AT.farm.pick(key, plant, false);
      if (!got) { warn('De opslagloods is vol.'); return; }
      pickAcc += got;
      if (AT.fx) AT.fx.stream({ x: plant.x, y: plant.y }, { x: p.x, y: p.y }, G().goodColor(d.product), 0.05);
    }
    pickMsgT += 1 / 60;
    if (pickAcc > 0 && pickMsgT > 4) { G().log(`${r.mainDef.name}: +${AT.fmtAmount(pickAcc, d.product)} ${G().goodName(d.product)}.`, 'good'); pickAcc = 0; pickMsgT = 0; }
  }

  // ---------- kopakker-automaat ----------
  const inside = (pt, f) => pt.x > f.x && pt.x < f.x + f.w && pt.y > f.y && pt.y < f.y + f.h;
  function startHeadland(p, r) {
    if (!r.toolDef || r.toolDef.kind === 'trailer' || !p.lowered || p.speed < 1) return;
    const f = D.fields.find(fd => inside(p, fd));
    if (!f) return;
    if (p.hlField !== f.id) { p.hlField = f.id; p.hlSide = 0; }
    const ax = Math.round(p.angle / (Math.PI / 2)) * (Math.PI / 2);
    const dx = Math.cos(ax), dy = Math.sin(ax), px = -dy, py = dx;   // px/py = rechts van de rijrichting
    if (inside({ x: p.x + dx * 10, y: p.y + dy * 10 }, f)) return;    // nog niet bij de kopakker
    const W = Math.max(8, r.toolDef.width || 16);
    const ok = side => inside({ x: p.x + px * side * W - dx * 6, y: p.y + py * side * W - dy * 6 }, f);
    let side = p.hlSide ? -p.hlSide : (ok(1) ? 1 : -1);
    if (!ok(side)) side = -side;
    if (!ok(side)) { warn('Einde van het veld: alle banen gedaan.'); return; }
    const cx = p.x + px * side * W / 2, cy = p.y + py * side * W / 2;
    p.headland = { cx, cy, r: W / 2, a0: Math.atan2(p.y - cy, p.x - cx), side, t: 0, end: ax + Math.PI, wasLowered: p.lowered };
    p.lowered = false;   // werktuig omhoog in de bocht
  }
  function driveHeadland(p, dt) {
    const h = p.headland;
    p.speed = Math.min(p.speed, 9 * PX);
    if (p.speed < 0.3) return;
    h.t = Math.min(1, h.t + p.speed * dt / (Math.PI * h.r));
    const th = h.a0 + h.side * Math.PI * h.t;
    p.x = h.cx + Math.cos(th) * h.r; p.y = h.cy + Math.sin(th) * h.r;
    p.angle = th + h.side * Math.PI / 2;
    if (h.t >= 1) {
      p.angle = Math.atan2(Math.sin(h.end), Math.cos(h.end));
      p.lowered = h.wasLowered; p.hlSide = h.side; p.headland = null;
    }
  }

  // ---------- lossen (U) ----------
  const rot = (x, y, a, lx, ly) => ({ x: x + Math.cos(a) * lx - Math.sin(a) * ly, y: y + Math.sin(a) * lx + Math.cos(a) * ly });
  const inRect = (pt, r, m) => pt.x > r.x - m && pt.x < r.x + r.w + m && pt.y > r.y - m && pt.y < r.y + r.h + m;

  // waar komt het graan vandaan: bunker van de maaidorser of de aanhanger
  function loadSource(r) {
    if (!r) return null;
    const p = AT.state.player;
    if (r.mainDef.kind === 'harvester') {
      return { m: r.main, load: G().getLoad(r.main), cap: G().loadCap(r.main), point: rot(p.x, p.y, p.angle, -2, -26), kind: 'harvester' };
    }
    if (r.impl && (r.toolDef.kind === 'trailer' || r.toolDef.kind === 'mixer')) {
      return { m: r.impl, load: G().getLoad(r.impl), cap: G().loadCap(r.impl), point: G().trailerPose(r.impl).rear, kind: 'trailer' };
    }
    return null;
  }

  // waar kan het naartoe vanaf dit punt
  function unloadTarget(src) {
    if (src.kind === 'harvester') {
      for (const m of AT.state.machines) {
        if (D.machines[m.type].kind !== 'trailer' || (m.busy && m.busy !== 'player' && m.busy !== 'chaser')) continue;
        const c = G().trailerPose(m).center;
        if (Math.hypot(c.x - src.point.x, c.y - src.point.y) < 14) return { kind: 'trailer', m, point: c };
      }
    }
    for (const key of Object.keys(D.animals)) {
      if (!AT.state.animals[key].owned) continue;
      const tr = AT.farm.troughRect(key);
      if (!inRect(src.point, tr, 12)) continue;
      if (!D.animals[key].feeds.includes(src.load.crop)) return { kind: 'refuse', point: tr, name: `De ${D.animals[key].name.toLowerCase()}`, verb: 'eten' };
      return { kind: 'trough', key, point: { x: tr.x + tr.w / 2, y: tr.y + tr.h / 2 } };
    }
    for (const key of Object.keys(D.factories)) {
      if (!AT.state.factories[key].owned) continue;
      const pit = AT.farm.factoryPit(key);
      if (!inRect(src.point, pit, 8)) continue;
      if (!AT.farm.factoryAccepts(key, src.load.crop)) return { kind: 'refuse', point: pit, name: `De ${D.factories[key].name.toLowerCase()}`, verb: 'gebruikt' };
      return { kind: 'factory', key, point: { x: pit.x + pit.w / 2, y: pit.y + pit.h / 2 } };
    }
    for (const pit of G().siloPits()) if (inRect(src.point, pit, 8)) return { kind: D.crops[src.load.crop] ? 'silo' : 'store', point: { x: pit.x + pit.w / 2, y: pit.y + pit.h / 2 } };
    if (inRect(src.point, D.siloPit, 10)) return { kind: D.crops[src.load.crop] ? 'silo' : 'store', point: { x: D.siloPit.x + D.siloPit.w / 2, y: D.siloPit.y + D.siloPit.h / 2 } };
    const sp = sellPointAt(src.point);
    if (sp) {
      const pit = sellPit(sp);
      if (!G().accepts(sp, src.load.crop)) return { kind: 'refuse', point: sp, name: D.sellPoints[sp].name };
      return { kind: 'sell', point: { x: pit.x + pit.w / 2, y: pit.y + pit.h / 2 }, sp };
    }
    return null;
  }
  const sellPit = id => id === 'trader' ? D.trader.pit : D.sellPoints[id].pit;
  function sellPointAt(pt) {
    for (const id of Object.keys(D.sellPoints)) if (inRect(pt, sellPit(id), 10)) return id;
    return null;
  }

  let sale = { tons: 0, money: 0, crop: null, sp: null };
  function finishSale() {
    if (sale.tons > 0.01) G().log(`${AT.fmtTons(sale.tons)} ${G().goodName(sale.crop)} verkocht aan ${D.sellPoints[sale.sp].name.toLowerCase()} voor ${AT.fmtMoney(sale.money)}.`, 'money');
    sale = { tons: 0, money: 0, crop: null, sp: null };
  }

  function toggleUnload() {
    const p = AT.state.player, r = rig();
    if (!r) { warn('Stap eerst in een maaidorser of een tractor met aanhanger.'); return; }
    if (r.mainDef.kind === 'truck') { truckAction(r); return; }
    const src = loadSource(r);
    if (!src) { warn('Koppel eerst een aanhanger aan (F) om graan te vervoeren.'); return; }
    if (p.unloading) { p.unloading = false; finishSale(); return; }
    // voermengwagen: leeg bij de stortput of het laadperron = voer mengen
    if (r.toolDef.kind === 'mixer' && src.load.tons < 0.01) {
      if (inRect(src.point, D.siloPit, 14) || inRect(src.point, D.dock, 14) || Math.hypot(p.x - D.siloPit.x - D.siloPit.w / 2, p.y - D.siloPit.y) < 60) mixFeed(r.impl);
      else warn('Rij met de voermengwagen naar de stortput bij de silo of het laadperron om voer te mengen.');
      return;
    }
    if (src.load.tons < 0.01) { warn(src.kind === 'harvester' ? 'De bunker is leeg.' : 'De aanhanger is leeg.'); return; }
    p.unloading = true;
  }

  function unload(p, r, dt) {
    const src = loadSource(r);
    if (!src || src.load.tons < 0.001) { p.unloading = false; finishSale(); return; }
    const target = unloadTarget(src);
    p.unloadTarget = target ? target.kind : null;
    if (!target) {
      warn(src.kind === 'harvester' ? 'Rij met je linkerkant (de losbuis) naast een aanhanger, of naar de stortput/een verkooppunt.' : 'Rij achteruit met de aanhanger over de stortput bij de silo of bij een verkooppunt.');
      return;
    }
    if (target.kind === 'refuse') { warn(`${target.name} ${target.verb || 'koopt'} geen ${G().goodName(src.load.crop)}.`); return; }
    const crop = src.load.crop;
    let amount = Math.min(src.load.tons, D.unloadRate[src.kind] * dt);
    if (target.kind === 'trailer') {
      const L = G().getLoad(target.m), cap = G().loadCap(target.m);
      if (L.tons > 0.001 && L.crop !== crop) { warn(`Die aanhanger zit al vol met ${G().goodName(L.crop)}.`); return; }
      amount = Math.min(amount, cap - L.tons);
      if (amount <= 0.0001) { warn('De aanhanger is vol!'); return; }
      L.crop = crop; L.tons += amount;
    } else if (target.kind === 'silo') {
      amount = Math.min(amount, G().siloRoom());
      if (amount <= 0.0001) { warn('De silo is vol! Verkoop graan of breng het naar de graanhandel.'); return; }
      AT.state.silo[crop] += amount;
      AT.state.stats.deliveredTons += amount;
    } else if (target.kind === 'store') {
      amount = Math.min(amount, G().warehouseRoom(crop));
      if (amount <= 0.0001) { warn('De opslagloods is vol! Verkoop producten of breid de loods uit.'); return; }
      AT.state.goods[crop] += amount;
    } else if (target.kind === 'factory') {
      amount = AT.farm.deliverToFactory(target.key, crop, amount);
      if (amount <= 0.0001) { warn('De stortplaats van de fabriek zit vol. Wacht tot hij meer heeft verwerkt.'); return; }
      AT.state.stats.deliveredTons += amount;
    } else if (target.kind === 'trough') {
      amount = AT.farm.fillTrough(target.key, crop, amount);
      if (amount <= 0.0001) { warn('De voerbak zit vol.'); return; }
    } else {
      const res = G().sellAt(target.sp, crop, amount);
      sale.tons += amount; sale.money += res.money; sale.crop = crop; sale.sp = target.sp;
      AT.state.stats.deliveredTons += amount;
    }
    src.load.tons -= amount;
    if (src.load.tons < 0.001) {
      src.load.tons = 0; src.load.crop = null; p.unloading = false;
      if (target.kind === 'silo') G().log(`${src.kind === 'harvester' ? 'Bunker' : 'Aanhanger'} gelost in de silo.`, 'good');
      if (target.kind === 'store') G().log(`${G().goodDef(crop).name} gelost in de opslagloods.`, 'good');
      if (target.kind === 'factory') G().log(`Gelost bij de ${D.factories[target.key].name.toLowerCase()}: vers geleverd = ${Math.round((D.factoryBonus - 1) * 100)}% meer product.`, 'good');
      if (target.kind === 'trough') G().log(`Voerbak bij de ${D.animals[target.key].building.toLowerCase()} gevuld.`, 'good');
      finishSale();
      AT.emit('change');
    }
    if (AT.fx) AT.fx.stream(src.point, target.point, G().goodColor(crop), dt);
  }

  // ---------- vrachtwagen: laden bij het laadperron, verkopen bij een verkooppunt ----------
  function truckCargo(m) { if (!m.cargo) m.cargo = {}; return m.cargo; }
  const pallets = cargo => Object.entries(cargo).reduce((a, [k, v]) => a + v / D.products[k].perPallet, 0);
  function truckBack(p) { return rot(p.x, p.y, p.angle, -12, 0); }

  function truckAction(r) {
    const p = AT.state.player, m = r.main, cargo = truckCargo(m), back = truckBack(p);
    const cap = r.mainDef.pallets;
    if (inRect(back, D.dock, 14)) {
      // laden: eerst wat het meest waard is per pallet
      let room = cap - pallets(cargo), loaded = 0;
      const keys = Object.keys(D.products).filter(k => D.products[k].perPallet && AT.state.goods[k] > 0.01)
        .sort((a, b) => G().price(b) * D.products[b].perPallet - G().price(a) * D.products[a].perPallet);
      for (const k of keys) {
        if (room <= 0.001) break;
        const amt = Math.min(AT.state.goods[k], room * D.products[k].perPallet);
        AT.state.goods[k] -= amt;
        cargo[k] = (cargo[k] || 0) + amt;
        room -= amt / D.products[k].perPallet; loaded += amt / D.products[k].perPallet;
      }
      if (loaded < 0.01) warn(room <= 0.001 ? 'De vrachtwagen is vol.' : 'Er staan geen producten in de opslagloods.');
      else { G().log(`Vrachtwagen geladen: ${AT.fmtNum(loaded, 1)} pallets.`, 'good'); AT.emit('change'); }
      return;
    }
    const sp = sellPointAt(back);
    if (sp) {
      let money = 0, any = false;
      for (const [k, amt] of Object.entries(cargo)) {
        if (amt < 0.01 || !G().accepts(sp, k)) continue;
        money += G().sellAt(sp, k, amt).money;
        cargo[k] = 0; any = true;
      }
      for (const k of Object.keys(cargo)) if (cargo[k] < 0.01) delete cargo[k];
      if (!any) { warn(`${D.sellPoints[sp].name} koopt niets van wat je bij je hebt.`); return; }
      AT.state.stats.truckDeliveries++;
      G().log(`Vrachtwagen gelost bij ${D.sellPoints[sp].name.toLowerCase()}: ${AT.fmtMoney(money)}.`, 'money');
      if (AT.fx) AT.fx.stream(back, { x: back.x - 6, y: back.y }, '#c9a46a', 0.2);
      AT.emit('change');
      return;
    }
    warn('Rij achteruit naar het laadperron bij de machinehal (laden) of naar de supermarkt/haven/veevoerbedrijf (verkopen).');
  }

  // Bewerk alle cellen onder het werktuig (achter de tractor, of het maaibord vóór de maaidorser)
  function workUnderTool(p, r) {
    if (r.toolDef.kind === 'fruitharvester') return pickFruit(p, r);
    const op = OP[r.toolDef.kind];
    const cos = Math.cos(p.angle), sin = Math.sin(p.angle);
    const offset = r.toolDef.kind === 'harvester' ? 15 : r.toolDef.kind === 'manure' ? -31 : -17;
    const cx = p.x + cos * offset, cy = p.y + sin * offset;
    const half = r.toolDef.width / 2;
    const dir = Math.abs(cos) > Math.abs(sin) ? 1 : 0; // 1 = rijen liggen horizontaal
    let notOwned = false;

    for (let s = -half; s <= half; s += D.CELL / 2) {
      const hit = G().cellAt(cx - sin * s, cy + cos * s);
      if (!hit) continue;
      if (!hit.f.owned) { notOwned = true; continue; }
      const bunker = r.mainDef.kind === 'harvester' ? { load: G().getLoad(r.main), cap: G().loadCap(r.main), m: r.main }
        : r.toolDef.kind === 'baler' ? { baler: true, m: r.impl } : null;
      const res = G().workCell(hit.f, hit.i, op, p.crop, 'player', dir, r.toolDef, bunker);
      if (res === 'tankfull') { warn('Bunker vol! Los in een aanhanger (U) of rij naar de stortput bij de silo.'); break; }
      if (res === 'mixed') { warn('Er zit nog een ander gewas in de bunker. Los eerst (U).'); break; }
      if (res === 'storefull') { warn('De opslagloods is vol! Verkoop producten of breid de loods uit.'); break; }
      if (res === 'nomoney') { warn({ fertilize: 'Geen geld voor kunstmest!', lime: 'Geen geld voor kalk!', spray: 'Geen geld voor gewasbeschermingsmiddel!' }[op] || 'Geen geld voor zaaigoed!'); break; }
      if (res === 'full') { warn('Silo vol! Verkoop graan of vergroot de silo.'); break; }
      if (res === 'season') { warn(`${D.crops[p.crop].name} kun je nu niet zaaien (wel in: ${D.crops[p.crop].sow.map(i => D.months[i].toLowerCase()).join(', ')}). Kies ander zaaigoed met C.`); break; }
      if (res === 'wet') { warn('Te nat om te oogsten. Wacht tot het droog is.'); break; }
      if (res === 'grass') { warn('Met een cultivator kun je geen gras omwerken. Gebruik een ploeg.'); break; }
      if (res === 'nomanure') { warn('Geen mest meer. Koeien en schapen maken mest.'); break; }
      if (res === 'wrongtool' && op === 'sow') {
        const pl = D.crops[p.crop].planter || 'seeder';
        warn(`${D.crops[p.crop].name} zaai je met een ${G().PLANTER_NAMES[pl]}.`);
        break;
      }
      if (res === 'wrongtool') {
        const ck = G().CROP_KEYS[hit.f.cells.crop[hit.i] - 1], need = D.crops[ck].harvester;
        warn(need ? `${D.crops[ck].name} oogst je met een ${G().HARVESTER_NAMES[need]}.` : `${D.crops[ck].name} oogst je niet: ploeg het onder (groenbemester).`);
        break;
      }
    }
    if (notOwned) warn('Dit veld is niet van jou. Koop het eerst.');
    // volle baal achter de pers op het veld leggen
    if (r.toolDef.kind === 'baler') {
      while ((r.impl.baleAcc || 0) >= D.baleTons) {
        r.impl.baleAcc -= D.baleTons;
        const b = rot(p.x, p.y, p.angle, -34, (Math.random() - 0.5) * 3);
        G().dropBale(b.x, b.y, p.angle + Math.PI / 2, D.baleTons);
        AT.emit('sfx', 'bale');
      }
    }
  }

  // balen oprapen: rij met een kipper over of langs de balen
  function pickupBales(r) {
    if (!r.impl || r.toolDef.kind !== 'trailer' || !AT.state.bales.length) return;
    const pose = G().trailerPose(r.impl), L = G().getLoad(r.impl), cap = G().loadCap(r.impl);
    for (const b of [...AT.state.bales]) {
      if (Math.hypot(b.x - pose.center.x, b.y - pose.center.y) > 11) continue;
      if (L.tons > 0.001 && L.crop !== 'hay') { warn(`Er zit ${G().goodName(L.crop)} in de aanhanger. Los die eerst (U).`); return; }
      if (L.tons + b.t > cap + 1e-6) { warn('De aanhanger is vol met balen. Breng ze naar de stortput bij de silo (opslag) of het veevoerbedrijf.'); return; }
      L.crop = 'hay'; L.tons += b.t;
      AT.state.bales = AT.state.bales.filter(x => x !== b);
      AT.state.stats.balesCollected = (AT.state.stats.balesCollected || 0) + 1;
      AT.emit('sfx', 'bale');
    }
  }

  function toggleTool() {
    const p = AT.state.player, r = rig();
    if (!r) return;
    if (!r.toolDef) { warn('Geen werktuig aangekoppeld. Rij achteruit tegen een werktuig en druk F.'); return; }
    if (r.toolDef.kind === 'trailer' || r.toolDef.kind === 'mixer') { warn(`Een ${r.toolDef.kind === 'mixer' ? 'voermengwagen' : 'aanhanger'} hoeft niet omlaag. Druk ${kn('unload')} om te lossen of te mengen.`); return; }
    p.lowered = !p.lowered;
  }

  function cycleCrop() {
    const all = G().CROP_KEYS, p = AT.state.player;
    const r = rig();
    const fits = k => !r || !r.toolDef || r.toolDef.kind !== 'seeder' || (D.crops[k].planter || 'seeder') === r.toolDef.sows;
    const now = all.filter(k => G().canSowNow(k) && fits(k));
    const list = now.length ? now : all.filter(fits);
    const idx = list.indexOf(p.crop);
    p.crop = list[(idx + 1) % list.length];
    AT.emit('change');
  }

  // ---------- hints voor de HUD ----------
  function hudInfo() {
    const p = AT.state.player;
    if (p.mode === 'foot') {
      const v = G().nearestVehicle(p.x, p.y);
      const tree = AT.farm.nearestTree(p.x, p.y);
      return {
        mode: 'foot',
        prompt: v ? `${kn('enter')} = instappen in ${D.machines[v.type].name}` : AT.farm.nearestRipe(p.x, p.y) ? `${kn('action')} = plukken (${D.plantations[AT.farm.nearestRipe(p.x, p.y).key].plant})` : tree ? `${kn('action')} = boom kappen` : '',
        warn: warnTime > 0 ? warnText : '',
      };
    }
    const r = rig();
    if (!r) return null;
    let prompt = '';
    if (r.mainDef.kind === 'tractor') {
      if (r.impl) prompt = `${kn('hitch')} = ${D.machines[r.impl.type].name} afkoppelen`;
      else {
        const im = G().nearestImplement(r.main);
        if (im) prompt = `${kn('hitch')} = ${D.machines[im.type].name} aankoppelen`;
      }
    }
    if (r.mainDef.kind === 'truck') {
      const back = truckBack(p), sp = sellPointAt(back);
      if (inRect(back, D.dock, 14)) prompt = `${kn('unload')} = producten laden`;
      else if (sp) prompt = `${kn('unload')} = verkopen bij ${D.sellPoints[sp].name.toLowerCase()}`;
    }
    const src = loadSource(r);
    if (src) {
      const t = src.load.tons > 0.01 ? unloadTarget(src) : null;
      const where = t => t.kind === 'trailer' ? 'in de aanhanger' : t.kind === 'silo' ? 'in de silo' : t.kind === 'store' ? 'in de opslagloods' : t.kind === 'trough' ? 'in de voerbak' : t.kind === 'factory' ? `bij de ${D.factories[t.key].name.toLowerCase()}` : t.kind === 'sell' ? `bij ${D.sellPoints[t.sp].name.toLowerCase()} (verkopen)` : '';
      if (p.unloading) prompt = t && t.kind !== 'refuse' ? `Lossen ${where(t)}… (${kn('unload')} = stoppen)` : 'Lossen: zoek een aanhanger, stortput of verkooppunt';
      else if (t && t.kind !== 'refuse') prompt = `${kn('unload')} = lossen ${where(t)}`;
      else if (t) prompt = `${t.name} ${t.verb || 'koopt'} dit niet`;
    }
    const toolName = r.toolDef && r.toolDef.kind === 'harvester' ? 'Maaibord' : r.toolDef && r.toolDef.kind === 'fruitharvester' ? 'Oogstkop' : r.toolDef && r.toolDef.kind !== 'trailer' && r.toolDef.kind !== 'mixer' ? r.toolDef.name : null;
    if (!prompt && G().nearPump(p.x, p.y) && G().fuelOf(r.main) < G().fuelCap(r.main) - 1) prompt = `${kn('refuel')} = tanken`;
    const cap = G().fuelCap(r.main), fuel = G().fuelOf(r.main), wear = r.main.wear || 0;
    return {
      mode: 'drive',
      name: r.mainDef.name + (r.impl ? ' + ' + D.machines[r.impl.type].name : ''),
      kmh: Math.round(Math.abs(p.speed) * KMH),
      tool: toolName,
      lowered: p.lowered,
      crop: r.toolDef && r.toolDef.kind === 'seeder' ? D.crops[p.crop].name + (G().canSowNow(p.crop) ? '' : ' (niet in dit seizoen!)') : null,
      load: src ? `${src.kind === 'harvester' ? 'Bunker' : 'Aanhanger'}: ${AT.fmtNum(src.load.tons, 1)} / ${src.cap} t${src.load.crop ? ' ' + G().goodName(src.load.crop) : ''}${src.load.crop === 'hay' ? ` (${Math.round(src.load.tons / D.baleTons)} balen)` : ''}`
        : r.mainDef.kind === 'truck' ? `Lading: ${AT.fmtNum(pallets(truckCargo(r.main)), 1)} / ${r.mainDef.pallets} pallets` : null,
      loadFrac: src ? src.load.tons / src.cap : 0,
      extra: r.toolDef && r.toolDef.kind === 'manure' ? `Mest: ${AT.fmtTons(AT.state.goods.manure)}` : r.toolDef && r.toolDef.kind === 'spreader' ? `Kunstmest: ${AT.fmtMoney(D.fertCostPerHa)}/ha`
        : r.toolDef && r.toolDef.kind === 'lime' ? `Kalk: ${AT.fmtMoney(D.limeCostPerHa)}/ha` : r.toolDef && r.toolDef.kind === 'sprayer' ? `Spuiten: ${AT.fmtMoney(D.sprayCostPerHa)}/ha (alleen groeiend gewas)` : null,
      fuel: cap ? `Diesel: ${Math.round(fuel)} / ${cap} L${wear > 0.05 ? ` · slijtage ${Math.round(wear * 100)}%` : ''}${r.main.gps ? ` · GPS ${p.autosteer ? (p.headland ? 'keert…' : 'AAN + kopakker') : 'uit'} (${kn('gps')})` : ''}` : null,
      fuelLow: cap && fuel < cap * 0.15 || wear > 0.85 || r.main.broken,
      prompt,
      warn: warnTime > 0 ? warnText : '',
    };
  }

  // ---------- toetsenbord ----------
  document.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input, select, textarea')) return;
    if (AT.keys.capturing) return;   // je stelt net een toets in
    if (['up', 'down', 'left', 'right', 'tool'].some(a => K(e, a))) e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    const p = AT.state.player;
    if (K(e, 'tool')) toggleTool();
    if (K(e, 'crop')) cycleCrop();
    if (K(e, 'unload')) toggleUnload();
    if (K(e, 'gps') && p.mode === 'drive') {
      const r = rig();
      if (!r.main.gps) warn('Deze machine heeft geen GPS. Koop het in de Garage.');
      else { p.autosteer = !p.autosteer; p.headland = null; p.hlSide = 0; G().log(p.autosteer ? 'GPS aan: laat het stuur los en hij rijdt kaarsrecht. Met het werktuig omlaag keert hij aan het eind van het veld zelf naar de volgende baan.' : 'GPS uit.'); }
    }
    if (K(e, 'refuel') && p.mode === 'drive') {
      const r = rig();
      if (!G().nearPump(p.x, p.y)) warn('Rij naar een dieselpomp (op het erf of bij een eigen werkplaats) om te tanken.');
      else if (!G().refuel(r.main)) warn('De tank is al vol.');
    }
    if (K(e, 'chaser')) { const res = AT.staff.toggleChaser(); if (typeof res === 'string') warn(res); }
    if (K(e, 'action') && p.mode === 'foot' && AT.farm.nearestRipe(p.x, p.y)) {
      const hit = AT.farm.nearestRipe(p.x, p.y);
      const got = AT.farm.pick(hit.key, hit.plant, false);
      if (got > 0) { AT.emit('sfx', 'pick'); G().log(`Geplukt: +${AT.fmtAmount(got, D.plantations[hit.key].product)} ${G().goodName(D.plantations[hit.key].product)}.`, 'good'); }
      else warn('De opslagloods is vol.');
    } else if (K(e, 'action') && p.mode === 'foot') {
      const t = AT.farm.nearestTree(p.x, p.y);
      if (!t) warn(AT.farm.woodlot().owned ? 'Loop naar een volgroeide boom in je bosperceel.' : 'Koop eerst het bosperceel (tab Bedrijf).');
      else {
        const wood = D.woodlot.woodPerTree * t.growth;
        if (AT.farm.cutTree(t, false)) { AT.emit('sfx', 'chop'); G().log(`Boom gekapt: +${AT.fmtNum(wood, 1)} m³ hout.`, 'good'); if (AT.fx) AT.fx.stream({ x: t.x, y: t.y }, { x: t.x + 6, y: t.y + 4 }, '#8b6a45', 0.3); }
      }
    }
    if (K(e, 'enter')) {
      if (p.mode === 'drive') G().exitVehicle();
      else {
        const v = G().nearestVehicle(p.x, p.y);
        if (v) G().enterVehicle(v.uid);
        else warn('Loop dichter naar een tractor of maaidorser om in te stappen.');
      }
    }
    if (K(e, 'hitch')) {
      const res = G().toggleHitch();
      if (res === 'far') warn('Rij achteruit tot je trekhaak bij een werktuig is.');
      if (res === 'none') warn(p.mode === 'drive' ? 'Een maaidorser heeft geen trekhaak.' : 'Stap eerst in een tractor.');
    }
  });
  document.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  AT.on('change', () => { const p = AT.state.player; if (p.mode !== 'drive' && p.unloading) { p.unloading = false; finishSale(); } });

  AT.vehicle = { update, rig, toggleTool, cycleCrop, hudInfo, pressed, KMH, loadSource, toggleUnload, blocked, surface, warn };
})();
