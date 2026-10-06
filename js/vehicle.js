// Agro Tycoon 2.0 — speler: lopen als boer, zelf rijden met tractor of maaidorser
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const keys = new Set();
  AT.input = { keys, moved: 0 };

  const OP = { plow: 'plow', seeder: 'sow', harvester: 'harvest', spreader: 'fertilize', manure: 'manure', mower: 'mow', tedder: 'ted', baler: 'bale', lime: 'lime', sprayer: 'spray' };
  const PX = D.kmhToPx;            // km/u -> pixels per seconde
  const KMH = 1 / D.kmhToPx;       // pixels per seconde -> km/u (snelheidsmeter)

  const pressed = (...codes) => codes.some(c => keys.has(c));
  const G = () => AT.game;

  // huidige machine-combinatie als je rijdt
  function rig() {
    const p = AT.state.player;
    if (p.mode !== 'drive') return null;
    const main = G().machine(p.vehicle);
    if (!main) return null;
    const impl = main.impl ? G().machine(main.impl) : null;
    const mainDef = D.machines[main.type];
    const toolDef = mainDef.kind === 'harvester' ? mainDef : impl ? D.machines[impl.type] : null;
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

  // ---------- lopen ----------
  function updateFoot(p, dt) {
    let dx = (pressed('KeyD', 'ArrowRight') ? 1 : 0) - (pressed('KeyA', 'ArrowLeft') ? 1 : 0);
    let dy = (pressed('KeyS', 'ArrowDown') ? 1 : 0) - (pressed('KeyW', 'ArrowUp') ? 1 : 0);
    const len = Math.hypot(dx, dy);
    if (len) {
      const sp = (pressed('ShiftLeft', 'ShiftRight') ? D.runSpeed : D.walkSpeed) * PX;
      p.x += dx / len * sp * dt;
      p.y += dy / len * sp * dt;
      p.angle = Math.atan2(dy, dx);
      p.speed = sp;
      p.walk = (p.walk || 0) + sp * dt;
      AT.input.moved = 1;
    } else p.speed = 0;
    p.x = Math.max(6, Math.min(D.world.w - 6, p.x));
    p.y = Math.max(6, Math.min(D.world.h - 6, p.y));
  }

  // ---------- rijden ----------
  function updateDrive(p, dt, dtHours) {
    const r = rig();
    if (!r) { p.mode = 'foot'; return; }

    const working = p.lowered && r.toolDef && r.toolDef.kind !== 'trailer';
    // een volle aanhanger maakt je trager
    const src = loadSource(r);
    const heavy = src && r.mainDef.kind === 'tractor' ? 1 - 0.25 * (src.load.tons / src.cap) : 1;
    // Shift = een stukje sneller (25%)
    const boost = pressed('ShiftLeft', 'ShiftRight') ? D.shiftBoost : 1;
    const maxSpeed = (working ? r.toolDef.workSpeed : r.mainDef.speed) * PX * heavy * boost;
    const throttle = (pressed('KeyW', 'ArrowUp') ? 1 : 0) - (pressed('KeyS', 'ArrowDown') ? 1 : 0);
    const steerIn = (pressed('KeyD', 'ArrowRight') ? 1 : 0) - (pressed('KeyA', 'ArrowLeft') ? 1 : 0);
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

    const step = p.speed * dt;
    p.x = Math.max(8, Math.min(D.world.w - 8, p.x + Math.cos(p.angle) * step));
    p.y = Math.max(8, Math.min(D.world.h - 8, p.y + Math.sin(p.angle) * step));
    p.dist = (p.dist || 0) + step;

    // machine staat waar jij rijdt
    Object.assign(r.main, { x: p.x, y: p.y, angle: p.angle });

    if (Math.abs(p.speed) > 1) {
      const cost = r.mainDef.fuelPerHour * D.fuelPrice * dtHours;
      G().spend(cost, 'brandstof');
    }
    if (working && p.speed > 3) workUnderTool(p, r);
    if (Math.abs(p.speed) > 0.5) pickupBales(r);
    // rijden over natte akkers verdicht de grond (onder de machine en de aanhanger/het werktuig)
    if (Math.abs(p.speed) > 1 && r.mainDef.kind !== 'truck') {
      G().compactAt(p.x, p.y);
      if (r.impl) { const h = G().hitchPoint(r.main); G().compactAt(h.x - Math.cos(p.angle) * 6, h.y - Math.sin(p.angle) * 6); }
    }
    if (p.unloading) unload(p, r, dt);
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
    if (r.impl && r.toolDef.kind === 'trailer') {
      return { m: r.impl, load: G().getLoad(r.impl), cap: G().loadCap(r.impl), point: G().trailerPose(r.impl).rear, kind: 'trailer' };
    }
    return null;
  }

  // waar kan het naartoe vanaf dit punt
  function unloadTarget(src) {
    if (src.kind === 'harvester') {
      for (const m of AT.state.machines) {
        if (D.machines[m.type].kind !== 'trailer' || (m.busy && m.busy !== 'player')) continue;
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
      const bunker = r.mainDef.kind === 'harvester' ? { load: G().getLoad(r.main), cap: G().loadCap(r.main) }
        : r.toolDef.kind === 'baler' ? { baler: true, m: r.impl } : null;
      const res = G().workCell(hit.f, hit.i, op, p.crop, 'player', dir, r.toolDef, bunker);
      if (res === 'tankfull') { warn('Bunker vol! Los in een aanhanger (U) of rij naar de stortput bij de silo.'); break; }
      if (res === 'mixed') { warn('Er zit nog een ander gewas in de bunker. Los eerst (U).'); break; }
      if (res === 'storefull') { warn('De opslagloods is vol! Verkoop producten of breid de loods uit.'); break; }
      if (res === 'nomoney') { warn({ fertilize: 'Geen geld voor kunstmest!', lime: 'Geen geld voor kalk!', spray: 'Geen geld voor gewasbeschermingsmiddel!' }[op] || 'Geen geld voor zaaigoed!'); break; }
      if (res === 'full') { warn('Silo vol! Verkoop graan of vergroot de silo.'); break; }
      if (res === 'season') { warn(`${D.crops[p.crop].name} kun je nu niet zaaien (wel in: ${D.crops[p.crop].sow.map(i => D.months[i].toLowerCase()).join(', ')}). Kies ander zaaigoed met C.`); break; }
      if (res === 'wet') { warn('Te nat om te oogsten. Wacht tot het droog is.'); break; }
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
    if (r.toolDef.kind === 'trailer') { warn('Een aanhanger hoeft niet omlaag. Druk U om te lossen.'); return; }
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
        prompt: v ? `E = instappen in ${D.machines[v.type].name}` : AT.farm.nearestRipe(p.x, p.y) ? `H = plukken (${D.plantations[AT.farm.nearestRipe(p.x, p.y).key].plant})` : tree ? 'H = boom kappen' : '',
        warn: warnTime > 0 ? warnText : '',
      };
    }
    const r = rig();
    if (!r) return null;
    let prompt = '';
    if (r.mainDef.kind === 'tractor') {
      if (r.impl) prompt = `F = ${D.machines[r.impl.type].name} afkoppelen`;
      else {
        const im = G().nearestImplement(r.main);
        if (im) prompt = `F = ${D.machines[im.type].name} aankoppelen`;
      }
    }
    if (r.mainDef.kind === 'truck') {
      const back = truckBack(p), sp = sellPointAt(back);
      if (inRect(back, D.dock, 14)) prompt = 'U = producten laden';
      else if (sp) prompt = `U = verkopen bij ${D.sellPoints[sp].name.toLowerCase()}`;
    }
    const src = loadSource(r);
    if (src) {
      const t = src.load.tons > 0.01 ? unloadTarget(src) : null;
      const where = t => t.kind === 'trailer' ? 'in de aanhanger' : t.kind === 'silo' ? 'in de silo' : t.kind === 'store' ? 'in de opslagloods' : t.kind === 'trough' ? 'in de voerbak' : t.kind === 'sell' ? `bij ${D.sellPoints[t.sp].name.toLowerCase()} (verkopen)` : '';
      if (p.unloading) prompt = t && t.kind !== 'refuse' ? `Lossen ${where(t)}… (U = stoppen)` : 'Lossen: zoek een aanhanger, stortput of verkooppunt';
      else if (t && t.kind !== 'refuse') prompt = `U = lossen ${where(t)}`;
      else if (t) prompt = `${t.name} ${t.verb || 'koopt'} dit niet`;
    }
    const toolName = r.toolDef && r.toolDef.kind === 'harvester' ? 'Maaibord' : r.toolDef && r.toolDef.kind !== 'trailer' ? r.toolDef.name : null;
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
      prompt,
      warn: warnTime > 0 ? warnText : '',
    };
  }

  // ---------- toetsenbord ----------
  const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
  document.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input, select, textarea')) return;
    if (MOVE_KEYS.includes(e.code)) e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    const p = AT.state.player;
    if (e.code === 'Space') toggleTool();
    if (e.code === 'KeyC') cycleCrop();
    if (e.code === 'KeyU') toggleUnload();
    if (e.code === 'KeyH' && p.mode === 'foot' && AT.farm.nearestRipe(p.x, p.y)) {
      const hit = AT.farm.nearestRipe(p.x, p.y);
      const got = AT.farm.pick(hit.key, hit.plant, false);
      if (got > 0) { AT.emit('sfx', 'pick'); G().log(`Geplukt: +${AT.fmtAmount(got, D.plantations[hit.key].product)} ${G().goodName(D.plantations[hit.key].product)}.`, 'good'); }
      else warn('De opslagloods is vol.');
    } else if (e.code === 'KeyH' && p.mode === 'foot') {
      const t = AT.farm.nearestTree(p.x, p.y);
      if (!t) warn(AT.farm.woodlot().owned ? 'Loop naar een volgroeide boom in je bosperceel.' : 'Koop eerst het bosperceel (tab Bedrijf).');
      else {
        const wood = D.woodlot.woodPerTree * t.growth;
        if (AT.farm.cutTree(t, false)) { AT.emit('sfx', 'chop'); G().log(`Boom gekapt: +${AT.fmtNum(wood, 1)} m³ hout.`, 'good'); if (AT.fx) AT.fx.stream({ x: t.x, y: t.y }, { x: t.x + 6, y: t.y + 4 }, '#8b6a45', 0.3); }
      }
    }
    if (e.code === 'KeyE') {
      if (p.mode === 'drive') G().exitVehicle();
      else {
        const v = G().nearestVehicle(p.x, p.y);
        if (v) G().enterVehicle(v.uid);
        else warn('Loop dichter naar een tractor of maaidorser om in te stappen.');
      }
    }
    if (e.code === 'KeyF') {
      const res = G().toggleHitch();
      if (res === 'far') warn('Rij achteruit tot je trekhaak bij een werktuig is.');
      if (res === 'none') warn(p.mode === 'drive' ? 'Een maaidorser heeft geen trekhaak.' : 'Stap eerst in een tractor.');
    }
  });
  document.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  AT.on('change', () => { const p = AT.state.player; if (p.mode !== 'drive' && p.unloading) { p.unloading = false; finishSale(); } });

  AT.vehicle = { update, rig, toggleTool, cycleCrop, hudInfo, pressed, KMH, loadSource, toggleUnload };
})();
