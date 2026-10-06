// Agro Tycoon 2.0 — effecten: bandensporen, rook, stof, kaf en meeuwen
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  let tracks, tctx, fadeTimer = 0;
  const particles = [];
  const birds = [];
  const MAX_PARTICLES = 500;

  // wielposities (lokaal, voor bandensporen) per soort machine
  const WHEELS = {
    tractor: [[-5.5, -6.6, 3.2], [-5.5, 6.6, 3.2], [6.5, -5, 2.3], [6.5, 5, 2.3]],
    harvester: [[3, -7.4, 3.2], [3, 7.4, 3.2], [-12, -5.6, 2.3], [-12, 5.6, 2.3]],
  };
  const EXHAUST = { tractor: [1, -2.3], harvester: [-14, -3] };

  function init() {
    tracks = document.createElement('canvas');
    tracks.width = D.world.w; tracks.height = D.world.h;
    tctx = tracks.getContext('2d');
    const home = D.pond;
    for (let i = 0; i < 7; i++) {
      birds.push({ x: home.x + (Math.random() - 0.5) * 200, y: home.y + (Math.random() - 0.5) * 120, vx: 20, vy: 0, ph: Math.random() * 6, tx: home.x, ty: home.y, retarget: 0 });
    }
  }

  const rot = (x, y, a, lx, ly) => ({ x: x + Math.cos(a) * lx - Math.sin(a) * ly, y: y + Math.sin(a) * lx + Math.cos(a) * ly });

  function spawn(p) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push(p);
  }

  // per machine: sporen, uitlaatrook, stof en kaf
  const lastStamp = new Map();
  function machineFx(key, kind, x, y, angle, speed, working, toolKind, toolWidth, dt, throttle) {
    if (!WHEELS[kind]) return;
    const prev = lastStamp.get(key);
    if (!prev || Math.hypot(prev.x - x, prev.y - y) > 1.5) {
      lastStamp.set(key, { x, y });
      if (prev) {
        tctx.save();
        tctx.fillStyle = 'rgba(52,36,18,0.16)';
        for (const [lx, ly, w] of WHEELS[kind]) {
          const p = rot(x, y, angle, lx, ly);
          tctx.translate(p.x, p.y); tctx.rotate(angle);
          tctx.fillRect(-1.2, -w / 2, 2.4, w);
          for (let s = -w / 2 + 0.4; s < w / 2; s += 1.1) { tctx.fillStyle = 'rgba(35,24,12,0.12)'; tctx.fillRect(-0.3, s, 0.6, 0.6); }
          tctx.fillStyle = 'rgba(52,36,18,0.16)';
          tctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        tctx.restore();
      }
    }
    // rook: meer bij optrekken
    const ex = EXHAUST[kind];
    const smokeRate = (Math.abs(speed) > 2 ? 6 : 2) + (throttle ? 8 : 0);
    if (Math.random() < smokeRate * dt) {
      const p = rot(x, y, angle, ex[0], ex[1]);
      spawn({ x: p.x, y: p.y, vx: 8 + Math.random() * 4, vy: -6 - Math.random() * 4, life: 0, max: 1.4, r0: 0.8, r1: 5, c: '70,70,70', a: 0.35 });
    }
    if (!working || speed < 3) return;
    // stof achter het werktuig / kaf achter de maaidorser
    const back = kind === 'harvester' ? -16 : toolKind === 'manure' ? -32 : -21;
    for (let k = 0; k < 2; k++) {
      if (Math.random() > 14 * dt) continue;
      const s = (Math.random() - 0.5) * toolWidth;
      const p = rot(x, y, angle, back, s);
      if (kind === 'harvester') {
        spawn({ x: p.x, y: p.y, vx: -Math.cos(angle) * 10 + Math.random() * 6, vy: -Math.sin(angle) * 10 + Math.random() * 6, life: 0, max: 1.2, r0: 0.6, r1: 1.4, c: '236,206,120', a: 0.7 });
        if (Math.random() < 0.5) spawn({ x: p.x, y: p.y, vx: 4, vy: 3, life: 0, max: 1.6, r0: 2, r1: 8, c: '200,175,110', a: 0.18 });
      } else {
        if (toolKind === 'spreader') {
          spawn({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, life: 0, max: 0.5, r0: 0.6, r1: 0.6, c: '250,250,250', a: 0.9 });
        } else if (toolKind === 'manure') {
          spawn({ x: p.x, y: p.y, vx: -Math.cos(angle) * 25 + (Math.random() - 0.5) * 20, vy: -Math.sin(angle) * 25 + (Math.random() - 0.5) * 20, life: 0, max: 0.7, r0: 1.2, r1: 0.8, c: '74,50,28', a: 0.85 });
        } else {
          spawn({ x: p.x, y: p.y, vx: 5 + Math.random() * 5, vy: 3 + Math.random() * 4, life: 0, max: 1.3, r0: 2, r1: 8, c: toolKind === 'plow' ? '120,88,52' : '150,120,80', a: 0.22 });
        }
      }
    }
  }

  function update(dt) {
    const s = AT.state, p = s.player;
    if (s.paused) return;

    if (p.mode === 'drive') {
      const r = AT.vehicle.rig();
      if (r) {
        const working = p.lowered && r.toolDef;
        machineFx('player', r.mainDef.kind, p.x, p.y, p.angle, p.speed, working, r.toolDef && r.toolDef.kind, r.toolDef ? r.toolDef.width : 0, dt, p.throttle);
      }
    }
    // loonwerkers
    for (const f of s.fields) {
      if (!f.job) continue;
      const def = AT.game.fieldDef(f.id);
      const pos = AT.game.jobPose(def, f.job);
      const main = s.machines.find(m => f.job.machines.includes(m.uid) && ['tractor', 'harvester'].includes(D.machines[m.type].kind));
      if (!main) continue;
      const kind = D.machines[main.type].kind;
      const tk = { plow: 'plow', sow: 'seeder', fertilize: 'spreader', manure: 'manure', harvest: 'harvester' }[f.job.type];
      machineFx('job' + f.id, kind, pos.x, pos.y, pos.angle, 30, !f.job.waiting && f.job.phase !== 'to', tk, 24, dt, false);
    }
    for (const tr of s.trips || []) {
      const main = s.machines.find(m => tr.machines.includes(m.uid) && ['tractor', 'harvester'].includes(D.machines[m.type].kind));
      if (main) machineFx('trip' + tr.id, D.machines[main.type].kind, tr.pos.x, tr.pos.y, tr.pos.angle, 30, false, null, 0, dt, false);
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const q = particles[i];
      q.life += dt;
      if (q.life >= q.max) { particles.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vx *= 0.98; q.vy *= 0.98;
    }

    updateBirds(dt);

    // sporen vervagen langzaam
    fadeTimer += dt;
    if (fadeTimer > 1) {
      fadeTimer = 0;
      tctx.globalCompositeOperation = 'destination-out';
      tctx.fillStyle = 'rgba(0,0,0,0.035)';
      tctx.fillRect(0, 0, tracks.width, tracks.height);
      tctx.globalCompositeOperation = 'source-over';
    }
  }

  // meeuwen: vliegen rond de vijver, of achter je ploeg aan
  function updateBirds(dt) {
    const p = AT.state.player;
    const r = p.mode === 'drive' ? AT.vehicle.rig() : null;
    const plowing = r && p.lowered && r.toolDef && r.toolDef.kind === 'plow' && p.speed > 3;
    birds.forEach((b, i) => {
      b.retarget -= dt;
      if (plowing) {
        const back = rot(p.x, p.y, p.angle, -40 - (i % 3) * 14, ((i % 2) ? 1 : -1) * (8 + i * 3));
        b.tx = back.x + Math.sin(b.ph * 0.3 + i) * 10; b.ty = back.y + Math.cos(b.ph * 0.3 + i) * 10;
      } else if (b.retarget <= 0) {
        b.retarget = 4 + Math.random() * 6;
        const home = D.pond;
        b.tx = home.x + (Math.random() - 0.5) * 500;
        b.ty = home.y + (Math.random() - 0.5) * 300 - 100;
      }
      const dx = b.tx - b.x, dy = b.ty - b.y, d = Math.hypot(dx, dy) || 1;
      const maxV = plowing ? Math.max(70, Math.abs(p.speed) * 1.3) : 55;
      b.vx += dx / d * 60 * dt + (Math.random() - 0.5) * 30 * dt;
      b.vy += dy / d * 60 * dt + (Math.random() - 0.5) * 30 * dt;
      const v = Math.hypot(b.vx, b.vy);
      if (v > maxV) { b.vx *= maxV / v; b.vy *= maxV / v; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.ph += dt * (6 + (i % 3));
    });
  }

  // graan dat van de losbuis/kipper naar het doel stroomt
  function stream(from, to, color, dt) {
    const n = Math.max(1, Math.round(60 * dt));
    const rgb = parseInt(color.slice(1), 16);
    const c = `${(rgb >> 16) & 255},${(rgb >> 8) & 255},${rgb & 255}`;
    for (let k = 0; k < n; k++) {
      const life = 0.35;
      spawn({ x: from.x + (Math.random() - 0.5) * 2, y: from.y + (Math.random() - 0.5) * 2,
        vx: (to.x - from.x) / life * (0.7 + Math.random() * 0.3), vy: (to.y - from.y) / life * (0.7 + Math.random() * 0.3),
        life: 0, max: life, r0: 0.9, r1: 0.6, c, a: 0.95 });
    }
  }

  function drawTracks(ctx) { ctx.drawImage(tracks, 0, 0); }

  function drawParticles(ctx) {
    for (const q of particles) {
      const t = q.life / q.max;
      ctx.fillStyle = `rgba(${q.c},${(q.a * (1 - t)).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(q.x, q.y, q.r0 + (q.r1 - q.r0) * t, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawBirds(ctx) {
    for (const b of birds) {
      const a = Math.atan2(b.vy, b.vx), flap = Math.sin(b.ph);
      // schaduw op de grond
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath(); ctx.ellipse(b.x + 14, b.y + 18, 3.5, 1.5, a, 0, Math.PI * 2); ctx.fill();
      ctx.save();
      ctx.translate(b.x, b.y); ctx.rotate(a);
      const span = 4.5 * (0.55 + 0.45 * Math.abs(flap));
      ctx.strokeStyle = '#e9ecef'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-0.5, 0); ctx.lineTo(-1.8 - flap, -span); ctx.moveTo(-0.5, 0); ctx.lineTo(-1.8 - flap, span); ctx.stroke();
      ctx.strokeStyle = '#555'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-1.8 - flap, -span); ctx.lineTo(-2.3 - flap, -span - 0.8); ctx.moveTo(-1.8 - flap, span); ctx.lineTo(-2.3 - flap, span + 0.8); ctx.stroke();
      ctx.fillStyle = '#fafafa'; ctx.beginPath(); ctx.ellipse(0, 0, 2.6, 1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2b134'; ctx.fillRect(2.4, -0.3, 1, 0.6);
      ctx.restore();
    }
  }

  function reset() { if (tctx) tctx.clearRect(0, 0, tracks.width, tracks.height); particles.length = 0; lastStamp.clear(); }

  AT.fx = { init, update, drawTracks, drawParticles, drawBirds, reset, stream };
})();
