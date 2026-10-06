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
    } else if (id.kind === 'spreader') {
      // kunstmeststrooier: trechter met twee draaiende schijven
      ctx.fillStyle = '#333'; ctx.fillRect(x0 - 2, -1.2, 2.5, 2.4);
      const g = ctx.createLinearGradient(0, -5, 0, 5);
      g.addColorStop(0, shade(c, 0.3)); g.addColorStop(1, shade(c, -0.25));
      ctx.fillStyle = g; rr(ctx, x0 - 8, -5, 6.5, 10, 1.5); ctx.fill();
      ctx.fillStyle = '#f2efe6'; rr(ctx, x0 - 7.2, -4.2, 4.9, 8.4, 1); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; for (let k = 0; k < 6; k++) ctx.fillRect(x0 - 7 + (k % 3) * 1.6, -3.5 + Math.floor(k / 3) * 4, 0.6, 0.6);
      const spin = (o.t || 0) * 12;
      for (const sy of [-2.5, 2.5]) {
        ctx.fillStyle = '#555'; circle(ctx, x0 - 9.5, sy, 1.8);
        ctx.strokeStyle = '#ddd'; ctx.lineWidth = 0.4;
        ctx.beginPath(); ctx.moveTo(x0 - 9.5 + Math.cos(spin) * 1.6, sy + Math.sin(spin) * 1.6); ctx.lineTo(x0 - 9.5 - Math.cos(spin) * 1.6, sy - Math.sin(spin) * 1.6); ctx.stroke();
      }
      // werkbreedte-armen
      ctx.fillStyle = 'rgba(80,80,80,0.6)'; ctx.fillRect(x0 - 8.5, -W / 2, 0.5, W);
    } else if (id.kind === 'manure') {
      // mestverspreider: aanhanger met mest en strooiwalsen achter
      ctx.fillStyle = '#333'; ctx.fillRect(x0 - 3, -0.8, 3.5, 1.6);
      wheel(ctx, x0 - 11, -6.2, 5, 2.2, o.wheel || 0); wheel(ctx, x0 - 11, 6.2, 5, 2.2, o.wheel || 0);
      const g = ctx.createLinearGradient(0, -5.5, 0, 5.5);
      g.addColorStop(0, shade(c, 0.3)); g.addColorStop(1, shade(c, -0.25));
      ctx.fillStyle = g; rr(ctx, x0 - 18, -5.5, 15.5, 11, 1); ctx.fill();
      ctx.fillStyle = '#4a3320'; rr(ctx, x0 - 17, -4.5, 13.5, 9, 0.8); ctx.fill();
      ctx.fillStyle = '#5e432b'; for (let k = 0; k < 8; k++) circle(ctx, x0 - 16 + (k % 4) * 3.4, -2.5 + Math.floor(k / 4) * 5, 1.4);
      ctx.fillStyle = '#2b2b2b'; ctx.fillRect(x0 - 20, -W / 2, 1.8, W);
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
  const treeCache = {};
  // seizoenskleuren voor loofbomen: [licht, midden, donker]
  const LEAVES = [
    ['#7fbf55', '#4f8f36', '#2f6224'],   // lente
    ['#6eae46', '#3f7f2c', '#275a1e'],   // zomer
    ['#f0b443', '#d2702a', '#8f3d1d'],   // herfst
    null,                                  // winter: kaal
  ];
  function treeSprite(variant, season = 0) {
    const ck = variant + '_' + season;
    if (treeCache[ck]) return treeCache[ck];
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
      if (season === 3) { // sneeuw op de takken
        g.fillStyle = 'rgba(255,255,255,0.85)';
        for (let k = 0; k < 30; k++) { const a = rnd() * Math.PI * 2, d = rnd() * R * 0.9; circle(g, m + Math.cos(a) * d - 0.5, m + Math.sin(a) * d - 0.5, 0.7); }
      }
    } else if (season === 3) {
      // kale winterboom: takken vanuit het midden + sneeuw
      g.strokeStyle = '#5b4632'; g.lineCap = 'round';
      for (let k = 0; k < 7; k++) {
        const a = k / 7 * Math.PI * 2 + rnd() * 0.5, len = R * (0.6 + rnd() * 0.35);
        g.lineWidth = 1.1;
        g.beginPath(); g.moveTo(m, m); g.lineTo(m + Math.cos(a) * len, m + Math.sin(a) * len); g.stroke();
        g.lineWidth = 0.5;
        const bx = m + Math.cos(a) * len * 0.6, by = m + Math.sin(a) * len * 0.6;
        g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a + 0.7) * len * 0.35, by + Math.sin(a + 0.7) * len * 0.35); g.stroke();
      }
      g.fillStyle = '#4a3828'; circle(g, m, m, 1.2);
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (let k = 0; k < 10; k++) circle(g, m + (rnd() - 0.5) * R, m + (rnd() - 0.5) * R, 0.6);
    } else {
      const pal = LEAVES[season];
      const blobs = 6 + Math.floor(rnd() * 3);
      for (let k = 0; k < blobs; k++) {
        const a = rnd() * Math.PI * 2, dist = rnd() * R * 0.45, br = R * (0.45 + rnd() * 0.25);
        const bx = m + Math.cos(a) * dist, by = m + Math.sin(a) * dist;
        const gr = g.createRadialGradient(bx - br * 0.35, by - br * 0.35, br * 0.1, bx, by, br);
        // in de herfst kleurt niet elke boom even hard
        const p2 = season === 2 && variant % 3 === 0 ? LEAVES[1] : pal;
        gr.addColorStop(0, p2[0]); gr.addColorStop(0.55, p2[1]); gr.addColorStop(1, p2[2]);
        g.fillStyle = gr; circle(g, bx, by, br);
      }
      for (let k = 0; k < 14; k++) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(255,240,180,0.35)' : 'rgba(30,40,20,0.3)';
        circle(g, m + (rnd() - 0.5) * R * 1.3, m + (rnd() - 0.5) * R * 1.3, 0.8);
      }
    }
    treeCache[ck] = { canvas: c, R, size: size / S };
    return treeCache[ck];
  }

  function tree(ctx, x, y, variant, sway = 0, season = 0) {
    const t = treeSprite(variant, season);
    ctx.drawImage(t.canvas, x - t.size / 2 + sway, y - t.size / 2 + sway * 0.5, t.size, t.size);
  }
  function treeShadow(ctx, x, y, variant, season = 0) {
    const t = treeSprite(variant, season);
    const k = season === 3 && variant < 6 ? 0.55 : 1; // kale bomen geven minder schaduw
    ctx.beginPath(); ctx.ellipse(x + t.R * 0.55, y + t.R * 0.7, t.R * 0.95 * k, t.R * 0.8 * k, 0, 0, Math.PI * 2); ctx.fill();
  }

  // ---------- dieren (bovenaanzicht) ----------
  function animal(ctx, type, x, y, angle, step) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle);
    if (type === 'cows') {
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(1.5, 2, 5, 2.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f4f1ea'; ctx.beginPath(); ctx.ellipse(0, 0, 5, 2.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2b2b2b';
      ctx.beginPath(); ctx.ellipse(-1.8, -0.8, 1.6, 1.1, 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(1.5, 1, 1.2, 0.9, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3a2f2a'; ctx.beginPath(); ctx.ellipse(5.4, 0, 1.6, 1.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e8b4a8'; ctx.fillRect(6.4, -0.7, 0.8, 1.4);
      ctx.fillStyle = '#d8d0c0'; ctx.fillRect(4.6, -1.8, 0.6, 0.6); ctx.fillRect(4.6, 1.2, 0.6, 0.6);
      ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(-6.2, Math.sin(step) * 0.8); ctx.stroke();
    } else if (type === 'sheep') {
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(1, 1.5, 3.4, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ece9df';
      for (const [bx, by] of [[-1.5, -1], [-1.5, 1], [0.5, -1.2], [0.5, 1.2], [1.8, 0], [-0.5, 0]]) circle(ctx, bx, by, 1.5);
      ctx.fillStyle = '#2c2a28'; ctx.beginPath(); ctx.ellipse(3.3, 0, 1.1, 0.9, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; circle(ctx, 0.6, 0.8, 1.3);
      ctx.fillStyle = (Math.round(x + y) % 3 === 0) ? '#a5652e' : '#f6f3ec';
      ctx.beginPath(); ctx.ellipse(0, 0, 1.5, 1.1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#d63a2c'; ctx.fillRect(1.1, -0.3, 0.7, 0.6);
      ctx.fillStyle = '#f0b429'; ctx.fillRect(1.7, -0.2, 0.5, 0.4);
    }
    ctx.restore();
  }

  // ---------- stallen en fabrieken ----------
  function barn(ctx, r, roof, ridgeVertical = false) {
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(r.x + 6, r.y + 8, r.w, r.h);
    const g = ridgeVertical ? ctx.createLinearGradient(r.x, 0, r.x + r.w, 0) : ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, shade(roof, 0.2)); g.addColorStop(0.49, roof); g.addColorStop(0.51, shade(roof, -0.25)); g.addColorStop(1, shade(roof, -0.35));
    ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    if (ridgeVertical) for (let y = r.y + 2; y < r.y + r.h; y += 3) ctx.fillRect(r.x, y, r.w, 1);
    else for (let x = r.x + 2; x < r.x + r.w; x += 3) ctx.fillRect(x, r.y, 1, r.h);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    if (ridgeVertical) ctx.fillRect(r.x + r.w / 2 - 1, r.y, 2, r.h); else ctx.fillRect(r.x, r.y + r.h / 2 - 1, r.w, 2);
    ctx.strokeStyle = shade(roof, -0.5); ctx.lineWidth = 1.2; ctx.strokeRect(r.x, r.y, r.w, r.h);
  }

  function fence(ctx, r, gateSide = 'top') {
    ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1.2;
    ctx.strokeRect(r.x + 1.5, r.y + 2, r.w, r.h);
    ctx.strokeStyle = '#8b6a45'; ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#5e4129';
    for (let x = r.x; x <= r.x + r.w; x += 12) { ctx.fillRect(x - 1, r.y - 1, 2, 2); ctx.fillRect(x - 1, r.y + r.h - 1, 2, 2); }
    for (let y = r.y; y <= r.y + r.h; y += 12) { ctx.fillRect(r.x - 1, y - 1, 2, 2); ctx.fillRect(r.x + r.w - 1, y - 1, 2, 2); }
  }

  function trough(ctx, x, y, w, full) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x + 1.5, y + 2, w, 5);
    ctx.fillStyle = '#7a6a55'; ctx.fillRect(x, y, w, 5);
    ctx.fillStyle = full ? '#d9b75a' : '#4b3f33'; ctx.fillRect(x + 1, y + 1, w - 2, 3);
  }

  // fabriek: gebouw + details per soort
  function factory(ctx, key, r, roof, t, running) {
    ctx.fillStyle = '#a8a397'; ctx.fillRect(r.x, r.y, r.w, r.h);       // bestrating
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 0.7;
    for (let x = r.x; x < r.x + r.w; x += 12) { ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke(); }
    const b = { x: r.x + 10, y: r.y + 10, w: r.w * 0.58, h: r.h - 20 };
    barn(ctx, b, roof, true);
    const sx = b.x + b.w + 14;
    if (key === 'mill') {
      // klassieke molen met draaiende wieken
      const mx = sx + 26, my = r.y + r.h / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; circle(ctx, mx + 5, my + 6, 16);
      const g = ctx.createRadialGradient(mx - 5, my - 5, 2, mx, my, 16);
      g.addColorStop(0, '#9b9488'); g.addColorStop(1, '#5d564c');
      ctx.fillStyle = g; circle(ctx, mx, my, 16);
      ctx.fillStyle = '#3e3a34'; circle(ctx, mx, my, 5);
      const a0 = running ? t * 1.6 : 0.4;
      for (let k = 0; k < 4; k++) {
        const a = a0 + k * Math.PI / 2;
        ctx.save(); ctx.translate(mx, my); ctx.rotate(a);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(5, 1.5, 34, 7);
        ctx.fillStyle = '#6b4e33'; ctx.fillRect(2, -0.8, 36, 1.6);
        ctx.fillStyle = 'rgba(240,235,220,0.9)'; ctx.fillRect(8, 0.8, 29, 5.5);
        ctx.strokeStyle = 'rgba(80,60,40,0.6)'; ctx.lineWidth = 0.5;
        for (let s2 = 10; s2 < 37; s2 += 4) { ctx.beginPath(); ctx.moveTo(s2, 0.8); ctx.lineTo(s2, 6.3); ctx.stroke(); }
        ctx.restore();
      }
    } else if (key === 'dairy' || key === 'brewery') {
      // opslagtanks (melk = wit, bier = koper)
      const col = key === 'dairy' ? ['#ffffff', '#c9d2d8'] : ['#f0b27a', '#a0522d'];
      for (let k = 0; k < 3; k++) {
        const tx = sx + 12 + (k % 2) * 26, ty = r.y + 24 + Math.floor(k / 2) * 34 + (k % 2) * 6;
        ctx.fillStyle = 'rgba(0,0,0,0.28)'; circle(ctx, tx + 4, ty + 5, 11);
        const g = ctx.createRadialGradient(tx - 4, ty - 4, 1, tx, ty, 11);
        g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
        ctx.fillStyle = g; circle(ctx, tx, ty, 11);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(tx, ty, 11, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; circle(ctx, tx, ty, 2);
      }
    } else if (key === 'bakery') {
      // oven-schoorsteen en kratten brood
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(sx + 4, r.y + 22, 14, 14);
      ctx.fillStyle = '#8d4b3b'; ctx.fillRect(sx, r.y + 18, 14, 14);
      ctx.fillStyle = '#2b2b2b'; ctx.fillRect(sx + 3, r.y + 21, 8, 8);
      for (let k = 0; k < 6; k++) {
        const cx = sx + (k % 3) * 14, cy = r.y + 56 + Math.floor(k / 3) * 14;
        ctx.fillStyle = '#7b5a3a'; ctx.fillRect(cx, cy, 11, 10);
        ctx.fillStyle = '#d9a35b'; for (let j = 0; j < 3; j++) ctx.fillRect(cx + 1.5 + j * 3, cy + 2, 2, 6);
      }
    }
  }

  function buildingLot(ctx, r) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([6, 5]); ctx.lineWidth = 1;
    ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(160,140,100,0.25)'; ctx.fillRect(r.x, r.y, r.w, r.h);
  }

  AT.sprites = { machine, thumb, house, hall, silo, tree, treeShadow, treeSprite, animal, barn, fence, trough, factory, buildingLot, shade, mix, rr, circle };
})();
