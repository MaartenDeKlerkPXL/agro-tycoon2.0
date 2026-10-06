// Agro Tycoon 2.0 — tekeningen: machines, gebouwen, bomen (bovenaanzicht, zon linksboven)
window.AT = window.AT || {};

(function () {
  const D = AT.data;

  // ---------- kleurhelpers ----------
  function rgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // amt > 0 = lichter, amt < 0 = donkerder
  function shade(hex, amt) {
    const [r, g, b] = rgb(hex), t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    const c = v => Math.round(v + (t - v) * p);
    return `rgb(${c(r)},${c(g)},${c(b)})`;
  }
  function mix(a, b, t) {
    const A = rgb(a), B = rgb(b);
    return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`;
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

  // ---------- machines ----------
  // band met profiel; phase laat het profiel "draaien" als de machine rijdt
  function wheel(ctx, x, y, len, wid, phase, angle = 0) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = '#1c1c1c'; rr(ctx, -len / 2, -wid / 2, len, wid, Math.min(1.4, wid / 2)); ctx.fill();
    ctx.fillStyle = '#3d3d3d';
    const step = 1.6, off = ((phase % step) + step) % step;
    for (let s = -len / 2 + off; s < len / 2 - 0.4; s += step) ctx.fillRect(s, -wid / 2 + 0.3, 0.6, wid - 0.6);
    ctx.fillStyle = 'rgba(255,255,255,0.1)'; ctx.fillRect(-len / 2 + 0.5, -wid / 2, len - 1, wid * 0.3);
    ctx.restore();
  }

  // lengte en breedte van de machine (voor de schaduw)
  function footprint(d, implDef) {
    if (d.kind === 'harvester') return { x0: -16, x1: 18, w: Math.max(16, d.width) };
    if (d.kind === 'tractor') return { x0: implDef ? -21 : -12, x1: 11.5, w: Math.max(17, implDef ? implDef.width : 0) };
    return { x0: -10, x1: 1, w: d.width };
  }

  function shadow(ctx, d, implDef, x, y, angle, lift) {
    const f = footprint(d, implDef);
    ctx.save();
    ctx.translate(x + 2.5 + lift, y + 3.5 + lift);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    rr(ctx, f.x0, -8.5, (d.kind === 'harvester' ? 12 : 0) + (-f.x0 + Math.min(f.x1, 11.5)), 17, 4); ctx.fill();
    if (implDef || d.kind !== 'tractor') {
      const w = d.kind === 'harvester' ? d.width : implDef ? implDef.width : d.width;
      if (d.kind === 'harvester') rr(ctx, 13, -w / 2, 5, w, 1.5);
      else rr(ctx, f.x0, -w / 2, 10, w, 1.5);
      ctx.fill();
    }
    ctx.restore();
  }

  // werktuig achter de tractor; x0 = voorkant van het werktuig
  function implement(ctx, id, x0, o) {
    const W = id.width, c = id.color;
    if (id.kind === 'plow') {
      ctx.fillStyle = '#333'; ctx.fillRect(x0 - 2, -1.2, 2.5, 2.4);
      // schuine balk met ploegscharen
      ctx.strokeStyle = shade(c, -0.1); ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0 - 1.5, -W / 2 + 1); ctx.lineTo(x0 - 8.5, W / 2 - 1); ctx.stroke();
      const n = Math.max(3, Math.round(W / 5));
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n, px = x0 - 1.5 - 7 * t, py = -W / 2 + 1 + (W - 2) * t;
        const g = ctx.createLinearGradient(px, py - 2, px, py + 2);
        g.addColorStop(0, '#e8eaec'); g.addColorStop(1, '#8a9096');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(px + 1, py - 1.6); ctx.lineTo(px - 2.5, py - 0.4); ctx.lineTo(px - 2.2, py + 1.8); ctx.lineTo(px + 0.6, py + 0.8);
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = shade(c, 0.2); circle(ctx, x0 - 1, -W / 2 + 1, 1);
    } else if (id.kind === 'seeder') {
      ctx.fillStyle = '#333'; ctx.fillRect(x0 - 2, -1.2, 2.5, 2.4);
      // frame + zaaischijven
      ctx.fillStyle = '#2b2b2b'; ctx.fillRect(x0 - 8.5, -W / 2, 1.2, W);
      for (let s = -W / 2 + 1; s < W / 2; s += 2) ctx.fillRect(x0 - 9.6, s - 0.4, 1.4, 0.8);
      // zaaibak
      const g = ctx.createLinearGradient(0, -W / 2, 0, W / 2);
      g.addColorStop(0, shade(c, 0.25)); g.addColorStop(1, shade(c, -0.25));
      ctx.fillStyle = g; rr(ctx, x0 - 7.5, -W / 2 + 0.5, 6, W - 1, 1.2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      for (let s = -W / 2 + 3; s < W / 2 - 1; s += 4) ctx.fillRect(x0 - 7, s, 5, 0.5);
      // spoortekenaars (opgeklapt)
      ctx.fillStyle = '#555'; ctx.fillRect(x0 - 5, -W / 2 - 1.5, 1, 1.5); ctx.fillRect(x0 - 5, W / 2, 1, 1.5);
    }
  }

  function tractor(ctx, d, o) {
    const c = d.color;
    if (o.implDef) implement(ctx, o.implDef, -11.5, o);
    ctx.fillStyle = '#2d2d2d'; ctx.fillRect(-12.5, -0.8, 3, 1.6);
    // wielen
    wheel(ctx, -5.5, -6.6, 8.5, 3.4, o.wheel);
    wheel(ctx, -5.5, 6.6, 8.5, 3.4, o.wheel);
    wheel(ctx, 6.5, -5, 5, 2.4, o.wheel * 1.6, o.steer);
    wheel(ctx, 6.5, 5, 5, 2.4, o.wheel * 1.6, o.steer);
    // spatborden
    ctx.fillStyle = shade(c, -0.2);
    rr(ctx, -10, -8.7, 9, 2.1, 1); ctx.fill();
    rr(ctx, -10, 6.6, 9, 2.1, 1); ctx.fill();
    // motorkap met glans
    let g = ctx.createLinearGradient(0, -3.2, 0, 3.2);
    g.addColorStop(0, shade(c, 0.35)); g.addColorStop(0.45, c); g.addColorStop(1, shade(c, -0.3));
    ctx.fillStyle = g; rr(ctx, -2, -3.2, 13.5, 6.4, 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let i = 0; i < 3; i++) ctx.fillRect(3 + i * 2, -1.8, 0.5, 3.6);
    ctx.fillStyle = '#1e1e1e'; ctx.fillRect(10.7, -2.4, 0.9, 4.8);
    ctx.fillStyle = o.lights ? '#fffbe0' : '#e9e3b8';
    ctx.fillRect(10.9, -3.1, 0.8, 1.3); ctx.fillRect(10.9, 1.8, 0.8, 1.3);
    // uitlaat
    ctx.fillStyle = '#222'; circle(ctx, 1, -2.3, 0.9);
    ctx.fillStyle = '#555'; circle(ctx, 1, -2.3, 0.45);
    // cabine: glas + dak
    ctx.fillStyle = 'rgba(150,200,225,0.95)'; rr(ctx, -10.2, -4.9, 9.8, 9.8, 1.6); ctx.fill();
    g = ctx.createLinearGradient(0, -4.3, 0, 4.3);
    g.addColorStop(0, shade(c, 0.15)); g.addColorStop(1, shade(c, -0.25));
    ctx.fillStyle = g; rr(ctx, -9.6, -4.3, 8.4, 8.6, 1.3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; rr(ctx, -9.1, -3.9, 7.4, 2.4, 1); ctx.fill();
    // zwaailicht
    ctx.fillStyle = o.beacon ? '#ffb02e' : '#d9822b'; circle(ctx, -8.3, -3.3, 0.8);
  }

  function harvester(ctx, d, o) {
    const c = d.color, W = d.width;
    // maaibord
    ctx.fillStyle = '#4a4d50'; rr(ctx, 12.5, -W / 2, 5.5, W, 1.2); ctx.fill();
    ctx.fillStyle = '#2e3133'; ctx.fillRect(17.4, -W / 2, 0.8, W);
    // haspel (draait als het maaibord omlaag is)
    const ph = o.lowered ? o.t * 6 : 0;
    ctx.fillStyle = '#e8b923';
    for (let k = 0; k < 4; k++) {
      const xx = 13 + ((k * 1.25 + ph) % 5);
      ctx.fillRect(xx, -W / 2 + 1, 0.55, W - 2);
    }
    ctx.fillStyle = shade(c, -0.1);
    ctx.beginPath(); ctx.moveTo(18.2, -W / 2); ctx.lineTo(20, -W / 2 + 0.7); ctx.lineTo(18.2, -W / 2 + 1.6); ctx.fill();
    ctx.beginPath(); ctx.moveTo(18.2, W / 2); ctx.lineTo(20, W / 2 - 0.7); ctx.lineTo(18.2, W / 2 - 1.6); ctx.fill();
    // invoerkanaal
    ctx.fillStyle = '#3a3a3a'; ctx.fillRect(9.5, -2.8, 3.5, 5.6);
    // wielen
    wheel(ctx, -12, -5.6, 4.5, 2.4, o.wheel * 1.4, -o.steer);
    wheel(ctx, -12, 5.6, 4.5, 2.4, o.wheel * 1.4, -o.steer);
    wheel(ctx, 3, -7.4, 7.5, 3.4, o.wheel);
    wheel(ctx, 3, 7.4, 7.5, 3.4, o.wheel);
    // romp
    let g = ctx.createLinearGradient(0, -6.2, 0, 6.2);
    g.addColorStop(0, shade(c, 0.35)); g.addColorStop(0.5, c); g.addColorStop(1, shade(c, -0.3));
    ctx.fillStyle = g; rr(ctx, -15.5, -6.2, 25.5, 12.4, 2.2); ctx.fill();
    // graantank
    ctx.fillStyle = shade(c, -0.35); rr(ctx, -12.5, -4.7, 12, 9.4, 1.6); ctx.fill();
    if (o.grain > 0) {
      ctx.fillStyle = '#e2bf55'; rr(ctx, -12, -4.2, 11, 8.4, 1.4); ctx.fill();
      ctx.fillStyle = 'rgba(255,240,180,0.6)'; circle(ctx, -6.5, -0.8, 2.2);
    }
    // losbuis langs de zijkant
    ctx.fillStyle = '#7b7f83'; ctx.fillRect(-14, -7.6, 17, 1.3);
    ctx.fillStyle = '#5c6064'; ctx.fillRect(2.5, -8.3, 2, 2.2);
    // motorrooster achter
    ctx.fillStyle = '#222'; ctx.fillRect(-15.3, -3, 1, 6);
    // cabine
    ctx.fillStyle = 'rgba(150,200,225,0.95)'; rr(ctx, 2.5, -4.6, 6.8, 9.2, 1.3); ctx.fill();
    g = ctx.createLinearGradient(0, -4, 0, 4);
    g.addColorStop(0, shade(c, 0.25)); g.addColorStop(1, shade(c, -0.15));
    ctx.fillStyle = g; rr(ctx, 3, -4, 5, 8, 1); ctx.fill();
    ctx.fillStyle = o.beacon ? '#ffb02e' : '#d9822b'; circle(ctx, 4, -3.2, 0.7);
    ctx.fillStyle = o.lights ? '#fffbe0' : '#e9e3b8';
    ctx.fillRect(9.1, -4.2, 0.7, 1.2); ctx.fillRect(9.1, 3, 0.7, 1.2);
  }

  // los geparkeerd werktuig (op het erf)
  function parkedImplement(ctx, d) {
    ctx.fillStyle = '#555'; ctx.fillRect(0, -0.6, 2.5, 1.2);
    ctx.fillStyle = '#666'; ctx.fillRect(1.8, -1.2, 1.2, 2.4);
    implement(ctx, d, 0.5, {});
  }

  // o: { implType, lowered, wheel, steer, t, lights, beacon, grain }
  function machine(ctx, type, x, y, angle, o = {}) {
    const d = D.machines[type];
    const implDef = o.implType ? D.machines[o.implType] : null;
    shadow(ctx, d, implDef, x, y, angle, o.lowered === false && (implDef || d.kind === 'harvester') ? 1.2 : 0);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle);
    const opts = Object.assign({ wheel: 0, steer: 0, t: 0, lowered: true }, o, { implDef });
    if (d.kind === 'tractor') tractor(ctx, d, opts);
    else if (d.kind === 'harvester') harvester(ctx, d, opts);
    else parkedImplement(ctx, d);
    ctx.restore();
  }

  // kleine afbeelding voor winkel/garage
  const thumbs = {};
  function thumb(type) {
    if (thumbs[type]) return thumbs[type];
    const d = D.machines[type];
    const c = document.createElement('canvas');
    c.width = 112; c.height = 72;
    const g = c.getContext('2d');
    if (d.kind === 'plow' || d.kind === 'seeder') {
      // werktuig dwars in beeld zodat de werkbreedte goed zichtbaar is
      const s = Math.min(100 / (d.width + 4), 60 / 14, 4);
      g.translate(56, 36 + 5 * s); g.scale(s, s);
      machine(g, type, 0, 0, Math.PI / 2, { lowered: true });
    } else {
      const len = d.kind === 'harvester' ? 36 : 24;
      const wid = d.kind === 'tractor' ? 18 : d.width + 4;
      const s = Math.min(100 / len, 62 / wid, 4);
      g.translate(56 + (d.kind === 'harvester' ? -2 * s : 0), 36);
      g.scale(s, s);
      machine(g, type, 0, 0, 0, { lowered: true });
    }
    thumbs[type] = c.toDataURL();
    return thumbs[type];
  }

  // ---------- gebouwen ----------
  function house(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(x + 6, y + 8, w, h);
    // dak met nok in het midden; bovenste helft in de zon
    ctx.fillStyle = '#c4644a'; ctx.fillRect(x, y, w, h / 2);
    ctx.fillStyle = '#8f3f2e'; ctx.fillRect(x, y + h / 2, w, h / 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.13)'; ctx.lineWidth = 0.7;
    for (let yy = y + 3; yy < y + h; yy += 3.5) { ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke(); }
    for (let xx = x + 4; xx < x + w; xx += 6) {
      for (let yy = y; yy < y + h; yy += 7) { ctx.beginPath(); ctx.moveTo(xx + (yy % 14 ? 3 : 0), yy); ctx.lineTo(xx + (yy % 14 ? 3 : 0), yy + 3.5); ctx.stroke(); }
    }
    ctx.fillStyle = '#e0866a'; ctx.fillRect(x, y + h / 2 - 1.2, w, 2);
    ctx.strokeStyle = '#6e2f22'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
    // schoorsteen + dakkapel
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + w * 0.72 + 3, y + h * 0.22 + 4, 10, 10);
    ctx.fillStyle = '#9c8f84'; ctx.fillRect(x + w * 0.72, y + h * 0.22, 10, 10);
    ctx.fillStyle = '#2b2b2b'; ctx.fillRect(x + w * 0.72 + 2.5, y + h * 0.22 + 2.5, 5, 5);
    ctx.fillStyle = '#b05540'; ctx.fillRect(x + w * 0.25, y + h * 0.62, 18, 14);
    ctx.fillStyle = '#9fd3f0'; ctx.fillRect(x + w * 0.25 + 3, y + h * 0.62 + 9, 12, 4);
  }

  function hall(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + 7, y + 9, w, h);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#a9b3b8'); g.addColorStop(0.49, '#8f999e'); g.addColorStop(0.51, '#6d777c'); g.addColorStop(1, '#5d666b');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    // golfplaten
    for (let xx = x + 1.5; xx < x + w; xx += 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(xx, y, 1, h);
      ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(xx + 1.5, y, 1, h);
    }
    // lichtstraten
    ctx.fillStyle = 'rgba(220,240,255,0.45)';
    for (let xx = x + 30; xx < x + w - 30; xx += 60) { ctx.fillRect(xx, y + 6, 14, h / 2 - 12); ctx.fillRect(xx, y + h / 2 + 6, 14, h / 2 - 12); }
    ctx.fillStyle = '#c8d0d4'; ctx.fillRect(x, y + h / 2 - 1, w, 2);
    ctx.strokeStyle = '#3f4649'; ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
  }

  function silo(ctx, x, y, r, fill) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; circle(ctx, x + 5, y + 6, r);
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, '#f1f3f4'); g.addColorStop(0.6, '#b9c0c5'); g.addColorStop(1, '#7c858b');
    ctx.fillStyle = g; circle(ctx, x, y, r);
    ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 0.6;
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r * 0.2, y + Math.sin(a) * r * 0.2); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke();
    }
    ctx.strokeStyle = '#5f686e'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#6b747a'; circle(ctx, x, y, r * 0.2);
    // vulring rondom: hoeveel graan er in zit
    ctx.strokeStyle = '#e0b84c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r + 2.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fill); ctx.stroke();
  }

  // ---------- bomen ----------
  const treeCache = [];
  function treeSprite(variant) {
    if (treeCache[variant]) return treeCache[variant];
    const conifer = variant >= 6;
    const R = conifer ? 7 + (variant - 6) * 2 : 7 + variant * 1.3;
    const S = 3, size = Math.ceil((R + 2) * 2 * S);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.scale(S, S);
    const m = size / S / 2;
    let seed = variant * 977 + 13;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    if (conifer) {
      for (let layer = 0; layer < 3; layer++) {
        const rr2 = R * (1 - layer * 0.28);
        g.fillStyle = ['#1f4d2a', '#2a6236', '#367a42'][layer];
        g.beginPath();
        for (let k = 0; k <= 16; k++) {
          const a = k / 16 * Math.PI * 2, rad = k % 2 ? rr2 * 0.62 : rr2;
          g.lineTo(m + Math.cos(a) * rad, m + Math.sin(a) * rad);
        }
        g.fill();
      }
      g.fillStyle = '#4b8f52'; circle(g, m - 0.6, m - 0.6, 1.2);
    } else {
      const blobs = 6 + Math.floor(rnd() * 3);
      for (let k = 0; k < blobs; k++) {
        const a = rnd() * Math.PI * 2, dist = rnd() * R * 0.45, br = R * (0.45 + rnd() * 0.25);
        const bx = m + Math.cos(a) * dist, by = m + Math.sin(a) * dist;
        const gr = g.createRadialGradient(bx - br * 0.35, by - br * 0.35, br * 0.1, bx, by, br);
        gr.addColorStop(0, '#7fbf55'); gr.addColorStop(0.55, '#4f8f36'); gr.addColorStop(1, '#2f6224');
        g.fillStyle = gr; circle(g, bx, by, br);
      }
      for (let k = 0; k < 14; k++) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(160,210,110,0.5)' : 'rgba(30,70,25,0.35)';
        circle(g, m + (rnd() - 0.5) * R * 1.3, m + (rnd() - 0.5) * R * 1.3, 0.8);
      }
    }
    treeCache[variant] = { canvas: c, R, size: size / S };
    return treeCache[variant];
  }

  function tree(ctx, x, y, variant, sway = 0) {
    const t = treeSprite(variant);
    ctx.drawImage(t.canvas, x - t.size / 2 + sway, y - t.size / 2 + sway * 0.5, t.size, t.size);
  }
  function treeShadow(ctx, x, y, variant) {
    const t = treeSprite(variant);
    ctx.beginPath(); ctx.ellipse(x + t.R * 0.55, y + t.R * 0.7, t.R * 0.95, t.R * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  }

  AT.sprites = { machine, thumb, house, hall, silo, tree, treeShadow, treeSprite, shade, mix, rr, circle };
})();
