// Agro Tycoon 2.0 — HTML-interface (zijpaneel, topbalk, logboek) + muis op de kaart
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const G = () => AT.game;
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let activeTab = 'garage';

  const JOB_NAMES = { plow: 'Ploegen', sow: 'Zaaien', harvest: 'Oogsten' };
  const KIND_NAMES = { tractor: 'Tractor', plow: 'Ploeg', seeder: 'Zaaimachine', harvester: 'Maaidorser' };
  const pct = (n, total) => Math.round(n / total * 100);

  // ---------- Veld ----------
  function renderField(s) {
    const id = AT.render.view.selected;
    const def = G().fieldDef(id);
    const f = G().field(id);
    let html = `<h2>Veld ${id} <span class="muted">· ${AT.fmtHa(def.ha)}</span>
      <button class="btn small right" data-action="look" data-id="${id}">Bekijk op kaart</button></h2>`;

    if (!f.owned) {
      const price = G().fieldPrice(id);
      html += `<p>Dit veld is te koop.</p>
        <button class="btn primary" data-action="buyField" data-id="${id}" ${s.money < price ? 'disabled' : ''}>
          Koop veld voor ${AT.fmtMoney(price)}</button>`;
    } else {
      html += `<div data-live="fieldsum">${fieldSummaryHtml(f)}</div>`;
      const sum = G().summary(f);
      if (f.job) {
        const machines = s.machines.filter(m => f.job.machines.includes(m.uid)).map(m => D.machines[m.type].name).join(' + ');
        html += `<div class="card"><b>Loonwerker: ${JOB_NAMES[f.job.type]}</b>
          <div class="bar"><div class="fill job" data-live="jobbar"></div></div>
          <div class="muted"><span data-live="jobpct"></span> · ${esc(machines)}</div></div>`;
      } else {
        html += `<h3>Loonwerker inhuren</h3><p class="muted">Een loonwerker doet het hele veld voor je met jouw vrije machines (+${AT.fmtMoney(D.workerWagePerHour)}/u loon).</p>`;
        if (sum.stubble) html += workerButton(s, f, 'plow', 'Laat ploegen');
        if (sum.plowed) html += cropChoice(s, f, def, sum);
        if (sum.ready) html += workerButton(s, f, 'harvest', `Laat oogsten (±${AT.fmtTons(sum.readyTons)})`);
        if (!sum.stubble && !sum.plowed && !sum.ready) html += `<p class="muted">Niets te doen: het gewas groeit.</p>`;
      }
    }

    html += `<h3>Alle velden</h3><div class="field-list">`;
    for (const fd of D.fields) {
      const ff = G().field(fd.id);
      let st = 'Te koop';
      if (ff.owned) {
        const sm = G().summary(ff);
        st = ff.job ? JOB_NAMES[ff.job.type] + '…' : sm.ready && !sm.growing ? 'Rijp!' : sm.growing ? (D.crops[G().mainCrop(sm)].name + ' groeit') :
          sm.plowed > sm.stubble ? 'Geploegd' : 'Stoppel';
      }
      html += `<button class="field-row ${fd.id === id ? 'active' : ''} ${st === 'Rijp!' ? 'ready' : ''} ${!ff.owned ? 'forsale' : ''}"
        data-action="select" data-id="${fd.id}"><span>Veld ${fd.id} <span class="muted">${AT.fmtHa(fd.ha)}</span></span><span>${st}</span></button>`;
    }
    return html + `</div>`;
  }

  function fieldSummaryHtml(f) {
    const sum = G().summary(f), t = sum.total;
    const parts = [['stubble', 'Stoppel', '#c8ad6a'], ['plowed', 'Geploegd', '#7a5232'], ['growing', 'Groeit', '#7fb24a'], ['ready', 'Rijp', '#e0b84c']];
    let bar = '<div class="stack">', legend = '<div class="legend">';
    for (const [k, label, col] of parts) {
      if (!sum[k]) continue;
      bar += `<span style="width:${sum[k] / t * 100}%;background:${col}"></span>`;
      legend += `<span><i style="background:${col}"></i>${label} ${pct(sum[k], t)}%</span>`;
    }
    let extra = '';
    if (sum.growing) {
      const crop = D.crops[G().mainCrop(sum)];
      const left = (1 - sum.minGrowth) * crop.growDays;
      extra = `<p class="muted">${crop.name}: alles rijp over ±${left < 1 ? Math.ceil(left * 24) + ' uur' : left.toFixed(1).replace('.', ',') + ' dagen'}</p>`;
    }
    return bar + '</div>' + legend + '</div>' + extra;
  }

  function workerButton(s, f, task, label) {
    const rig = G().bestRig(task, f.id);
    if (!rig) return `<p class="warn">${esc(G().missingFor(task))}</p>`;
    const names = rig.machines.map(m => D.machines[m.type].name).join(' + ');
    return `<div class="card row"><div class="grow"><b>${esc(names)}</b>
      <div class="muted">${AT.fmtHours(rig.hours)} · ${AT.fmtMoney(rig.cost)}</div></div>
      <button class="btn small primary" data-action="job" data-task="${task}" data-id="${f.id}" ${s.money < rig.cost ? 'disabled' : ''}>${label}</button></div>`;
  }

  function cropChoice(s, f, def, sum) {
    const rig = G().bestRig('sow', f.id);
    if (!rig) return `<p class="warn">${esc(G().missingFor('sow'))}</p>`;
    const ha = def.ha * sum.plowed / sum.total;
    let html = `<div class="card"><b>Laat zaaien</b> <span class="muted">· ${esc(rig.machines.map(m => D.machines[m.type].name).join(' + '))} · ${AT.fmtHours(rig.hours)}</span>`;
    for (const [key, c] of Object.entries(D.crops)) {
      const cost = rig.cost + c.seedCostPerHa * ha;
      html += `<div class="row crop-row"><span class="dot" style="background:${c.color}"></span>
        <span class="grow">${c.name} <span class="muted">${c.growDays} d · ${AT.fmtMoney(cost)}</span></span>
        <button class="btn small primary" data-action="sow" data-crop="${key}" data-id="${f.id}" ${s.money < cost ? 'disabled' : ''}>Zaai</button></div>`;
    }
    return html + '</div>';
  }

  // ---------- Garage (instappen) ----------
  function renderGarage(s) {
    let html = `<h2>Garage</h2>`;
    if (s.player) {
      const r = AT.vehicle.rig();
      html += `<div class="card driving"><b>Je rijdt: ${esc(r.mainDef.name)}${r.impl ? ' + ' + esc(D.machines[r.impl.type].name) : ''}</b>
        <div class="muted">WASD/pijltjes = rijden · Spatie = werktuig omlaag/omhoog · E = uitstappen</div>`;
      if (r.toolDef && r.toolDef.kind === 'seeder') {
        html += `<div class="row crop-pick">Zaaigoed (C):`;
        for (const [key, c] of Object.entries(D.crops)) {
          html += `<button class="btn small ${s.player.crop === key ? 'primary' : ''}" data-action="crop" data-crop="${key}">${c.name}</button>`;
        }
        html += `</div>`;
      }
      html += `<button class="btn" data-action="exit">Uitstappen (terug naar schuur)</button></div>`;
    }

    const free = s.machines.filter(m => !m.busy);
    const tractors = s.machines.filter(m => D.machines[m.type].kind === 'tractor');
    const harvesters = s.machines.filter(m => D.machines[m.type].kind === 'harvester');
    const implsFree = free.filter(m => ['plow', 'seeder'].includes(D.machines[m.type].kind));

    html += `<h3>Instappen</h3>`;
    for (const t of tractors) {
      const d = D.machines[t.type];
      if (t.busy) { html += machineRow(t, statusText(t)); continue; }
      const options = implsFree.filter(i => G().canPull(t, i));
      const btns = options.map(i => `<button class="btn small primary" data-action="enter" data-uid="${t.uid}" data-impl="${i.uid}">+ ${esc(D.machines[i.type].name)}</button>`).join('');
      html += `<div class="card"><div class="row"><span class="swatch" style="background:${d.color}"></span><b class="grow">${esc(d.name)}</b>
        <button class="btn small" data-action="enter" data-uid="${t.uid}">Alleen rijden</button></div>
        ${btns ? `<div class="row wrap">${btns}</div>` : '<div class="muted">Geen vrij werktuig dat past.</div>'}</div>`;
    }
    for (const h of harvesters) {
      if (h.busy) { html += machineRow(h, statusText(h)); continue; }
      html += machineRow(h, 'Vrij', `<button class="btn small primary" data-action="enter" data-uid="${h.uid}">Instappen</button>`);
    }

    html += `<h3>Alle machines</h3>`;
    const order = ['tractor', 'harvester', 'plow', 'seeder'];
    const sorted = [...s.machines].sort((a, b) => order.indexOf(D.machines[a.type].kind) - order.indexOf(D.machines[b.type].kind));
    for (const m of sorted) {
      const value = Math.round(D.machines[m.type].price * 0.6);
      html += machineRow(m, `${KIND_NAMES[D.machines[m.type].kind]} · ${statusText(m)}`,
        `<button class="btn small" data-action="sellMachine" data-uid="${m.uid}" ${m.busy ? 'disabled' : ''} title="Verkoop voor 60% van de nieuwprijs">Verkoop ${AT.fmtMoney(value)}</button>`);
    }
    return html;
  }

  function statusText(m) {
    if (m.busy === 'player') return 'jij rijdt hiermee';
    if (m.busy) return 'loonwerker op Veld ' + m.busy;
    return 'vrij in de schuur';
  }

  function machineRow(m, sub, button = '') {
    const d = D.machines[m.type];
    return `<div class="card row"><span class="swatch" style="background:${d.color}"></span>
      <div class="grow"><b>${esc(d.name)}</b><div class="muted">${esc(sub)}</div></div>${button}</div>`;
  }

  // ---------- Winkel ----------
  function machineSpecs(d) {
    if (d.kind === 'tractor') return `${d.power.toFixed(1)}× vermogen · ${Math.round(d.speed * 0.25)} km/u · ${d.fuelPerHour} L/u`;
    if (d.kind === 'harvester') return `${d.width} m breed · ${d.fuelPerHour} L/u`;
    return `${d.width} m breed · vereist ${d.minPower >= 2 ? '150+ pk' : '75+ pk'}`;
  }

  function renderShop(s) {
    let html = `<h2>Winkel</h2>`;
    const groups = [['tractor', 'Tractoren'], ['plow', 'Ploegen'], ['seeder', 'Zaaimachines'], ['harvester', 'Maaidorsers']];
    for (const [kind, title] of groups) {
      html += `<h3>${title}</h3>`;
      for (const [key, d] of Object.entries(D.machines)) {
        if (d.kind !== kind) continue;
        const owned = s.machines.filter(m => m.type === key).length;
        html += `<div class="card row"><span class="swatch" style="background:${d.color}"></span>
          <div class="grow"><b>${esc(d.name)}</b>${owned ? ` <span class="badge">${owned}×</span>` : ''}<div class="muted">${machineSpecs(d)}</div></div>
          <button class="btn small primary" data-action="buyMachine" data-type="${key}" ${s.money < d.price ? 'disabled' : ''}>${AT.fmtMoney(d.price)}</button></div>`;
      }
    }
    const next = D.silo[s.siloLevel + 1];
    html += `<h3>Opslag</h3><div class="card row"><div class="grow"><b>Silo</b>
      <div class="muted">Nu ${G().siloCapacity()} t${next ? ` → ${next.capacity} t` : ' (maximaal)'}</div></div>
      ${next ? `<button class="btn small primary" data-action="upgradeSilo" ${s.money < next.price ? 'disabled' : ''}>${AT.fmtMoney(next.price)}</button>` : ''}</div>`;
    return html;
  }

  // ---------- Markt ----------
  function sparkline(history) {
    const w = 90, h = 26, min = D.market.minFactor, max = D.market.maxFactor;
    const pts = history.map((v, i) => {
      const x = history.length === 1 ? w : (i / (history.length - 1)) * w;
      return `${x.toFixed(1)},${(h - ((v - min) / (max - min)) * h).toFixed(1)}`;
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

  // ---------- Doelen ----------
  function renderGoals(s) {
    let html = `<h2>Doelen</h2><ul class="goals">`;
    for (const g of D.goals) {
      const done = !!s.goalsDone[g.id];
      html += `<li class="${done ? 'done' : ''}"><span>${done ? '✔' : '○'}</span> ${esc(g.text)}${g.reward ? ` <span class="muted">(+${AT.fmtMoney(g.reward)})</span>` : ''}</li>`;
    }
    html += `</ul><h3>Statistieken</h3><div class="card">
      <div>Geploegd: ${AT.fmtHa(s.stats.plowedHa.toFixed(1))} · Gezaaid: ${AT.fmtHa(s.stats.sownHa.toFixed(1))} · Geoogst: ${AT.fmtHa(s.stats.harvestedHa.toFixed(1))}</div>
      <div>Totaal geoogst: ${AT.fmtTons(s.stats.tonsHarvested)}</div>
      <div>Totale omzet: ${AT.fmtMoney(s.stats.earned)}</div>
      <div>Totale uitgaven: ${AT.fmtMoney(s.stats.spent)}</div>
    </div>
    <h3>Besturing</h3><div class="card muted">
      WASD / pijltjes: rijden (of camera als je niet rijdt)<br>Spatie: werktuig omlaag/omhoog · C: zaaigoed wisselen<br>
      E: in-/uitstappen · Scroll: zoomen · Slepen: kaart verschuiven<br>P: pauze · 1 / 2 / 3: snelheid
    </div>
    <button class="btn danger" data-action="reset">Nieuw spel starten</button>`;
    return html;
  }

  const TABS = { field: renderField, garage: renderGarage, shop: renderShop, market: renderMarket, goals: renderGoals };

  function renderPanel() {
    const s = AT.state;
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
    const el = $('#tab-content'), scroll = el.scrollTop;
    el.innerHTML = TABS[activeTab](s);
    el.scrollTop = scroll;
    const next = D.goals.find(g => !s.goalsDone[g.id]);
    $('#goal').innerHTML = next ? `🎯 ${esc(next.text)}` : '🏆 Alle doelen behaald!';
    updateLive();
  }

  function renderLog() {
    $('#log').innerHTML = AT.state.log.slice(0, 30).map(l =>
      `<div class="log-${l.type}"><span class="muted">Dag ${l.day} ${String(l.hour).padStart(2, '0')}:00</span> ${esc(l.text)}</div>`).join('');
  }

  // waarden die steeds veranderen, zonder knoppen opnieuw op te bouwen
  let sumTimer = 0;
  function updateLive(dt = 1) {
    const s = AT.state;
    $('#money').textContent = AT.fmtMoney(s.money);
    const h = Math.floor(G().hour()), min = Math.floor((G().hour() % 1) * 6) * 10;
    $('#clock').textContent = `Dag ${G().day()} · ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    $('#silo').textContent = `${Math.round(G().siloUsed())} / ${G().siloCapacity()} t`;
    document.querySelectorAll('.speed button').forEach(b => {
      const v = b.dataset.speed;
      b.classList.toggle('active', v === 'pause' ? s.paused : !s.paused && Number(v) === s.speed);
    });

    if (activeTab !== 'field') return;
    const f = G().field(AT.render.view.selected);
    if (f.job) {
      const p = Math.min(100, f.job.progress * 100);
      const bar = $('[data-live="jobbar"]'); if (bar) bar.style.width = p + '%';
      const txt = $('[data-live="jobpct"]'); if (txt) txt.textContent = `${Math.floor(p)}% · nog ${AT.fmtHours((1 - f.job.progress) * f.job.hours)}`;
    }
    sumTimer += dt;
    if (sumTimer > 0.5 && f.owned) {
      sumTimer = 0;
      const el = $('[data-live="fieldsum"]'); if (el) el.innerHTML = fieldSummaryHtml(f);
    }
  }

  // ---------- acties ----------
  function selectField(id, look = false) {
    AT.render.view.selected = id;
    activeTab = 'field';
    if (look) { const d = G().fieldDef(id); AT.render.centerOn(d.x + d.w / 2, d.y + d.h / 2); }
    renderPanel();
  }

  function onAction(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn || btn.disabled) return;
    const a = btn.dataset, id = Number(a.id);
    btn.blur();
    switch (a.action) {
      case 'select': selectField(id); break;
      case 'look': selectField(id, true); break;
      case 'buyField': G().buyField(id); break;
      case 'job': G().startJob(id, a.task); break;
      case 'sow': G().startJob(id, 'sow', a.crop); break;
      case 'sell': G().sell(a.crop, a.tons ? Number(a.tons) : undefined); break;
      case 'buyMachine': G().buyMachine(a.type); break;
      case 'sellMachine': G().sellMachine(Number(a.uid)); break;
      case 'upgradeSilo': G().upgradeSilo(); break;
      case 'enter': G().enterVehicle(Number(a.uid), a.impl ? Number(a.impl) : null); break;
      case 'exit': G().exitVehicle(); break;
      case 'crop': AT.state.player.crop = a.crop; renderPanel(); break;
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

  // ---------- muis op de kaart ----------
  function initCanvas() {
    const canvas = $('#map');
    let drag = null;

    canvas.addEventListener('mousedown', e => {
      const p = AT.render.eventPos(e);
      drag = { sx: p.x, sy: p.y, cx: AT.render.cam.x, cy: AT.render.cam.y, moved: false, mini: AT.render.inMinimap(p.x, p.y) };
    });
    window.addEventListener('mousemove', e => {
      const p = AT.render.eventPos(e);
      if (drag) {
        if (drag.mini) {
          if (!AT.state.player) { const w = AT.render.minimapToWorld(p.x, p.y); AT.render.centerOn(w.x, w.y); }
          drag.moved = true;
        } else if (Math.abs(p.x - drag.sx) + Math.abs(p.y - drag.sy) > 4) {
          drag.moved = true;
          if (!AT.state.player) {
            AT.render.cam.x = drag.cx - (p.x - drag.sx) / AT.render.cam.zoom;
            AT.render.cam.y = drag.cy - (p.y - drag.sy) / AT.render.cam.zoom;
          }
        }
      }
      if (e.target === canvas) {
        const w = AT.render.screenToWorld(p.x, p.y);
        AT.render.view.hover = AT.render.inMinimap(p.x, p.y) ? null : AT.render.fieldAt(w.x, w.y);
        canvas.style.cursor = drag && drag.moved ? 'grabbing' : AT.render.view.hover ? 'pointer' : 'grab';
      }
    });
    window.addEventListener('mouseup', e => {
      if (!drag) return;
      const wasDrag = drag.moved, mini = drag.mini;
      drag = null;
      if (wasDrag || e.target !== canvas) return;
      const p = AT.render.eventPos(e);
      if (mini) {
        const w = AT.render.minimapToWorld(p.x, p.y);
        if (!AT.state.player) AT.render.centerOn(w.x, w.y);
        const id = AT.render.fieldAt(w.x, w.y);
        if (id) selectField(id);
        return;
      }
      const w = AT.render.screenToWorld(p.x, p.y);
      const id = AT.render.fieldAt(w.x, w.y);
      if (id) return selectField(id);
      const Y = D.yard;
      if (w.x >= Y.x && w.x <= Y.x + Y.w && w.y >= Y.y && w.y <= Y.y + Y.h) {
        activeTab = w.y > 910 ? 'market' : w.y > 740 ? 'garage' : 'market';
        renderPanel();
      }
    });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const p = AT.render.eventPos(e);
      AT.render.zoomAt(p.x, p.y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });
  }

  function init() {
    $('#tab-content').addEventListener('click', onAction);
    document.querySelector('.tabs').addEventListener('click', e => {
      const b = e.target.closest('button[data-tab]');
      if (!b) return;
      activeTab = b.dataset.tab;
      b.blur();
      renderPanel();
    });
    document.querySelector('.speed').addEventListener('click', e => {
      const b = e.target.closest('button[data-speed]');
      if (b) { setSpeed(b.dataset.speed); b.blur(); }
    });
    initCanvas();

    document.addEventListener('keydown', e => {
      if (e.target.closest && e.target.closest('input, select, textarea')) return;
      if (e.repeat) return;
      if (e.code === 'KeyP') setSpeed('pause');
      if (e.code === 'Digit1') setSpeed('1');
      if (e.code === 'Digit2') setSpeed('2');
      if (e.code === 'Digit3') setSpeed('4');
    });

    AT.on('change', renderPanel);
    AT.on('enter', () => { activeTab = 'garage'; });
    AT.on('newday', () => { if (activeTab === 'market') renderPanel(); });
    AT.on('log', renderLog);
    renderPanel();
    renderLog();
  }

  AT.ui = { init, updateLive, renderPanel, renderLog };
})();
