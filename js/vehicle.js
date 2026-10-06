// Agro Tycoon 2.0 — zelf rijden met tractor of maaidorser
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const keys = new Set();
  AT.input = { keys };

  const OP = { plow: 'plow', seeder: 'sow', harvester: 'harvest' };
  const KMH = 0.25; // px/s -> km/u voor de snelheidsmeter

  const pressed = (...codes) => codes.some(c => keys.has(c));

  // welke machines zitten in de huidige rig
  function rig() {
    const p = AT.state.player;
    if (!p) return null;
    const ms = AT.state.machines;
    const main = ms.find(m => m.uid === p.uid);
    const impl = p.implUid ? ms.find(m => m.uid === p.implUid) : null;
    const mainDef = D.machines[main.type];
    const toolDef = mainDef.kind === 'harvester' ? mainDef : impl ? D.machines[impl.type] : null;
    return { main, impl, mainDef, toolDef };
  }

  let warnText = '', warnTime = 0;
  function warn(text) { warnText = text; warnTime = 2.5; }

  function update(dt, dtHours) {
    const p = AT.state.player;
    const r = rig();
    if (!r) return;

    const working = p.lowered && r.toolDef;
    const maxSpeed = working ? r.toolDef.workSpeed : r.mainDef.speed;
    const throttle = (pressed('KeyW', 'ArrowUp') ? 1 : 0) - (pressed('KeyS', 'ArrowDown') ? 1 : 0);
    const steer = (pressed('KeyD', 'ArrowRight') ? 1 : 0) - (pressed('KeyA', 'ArrowLeft') ? 1 : 0);

    // gas/rem
    const accel = 90;
    if (throttle !== 0) {
      // remmen gaat sneller dan optrekken
      const braking = Math.sign(throttle) !== Math.sign(p.speed) && Math.abs(p.speed) > 1;
      p.speed += throttle * accel * (braking ? 2.2 : 1) * dt;
    } else {
      const drag = 120 * dt;
      p.speed = Math.abs(p.speed) <= drag ? 0 : p.speed - Math.sign(p.speed) * drag;
    }
    p.speed = Math.max(-maxSpeed * 0.4, Math.min(maxSpeed, p.speed));
    if (p.speed > maxSpeed) p.speed = maxSpeed;

    // sturen: draaien kan alleen als je rijdt
    const turnRate = r.mainDef.kind === 'harvester' ? 1.6 : 2.0;
    p.angle += steer * turnRate * dt * Math.max(-1, Math.min(1, p.speed / 35));

    p.x += Math.cos(p.angle) * p.speed * dt;
    p.y += Math.sin(p.angle) * p.speed * dt;
    p.x = Math.max(8, Math.min(D.world.w - 8, p.x));
    p.y = Math.max(8, Math.min(D.world.h - 8, p.y));

    // diesel
    if (Math.abs(p.speed) > 1) {
      const cost = r.mainDef.fuelPerHour * D.fuelPrice * dtHours;
      AT.state.money -= cost;
      AT.state.stats.spent += cost;
    }

    if (working && p.speed > 3) workUnderTool(p, r);
    if (warnTime > 0) warnTime -= dt;
  }

  // Bewerk alle cellen onder het werktuig (achter de tractor, of het maaibord vóór de maaidorser)
  function workUnderTool(p, r) {
    const op = OP[r.toolDef.kind];
    const cos = Math.cos(p.angle), sin = Math.sin(p.angle);
    const offset = r.toolDef.kind === 'harvester' ? 14 : -16;
    const cx = p.x + cos * offset, cy = p.y + sin * offset;
    const half = r.toolDef.width / 2;
    let notOwned = false;

    for (let s = -half; s <= half; s += D.CELL / 2) {
      const hit = AT.game.cellAt(cx - sin * s, cy + cos * s);
      if (!hit) continue;
      if (!hit.f.owned) { notOwned = true; continue; }
      const res = AT.game.workCell(hit.f, hit.i, op, p.crop, 'player');
      if (res === 'nomoney') { warn('Geen geld voor zaaigoed!'); break; }
      if (res === 'full') { warn('Silo vol! Verkoop graan of vergroot de silo.'); break; }
    }
    if (notOwned) warn('Dit veld is niet van jou. Koop het eerst.');
  }

  function toggleTool() {
    const p = AT.state.player;
    const r = rig();
    if (!p || !r) return;
    if (!r.toolDef) { warn('Geen werktuig aangekoppeld.'); return; }
    p.lowered = !p.lowered;
  }

  function cycleCrop() {
    const p = AT.state.player;
    if (!p) return;
    const keysList = AT.game.CROP_KEYS;
    p.crop = keysList[(keysList.indexOf(p.crop) + 1) % keysList.length];
    AT.emit('change');
  }

  function hudInfo() {
    const p = AT.state.player;
    const r = rig();
    if (!p || !r) return null;
    const toolName = r.toolDef && r.toolDef.kind === 'harvester' ? 'Maaibord' : r.toolDef ? r.toolDef.name : null;
    return {
      name: r.mainDef.name + (r.impl ? ' + ' + D.machines[r.impl.type].name : ''),
      kmh: Math.round(Math.abs(p.speed) * KMH),
      tool: toolName,
      lowered: p.lowered,
      crop: r.toolDef && r.toolDef.kind === 'seeder' ? D.crops[p.crop].name : null,
      warn: warnTime > 0 ? warnText : '',
    };
  }

  // ---------- toetsenbord ----------
  const DRIVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  document.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input, select, textarea')) return;
    if (DRIVE_KEYS.includes(e.code) || e.code === 'Space') e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    if (e.code === 'Space') toggleTool();
    if (e.code === 'KeyC') cycleCrop();
    if (e.code === 'KeyE') {
      if (AT.state.player) AT.game.exitVehicle();
      else if (AT.state.lastRig) {
        if (!AT.game.enterVehicle(AT.state.lastRig.uid, AT.state.lastRig.implUid)) AT.game.log('Die machine is niet vrij. Kies er een in de Garage.', 'warn');
      }
    }
  });
  document.addEventListener('keyup', e => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  AT.vehicle = { update, rig, toggleTool, cycleCrop, hudInfo, pressed };
})();
