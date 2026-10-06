// Agro Tycoon 2.0 — geluid
// Alles wordt live opgewekt met de Web Audio API (geen geluidsbestanden):
// - motorgeluid van de machine waar je in rijdt (toerental volgt de snelheid), werktuig- en losgeluid
// - omgeving: wind, regen, onweer, vogels overdag, krekels 's nachts, dieren in de buurt
// - geluidseffecten: kassa, koppelen, waarschuwing, doel behaald, boom kappen
// - rustige achtergrondmuziek die steeds anders klinkt
// Browsers starten geluid pas na een klik of toets, daarom begint alles bij de eerste invoer.
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const KEY = 'agro-tycoon-2-audio';
  const settings = { volume: 0.7, sfx: true, ambient: true, music: true, muted: false };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* standaard */ }
  function saveSettings() { try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* ok */ } }

  let ctx = null, master, buses = {}, noise = null;
  const now = () => ctx.currentTime;

  function start() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4;
    master = ctx.createGain();
    master.connect(comp); comp.connect(ctx.destination);
    for (const b of ['sfx', 'ambient', 'music', 'engine']) { buses[b] = ctx.createGain(); buses[b].connect(master); }
    // witte ruis (2 s) als bron voor wind, regen, motor en lossen
    noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    applySettings();
    buildEngine();
    buildAmbient();
  }
  ['keydown', 'pointerdown'].forEach(evt => window.addEventListener(evt, start, { capture: true }));

  function applySettings() {
    if (!ctx) return;
    const t = now();
    master.gain.setTargetAtTime(settings.muted ? 0 : settings.volume, t, 0.05);
    buses.sfx.gain.setTargetAtTime(settings.sfx ? 1 : 0, t, 0.05);
    buses.engine.gain.setTargetAtTime(settings.sfx ? 1 : 0, t, 0.05);
    buses.ambient.gain.setTargetAtTime(settings.ambient ? 1 : 0, t, 0.05);
    buses.music.gain.setTargetAtTime(settings.music ? 0.55 : 0, t, 0.3);
  }
  function set(patch) { Object.assign(settings, patch); saveSettings(); applySettings(); AT.emit('audio'); }
  function toggleMute() { set({ muted: !settings.muted }); }

  // ---------- bouwstenen ----------
  function noiseSrc() { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; s.loopStart = Math.random(); return s; }
  function filter(type, freq, q = 1) { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; }
  function gain(v = 0) { const g = ctx.createGain(); g.gain.value = v; return g; }
  function chain(...nodes) { for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]); return nodes[nodes.length - 1]; }
  const smooth = (param, v, tc = 0.08) => param.setTargetAtTime(v, now(), tc);

  // korte toon met omhullende
  function tone(freq, dur, { type = 'sine', vol = 0.2, bus = 'sfx', attack = 0.005, slideTo = null, when = 0 } = {}) {
    const t = now() + when;
    const o = ctx.createOscillator(), g = gain(0);
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    chain(o, g, buses[bus]);
    o.start(t); o.stop(t + dur + 0.05);
  }
  // korte ruisstoot (klap, stap, bons)
  function burst(dur, { freq = 1200, q = 1, type = 'bandpass', vol = 0.3, bus = 'sfx', when = 0 } = {}) {
    const t = now() + when;
    const s = noiseSrc(), f = filter(type, freq, q), g = gain(0);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    chain(s, f, g, buses[bus]);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  // ---------- motor (machine waar je in rijdt) ----------
  let engine = null;
  function buildEngine() {
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
    o1.type = 'sawtooth'; o2.type = 'square';
    const lp = filter('lowpass', 300, 3), g = gain(0);
    // "gedreun": volume pulseert op het ritme van de cilinders
    const am = gain(0.6), lfo = ctx.createOscillator(), lfoAmt = gain(0.4);
    lfo.type = 'sine'; lfo.frequency.value = 12;
    chain(lfo, lfoAmt); lfoAmt.connect(am.gain);
    o1.connect(lp); o2.connect(lp);
    chain(lp, am, g, buses.engine);
    // werkgeluid: ruis door een filter (ploeg = laag gerommel, maaidorser = hoog geruis)
    const ws = noiseSrc(), wf = filter('bandpass', 400, 0.8), wg = gain(0);
    chain(ws, wf, wg, buses.engine);
    // lossen: graan dat stroomt
    const us = noiseSrc(), uf = filter('bandpass', 2200, 0.6), ug = gain(0);
    chain(us, uf, ug, buses.engine);
    [o1, o2, lfo, ws, us].forEach(n => n.start());
    engine = { o1, o2, lp, g, lfo, wf, wg, uf, ug, on: false };
  }

  const ENGINE = {
    tractor: { idle: 30, top: 62, vol: 0.16 },
    harvester: { idle: 26, top: 50, vol: 0.2 },
    truck: { idle: 34, top: 78, vol: 0.15 },
  };
  let startUid = null;
  function updateEngine() {
    const p = AT.state.player;
    const r = p.mode === 'drive' && AT.vehicle ? AT.vehicle.rig() : null;
    if (!r) {
      if (engine.on) { smooth(engine.g.gain, 0, 0.15); smooth(engine.wg.gain, 0); smooth(engine.ug.gain, 0); engine.on = false; startUid = null; }
      return;
    }
    const spec = ENGINE[r.mainDef.kind] || ENGINE.tractor;
    if (startUid !== r.main.uid) { startUid = r.main.uid; starter(); }
    const top = (r.mainDef.speed || 30) * D.kmhToPx;
    const sp = Math.min(1, Math.abs(p.speed) / top);
    const load = Math.max(sp, p.throttle ? 0.55 : 0) + (p.lowered ? 0.15 : 0);
    const f = spec.idle + (spec.top - spec.idle) * Math.min(1, sp * 0.8 + (p.throttle ? 0.2 : 0));
    smooth(engine.o1.frequency, f, 0.15);
    smooth(engine.o2.frequency, f * 0.5, 0.15);
    smooth(engine.lfo.frequency, f / 2.5, 0.15);
    smooth(engine.lp.frequency, 220 + 900 * load, 0.12);
    smooth(engine.g.gain, spec.vol * (0.55 + 0.6 * load), 0.1);
    engine.on = true;
    // werktuig in de grond
    const working = p.lowered && r.toolDef && r.toolDef.kind !== 'trailer' && Math.abs(p.speed) > 3;
    const wfreq = { harvester: 1400, plow: 260, mower: 1800, baler: 600, seeder: 900, sprayer: 3000 }[r.toolDef ? r.toolDef.kind : ''] || 700;
    smooth(engine.wf.frequency, wfreq, 0.1);
    smooth(engine.wg.gain, working ? 0.09 : 0, 0.15);
    smooth(engine.ug.gain, p.unloading && p.unloadTarget && p.unloadTarget !== 'refuse' ? 0.08 : 0, 0.1);
  }
  function starter() {
    burst(0.5, { freq: 300, q: 2, vol: 0.12, bus: 'engine' });
    tone(40, 0.6, { type: 'sawtooth', vol: 0.08, slideTo: 70, bus: 'engine' });
  }

  // ---------- omgeving ----------
  let amb = null;
  function buildAmbient() {
    const wind = noiseSrc(), wf = filter('lowpass', 380, 0.7), wg = gain(0);
    chain(wind, wf, wg, buses.ambient);
    const rain = noiseSrc(), rf = filter('highpass', 1800, 0.5), rf2 = filter('lowpass', 7000, 0.5), rg = gain(0);
    chain(rain, rf, rf2, rg, buses.ambient);
    wind.start(); rain.start();
    amb = { wf, wg, rg, birdT: 2, cricketT: 1, animalT: 4, thunderT: 6, windPhase: 0 };
  }

  function bird() {
    const base = 2600 + Math.random() * 2200, n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const f = base * (0.85 + Math.random() * 0.35);
      tone(f, 0.09 + Math.random() * 0.06, { vol: 0.035, bus: 'ambient', slideTo: f * (Math.random() < 0.5 ? 1.25 : 0.8), when: i * (0.11 + Math.random() * 0.06) });
    }
  }
  function crickets() {
    for (let i = 0; i < 3; i++) tone(4400 + Math.random() * 200, 0.04, { vol: 0.02, bus: 'ambient', when: i * 0.07 });
  }
  function thunder() {
    const delay = 0.3 + Math.random() * 1.5;
    burst(2.5, { freq: 90, q: 0.6, type: 'lowpass', vol: 0.45, bus: 'ambient', when: delay });
    burst(1.2, { freq: 200, q: 0.8, type: 'lowpass', vol: 0.25, bus: 'ambient', when: delay + 0.15 });
  }
  // dierengeluiden: zachter naarmate de camera verder weg is
  function animalSound(key, vol) {
    if (key === 'cows') { tone(150, 1.1, { type: 'sawtooth', vol: 0.06 * vol, slideTo: 110, attack: 0.15, bus: 'ambient' }); }
    else if (key === 'sheep') { for (let i = 0; i < 4; i++) tone(420 + (i % 2) * 30, 0.12, { type: 'sawtooth', vol: 0.03 * vol, attack: 0.02, bus: 'ambient', when: i * 0.1 }); }
    else if (key === 'chickens') { for (let i = 0; i < 3; i++) tone(900 + Math.random() * 300, 0.07, { type: 'square', vol: 0.02 * vol, slideTo: 600, bus: 'ambient', when: i * 0.13 }); }
    else if (key === 'pigs') { burst(0.25, { freq: 380, q: 6, vol: 0.12 * vol, bus: 'ambient' }); burst(0.18, { freq: 300, q: 6, vol: 0.1 * vol, bus: 'ambient', when: 0.3 }); }
  }

  function updateAmbient(dt) {
    const s = AT.state, W = AT.weather;
    const type = s.weather ? s.weather.type : 'sun';
    const h = s.time % 24, night = h < 5.5 || h > 21, se = W.season();
    amb.windPhase += dt * 0.15;
    const gust = 0.5 + 0.5 * Math.sin(amb.windPhase) * Math.sin(amb.windPhase * 0.37 + 1);
    const windBase = type === 'storm' ? 0.22 : type === 'rain' ? 0.08 : se === 3 ? 0.07 : 0.04;
    smooth(amb.wg.gain, windBase * (0.6 + 0.8 * gust), 0.5);
    smooth(amb.wf.frequency, 250 + 500 * gust + (type === 'storm' ? 300 : 0), 0.5);
    smooth(amb.rg.gain, type === 'storm' ? 0.12 : type === 'rain' ? 0.07 : 0, 1);
    if (s.paused) return;
    // vogels overdag (niet in de winter of bij regen), krekels op zomeravonden
    amb.birdT -= dt;
    if (amb.birdT <= 0) {
      amb.birdT = 1.5 + Math.random() * 5;
      if (!night && se !== 3 && type !== 'rain' && type !== 'storm' && type !== 'snow') bird();
    }
    amb.cricketT -= dt;
    if (amb.cricketT <= 0) {
      amb.cricketT = 0.5 + Math.random() * 0.8;
      if ((h > 20 || h < 5) && (se === 1 || se === 0) && type !== 'rain' && type !== 'storm') crickets();
    }
    // dieren in de buurt van de camera
    amb.animalT -= dt;
    if (amb.animalT <= 0) {
      amb.animalT = 2 + Math.random() * 5;
      const cam = AT.render ? AT.render.cam : null;
      const keys = Object.keys(D.animals).filter(k => s.animals[k] && s.animals[k].count > 0);
      if (cam && keys.length) {
        const key = keys[Math.floor(Math.random() * keys.length)], pen = D.animals[key].pen;
        const d = Math.hypot(pen.x + pen.w / 2 - cam.x, pen.y + pen.h / 2 - cam.y);
        const vol = Math.max(0, 1 - d / 900);
        if (vol > 0.05 && !(night && key === 'chickens')) animalSound(key, vol);
      }
    }
  }

  // ---------- muziek: rustige akkoorden met een melodie die steeds anders is ----------
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
  const PROG = [[48, 55, 64, 67], [45, 52, 60, 64], [41, 48, 57, 60], [43, 50, 59, 62]];   // C, Am, F, G
  const PENTA = [72, 74, 76, 79, 81, 84, 86];
  let musicNext = 0, bar = 0, lastNote = 3;
  function pad(notes, t, dur) {
    for (const n of notes) {
      const o = ctx.createOscillator(), g = gain(0), f = filter('lowpass', 900, 0.5);
      o.type = 'triangle'; o.frequency.value = NOTE(n);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.035, t + 1.2);
      g.gain.setValueAtTime(0.035, t + dur - 1.2);
      g.gain.linearRampToValueAtTime(0, t + dur);
      chain(o, f, g, buses.music);
      o.start(t); o.stop(t + dur + 0.1);
    }
  }
  function pluck(n, t, vol = 0.05) {
    const o = ctx.createOscillator(), g = gain(0);
    o.type = 'sine'; o.frequency.value = NOTE(n);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    chain(o, g, buses.music);
    o.start(t); o.stop(t + 1.5);
  }
  function scheduleMusic() {
    if (!settings.music || settings.muted) { musicNext = 0; return; }
    const beat = 60 / 66, barDur = beat * 4;
    if (musicNext < now()) musicNext = now() + 0.2;
    while (musicNext < now() + 1.5) {
      const chord = PROG[bar % PROG.length];
      pad(chord, musicNext, barDur + 0.6);
      // bas op de eerste tel
      pluck(chord[0] - 12, musicNext, 0.06);
      // melodie: een paar noten per maat, stapjes op de pentatonische toonladder
      for (let b = 0; b < 8; b++) {
        if (Math.random() < (b % 2 ? 0.18 : 0.42)) {
          lastNote = Math.max(0, Math.min(PENTA.length - 1, lastNote + Math.floor(Math.random() * 5) - 2));
          pluck(PENTA[lastNote], musicNext + b * beat / 2, 0.035);
        }
      }
      musicNext += barDur; bar++;
    }
  }

  // ---------- geluidseffecten ----------
  const lastPlayed = {};
  function play(name) {
    if (!ctx || !settings.sfx || settings.muted) return;
    const t = performance.now();
    if (lastPlayed[name] && t - lastPlayed[name] < (name === 'cash' ? 1500 : 120)) return;   // niet stapelen
    lastPlayed[name] = t;
    switch (name) {
      case 'cash':
        burst(0.08, { freq: 3000, q: 2, vol: 0.15 });
        tone(1318, 0.25, { vol: 0.1, when: 0.04 }); tone(1760, 0.45, { vol: 0.1, when: 0.12 });
        break;
      case 'spend': tone(520, 0.12, { vol: 0.05, type: 'triangle' }); break;
      case 'click': tone(900, 0.04, { vol: 0.04, type: 'triangle' }); break;
      case 'warn': tone(440, 0.12, { vol: 0.08, type: 'square' }); tone(330, 0.18, { vol: 0.08, type: 'square', when: 0.14 }); break;
      case 'goal': [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, { vol: 0.09, type: 'triangle', when: i * 0.09 })); break;
      case 'hitch': burst(0.12, { freq: 500, q: 3, vol: 0.35 }); tone(120, 0.15, { vol: 0.15, type: 'square' }); burst(0.08, { freq: 2500, q: 4, vol: 0.15, when: 0.08 }); break;
      case 'door': burst(0.1, { freq: 700, q: 2, vol: 0.25 }); break;
      case 'chop':
        burst(0.12, { freq: 900, q: 1.5, vol: 0.4 }); burst(0.12, { freq: 800, q: 1.5, vol: 0.35, when: 0.25 });
        tone(180, 1.2, { type: 'sawtooth', vol: 0.05, slideTo: 60, attack: 0.3, when: 0.5 });
        burst(0.6, { freq: 160, type: 'lowpass', vol: 0.5, when: 1.5 });
        break;
      case 'step': burst(0.05, { freq: 1600 + Math.random() * 800, q: 0.8, vol: 0.05 }); break;
      case 'bale': burst(0.2, { freq: 250, type: 'lowpass', vol: 0.4 }); break;
      case 'spray': burst(0.4, { freq: 4000, q: 0.5, vol: 0.08 }); break;
      case 'pick': tone(700, 0.06, { vol: 0.05 }); burst(0.06, { freq: 2000, vol: 0.06 }); break;
    }
  }
  AT.on('sfx', play);
  AT.on('thunder', () => { if (ctx && settings.ambient && !settings.muted) thunder(); });

  // ---------- elke frame ----------
  let stepDist = 0;
  function update(dt) {
    if (!ctx || ctx.state !== 'running') return;
    updateEngine();
    updateAmbient(dt);
    scheduleMusic();
    // voetstappen
    const p = AT.state.player;
    if (p.mode === 'foot' && p.speed > 0) {
      stepDist += p.speed * dt;
      if (stepDist > 13) { stepDist = 0; play('step'); }
    }
  }

  // ---------- toetsen en knoppen ----------
  document.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input, select, textarea')) return;
    if (e.code === 'KeyM' && !e.repeat) toggleMute();
  });
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('button')) play('click'); }, true);

  AT.audio = { update, play, set, settings, toggleMute, start, status: () => (ctx ? ctx.state : 'off') };
})();
