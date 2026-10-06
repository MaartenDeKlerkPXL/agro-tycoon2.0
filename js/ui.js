// Agro Tycoon 2.0 — HTML-interface (zijpaneel, topbalk, logboek) + muis op de kaart
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const G = () => AT.game;
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let activeTab = 'field';

  const JOB_NAMES = { plow: 'Ploegen', sow: 'Zaaien', harvest: 'Oogsten', fertilize: 'Kunstmest strooien', manure: 'Mest uitrijden' };
  const KIND_NAMES = { tractor: 'Tractor', plow: 'Ploeg', seeder: 'Zaaimachine', harvester: 'Maaidorser', spreader: 'Kunstmeststrooier', manure: 'Mestverspreider' };
  const seasonName = i => D.seasons[i].name.toLowerCase();
  const monthShort = i => D.months[i].slice(0, 3).toLowerCase();
  // maanden als korte reeks: "mrt–apr, sep–okt"
  function monthRanges(list) {
    const sorted = [...list].sort((a, b) => a - b), parts = [];
    for (let i = 0; i < sorted.length; i++) {
      let j = i;
      while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
      parts.push(i === j ? monthShort(sorted[i]) : `${monthShort(sorted[i])}–${monthShort(sorted[j])}`);
      i = j;
    }
    return parts.join(', ');
  }
  function cropTraits(c) {
    const t = [];
    if (c.winterHardy) t.push('winterhard');
    if (c.droughtProof) t.push('kan tegen droogte');
    if (c.soilDemand < 0) t.push('verbetert de bodem');
    if (c.greenManure) t.push('groenbemester: onderploegen');
    if (c.harvester === 'potato') t.push('aardappelrooier nodig');
    if (c.harvester === 'beet') t.push('bietenrooier nodig');
    return t;
  }
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
      html += soilHtml(f, sum);
      if (f.job) {
        const machines = s.machines.filter(m => f.job.machines.includes(m.uid)).map(m => D.machines[m.type].name).join(' + ');
        html += `<div class="card"><b>Loonwerker: ${JOB_NAMES[f.job.type]}</b>
          <div class="bar"><div class="fill job" data-live="jobbar"></div></div>
          <div class="muted"><span data-live="jobpct"></span> · ${esc(machines)}</div></div>`;
      } else {
        html += selfHelp(sum);
        html += `<h3>Of: loonwerker inhuren</h3><p class="muted">Een loonwerker doet het hele veld voor je met jouw vrije machines (+${AT.fmtMoney(D.workerWagePerHour)}/u loon).</p>`;
        if (sum.stubble) html += workerButton(s, f, 'plow', 'Laat ploegen');
        if (sum.plowed) html += cropChoice(s, f, def, sum);
        const rc = G().mainCrop({ crops: sum.readyCrops });
        if (sum.ready && rc && !D.crops[rc].greenManure) html += workerButton(s, f, 'harvest', `Laat oogsten (±${AT.fmtTons(sum.readyTons)})`);
        if (sum.clover && sum.stubble === 0) html += workerButton(s, f, 'plow', 'Laat klaver onderploegen');
        if (sum.needFert && G().bestRig('fertilize', f.id)) html += workerButton(s, f, 'fertilize', 'Laat kunstmest strooien');
        if (sum.needManure && G().bestRig('manure', f.id)) html += workerButton(s, f, 'manure', 'Laat mest uitrijden');
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

  // bodemkwaliteit, bemesting en vruchtwisseling: bepalen samen de opbrengst
  function soilHtml(f, sum) {
    const soilPct = Math.round(f.soil * 100);
    const col = f.soil > 0.66 ? '#4caf50' : f.soil > 0.4 ? '#e0b84c' : '#d9534f';
    const prev = G().mainCrop({ crops: sum.prev });
    const tips = [];
    if (f.soil < 0.5) tips.push('Bodem raakt uitgeput: rij <b>mest</b> uit (van koeien/schapen).');
    if (sum.fert < sum.total * 0.5) tips.push('<b>Kunstmest</b> geeft +25% opbrengst.');
    if (prev) tips.push(`Vorig gewas: <b>${D.crops[prev].name}</b>. Zaai iets anders voor +10% (vruchtwisseling), hetzelfde geeft −10%.`);
    if (f.damage > 0) tips.push(`Storm-/vorstschade: −${Math.round(f.damage * 100)}% op dit gewas.`);
    if (sum.withering) tips.push(`<b>${pct(sum.withering, sum.total)}% verwelkt</b>: hoe langer je wacht, hoe minder opbrengst.`);
    if (f.soil < 0.6) tips.push('Zaai <b>klaver</b> of <b>bonen/soja</b> om de bodem te herstellen.');
    return `<div class="card soil">
      <div class="row"><b class="grow">Bodemkwaliteit</b><span>${soilPct}%</span></div>
      <div class="bar"><div class="fill" style="width:${soilPct}%;background:${col}"></div></div>
      <div class="muted">Kunstmest op ${pct(sum.fert, sum.total)}% · mest op ${pct(sum.manure, sum.total)}%${sum.avgFactor ? ` · opbrengst ×${sum.avgFactor.toFixed(2).replace('.', ',')}` : ''}</div>
      ${tips.length ? `<ul class="tips">${tips.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
    </div>`;
  }

  // uitleg om het zelf te doen, afhankelijk van wat er op het veld moet gebeuren
  function selfHelp(sum) {
    let step = '';
    const readyCrop = G().mainCrop({ crops: sum.readyCrops });
    if (sum.ready && readyCrop && D.crops[readyCrop].greenManure) step = `De <b>klaver</b> is volgroeid. Ploeg hem onder met je <b>ploeg</b>: dat maakt de bodem veel beter.`;
    else if (sum.ready) step = `Loop naar je <b>${G().HARVESTER_NAMES[D.crops[readyCrop].harvester]}</b>, stap in (E), rij naar dit veld en zet hem omlaag (spatie).` + (AT.weather.isWet() ? ' <b>Let op: het is nu te nat om te oogsten.</b>' : '') + (sum.withering ? ' <b>Het gewas verwelkt: oogst snel!</b>' : '');
    else if (sum.plowed) step = 'Koppel een <b>zaaimachine</b> aan je tractor (achteruit ertegen rijden + F), kies het zaaigoed (C), rij hierheen en zet hem omlaag (spatie).';
    else if (sum.stubble) step = 'Stap in je <b>tractor met ploeg</b> (E), rij hierheen en zet de ploeg omlaag (spatie).';
    else return '';
    return `<div class="card self"><b>Zelf doen</b><p>${step}</p><p class="muted">De witte pijl rond je boer of machine wijst de weg naar dit veld.</p></div>`;
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
    if (!rig) return `<p class="warn">${esc(G().missingFor(task, f.id))}</p>`;
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
    const entries = Object.entries(D.crops).sort(([a], [b]) => G().canSowNow(b) - G().canSowNow(a));
    for (const [key, c] of entries) {
      const cost = rig.cost + c.seedCostPerHa * ha;
      const ok = G().canSowNow(key);
      html += `<div class="row crop-row ${ok ? '' : 'off'}"><span class="dot" style="background:${c.color}"></span>
        <span class="grow">${c.name} <span class="muted">${c.growDays} d · ${ok ? AT.fmtMoney(cost) : 'zaaien: ' + monthRanges(c.sow)}</span></span>
        <button class="btn small primary" data-action="sow" data-crop="${key}" data-id="${f.id}" ${!ok || s.money < cost ? 'disabled' : ''}>Zaai</button></div>`;
    }
    return html + '</div>';
  }

  // ---------- Garage ----------
  const thumbImg = type => `<img class="thumb" src="${AT.sprites.thumb(type)}" alt="">`;

  function whereIs(m) {
    if (m.busy === 'player') return 'jij rijdt hiermee';
    if (m.busy) return 'loonwerker op Veld ' + m.busy;
    if (m.attached) {
      const t = G().machine(m.attached);
      return 'aangekoppeld aan ' + D.machines[t.type].name + (t.busy === 'player' ? ' (jij rijdt)' : '');
    }
    const Y = D.yard;
    if (m.x >= Y.x && m.x <= Y.x + Y.w && m.y >= Y.y && m.y <= Y.y + Y.h) return 'op het erf';
    const fid = AT.render.fieldAt(m.x, m.y);
    return fid ? 'op Veld ' + fid : 'langs de weg';
  }

  function renderGarage(s) {
    const p = s.player;
    let html = `<h2>Garage</h2>`;
    if (p.mode === 'drive') {
      const r = AT.vehicle.rig();
      html += `<div class="card driving"><b>Je rijdt: ${esc(r.mainDef.name)}${r.impl ? ' + ' + esc(D.machines[r.impl.type].name) : ''}</b>`;
      if (r.toolDef && r.toolDef.kind === 'seeder') {
        html += `<div class="row crop-pick">Zaaigoed (C):`;
        for (const [key, c] of Object.entries(D.crops)) {
          if (!G().canSowNow(key) && p.crop !== key) continue;
          html += `<button class="btn small ${p.crop === key ? 'primary' : ''}" data-action="crop" data-crop="${key}" title="Zaaien: ${monthRanges(c.sow)}">${c.name}${G().canSowNow(key) ? '' : ' ✕'}</button>`;
        }
        html += `</div>`;
      }
      html += `<button class="btn" data-action="exit">Uitstappen (E)</button></div>`;
    }
    html += `<div class="card howto"><b>Zo werkt het</b><ul>
      <li><b>WASD</b>: lopen of rijden · <b>Shift</b>: rennen</li>
      <li><b>E</b>: in- of uitstappen (loop tot vlak bij de machine)</li>
      <li><b>F</b>: werktuig aan- of afkoppelen (rij achteruit tegen ploeg, zaaimachine of strooier)</li>
      <li><b>Spatie</b>: werktuig omlaag/omhoog · <b>C</b>: zaaigoed wisselen</li>
    </ul></div>`;

    html += `<h3>Jouw machines</h3>`;
    const order = ['tractor', 'harvester', 'plow', 'seeder', 'spreader', 'manure'];
    // (rooiers vallen onder 'harvester')
    const sorted = [...s.machines].sort((a, b) => order.indexOf(D.machines[a.type].kind) - order.indexOf(D.machines[b.type].kind));
    for (const m of sorted) {
      const d = D.machines[m.type];
      const value = Math.round(d.price * 0.6);
      const sellable = !m.busy && !(m.attached && G().machine(m.attached).busy);
      html += `<div class="card row">${thumbImg(m.type)}
        <div class="grow"><b>${esc(d.name)}</b><div class="muted">${esc(whereIs(m))}</div></div>
        <div class="col">
          <button class="btn small" data-action="findMachine" data-uid="${m.uid}">Zoek</button>
          <button class="btn small" data-action="sellMachine" data-uid="${m.uid}" ${sellable ? '' : 'disabled'} title="Verkoop voor 60% van de nieuwprijs">${AT.fmtMoney(value)}</button>
        </div></div>`;
    }
    return html;
  }

  // ---------- Winkel ----------
  function machineSpecs(d) {
    if (d.kind === 'tractor') return `${d.power.toFixed(1)}× vermogen · ${d.speed} km/u · ${d.fuelPerHour} L/u`;
    if (d.kind === 'harvester') {
      const what = Object.values(D.crops).filter(c => c.harvester === d.harvests).map(c => c.name.toLowerCase());
      return `${d.width} m breed · oogst: ${what.length > 4 ? 'granen, maïs, koolzaad, zonnebloem, soja, bonen' : what.join(', ')}`;
    }
    if (d.kind === 'spreader') return `${d.width} m breed · +25% opbrengst · ${AT.fmtMoney(D.fertCostPerHa)}/ha`;
    if (d.kind === 'manure') return `${d.width} m breed · betere bodem · ${D.manurePerHa} t mest/ha`;
    return `${d.width} m breed · ${d.workSpeed} km/u · vereist ${d.minPower >= 2 ? '150+ pk' : '75+ pk'}`;
  }

  function renderShop(s) {
    let html = `<h2>Winkel</h2>`;
    const groups = [['tractor', 'Tractoren'], ['plow', 'Ploegen'], ['seeder', 'Zaaimachines'], ['spreader', 'Bemesting'], ['manure', ''], ['harvester', 'Oogstmachines']];
    for (const [kind, title] of groups) {
      if (title) html += `<h3>${title}</h3>`;
      for (const [key, d] of Object.entries(D.machines)) {
        if (d.kind !== kind) continue;
        const owned = s.machines.filter(m => m.type === key).length;
        html += `<div class="card row">${thumbImg(key)}
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

  function trendOf(m) {
    const prev = m.history[m.history.length - 2] ?? m.factor;
    return m.factor > prev + 0.005 ? '<span class="up">▲</span>' : m.factor < prev - 0.005 ? '<span class="down">▼</span>' : '<span class="muted">■</span>';
  }

  function renderMarket(s) {
    let html = `<h2>Graanhandel</h2>
      <p class="muted">Silo: ${AT.fmtTons(G().siloUsed())} / ${G().siloCapacity()} t. Prijzen veranderen elke dag en per seizoen: in de oogsttijd is het goedkoop, een half jaar later duur. Bewaren kan dus lonen!</p>
      <div class="market-list">`;
    const entries = Object.entries(D.crops).filter(([, c]) => c.basePrice > 0)
      .sort(([a], [b]) => s.silo[b] - s.silo[a]);
    for (const [key, c] of entries) {
      const stock = s.silo[key];
      const sf = AT.weather.priceFactor(key);
      const seasonTag = sf > 1 ? '<span class="tag up">duur</span>' : sf < 1 ? '<span class="tag down">oogsttijd</span>' : '';
      html += `<div class="mrow ${stock < 0.05 ? 'empty' : ''}">
        <span class="dot" style="background:${c.color}"></span>
        <span class="grow"><b>${c.name}</b> ${seasonTag}<br><span class="muted">${stock >= 0.05 ? AT.fmtTons(stock) + ' · ≈ ' + AT.fmtMoney(stock * G().cropPrice(key)) : 'geen voorraad'}</span></span>
        ${sparkline(s.market[key].history)}
        <span class="price">${AT.fmtMoney(G().cropPrice(key))}/t ${trendOf(s.market[key])}</span>
        <button class="btn small primary" data-action="sell" data-crop="${key}" ${stock < 0.05 ? 'disabled' : ''}>Verkoop</button>
      </div>`;
    }
    html += `</div>`;
    html += `<h3>Producten</h3>`;
    let any = false;
    for (const [key, d] of Object.entries(D.products)) {
      const st = s.goods[key];
      if (st < 0.01 && !s.market[key]) continue;
      if (st < 0.01) continue;
      any = true;
      const m = s.market[key];
      html += `<div class="card">
        <div class="row"><b class="grow">${d.name}</b>${sparkline(m.history)} <span class="price">${AT.fmtPrice(key)}/${d.unit} ${trendOf(m)}</span></div>
        <div class="row"><span class="grow muted">Voorraad: ${AT.fmtAmount(st, key)} (≈ ${AT.fmtMoney(st * G().price(key))})</span>
          <button class="btn small primary" data-action="sellGood" data-good="${key}">Verkoop alles</button></div>
      </div>`;
    }
    if (!any) html += `<p class="muted">Nog geen producten. Bouw stallen en fabrieken in de tab Bedrijf.</p>`;
    return html;
  }

  // ---------- Bedrijf: dieren & fabrieken ----------
  const recipe = obj => Object.entries(obj).map(([k, v]) => `${AT.fmtAmount(v, k)} ${AT.farm.goodName(k)}`).join(' + ');

  function renderFarm(s) {
    let html = `<h2>Bedrijf</h2><p class="muted">Dieren eten graan uit je silo. Fabrieken maken van je oogst iets dat meer waard is.</p><h3>Dieren</h3>`;
    for (const [key, d] of Object.entries(D.animals)) {
      const a = s.animals[key];
      const prod = Object.entries(d.produce).map(([k, v]) => `${AT.fmtAmount(v, k)} ${AT.farm.goodName(k)}`).join(', ');
      if (!a.owned) {
        html += `<div class="card"><div class="row"><b class="grow">${d.building}</b>
          <button class="btn small primary" data-action="buyBuilding" data-key="${key}" ${s.money < d.buildPrice ? 'disabled' : ''}>Bouw ${AT.fmtMoney(d.buildPrice)}</button></div>
          <div class="muted">Plek voor ${d.capacity} ${d.name.toLowerCase()} · per ${d.one} per dag: ${prod}</div></div>`;
        continue;
      }
      const fi = AT.farm.feedInfo(key);
      const fedPct = Math.round(a.fed * 100);
      const days = fi.days === Infinity ? '—' : fi.days > 99 ? '99+' : fi.days.toFixed(1).replace('.', ',');
      html += `<div class="card"><div class="row"><b class="grow">${d.building}: ${a.count}/${d.capacity} ${d.name.toLowerCase()}</b>
          <button class="btn small" data-action="look-farm" data-key="${key}">Zoek</button></div>
        <div class="muted">Per ${d.one} per dag: ${prod} · eet ${AT.fmtNum(d.feedPerDay * 1000, d.feedPerDay < 0.01 ? 1 : 0)} kg ${d.feeds.map(k => D.crops[k].name.toLowerCase()).join('/')}</div>
        <div class="row"><span class="grow">Gevoerd</span><span class="${fedPct < 60 ? 'warn' : ''}">${fedPct}%</span></div>
        <div class="bar"><div class="fill grow" style="width:${fedPct}%"></div></div>
        <div class="muted">${a.count ? `Voer nodig: ${AT.fmtTons(fi.perDay)}/dag · silo genoeg voor ${days} dagen` : 'Nog geen dieren.'}</div>
        <div class="row wrap">
          <button class="btn small primary" data-action="buyAnimals" data-key="${key}" data-n="1" ${s.money < d.price || a.count >= d.capacity ? 'disabled' : ''}>+1 (${AT.fmtMoney(d.price)})</button>
          <button class="btn small primary" data-action="buyAnimals" data-key="${key}" data-n="10" ${s.money < d.price * 10 || a.count >= d.capacity ? 'disabled' : ''}>+10</button>
          <button class="btn small" data-action="sellAnimals" data-key="${key}" data-n="1" ${a.count ? '' : 'disabled'}>Verkoop 1</button>
        </div></div>`;
    }
    html += `<h3>Fabrieken</h3>`;
    for (const [key, d] of Object.entries(D.factories)) {
      const f = s.factories[key];
      const line = AT.farm.recipes(key).map(r => `${recipe(r.in)} → ${recipe(r.out)}`).join('<br>of ');
      if (!f.owned) {
        html += `<div class="card"><div class="row"><b class="grow">${d.name}</b>
          <button class="btn small primary" data-action="buyFactory" data-key="${key}" ${s.money < d.price ? 'disabled' : ''}>Bouw ${AT.fmtMoney(d.price)}</button></div>
          <div class="muted">${line} · max ${d.batchesPerDay}× per dag</div></div>`;
        continue;
      }
      html += `<div class="card"><div class="row"><b class="grow">${d.name}</b>
          <button class="btn small" data-action="look-factory" data-key="${key}">Zoek</button>
          <button class="btn small ${f.on ? '' : 'primary'}" data-action="toggleFactory" data-key="${key}">${f.on ? 'Zet uit' : 'Zet aan'}</button></div>
        <div class="muted">${line} · max ${d.batchesPerDay}× per dag · €${d.costPerBatch} energie per keer</div>
        <div class="${f.running ? '' : 'warn'}">Status: ${esc(f.status || 'start op')}</div></div>`;
    }
    html += `<h3>Opslag</h3><div class="card">`;
    const stocked = Object.entries(D.products).filter(([k]) => s.goods[k] > 0.01);
    html += stocked.length ? stocked.map(([k, d]) => `<div class="row"><span class="grow">${d.name}</span><span>${AT.fmtAmount(s.goods[k], k)}</span></div>`).join('') : '<span class="muted">Leeg</span>';
    html += `</div>`;
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
      WASD / pijltjes: lopen of rijden<br>Spatie: werktuig omlaag/omhoog · C: zaaigoed wisselen<br>
      E: in-/uitstappen · F: werktuig aan-/afkoppelen · Shift: rennen<br>Scroll: zoomen · Slepen: rondkijken<br>P: pauze · 1 / 2 / 3: snelheid
    </div>
    <button class="btn danger" data-action="reset">Nieuw spel starten</button>`;
    return html;
  }

  const TABS = { field: renderField, garage: renderGarage, shop: renderShop, farm: renderFarm, market: renderMarket, goals: renderGoals };

  function renderPanel() {
    const s = AT.state;
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
    const el = $('#tab-content'), scroll = el.scrollTop;
    el.innerHTML = TABS[activeTab](s);
    el.scrollTop = scroll;
    const next = D.goals.find(g => !s.goalsDone[g.id]);
    $('#goal').innerHTML = next ? `🎯 ${esc(next.text)}` : '🏆 Alle doelen behaald!';
    renderForecast();
    updateLive();
  }

  function renderForecast() {
    const fc = AT.weather.forecast(3);
    $('#forecast').innerHTML = '<span class="muted">Verwachting:</span> ' + fc.map(d => {
      const w = D.weatherTypes[d.type];
      return `<span class="fc" title="Dag ${d.day}: ${w.name} (${D.seasons[d.season].name})">Dag ${d.day} ${w.icon}</span>`;
    }).join('') + '<button class="btn small" data-open="calendar" title="Wanneer zaai je wat?">📅 Zaaikalender</button>';
  }

  // zaaikalender: welke gewassen wanneer
  function renderCalendar() {
    const now = AT.weather.month();
    let html = `<div class="modal-card"><div class="row"><h2 class="grow">📅 Zaaikalender</h2><button class="btn small" data-close>Sluiten</button></div>
      <p class="muted">Groen = zaaimaand. Een maand duurt ${D.daysPerMonth} dagen. In de winter groeit bijna niets, behalve winterharde gewassen.
      Rijpe gewassen die te lang blijven staan verwelken.</p>
      <table class="cal"><thead><tr><th></th>${D.months.map((m, i) => `<th class="${i === now ? 'now' : ''} ${i >= 9 || i === 11 ? 'winter' : ''}">${m.slice(0, 3)}</th>`).join('')}<th>Groei</th><th>Opbrengst</th><th>Bijzonder</th></tr></thead><tbody>`;
    for (const [key, c] of Object.entries(D.crops)) {
      html += `<tr><td><span class="dot" style="background:${c.color}"></span> ${c.name}</td>`;
      for (let m = 0; m < 12; m++) html += `<td class="${c.sow.includes(m) ? 'sow' : ''} ${m === now ? 'now' : ''}"></td>`;
      const value = c.yieldPerHa * c.basePrice - c.seedCostPerHa;
      html += `<td>${c.growDays} d</td><td>${c.yieldPerHa ? '±' + AT.fmtMoney(value) + '/ha' : '—'}</td><td class="muted">${cropTraits(c).join(', ') || '—'}</td></tr>`;
    }
    html += `</tbody></table></div>`;
    $('#modal').innerHTML = html;
    $('#modal').hidden = false;
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
    const W = AT.weather, se = D.seasons[W.season()];
    $('#clock').textContent = `${se.icon} ${W.monthName()} dag ${W.dayInMonth()} · ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    $('#clock').title = `${se.name}, jaar ${W.year()}`;
    const wt = D.weatherTypes[s.weather ? s.weather.type : 'sun'];
    $('#weather').textContent = `${wt.icon} ${W.temperature()}°C${W.drought() ? ' · droog!' : ''}`;
    $('#weather').title = `${wt.name} · bodemvocht ${Math.round((s.weather ? s.weather.moisture : 0.6) * 100)}% · jaar ${W.year()}`;
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
      case 'findMachine': {
        const m = G().machine(Number(a.uid));
        if (m) { const t = m.attached ? G().machine(m.attached) : m; AT.render.centerOn(t.busy === 'player' ? AT.state.player.x : t.x, t.busy === 'player' ? AT.state.player.y : t.y); }
        break;
      }
      case 'exit': G().exitVehicle(); break;
      case 'sellGood': G().sellGood(a.good); break;
      case 'buyBuilding': AT.farm.buyBuilding(a.key); break;
      case 'buyAnimals': AT.farm.buyAnimals(a.key, Number(a.n)); break;
      case 'sellAnimals': AT.farm.sellAnimals(a.key, Number(a.n)); break;
      case 'buyFactory': AT.farm.buyFactory(a.key); break;
      case 'toggleFactory': AT.farm.toggleFactory(a.key); break;
      case 'look-farm': { const r = D.animals[a.key].pen; AT.render.centerOn(r.x + r.w / 2, r.y + r.h / 2); break; }
      case 'look-factory': { const r = D.factories[a.key].lot; AT.render.centerOn(r.x + r.w / 2, r.y + r.h / 2); break; }
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
          const w = AT.render.minimapToWorld(p.x, p.y); AT.render.centerOn(w.x, w.y);
          drag.moved = true;
        } else if (Math.abs(p.x - drag.sx) + Math.abs(p.y - drag.sy) > 4) {
          drag.moved = true;
          AT.render.cam.free = true;
          AT.render.cam.x = drag.cx - (p.x - drag.sx) / AT.render.cam.zoom;
          AT.render.cam.y = drag.cy - (p.y - drag.sy) / AT.render.cam.zoom;
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
        AT.render.centerOn(w.x, w.y);
        const id = AT.render.fieldAt(w.x, w.y);
        if (id) selectField(id);
        return;
      }
      const w = AT.render.screenToWorld(p.x, p.y);
      const id = AT.render.fieldAt(w.x, w.y);
      if (id) return selectField(id);
      if (AT.render.buildingAt(w.x, w.y)) { activeTab = 'farm'; renderPanel(); return; }
      const Y = D.yard;
      if (w.x >= Y.x && w.x <= Y.x + Y.w && w.y >= Y.y && w.y <= Y.y + Y.h) {
        activeTab = w.y > D.hall.y ? 'garage' : w.x > D.house.x + D.house.w ? 'market' : 'goals';
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
    document.addEventListener('click', e => {
      if (e.target.closest('[data-open="calendar"]')) renderCalendar();
      if (e.target.closest('[data-close]') || e.target.id === 'modal') $('#modal').hidden = true;
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#modal').hidden = true; });

    document.addEventListener('keydown', e => {
      if (e.target.closest && e.target.closest('input, select, textarea')) return;
      if (e.repeat) return;
      if (e.code === 'KeyP') setSpeed('pause');
      if (e.code === 'Digit1') setSpeed('1');
      if (e.code === 'Digit2') setSpeed('2');
      if (e.code === 'Digit3') setSpeed('4');
    });

    AT.on('change', renderPanel);
    AT.on('newday', () => { if (activeTab === 'market' || activeTab === 'farm') renderPanel(); else renderForecast(); });
    AT.on('weather', renderForecast);
    AT.on('log', renderLog);
    renderPanel();
    renderLog();
  }

  AT.ui = { init, updateLive, renderPanel, renderLog };
})();
