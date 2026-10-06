// Agro Tycoon 2.0 — tekenen: wereld met camera, velden per cel, machines, minimap, HUD
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const C = D.CELL;
  const WW = D.world.w, WH = D.world.h;

  let canvas, ctx, grassPattern, vw = 0, vh = 0, dpr = 1;
  const view = { selected: 1, hover: null };
  const cam = { x: 640, y: 780, zoom: 1.4 };
  const MINI = { w: 210, scale: 210 / WW };

  // per veld een offscreen canvas + cache van wat er per cel getekend is
  const layers = {};

  function init(el) {
    canvas = el;
    ctx = canvas.getContext('2d');
    grassPattern = makeGrassPattern();
    for (const def of D.fields) {
      const c = document.createElement('canvas');
      c.width = def.w; c.height = def.h;
      layers[def.id] = { canvas: c, ctx: c.getContext('2d'), vis: new Uint8Array(def.cols * def.rows).fill(255) };
    }
    AT.cellChanged = (id, i) => drawCell(id, i);
    AT.on('reset', () => { for (const id in layers) layers[id].vis.fill(255); refreshAll(); });
    new ResizeObserver(resize).observe(canvas);
    resize();
    refreshAll();
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    vw = canvas.clientWidth; vh = canvas.clientHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    clampCam();
  }

  // ---------- camera ----------
  function minZoom() { return Math.max(vw / WW, vh / WH, 0.35); }
  function clampCam() {
    cam.zoom = Math.max(minZoom(), Math.min(3, cam.zoom));
    const hw = vw / 2 / cam.zoom, hh = vh / 2 / cam.zoom;
    cam.x = Math.max(hw, Math.min(WW - hw, cam.x));
    cam.y = Math.max(hh, Math.min(WH - hh, cam.y));
  }
  function screenToWorld(sx, sy) { return { x: (sx - vw / 2) / cam.zoom + cam.x, y: (sy - vh / 2) / cam.zoom + cam.y }; }
  function worldToScreen(x, y) { return { x: (x - cam.x) * cam.zoom + vw / 2, y: (y - cam.y) * cam.zoom + vh / 2 }; }
  function eventPos(evt) { const r = canvas.getBoundingClientRect(); return { x: evt.clientX - r.left, y: evt.clientY - r.top }; }
  function zoomAt(sx, sy, factor) {
    const before = screenToWorld(sx, sy);
    cam.zoom *= factor;
    clampCam();
    const after = screenToWorld(sx, sy);
    cam.x += before.x - after.x; cam.y += before.y - after.y;
    clampCam();
  }
  function centerOn(x, y) { cam.x = x; cam.y = y; clampCam(); }

  function fieldAt(x, y) {
    const f = D.fields.find(f => x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h);
    return f ? f.id : null;
  }

  function miniRect() { return { x: vw - MINI.w - 12, y: vh - WH * MINI.scale - 12, w: MINI.w, h: WH * MINI.scale }; }
  function inMinimap(sx, sy) { const m = miniRect(); return sx >= m.x && sx <= m.x + m.w && sy >= m.y && sy <= m.y + m.h; }
  function minimapToWorld(sx, sy) { const m = miniRect(); return { x: (sx - m.x) / MINI.scale, y: (sy - m.y) / MINI.scale }; }

  // camera volgen / verschuiven per frame
  function updateCamera(dt) {
    const p = AT.state.player;
    if (p) {
      const t = Math.min(1, dt * 5);
      cam.x += (p.x - cam.x) * t; cam.y += (p.y - cam.y) * t;
    } else if (AT.vehicle) {
      const pr = AT.vehicle.pressed, sp = 600 / cam.zoom * dt;
      if (pr('KeyW', 'ArrowUp')) cam.y -= sp;
      if (pr('KeyS', 'ArrowDown')) cam.y += sp;
      if (pr('KeyA', 'ArrowLeft')) cam.x -= sp;
      if (pr('KeyD', 'ArrowRight')) cam.x += sp;
    }
    clampCam();
  }

  // ---------- cellen tekenen (offscreen) ----------
  const G = () => AT.game;

  function visKey(f, i) {
    const st = f.cells.state[i];
    if (st !== G().ST.SOWN) return st;
    const stage = G().isReady(f, i) ? 5 : Math.min(4, Math.floor(G().cellGrowth(f, i) * 5));
    return 10 + f.cells.crop[i] * 8 + stage;
  }

  function drawCell(id, i) {
    const def = G().fieldDef(id), f = G().field(id), L = layers[id];
    const key = visKey(f, i);
    L.vis[i] = key;
    const g = L.ctx;
    const x = (i % def.cols) * C, y = Math.floor(i / def.cols) * C;
    const h = hash(id * 100003 + i);

    if (key === 0) { // stoppel
      g.fillStyle = '#c8ad6a'; g.fillRect(x, y, C, C);
      g.fillStyle = '#a88d4a';
      g.fillRect(x + 1 + (h & 1), y + 1, 1, 2);
      g.fillRect(x + 5 - (h & 1), y + 4, 1, 2);
      return;
    }
    // geploegde ondergrond met voren
    g.fillStyle = '#7a5232'; g.fillRect(x, y, C, C);
    g.fillStyle = '#5e3d24'; g.fillRect(x + 1, y, 1, C); g.fillRect(x + 5, y, 1, C);
    if (key === 1) return;

    const cropIdx = Math.floor((key - 10) / 8), stage = (key - 10) % 8;
    const crop = D.crops[G().CROP_KEYS[cropIdx - 1]];
    if (stage === 5) {
      g.fillStyle = crop.color; g.fillRect(x, y, C, C);
      g.fillStyle = 'rgba(120,80,20,0.35)';
      g.fillRect(x + (h & 7), y + ((h >> 3) & 7), 1, 2);
      g.fillRect(x + ((h >> 6) & 7), y + ((h >> 9) & 7), 1, 2);
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x + ((h >> 12) & 7), y + ((h >> 15) & 7), 1, 1);
      if (crop === D.crops.corn) { g.fillStyle = '#4f9a3a'; g.fillRect(x + 1 + (h & 3), y + 1, 2, 3); }
      return;
    }
    const size = 1 + stage;
    g.fillStyle = stage >= 4 ? mix(crop.growColor, crop.color, 0.5) : crop.growColor;
    g.fillRect(x + 3.5 - size / 2, y + 2 - size / 2 + 1, size, size);
    if (stage >= 2) g.fillRect(x + 3.5 - size / 2, y + 6 - size / 2, size, size - 1);
  }

  // groei-stadia veranderen met de tijd: elk frame een stuk van de velden controleren
  let scanField = 0;
  function refreshSome(count) {
    for (let k = 0; k < count; k++) {
      const def = D.fields[scanField];
      scanField = (scanField + 1) % D.fields.length;
      const f = G().field(def.id), L = layers[def.id];
      for (let i = 0; i < L.vis.length; i++) if (visKey(f, i) !== L.vis[i]) drawCell(def.id, i);
    }
  }
  function refreshAll() { refreshSome(D.fields.length); }

  // ---------- achtergrond, wegen, erf ----------
  function makeGrassPattern() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#7cb95a'; g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 140; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#6faa4e' : '#8bc566';
      g.fillRect(Math.floor(Math.random() * 64), Math.floor(Math.random() * 64), 2, 2);
    }
    return ctx.createPattern(c, 'repeat');
  }

  function drawWorldBase() {
    ctx.fillStyle = grassPattern;
    ctx.fillRect(0, 0, WW, WH);
    ctx.fillStyle = '#c9b08a';
    for (const r of D.roads) ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    for (const r of D.roads) {
      if (r.w > r.h) ctx.fillRect(r.x, r.y + r.h / 2 - 1, r.w, 2);
      else ctx.fillRect(r.x + r.w / 2 - 1, r.y, 2, r.h);
    }
  }

  function drawYard(state) {
    const Y = D.yard;
    ctx.fillStyle = '#b9b3a4';
    roundRect(Y.x, Y.y, Y.w, Y.h, 8); ctx.fill();
    // inrit naar de weg
    ctx.fillStyle = '#b9b3a4';
    ctx.fillRect(Y.x + Y.w - 4, 800, 28, 44);

    // boerderij
    ctx.fillStyle = '#efe6d2'; ctx.fillRect(60, 640, 110, 80);
    ctx.fillStyle = '#8e3b2e';
    ctx.beginPath(); ctx.moveTo(52, 646); ctx.lineTo(115, 612); ctx.lineTo(178, 646); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5b3a29'; ctx.fillRect(106, 686, 18, 34);
    ctx.fillStyle = '#9fd3f0'; ctx.fillRect(72, 658, 18, 14); ctx.fillRect(140, 658, 18, 14);

    // silo's (aantal = niveau + 1) met vulling
    const fill = G().siloCapacity() ? G().siloUsed() / G().siloCapacity() : 0;
    for (let i = 0; i <= state.siloLevel; i++) {
      const cx = 210 + (i % 4) * 34, cy = 624 + Math.floor(i / 4) * 70;
      ctx.fillStyle = '#9aa4ad'; ctx.fillRect(cx - 14, cy, 28, 64);
      ctx.fillStyle = '#e0b84c'; ctx.fillRect(cx - 14, cy + 64 - 64 * fill, 28, 64 * fill);
      ctx.strokeStyle = '#5f6a73'; ctx.lineWidth = 1.5; ctx.strokeRect(cx - 14, cy, 28, 64);
      ctx.fillStyle = '#7d8790'; ctx.beginPath(); ctx.ellipse(cx, cy, 14, 6, 0, Math.PI, 0); ctx.fill();
    }

    // schuur met open deur naar de weg
    ctx.fillStyle = '#a0522d'; ctx.fillRect(60, 760, 290, 140);
    ctx.fillStyle = '#6e3a20'; ctx.fillRect(60, 752, 290, 12);
    ctx.fillStyle = '#d7c7a8'; ctx.fillRect(72, 776, 266, 112);
    ctx.fillStyle = '#d7c7a8'; ctx.fillRect(340, 804, 10, 36);

    const free = state.machines.filter(m => !m.busy);
    free.slice(0, 15).forEach((m, i) => drawMachine(m.type, 96 + (i % 5) * 50, 798 + Math.floor(i / 5) * 34, 0));

    // graanhandel
    ctx.fillStyle = '#ece6d6'; roundRect(60, 920, 290, 90, 8); ctx.fill();
    ctx.fillStyle = '#3d5a80'; ctx.fillRect(110, 950, 110, 38);
    ctx.fillStyle = '#98c1d9'; ctx.fillRect(220, 958, 32, 30);
    ctx.fillStyle = '#222';
    [126, 194, 236].forEach(x => { ctx.beginPath(); ctx.arc(x, 990, 7, 0, Math.PI * 2); ctx.fill(); });
  }

  // ---------- velden ----------
  function drawFields(state) {
    ctx.imageSmoothingEnabled = false;
    for (const def of D.fields) {
      const f = state.fields.find(x => x.id === def.id);
      ctx.drawImage(layers[def.id].canvas, def.x, def.y);
      if (!f.owned) {
        ctx.fillStyle = 'rgba(110,165,80,0.82)';
        ctx.fillRect(def.x, def.y, def.w, def.h);
        ctx.strokeStyle = 'rgba(40,80,30,0.3)'; ctx.lineWidth = 1.5;
        ctx.save(); ctx.beginPath(); ctx.rect(def.x, def.y, def.w, def.h); ctx.clip();
        for (let i = -def.h; i < def.w; i += 18) { ctx.beginPath(); ctx.moveTo(def.x + i, def.y + def.h); ctx.lineTo(def.x + i + def.h, def.y); ctx.stroke(); }
        ctx.restore();
      }
      const sel = view.selected === def.id, hov = view.hover === def.id;
      ctx.lineWidth = (sel ? 3 : 1.5) / cam.zoom * 1.5;
      ctx.strokeStyle = sel ? '#ffffff' : hov ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.25)';
      ctx.strokeRect(def.x, def.y, def.w, def.h);
    }
  }

  // labels in schermcoördinaten zodat ze leesbaar blijven bij elke zoom
  function drawFieldLabels(state, sums) {
    for (const def of D.fields) {
      const f = state.fields.find(x => x.id === def.id);
      const tl = worldToScreen(def.x, def.y), br = worldToScreen(def.x + def.w, def.y + def.h);
      if (br.x < 0 || br.y < 0 || tl.x > vw || tl.y > vh) continue;
      if (br.x - tl.x < 110 || br.y - tl.y < 70) continue; // te klein om leesbaar te labelen
      pill(`Veld ${def.id} · ${AT.fmtHa(def.ha)}`, tl.x + 6, tl.y + 6);
      const cx = (tl.x + br.x) / 2, cy = (tl.y + br.y) / 2 + 8;
      const sum = sums[def.id];
      if (!f.owned) pill('Te koop ' + AT.fmtMoney(G().fieldPrice(def.id)), cx, cy - 9, true, '#2d6a2d');
      else if (f.job) pill('Loonwerker bezig ' + Math.floor(f.job.progress * 100) + '%', cx, cy - 9, true, 'rgba(44,127,184,0.9)');
      else if (sum && sum.ready > 0 && sum.growing === 0) pill('Klaar om te oogsten', cx, cy - 9, true, '#b7791f');
    }
  }

  // ---------- machines ----------
  function drawMachine(type, x, y, angle, implType, lowered = true) {
    const d = D.machines[type];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(1.4, 1.4);
    if (d.kind === 'harvester') {
      const hw = d.width / 2 / 1.4;
      ctx.fillStyle = '#333'; ctx.fillRect(-8, -10, 6, 4); ctx.fillRect(-8, 6, 6, 4);
      ctx.fillStyle = d.color; ctx.fillRect(-12, -8, 22, 16);
      ctx.fillStyle = '#9fd3f0'; ctx.fillRect(2, -4, 6, 8);
      ctx.fillStyle = lowered ? '#555' : '#888'; ctx.fillRect(10, -hw, 4, hw * 2);
    } else if (d.kind === 'tractor') {
      if (implType) {
        const idf = D.machines[implType], hw = idf.width / 2 / 1.4;
        ctx.fillStyle = '#444'; ctx.fillRect(-14, -1, 6, 2);
        ctx.fillStyle = idf.color; ctx.globalAlpha = lowered ? 1 : 0.75;
        ctx.fillRect(-19, -hw, 5, hw * 2);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#222';
      ctx.fillRect(-8, -8, 7, 4); ctx.fillRect(-8, 4, 7, 4);
      ctx.fillRect(3, -6, 4, 3); ctx.fillRect(3, 3, 4, 3);
      ctx.fillStyle = d.color; ctx.fillRect(-8, -4, 17, 8);
      ctx.fillStyle = '#cfe8f5'; ctx.fillRect(-6, -3, 6, 6);
    } else {
      ctx.fillStyle = d.color; ctx.fillRect(-4, -8, 8, 16);
      ctx.fillStyle = '#444'; ctx.fillRect(4, -1, 5, 2);
    }
    ctx.restore();
  }

  function drawWorkers(state) {
    for (const f of state.fields) {
      if (!f.job) continue;
      const def = G().fieldDef(f.id);
      const pos = G().jobPosition(def, f.job);
      const ms = state.machines.filter(m => f.job.machines.includes(m.uid));
      const main = ms.find(m => ['tractor', 'harvester'].includes(D.machines[m.type].kind));
      const impl = ms.find(m => m !== main);
      if (main) drawMachine(main.type, pos.x, pos.y, pos.angle, impl && impl.type);
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (!p) return;
    const r = AT.vehicle.rig();
    // stofwolkje bij werken
    if (p.lowered && Math.abs(p.speed) > 3) {
      ctx.fillStyle = 'rgba(120,90,50,0.22)';
      for (let k = 1; k <= 3; k++) {
        ctx.beginPath();
        ctx.arc(p.x - Math.cos(p.angle) * (22 + k * 6) + (Math.random() - 0.5) * 6, p.y - Math.sin(p.angle) * (22 + k * 6), 3 + k * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    drawMachine(r.main.type, p.x, p.y, p.angle, r.impl && r.impl.type, p.lowered);
    // markering
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 / cam.zoom;
    ctx.beginPath(); ctx.arc(p.x, p.y, 20, 0, Math.PI * 2); ctx.stroke();
  }

  // ---------- minimap & HUD (schermcoördinaten) ----------
  const MINI_COLORS = { stubble: '#c8ad6a', plowed: '#7a5232', growing: '#7fb24a', ready: '#e0b84c' };
  function drawMinimap(state, sums) {
    const m = miniRect(), s = MINI.scale;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(m.x - 4, m.y - 4, m.w + 8, m.h + 8, 6); ctx.fill();
    ctx.fillStyle = '#7cb95a'; ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.fillStyle = '#c9b08a';
    for (const r of D.roads) ctx.fillRect(m.x + r.x * s, m.y + r.y * s, Math.max(1, r.w * s), Math.max(1, r.h * s));
    ctx.fillStyle = '#b9b3a4';
    ctx.fillRect(m.x + D.yard.x * s, m.y + D.yard.y * s, D.yard.w * s, D.yard.h * s);
    for (const def of D.fields) {
      const f = state.fields.find(x => x.id === def.id), sum = sums[def.id];
      let col = '#5f9a45';
      if (f.owned && sum) {
        const top = ['ready', 'growing', 'plowed', 'stubble'].reduce((a, k) => sum[k] > sum[a] ? k : a, 'stubble');
        col = MINI_COLORS[top];
      }
      ctx.fillStyle = col;
      ctx.fillRect(m.x + def.x * s, m.y + def.y * s, def.w * s, def.h * s);
      if (view.selected === def.id) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(m.x + def.x * s, m.y + def.y * s, def.w * s, def.h * s); }
    }
    // zichtbaar gebied
    const tl = screenToWorld(0, 0);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.strokeRect(m.x + tl.x * s, m.y + tl.y * s, vw / cam.zoom * s, vh / cam.zoom * s);
    if (state.player) {
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath(); ctx.arc(m.x + state.player.x * s, m.y + state.player.y * s, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawHud() {
    const info = AT.vehicle && AT.vehicle.hudInfo();
    const lines = [];
    if (info) {
      lines.push([info.name, '#fff', '700 14px']);
      lines.push([`${info.kmh} km/u`, '#ffe08a', '700 20px']);
      if (info.tool) lines.push([`${info.tool}: ${info.lowered ? 'OMLAAG (aan het werk)' : 'omhoog'}`, info.lowered ? '#9be15d' : '#ddd', '600 13px']);
      if (info.crop) lines.push([`Zaaigoed: ${info.crop}  (C = wisselen)`, '#ddd', '600 13px']);
      lines.push(['WASD/pijltjes rijden · Spatie werktuig · E uitstappen', '#bbb', '12px']);
      if (info.warn) lines.push([info.warn, '#ffb38a', '700 13px']);
    } else {
      lines.push(['Camera: WASD/pijltjes of slepen · scroll = zoom', '#ddd', '12px']);
      lines.push(['Zelf rijden: Garage → Instappen (of E)', '#ddd', '12px']);
    }
    let w = 0;
    lines.forEach(([t, , f]) => { ctx.font = `${f} system-ui, sans-serif`; w = Math.max(w, ctx.measureText(t).width); });
    const lh = 20, h = lines.length * lh + 12;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(12, 12, w + 24, h, 8); ctx.fill();
    lines.forEach(([t, col, f], i) => {
      ctx.font = `${f} system-ui, sans-serif`; ctx.fillStyle = col;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(t, 24, 12 + 6 + lh / 2 + i * lh);
    });
  }

  // ---------- kleine helpers ----------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function pill(text, x, y, centered = false, bg = 'rgba(0,0,0,0.55)') {
    ctx.font = '600 12px system-ui, sans-serif';
    const tw = ctx.measureText(text).width;
    const px = centered ? x - tw / 2 - 7 : x;
    ctx.fillStyle = bg; roundRect(px, y, tw + 14, 20, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, px + 7, y + 10.5);
  }

  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = s => [(s >> 16) & 255, (s >> 8) & 255, s & 255];
    const [ar, ag, ab] = ch(pa), [br, bg, bb] = ch(pb);
    const c = (p, q) => Math.round(p + (q - p) * t);
    return `rgb(${c(ar, br)},${c(ag, bg)},${c(ab, bb)})`;
  }

  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); return (n ^ (n >>> 15)) >>> 0; }

  // ---------- hoofd-tekenfunctie ----------
  let sums = {}, sumTimer = 1;
  function draw(state, dt) {
    if (!vw || !vh) return;
    updateCamera(dt);
    refreshSome(2);
    sumTimer += dt;
    if (sumTimer > 0.5) { sumTimer = 0; sums = {}; for (const f of state.fields) sums[f.id] = G().summary(f); }

    ctx.setTransform(dpr * cam.zoom, 0, 0, dpr * cam.zoom, dpr * (vw / 2 - cam.x * cam.zoom), dpr * (vh / 2 - cam.y * cam.zoom));
    drawWorldBase();
    drawYard(state);
    drawFields(state);
    drawWorkers(state);
    drawPlayer(state);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const h = G().hour();
    let dark = 0;
    if (h < 6) dark = 0.4 - h * 0.05;
    else if (h > 19) dark = Math.min(0.4, (h - 19) * 0.08);
    if (dark > 0) { ctx.fillStyle = `rgba(10,20,60,${dark})`; ctx.fillRect(0, 0, vw, vh); }
    drawFieldLabels(state, sums);
    drawMinimap(state, sums);
    drawHud();
  }

  AT.render = {
    init, draw, view, cam, screenToWorld, eventPos, fieldAt, zoomAt, centerOn,
    inMinimap, minimapToWorld, refreshAll,
  };
})();
