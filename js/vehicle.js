// Agro Tycoon 2.0 — speler: lopen als boer, zelf rijden met tractor of maaidorser
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const keys = new Set();
  AT.input = { keys, moved: 0 };

  const OP = { plow: 'plow', seeder: 'sow', harvester: 'harvest' };
  const KMH = 0.25; // px/s -> km/u voor de snelheidsmeter

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
      const sp = pressed('ShiftLeft', 'ShiftRight') ? D.runSpeed : D.walkSpeed;
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

    const working = p.lowered && r.toolDef;
    const maxSpeed = working ? r.toolDef.workSpeed : r.mainDef.speed;
    const throttle = (pressed('KeyW', 'ArrowUp') ? 1 : 0) - (pressed('KeyS', 'ArrowDown') ? 1 : 0);
    const steerIn = (pressed('KeyD', 'ArrowRight') ? 1 : 0) - (pressed('KeyA', 'ArrowLeft') ? 1 : 0);
    if (throttle || steerIn) AT.input.moved = 1;

    // gas/rem
    const accel = 90;
    if (throttle !== 0) {
      const braking = Math.sign(throttle) !== Math.sign(p.speed) && Math.abs(p.speed) > 1;
      p.speed += throttle * accel * (braking ? 2.2 : 1) * dt;
    } else {
      const drag = 120 * dt;
      p.speed = Math.abs(p.speed) <= drag ? 0 : p.speed - Math.sign(p.speed) * drag;
    }
    p.speed = Math.max(-maxSpeed * 0.4, Math.min(maxSpeed, p.speed));
    p.throttle = throttle;

    // sturen (wielen draaien zichtbaar mee)
    p.steer = (p.steer || 0) + (steerIn * 0.45 - (p.steer || 0)) * Math.min(1, dt * 8);
    const turnRate = r.mainDef.kind === 'harvester' ? 1.6 : 2.0;
    p.angle += steerIn * turnRate * dt * Math.max(-1, Math.min(1, p.speed / 35));

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
  }

  // Bewerk alle cellen onder het werktuig (achter de tractor, of het maaibord vóór de maaidorser)
  function workUnderTool(p, r) {
    const op = OP[r.toolDef.kind];
    const cos = Math.cos(p.angle), sin = Math.sin(p.angle);
    const offset = r.toolDef.kind === 'harvester' ? 15 : -17;
    const cx = p.x + cos * offset, cy = p.y + sin * offset;
    const half = r.toolDef.width / 2;
    const dir = Math.abs(cos) > Math.abs(sin) ? 1 : 0; // 1 = rijen liggen horizontaal
    let notOwned = false;

    for (let s = -half; s <= half; s += D.CELL / 2) {
      const hit = G().cellAt(cx - sin * s, cy + cos * s);
      if (!hit) continue;
      if (!hit.f.owned) { notOwned = true; continue; }
      const res = G().workCell(hit.f, hit.i, op, p.crop, 'player', dir);
      if (res === 'nomoney') { warn('Geen geld voor zaaigoed!'); break; }
      if (res === 'full') { warn('Silo vol! Verkoop graan of vergroot de silo.'); break; }
    }
    if (notOwned) warn('Dit veld is niet van jou. Koop het eerst.');
  }

  function toggleTool() {
    const p = AT.state.player, r = rig();
    if (!r) return;
    if (!r.toolDef) { warn('Geen werktuig aangekoppeld. Rij achteruit tegen een werktuig en druk F.'); return; }
    p.lowered = !p.lowered;
  }

  function cycleCrop() {
    const list = G().CROP_KEYS, p = AT.state.player;
    p.crop = list[(list.indexOf(p.crop) + 1) % list.length];
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
    const toolName = r.toolDef && r.toolDef.kind === 'harvester' ? 'Maaibord' : r.toolDef ? r.toolDef.name : null;
    return {
      mode: 'drive',
      name: r.mainDef.name + (r.impl ? ' + ' + D.machines[r.impl.type].name : ''),
      kmh: Math.round(Math.abs(p.speed) * KMH),
      tool: toolName,
      lowered: p.lowered,
      crop: r.toolDef && r.toolDef.kind === 'seeder' ? D.crops[p.crop].name : null,
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

  AT.vehicle = { update, rig, toggleTool, cycleCrop, hudInfo, pressed, KMH };
})();
