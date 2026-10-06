// Agro Tycoon 2.0 — speler: lopen als boer, zelf rijden met tractor of maaidorser
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const keys = new Set();
  AT.input = { keys, moved: 0 };

  const OP = { plow: 'plow', seeder: 'sow', harvester: 'harvest', spreader: 'fertilize', manure: 'manure' };
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
  function warn(text) { warnText = text; warnTime = 2.5; }

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
    const maxSpeed = (working ? r.toolDef.workSpeed : r.mainDef.speed) * PX * heavy;
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
    p.speed = Math.max(-maxSpeed * 0.4, Math.min(maxSpeed, p.speed));
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
      AT.state.money -= cost;
      AT.state.stats.spent += cost;
    }
    if (working && p.speed > 3) workUnderTool(p, r);
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
    if (inRect(src.point, D.siloPit, 10)) return { kind: 'silo', point: { x: D.siloPit.x + D.siloPit.w / 2, y: D.siloPit.y + D.siloPit.h / 2 } };
    const tp = D.trader.pit;
    if (inRect(src.point, tp, 10)) return { kind: 'trader', point: { x: tp.x + tp.w / 2, y: tp.y + tp.h / 2 } };
    return null;
  }

  let sale = { tons: 0, money: 0, crop: null };
  function finishSale() {
    if (sale.tons > 0.01) G().log(`${AT.fmtTons(sale.tons)} ${D.crops[sale.crop].name.toLowerCase()} verkocht aan de graanhandel voor ${AT.fmtMoney(sale.money)}.`, 'money');
    sale = { tons: 0, money: 0, crop: null };
  }

  function toggleUnload() {
    const p = AT.state.player, r = rig();
    if (!r) { warn('Stap eerst in een maaidorser of een tractor met aanhanger.'); return; }
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
      warn(src.kind === 'harvester' ? 'Rij met je linkerkant (de losbuis) naast een aanhanger, of naar de stortput/graanhandel.' : 'Rij achteruit met de aanhanger over de stortput bij de silo of bij de graanhandel.');
      return;
    }
    const crop = src.load.crop;
    let amount = Math.min(src.load.tons, D.unloadRate[src.kind] * dt);
    if (target.kind === 'trailer') {
      const L = G().getLoad(target.m), cap = G().loadCap(target.m);
      if (L.tons > 0.001 && L.crop !== crop) { warn(`Die aanhanger zit al vol met ${D.crops[L.crop].name.toLowerCase()}.`); return; }
      amount = Math.min(amount, cap - L.tons);
      if (amount <= 0.0001) { warn('De aanhanger is vol!'); return; }
      L.crop = crop; L.tons += amount;
    } else if (target.kind === 'silo') {
      amount = Math.min(amount, G().siloRoom());
      if (amount <= 0.0001) { warn('De silo is vol! Verkoop graan of breng het naar de graanhandel.'); return; }
      AT.state.silo[crop] += amount;
      AT.state.stats.deliveredTons += amount;
    } else {
      const money = amount * G().cropPrice(crop);
      G().earn(money);
      sale.tons += amount; sale.money += money; sale.crop = crop;
      AT.state.stats.deliveredTons += amount;
    }
    src.load.tons -= amount;
    if (src.load.tons < 0.001) {
      src.load.tons = 0; src.load.crop = null; p.unloading = false;
      if (target.kind === 'silo') G().log(`${src.kind === 'harvester' ? 'Bunker' : 'Aanhanger'} gelost in de silo.`, 'good');
      finishSale();
      AT.emit('change');
    }
    if (AT.fx) AT.fx.stream(src.point, target.point, D.crops[crop].color, dt);
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
      const bunker = r.mainDef.kind === 'harvester' ? { load: G().getLoad(r.main), cap: G().loadCap(r.main) } : null;
      const res = G().workCell(hit.f, hit.i, op, p.crop, 'player', dir, r.toolDef, bunker);
      if (res === 'tankfull') { warn('Bunker vol! Los in een aanhanger (U) of rij naar de stortput bij de silo.'); break; }
      if (res === 'mixed') { warn('Er zit nog een ander gewas in de bunker. Los eerst (U).'); break; }
      if (res === 'nomoney') { warn(op === 'fertilize' ? 'Geen geld voor kunstmest!' : 'Geen geld voor zaaigoed!'); break; }
      if (res === 'full') { warn('Silo vol! Verkoop graan of vergroot de silo.'); break; }
      if (res === 'season') { warn(`${D.crops[p.crop].name} kun je nu niet zaaien (wel in: ${D.crops[p.crop].sow.map(i => D.months[i].toLowerCase()).join(', ')}). Kies ander zaaigoed met C.`); break; }
      if (res === 'wet') { warn('Te nat om te oogsten. Wacht tot het droog is.'); break; }
      if (res === 'nomanure') { warn('Geen mest meer. Koeien en schapen maken mest.'); break; }
      if (res === 'wrongtool') {
        const ck = G().CROP_KEYS[hit.f.cells.crop[hit.i] - 1], need = D.crops[ck].harvester;
        warn(need ? `${D.crops[ck].name} oogst je met een ${G().HARVESTER_NAMES[need]}.` : `${D.crops[ck].name} oogst je niet: ploeg het onder (groenbemester).`);
        break;
      }
    }
    if (notOwned) warn('Dit veld is niet van jou. Koop het eerst.');
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
    const now = all.filter(k => G().canSowNow(k));
    const list = now.length ? now : all;
    const idx = list.indexOf(p.crop);
    p.crop = list[(idx + 1) % list.length];
    AT.emit('change');
  }

  // ---------- hints voor de HUD ----------
  function hudInfo() {
    const p = AT.state.player;
    if (p.mode === 'foot') {
      const v = G().nearestVehicle(p.x, p.y);
      return {
        mode: 'foot',
        prompt: v ? `E = instappen in ${D.machines[v.type].name}` : '',
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
    const src = loadSource(r);
    if (src) {
      const t = src.load.tons > 0.01 ? unloadTarget(src) : null;
      const names = { trailer: 'in de aanhanger', silo: 'in de silo', trader: 'bij de graanhandel (verkopen)' };
      if (p.unloading) prompt = t ? `Lossen ${names[t.kind]}… (U = stoppen)` : 'Lossen: zoek een aanhanger, stortput of de graanhandel';
      else if (t) prompt = `U = lossen ${names[t.kind]}`;
    }
    const toolName = r.toolDef && r.toolDef.kind === 'harvester' ? 'Maaibord' : r.toolDef && r.toolDef.kind !== 'trailer' ? r.toolDef.name : null;
    return {
      mode: 'drive',
      name: r.mainDef.name + (r.impl ? ' + ' + D.machines[r.impl.type].name : ''),
      kmh: Math.round(Math.abs(p.speed) * KMH),
      tool: toolName,
      lowered: p.lowered,
      crop: r.toolDef && r.toolDef.kind === 'seeder' ? D.crops[p.crop].name + (G().canSowNow(p.crop) ? '' : ' (niet in dit seizoen!)') : null,
      load: src ? `${src.kind === 'harvester' ? 'Bunker' : 'Aanhanger'}: ${AT.fmtNum(src.load.tons, 1)} / ${src.cap} t${src.load.crop ? ' ' + D.crops[src.load.crop].name.toLowerCase() : ''}` : null,
      loadFrac: src ? src.load.tons / src.cap : 0,
      extra: r.toolDef && r.toolDef.kind === 'manure' ? `Mest: ${AT.fmtTons(AT.state.goods.manure)}` : r.toolDef && r.toolDef.kind === 'spreader' ? `Kunstmest: ${AT.fmtMoney(D.fertCostPerHa)}/ha` : null,
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
