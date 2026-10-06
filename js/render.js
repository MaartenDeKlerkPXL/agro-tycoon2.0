// Agro Tycoon 2.0 — tekenen: wereld, camera, velden per cel, machines, licht, minimap, HUD
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const C = D.CELL;
  const WW = D.world.w, WH = D.world.h;
  const FS = 2; // resolutie van de veldlagen (pixels per wereld-eenheid)
  const SP = () => AT.sprites;
  const G = () => AT.game;

  let canvas, ctx, bg, vw = 0, vh = 0, dpr = 1, time = 0;
  let lightCanvas, lctx;
  const view = { selected: 1, hover: null };
  const cam = { x: 340, y: 820, zoom: 2, free: false };
  const MINI = { w: 210, scale: 210 / WW };
  const layers = {};
  let trees = [];

  function init(el) {
    canvas = el;
    ctx = canvas.getContext('2d');
    lightCanvas = document.createElement('canvas');
    lctx = lightCanvas.getContext('2d');
    for (const def of D.fields) {
      const c = document.createElement('canvas');
      c.width = def.w * FS; c.height = def.h * FS;
      const g = c.getContext('2d');
      g.setTransform(FS, 0, 0, FS, 0, 0);
      layers[def.id] = { canvas: c, ctx: g, vis: new Uint32Array(def.cols * def.rows).fill(0xffffffff) };
    }
    trees = placeTrees();
    bg = paintBackground();
    AT.fx.init();
    AT.cellChanged = (id, i) => drawCell(id, i);
    AT.on('reset', () => { for (const id in layers) layers[id].vis.fill(0xffffffff); refreshAll(); AT.fx.reset(); cam.free = false; });
    new ResizeObserver(resize).observe(canvas);
    resize();
    refreshAll();
    const p = AT.state.player;
    cam.x = p.x; cam.y = p.y;
  }

  function resize() {
    dpr = window.devicePixelRatio || 1;
    vw = canvas.clientWidth; vh = canvas.clientHeight;
    canvas.width = Math.round(vw * dpr); canvas.height = Math.round(vh * dpr);
    lightCanvas.width = canvas.width; lightCanvas.height = canvas.height;
    clampCam();
  }

  // ---------- camera ----------
  function minZoom() { return Math.max(vw / WW, vh / WH, 0.35); }
  function clampCam() {
    cam.zoom = Math.max(minZoom(), Math.min(4, cam.zoom));
    const hw = vw / 2 / cam.zoom, hh = vh / 2 / cam.zoom;
    cam.x = Math.max(hw, Math.min(WW - hw, cam.x));
    cam.y = Math.max(hh, Math.min(WH - hh, cam.y));
  }
  function screenToWorld(sx, sy) { return { x: (sx - vw / 2) / cam.zoom + cam.x, y: (sy - vh / 2) / cam.zoom + cam.y }; }
  function worldToScreen(x, y) { return { x: (x - cam.x) * cam.zoom + vw / 2, y: (y - cam.y) * cam.zoom + vh / 2 }; }
  function eventPos(evt) { const r = canvas.getBoundingClientRect(); return { x: evt.clientX - r.left, y: evt.clientY - r.top }; }
  function zoomAt(sx, sy, factor) {
    const before = screenToWorld(sx, sy);
    cam.zoom *= factor; clampCam();
    const after = screenToWorld(sx, sy);
    cam.x += before.x - after.x; cam.y += before.y - after.y;
    clampCam();
  }
  // camera los van de speler zetten (slepen, minimap, "zoek op kaart")
  function centerOn(x, y) { cam.x = x; cam.y = y; cam.free = true; clampCam(); }

  function fieldAt(x, y) {
    const f = D.fields.find(f => x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h);
    return f ? f.id : null;
  }

  function miniRect() { return { x: vw - MINI.w - 12, y: vh - WH * MINI.scale - 12, w: MINI.w, h: WH * MINI.scale }; }
  function inMinimap(sx, sy) { const m = miniRect(); return sx >= m.x && sx <= m.x + m.w && sy >= m.y && sy <= m.y + m.h; }
  function minimapToWorld(sx, sy) { const m = miniRect(); return { x: (sx - m.x) / MINI.scale, y: (sy - m.y) / MINI.scale }; }

  function updateCamera(dt) {
    const p = AT.state.player;
    if (AT.input.moved) { cam.free = false; AT.input.moved = 0; }
    if (!cam.free) {
      const t = Math.min(1, dt * 5);
      cam.x += (p.x - cam.x) * t; cam.y += (p.y - cam.y) * t;
    }
    clampCam();
  }

  // ---------- willekeur met vaste uitkomst ----------
  function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = n + (n << 3); n = n ^ (n >>> 4); n = Math.imul(n, 0x27d4eb2d); return (n ^ (n >>> 15)) >>> 0; }
  function rng(seed) { let s = seed % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

  // ---------- achtergrond (één keer getekend) ----------
  function inRect(x, y, r, m) { return x > r.x - m && x < r.x + r.w + m && y > r.y - m && y < r.y + r.h + m; }
  function inPond(x, y, m) { const p = D.pond; return ((x - p.x) / (p.rx + m)) ** 2 + ((y - p.y) / (p.ry + m)) ** 2 < 1; }

  function placeTrees() {
    const rnd = rng(4242), list = [];
    for (let k = 0; k < 14000 && list.length < 700; k++) {
      const x = rnd() * WW, y = rnd() * WH;
      const variant = Math.floor(rnd() * 9);
      const R = SP().treeSprite(variant).R;
      if (D.fields.some(f => inRect(x, y, f, R * 0.55))) continue;
      if (D.roads.some(r => inRect(x, y, r, R * 0.3))) continue;
      if (inRect(x, y, D.yard, R + 4) || inPond(x, y, R + 6)) continue;
      if (Object.values(D.animals).some(a => inRect(x, y, a.pen, R + 3))) continue;
      if (Object.values(D.factories).some(f => inRect(x, y, f.lot, R + 3))) continue;
      if (inRect(x, y, D.trader.lot, R + 3)) continue;
      if (D.greenhouse.lots.some(l => inRect(x, y, l, R + 3)) || inRect(x, y, D.woodlot.area, R + 2)) continue;
      if (Object.values(D.plantations).some(pl => inRect(x, y, pl.area, R + 2))) continue;
      if (Object.values(D.sellPoints).some(sp => sp.lot && inRect(x, y, sp.lot, R + 3))) continue;
      if (x < 395 && y > D.yard.y + D.yard.gate.y - D.yard.y - 30 && y < D.yard.gate.y + D.yard.gate.h + 30) continue; // inrit vrijhouden
      if (list.some(t => Math.hypot(t.x - x, t.y - y) < (t.R + R) * 0.75)) continue;
      list.push({ x, y, variant, R, seed: k });
    }
    return list;
  }

  function paintBackground() {
    const c = document.createElement('canvas');
    c.width = WW; c.height = WH;
    const g = c.getContext('2d');
    const rnd = rng(777);
    // gras met vlekken en sprietjes
    g.fillStyle = '#6dab4b'; g.fillRect(0, 0, WW, WH);
    const blot = ['#5f9d40', '#7bb957', '#68a646', '#86c060', '#5a963f'];
    for (let i = 0; i < 3500; i++) {
      g.globalAlpha = 0.12 + rnd() * 0.1;
      g.fillStyle = blot[Math.floor(rnd() * blot.length)];
      g.beginPath(); g.ellipse(rnd() * WW, rnd() * WH, 8 + rnd() * 45, 6 + rnd() * 30, rnd() * 3, 0, Math.PI * 2); g.fill();
    }
    g.globalAlpha = 0.55;
    const blade = ['#5a963d', '#8cc764', '#79b553', '#4f8a36'];
    for (let i = 0; i < 90000; i++) { g.fillStyle = blade[i & 3]; g.fillRect(rnd() * WW, rnd() * WH, 1, 2); }
    g.globalAlpha = 1;
    const flowers = ['#f4f1e6', '#f2d84b', '#d86ca5', '#9db7f0', '#ffffff'];
    for (let i = 0; i < 2500; i++) { g.fillStyle = flowers[i % 5]; g.fillRect(rnd() * WW, rnd() * WH, 1.2, 1.2); }

    // vijver
    const P = D.pond;
    g.fillStyle = '#c8b682'; g.beginPath(); g.ellipse(P.x, P.y, P.rx + 6, P.ry + 5, 0, 0, Math.PI * 2); g.fill();
    const wg = g.createRadialGradient(P.x - 20, P.y - 8, 5, P.x, P.y, P.rx);
    wg.addColorStop(0, '#5aa6d1'); wg.addColorStop(0.7, '#3a7fb0'); wg.addColorStop(1, '#2b6590');
    g.fillStyle = wg; g.beginPath(); g.ellipse(P.x, P.y, P.rx, P.ry, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(P.x - 30 + i * 14, P.y - 10 + (i % 2) * 14, 10, 2, 0, 0, Math.PI); g.stroke(); }
    for (let i = 0; i < 9; i++) {
      const a = rnd() * Math.PI * 2, d = 0.4 + rnd() * 0.45;
      g.fillStyle = '#4c8f3a'; g.beginPath(); g.arc(P.x + Math.cos(a) * P.rx * d, P.y + Math.sin(a) * P.ry * d, 3 + rnd() * 2, 0.3, Math.PI * 2); g.fill();
      if (rnd() < 0.4) { g.fillStyle = '#f7c6d9'; g.fillRect(P.x + Math.cos(a) * P.rx * d - 0.8, P.y + Math.sin(a) * P.ry * d - 0.8, 1.6, 1.6); }
    }
    g.strokeStyle = '#3d6b2a'; g.lineWidth = 0.8;
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2, x = P.x + Math.cos(a) * (P.rx + 1), y = P.y + Math.sin(a) * (P.ry + 1);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 3, y - 4 - rnd() * 4); g.stroke();
    }

    drawHedgesAndDitches(g, rnd);

    // weides voor de dieren: wat frisser gras
    for (const a of Object.values(D.animals)) {
      g.fillStyle = 'rgba(140,200,90,0.25)'; g.fillRect(a.pen.x, a.pen.y, a.pen.w, a.pen.h);
      for (let i = 0; i < 300; i++) { g.fillStyle = i % 2 ? 'rgba(90,150,60,0.4)' : 'rgba(180,220,120,0.4)'; g.fillRect(a.pen.x + rnd() * a.pen.w, a.pen.y + rnd() * a.pen.h, 2, 1); }
    }

    // erf: bestrating met tegels
    const Y = D.yard;
    g.fillStyle = '#bdb6a7'; g.fillRect(Y.x, Y.y, Y.w, Y.h);
    g.fillRect(Y.x + Y.w - 2, Y.gate.y, 24, Y.gate.h); // inrit naar de weg
    g.strokeStyle = 'rgba(0,0,0,0.07)'; g.lineWidth = 0.8;
    for (let x = Y.x; x <= Y.x + Y.w; x += 16) { g.beginPath(); g.moveTo(x, Y.y); g.lineTo(x, Y.y + Y.h); g.stroke(); }
    for (let y = Y.y; y <= Y.y + Y.h; y += 16) { g.beginPath(); g.moveTo(Y.x, y); g.lineTo(Y.x + Y.w, y); g.stroke(); }
    for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(80,70,50,${0.05 + rnd() * 0.06})`; g.beginPath(); g.ellipse(Y.x + rnd() * Y.w, Y.y + rnd() * Y.h, 3 + rnd() * 10, 2 + rnd() * 6, rnd() * 3, 0, Math.PI * 2); g.fill(); }
    // parkeerplaats
    const PK = D.parking;
    g.fillStyle = '#8e8d87'; g.fillRect(PK.x, PK.y, PK.w, PK.h);
    for (let i = 0; i < 400; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'; g.fillRect(PK.x + rnd() * PK.w, PK.y + rnd() * PK.h, 2, 2); }
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1;
    for (const y of [859, 909, 959]) { g.setLineDash([8, 6]); g.beginPath(); g.moveTo(PK.x + 6, y); g.lineTo(PK.x + PK.w - 6, y); g.stroke(); }
    g.setLineDash([]);
    // tuintje bij het huis
    const H = D.house;
    g.fillStyle = '#5f9e44'; g.fillRect(H.x - 4, H.y + H.h + 6, H.w + 8, 10);
    for (let i = 0; i < 40; i++) { g.fillStyle = flowers[i % 4]; g.fillRect(H.x + rnd() * H.w, H.y + H.h + 7 + rnd() * 8, 1.6, 1.6); }
    return c;
  }

  // ---------- hagen langs sommige akkers, sloten tussen buurvelden ----------
  const overlap = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
  const roadIn = r => D.roads.some(q => q.x < r.x + r.w && q.x + q.w > r.x && q.y < r.y + r.h && q.y + q.h > r.y);
  function edgeStrips() {
    const ditches = [], hedges = [], F = D.fields;
    // sloot: smalle strook gras tussen twee velden zonder weg ertussen
    for (const a of F) for (const b of F) {
      const gx = b.x - (a.x + a.w), oy = overlap(a.y, a.y + a.h, b.y, b.y + b.h);
      if (gx >= 8 && gx <= 40 && oy > 40) { const r = { x: a.x + a.w, y: Math.max(a.y, b.y), w: gx, h: oy }; if (!roadIn(r)) ditches.push({ r, vertical: true }); }
      const gy = b.y - (a.y + a.h), ox = overlap(a.x, a.x + a.w, b.x, b.x + b.w);
      if (gy >= 8 && gy <= 40 && ox > 40) { const r = { x: Math.max(a.x, b.x), y: a.y + a.h, w: ox, h: gy }; if (!roadIn(r)) ditches.push({ r, vertical: false }); }
    }
    // haag: strook tussen een akker en de weg (niet aan elke kant)
    for (const f of F) {
      const sides = [
        { r: { x: f.x - 20, y: f.y, w: 20, h: f.h }, vertical: true }, { r: { x: f.x + f.w, y: f.y, w: 20, h: f.h }, vertical: true },
        { r: { x: f.x, y: f.y - 20, w: f.w, h: 20 }, vertical: false }, { r: { x: f.x, y: f.y + f.h, w: f.w, h: 20 }, vertical: false },
      ];
      sides.forEach((sd, k) => {
        if (hash(f.id * 7 + k * 13) % 3 !== 0) return;
        // er moet een weg naast liggen, maar niet in de strook zelf
        const probe = sd.vertical ? { x: sd.r.x - 22, y: sd.r.y, w: sd.r.w + 44, h: sd.r.h } : { x: sd.r.x, y: sd.r.y - 22, w: sd.r.w, h: sd.r.h + 44 };
        const strip = sd.vertical ? { x: sd.r.x + 6, y: sd.r.y, w: 8, h: sd.r.h } : { x: sd.r.x, y: sd.r.y + 6, w: sd.r.w, h: 8 };
        if (roadIn(strip) || !roadIn(probe)) return;
        if (ditches.some(d => overlap(d.r.x, d.r.x + d.r.w, strip.x, strip.x + strip.w) > 0 && overlap(d.r.y, d.r.y + d.r.h, strip.y, strip.y + strip.h) > 0)) return;
        hedges.push(sd);
      });
    }
    return { ditches, hedges };
  }
  function drawHedgesAndDitches(g, rnd) {
    const { ditches, hedges } = edgeStrips();
    for (const { r, vertical } of ditches) {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const bank = vertical ? { x: cx - 5, y: r.y + 4, w: 10, h: r.h - 8 } : { x: r.x + 4, y: cy - 5, w: r.w - 8, h: 10 };
      const water = vertical ? { x: cx - 2.5, y: r.y + 6, w: 5, h: r.h - 12 } : { x: r.x + 6, y: cy - 2.5, w: r.w - 12, h: 5 };
      g.fillStyle = '#5c7f3a'; g.fillRect(bank.x, bank.y, bank.w, bank.h);
      g.fillStyle = '#3f6f8f'; g.fillRect(water.x, water.y, water.w, water.h);
      g.fillStyle = 'rgba(170,215,240,0.45)';
      const len = vertical ? water.h : water.w;
      for (let s = 4; s < len; s += 9 + rnd() * 8) vertical ? g.fillRect(water.x + 1, water.y + s, 1.2, 3) : g.fillRect(water.x + s, water.y + 1, 3, 1.2);
      // riet en gele lis langs de kant
      for (let s = 2; s < len; s += 5 + rnd() * 6) {
        const side = rnd() < 0.5 ? -1 : 1;
        const px = vertical ? cx + side * 4 : water.x + s, py = vertical ? water.y + s : cy + side * 4;
        g.fillStyle = rnd() < 0.15 ? '#e8c43a' : '#3d6b2a'; g.fillRect(px - 0.5, py - 1.5, 1, 3);
      }
    }
    for (const { r, vertical } of hedges) {
      const len = vertical ? r.h : r.w, mid = len / 2;
      for (let s = 4; s < len - 4; s += 3.2) {
        if (Math.abs(s - mid) < 18) continue;   // opening om het veld in te rijden
        const x = vertical ? r.x + r.w / 2 + (rnd() - 0.5) * 2 : r.x + s, y = vertical ? r.y + s : r.y + r.h / 2 + (rnd() - 0.5) * 2;
        const rad = 3 + rnd() * 1.6;
        g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.arc(x + 1.5, y + 2, rad, 0, Math.PI * 2); g.fill();
        g.fillStyle = rnd() < 0.5 ? '#3e7a2c' : '#356b26'; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(140,190,90,0.45)'; g.beginPath(); g.arc(x - rad * 0.3, y - rad * 0.3, rad * 0.45, 0, Math.PI * 2); g.fill();
        if (rnd() < 0.06) { g.fillStyle = '#f4f1e6'; g.fillRect(x, y, 1, 1); }   // meidoornbloesem
      }
    }
  }

  // ---------- seizoenen ----------
  // kleurlaag over gras/akkers per seizoen; de eerste dag van een seizoen loopt over
  const SEASON_TINT = [null, 'rgba(230,200,90,0.10)', 'rgba(190,125,45,0.24)', 'rgba(242,246,250,0.78)'];
  function seasonBlend() {
    if (!AT.weather) return [[0, 1]];
    const se = AT.weather.season(), p = AT.weather.seasonProgress();
    if (AT.state.time < D.daysPerSeason * 24) return [[se, 1]]; // nieuw spel: meteen lente
    const k = Math.min(1, p * D.daysPerSeason); // eerste dag = overgang
    return k < 1 ? [[(se + 3) % 4, 1 - k], [se, k]] : [[se, 1]];
  }
  function drawSeasonTint(alphaScale = 1) {
    const v = visibleRect(10);
    for (const [se, k] of seasonBlend()) {
      const tint = SEASON_TINT[se];
      if (!tint || k <= 0) continue;
      ctx.globalAlpha = k * alphaScale;
      ctx.fillStyle = tint; ctx.fillRect(v.x0, v.y0, v.x1 - v.x0, v.y1 - v.y0);
    }
    ctx.globalAlpha = 1;
  }
  // de bomen tonen het seizoen waar we het meest in zitten
  function treeSeason() { const b = seasonBlend(); return b.length > 1 && b[1][1] < 0.5 ? b[0][0] : b[b.length - 1][0]; }

  function drawPondIce() {
    const ice = seasonBlend().reduce((a, [se, k]) => a + (se === 3 ? k : 0), 0);
    if (!ice) return;
    const P = D.pond;
    ctx.globalAlpha = ice * 0.85;
    ctx.fillStyle = '#dcebf3'; ctx.beginPath(); ctx.ellipse(P.x, P.y, P.rx, P.ry, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 0.8;
    for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(P.x - 80 + k * 30, P.y - 20); ctx.lineTo(P.x - 60 + k * 30, P.y + 15); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }

  // ---------- weer ----------
  const clouds = Array.from({ length: 16 }, (_, k) => ({ x: (k * 397) % WW, y: (k * 613) % WH, r: 90 + (k * 37) % 120, s: 0.6 + (k % 5) * 0.12 }));
  const drops = Array.from({ length: 450 }, () => ({ x: Math.random(), y: Math.random(), l: 0.6 + Math.random() * 0.6 }));
  let flash = 0, flashTimer = 3;

  function weatherType() { return AT.state.weather ? AT.state.weather.type : 'sun'; }

  // wolkenschaduwen die over de kaart drijven
  function drawCloudShadows(dt) {
    const type = weatherType();
    const count = { sun: 4, clouds: 12, rain: 16, storm: 16, snow: 14 }[type];
    for (let k = 0; k < count; k++) {
      const c = clouds[k];
      c.x += 14 * c.s * dt; c.y += 5 * c.s * dt;
      if (c.x - c.r > WW) c.x = -c.r;
      if (c.y - c.r > WH) c.y = -c.r;
      const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
      g.addColorStop(0, 'rgba(20,30,40,0.16)'); g.addColorStop(1, 'rgba(20,30,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, c.r * 1.4, c.r, 0.3, 0, Math.PI * 2); ctx.fill();
    }
  }

  // regen, sneeuw, onweer: in schermcoördinaten
  function drawPrecipitation(dt) {
    const type = weatherType();
    const tint = { clouds: 'rgba(60,70,85,0.10)', rain: 'rgba(40,50,70,0.22)', storm: 'rgba(20,25,45,0.36)', snow: 'rgba(210,220,235,0.12)' }[type];
    if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, vw, vh); }
    const paused = AT.state.paused;
    if (type === 'rain' || type === 'storm') {
      const n = type === 'storm' ? 450 : 260;
      ctx.strokeStyle = 'rgba(200,215,235,0.45)'; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < n; k++) {
        const d = drops[k];
        if (!paused) { d.y += dt * 1.6 * d.l; d.x += dt * 0.25; }
        if (d.y > 1) { d.y -= 1; d.x = Math.random(); }
        if (d.x > 1) d.x -= 1;
        const x = d.x * vw, y = d.y * vh;
        ctx.moveTo(x, y); ctx.lineTo(x - 4 * d.l, y - 14 * d.l);
      }
      ctx.stroke();
    }
    if (type === 'snow') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (let k = 0; k < 220; k++) {
        const d = drops[k];
        if (!paused) { d.y += dt * 0.12 * d.l; d.x += Math.sin(time + k) * dt * 0.02; }
        if (d.y > 1) { d.y -= 1; d.x = Math.random(); }
        if (d.x > 1) d.x -= 1; if (d.x < 0) d.x += 1;
        ctx.beginPath(); ctx.arc(d.x * vw, d.y * vh, 1 + d.l, 0, Math.PI * 2); ctx.fill();
      }
    }
    if (type === 'storm' && !paused) {
      flashTimer -= dt;
      if (flashTimer <= 0) { flash = 1; flashTimer = 3 + Math.random() * 6; AT.emit('thunder'); }
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(235,240,255,${(flash * 0.55).toFixed(3)})`; ctx.fillRect(0, 0, vw, vh);
      flash = Math.max(0, flash - dt * 3);
    }
  }

  // ---------- dieren & fabrieken ----------
  const herds = {};
  function herd(key) {
    const d = D.animals[key], a = AT.state.animals[key];
    const shown = Math.min(a.count, key === 'chickens' ? 40 : key === 'pigs' ? 30 : 25);
    const list = herds[key] = herds[key] || [];
    const P = d.pen, B = d.barn;
    while (list.length < shown) {
      let x, y;
      do { x = P.x + 10 + Math.random() * (P.w - 20); y = P.y + 10 + Math.random() * (P.h - 20); } while (inRect(x, y, B, 6));
      list.push({ x, y, tx: x, ty: y, a: Math.random() * 6, step: 0, wait: Math.random() * 4 });
    }
    list.length = shown;
    return list;
  }

  function updateHerd(key, list, dt) {
    const d = D.animals[key], P = d.pen, B = d.barn;
    const speed = key === 'chickens' ? 10 : key === 'pigs' ? 6 : 5;
    for (const an of list) {
      if (an.wait > 0) { an.wait -= dt; continue; }
      const dx = an.tx - an.x, dy = an.ty - an.y, dist = Math.hypot(dx, dy);
      if (dist < 1) {
        an.wait = 1 + Math.random() * (key === 'chickens' ? 2 : 6);
        let x, y;
        do { x = P.x + 10 + Math.random() * (P.w - 20); y = P.y + 10 + Math.random() * (P.h - 20); } while (inRect(x, y, B, 6));
        an.tx = an.x + (x - an.x) * 0.3; an.ty = an.y + (y - an.y) * 0.3;
        continue;
      }
      an.a = Math.atan2(dy, dx);
      an.x += dx / dist * speed * dt; an.y += dy / dist * speed * dt;
      an.step += dt * 8;
    }
  }

  function drawFarmZone(state, dt) {
    for (const key of Object.keys(D.animals)) {
      const d = D.animals[key], a = state.animals[key];
      SP().fence(ctx, d.pen, AT.farm.penGate(key));
      if (!a.owned) { SP().buildingLot(ctx, d.barn); continue; }
      SP().barn(ctx, d.barn, { cows: '#9c3b2c', chickens: '#a8834f', sheep: '#7d8a8f', pigs: '#c27c6b' }[key] || '#8a6a4a');
      const tr = AT.farm.troughRect(key), full = AT.farm.troughTons(key) / (d.trough * D.barnLevels[AT.farm.animal(key).level]);
      SP().trough(ctx, tr.x, tr.y, tr.w, full > 0.02, full);
      const list = herd(key);
      if (!state.paused) updateHerd(key, list, dt);
      for (const an of list) SP().animal(ctx, key, an.x, an.y, an.a, an.step);
    }
    SP().trader(ctx, D.trader.lot, D.trader.pit, time);
    for (const [id, sp] of Object.entries(D.sellPoints)) if (sp.lot) SP().sellPoint(ctx, id, sp, time);
    SP().dock(ctx, D.dock);
    SP().fuelPump(ctx, D.fuelPump.x, D.fuelPump.y);
    // kassen
    AT.farm.greenhouses().forEach((gh, i) => {
      const lot = D.greenhouse.lots[i];
      if (gh.owned) SP().greenhouse(ctx, lot, gh.crop, time); else SP().buildingLot(ctx, lot);
    });
    // bosperceel
    const wl = AT.farm.woodlot(), se = treeSeason();
    if (!wl.owned) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([6, 5]); ctx.strokeRect(D.woodlot.area.x, D.woodlot.area.y, D.woodlot.area.w, D.woodlot.area.h); ctx.setLineDash([]); }
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (const t of wl.trees) SP().treeShadow(ctx, t.x, t.y, t.variant, se);
    for (const t of wl.trees) {
      if (t.growth < 0.12) { ctx.fillStyle = '#6b4a2a'; SP().circle(ctx, t.x, t.y, 2); }
      SP().tree(ctx, t.x, t.y, t.variant, 0, se, 0.25 + 0.75 * t.growth);
    }
    drawPlantations(se);
    for (const key of Object.keys(D.factories)) {
      const d = D.factories[key], f = state.factories[key];
      if (!f.owned) { SP().buildingLot(ctx, d.lot); continue; }
      SP().factory(ctx, key, d.lot, d.roof, time, f.running && f.on);
      if (Object.keys(D.factories[key].in).concat(...(D.factories[key].alt || []).map(a => Object.keys(a.in))).some(k => D.crops[k] || k === 'hay')) SP().pit(ctx, AT.farm.factoryPit(key));
    }
  }

  // boomgaard (fruitbomen met appels) en wijngaard (rijen wijnstokken met druiven)
  function drawPlantations(se) {
    const vr = visibleRect(40);
    for (const [key, d] of Object.entries(D.plantations)) {
      const pl = AT.farm.plantation(key), A = d.area;
      if (A.x > vr.x1 || A.x + A.w < vr.x0 || A.y > vr.y1 || A.y + A.h < vr.y0) continue;
      ctx.fillStyle = 'rgba(70,110,40,0.35)'; ctx.fillRect(A.x, A.y, A.w, A.h);
      if (!pl.owned) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([6, 5]); ctx.strokeRect(A.x, A.y, A.w, A.h); ctx.setLineDash([]); }
      if (key === 'vineyard') {
        // draden tussen de palen
        const rows = [...new Set(pl.plants.map(p => p.y))];
        ctx.strokeStyle = 'rgba(90,70,50,0.55)'; ctx.lineWidth = 0.6;
        for (const y of rows) { ctx.beginPath(); ctx.moveTo(A.x + 4, y); ctx.lineTo(A.x + A.w - 4, y); ctx.stroke(); }
        for (const p of pl.plants) {
          if (p.x < vr.x0 || p.x > vr.x1 || p.y < vr.y0 || p.y > vr.y1) continue;
          if (se === 3) { ctx.fillStyle = '#6b4a2a'; ctx.fillRect(p.x - 2, p.y - 0.6, 4, 1.2); continue; }
          ctx.fillStyle = se === 2 ? '#b5893a' : '#4f8a32'; SP().circle(ctx, p.x, p.y, 3.4);
          ctx.fillStyle = se === 2 ? '#c99b48' : '#63a03f'; SP().circle(ctx, p.x - 0.8, p.y - 0.8, 2);
          if (p.fruit > 0.45 && !p.picked) {
            ctx.fillStyle = p.fruit >= 1 ? '#5b2c6f' : '#7d9a46';
            SP().circle(ctx, p.x + 1.4, p.y + 1, 0.9 + 0.5 * p.fruit); SP().circle(ctx, p.x - 1.5, p.y + 1.6, 0.8 + 0.4 * p.fruit);
          }
        }
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        for (const p of pl.plants) SP().treeShadow(ctx, p.x, p.y, 4, se);
        for (const p of pl.plants) {
          if (p.x < vr.x0 - 20 || p.x > vr.x1 + 20 || p.y < vr.y0 - 20 || p.y > vr.y1 + 20) continue;
          SP().tree(ctx, p.x, p.y, 4, 0, se, 0.62);
          if (p.fruit > 0.3 && !p.picked && se !== 3) {
            ctx.fillStyle = p.fruit >= 1 ? '#d63a2a' : '#9fc24a';
            const h = (p.x * 7 + p.y * 13) | 0;
            for (let k = 0; k < 6; k++) SP().circle(ctx, p.x + ((h >> k) % 9) - 4, p.y + ((h >> (k + 3)) % 9) - 4, 0.6 + 0.6 * p.fruit);
          }
        }
      }
    }
    // hooibalen op het veld
    for (const b of AT.state.bales) if (b.x > vr.x0 && b.x < vr.x1 && b.y > vr.y0 && b.y < vr.y1) SP().bale(ctx, b.x, b.y, b.a);
  }

  // klik op een stal of fabriek
  function buildingAt(x, y) {
    for (const key of Object.keys(D.animals)) if (inRect(x, y, D.animals[key].pen, 0)) return { kind: 'animal', key };
    for (const key of Object.keys(D.factories)) if (inRect(x, y, D.factories[key].lot, 0)) return { kind: 'factory', key };
    if (inRect(x, y, D.trader.lot, 0)) return { kind: 'trader' };
    for (const sp of Object.values(D.sellPoints)) if (sp.lot && inRect(x, y, sp.lot, 0)) return { kind: 'trader' };
    if (D.greenhouse.lots.some(l => inRect(x, y, l, 0)) || inRect(x, y, D.woodlot.area, 0)) return { kind: 'farm' };
    if (Object.values(D.plantations).some(pl => inRect(x, y, pl.area, 0))) return { kind: 'farm' };
    return null;
  }

  function drawFarmLabels(state) {
    const items = [
      ...Object.keys(D.animals).map(k => {
        const d = D.animals[k], a = state.animals[k];
        const bad = a.count && (a.fed < 0.5 || a.sick || a.health < 0.5);
        const txt = !a.owned ? `${d.building} · bouw ${AT.fmtMoney(d.buildPrice)}` : `${d.building} · ${a.count}/${AT.farm.capacity(k)}${a.count && a.fed < 0.5 ? ' · honger!' : ''}${a.sick ? ' · ziek!' : ''}`;
        return { r: d.pen, txt, bg: !a.owned ? 'rgba(45,106,45,0.92)' : bad ? 'rgba(170,60,30,0.92)' : 'rgba(0,0,0,0.55)' };
      }),
      { r: D.trader.lot, txt: `Graanhandel · ${AT.fmtMoney(G().cropPrice('wheat'))}/t tarwe`, bg: 'rgba(63,110,140,0.92)' },
      ...Object.entries(D.sellPoints).filter(([, sp]) => sp.lot).map(([, sp]) => ({ r: sp.lot, txt: sp.name, bg: 'rgba(63,110,140,0.92)' })),
      { r: { x: D.dock.x - 20, y: D.dock.y - 40, w: D.dock.w + 40, h: 54 }, txt: 'Laadperron (vrachtwagen)', bg: 'rgba(0,0,0,0.55)', small: true },
      { r: { x: D.fuelPump.x - 30, y: D.fuelPump.y - 30, w: 60, h: 44 }, txt: 'Diesel (T)', bg: 'rgba(192,57,43,0.9)', small: true },
      ...Object.keys(D.factories).filter(k => state.factories[k].owned && AT.farm.recipes(k).some(r => Object.keys(r.in).some(g => AT.farm.factoryAccepts(k, g)))).map(k => {
        const p = AT.farm.factoryPit(k); return { r: { x: p.x - 10, y: p.y - 30, w: p.w + 20, h: 44 }, txt: 'Stortplaats (U)', bg: 'rgba(0,0,0,0.55)', small: true };
      }),
      ...AT.farm.greenhouses().map((gh, i) => ({ r: D.greenhouse.lots[i], txt: gh.owned ? `Kas: ${D.products[gh.crop].name.toLowerCase()} · ${gh.status || ''}` : `Kas · bouw ${AT.fmtMoney(D.greenhouse.price)}`, bg: gh.owned ? 'rgba(0,0,0,0.55)' : 'rgba(45,106,45,0.92)' })),
      (() => { const wl = AT.farm.woodlot(); const ready = wl.trees.filter(t => t.growth >= 0.95).length;
        return { r: D.woodlot.area, txt: wl.owned ? `Bosperceel · ${ready} bomen kapklaar` : `Bosperceel · koop ${AT.fmtMoney(D.woodlot.price)}`, bg: wl.owned ? 'rgba(0,0,0,0.55)' : 'rgba(45,106,45,0.92)' }; })(),
      { r: { x: D.siloPit.x - 20, y: D.siloPit.y - 40, w: D.siloPit.w + 40, h: 60 }, txt: 'Stortput silo / opslag', bg: 'rgba(0,0,0,0.55)', small: true },
      ...Object.keys(D.animals).filter(k => state.animals[k].owned).map(k => { const tr = AT.farm.troughRect(k); return { r: { x: tr.x - 20, y: tr.y - 30, w: tr.w + 40, h: 44 }, txt: 'Voerbak (U)', bg: 'rgba(0,0,0,0.55)', small: true }; }),
      ...Object.entries(D.plantations).map(([k, d]) => {
        const pl = AT.farm.plantation(k), ripe = AT.farm.ripeCount(k);
        const txt = !pl.owned ? `${d.name} · koop ${AT.fmtMoney(d.price)}` : ripe ? `${d.name} · ${ripe} ${d.plants} plukklaar (H)` : `${d.name} · ${pl.phase === 'grow' ? 'vruchten groeien' : 'oogst in ' + D.months[d.harvest[0]].toLowerCase()}`;
        return { r: d.area, txt, bg: !pl.owned ? 'rgba(45,106,45,0.92)' : ripe ? 'rgba(183,121,31,0.92)' : 'rgba(0,0,0,0.55)' };
      }),
      ...Object.keys(D.factories).map(k => {
        const d = D.factories[k], f = state.factories[k];
        const txt = !f.owned ? `${d.name} · bouw ${AT.fmtMoney(d.price)}` : `${d.name} · ${f.status || 'start op'}`;
        return { r: d.lot, txt, bg: !f.owned ? 'rgba(45,106,45,0.92)' : f.running ? 'rgba(0,0,0,0.55)' : 'rgba(150,100,20,0.92)' };
      }),
    ];
    for (const it of items) {
      const tl = worldToScreen(it.r.x, it.r.y), br = worldToScreen(it.r.x + it.r.w, it.r.y + it.r.h);
      if (br.x < 0 || br.y < 0 || tl.x > vw || tl.y > vh || br.x - tl.x < (it.small ? 60 : 90)) continue;
      pill(it.txt, (tl.x + br.x) / 2, br.y - 26, true, it.bg);
    }
  }

  // ---------- wegen ----------
  const isMain = r => Math.min(r.w, r.h) >= 24;
  function drawRoads() {
    for (const r of D.roads) {
      if (isMain(r)) continue;
      ctx.fillStyle = '#b49a6e'; ctx.fillRect(r.x, r.y, r.w, r.h);
      const horiz = r.w > r.h;
      ctx.fillStyle = 'rgba(90,70,40,0.32)';
      if (horiz) { ctx.fillRect(r.x, r.y + r.h * 0.22, r.w, 2.2); ctx.fillRect(r.x, r.y + r.h * 0.68, r.w, 2.2); }
      else { ctx.fillRect(r.x + r.w * 0.22, r.y, 2.2, r.h); ctx.fillRect(r.x + r.w * 0.68, r.y, 2.2, r.h); }
      ctx.fillStyle = 'rgba(95,150,60,0.55)';
      if (horiz) ctx.fillRect(r.x, r.y + r.h / 2 - 0.8, r.w, 1.6); else ctx.fillRect(r.x + r.w / 2 - 0.8, r.y, 1.6, r.h);
    }
    for (const r of D.roads) {
      if (!isMain(r)) continue;
      ctx.fillStyle = '#c3ad84'; ctx.fillRect(r.x - 1.5, r.y - 1.5, r.w + 3, r.h + 3);
      ctx.fillStyle = '#5a5e62'; ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1;
    for (const r of D.roads) {
      if (!isMain(r)) continue;
      const horiz = r.w > r.h;
      ctx.setLineDash([]);
      ctx.beginPath();
      if (horiz) { ctx.moveTo(r.x, r.y + 2); ctx.lineTo(r.x + r.w, r.y + 2); ctx.moveTo(r.x, r.y + r.h - 2); ctx.lineTo(r.x + r.w, r.y + r.h - 2); }
      else { ctx.moveTo(r.x + 2, r.y); ctx.lineTo(r.x + 2, r.y + r.h); ctx.moveTo(r.x + r.w - 2, r.y); ctx.lineTo(r.x + r.w - 2, r.y + r.h); }
      ctx.stroke();
      ctx.setLineDash([10, 9]);
      ctx.beginPath();
      if (horiz) { ctx.moveTo(r.x, r.y + r.h / 2); ctx.lineTo(r.x + r.w, r.y + r.h / 2); }
      else { ctx.moveTo(r.x + r.w / 2, r.y); ctx.lineTo(r.x + r.w / 2, r.y + r.h); }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // kruispunten zonder strepen
    ctx.fillStyle = '#5a5e62';
    for (const a of D.roads) for (const b of D.roads) {
      if (!isMain(a) || !isMain(b) || !(a.w > a.h) || b.w > b.h) continue;
      const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
      if (x1 > x0 && y1 > y0) ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }

  // ---------- erf ----------
  const LAMPS = [{ x: 200, y: 712 }, { x: 345, y: 800 }, { x: 345, y: 1000 }, { x: 60, y: 1000 }];
  function drawYard(state) {
    const Y = D.yard;
    // hek rondom (met opening bij de poort)
    ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 1.2;
    const gy0 = Y.gate.y, gy1 = Y.gate.y + Y.gate.h;
    const segs = [[Y.x, Y.y, Y.x + Y.w, Y.y], [Y.x, Y.y, Y.x, Y.y + Y.h], [Y.x, Y.y + Y.h, Y.x + Y.w, Y.y + Y.h],
      [Y.x + Y.w, Y.y, Y.x + Y.w, gy0], [Y.x + Y.w, gy1, Y.x + Y.w, Y.y + Y.h]];
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    for (const [x0, y0, x1, y1] of segs) { ctx.beginPath(); ctx.moveTo(x0 + 1.5, y0 + 2); ctx.lineTo(x1 + 1.5, y1 + 2); ctx.stroke(); }
    ctx.strokeStyle = '#8b6a45';
    for (const [x0, y0, x1, y1] of segs) {
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      const len = Math.hypot(x1 - x0, y1 - y0);
      ctx.fillStyle = '#5e4129';
      for (let s = 0; s <= len; s += 12) ctx.fillRect(x0 + (x1 - x0) * s / len - 1, y0 + (y1 - y0) * s / len - 1, 2, 2);
    }
    SP().pit(ctx, D.siloPit);
    SP().house(ctx, D.house.x, D.house.y, D.house.w, D.house.h);
    SP().hall(ctx, D.hall.x, D.hall.y, D.hall.w, D.hall.h);
    const S = D.silos, fill = G().siloCapacity() ? G().siloUsed() / G().siloCapacity() : 0;
    for (let i = 0; i <= state.siloLevel; i++) {
      SP().silo(ctx, S.x + (i % S.perRow) * S.dx, S.y + Math.floor(i / S.perRow) * S.dy, S.r, fill);
    }
    for (const L of LAMPS) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; SP().circle(ctx, L.x + 2, L.y + 3, 2);
      ctx.fillStyle = '#3b3f42'; SP().circle(ctx, L.x, L.y, 2);
      ctx.fillStyle = '#f6e7a8'; SP().circle(ctx, L.x, L.y, 1);
    }
  }

  // ---------- velden: cellen tekenen (offscreen) ----------
  // sleutel = basis × 512 + beeld-bits × 4 + sneeuw (0..3)
  // beeld-bits: 1 kunstmest, 2 mest, 4 verdicht, 8 onkruid, 16 ziekte, 32 stenen, 64 gerold
  function snowLevel() { const v = AT.state.snow || 0; return v < 0.15 ? 0 : v < 0.45 ? 1 : v < 0.75 ? 2 : 3; }
  function visKey(f, i) {
    const st = f.cells.state[i], dir = f.cells.dir[i], raw = f.cells.fert[i];
    let fe = (raw & 3) | (raw & G().COMPACT ? 4 : 0) | (raw & G().STONE ? 32 : 0) | (raw & G().ROLLED ? 64 : 0);
    let snow = snowLevel();
    if (st === G().ST.MOWN) {
      const d = G().hayDryness(f, i);
      return (4 + (d >= 1 ? 2 : d >= 0.5 ? 1 : 0)) * 512 + fe * 4 + snow;
    }
    // onkruid en ziekte op een deel van de cellen (hoeveel hangt af van hoe erg het is)
    const hv = hash(f.id * 31337 + i) % 1000 / 1000;
    if (st !== G().ST.STUBBLE || f.weeds > 0.5) { if (hv < (f.weeds || 0) * 0.7) fe |= 8; }
    if (st !== G().ST.SOWN) return (st * 2 + dir) * 512 + fe * 4 + snow;
    if ((1 - hv) < (f.disease || 0) * 0.6) fe |= 16;
    const stage = G().isReady(f, i) ? (G().isWithering(f, i) ? 6 : 5) : Math.min(4, Math.floor(G().cellGrowth(f, i) * 5));
    if (stage >= 3) snow = Math.max(0, snow - 1);   // hoge gewassen steken boven de sneeuw uit
    return (10 + (f.cells.crop[i] * 8 + stage) * 2 + dir) * 512 + fe * 4 + snow;
  }

  const STUBBLE = ['#c9ae6b', '#c3a764', '#cfb576', '#c6aa69'];
  const SOIL = ['#7b5233', '#75502f', '#80573a', '#7a5535'];
  const READY = {
    wheat: { base: ['#dcb44c', '#d6ad45', '#e2bc55', '#d9b24a'], dark: '#b38a2c', light: '#f4da86' },
    barley: { base: ['#d9c98d', '#d3c283', '#dfd096', '#d6c689'], dark: '#b4a266', light: '#f4e9bf' },
    oats:   { base: ['#e3d9a8', '#dcd19c', '#e8dfb2', '#d8cd96'], dark: '#b8aa70', light: '#f7f0d0' },
  };

  // ---------- gewassen tekenen per stijl (p = { g, x, y, h, R, stage, crop, cropKey }) ----------
  const hp = (p, k) => ((p.h >> k) & 7);   // plekje binnen de cel uit de hash
  function sprouts(p) {
    p.g.fillStyle = p.crop.growColor;
    for (let a = 0.5; a < C; a += 2) { p.R(a, 1.75, 0.5, 0.5); p.R(a + 1, 5.75, 0.5, 0.5); }
  }
  function grainLike(p) {
    const { g, R, stage, crop, cropKey, h } = p;
    if (stage === 0) return sprouts(p);
    if (stage === 5) {
      const look = READY[cropKey] || READY.wheat;
      g.fillStyle = look.base[h & 3]; g.fillRect(p.x, p.y, C, C);
      for (const c of [1, 3, 5, 7]) {
        for (let a = (c % 4 === 1 ? 0 : 1.2); a < C; a += 2.5) {
          g.fillStyle = look.dark;
          if (cropKey === 'oats') { R(a, c - 0.6, 0.6, 0.6); R(a + 0.8, c + 0.2, 0.6, 0.6); }
          else R(a, c - 0.4, cropKey === 'barley' ? 1.8 : 1.3, cropKey === 'barley' ? 0.4 : 0.8);
          g.fillStyle = look.light; R(a + 0.4, c + 0.4, 0.6, 0.5);
        }
      }
      return;
    }
    const w = [0, 1, 1.8, 2.8, 3.7][stage];
    const col = stage === 4 ? SP().mix(crop.growColor, crop.color, 0.35) : crop.growColor;
    for (const c of [2, 6]) {
      g.fillStyle = col; R(0, c - w / 2, C, w);
      g.fillStyle = 'rgba(255,255,220,0.25)';
      for (let a = (h >> c) & 1; a < C; a += 2) R(a, c - w / 2 + ((h >> (a + 2)) & 1) * w * 0.5, 0.6, 0.6);
      g.fillStyle = 'rgba(0,40,0,0.18)'; R(hp(p, 5), c + w / 2 - 0.6, 1, 0.6);
    }
  }
  // plant op positie langs (a) en dwars (c) de rij
  const at = (p, a, c) => p.dir ? { px: p.x + a, py: p.y + c } : { px: p.x + c, py: p.y + a };

  const CROP_DRAW = {
    grain: grainLike, barley: grainLike, oats: grainLike,
    corn(p) {
      const { g, stage, crop, h } = p;
      if (stage === 5) { g.fillStyle = '#7b6a3c'; g.fillRect(p.x, p.y, C, C); }
      const size = [0.6, 1.3, 2.2, 3.1, 3.8, 4][stage];
      g.lineCap = 'round';
      for (const a of [2, 6]) {
        const { px, py } = at(p, a, 4);
        if (stage === 0) { g.fillStyle = crop.growColor; g.fillRect(px - 0.4, py - 0.4, 0.8, 0.8); continue; }
        g.strokeStyle = stage === 5 ? '#9aa04e' : SP().shade(crop.growColor, ((h >> a) & 1) ? 0.1 : -0.1);
        g.lineWidth = 0.9;
        const rotA = ((h >> (a * 2)) & 15) / 16 * Math.PI;
        g.beginPath();
        for (let leaf = 0; leaf < 3; leaf++) {
          const la = rotA + leaf * Math.PI / 3, ls = size * (leaf === 1 ? 0.8 : 1);
          g.moveTo(px - Math.cos(la) * ls, py - Math.sin(la) * ls);
          g.lineTo(px + Math.cos(la) * ls, py + Math.sin(la) * ls);
        }
        g.stroke();
        if (stage >= 4) { g.fillStyle = stage === 5 ? '#f0d98a' : '#d7e08a'; g.fillRect(px - 0.6, py - 0.6, 1.2, 1.2); }
        if (stage === 5) { g.fillStyle = '#d4b04a'; g.fillRect(px + 1, py + 0.5, 1.4, 0.8); }
      }
    },
    canola(p) {
      const { g, R, stage, h } = p;
      if (stage === 0) return sprouts(p);
      if (stage === 5) {
        g.fillStyle = ['#8a8f3c', '#858a37', '#909642', '#7f8434'][h & 3]; g.fillRect(p.x, p.y, C, C);
        g.fillStyle = '#6b5a2c'; for (let k = 0; k < 6; k++) R(hp(p, k * 2), hp(p, k * 2 + 13), 1.2, 0.5);
        return;
      }
      const w = [0, 1.6, 2.8, 3.8, 4][stage];
      for (const c of [2, 6]) { g.fillStyle = '#5e9c3a'; R(0, c - w / 2, C, w); g.fillStyle = '#4b8530'; R(hp(p, c), c, 1, 0.7); }
      if (stage >= 3) {
        // bloei: knalgele velden
        g.fillStyle = stage === 4 ? 'rgba(242,210,46,0.85)' : 'rgba(242,210,46,0.35)'; g.fillRect(p.x, p.y, C, C);
        g.fillStyle = '#ffe766'; for (let k = 0; k < 8; k++) g.fillRect(p.x + hp(p, k * 3), p.y + hp(p, k * 3 + 1), 0.8, 0.8);
      }
    },
    sunflower(p) {
      const { g, stage, h } = p;
      if (stage === 0) return sprouts(p);
      const size = [0, 1.2, 2, 2.8, 3.1, 3.1][stage];
      for (const a of [2, 6]) {
        const { px, py } = at(p, a, 4);
        g.fillStyle = stage === 5 ? '#8f8a4f' : (((h >> a) & 1) ? '#5a9a3c' : '#4f8c34');
        for (let k = 0; k < 4; k++) {
          const la = k * Math.PI / 2 + ((h >> a) & 3) * 0.3;
          g.beginPath(); g.ellipse(px + Math.cos(la) * size * 0.5, py + Math.sin(la) * size * 0.5, size * 0.55, size * 0.3, la, 0, Math.PI * 2); g.fill();
        }
        if (stage >= 4) {
          g.fillStyle = stage === 5 ? '#6b4a22' : '#f5b800'; g.beginPath(); g.arc(px, py, 1.7, 0, Math.PI * 2); g.fill();
          g.fillStyle = stage === 5 ? '#3d2a14' : '#5b3a1a'; g.beginPath(); g.arc(px, py, 0.9, 0, Math.PI * 2); g.fill();
        }
      }
    },
    soy(p) { legume(p, '#3f7f3a', '#c2a35e', '#a3854a'); },
    beans(p) { legume(p, '#4a8a3f', '#5b4a32', '#3d3122'); },
    potato(p) {
      const { g, R, stage } = p;
      for (const c of [2, 6]) { g.fillStyle = '#8a6040'; R(0, c - 1.6, C, 3.2); g.fillStyle = '#5a3a22'; R(0, c + 1.6, C, 0.6); g.fillStyle = '#9c7050'; R(0, c - 1.6, C, 0.5); }
      if (stage === 0) return;
      const r = [0, 0.9, 1.5, 2, 2.3, 1.6][stage];
      for (const c of [2, 6]) for (const a of [2, 6]) {
        const { px, py } = at(p, a, c);
        g.fillStyle = stage === 5 ? '#a8a24a' : '#4f8f3a';
        g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
        g.fillStyle = stage === 5 ? '#c4bb5e' : '#6aa84f'; g.beginPath(); g.arc(px - r * 0.3, py - r * 0.3, r * 0.45, 0, Math.PI * 2); g.fill();
        if (stage === 5) { g.fillStyle = '#d8b47a'; g.beginPath(); g.ellipse(px + 1.6, py + 1.2, 0.7, 0.5, 0, 0, Math.PI * 2); g.fill(); }
      }
    },
    beet(p) {
      const { g, stage } = p;
      if (stage === 0) return sprouts(p);
      const len = [0, 0.9, 1.4, 1.9, 2.2, 2.2][stage];
      g.lineCap = 'round';
      for (const c of [2, 6]) for (const a of [2, 6]) {
        const { px, py } = at(p, a, c);
        g.strokeStyle = stage === 5 ? '#4f7a3a' : '#3d7a35'; g.lineWidth = 1;
        g.beginPath();
        for (let k = 0; k < 5; k++) { const la = k / 5 * Math.PI * 2 + ((p.h >> (a + c)) & 3); g.moveTo(px, py); g.lineTo(px + Math.cos(la) * len, py + Math.sin(la) * len); }
        g.stroke();
        if (stage === 5) {
          g.fillStyle = '#d9a7b0'; g.beginPath(); g.arc(px, py, 1.1, 0, Math.PI * 2); g.fill();
          g.fillStyle = '#efe2d8'; g.beginPath(); g.arc(px, py, 0.8, 0, Math.PI * 2); g.fill();
        }
      }
    },
    grass(p) {
      const { g, stage, h } = p;
      if (stage === 0) return sprouts(p);
      const cover = [0, 0.4, 0.75, 1, 1, 1][stage];
      if (cover >= 1) { g.fillStyle = stage === 5 ? '#4f9a3a' : '#5fa847'; g.fillRect(p.x, p.y, C, C); }
      const n = [0, 10, 16, 18, 20, 22][stage];
      for (let k = 0; k < n; k++) {
        g.fillStyle = k % 3 === 0 ? '#3f8a34' : k % 3 === 1 ? '#77c25a' : '#5fa847';
        p.R(hp(p, k % 9) + (k % 2) * 0.5, hp(p, (k * 5) % 13 + 3), 0.5, stage >= 3 ? 1.6 : 1);
      }
      if (stage === 5) { g.fillStyle = '#c8d07a'; for (let k = 0; k < 4; k++) p.R(hp(p, k * 4 + 1), hp(p, k * 4 + 7), 0.7, 0.7); }
    },
    clover(p) {
      const { g, stage, h } = p;
      if (stage === 0) return sprouts(p);
      if (stage >= 3) { g.fillStyle = '#5fa14a'; g.fillRect(p.x, p.y, C, C); }
      const n = [0, 8, 16, 14, 14, 14][stage];
      for (let k = 0; k < n; k++) {
        g.fillStyle = k % 3 ? '#4c8a3a' : '#7cbf5f';
        g.beginPath(); g.arc(p.x + hp(p, k) + 0.5, p.y + hp(p, k + 9) + 0.5, stage >= 3 ? 0.7 : 0.6, 0, Math.PI * 2); g.fill();
      }
      if (stage >= 4) for (let k = 0; k < 4; k++) {
        g.fillStyle = k % 2 ? '#f5f5f5' : '#e8a3c7';
        g.beginPath(); g.arc(p.x + hp(p, k * 4 + 2) + 0.5, p.y + hp(p, k * 4 + 15) + 0.5, 0.6, 0, Math.PI * 2); g.fill();
      }
    },
  };
  function legume(p, green, ripe, ripeDark) {
    const { g, stage } = p;
    if (stage === 0) return sprouts(p);
    const r = [0, 0.8, 1.2, 1.6, 1.9, 1.7][stage];
    for (const c of [2, 6]) for (const a of [1, 3, 5, 7]) {
      const { px, py } = at(p, a + ((p.h >> (a + c)) & 1) * 0.4, c);
      g.fillStyle = stage === 5 ? ripe : green;
      g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
      g.fillStyle = stage === 5 ? ripeDark : SP().shade(green, 0.18);
      g.beginPath(); g.arc(px - r * 0.3, py - r * 0.3, r * 0.4, 0, Math.PI * 2); g.fill();
    }
  }

  function drawCell(id, i) {
    const def = G().fieldDef(id), f = G().field(id), L = layers[id], g = L.ctx;
    const full = visKey(f, i);
    L.vis[i] = full;
    const base = full >>> 9, fe = (full >> 2) & 127, snow = full & 3;
    drawCellBase(def, g, id, i, base);
    const x = (i % def.cols) * C, y = Math.floor(i / def.cols) * C, h = hash(id * 7919 + i);
    const dirH = base & 1;
    // gerold: gladde, lichte banen
    if (fe & 64) {
      g.fillStyle = 'rgba(255,255,255,0.07)';
      if (dirH) g.fillRect(x, y, C, C / 2); else g.fillRect(x, y, C / 2, C);
    }
    // verdicht: diepe natte bandensporen
    if (fe & 4) {
      g.fillStyle = 'rgba(45,28,14,0.5)';
      if (dirH) { g.fillRect(x, y + 1.5, C, 1.3); g.fillRect(x, y + 5.2, C, 1.3); } else { g.fillRect(x + 1.5, y, 1.3, C); g.fillRect(x + 5.2, y, 1.3, C); }
      g.fillStyle = 'rgba(120,140,150,0.25)';
      if (dirH) g.fillRect(x + (h & 3), y + 1.8, 2, 0.6); else g.fillRect(x + 1.8, y + (h & 3), 0.6, 2);
    }
    // stenen: grijze keien
    if (fe & 32) {
      for (let k = 0; k < 2; k++) {
        const px = x + 1 + ((h >> (k * 6 + 1)) % 6), py = y + 1 + ((h >> (k * 6 + 4)) % 6), r = 0.7 + ((h >> (k + 20)) & 1) * 0.5;
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.arc(px + 0.3, py + 0.4, r, 0, Math.PI * 2); g.fill();
        g.fillStyle = k ? '#9a968c' : '#b5b1a6'; g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill();
      }
    }
    // onkruid: donkergroene plukjes en een paarse distel
    if (fe & 8) {
      g.fillStyle = '#2f5a1f';
      for (let k = 0; k < 3; k++) { const px = x + ((h >> (k * 5)) & 7), py = y + ((h >> (k * 5 + 3)) & 7); g.beginPath(); g.arc(px, py, 0.9, 0, Math.PI * 2); g.fill(); }
      if (h & 16) { g.fillStyle = '#9b59b6'; g.fillRect(x + ((h >> 7) & 7), y + ((h >> 11) & 7), 0.8, 0.8); }
    }
    // ziekte: gele en bruine vlekken op het gewas
    if (fe & 16) {
      g.fillStyle = 'rgba(190,160,50,0.6)'; g.beginPath(); g.arc(x + ((h >> 2) & 7), y + ((h >> 6) & 7), 1.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(110,70,30,0.55)'; g.beginPath(); g.arc(x + ((h >> 9) & 7), y + ((h >> 13) & 7), 1, 0, Math.PI * 2); g.fill();
    }
    // bemesting zichtbaar: witte korrels (kunstmest) en donkere plukjes (mest)
    if (fe & 2) { g.fillStyle = 'rgba(60,38,20,0.55)'; for (let k = 0; k < 3; k++) g.fillRect(x + ((h >> (k * 3)) & 7), y + ((h >> (k * 3 + 9)) & 7), 1.2, 0.8); }
    if (fe & 1) { g.fillStyle = 'rgba(255,255,255,0.85)'; for (let k = 0; k < 3; k++) g.fillRect(x + ((h >> (k * 4 + 1)) & 7) + 0.25, y + ((h >> (k * 4 + 13)) & 7) + 0.25, 0.5, 0.5); }
    if (snow) drawSnow(g, x, y, h, snow, dirH, base);
  }

  // sneeuw op de akker: eerst in de voren, daarna een dicht wit pak met stoppels en kluiten die nog uitsteken
  function drawSnow(g, x, y, h, level, dirH, base) {
    const R = (a, c, len, w) => dirH ? g.fillRect(x + a, y + c, len, w) : g.fillRect(x + c, y + a, w, len);
    if (level === 1) {
      g.fillStyle = 'rgba(245,248,252,0.85)';
      for (const c of [1.2, 4.2, 6.6]) R(0, c, C, 1.1);
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(x + (h & 7), y + ((h >> 3) & 7), 1.4, 1);
      return;
    }
    g.fillStyle = level === 3 ? '#f4f7fa' : 'rgba(242,246,250,0.82)'; g.fillRect(x, y, C, C);
    g.fillStyle = 'rgba(170,190,215,0.35)';
    for (let k = 0; k < 2; k++) g.fillRect(x + ((h >> (k * 4)) & 7), y + ((h >> (k * 4 + 2)) & 7), 2.2, 0.8);
    // wat er nog door de sneeuw steekt
    const stubble = base < 2, plowed = base >= 2 && base < 4;
    const n = level === 3 ? 2 : 4;
    g.fillStyle = stubble ? '#b59c5e' : plowed ? '#6e4a2e' : base >= 10 ? '#5f8f3c' : '#8faa62';
    for (let k = 0; k < n; k++) R((h >> (k * 3)) & 7, (h >> (k * 3 + 12)) & 7, stubble ? 0.6 : 1.2, stubble ? 1.2 : 0.7);
  }

  function drawCellBase(def, g, id, i, key) {
    const x = (i % def.cols) * C, y = Math.floor(i / def.cols) * C;
    const h = hash(id * 100003 + i);
    const dir = key & 1;
    // rechthoek langs (a) en dwars op (c) de rijrichting
    const R = (a, c, len, w) => dir ? g.fillRect(x + a, y + c, len, w) : g.fillRect(x + c, y + a, w, len);

    if (key < 2) { // stoppel
      g.fillStyle = STUBBLE[h & 3]; g.fillRect(x, y, C, C);
      for (const c of [1.5, 5.5]) {
        for (let a = 0.3; a < C; a += 1.5) {
          g.fillStyle = (h >> Math.round(a)) & 1 ? '#a8893f' : '#e3cd8f';
          R(a, c + ((h >> (Math.round(a) + 3)) & 1) * 0.5, 0.8, 0.6);
        }
      }
      g.fillStyle = '#ead7a0'; R((h >> 4) & 7, (h >> 7) & 7, 2.2, 0.5);
      return;
    }
    if (key >= 4 && key <= 6) { // gemaaid gras: zwaden die drogen tot hooi
      const stage = key - 4;
      g.fillStyle = ['#8fbf5a', '#9cbf62', '#a9bd6a'][stage]; g.fillRect(x, y, C, C);
      g.fillStyle = 'rgba(60,100,30,0.25)'; for (let k = 0; k < 4; k++) g.fillRect(x + ((h >> (k * 3)) & 7), y + ((h >> (k * 3 + 1)) & 7), 0.6, 0.6);
      const col = ['#5f9a3e', '#a8b65a', '#dcc77a'][stage], hi = ['#7cb956', '#c4c873', '#f0dc94'][stage];
      for (const c of [1.5, 5.5]) {
        g.fillStyle = col; R(0, c - 1, C, 2.2);
        g.fillStyle = hi; for (let a = (h & 1); a < C; a += 2) R(a, c - 0.6 + ((h >> a) & 1) * 0.6, 1, 0.5);
      }
      return;
    }
    // ondergrond (geploegd)
    const sown = key >= 10;
    g.fillStyle = sown ? '#6f4a2e' : SOIL[h & 3]; g.fillRect(x, y, C, C);
    if (!sown) {
      for (const c of [0.5, 3.2, 5.9]) {
        g.fillStyle = '#5b3a22'; R(0, c, C, 1.1);
        g.fillStyle = '#94694a'; R(0, c + 1.1, C, 0.5);
      }
      g.fillStyle = '#9a7050'; R((h >> 3) & 7, (h >> 6) & 7, 1, 1);
      g.fillStyle = '#4f321d'; R((h >> 9) & 7, (h >> 12) & 7, 1, 0.8);
      return;
    }

    const v = (key - 10) >> 1;
    const cropIdx = Math.floor(v / 8), rawStage = v % 8;
    const cropKey = G().CROP_KEYS[cropIdx - 1], crop = D.crops[cropKey];
    // fijne zaairijen
    g.fillStyle = '#5f3f26'; R(0, 2, C, 0.6); R(0, 6, C, 0.6);
    g.save(); g.beginPath(); g.rect(x, y, C, C); g.clip();
    (CROP_DRAW[crop.style] || grainLike)({ g, x, y, h, dir, R, stage: Math.min(rawStage, 5), crop, cropKey });
    g.restore();
    if (rawStage === 6) { // verwelkt: dof en bruin
      g.fillStyle = 'rgba(85,62,35,0.5)'; g.fillRect(x, y, C, C);
      g.fillStyle = 'rgba(40,28,15,0.45)'; R((h >> 2) & 7, (h >> 5) & 7, 1.6, 0.6); R((h >> 8) & 7, (h >> 11) & 7, 1.6, 0.6);
    }
  }

  // groei-stadia veranderen met de tijd: elk frame een paar velden controleren
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

  function drawFields(state, sums) {
    for (const def of D.fields) {
      const f = G().field(def.id);
      if (f.owned) {
        ctx.imageSmoothingEnabled = cam.zoom < FS;
        ctx.drawImage(layers[def.id].canvas, def.x, def.y, def.w, def.h);
        ctx.imageSmoothingEnabled = true;
        // rand: smalle grasstrook / akkerrand
        ctx.strokeStyle = 'rgba(60,40,20,0.35)'; ctx.lineWidth = 1;
        ctx.strokeRect(def.x + 0.5, def.y + 0.5, def.w - 1, def.h - 1);
        if (f.irrigated) drawIrrigation(def, f);
      } else {
        // weiland te koop: gras met paaltjes in de hoeken
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 1;
        ctx.strokeRect(def.x + 2, def.y + 2, def.w - 4, def.h - 4); ctx.setLineDash([]);
        ctx.fillStyle = '#7a5a3a';
        for (const [px, py] of [[def.x + 2, def.y + 2], [def.x + def.w - 2, def.y + 2], [def.x + 2, def.y + def.h - 2], [def.x + def.w - 2, def.y + def.h - 2]]) ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
      }
      const sel = view.selected === def.id, hov = view.hover === def.id;
      if (sel || hov) {
        ctx.lineWidth = (sel ? 2.5 : 1.5) / cam.zoom * 1.5;
        ctx.strokeStyle = sel ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)';
        ctx.strokeRect(def.x, def.y, def.w, def.h);
      }
    }
  }

  // irrigatie: buis langs de bovenrand met sproeiers; bij droogte spuiten ze water
  function drawIrrigation(def, f) {
    ctx.fillStyle = '#5d6d7e'; ctx.fillRect(def.x + 2, def.y + 2, def.w - 4, 1.6);
    const watering = AT.weather.drought() && !state0().paused;
    for (let x = def.x + 20; x < def.x + def.w - 10; x += 48) {
      ctx.fillStyle = '#34495e'; SP().circle(ctx, x, def.y + 2.8, 1.8);
      if (watering) {
        const r = 14 + 6 * Math.sin(time * 3 + x);
        ctx.fillStyle = 'rgba(160,210,240,0.22)';
        ctx.beginPath(); ctx.arc(x, def.y + 3, r, 0, Math.PI); ctx.fill();
        ctx.fillStyle = 'rgba(220,240,255,0.7)';
        for (let k = 0; k < 5; k++) { const a = (time * 4 + k * 1.3 + x) % Math.PI; SP().circle(ctx, x + Math.cos(a) * r * 0.8, def.y + 3 + Math.sin(a) * r * 0.8, 0.6); }
      }
    }
  }
  const state0 = () => AT.state;

  // wind die over rijpe en groeiende gewassen golft
  function drawWind(sums) {
    for (const def of D.fields) {
      const sum = sums[def.id];
      if (!sum || (sum.growing + sum.ready) < sum.total * 0.3) continue;
      ctx.save();
      ctx.beginPath(); ctx.rect(def.x, def.y, def.w, def.h); ctx.clip();
      const span = def.w + def.h + 160;
      for (let k = 0; k < 3; k++) {
        const s = ((time * 22 + k * span / 3 + def.id * 57) % span) - 80;
        const gx = def.x + s, gy = def.y;
        const grad = ctx.createLinearGradient(gx - 30, gy, gx + 30, gy + 30);
        grad.addColorStop(0, 'rgba(255,250,210,0)'); grad.addColorStop(0.5, 'rgba(255,250,210,0.13)'); grad.addColorStop(1, 'rgba(255,250,210,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(gx - 40, gy); ctx.lineTo(gx + 20, gy); ctx.lineTo(gx + 20 - def.h, gy + def.h); ctx.lineTo(gx - 40 - def.h, gy + def.h);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ---------- bomen ----------
  function visibleRect(m) {
    const tl = screenToWorld(0, 0), br = screenToWorld(vw, vh);
    return { x0: tl.x - m, y0: tl.y - m, x1: br.x + m, y1: br.y + m };
  }
  function drawTrees() {
    const v = visibleRect(30);
    const vis = trees.filter(t => t.x > v.x0 && t.x < v.x1 && t.y > v.y0 && t.y < v.y1);
    const se = treeSeason();
    const windy = weatherType() === 'storm' ? 4 : weatherType() === 'rain' ? 1.6 : 1;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (const t of vis) SP().treeShadow(ctx, t.x, t.y, t.variant, se);
    for (const t of vis) SP().tree(ctx, t.x, t.y, t.variant, Math.sin(time * 1.3 * windy + t.seed) * 0.35 * windy, se);
  }

  // ---------- machines en boer ----------
  function lightsOn() { return darkness() > 0.25; }

  function drawMachines(state) {
    const lights = lightsOn();
    const p = state.player;
    const loadOpts = (m, impl) => {
      const L = m.load, IL = impl && impl.load;
      const cargo = m.cargo ? Object.entries(m.cargo).reduce((a, [k, v]) => a + v / D.products[k].perPallet, 0) : 0;
      return {
        cargoFrac: D.machines[m.type].pallets ? cargo / D.machines[m.type].pallets : 0,
        implLoad: IL, load: L,
        grain: L && L.tons > 0 ? L.tons / G().loadCap(m) : 0,
        grainColor: L && L.crop ? G().goodColor(L.crop) : null,
      };
    };
    for (const m of state.machines) {
      if (m.busy || m.attached) continue;
      const impl = m.impl ? G().machine(m.impl) : null;
      SP().machine(ctx, m.type, m.x, m.y, m.angle, Object.assign({ implType: impl && impl.type, lowered: false, wheel: 0, t: time }, loadOpts(m, impl)));
    }
    // werknemers: onderweg, aan het werk of op de terugweg
    const drawCrew = (uids, pos, working, type) => {
      const ms = state.machines.filter(m => uids.includes(m.uid));
      const main = ms.find(m => ['tractor', 'harvester'].includes(D.machines[m.type].kind));
      const impl = ms.find(m => m !== main);
      if (main) SP().machine(ctx, main.type, pos.x, pos.y, pos.angle, { implType: impl && impl.type, lowered: working, wheel: time * 30, t: time, lights, beacon: (time * 2) % 1 < 0.5, grain: working && type === 'harvest' ? 1 : 0 });
    };
    for (const f of state.fields) {
      if (!f.job) continue;
      drawCrew(f.job.machines, G().jobPose(G().fieldDef(f.id), f.job), f.job.phase !== 'to', f.job.type);
    }
    for (const tr of state.trips || []) drawCrew(tr.machines, tr.pos, false, tr.type);
    if (state.chaser) {
      const c = state.chaser, t = G().machine(c.tractor), tl = G().machine(c.trailer);
      if (t && tl) SP().machine(ctx, t.type, c.pos.x, c.pos.y, c.pos.angle, { implType: tl.type, implLoad: tl.load, lowered: false, wheel: time * 30, t: time, lights, beacon: (time * 2) % 1 < 0.5 });
    }
    for (const dv of state.deliveries || []) {
      const t = G().machine(dv.truck);
      if (!t) continue;
      const pallets = Object.entries(dv.cargo).reduce((a, [k, v]) => a + v / D.products[k].perPallet, 0);
      SP().machine(ctx, t.type, dv.pos.x, dv.pos.y, dv.pos.angle, { wheel: time * 30, t: time, lights, cargoFrac: pallets / D.machines[t.type].pallets });
    }
    // jouw machine
    if (p.mode === 'drive') {
      const r = AT.vehicle.rig();
      if (r) {
        SP().machine(ctx, r.main.type, p.x, p.y, p.angle, Object.assign({
          implType: r.impl && r.impl.type, lowered: p.lowered, wheel: p.dist || 0, steer: p.steer || 0, t: time,
          lights, beacon: (p.lowered || p.unloading) && (time * 2) % 1 < 0.5,
          auger: p.unloading && r.mainDef.kind === 'harvester', tipping: p.unloading && r.mainDef.kind === 'tractor',
        }, loadOpts(r.main, r.impl)));
      }
    }
  }

  function drawFarmer(p) {
    if (p.mode !== 'foot') return;
    // ring om de boer zodat je hem altijd terugvindt
    ctx.strokeStyle = `rgba(255,255,255,${0.5 + Math.sin(time * 4) * 0.25})`; ctx.lineWidth = 1.2 / Math.max(1, cam.zoom / 2);
    ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x + 1.5, p.y + 2.5, 3.6, 2.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.angle);
    const swing = p.speed ? Math.sin((p.walk || 0) * 0.35) * 1.6 : 0;
    // benen/armen
    ctx.fillStyle = '#3b4f7a'; ctx.fillRect(-0.6 + swing, -1.9, 1.6, 1.2); ctx.fillRect(-0.6 - swing, 0.7, 1.6, 1.2);
    ctx.fillStyle = '#e2b48f'; SP().circle(ctx, swing * 0.6, -3, 0.8); SP().circle(ctx, -swing * 0.6, 3, 0.8);
    // lijf (overall) + hoed
    ctx.fillStyle = '#2f5d9e'; ctx.beginPath(); ctx.ellipse(0, 0, 1.8, 2.9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c94a3a'; ctx.fillRect(-0.6, -2.4, 1.2, 4.8);
    ctx.fillStyle = '#e8c766'; SP().circle(ctx, 0.2, 0, 2.2);
    ctx.fillStyle = '#c9a548'; SP().circle(ctx, 0.2, 0, 1.2);
    ctx.restore();
  }

  // ---------- licht: dag/nacht, zonsopgang, koplampen ----------
  function darkness() {
    const h = G().hour();
    if (h >= 21 || h < 4) return 1;
    if (h < 6) return 1 - (h - 4) / 2;
    if (h >= 19) return (h - 19) / 2;
    return 0;
  }
  function warmth() {
    const h = G().hour();
    return Math.max(0, 1 - Math.abs(h - 6.5) / 1.6, 1 - Math.abs(h - 18.7) / 1.6);
  }

  function lightSources(state) {
    const list = [];
    const p = state.player;
    if (p.mode === 'drive') list.push({ x: p.x, y: p.y, a: p.angle, cone: true });
    else list.push({ x: p.x, y: p.y, r: 30 });
    for (const f of state.fields) {
      if (!f.job) continue;
      const pos = G().jobPose(G().fieldDef(f.id), f.job);
      list.push({ x: pos.x, y: pos.y, a: pos.angle, cone: true });
    }
    for (const tr of state.trips || []) list.push({ x: tr.pos.x, y: tr.pos.y, a: tr.pos.angle, cone: true });
    for (const dv of state.deliveries || []) list.push({ x: dv.pos.x, y: dv.pos.y, a: dv.pos.angle, cone: true });
    for (const L of LAMPS) list.push({ x: L.x, y: L.y, r: 60 });
    list.push({ x: D.house.x + D.house.w / 2, y: D.house.y + D.house.h + 6, r: 34 });
    return list;
  }

  function drawLighting(state) {
    const dark = darkness(), warm = warmth();
    if (warm > 0) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = `rgba(255,130,50,${(warm * 0.6).toFixed(3)})`; ctx.fillRect(0, 0, vw, vh);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(255,150,80,${(warm * 0.07).toFixed(3)})`; ctx.fillRect(0, 0, vw, vh);
    }
    if (dark <= 0) return;
    const z = cam.zoom;
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, vw, vh);
    lctx.fillStyle = `rgba(6,12,38,${(dark * 0.62).toFixed(3)})`;
    lctx.fillRect(0, 0, vw, vh);
    lctx.globalCompositeOperation = 'destination-out';
    const sources = lightSources(state);
    for (const L of sources) {
      const s = worldToScreen(L.x, L.y);
      if (L.cone) {
        const ox = s.x + Math.cos(L.a) * 11 * z, oy = s.y + Math.sin(L.a) * 11 * z, len = 150 * z;
        const g = lctx.createRadialGradient(ox, oy, 0, ox, oy, len);
        g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(0.6, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = g;
        lctx.beginPath(); lctx.moveTo(ox, oy); lctx.arc(ox, oy, len, L.a - 0.45, L.a + 0.45); lctx.closePath(); lctx.fill();
        const g2 = lctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 28 * z);
        g2.addColorStop(0, 'rgba(0,0,0,0.7)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = g2; lctx.beginPath(); lctx.arc(s.x, s.y, 28 * z, 0, Math.PI * 2); lctx.fill();
      } else {
        const g = lctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, L.r * z);
        g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        lctx.fillStyle = g; lctx.beginPath(); lctx.arc(s.x, s.y, L.r * z, 0, Math.PI * 2); lctx.fill();
      }
    }
    ctx.drawImage(lightCanvas, 0, 0, vw, vh);
    // warme gloed van de lampen
    ctx.globalCompositeOperation = 'lighter';
    for (const L of sources) {
      const s = worldToScreen(L.x, L.y);
      const r = (L.cone ? 120 : L.r) * z;
      const ox = L.cone ? s.x + Math.cos(L.a) * 50 * z : s.x, oy = L.cone ? s.y + Math.sin(L.a) * 50 * z : s.y;
      const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, r);
      g.addColorStop(0, `rgba(255,220,150,${(0.12 * dark).toFixed(3)})`); g.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ---------- schermlaag: labels, pijl, minimap, HUD ----------
  function drawFieldLabels(state, sums) {
    for (const def of D.fields) {
      const f = G().field(def.id);
      const tl = worldToScreen(def.x, def.y), br = worldToScreen(def.x + def.w, def.y + def.h);
      if (br.x < 0 || br.y < 0 || tl.x > vw || tl.y > vh) continue;
      if (br.x - tl.x < 110 || br.y - tl.y < 70) continue;
      pill(`Veld ${def.id} · ${AT.fmtHa(def.ha)}`, tl.x + 6, tl.y + 6);
      const cx = (tl.x + br.x) / 2, cy = (tl.y + br.y) / 2 + 8;
      const sum = sums[def.id];
      if (!f.owned) pill('Te koop ' + AT.fmtMoney(G().fieldPrice(def.id)), cx, cy - 9, true, 'rgba(45,106,45,0.92)');
      else if (f.job) {
        const who = f.job.workerName || 'Loonwerker';
        const txt = f.job.phase === 'to' ? `${who} is onderweg` : f.job.waiting ? `${who} wacht tot het droog is` : `${who}: ${Math.floor(f.job.progress * 100)}%`;
        pill(txt, cx, cy - 9, true, 'rgba(44,127,184,0.9)');
      } else if (f.auto && f.auto.on) pill('🤖 Automatisch' + (f.auto.status ? ': ' + f.auto.status : ''), cx, cy - 9, true, 'rgba(0,0,0,0.5)');
      else if (sum && sum.growing && Math.max(f.weeds || 0, f.disease || 0, f.pests || 0) > D.pests.warnAt) {
        const worst = [['weeds', 'Onkruid'], ['disease', 'Ziekte'], ['pests', 'Plagen']].sort((a, b) => f[b[0]] - f[a[0]])[0][1];
        pill(`${worst}! Spuiten`, cx, cy - 9, true, 'rgba(170,60,30,0.92)');
      }
      else if (sum && sum.dryHay > 0) pill('Hooi is droog: persen', cx, cy - 9, true, 'rgba(183,121,31,0.92)');
      else if (sum && sum.mown > 0) pill('Hooi droogt', cx, cy - 9, true, 'rgba(0,0,0,0.5)');
      else if (sum && sum.ready > 0 && sum.growing === 0) pill(sum.readyCrops.grass ? 'Klaar om te maaien' : 'Klaar om te oogsten', cx, cy - 9, true, 'rgba(183,121,31,0.92)');
    }
  }

  // pijl rond de speler naar het geselecteerde veld
  function drawWaypoint(state) {
    const p = state.player, def = G().fieldDef(view.selected);
    if (!def) return;
    const tx = Math.max(def.x, Math.min(def.x + def.w, p.x)), ty = Math.max(def.y, Math.min(def.y + def.h, p.y));
    const dist = Math.hypot(tx - p.x, ty - p.y);
    if (dist < 30) return;
    const a = Math.atan2(ty - p.y, tx - p.x);
    const s = worldToScreen(p.x, p.y), r = 46;
    const ax = s.x + Math.cos(a) * r, ay = s.y + Math.sin(a) * r;
    ctx.save();
    ctx.translate(ax, ay); ctx.rotate(a);
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-2, 0); ctx.lineTo(-6, 8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    const lx = s.x + Math.cos(a) * (r + 26), ly = s.y + Math.sin(a) * (r + 26);
    pill(`Veld ${def.id} · ${Math.round(dist)} m`, lx, ly - 10, true, 'rgba(0,0,0,0.6)');
  }

  const MINI_COLORS = { stubble: '#c8ad6a', plowed: '#7a5232', growing: '#7fb24a', ready: '#e0b84c' };
  function drawMinimap(state, sums) {
    const m = miniRect(), s = MINI.scale;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(m.x - 4, m.y - 4, m.w + 8, m.h + 8, 6); ctx.fill();
    ctx.drawImage(bg, m.x, m.y, m.w, m.h);
    ctx.fillStyle = '#6b6f73';
    for (const r of D.roads) ctx.fillRect(m.x + r.x * s, m.y + r.y * s, Math.max(1, r.w * s), Math.max(1, r.h * s));
    for (const def of D.fields) {
      const f = G().field(def.id), sum = sums[def.id];
      let col = 'rgba(95,154,69,0.6)';
      if (f.owned && sum) col = MINI_COLORS[['ready', 'growing', 'plowed', 'stubble'].reduce((a, k) => sum[k] > sum[a] ? k : a, 'stubble')];
      ctx.fillStyle = col;
      ctx.fillRect(m.x + def.x * s, m.y + def.y * s, def.w * s, def.h * s);
      if (view.selected === def.id) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.strokeRect(m.x + def.x * s, m.y + def.y * s, def.w * s, def.h * s); }
    }
    for (const key of Object.keys(D.animals)) {
      const r = D.animals[key].pen;
      ctx.fillStyle = state.animals[key].owned ? 'rgba(160,110,60,0.8)' : 'rgba(255,255,255,0.15)';
      ctx.fillRect(m.x + r.x * s, m.y + r.y * s, r.w * s, r.h * s);
    }
    for (const key of Object.keys(D.factories)) {
      const r = D.factories[key].lot;
      ctx.fillStyle = state.factories[key].owned ? D.factories[key].roof : 'rgba(255,255,255,0.15)';
      ctx.fillRect(m.x + r.x * s, m.y + r.y * s, r.w * s, r.h * s);
    }
    ctx.fillStyle = '#3f6e8c';
    ctx.fillRect(m.x + D.trader.lot.x * s, m.y + D.trader.lot.y * s, D.trader.lot.w * s, D.trader.lot.h * s);
    for (const sp of Object.values(D.sellPoints)) if (sp.lot) ctx.fillRect(m.x + sp.lot.x * s, m.y + sp.lot.y * s, sp.lot.w * s, sp.lot.h * s);
    { const prev = ctx.fillStyle; ctx.fillStyle = '#3f7a2a'; for (const pl of Object.values(D.plantations)) ctx.fillRect(m.x + pl.area.x * s, m.y + pl.area.y * s, pl.area.w * s, pl.area.h * s); ctx.fillStyle = prev; }
    for (const mm of state.machines) {
      if (mm.busy || mm.attached) continue;
      ctx.fillStyle = '#ffd25a'; ctx.fillRect(m.x + mm.x * s - 1, m.y + mm.y * s - 1, 2, 2);
    }
    const tl = screenToWorld(0, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
    ctx.strokeRect(m.x + tl.x * s, m.y + tl.y * s, vw / cam.zoom * s, vh / cam.zoom * s);
    ctx.fillStyle = '#4fc3f7';
    for (const f of state.fields) if (f.job) { const q = G().jobPose(G().fieldDef(f.id), f.job); ctx.beginPath(); ctx.arc(m.x + q.x * s, m.y + q.y * s, 2.5, 0, Math.PI * 2); ctx.fill(); }
    for (const tr of state.trips || []) { ctx.beginPath(); ctx.arc(m.x + tr.pos.x * s, m.y + tr.pos.y * s, 2.5, 0, Math.PI * 2); ctx.fill(); }
    const p = state.player;
    ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.arc(m.x + p.x * s, m.y + p.y * s, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.stroke();
  }

  function drawHud() {
    const info = AT.vehicle.hudInfo();
    if (!info) return;
    const lines = [];
    if (info.mode === 'drive') {
      lines.push([info.name, '#fff', '700 14px']);
      lines.push([`${info.kmh} km/u`, '#ffe08a', '700 20px']);
      if (info.tool) lines.push([`${info.tool}: ${info.lowered ? 'OMLAAG (aan het werk)' : 'omhoog'}`, info.lowered ? '#9be15d' : '#ddd', '600 13px']);
      if (info.crop) lines.push([`Zaaigoed: ${info.crop}  (C = wisselen)`, '#ddd', '600 13px']);
      if (info.extra) lines.push([info.extra, '#ddd', '600 13px']);
      if (info.load) lines.push([info.load, info.loadFrac > 0.95 ? '#ffb38a' : '#ffe08a', '700 13px']);
      if (info.fuel) lines.push([info.fuel, info.fuelLow ? '#ffb38a' : '#ddd', '600 13px']);
      lines.push(['WASD rijden · Shift sneller · Spatie werktuig · F koppelen · U lossen · T tanken · E uitstappen', '#bbb', '12px']);
    } else {
      lines.push(['Te voet', '#fff', '700 14px']);
      lines.push(['WASD lopen · Shift sneller · E instappen', '#bbb', '12px']);
      lines.push(['Slepen = rondkijken · scroll = zoomen', '#bbb', '12px']);
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
    // actie-hint en waarschuwing onderaan in beeld
    let y = vh - 34;
    if (info.warn) { bigPill(info.warn, vw / 2, y, 'rgba(160,60,30,0.92)'); y -= 38; }
    if (info.prompt) bigPill(info.prompt, vw / 2, y, 'rgba(0,0,0,0.7)');
  }

  // ---------- kleine helpers ----------
  function roundRect(x, y, w, h, r) { SP().rr(ctx, x, y, w, h, r); }

  function pill(text, x, y, centered = false, bg2 = 'rgba(0,0,0,0.55)') {
    ctx.font = '600 12px system-ui, sans-serif';
    const tw = ctx.measureText(text).width;
    const px = centered ? x - tw / 2 - 7 : x;
    ctx.fillStyle = bg2; roundRect(px, y, tw + 14, 20, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, px + 7, y + 10.5);
  }
  function bigPill(text, x, y, bg2) {
    ctx.font = '700 15px system-ui, sans-serif';
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = bg2; roundRect(x - tw / 2 - 14, y - 15, tw + 28, 30, 15); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y + 1);
  }

  // ---------- hoofd-tekenfunctie ----------
  let sums = {}, sumTimer = 1;
  function draw(state, dt) {
    if (!vw || !vh) return;
    time += dt;
    updateCamera(dt);
    AT.fx.update(dt);
    refreshSome(2);
    sumTimer += dt;
    if (sumTimer > 0.5) { sumTimer = 0; sums = {}; for (const f of state.fields) sums[f.id] = G().summary(f); }

    ctx.setTransform(dpr * cam.zoom, 0, 0, dpr * cam.zoom, dpr * (vw / 2 - cam.x * cam.zoom), dpr * (vh / 2 - cam.y * cam.zoom));
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bg, 0, 0);
    drawSeasonTint();
    drawPondIce();
    drawRoads();
    drawFields(state, sums);
    drawSeasonTint(0.45); // rijp/sneeuw ook een beetje op de akkers
    AT.fx.drawTracks(ctx);
    drawWind(sums);
    drawYard(state);
    drawFarmZone(state, dt);
    drawTrees();
    drawMachines(state);
    drawFarmer(state.player);
    AT.fx.drawParticles(ctx);
    drawCloudShadows(dt);
    AT.fx.drawBirds(ctx);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPrecipitation(dt);
    drawLighting(state);
    drawFieldLabels(state, sums);
    drawFarmLabels(state);
    drawWaypoint(state);
    drawMinimap(state, sums);
    drawHud();
  }

  AT.render = {
    init, draw, view, cam, screenToWorld, eventPos, fieldAt, zoomAt, centerOn, buildingAt,
    inMinimap, minimapToWorld, refreshAll, trees: () => trees,
  };
})();
