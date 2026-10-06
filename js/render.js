// Agro Tycoon 2.0 — tekenen op het canvas
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const W = 1000, H = 560;
  const LANE = 16; // breedte van één werkgang van een machine (pixels)

  let canvas, ctx, grassPattern;
  const view = { selected: 1, hover: null };

  function init(el) {
    canvas = el;
    ctx = canvas.getContext('2d');
    grassPattern = makeGrassPattern();
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // muispositie -> logische canvascoördinaten
  function toLogical(evt) {
    const r = canvas.getBoundingClientRect();
    return { x: (evt.clientX - r.left) * (W / r.width), y: (evt.clientY - r.top) * (H / r.height) };
  }

  function fieldAt(x, y) {
    const f = D.fields.find(f => x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h);
    return f ? f.id : null;
  }

  // ---------- achtergrond ----------
  function makeGrassPattern() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#7cb95a';
    g.fillRect(0, 0, 64, 64);
    for (let i = 0; i < 140; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#6faa4e' : '#8bc566';
      g.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
    }
    return ctx.createPattern(c, 'repeat');
  }

  function drawBackground() {
    ctx.fillStyle = grassPattern;
    ctx.fillRect(0, 0, W, H);

    // zandwegen
    ctx.fillStyle = '#c9b08a';
    ctx.fillRect(224, 0, 18, H);
    ctx.fillRect(242, 182, 746, 16);
    ctx.fillRect(242, 352, 746, 16);
    ctx.fillRect(452, 0, 16, 352);
    ctx.fillRect(702, 0, 16, 352);
    ctx.fillRect(582, 368, 16, 192);
  }

  function drawYard(state) {
    // erf
    ctx.fillStyle = '#b9b3a4';
    roundRect(14, 14, 204, 532, 8);
    ctx.fill();

    // boerderij
    ctx.fillStyle = '#efe6d2';
    ctx.fillRect(28, 30, 80, 60);
    ctx.fillStyle = '#8e3b2e';
    ctx.beginPath();
    ctx.moveTo(22, 34); ctx.lineTo(68, 8); ctx.lineTo(114, 34); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#5b3a29';
    ctx.fillRect(60, 64, 14, 26);
    ctx.fillStyle = '#9fd3f0';
    ctx.fillRect(36, 44, 14, 12); ctx.fillRect(84, 44, 14, 12);

    // silo's (aantal = niveau + 1), vulling zichtbaar
    const used = AT.game.siloUsed(), cap = AT.game.siloCapacity();
    const fill = cap ? used / cap : 0;
    const count = state.siloLevel + 1;
    for (let i = 0; i < count; i++) {
      const cx = 140 + (i % 3) * 26, cy = 36 + Math.floor(i / 3) * 62;
      ctx.fillStyle = '#9aa4ad';
      ctx.fillRect(cx - 11, cy, 22, 50);
      ctx.fillStyle = '#e0b84c';
      const fh = 50 * fill;
      ctx.fillRect(cx - 11, cy + 50 - fh, 22, fh);
      ctx.strokeStyle = '#5f6a73'; ctx.lineWidth = 1.5;
      ctx.strokeRect(cx - 11, cy, 22, 50);
      ctx.fillStyle = '#7d8790';
      ctx.beginPath(); ctx.ellipse(cx, cy, 11, 5, 0, Math.PI, 0); ctx.fill();
    }
    label('Silo ' + Math.round(fill * 100) + '%', 166, count > 3 ? 162 : 100, 'center');

    // schuur
    ctx.fillStyle = '#a0522d';
    ctx.fillRect(26, 178, 180, 120);
    ctx.fillStyle = '#6e3a20';
    ctx.fillRect(26, 170, 180, 12);
    ctx.fillStyle = '#d7c7a8';
    ctx.fillRect(40, 200, 152, 90);
    label('Schuur', 116, 194, 'center');

    // vrije machines in de schuur, bezette in het veld
    const free = state.machines.filter(m => !m.busy);
    free.slice(0, 12).forEach((m, i) => {
      const x = 58 + (i % 4) * 38, y = 216 + Math.floor(i / 4) * 26;
      drawMachine(m.type, x, y, 0);
    });
    if (free.length > 12) label('+' + (free.length - 12), 180, 290, 'center');

    // marktwagen
    ctx.fillStyle = '#ece6d6';
    roundRect(28, 330, 176, 70, 6); ctx.fill();
    ctx.fillStyle = '#3d5a80';
    ctx.fillRect(48, 352, 70, 28);
    ctx.fillStyle = '#98c1d9';
    ctx.fillRect(118, 358, 22, 22);
    ctx.fillStyle = '#222';
    [58, 100, 130].forEach(x => { ctx.beginPath(); ctx.arc(x, 382, 5, 0, Math.PI * 2); ctx.fill(); });
    label('Graanhandel', 116, 344, 'center');
  }

  // ---------- velden ----------
  function drawFieldSurface(def, fs, rand) {
    const { x, y, w, h } = def;
    if (!fs.owned) {
      ctx.fillStyle = 'rgba(60,110,40,0.35)';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = 'rgba(40,80,30,0.35)';
      ctx.lineWidth = 1;
      for (let i = -h; i < w; i += 14) {
        ctx.beginPath(); ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + h, y); ctx.stroke();
      }
      return;
    }

    if (fs.state === 'stubble') {
      ctx.fillStyle = '#c8ad6a';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#a88d4a';
      for (let lx = x + 4; lx < x + w; lx += 8) {
        for (let ly = y + 3; ly < y + h; ly += 6) ctx.fillRect(lx, ly, 1, 3);
      }
      return;
    }

    // geploegde grond als basis voor plowed/growing/ready
    ctx.fillStyle = '#7a5232';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#5e3d24';
    for (let lx = x + 3; lx < x + w; lx += 6) ctx.fillRect(lx, y, 2, h);
    if (fs.state === 'plowed') return;

    const crop = D.crops[fs.crop];
    const g = fs.state === 'ready' ? 1 : fs.growth;
    const r = 1 + g * 3.2;
    ctx.fillStyle = g > 0.75 ? mix(crop.growColor, crop.color, (g - 0.75) / 0.25) : crop.growColor;
    for (let lx = x + LANE / 2; lx < x + w; lx += LANE / 2) {
      for (let ly = y + 5; ly < y + h - 2; ly += 7) {
        const jitter = (rand(lx * 31 + ly) - 0.5) * 2;
        ctx.beginPath();
        ctx.arc(lx + jitter, ly, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (fs.state === 'ready' && fs.crop === 'corn') {
      ctx.fillStyle = '#4f9a3a';
      for (let lx = x + LANE / 2; lx < x + w; lx += LANE) {
        for (let ly = y + 8; ly < y + h; ly += 14) ctx.fillRect(lx - 1, ly - 3, 2, 6);
      }
    }
  }

  // positie van de machine op het veld bij een bepaalde voortgang (slangpatroon)
  function lanePosition(def, progress) {
    const lanes = Math.ceil(def.w / LANE);
    const done = Math.min(progress, 0.9999) * lanes;
    const i = Math.floor(done);
    const frac = done - i;
    const down = i % 2 === 0;
    const x = def.x + i * LANE + LANE / 2;
    const y = down ? def.y + frac * def.h : def.y + def.h - frac * def.h;
    return { i, frac, down, x: Math.min(x, def.x + def.w - 4), y };
  }

  function jobResult(fs) {
    const job = fs.job;
    if (job.type === 'plow') return { owned: true, state: 'plowed' };
    if (job.type === 'sow') return { owned: true, state: 'growing', crop: job.crop, growth: 0.02 };
    return { owned: true, state: 'stubble' };
  }

  function drawField(def, fs, state) {
    const rand = seeded(def.id);
    ctx.save();
    ctx.beginPath(); ctx.rect(def.x, def.y, def.w, def.h); ctx.clip();
    drawFieldSurface(def, fs, rand);

    if (fs.job) {
      const p = lanePosition(def, fs.job.progress);
      // bewerkt gedeelte tekenen in de nieuwe toestand
      ctx.save();
      ctx.beginPath();
      ctx.rect(def.x, def.y, p.i * LANE, def.h);
      if (p.down) ctx.rect(def.x + p.i * LANE, def.y, LANE, p.frac * def.h);
      else ctx.rect(def.x + p.i * LANE, def.y + def.h - p.frac * def.h, LANE, p.frac * def.h);
      ctx.clip();
      drawFieldSurface(def, jobResult(fs), seeded(def.id));
      ctx.restore();

      // stof achter de machine
      ctx.fillStyle = 'rgba(120,90,50,0.25)';
      for (let k = 1; k <= 4; k++) {
        ctx.beginPath();
        ctx.arc(p.x + (Math.random() - 0.5) * 6, p.y + (p.down ? -1 : 1) * (14 + k * 5), 3 + k, 0, Math.PI * 2);
        ctx.fill();
      }
      const machines = state.machines.filter(m => fs.job.machines.includes(m.uid));
      const main = machines.find(m => D.machines[m.type].kind !== 'plow' && D.machines[m.type].kind !== 'seeder');
      const impl = machines.find(m => m !== main);
      drawMachine(main.type, p.x, p.y, p.down ? Math.PI / 2 : -Math.PI / 2, impl && impl.type);
    }
    ctx.restore();

    // rand
    const selected = view.selected === def.id;
    const hover = view.hover === def.id;
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.strokeStyle = selected ? '#ffffff' : hover ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.25)';
    ctx.strokeRect(def.x + 0.5, def.y + 0.5, def.w - 1, def.h - 1);

    // label
    const title = `Veld ${def.id} · ${def.ha} ha`;
    pill(title, def.x + 6, def.y + 6);
    if (!fs.owned) {
      pill('Te koop ' + AT.fmtMoney(AT.game.fieldPrice(def.id)), def.x + def.w / 2, def.y + def.h / 2 - 10, true, '#2d6a2d');
    } else if (fs.state === 'ready' && !fs.job) {
      pill('Klaar om te oogsten', def.x + def.w / 2, def.y + def.h / 2 - 10, true, '#b7791f');
    }

    // voortgangsbalk
    let progress = null, color = '#fff';
    if (fs.job) { progress = fs.job.progress; color = '#4fc3f7'; }
    else if (fs.state === 'growing') { progress = fs.growth; color = '#9be15d'; }
    if (progress !== null) {
      const bx = def.x + 8, by = def.y + def.h - 12, bw = def.w - 16;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      roundRect(bx, by, bw, 6, 3); ctx.fill();
      ctx.fillStyle = color;
      roundRect(bx, by, Math.max(6, bw * Math.min(progress, 1)), 6, 3); ctx.fill();
    }
  }

  // ---------- machines ----------
  function drawMachine(type, x, y, angle, implType) {
    const d = D.machines[type];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    if (d.kind === 'harvester') {
      ctx.fillStyle = '#333';
      ctx.fillRect(-8, -10, 6, 4); ctx.fillRect(-8, 6, 6, 4);
      ctx.fillStyle = d.color;
      ctx.fillRect(-12, -8, 22, 16);
      ctx.fillStyle = '#9fd3f0';
      ctx.fillRect(2, -4, 6, 8);
      ctx.fillStyle = '#555';
      ctx.fillRect(11, -11, 4, 22); // maaibord
    } else if (d.kind === 'tractor') {
      if (implType) {
        const idf = D.machines[implType];
        ctx.fillStyle = idf.color;
        ctx.fillRect(-17, -8, 5, 16);
        ctx.fillStyle = '#444';
        ctx.fillRect(-12, -1, 4, 2);
      }
      ctx.fillStyle = '#222';
      ctx.fillRect(-8, -8, 7, 4); ctx.fillRect(-8, 4, 7, 4);
      ctx.fillRect(3, -6, 4, 3); ctx.fillRect(3, 3, 4, 3);
      ctx.fillStyle = d.color;
      ctx.fillRect(-8, -4, 17, 8);
      ctx.fillStyle = '#cfe8f5';
      ctx.fillRect(-6, -3, 6, 6);
    } else {
      // los werktuig in de schuur
      ctx.fillStyle = d.color;
      ctx.fillRect(-4, -8, 8, 16);
      ctx.fillStyle = '#444';
      ctx.fillRect(4, -1, 5, 2);
    }
    ctx.restore();
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

  function label(text, x, y, align = 'left') {
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#2b2b2b';
    ctx.fillText(text, x, y);
  }

  function pill(text, x, y, centered = false, bg = 'rgba(0,0,0,0.55)') {
    ctx.font = '600 11px system-ui, sans-serif';
    const tw = ctx.measureText(text).width;
    const px = centered ? x - tw / 2 - 6 : x;
    ctx.fillStyle = bg;
    roundRect(px, y, tw + 12, 18, 9); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, px + 6, y + 9.5);
  }

  function mix(a, b, t) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const ch = s => [(s >> 16) & 255, (s >> 8) & 255, s & 255];
    const [ar, ag, ab] = ch(pa), [br, bg, bb] = ch(pb);
    const c = (p, q) => Math.round(p + (q - p) * t);
    return `rgb(${c(ar, br)},${c(ag, bg)},${c(ab, bb)})`;
  }

  // deterministische "random" zodat planten niet flikkeren
  function seeded(seed) {
    return n => {
      const v = Math.sin(seed * 9301 + n * 49297) * 233280;
      return v - Math.floor(v);
    };
  }

  // ---------- hoofd-tekenfunctie ----------
  function draw(state) {
    drawBackground();
    drawYard(state);
    for (const def of D.fields) {
      const fs = state.fields.find(f => f.id === def.id);
      drawField(def, fs, state);
    }
    // nacht-filter
    const h = AT.game.hour();
    let dark = 0;
    if (h < 6) dark = 0.45 - h * 0.05;
    else if (h > 19) dark = Math.min(0.45, (h - 19) * 0.09);
    if (dark > 0) {
      ctx.fillStyle = `rgba(10,20,60,${dark})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  AT.render = { init, draw, toLogical, fieldAt, view };
})();
