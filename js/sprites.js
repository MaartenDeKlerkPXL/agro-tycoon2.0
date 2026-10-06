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
    if (d.kind === 'tractor') return { x0: implDef ? (implDef.length ? -15 - implDef.length : -21) : -12, x1: 11.5, w: Math.max(17, implDef ? implDef.width : 0) };
    if (d.kind === 'trailer') return { x0: -4 - d.length, x1: 1, w: d.width };
    if (d.kind === 'truck') return { x0: -21, x1: 12.5, w: 14 };
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
      else { const ld = implDef || d; rr(ctx, f.x0, -w / 2, ld.length ? ld.length + 2 : 10, w, 1.5); }
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
      if (id.sows === 'potato') {
        ctx.fillStyle = '#6b4a2a'; rr(ctx, x0 - 9, -W / 2 - 1, 8, W + 2, 1.2); ctx.fill();
        ctx.fillStyle = '#c9a46a'; for (let k = 0; k < 6; k++) circle(ctx, x0 - 7.5 + (k % 2) * 3, -W / 2 + 2 + Math.floor(k / 2) * (W / 3), 1.1);
      }
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
    } else if (id.kind === 'mower') {
      // maaibalk met schijven, opzij uitgeklapt
      ctx.fillStyle = '#333'; ctx.fillRect(x0 - 3, -1, 3.5, 2);
      ctx.fillStyle = shade(c, -0.1); rr(ctx, x0 - 7, -W / 2, 4, W, 1); ctx.fill();
      ctx.fillStyle = '#d9d9d9';
      const spin = (o.t || 0) * 20;
      for (let s2 = -W / 2 + 2; s2 < W / 2 - 1; s2 += 3.6) {
        ctx.save(); ctx.translate(x0 - 5, s2 + 1); ctx.rotate(o.lowered ? spin : 0);
        ctx.fillRect(-1.3, -0.3, 2.6, 0.6); ctx.restore();
      }
      ctx.fillStyle = shade(c, 0.25); rr(ctx, x0 - 6, -3, 3, 6, 0.8); ctx.fill();
    } else if (id.kind === 'tedder') {
      // schudder: rij draaiende rotoren met tanden
      ctx.fillStyle = '#333'; ctx.fillRect(x0 - 4, -1, 4.5, 2);
      ctx.fillStyle = shade(c, -0.2); ctx.fillRect(x0 - 6, -W / 2, 1.2, W);
      const spin = (o.t || 0) * 8;
      for (let s2 = -W / 2 + 3; s2 < W / 2 - 1; s2 += 5.5) {
        ctx.fillStyle = shade(c, 0.1); circle(ctx, x0 - 8, s2, 2.6);
        ctx.strokeStyle = '#555'; ctx.lineWidth = 0.4;
        for (let k = 0; k < 6; k++) {
          const a = spin * (s2 > 0 ? 1 : -1) + k * Math.PI / 3;
          ctx.beginPath(); ctx.moveTo(x0 - 8, s2); ctx.lineTo(x0 - 8 + Math.cos(a) * 3, s2 + Math.sin(a) * 3); ctx.stroke();
        }
      }
    } else if (id.kind === 'baler') {
      // balenpers: opraapsysteem + kamer, met een baal erachter als hij werkt
      ctx.fillStyle = '#333'; ctx.fillRect(x0 - 4, -0.8, 4.5, 1.6);
      wheel(ctx, x0 - 11, -5.5, 4, 2, o.wheel || 0); wheel(ctx, x0 - 11, 5.5, 4, 2, o.wheel || 0);
      ctx.fillStyle = '#555'; ctx.fillRect(x0 - 6, -W / 2 - 1, 2, W + 2);
      const g = ctx.createLinearGradient(0, -4.5, 0, 4.5);
      g.addColorStop(0, shade(c, 0.3)); g.addColorStop(1, shade(c, -0.25));
      ctx.fillStyle = g; rr(ctx, x0 - 16, -4.5, 11, 9, 1.4); ctx.fill();
      ctx.fillStyle = '#e6d28a'; circle(ctx, x0 - 18, 0, 3);
      ctx.strokeStyle = '#b89c4c'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.arc(x0 - 18, 0, 2, 0, Math.PI * 2); ctx.stroke();
    } else if (id.kind === 'trailer') {
      // kipper: dissel, twee assen, laadbak met zichtbare lading
      const L = id.length, Wt = id.width;
      ctx.fillStyle = '#333'; ctx.fillRect(x0 - 3.5, -0.8, 4, 1.6);
      const bx = x0 - 3 - L;
      for (const ax of [bx + L * 0.3, bx + L * 0.55]) {
        wheel(ctx, ax, -Wt / 2 - 0.2, 4.5, 2.2, o.wheel || 0); wheel(ctx, ax, Wt / 2 + 0.2, 4.5, 2.2, o.wheel || 0);
      }
      const g = ctx.createLinearGradient(0, -Wt / 2, 0, Wt / 2);
      g.addColorStop(0, shade(c, 0.3)); g.addColorStop(1, shade(c, -0.3));
      ctx.fillStyle = g; rr(ctx, bx, -Wt / 2 + 0.6, L, Wt - 1.2, 1); ctx.fill();
      ctx.fillStyle = '#3b3b3b'; rr(ctx, bx + 1, -Wt / 2 + 1.6, L - 2, Wt - 3.2, 0.6); ctx.fill();
      const frac = o.load && o.load.tons > 0 ? Math.min(1, o.load.tons / id.capacity) : 0;
      if (frac > 0 && o.load.crop === 'hay') {
        // ronde balen in rijen van twee
        const n = Math.round(o.load.tons / D.baleTons), cols = Math.max(1, Math.floor((L - 2) / 6));
        for (let k = 0; k < Math.min(n, cols * 2); k++) bale(ctx, bx + 4 + (k % cols) * 6, (k < cols ? -1 : 1) * (Wt / 4 - 0.2), 0, 0.85);
      } else if (frac > 0) {
        const col = D.crops[o.load.crop] ? D.crops[o.load.crop].color : '#e2bf55';
        const gg = ctx.createRadialGradient(bx + L / 2, 0, 0.5, bx + L / 2, 0, L / 2);
        gg.addColorStop(0, shade(col, 0.25)); gg.addColorStop(1, shade(col, -0.15));
        ctx.fillStyle = gg;
        ctx.globalAlpha = 0.55 + 0.45 * frac;
        rr(ctx, bx + 1.2, -Wt / 2 + 1.8, (L - 2.4), Wt - 3.6, 0.6); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(bx + L / 2, -1, L * 0.3 * frac, (Wt / 2 - 2) * frac, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = shade(c, -0.45); ctx.lineWidth = 0.6;
      for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(bx + L * k / 4, -Wt / 2 + 0.6); ctx.lineTo(bx + L * k / 4, -Wt / 2 + 1.6); ctx.stroke(); }
      if (o.tipping) { ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(ctx, bx, -Wt / 2 + 0.6, L, Wt - 1.2, 1); ctx.fill(); }
    } else if (id.kind === 'mixer') {
      // voermengwagen: bak met mengvijzel en afvoerband opzij
      const L = id.length, Wt = id.width;
      ctx.fillStyle = '#333'; ctx.fillRect(x0 - 3.5, -0.8, 4, 1.6);
      const bx = x0 - 3 - L;
      for (const ax of [bx + L * 0.35, bx + L * 0.6]) { wheel(ctx, ax, -Wt / 2 - 0.2, 4.5, 2.2, o.wheel || 0); wheel(ctx, ax, Wt / 2 + 0.2, 4.5, 2.2, o.wheel || 0); }
      const g = ctx.createLinearGradient(0, -Wt / 2, 0, Wt / 2);
      g.addColorStop(0, shade(c, 0.3)); g.addColorStop(1, shade(c, -0.3));
      ctx.fillStyle = g; rr(ctx, bx, -Wt / 2 + 0.6, L, Wt - 1.2, 2.5); ctx.fill();
      ctx.fillStyle = '#2c3e50'; rr(ctx, bx + 1.2, -Wt / 2 + 1.8, L - 2.4, Wt - 3.6, 2); ctx.fill();
      const frac = o.load && o.load.tons > 0 ? Math.min(1, o.load.tons / id.capacity) : 0;
      if (frac > 0) { ctx.globalAlpha = 0.5 + 0.5 * frac; ctx.fillStyle = '#c49a5a'; rr(ctx, bx + 1.6, -Wt / 2 + 2.2, L - 3.2, Wt - 4.4, 1.8); ctx.fill(); ctx.globalAlpha = 1; }
      ctx.strokeStyle = '#95a5a6'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(bx + 2, 0); for (let x = 0; x < L - 4; x += 1) ctx.lineTo(bx + 2 + x, Math.sin((x + (o.t || 0) * 10) * 0.9) * 1.6); ctx.stroke();
      ctx.fillStyle = '#7f8c8d'; ctx.fillRect(bx + L * 0.4, Wt / 2 - 1, 4, 3);
    } else if (id.kind === 'cultivator') {
      // cultivator: frame met drie rijen tanden
      ctx.fillStyle = '#333'; ctx.fillRect(x0 - 3, -1, 3.5, 2);
      ctx.fillStyle = shade(c, -0.1); ctx.fillRect(x0 - 4, -W / 2, 2, W); ctx.fillRect(x0 - 12, -W / 2, 2, W);
      ctx.fillStyle = c; ctx.fillRect(x0 - 12, -1.2, 9, 2.4);
      ctx.fillStyle = '#d0d3d4';
      for (const tx of [x0 - 6, x0 - 9, x0 - 13.5]) for (let s = -W / 2 + 1.5 + (tx === x0 - 9 ? 1.5 : 0); s < W / 2 - 0.5; s += 3) ctx.fillRect(tx, s, 1.4, 0.9);
      ctx.fillStyle = '#5d6d7e'; ctx.fillRect(x0 - 16, -W / 2, 2.4, W);   // rol achteraan
    } else if (id.kind === 'roller') {
      // rol: segmenten van gietijzeren ringen
      ctx.fillStyle = '#333'; ctx.fillRect(x0 - 3, -0.8, 3.5, 1.6);
      ctx.fillStyle = shade(c, -0.2); ctx.fillRect(x0 - 5, -W / 2, 1.6, W);
      const g = ctx.createLinearGradient(x0 - 11, 0, x0 - 6, 0);
      g.addColorStop(0, '#5d6466'); g.addColorStop(0.5, '#a9b0b2'); g.addColorStop(1, '#4b5153');
      ctx.fillStyle = g; ctx.fillRect(x0 - 11, -W / 2, 5, W);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      const off = ((o.wheel || 0) % 2 + 2) % 2;
      for (let s = -W / 2 + off; s < W / 2; s += 2) ctx.fillRect(x0 - 11, s, 5, 0.5);
    } else if (id.kind === 'stonepicker') {
      // stenenraper: opraapwals voor en een bak met stenen
      ctx.fillStyle = '#333'; ctx.fillRect(x0 - 3, -0.8, 3.5, 1.6);
      wheel(ctx, x0 - 12, -7, 4.5, 2, o.wheel || 0); wheel(ctx, x0 - 12, 7, 4.5, 2, o.wheel || 0);
      ctx.fillStyle = '#444'; ctx.fillRect(x0 - 20, -W / 2, 2.5, W);
      const g = ctx.createLinearGradient(0, -6, 0, 6);
      g.addColorStop(0, shade(c, 0.3)); g.addColorStop(1, shade(c, -0.25));
      ctx.fillStyle = g; rr(ctx, x0 - 17, -6, 13, 12, 1); ctx.fill();
      ctx.fillStyle = '#8e8e86';
      for (let k = 0; k < 9; k++) circle(ctx, x0 - 15 + (k % 3) * 4, -3.5 + Math.floor(k / 3) * 3.5, 1.2);
    } else if (id.kind === 'lime') {
      // kalkstrooier: brede bak met kalk en een strooibalk
      ctx.fillStyle = '#333'; ctx.fillRect(x0 - 3, -0.8, 3.5, 1.6);
      wheel(ctx, x0 - 10, -6.5, 4.5, 2, o.wheel || 0); wheel(ctx, x0 - 10, 6.5, 4.5, 2, o.wheel || 0);
      const g = ctx.createLinearGradient(0, -6, 0, 6);
      g.addColorStop(0, shade(c, 0.35)); g.addColorStop(1, shade(c, -0.25));
      ctx.fillStyle = g; rr(ctx, x0 - 16, -6, 13, 12, 1.2); ctx.fill();
      ctx.fillStyle = '#ecebe6'; rr(ctx, x0 - 15, -5, 11, 10, 0.8); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.08)'; for (let k = 0; k < 8; k++) ctx.fillRect(x0 - 14 + (k % 4) * 2.6, -4 + Math.floor(k / 4) * 5, 0.8, 0.8);
      ctx.fillStyle = '#555'; ctx.fillRect(x0 - 18, -W / 2, 1.4, W);
    } else if (id.kind === 'sprayer') {
      // spuitmachine: tank met lange spuitboom en doppen
      ctx.fillStyle = '#333'; ctx.fillRect(x0 - 3, -0.8, 3.5, 1.6);
      wheel(ctx, x0 - 11, -5.5, 4.5, 1.8, o.wheel || 0); wheel(ctx, x0 - 11, 5.5, 4.5, 1.8, o.wheel || 0);
      const g = ctx.createLinearGradient(0, -5, 0, 5);
      g.addColorStop(0, '#f4f6f7'); g.addColorStop(1, '#b8c2c8');
      ctx.fillStyle = g; rr(ctx, x0 - 16, -4.5, 12.5, 9, 4); ctx.fill();
      ctx.fillStyle = c; ctx.fillRect(x0 - 16, -0.6, 12.5, 1.2);
      const folded = o.lowered === false;
      const half = folded ? 6 : W / 2;
      ctx.fillStyle = '#444'; ctx.fillRect(x0 - 18.5, -half, 1.2, half * 2);
      ctx.fillStyle = c; for (let s = -half + 1; s < half; s += 3) ctx.fillRect(x0 - 19, s, 0.8, 0.8);
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
    if (o.implDef) implement(ctx, o.implDef, -11.5, Object.assign({}, o, { load: o.implLoad }));
    ctx.fillStyle = '#2d2d2d'; ctx.fillRect(-12.5, -0.8, 3, 1.6);
    // wielen (of rupsen)
    if (d.tracks) {
      for (const sy of [-6.4, 6.4]) wheel(ctx, 0.5, sy, 21, 3.8, o.wheel);
    } else {
      wheel(ctx, -5.5, -6.6, 8.5, 3.4, o.wheel);
      wheel(ctx, -5.5, 6.6, 8.5, 3.4, o.wheel);
      wheel(ctx, 6.5, -5, 5, 2.4, o.wheel * 1.6, o.steer);
      wheel(ctx, 6.5, 5, 5, 2.4, o.wheel * 1.6, o.steer);
    }
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
    const root = d.harvests && d.harvests !== 'combine';
    if (root) {
      // rooier: schijven die de grond openen en een transportband naar binnen
      const ph = o.lowered ? o.t * 4 : 0;
      ctx.fillStyle = '#6b6f73';
      for (let s2 = -W / 2 + 2; s2 < W / 2 - 1; s2 += 4) { circle(ctx, 16.5, s2 + 1, 1.3); }
      ctx.fillStyle = '#2f3234'; ctx.fillRect(13, -2, 4, 4);
      ctx.fillStyle = '#8a8f93';
      for (let k = 0; k < 4; k++) ctx.fillRect(13 + ((k + ph) % 4), -1.8, 0.5, 3.6);
    } else {
      // haspel (draait als het maaibord omlaag is)
      const ph = o.lowered ? o.t * 6 : 0;
      ctx.fillStyle = '#e8b923';
      for (let k = 0; k < 4; k++) {
        const xx = 13 + ((k * 1.25 + ph) % 5);
        ctx.fillRect(xx, -W / 2 + 1, 0.55, W - 2);
      }
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
      const col = o.grainColor || (d.harvests === 'potato' ? '#c9a46a' : d.harvests === 'beet' ? '#e9dccd' : '#e2bf55');
      ctx.fillStyle = col;
      ctx.globalAlpha = 0.5 + 0.5 * Math.min(1, o.grain);
      const gh = 8.4 * Math.min(1, 0.35 + 0.65 * o.grain);
      rr(ctx, -12, -gh / 2, 11, gh, 1.4); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,240,180,0.6)'; circle(ctx, -6.5, -0.8, 1 + 1.4 * Math.min(1, o.grain));
    }
    if (o.auger) {
      // losbuis uitgeklapt naar links
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-1, -25, 2.2, 19);
      ctx.fillStyle = '#8a8f93'; ctx.fillRect(-3, -26, 2.2, 20);
      ctx.fillStyle = '#5c6064'; ctx.fillRect(-3.6, -27, 3.4, 2.4);
    } else {
      // losbuis langs de zijkant
      ctx.fillStyle = '#7b7f83'; ctx.fillRect(-14, -7.6, 17, 1.3);
      ctx.fillStyle = '#5c6064'; ctx.fillRect(2.5, -8.3, 2, 2.2);
    }
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

  function truck(ctx, d, o) {
    const c = d.color;
    // laadbak met pallets
    wheel(ctx, -14, -6.2, 5, 2.4, o.wheel); wheel(ctx, -14, 6.2, 5, 2.4, o.wheel);
    wheel(ctx, -8, -6.2, 5, 2.4, o.wheel); wheel(ctx, -8, 6.2, 5, 2.4, o.wheel);
    wheel(ctx, 8, -6, 5, 2.4, o.wheel * 1.4, o.steer); wheel(ctx, 8, 6, 5, 2.4, o.wheel * 1.4, o.steer);
    ctx.fillStyle = '#d7d2c4'; rr(ctx, -20, -6.5, 22, 13, 1); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.5;
    for (let x = -18; x < 1; x += 4) { ctx.beginPath(); ctx.moveTo(x, -6.5); ctx.lineTo(x, 6.5); ctx.stroke(); }
    const n = Math.round((o.cargoFrac || 0) * 10);
    for (let k = 0; k < n; k++) {
      ctx.fillStyle = k % 2 ? '#b58b55' : '#c79d63';
      ctx.fillRect(-19 + (k % 5) * 4, -5.5 + Math.floor(k / 5) * 6, 3.4, 5);
    }
    // cabine
    const g = ctx.createLinearGradient(0, -6, 0, 6);
    g.addColorStop(0, shade(c, 0.35)); g.addColorStop(1, shade(c, -0.25));
    ctx.fillStyle = g; rr(ctx, 3, -6, 9, 12, 2); ctx.fill();
    ctx.fillStyle = 'rgba(150,200,225,0.95)'; ctx.fillRect(10, -5, 1.6, 10);
    ctx.fillStyle = o.lights ? '#fffbe0' : '#e9e3b8'; ctx.fillRect(11.7, -5.5, 0.6, 1.5); ctx.fillRect(11.7, 4, 0.6, 1.5);
  }

  // ronde baal hooi (bovenaanzicht: liggende cilinder)
  function bale(ctx, x, y, a = 0, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, -2.4, -3.2, 6, 7.6, 2); ctx.fill();
    const g = ctx.createLinearGradient(-3, 0, 3, 0);
    g.addColorStop(0, '#b89a4e'); g.addColorStop(0.5, '#e6cf86'); g.addColorStop(1, '#a8893f');
    ctx.fillStyle = g; rr(ctx, -3, -3.6, 6, 7.2, 1.6); ctx.fill();
    ctx.strokeStyle = 'rgba(120,95,40,0.6)'; ctx.lineWidth = 0.35;
    for (const yy of [-1.8, 0, 1.8]) { ctx.beginPath(); ctx.moveTo(-3, yy); ctx.lineTo(3, yy); ctx.stroke(); }
    ctx.restore();
  }

  // los geparkeerd werktuig (op het erf)
  function parkedImplement(ctx, d, o) {
    ctx.fillStyle = '#555'; ctx.fillRect(0, -0.6, 2.5, 1.2);
    ctx.fillStyle = '#666'; ctx.fillRect(1.8, -1.2, 1.2, 2.4);
    implement(ctx, d, 0.5, o || {});
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
    else if (d.kind === 'harvester' || d.kind === 'fruitharvester') harvester(ctx, d, opts);
    else if (d.kind === 'truck') truck(ctx, d, opts);
    else parkedImplement(ctx, d, opts);
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
    if (['plow', 'seeder', 'sprayer', 'lime', 'cultivator', 'roller', 'stonepicker'].includes(d.kind)) {
      // werktuig dwars in beeld zodat de werkbreedte goed zichtbaar is
      const s = Math.min(100 / (d.width + 4), 60 / 14, 4);
      g.translate(56, 36 + 5 * s); g.scale(s, s);
      machine(g, type, 0, 0, Math.PI / 2, { lowered: true });
    } else {
      const len = d.kind === 'harvester' ? 36 : d.kind === 'truck' ? 34 : 24;
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

  function tree(ctx, x, y, variant, sway = 0, season = 0, scale = 1) {
    const t = treeSprite(variant, season);
    const sz = t.size * scale;
    ctx.drawImage(t.canvas, x - sz / 2 + sway, y - sz / 2 + sway * 0.5, sz, sz);
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
    } else if (type === 'pigs') {
      ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(1, 1.5, 3.8, 2.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f2b8aa'; ctx.beginPath(); ctx.ellipse(0, 0, 3.8, 2.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = (Math.round(x * 3 + y) % 4 === 0) ? 'rgba(80,60,50,0.55)' : 'rgba(0,0,0,0)';
      ctx.beginPath(); ctx.ellipse(-1, -0.4, 1.3, 1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e79c8c'; ctx.beginPath(); ctx.ellipse(3.9, 0, 1, 0.9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b5675a'; ctx.fillRect(4.4, -0.4, 0.4, 0.3); ctx.fillRect(4.4, 0.1, 0.4, 0.3);
      ctx.fillStyle = '#d9897a'; ctx.fillRect(2.4, -1.9, 0.9, 0.7); ctx.fillRect(2.4, 1.2, 0.9, 0.7);
      ctx.strokeStyle = '#d9897a'; ctx.lineWidth = 0.4; ctx.beginPath(); ctx.arc(-4, 0, 0.6, 0, Math.PI * 1.5); ctx.stroke();
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

  // hek rond een weide; gate = { x0, x1 } = opening in de bovenkant
  function fence(ctx, r, gate = null) {
    const segs = [[r.x, r.y + r.h, r.x + r.w, r.y + r.h], [r.x, r.y, r.x, r.y + r.h], [r.x + r.w, r.y, r.x + r.w, r.y + r.h]];
    if (gate) segs.push([r.x, r.y, gate.x0, r.y], [gate.x1, r.y, r.x + r.w, r.y]); else segs.push([r.x, r.y, r.x + r.w, r.y]);
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    for (const [a, b, c, d] of segs) { ctx.beginPath(); ctx.moveTo(a + 1.5, b + 2); ctx.lineTo(c + 1.5, d + 2); ctx.stroke(); }
    ctx.strokeStyle = '#8b6a45';
    for (const [a, b, c, d] of segs) { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); }
    ctx.fillStyle = '#5e4129';
    for (const [a, b, c, d] of segs) {
      const len = Math.hypot(c - a, d - b);
      for (let s = 0; s <= len; s += 12) ctx.fillRect(a + (c - a) * s / len - 1, b + (d - b) * s / len - 1, 2, 2);
    }
    if (gate) { ctx.fillStyle = '#4a3320'; ctx.fillRect(gate.x0 - 1.5, r.y - 2, 3, 4); ctx.fillRect(gate.x1 - 1.5, r.y - 2, 3, 4); }
  }
  // dieselpomp op het erf
  function fuelPump(ctx, x, y) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, x - 3, y - 4, 8, 10, 1.5); ctx.fill();
    ctx.fillStyle = '#c0392b'; rr(ctx, x - 4, y - 5, 8, 10, 1.5); ctx.fill();
    ctx.fillStyle = '#f4f1e6'; ctx.fillRect(x - 2.8, y - 3.6, 5.6, 3);
    ctx.fillStyle = '#222'; ctx.fillRect(x + 4, y - 1, 2.5, 0.8); ctx.fillRect(x + 6, y - 1, 0.8, 4);
    ctx.fillStyle = '#7f8c8d'; ctx.fillRect(x - 9, y + 6, 18, 2);   // betonplaat
  }

  function trough(ctx, x, y, w, full, frac = full ? 1 : 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x + 1.5, y + 2, w, 5);
    ctx.fillStyle = '#7a6a55'; ctx.fillRect(x, y, w, 5);
    ctx.fillStyle = '#4b3f33'; ctx.fillRect(x + 1, y + 1, w - 2, 3);
    if (frac > 0) { ctx.fillStyle = '#d9b75a'; ctx.fillRect(x + 1, y + 1, (w - 2) * Math.min(1, frac), 3); }
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
    } else if (['dairy', 'brewery', 'oilpress', 'sugar'].includes(key)) {
      // opslagtanks: melk = wit, bier = koper, olie = goud, suiker = grote witte silo's
      const col = { dairy: ['#ffffff', '#c9d2d8'], brewery: ['#f0b27a', '#a0522d'], oilpress: ['#ffe8a0', '#b8962e'], sugar: ['#ffffff', '#cfc9bb'] }[key];
      for (let k = 0; k < 3; k++) {
        const tx = sx + 12 + (k % 2) * 26, ty = r.y + 24 + Math.floor(k / 2) * 34 + (k % 2) * 6;
        ctx.fillStyle = 'rgba(0,0,0,0.28)'; circle(ctx, tx + 4, ty + 5, 11);
        const g = ctx.createRadialGradient(tx - 4, ty - 4, 1, tx, ty, 11);
        g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
        ctx.fillStyle = g; circle(ctx, tx, ty, 11);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(tx, ty, 11, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,0.3)'; circle(ctx, tx, ty, 2);
      }
    } else if (key === 'silage' || key === 'feedmix') {
      // sleufsilo: betonnen wanden met een afgedekte hoop (zwart plastic met banden); mengerij: twee voersilo's
      if (key === 'silage') {
        const bx = sx - 4, bw = r.x + r.w - bx - 8, by = r.y + 10, bh = r.h - 20;
        ctx.fillStyle = '#9a9a92'; ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = running ? '#7a8f3a' : '#3d3d3d'; ctx.fillRect(bx + 3, by + 3, bw - 6, bh - 6);
        ctx.fillStyle = '#1f1f1f';
        for (let k = 0; k < 8; k++) circle(ctx, bx + 8 + (k % 4) * (bw - 16) / 3, by + 10 + Math.floor(k / 4) * (bh - 20), 2.4);
      } else {
        for (let k = 0; k < 2; k++) {
          const tx = sx + 14 + k * 28, ty = r.y + r.h / 2;
          ctx.fillStyle = 'rgba(0,0,0,0.28)'; circle(ctx, tx + 4, ty + 5, 12);
          const g = ctx.createRadialGradient(tx - 4, ty - 4, 1, tx, ty, 12);
          g.addColorStop(0, '#e8e8e2'); g.addColorStop(1, '#9fa39a');
          ctx.fillStyle = g; circle(ctx, tx, ty, 12);
          ctx.fillStyle = 'rgba(0,0,0,0.3)'; circle(ctx, tx, ty, 2.5);
        }
      }
    } else if (key === 'winery') {
      // eikenhouten vaten
      for (let k = 0; k < 6; k++) {
        const vx = sx + 4 + (k % 3) * 22, vy = r.y + 26 + Math.floor(k / 3) * 34;
        ctx.fillStyle = 'rgba(0,0,0,0.28)'; circle(ctx, vx + 3, vy + 4, 9);
        const g = ctx.createRadialGradient(vx - 3, vy - 3, 1, vx, vy, 9);
        g.addColorStop(0, '#b07a45'); g.addColorStop(1, '#6e4524');
        ctx.fillStyle = g; circle(ctx, vx, vy, 9);
        ctx.strokeStyle = '#3b3b3b'; ctx.lineWidth = 0.8;
        for (const rr2 of [4, 7.5]) { ctx.beginPath(); ctx.arc(vx, vy, rr2, 0, Math.PI * 2); ctx.stroke(); }
      }
    } else if (key === 'sawmill') {
      logPile(ctx, sx - 2, r.y + 14);
      logPile(ctx, sx - 2, r.y + 44);
      ctx.fillStyle = '#c9a46a'; for (let k = 0; k < 4; k++) ctx.fillRect(sx, r.y + 78 + k * 5, 30, 3);
    } else if (key === 'bakery' || key === 'chips') {
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

  function pit(ctx, r) {
    ctx.fillStyle = '#6f6d66'; ctx.fillRect(r.x - 3, r.y - 3, r.w + 6, r.h + 6);
    ctx.fillStyle = '#2b2b2b'; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = '#8c8a83'; ctx.lineWidth = 0.8;
    for (let x = r.x + 2; x < r.x + r.w; x += 3) { ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke(); }
    ctx.fillStyle = '#f2c94c';
    for (let x = r.x - 3; x < r.x + r.w + 3; x += 8) { ctx.fillRect(x, r.y - 3, 4, 2); ctx.fillRect(x + 4, r.y + r.h + 1, 4, 2); }
  }

  function trader(ctx, lot, p, t) {
    ctx.fillStyle = '#a8a397'; ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    barn(ctx, { x: lot.x + 8, y: lot.y + 8, w: 74, h: 52 }, '#3f6e8c');
    // grote graansilo's van de handel
    for (let k = 0; k < 2; k++) silo(ctx, lot.x + 102 + (k % 2) * 0, lot.y + 22 + k * 32, 13, 0.6);
    pit(ctx, p);
    // bord
    ctx.fillStyle = '#2d6a2d'; ctx.fillRect(lot.x + 8, lot.y + 66, 60, 12);
    ctx.fillStyle = '#fff'; ctx.font = '600 7px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('GRAANHANDEL', lot.x + 11, lot.y + 72.5);
  }

  function greenhouse(ctx, r, crop, t) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(r.x + 5, r.y + 6, r.w, r.h);
    ctx.fillStyle = crop === 'lettuce' ? '#7ccf5a' : '#4f9a3a'; ctx.fillRect(r.x, r.y, r.w, r.h);
    // plantenrijen
    for (let y = r.y + 6; y < r.y + r.h - 4; y += 8) {
      ctx.fillStyle = crop === 'lettuce' ? '#a6e07f' : '#3d7a35'; ctx.fillRect(r.x + 4, y, r.w - 8, 4);
      if (crop !== 'lettuce') { ctx.fillStyle = '#e74c3c'; for (let x = r.x + 8; x < r.x + r.w - 6; x += 9) ctx.fillRect(x, y + 1, 1.6, 1.6); }
    }
    // glas
    ctx.fillStyle = 'rgba(210,235,250,0.45)'; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 0.8;
    for (let x = r.x; x <= r.x + r.w; x += 12) { ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke(); }
    for (let y = r.y; y <= r.y + r.h; y += 31) { ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke(); }
    const shine = ((t * 0.15) % 1) * (r.w + 60) - 30;
    ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(r.x + Math.max(0, shine), r.y, Math.min(24, r.w - Math.max(0, shine)), r.h);
    ctx.strokeStyle = '#9aa7ad'; ctx.lineWidth = 1.5; ctx.strokeRect(r.x, r.y, r.w, r.h);
  }

  function logPile(ctx, x, y) {
    for (let k = 0; k < 5; k++) {
      ctx.fillStyle = '#8b6a45'; ctx.fillRect(x, y + k * 4, 26, 3.4);
      ctx.fillStyle = '#d9b98a'; circle(ctx, x + 26, y + k * 4 + 1.7, 1.7);
    }
  }

  // verkooppunt-gebouw met losplek
  function sellPoint(ctx, id, d, t) {
    const r = d.lot, p = d.pit;
    ctx.fillStyle = '#a8a397'; ctx.fillRect(r.x, r.y, r.w, r.h);
    if (id === 'harbor') {
      // water met een schip en een kraan
      const wx = r.x + 110;
      ctx.fillStyle = '#3a7fb0'; ctx.fillRect(wx, r.y, r.x + r.w - wx + 20, r.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1;
      for (let k = 0; k < 8; k++) { const yy = r.y + 20 + k * 35 + Math.sin(t + k) * 2; ctx.beginPath(); ctx.moveTo(wx + 10, yy); ctx.lineTo(wx + 40, yy); ctx.stroke(); }
      ctx.fillStyle = '#6b7b8c'; ctx.fillRect(wx - 8, r.y, 8, r.h);
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, wx + 22, r.y + 92, 52, 150, 18); ctx.fill();
      ctx.fillStyle = '#b03a2e'; rr(ctx, wx + 18, r.y + 86, 52, 150, 18); ctx.fill();
      ctx.fillStyle = '#ecf0f1'; ctx.fillRect(wx + 28, r.y + 200, 32, 26);
      ctx.fillStyle = '#2c3e50'; for (let k = 0; k < 4; k++) ctx.fillRect(wx + 26, r.y + 100 + k * 24, 36, 18);
      ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(wx - 4, r.y + 160); ctx.lineTo(wx + 44, r.y + 130); ctx.stroke();
      barn(ctx, { x: r.x + 10, y: r.y + 60, w: 86, h: 90 }, d.roof);
    } else if (id === 'feed') {
      barn(ctx, { x: r.x + 100, y: r.y + 12, w: 120, h: 70 }, d.roof);
      for (let k = 0; k < 3; k++) silo(ctx, r.x + 120 + k * 34, r.y + 130, 14, 0.5);
    } else if (id === 'shop') {
      barn(ctx, { x: r.x + 100, y: r.y + 10, w: 120, h: 90 }, d.roof);
      ctx.fillStyle = '#8e8d87'; ctx.fillRect(r.x + 100, r.y + 108, 120, 64);
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 0.8;
      for (let x = r.x + 104; x < r.x + 220; x += 14) { ctx.beginPath(); ctx.moveTo(x, r.y + 112); ctx.lineTo(x, r.y + 132); ctx.stroke(); }
      const cars = ['#c0392b', '#2980b9', '#ecf0f1', '#27ae60'];
      for (let k = 0; k < 4; k++) { ctx.fillStyle = cars[k]; rr(ctx, r.x + 106 + k * 28, r.y + 114, 9, 16, 2); ctx.fill(); }
    }
    pit(ctx, p);
  }

  function dock(ctx, r) {
    ctx.fillStyle = '#7d7a72'; ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = '#f2c94c'; for (let x = r.x; x < r.x + r.w; x += 8) ctx.fillRect(x, r.y + r.h - 2, 4, 2);
    ctx.fillStyle = '#b58b55'; for (let k = 0; k < 3; k++) ctx.fillRect(r.x + 6 + k * 10, r.y + 2, 7, 6);
  }

  function buildingLot(ctx, r) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([6, 5]); ctx.lineWidth = 1;
    ctx.strokeRect(r.x, r.y, r.w, r.h); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(160,140,100,0.25)'; ctx.fillRect(r.x, r.y, r.w, r.h);
  }

  AT.sprites = { fuelPump, bale, machine, thumb, house, hall, silo, tree, treeShadow, treeSprite, animal, barn, fence, trough, factory, buildingLot, pit, trader, greenhouse, sellPoint, dock, shade, mix, rr, circle };
})();
