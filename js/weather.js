// Agro Tycoon 2.0 — seizoenen en weer
// Het weer bestaat uit blokken van een paar uur. Er staan altijd ruim 3 dagen
// aan blokken klaar, zodat we een weersvoorspelling kunnen tonen.
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const S = () => AT.state;
  const SEASON_HOURS = D.daysPerSeason * 24;

  const seasonAt = time => Math.floor(time / SEASON_HOURS) % 4;
  const season = () => seasonAt(S().time);
  const year = () => Math.floor(S().time / (SEASON_HOURS * 4)) + 1;
  const dayInSeason = () => Math.floor((S().time % SEASON_HOURS) / 24) + 1;
  // 0..1: hoe ver we in het huidige seizoen zijn
  const seasonProgress = () => (S().time % SEASON_HOURS) / SEASON_HOURS;
  // maanden: 0 = maart … 11 = februari
  const MONTH_HOURS = D.daysPerMonth * 24;
  const monthAt = time => Math.floor(time / MONTH_HOURS) % 12;
  const month = () => monthAt(S().time);
  const monthName = (m = month()) => D.months[m];
  const dayInMonth = () => Math.floor((S().time % MONTH_HOURS) / 24) + 1;

  function pick(probs) {
    const keys = Object.keys(probs);
    let r = Math.random() * keys.reduce((a, k) => a + probs[k], 0);
    for (const k of keys) { r -= probs[k]; if (r <= 0) return k; }
    return keys[0];
  }

  function nextBlock(startTime, prevType) {
    const probs = Object.assign({}, D.seasons[seasonAt(startTime)].weather);
    // weer blijft graag even hetzelfde, onweer niet
    if (prevType && probs[prevType] && prevType !== 'storm') probs[prevType] *= 1.8;
    const type = pick(probs);
    const hours = type === 'storm' ? 3 + Math.random() * 3 : 6 + Math.random() * 10;
    return { type, hours };
  }

  function init() {
    const s = S();
    if (s.weather) return;
    s.weather = { type: 'sun', left: 10, moisture: 0.6, queue: [] };
    fillQueue();
  }

  function fillQueue() {
    const w = S().weather;
    let t = S().time + w.left, prev = w.type;
    for (const b of w.queue) { t += b.hours; prev = b.type; }
    while (t < S().time + 24 * 4) {
      const b = nextBlock(t, prev);
      w.queue.push(b);
      t += b.hours; prev = b.type;
    }
  }

  function update(dtHours) {
    const s = S();
    if (!s.weather) init();
    const w = s.weather;
    w.left -= dtHours;
    while (w.left <= 0) {
      const b = w.queue.shift() || nextBlock(s.time, w.type);
      w.type = b.type;
      w.left += b.hours;
      onNewWeather(w.type);
      fillQueue();
    }
    // bodemvocht
    const wt = D.weatherTypes[w.type];
    const sunDry = w.type === 'sun' && season() === 1 ? 1.4 : 1;
    w.moisture = Math.max(0, Math.min(1, w.moisture + wt.moisture * sunDry * dtHours));

    // groeiklok per gewas
    for (const key of Object.keys(D.crops)) s.growClock[key] += dtHours * growRate(key);
  }

  function onNewWeather(type) {
    const wt = D.weatherTypes[type];
    if (type === 'snow') {
      // vorst: gewassen die niet winterhard zijn lopen schade op
      for (const f of S().fields) {
        if (!f.owned) continue;
        const sum = AT.game.summary(f);
        const tender = Object.keys(sum.crops).filter(k => !D.crops[k].winterHardy && D.crops[k].harvester);
        if (!tender.length) continue;
        const hit = 0.1 + Math.random() * 0.15;
        f.damage = Math.min(0.6, f.damage + hit);
        AT.game.log(`❄️ Vorstschade op Veld ${f.id} (${tender.map(k => D.crops[k].name.toLowerCase()).join(', ')}): −${Math.round(hit * 100)}%. Alleen tarwe en koolzaad zijn winterhard.`, 'warn');
      }
    }
    if (type === 'storm') {
      AT.game.log('⛈️ Onweer! Rijpe en groeiende gewassen kunnen schade oplopen.', 'warn');
      for (const f of S().fields) {
        if (!f.owned) continue;
        const sum = AT.game.summary(f);
        if (sum.ready + sum.growing < sum.total * 0.2) continue;
        const hit = 0.04 + Math.random() * 0.12;
        f.damage = Math.min(0.5, f.damage + hit);
        AT.game.log(`Stormschade op Veld ${f.id}: ${Math.round(hit * 100)}% minder opbrengst.`, 'warn');
      }
    } else if (wt.wet) {
      AT.game.log(`${wt.icon} ${wt.name}: gewassen groeien goed, maar oogsten kan pas als het droog is.`);
    }
    AT.emit('weather');
  }

  // groeisnelheid van een gewas nu (seizoen × weer × droogte)
  function growRate(cropKey) {
    const se = season(), w = S().weather;
    let r = se === 3 ? D.crops[cropKey].winterGrowth : D.seasons[se].growth;
    r *= D.weatherTypes[w ? w.type : 'sun'].growth;
    if (drought() && !D.crops[cropKey].droughtProof) r *= 0.5;
    return r;
  }

  function drought() { const w = S().weather; return !!w && w.moisture < D.droughtBelow; }
  function isWet() { const w = S().weather; return !!w && D.weatherTypes[w.type].wet; }

  function temperature() {
    const w = S().weather, h = S().time % 24;
    const base = D.seasons[season()].temp + D.weatherTypes[w ? w.type : 'sun'].temp;
    return Math.round(base + Math.sin((h - 9) / 24 * Math.PI * 2) * 4);
  }

  // prijs-vermenigvuldiger per maand: laagst in de oogstmaand, hoogst een half jaar later (vloeiende golf)
  function monthFactor(key, m) {
    const c = D.crops[key] || D.products[key];
    if (!c || c.cheapMonth == null) return 1;
    return 1 - D.seasonPrice * Math.cos((m - c.cheapMonth) / 12 * Math.PI * 2);
  }
  function priceFactor(key) {
    // tussen twee maanden vloeiend overgaan
    const MONTH_HOURS = D.daysPerMonth * 24;
    const t = (S().time / MONTH_HOURS) % 12;
    const m0 = Math.floor(t), f = t - m0;
    return monthFactor(key, m0) * (1 - f) + monthFactor(key, (m0 + 1) % 12) * f;
  }

  // voorspelling voor de komende dagen: het meest voorkomende weer per dag
  function forecast(days = 3) {
    const w = S().weather;
    if (!w) return [];
    const blocks = [{ type: w.type, from: S().time, to: S().time + w.left }];
    let t = S().time + w.left;
    for (const b of w.queue) { blocks.push({ type: b.type, from: t, to: t + b.hours }); t += b.hours; }
    const today = Math.floor(S().time / 24);
    const out = [];
    for (let d = 1; d <= days; d++) {
      const start = (today + d) * 24, end = start + 24, hours = {};
      for (const b of blocks) {
        const ov = Math.min(end, b.to) - Math.max(start, b.from);
        if (ov > 0) hours[b.type] = (hours[b.type] || 0) + ov;
      }
      // onweer of neerslag telt zwaarder mee: dat wil je weten
      const score = k => hours[k] * (k === 'storm' ? 4 : D.weatherTypes[k].wet ? 1.6 : 1);
      const type = Object.keys(hours).sort((a, b) => score(b) - score(a))[0] || 'sun';
      out.push({ day: today + d + 1, type, season: seasonAt(start) });
    }
    return out;
  }

  AT.weather = { init, update, season, seasonAt, year, dayInSeason, seasonProgress, month, monthAt, monthName, dayInMonth, growRate, drought, isWet, temperature, forecast, priceFactor, monthFactor };
})();
