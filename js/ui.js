// Agro Tycoon 2.0 — HTML-interface (zijpaneel, topbalk, logboek)
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const G = () => AT.game;
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let activeTab = 'field';

  const STATE_NAMES = {
    stubble: 'Stoppel — moet geploegd worden',
    plowed: 'Geploegd — klaar om te zaaien',
    growing: 'Groeit',
    ready: 'Rijp — klaar om te oogsten',
  };
  const JOB_NAMES = { plow: 'Ploegen', sow: 'Zaaien', harvest: 'Oogsten' };
  const KIND_NAMES = { tractor: 'Tractor', plow: 'Ploeg', seeder: 'Zaaimachine', harvester: 'Maaidorser' };

  // ---------- tabs ----------
  function renderField(s) {
    const id = AT.render.view.selected;
    const def = G().fieldDef(id);
    const f = s.fields.find(x => x.id === id);
    let html = `<h2>Veld ${id} <span class="muted">· ${def.ha} ha</span></h2>`;

    if (!f.owned) {
      const price = G().fieldPrice(id);
      html += `<p>Dit veld is te koop.</p>
        <button class="btn primary" data-action="buyField" data-id="${id}" ${s.money < price ? 'disabled' : ''}>
          Koop veld voor ${AT.fmtMoney(price)}</button>`;
    } else if (f.job) {
      const machines = s.machines.filter(m => f.job.machines.includes(m.uid)).map(m => D.machines[m.type].name).join(' + ');
      html += `<p class="status">${JOB_NAMES[f.job.type]}${f.job.type === 'sow' ? ' (' + D.crops[f.job.crop].name + ')' : ''}…</p>
        <div class="bar"><div class="fill job" data-live="jobbar"></div></div>
        <p class="muted"><span data-live="jobpct"></span> · ${esc(machines)}</p>`;
    } else {
      html += `<p class="status">${STATE_NAMES[f.state]}${f.crop ? ': ' + D.crops[f.crop].name : ''}</p>`;
      if (f.state === 'stubble') html += taskButton(s, f, 'plow', 'Ploegen');
      if (f.state === 'plowed') html += cropChoice(s, f, def);
      if (f.state === 'growing') {
        html += `<div class="bar"><div class="fill grow" data-live="growbar"></div></div>
          <p class="muted" data-live="growtxt"></p>`;
      }
      if (f.state === 'ready') {
        const tons = G().expectedYield(f);
        html += `<p>Verwachte opbrengst: <b>±${AT.fmtTons(tons)}</b> (≈ ${AT.fmtMoney(tons * G().cropPrice(f.crop))})</p>`;
        html += taskButton(s, f, 'harvest', 'Oogsten');
      }
    }

    // overzicht alle velden
    html += `<h3>Alle velden</h3><div class="field-list">`;
    for (const fd of D.fields) {
      const ff = s.fields.find(x => x.id === fd.id);
      let st = !ff.owned ? 'Te koop' : ff.job ? JOB_NAMES[ff.job.type] + '…' : ff.state === 'growing' ? D.crops[ff.crop].name + ' groeit' :
        ff.state === 'ready' ? 'Rijp!' : ff.state === 'plowed' ? 'Geploegd' : 'Stoppel';
      html += `<button class="field-row ${fd.id === id ? 'active' : ''} ${ff.state === 'ready' && !ff.job ? 'ready' : ''} ${!ff.owned ? 'forsale' : ''}"
        data-action="select" data-id="${fd.id}"><span>Veld ${fd.id} <span class="muted">${fd.ha} ha</span></span><span>${st}</span></button>`;
    }
    return html + `</div>`;
  }

  function taskButton(s, f, task, label) {
    const rig = G().bestRig(task, f.id);
    if (!rig) return `<p class="warn">${esc(G().missingFor(task))}</p>`;
    const names = rig.machines.map(m => D.machines[m.type].name).join(' + ');
    return `<div class="card">
      <div><b>${esc(names)}</b></div>
      <div class="muted">Duur ${rig.hours.toFixed(1).replace('.', ',')} u · diesel ${AT.fmtMoney(rig.cost)}</div>
      <button class="btn primary" data-action="job" data-task="${task}" data-id="${f.id}" ${s.money < rig.cost ? 'disabled' : ''}>${label}</button>
    </div>`;
  }

  function cropChoice(s, f, def) {
    const rig = G().bestRig('sow', f.id);
    if (!rig) return `<p class="warn">${esc(G().missingFor('sow'))}</p>`;
    const names = rig.machines.map(m => D.machines[m.type].name).join(' + ');
    let html = `<p class="muted">${esc(names)} · ${rig.hours.toFixed(1).replace('.', ',')} u</p><div class="crops">`;
    for (const [key, c] of Object.entries(D.crops)) {
      if (!c.unlocked) continue;
      const cost = rig.cost + c.seedCostPerHa * def.ha;
      const value = c.yieldPerHa * def.ha * G().cropPrice(key);
      html += `<div class="card crop">
        <div class="crop-head"><span class="dot" style="background:${c.color}"></span><b>${c.name}</b></div>
        <div class="muted">${c.growDays} dagen · ±${AT.fmtTons(c.yieldPerHa * def.ha)}</div>
        <div class="muted">Kost ${AT.fmtMoney(cost)} · nu waard ±${AT.fmtMoney(value)}</div>
        <button class="btn primary" data-action="sow" data-crop="${key}" data-id="${f.id}" ${s.money < cost ? 'disabled' : ''}>Zaai ${c.name.toLowerCase()}</button>
      </div>`;
    }
    return html + '</div>';
  }

  function renderGarage(s) {
    let html = `<h2>Garage <span class="muted">· ${s.machines.length} machines</span></h2>`;
    if (!s.machines.length) html += `<p class="muted">Geen machines. Koop er een in de winkel.</p>`;
    const order = ['tractor', 'harvester', 'plow', 'seeder'];
    const sorted = [...s.machines].sort((a, b) => order.indexOf(D.machines[a.type].kind) - order.indexOf(D.machines[b.type].kind));
    for (const m of sorted) {
      const d = D.machines[m.type];
      const value = Math.round(d.price * 0.6);
      html += `<div class="card row">
        <span class="swatch" style="background:${d.color}"></span>
        <div class="grow"><b>${esc(d.name)}</b><div class="muted">${KIND_NAMES[d.kind]} · ${m.busy ? 'bezig op Veld ' + m.busy : 'vrij in de schuur'}</div></div>
        <button class="btn small" data-action="sellMachine" data-uid="${m.uid}" ${m.busy ? 'disabled' : ''} title="Verkoop voor 60% van de nieuwprijs">Verkoop ${AT.fmtMoney(value)}</button>
      </div>`;
    }
    return html;
  }

  function machineSpecs(d) {
    if (d.kind === 'tractor') return `${d.power.toFixed(1)}× vermogen · ${d.fuelPerHour} L/u`;
    if (d.kind === 'harvester') return `${d.rate} ha/u · ${d.fuelPerHour} L/u`;
    return `${d.rate} ha/u · vereist ${d.minPower >= 2 ? '150+ pk' : '75+ pk'}`;
  }

  function renderShop(s) {
    let html = `<h2>Winkel</h2>`;
    const groups = [['tractor', 'Tractoren'], ['plow', 'Ploegen'], ['seeder', 'Zaaimachines'], ['harvester', 'Maaidorsers']];
    for (const [kind, title] of groups) {
      html += `<h3>${title}</h3>`;
      for (const [key, d] of Object.entries(D.machines)) {
        if (d.kind !== kind) continue;
        const owned = s.machines.filter(m => m.type === key).length;
        html += `<div class="card row">
          <span class="swatch" style="background:${d.color}"></span>
          <div class="grow"><b>${esc(d.name)}</b>${owned ? ` <span class="badge">${owned}×</span>` : ''}<div class="muted">${machineSpecs(d)}</div></div>
          <button class="btn small primary" data-action="buyMachine" data-type="${key}" ${s.money < d.price ? 'disabled' : ''}>${AT.fmtMoney(d.price)}</button>
        </div>`;
      }
    }
    const next = D.silo[s.siloLevel + 1];
    html += `<h3>Opslag</h3><div class="card row"><div class="grow"><b>Silo</b>
      <div class="muted">Nu ${G().siloCapacity()} t${next ? ` → ${next.capacity} t` : ' (maximaal)'}</div></div>
      ${next ? `<button class="btn small primary" data-action="upgradeSilo" ${s.money < next.price ? 'disabled' : ''}>${AT.fmtMoney(next.price)}</button>` : ''}
    </div>`;
    html += `<h3>Binnenkort</h3><div class="card soon">Aanhangers & graantransport · Personeel (AI-chauffeurs) · Irrigatie & kunstmest · Weer & seizoenen · Dieren · Fabrieken</div>`;
    return html;
  }

  function sparkline(history) {
    const w = 90, h = 26;
    const min = D.market.minFactor, max = D.market.maxFactor;
    const pts = history.map((v, i) => {
      const x = history.length === 1 ? w : (i / (history.length - 1)) * w;
      const y = h - ((v - min) / (max - min)) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
  }

  function renderMarket(s) {
    let html = `<h2>Graanhandel</h2>
      <p class="muted">Silo: ${AT.fmtTons(G().siloUsed())} / ${G().siloCapacity()} t. Prijzen veranderen elke dag.</p>`;
    for (const [key, c] of Object.entries(D.crops)) {
      const m = s.market[key];
      const prev = m.history[m.history.length - 2] ?? m.factor;
      const trend = m.factor > prev + 0.005 ? '<span class="up">▲</span>' : m.factor < prev - 0.005 ? '<span class="down">▼</span>' : '<span class="muted">■</span>';
      const stock = s.silo[key];
      html += `<div class="card">
        <div class="row"><span class="dot" style="background:${c.color}"></span><b class="grow">${c.name}</b>
          ${sparkline(m.history)} <span class="price">${AT.fmtMoney(G().cropPrice(key))}/t ${trend}</span></div>
        <div class="row"><span class="grow muted">In silo: ${AT.fmtTons(stock)} (≈ ${AT.fmtMoney(stock * G().cropPrice(key))})</span>
          <button class="btn small" data-action="sell" data-crop="${key}" data-tons="10" ${stock < 0.05 ? 'disabled' : ''}>Verkoop 10 t</button>
          <button class="btn small primary" data-action="sell" data-crop="${key}" ${stock < 0.05 ? 'disabled' : ''}>Alles</button></div>
      </div>`;
    }
    return html;
  }

  function renderGoals(s) {
    let html = `<h2>Doelen</h2><ul class="goals">`;
    for (const g of D.goals) {
      const done = !!s.goalsDone[g.id];
      html += `<li class="${done ? 'done' : ''}"><span>${done ? '✔' : '○'}</span> ${esc(g.text)}${g.reward ? ` <span class="muted">(+${AT.fmtMoney(g.reward)})</span>` : ''}</li>`;
    }
    html += `</ul><h3>Statistieken</h3><div class="card">
      <div>Geoogst: ${s.stats.harvested}× (${AT.fmtTons(s.stats.tonsHarvested)})</div>
      <div>Totale omzet: ${AT.fmtMoney(s.stats.earned)}</div>
      <div>Totale uitgaven: ${AT.fmtMoney(s.stats.spent)}</div>
    </div>
    <button class="btn danger" data-action="reset">Nieuw spel starten</button>`;
    return html;
  }

  const TABS = { field: renderField, garage: renderGarage, shop: renderShop, market: renderMarket, goals: renderGoals };

  function renderPanel() {
    const s = AT.state;
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
    $('#tab-content').innerHTML = TABS[activeTab](s);
    renderGoalBanner(s);
    updateLive();
  }

  function renderGoalBanner(s) {
    const next = D.goals.find(g => !s.goalsDone[g.id]);
    $('#goal').innerHTML = next ? `🎯 ${esc(next.text)}` : '🏆 Alle doelen behaald!';
  }

  function renderLog() {
    const s = AT.state;
    $('#log').innerHTML = s.log.slice(0, 30).map(l =>
      `<div class="log-${l.type}"><span class="muted">Dag ${l.day} ${String(l.hour).padStart(2, '0')}:00</span> ${esc(l.text)}</div>`).join('');
  }

  // waarden die elke frame veranderen (zonder knoppen opnieuw op te bouwen)
  function updateLive() {
    const s = AT.state;
    $('#money').textContent = AT.fmtMoney(s.money);
    const h = Math.floor(G().hour()), min = Math.floor((G().hour() % 1) * 60 / 10) * 10;
    $('#clock').textContent = `Dag ${G().day()} · ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    $('#silo').textContent = `${Math.round(G().siloUsed())} / ${G().siloCapacity()} t`;
    document.querySelectorAll('.speed button').forEach(b => {
      const v = b.dataset.speed;
      b.classList.toggle('active', v === 'pause' ? s.paused : !s.paused && Number(v) === s.speed);
    });

    if (activeTab !== 'field') return;
    const f = s.fields.find(x => x.id === AT.render.view.selected);
    if (f.job) {
      const pct = Math.min(100, f.job.progress * 100);
      setStyle('[data-live="jobbar"]', 'width', pct + '%');
      const left = (1 - f.job.progress) * f.job.hours;
      setText('[data-live="jobpct"]', `${Math.floor(pct)}% · nog ${left.toFixed(1).replace('.', ',')} u`);
    } else if (f.state === 'growing') {
      setStyle('[data-live="growbar"]', 'width', f.growth * 100 + '%');
      const daysLeft = (1 - f.growth) * D.crops[f.crop].growDays;
      setText('[data-live="growtxt"]', `${Math.floor(f.growth * 100)}% · nog ±${daysLeft < 1 ? Math.ceil(daysLeft * 24) + ' uur' : daysLeft.toFixed(1).replace('.', ',') + ' dagen'}`);
    }
  }
  const setText = (sel, t) => { const el = $(sel); if (el) el.textContent = t; };
  const setStyle = (sel, k, v) => { const el = $(sel); if (el) el.style[k] = v; };

  // ---------- events ----------
  function selectField(id) {
    AT.render.view.selected = id;
    activeTab = 'field';
    renderPanel();
  }

  function onAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const a = btn.dataset;
    const id = Number(a.id);
    switch (a.action) {
      case 'select': selectField(id); break;
      case 'buyField': G().buyField(id); break;
      case 'job': G().startJob(id, a.task); break;
      case 'sow': G().startJob(id, 'sow', a.crop); break;
      case 'sell': G().sell(a.crop, a.tons ? Number(a.tons) : undefined); break;
      case 'buyMachine': G().buyMachine(a.type); break;
      case 'sellMachine': G().sellMachine(Number(a.uid)); break;
      case 'upgradeSilo': G().upgradeSilo(); break;
      case 'reset':
        if (confirm('Weet je zeker dat je opnieuw wilt beginnen? Je voortgang gaat verloren.')) G().reset();
        break;
    }
  }

  function setSpeed(v) {
    const s = AT.state;
    if (v === 'pause') s.paused = !s.paused;
    else { s.paused = false; s.speed = Number(v); }
    updateLive();
  }

  function init() {
    $('#tab-content').addEventListener('click', onAction);
    document.querySelector('.tabs').addEventListener('click', e => {
      const b = e.target.closest('button[data-tab]');
      if (!b) return;
      activeTab = b.dataset.tab;
      renderPanel();
    });
    document.querySelector('.speed').addEventListener('click', e => {
      const b = e.target.closest('button[data-speed]');
      if (b) setSpeed(b.dataset.speed);
    });

    const canvas = $('#map');
    canvas.addEventListener('click', e => {
      const p = AT.render.toLogical(e);
      const id = AT.render.fieldAt(p.x, p.y);
      if (id) selectField(id);
      else if (p.x < 220 && p.y > 170 && p.y < 300) { activeTab = 'garage'; renderPanel(); }
      else if (p.x < 220 && p.y > 320 && p.y < 410) { activeTab = 'market'; renderPanel(); }
      else if (p.x < 220 && p.y < 160 && p.x > 120) { activeTab = 'market'; renderPanel(); }
    });
    canvas.addEventListener('mousemove', e => {
      const p = AT.render.toLogical(e);
      const id = AT.render.fieldAt(p.x, p.y);
      AT.render.view.hover = id;
      canvas.style.cursor = id || p.x < 220 ? 'pointer' : 'default';
    });
    canvas.addEventListener('mouseleave', () => { AT.render.view.hover = null; });

    document.addEventListener('keydown', e => {
      if (e.target.closest('input, textarea')) return;
      if (e.code === 'Space') { e.preventDefault(); setSpeed('pause'); }
      if (e.key === '1') setSpeed('1');
      if (e.key === '2') setSpeed('2');
      if (e.key === '3') setSpeed('4');
    });

    AT.on('change', renderPanel);
    AT.on('newday', () => { if (activeTab === 'market') renderPanel(); });
    AT.on('log', renderLog);
    renderPanel();
    renderLog();
  }

  AT.ui = { init, updateLive, renderPanel, renderLog };
})();
