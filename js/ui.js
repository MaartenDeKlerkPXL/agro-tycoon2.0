// Agro Tycoon 2.0 — HTML-interface (zijpaneel, topbalk, logboek) + muis op de kaart
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const G = () => AT.game;
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let activeTab = 'field';

  const JOB_NAMES = { plow: 'Ploegen', sow: 'Zaaien', harvest: 'Oogsten', fertilize: 'Kunstmest strooien', manure: 'Mest uitrijden', mow: 'Maaien', ted: 'Schudden', bale: 'Hooi persen', lime: 'Kalk strooien', spray: 'Spuiten', roll: 'Rollen', stones: 'Stenen rapen' };
  const KIND_NAMES = { tractor: 'Tractor', plow: 'Ploeg', seeder: 'Zaaimachine', harvester: 'Maaidorser', spreader: 'Kunstmeststrooier', manure: 'Mestverspreider', mower: 'Maaier', tedder: 'Schudder', baler: 'Balenpers', truck: 'Vrachtwagen', trailer: 'Aanhanger', lime: 'Kalkstrooier', sprayer: 'Spuitmachine', cultivator: 'Cultivator', roller: 'Rol', stonepicker: 'Stenenraper', fruitharvester: 'Fruitoogstmachine', mixer: 'Voermengwagen' };
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
    if (c.harvester === 'potato') t.push('pootmachine + aardappelrooier nodig');
    if (c.harvester === 'beet') t.push('bietenzaaier + bietenrooier nodig');
    if (c.perennial) t.push('grasland: maaien, schudden, hooi persen; groeit vanzelf weer aan');
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
      const rent = G().leaseRent(id);
      html += `<p>Dit veld is te koop of te pacht.</p>
        <div class="row wrap"><button class="btn primary" data-action="buyField" data-id="${id}" ${s.money < price ? 'disabled' : ''}>
          Koop veld voor ${AT.fmtMoney(price)}</button>
        <button class="btn" data-action="leaseField" data-id="${id}" ${s.money < rent ? 'disabled' : ''}>Pacht voor ${AT.fmtMoney(rent)}/dag</button></div>
        <p class="muted">Pachten is goedkoop om mee te beginnen, maar je betaalt elke dag. Je kunt een gepacht veld later alsnog kopen.</p>`;
    } else {
      if (f.leased) html += `<div class="card row small"><span class="grow">📜 Gepacht: ${AT.fmtMoney(G().leaseRent(id))} per dag</span>
        <button class="btn small primary" data-action="buyField" data-id="${id}" ${s.money < G().fieldPrice(id) ? 'disabled' : ''}>Koop ${AT.fmtMoney(G().fieldPrice(id))}</button>
        <button class="btn small" data-action="endLease" data-id="${id}" ${f.job ? 'disabled' : ''}>Stop pacht</button></div>`;
      html += `<div data-live="fieldsum">${fieldSummaryHtml(f)}</div>`;
      const sum = G().summary(f);
      const bales = s.bales.filter(b => b.field === f.id);
      if (bales.length) html += `<div class="card row"><span class="grow"><b>${bales.length} hooibalen</b> liggen op dit veld. Haal ze op met tractor + kipper (eroverheen rijden).</span>
        <button class="btn small" data-action="collectBales" data-id="${f.id}">Laat ophalen ${AT.fmtMoney(bales.length * D.baleCollectCost)}</button></div>`;
      html += soilHtml(f, sum);
      if (f.job) {
        const machines = s.machines.filter(m => f.job.machines.includes(m.uid)).map(m => D.machines[m.type].name).join(' + ');
        html += `<div class="card"><b>${esc(f.job.workerName || 'Loonwerker')}: ${JOB_NAMES[f.job.type]}${f.job.phase === 'to' ? ' (onderweg)' : ''}</b>
          <div class="bar"><div class="fill job" data-live="jobbar"></div></div>
          <div class="muted"><span data-live="jobpct"></span> · ${esc(machines)}</div></div>`;
        html += autoCard(f) + fieldQueue(f);
      } else {
        html += selfHelp(sum);
        html += autoCard(f);
        html += fieldQueue(f);
        html += `<h3>Of: opdracht geven aan je personeel</h3><p class="muted">Opdrachten gaan in de wachtrij (tab Team). Een vrije werknemer rijdt met jouw machines naar het veld.${s.staff && s.staff.allowExternal ? ` Is niemand vrij, dan komt een loonwerker (+${AT.fmtMoney(D.workerWagePerHour)}/u).` : ''}</p>`;
        if (sum.stubble) html += workerButton(s, f, 'plow', 'Laat ploegen');
        if (sum.readyCrops.grass) html += workerButton(s, f, 'mow', 'Laat maaien');
        if (sum.needTed) html += workerButton(s, f, 'ted', 'Laat schudden (sneller droog)');
        if (sum.dryHay) html += workerButton(s, f, 'bale', `Laat hooi persen (±${AT.fmtTons(sum.hayTons)})`);
        if (sum.grass && !sum.mown && !sum.readyCrops.grass) html += `<p class="muted">Grasland: het gras groeit weer aan. Wil je iets anders zaaien? <button class="btn small" data-action="plowGrass" data-id="${f.id}">Gras omploegen</button></p>`;
        if (sum.plowed) html += cropChoice(s, f, def, sum);
        const rc = G().mainCrop({ crops: sum.readyCrops });
        if (sum.ready - (sum.readyCrops.grass || 0) > 0 && rc && !D.crops[rc].greenManure && !D.crops[rc].perennial) html += workerButton(s, f, 'harvest', `Laat oogsten (±${AT.fmtTons(sum.readyTons)})`);
        if (sum.clover && sum.stubble === 0) html += workerButton(s, f, 'plow', 'Laat klaver onderploegen');
        if (sum.needFert && G().bestRig('fertilize', f.id)) html += workerButton(s, f, 'fertilize', 'Laat kunstmest strooien');
        if (sum.needManure && G().bestRig('manure', f.id)) html += workerButton(s, f, 'manure', 'Laat mest uitrijden');
        if (sum.needLime && (f.ph ?? 7) < 6.6 && hasKind(s, 'lime')) html += workerButton(s, f, 'lime', `Laat kalk strooien (${AT.fmtMoney(D.limeCostPerHa)}/ha)`);
        if (sum.needSpray && hasKind(s, 'sprayer')) html += workerButton(s, f, 'spray', `Laat spuiten (${AT.fmtMoney(D.sprayCostPerHa)}/ha)`);
        if (sum.needRoll && hasKind(s, 'roller')) html += workerButton(s, f, 'roll', 'Laat rollen');
        if (sum.stones && hasKind(s, 'stonepicker')) html += workerButton(s, f, 'stones', 'Laat stenen rapen');
        if (!sum.stubble && !sum.plowed && !sum.ready && !sum.mown) html += `<p class="muted">Niets te doen: het gewas groeit.</p>`;
      }
    }

    html += `<h3>Alle velden</h3><div class="field-list">`;
    for (const fd of D.fields) {
      const ff = G().field(fd.id);
      let st = 'Te koop';
      if (ff.owned) {
        const sm = G().summary(ff);
        st = ff.job ? JOB_NAMES[ff.job.type] + '…' : sm.mown ? (sm.dryHay ? 'Hooi droog!' : 'Hooi droogt') : sm.ready && !sm.growing ? 'Rijp!' : sm.growing ? (D.crops[G().mainCrop(sm)].name + ' groeit') :
          sm.plowed > sm.stubble ? 'Geploegd' : 'Stoppel';
        if (ff.leased) st += ' · pacht';
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
    const ph = f.ph ?? D.soilPh.start, phF = G().phFactor(f);
    if (ph < D.soilPh.good) tips.push(`De bodem is te <b>zuur</b> (pH ${AT.fmtNum(ph, 1)}): −${Math.round((1 - phF) * 100)}% opbrengst. Strooi <b>kalk</b> met een kalkstrooier.`);
    if (sum.stones > sum.total * 0.05) tips.push(`<b>Stenen</b> op ${pct(sum.stones, sum.total)}%: −${Math.round((1 - D.stoneYield) * 100)}% opbrengst daar en slijtage aan de maaidorser. Raap ze met een <b>stenenraper</b>.`);
    if (sum.compact > sum.total * 0.05) tips.push(`<b>${pct(sum.compact, sum.total)}% verdicht</b> door rijden op natte grond: −15% op die plekken. Ploegen maakt het weer los.`);
    if (AT.weather.drought() && !f.irrigated) tips.push('<b>Droogte</b>: tragere groei en minder opbrengst. Irrigatie helpt.');
    const phPct = Math.max(0, Math.min(100, (ph - 4.5) / 3 * 100));
    const phCol = ph >= D.soilPh.good ? '#4caf50' : ph >= 5.7 ? '#e0b84c' : '#d9534f';
    const irrCost = D.irrigation.pricePerHa * G().fieldDef(f.id).ha;
    return `<div class="card soil">
      <div class="row"><b class="grow">Bodemkwaliteit</b><span>${soilPct}%</span></div>
      <div class="bar"><div class="fill" style="width:${soilPct}%;background:${col}"></div></div>
      <div class="row"><b class="grow">Zuurgraad (pH)</b><span>${AT.fmtNum(ph, 1)}${ph >= D.soilPh.good ? ' · goed' : ' · te zuur'}</span></div>
      <div class="bar"><div class="fill" style="width:${phPct}%;background:${phCol}"></div></div>
      <div class="muted">Kunstmest op ${pct(sum.fert, sum.total)}% · mest op ${pct(sum.manure, sum.total)}%${sum.avgFactor ? ` · opbrengst ×${sum.avgFactor.toFixed(2).replace('.', ',')}` : ''}</div>
      ${tips.length ? `<ul class="tips">${tips.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}
      <div class="row small">${f.irrigated ? `<span class="grow">💧 Irrigatie aanwezig${AT.weather.drought() ? ' · <b>sproeit nu</b>' : ''}</span>`
        : `<span class="grow muted">💧 Irrigatie: geen last van droogte</span><button class="btn small" data-action="irrigate" data-id="${f.id}" ${AT.state.money < irrCost ? 'disabled' : ''}>Aanleggen ${AT.fmtMoney(irrCost)}</button>`}</div>
    </div>${healthHtml(f, sum)}`;
  }

  // onkruid, ziekte en plagen
  function healthHtml(f, sum) {
    if (!sum.growing && !sum.ready && !(f.weeds > 0.05)) return '';
    const bar = (label, v, hint) => {
      const p = Math.round(v * 100), c = v > D.pests.warnAt ? '#d9534f' : v > 0.15 ? '#e0b84c' : '#4caf50';
      return `<div class="row"><span class="grow">${label} <span class="muted">${hint}</span></span><span>${p}%</span></div><div class="bar thin"><div class="fill" style="width:${p}%;background:${c}"></div></div>`;
    };
    return `<div class="card soil"><b>Gewasgezondheid</b>
      ${bar('Onkruid', f.weeds || 0, 'groeit vooral in de lente')}
      ${bar('Ziekte', f.disease || 0, 'schimmel bij nat weer')}
      ${bar('Plagen', f.pests || 0, 'insecten bij warm, droog weer')}
      <div class="muted">${f.pestLoss > 0.005 ? `Al <b>−${Math.round(f.pestLoss * 100)}%</b> opbrengst verloren. ` : ''}${sum.sprayed ? `Gespoten: ${pct(sum.sprayed, sum.total)}% (beschermt tot de oogst).` : 'Spuiten haalt alles weg en beschermt tot de oogst.'}</div></div>`;
  }

  // uitleg om het zelf te doen, afhankelijk van wat er op het veld moet gebeuren
  function selfHelp(sum) {
    let step = '';
    const readyCrop = G().mainCrop({ crops: sum.readyCrops });
    if (sum.dryHay) step = 'Het hooi is droog. Koppel de <b>balenpers</b> aan je tractor (F) en rij over de zwaden.';
    else if (sum.mown) step = 'Het gras droogt' + (AT.weather.isWet() ? ' (nu heel langzaam: het regent)' : '') + '. Met de <b>schudder</b> gaat het sneller; daarna pers je het met de <b>balenpers</b>. Zelf persen geeft balen op het veld: haal ze op met een kipper.';
    else if (sum.ready && readyCrop === 'grass') step = 'Het gras is lang genoeg. Koppel de <b>maaier</b> aan je tractor (F), rij hierheen en zet hem omlaag (spatie).';
    else if (sum.ready && readyCrop && D.crops[readyCrop].greenManure) step = `De <b>klaver</b> is volgroeid. Ploeg hem onder met je <b>ploeg</b>: dat maakt de bodem veel beter.`;
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

  // automatisch beheer van een veld
  function autoCard(f) {
    const a = f.auto || { on: false, crop: 'rotate', fert: false };
    const opts = [['rotate', 'Wisselbouw (automatisch het beste gewas)'], ...Object.entries(D.crops).map(([k, c]) => [k, c.name])];
    return `<div class="card auto ${a.on ? 'on' : ''}">
      <label class="row"><input type="checkbox" data-auto="on" data-id="${f.id}" ${a.on ? 'checked' : ''}> <b class="grow">🤖 Automatisch beheer</b></label>
      <p class="muted">Je personeel ploegt, zaait en oogst dit veld steeds opnieuw.${a.on && a.status ? ' Nu: ' + esc(a.status) + '.' : ''}</p>
      <div class="row wrap">
        <select data-auto="crop" data-id="${f.id}">${opts.map(([k, n]) => `<option value="${k}" ${a.crop === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <label><input type="checkbox" data-auto="fert" data-id="${f.id}" ${a.fert ? 'checked' : ''}> kunstmest voor het zaaien</label>
        <label><input type="checkbox" data-auto="manure" data-id="${f.id}" ${a.manure ? 'checked' : ''}> mest uitrijden voor het zaaien (als er genoeg mest is)</label>
      </div></div>`;
  }

  function fieldQueue(f) {
    const q = (AT.state.queue || []).filter(t => t.fieldId === f.id);
    if (!q.length) return '';
    return `<div class="card"><b>In de wachtrij</b>${q.map(t => `<div class="row qrow"><span class="grow">${esc(AT.staff.TASK_LABEL(t.task, t.crop))}${t.auto ? ' 🤖' : ''}<br><span class="muted">${esc(t.status)}</span></span>
      <button class="btn small" data-action="unqueue" data-q="${t.id}" title="Verwijderen">✕</button></div>`).join('')}</div>`;
  }

  const hasKind = (s, kind) => s.machines.some(m => D.machines[m.type].kind === kind);

  function workerButton(s, f, task, label) {
    const rig = G().bestRig(task, f.id);
    const missing = !rig && !s.machines.some(m => {
      const k = D.machines[m.type].kind;
      return task === 'harvest' ? k === 'harvester' : k === ({ plow: 'plow', fertilize: 'spreader', manure: 'manure', lime: 'lime', spray: 'sprayer', mow: 'mower', ted: 'tedder', bale: 'baler', roll: 'roller', stones: 'stonepicker' }[task]) || (task === 'plow' && k === 'cultivator');
    });
    if (missing) return `<p class="warn">${esc(G().missingFor(task, f.id))}</p>`;
    const info = rig ? `${esc(rig.machines.map(m => D.machines[m.type].name).join(' + '))}<div class="muted">±${AT.fmtHours(rig.hours)} · brandstof ±${AT.fmtMoney(rig.hours * rig.fuelPerHour * D.fuelPrice)}</div>` : `<span class="muted">${esc(G().missingFor(task, f.id))}: wacht in de rij</span>`;
    return `<div class="card row"><div class="grow">${info}</div>
      <button class="btn small primary" data-action="job" data-task="${task}" data-id="${f.id}">${label}</button></div>`;
  }

  function cropChoice(s, f, def, sum) {
    const rig = G().bestRig('sow', f.id);
    if (!rig && !s.machines.some(m => D.machines[m.type].kind === 'seeder')) return `<p class="warn">${esc(G().missingFor('sow'))}</p>`;
    const planters = new Set(s.machines.map(m => D.machines[m.type].sows).filter(Boolean));
    const ha = def.ha * sum.plowed / sum.total;
    let html = `<div class="card"><b>Laat zaaien</b> <span class="muted">· ${rig ? esc(rig.machines.map(m => D.machines[m.type].name).join(' + ')) + ' · ±' + AT.fmtHours(rig.hours) : 'zaaimachine nu bezet, wacht in de rij'}</span>`;
    const entries = Object.entries(D.crops).sort(([a], [b]) => G().canSowNow(b) - G().canSowNow(a));
    for (const [key, c] of entries) {
      const cost = (rig ? rig.hours * rig.fuelPerHour * D.fuelPrice : 0) + c.seedCostPerHa * ha;
      const hasPlanter = planters.has(c.planter || 'seeder');
      const ok = G().canSowNow(key) && hasPlanter;
      const note = !hasPlanter ? `${G().PLANTER_NAMES[c.planter]} nodig` : !G().canSowNow(key) ? 'zaaien: ' + monthRanges(c.sow) : AT.fmtMoney(cost);
      html += `<div class="row crop-row ${ok ? '' : 'off'}"><span class="dot" style="background:${c.color}"></span>
        <span class="grow">${c.name} <span class="muted">${c.growDays} d · ${note}</span></span>
        <button class="btn small primary" data-action="sow" data-crop="${key}" data-id="${f.id}" ${!ok ? 'disabled' : ''}>Zaai</button></div>`;
    }
    return html + '</div>';
  }

  // ---------- Garage ----------
  const thumbImg = type => `<img class="thumb" src="${AT.sprites.thumb(type)}" alt="">`;

  function whereIs(m) {
    if (m.busy === 'player') return 'jij rijdt hiermee';
    if (m.busy === 'trip') return 'werknemer rijdt terug naar het erf';
    if (m.busy) { const j = G().field(m.busy).job; return `${j ? j.workerName : 'werknemer'} op Veld ${m.busy}`; }
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
      const cap = G().fuelCap(r.main), fuel = G().fuelOf(r.main), fp = cap ? Math.round(fuel / cap * 100) : 0;
      if (cap) html += `<div class="row small"><span class="grow">⛽ Diesel ${Math.round(fuel)} / ${cap} L</span><span class="${fp < 15 ? 'warn' : ''}">${fp}%</span></div>
        <div class="bar thin"><div class="fill" style="width:${fp}%;background:${fp < 15 ? '#d9534f' : '#e0b84c'}"></div></div>`;
      html += `<div class="row wrap"><button class="btn" data-action="exit">Uitstappen (E)</button>
        ${cap && fp < 99 ? `<button class="btn small" data-action="fuelService" data-uid="${r.main.uid}">Tankservice (${AT.fmtMoney(D.fuelService)} + diesel)</button>` : ''}
        ${r.mainDef.kind === 'harvester' ? `<button class="btn small ${AT.staff.playerChaser() ? '' : 'primary'}" data-action="chaser">${AT.staff.playerChaser() ? `Chauffeur naar huis (${AT.keys.name('chaser')})` : `🚜 Chauffeur met kipper (${AT.keys.name('chaser')})`}</button>` : ''}</div></div>`;
    }
    html += `<div class="card howto"><b>Zo werkt het</b><ul>
      <li><b>WASD</b>: lopen of rijden · <b>Shift</b>: sneller lopen · in een voertuig 50 km/u</li>
      <li><b>E</b>: in- of uitstappen (loop tot vlak bij de machine)</li>
      <li><b>F</b>: werktuig aan- of afkoppelen (rij achteruit tegen ploeg, zaaimachine of strooier)</li>
      <li><b>Spatie</b>: werktuig omlaag/omhoog · <b>C</b>: zaaigoed wisselen</li>
      <li><b>U</b>: lossen. Maaidorser → aanhanger (losbuis zit links), aanhanger → stortput bij de silo, een verkooppunt, de voerbak of de stortplaats van je eigen fabriek (+10%)</li>
      <li><b>T</b>: tanken bij de rode dieselpomp op het erf · <b>G</b>: GPS aan/uit (als ingebouwd)</li>
      <li><b>K</b>: in de maaidorser een chauffeur met kipper roepen: hij rijdt naast je, de maaidorser lost tijdens het rijden en hij brengt het graan naar de silo</li>
      <li>Je botst tegen gebouwen, hekken en bomen. Over akkers en gras rij je langzamer dan over de weg (rupsen minder).</li>
    </ul></div>`;

    html += `<h3>Jouw machines</h3>`;
    const order = ['tractor', 'harvester', 'fruitharvester', 'truck', 'trailer', 'mixer', 'plow', 'cultivator', 'roller', 'stonepicker', 'seeder', 'spreader', 'manure', 'lime', 'sprayer', 'mower', 'tedder', 'baler'];
    // (rooiers vallen onder 'harvester')
    const sorted = [...s.machines].sort((a, b) => order.indexOf(D.machines[a.type].kind) - order.indexOf(D.machines[b.type].kind));
    for (const m of sorted) {
      const d = D.machines[m.type];
      const value = Math.round(d.price * 0.6);
      const sellable = !m.busy && !(m.attached && G().machine(m.attached).busy);
      const wear = Math.round((m.wear || 0) * 100), cap = G().fuelCap(m);
      const info = [esc(whereIs(m))];
      if (m.load && m.load.tons > 0.01) info.push(`geladen: ${AT.fmtTons(m.load.tons)} ${G().goodName(m.load.crop)}`);
      if (cap) info.push(`diesel ${Math.round(G().fuelOf(m) / cap * 100)}%`);
      info.push(m.broken ? '<b class="warn">KAPOT</b>' : `slijtage <span class="${wear > 70 ? 'warn' : ''}">${wear}%</span>`);
      if (m.gps) info.push('GPS');
      if (m.rented) info.push(`gehuurd · ${AT.fmtMoney(G().rentPrice(m.type))}/dag`);
      const canGps = (d.kind === 'tractor' || d.kind === 'harvester') && !m.gps && !m.rented;
      const fixable = (m.wear || 0) > 0.05 || m.broken;
      html += `<div class="card row">${thumbImg(m.type)}
        <div class="grow"><b>${esc(d.name)}</b><div class="muted">${info.join(' · ')}</div>
          <div class="row wrap">
            ${fixable ? `<button class="btn small ${m.broken || wear > 70 ? 'primary' : ''}" data-action="repair" data-uid="${m.uid}" ${m.busy && m.busy !== 'player' ? 'disabled' : ''} title="${G().atYard(m) ? 'In de werkplaats op het erf' : 'Monteur komt naar je toe (voorrijkosten)'}">Repareer ${AT.fmtMoney(G().repairCost(m))}</button>` : ''}
            ${canGps ? `<button class="btn small" data-action="gps" data-uid="${m.uid}" ${s.money < D.gpsPrice ? 'disabled' : ''}>GPS ${AT.fmtMoney(D.gpsPrice)}</button>` : ''}
            ${cap && G().fuelOf(m) < cap * 0.5 && !m.busy ? `<button class="btn small" data-action="fuelService" data-uid="${m.uid}">Tankservice</button>` : ''}
          </div></div>
        <div class="col">
          <button class="btn small" data-action="findMachine" data-uid="${m.uid}">Zoek</button>
          ${m.rented ? `<button class="btn small" data-action="returnMachine" data-uid="${m.uid}" ${m.busy ? 'disabled' : ''}>Terugbrengen</button>`
            : `<button class="btn small" data-action="sellMachine" data-uid="${m.uid}" ${sellable ? '' : 'disabled'} title="Verkoop voor 60% van de nieuwprijs">${AT.fmtMoney(value)}</button>`}
        </div></div>`;
    }
    return html;
  }

  // ---------- Winkel ----------
  function machineSpecs(d) {
    if (d.kind === 'tractor') return `${d.power.toFixed(1)}× vermogen · ${d.speed} km/u · ${d.fuelPerHour} L/u${d.tracks ? ' · rupsen: geen bodemverdichting, sneller op de akker' : ''}${d.old ? ' · goedkoop, trager werk, slijt sneller' : ''}`;
    if (d.kind === 'fruitharvester') return `${d.speed} km/u · oogst de ${D.plantations[d.harvests].name.toLowerCase()} (rijd langs de ${D.plantations[d.harvests].plants}, oogstkop omlaag). Werknemers oogsten ermee voor ${AT.fmtMoney(D.plantations[d.harvests].machineCost)} per ${D.plantations[d.harvests].plant} i.p.v. ${AT.fmtMoney(D.plantations[d.harvests].pickCost)}`;
    if (d.kind === 'mixer') return `${d.capacity} t · mengt bij de silo kuilvoer/hooi + graan + soja tot mengvoer (+30% productie) en lost in de voerbak`;
    if (d.kind === 'cultivator') return `${d.width} m breed · sneller dan ploegen, maar geen gras omwerken en minder diep (verdichting blijft)`;
    if (d.kind === 'roller') return `${d.width} m breed · na het zaaien rollen: +${Math.round((D.rollBonus - 1) * 100)}% opbrengst`;
    if (d.kind === 'stonepicker') return `${d.width} m breed · raapt stenen (stenen kosten ${Math.round((1 - D.stoneYield) * 100)}% opbrengst en slijten de maaidorser)`;
    if (d.kind === 'trailer') return `${d.capacity} t graan, voer of hooibalen · vereist ${d.minPower >= 3 ? '300 pk' : d.minPower >= 2 ? '150+ pk' : '75+ pk'}`;
    if (d.kind === 'harvester') {
      const what = Object.values(D.crops).filter(c => c.harvester === d.harvests).map(c => c.name.toLowerCase());
      return `${d.width} m breed · bunker ${d.tank} t · oogst: ${what.length > 4 ? 'granen, maïs, koolzaad, zonnebloem, soja, bonen' : what.join(', ')}`;
    }
    if (d.kind === 'truck') return `${d.pallets} pallets · ${d.speed} km/u · laden bij het laadperron`;
    if (d.kind === 'mower') return `${d.width} m breed · gras maaien`;
    if (d.kind === 'tedder') return `${d.width} m breed · hooi droogt sneller`;
    if (d.kind === 'baler') return `pers droog gras tot hooi`;
    if (d.kind === 'seeder' && d.sows !== 'seeder') return `${d.width} m breed · zaait ${d.sows === 'potato' ? 'aardappelen' : 'suikerbieten'}`;
    if (d.kind === 'spreader') return `${d.width} m breed · +25% opbrengst · ${AT.fmtMoney(D.fertCostPerHa)}/ha`;
    if (d.kind === 'manure') return `${d.width} m breed · betere bodem · ${D.manurePerHa} t mest/ha`;
    if (d.kind === 'lime') return `${d.width} m breed · pH omhoog (minder zuur) · ${AT.fmtMoney(D.limeCostPerHa)}/ha`;
    if (d.kind === 'sprayer') return `${d.width} m breed · tegen onkruid, ziektes en plagen · ${AT.fmtMoney(D.sprayCostPerHa)}/ha`;
    return `${d.width} m breed · ${d.workSpeed} km/u · vereist ${d.minPower >= 2 ? '150+ pk' : '75+ pk'}`;
  }

  function renderShop(s) {
    let html = `<h2>Winkel</h2>`;
    html += `<p class="muted">Kopen of huren: huren kost ${Math.round(D.rentPerDay * 100 * 10) / 10}% van de prijs per dag. Breng een gehuurde machine terug in de Garage.</p>`;
    const fr = G().fair();
    if (fr.active) {
      html += `<div class="card fair"><b>🎪 Landbouwbeurs: nu ${Math.round(D.fair.discount * 100)}% korting op alle machines!</b>
        <div>Beursaanbiedingen: ${Object.entries(fr.deals).map(([k, v]) => `<b>${esc(D.machines[k].name)}</b> −${Math.round(v * 100)}%`).join(' · ')}</div>
        <div class="muted">${fr.visited ? `✓ Je bent langs geweest: nog eens ${Math.round(D.fair.visitBonus * 100)}% extra korting.` : `Ga zelf naar de beurs op de kade bij de haven voor nog eens ${Math.round(D.fair.visitBonus * 100)}% extra korting.`} De beurs duurt tot het eind van november.</div>
        <button class="btn small" data-action="look-fair">Zoek de beurs</button></div>`;
    } else {
      const dd = G().daysToFair();
      html += `<div class="muted">🎪 Volgende landbouwbeurs (november, bij de haven): over ${dd} ${dd === 1 ? 'dag' : 'dagen'}. Dan zijn alle machines minstens ${Math.round(D.fair.discount * 100)}% goedkoper.</div>`;
    }
    const groups = [['tractor', 'Tractoren'], ['trailer', 'Aanhangers'], ['truck', 'Vrachtwagens'], ['plow', 'Grondbewerking'], ['cultivator', ''], ['roller', ''], ['stonepicker', ''], ['seeder', 'Zaaimachines'], ['spreader', 'Bemesting en bodem'], ['manure', ''], ['lime', ''], ['sprayer', 'Gewasbescherming'], ['mower', 'Grasland'], ['tedder', ''], ['baler', ''], ['harvester', 'Oogstmachines'], ['fruitharvester', 'Fruit en druiven'], ['mixer', 'Dieren']];
    for (const [kind, title] of groups) {
      if (title) html += `<h3>${title}</h3>`;
      for (const [key, d] of Object.entries(D.machines)) {
        if (d.kind !== kind) continue;
        const owned = s.machines.filter(m => m.type === key).length;
        html += `<div class="card row">${thumbImg(key)}
          <div class="grow"><b>${esc(d.name)}</b>${owned ? ` <span class="badge">${owned}×</span>` : ''}<div class="muted">${machineSpecs(d)}</div></div>
          <div class="col">${G().fairDiscount(key) ? `<span class="fair-price"><s>${AT.fmtMoney(d.price)}</s> −${Math.round(G().fairDiscount(key) * 100)}%</span>` : ''}<button class="btn small primary" data-action="buyMachine" data-type="${key}" ${s.money < G().machinePrice(key) ? 'disabled' : ''}>${AT.fmtMoney(G().machinePrice(key))}</button>
          <button class="btn small" data-action="rentMachine" data-type="${key}" ${s.money < G().rentPrice(key) ? 'disabled' : ''} title="Huren per dag">Huur ${AT.fmtMoney(G().rentPrice(key))}/d</button></div></div>`;
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

  const goodName = k => (D.crops[k] || D.products[k]).name;
  const bestMonth = k => { let best = 0; for (let m = 1; m < 12; m++) if (AT.weather.monthFactor(k, m) > AT.weather.monthFactor(k, best)) best = m; return best; };

  function renderMarket(s) {
    if (!s.contracts.offers.length) G().refreshOffers();
    let html = `<h2>Markt</h2>
      <div class="row wrap"><button class="btn small primary" data-open="prices">📈 Prijskalender: wanneer verkopen?</button></div>
      <p class="muted">Silo: ${AT.fmtTons(G().siloUsed())} / ${G().siloCapacity()} t · opslagloods: ${AT.fmtNum(G().palletsUsed(), 0)} / ${G().warehouseCapacity()} pallets.
      Laten ophalen kost ${Math.round(D.pickupFee * 100)}%; zelf brengen met aanhanger of vrachtwagen (U bij een verkooppunt) geeft de volle prijs. Veel tegelijk verkopen drukt de prijs even.</p>`;

    // contracten
    const C = s.contracts;
    html += `<h3>Contracten</h3>`;
    for (const c of C.active) {
      const have = G().stock(c.key);
      html += `<div class="card contract active"><div class="row"><b class="grow">📜 ${AT.fmtAmount(c.amount, c.key)} ${goodName(c.key).toLowerCase()}</b><span class="badge">vóór dag ${c.deadline}</span></div>
        <div class="bar"><div class="fill job" style="width:${c.delivered / c.amount * 100}%"></div></div>
        <div class="muted">${AT.fmtAmount(c.delivered, c.key)} geleverd · ${AT.fmtPrice2(c.pricePer, c.key)} + bonus ${AT.fmtMoney(c.bonus)} · te laat = boete ${Math.round(D.contracts.fine * 100)}%</div>
        <div class="row"><span class="grow muted">Leveren: breng het naar een verkooppunt (U), of uit je voorraad (${AT.fmtAmount(have, c.key)}).</span>
        <button class="btn small primary" data-action="deliver" data-c="${c.id}" ${have < 0.01 ? 'disabled' : ''}>Lever uit voorraad</button></div></div>`;
    }
    for (const o of C.offers) {
      const normal = G().price(o.key);
      html += `<div class="card contract"><div class="row"><b class="grow">${AT.fmtAmount(o.amount, o.key)} ${goodName(o.key).toLowerCase()} in ${o.days} dagen</b>
        <button class="btn small primary" data-action="acceptContract" data-c="${o.id}">Aannemen</button></div>
        <div class="muted">${AT.fmtPrice2(o.pricePer, o.key)} (nu ${AT.fmtPrice2(normal, o.key)}) + bonus ${AT.fmtMoney(o.bonus)} · totaal ±${AT.fmtMoney(o.amount * o.pricePer + o.bonus)}</div></div>`;
    }
    html += `<p class="muted">Elke ${D.contracts.refreshDays} dagen nieuwe aanbiedingen.</p>`;

    // gewassen
    html += `<h3>Gewassen <span class="muted">(prijs bij de graanhandel)</span></h3><div class="market-list">`;
    const entries = Object.entries(D.crops).filter(([, c]) => c.basePrice > 0).sort(([a], [b]) => s.silo[b] - s.silo[a]);
    for (const [key, c] of entries) html += marketRow(s, key, c.color, s.silo[key], 'sell');
    html += `</div><h3>Producten</h3><div class="market-list">`;
    const prods = Object.entries(D.products).filter(([k]) => s.goods[k] > 0.01 && k !== 'manure');
    for (const [key] of prods) html += marketRow(s, key, null, s.goods[key], 'sellGood');
    if (!prods.length) html += `<p class="muted">Nog geen producten. Bouw stallen, kassen en fabrieken in de tab Bedrijf.</p>`;
    html += `</div>`;

    // verkooppunten
    html += `<h3>Verkooppunten</h3>`;
    for (const [id, sp] of Object.entries(D.sellPoints)) {
      const extras = Object.entries(sp.mult).map(([k, v]) => `${goodName(k).toLowerCase()} +${Math.round((v - 1) * 100)}%`).join(', ');
      const what = sp.only ? sp.only.map(k => goodName(k).toLowerCase()).join(', ') : sp.kind === 'crops' ? 'alle gewassen' : 'alle producten';
      html += `<div class="card"><div class="row"><b class="grow">${sp.name}</b><button class="btn small" data-action="look-sp" data-sp="${id}">Zoek</button></div>
        <div class="muted">Koopt: ${what}${extras ? `<br>Betaalt extra: ${extras}` : ''}</div></div>`;
    }
    return html;
  }

  function marketRow(s, key, color, stock, action) {
    const m = s.market[key];
    const sf = AT.weather.priceFactor(key);
    const tags = [sf > 1.03 ? '<span class="tag up">duur</span>' : sf < 0.97 ? '<span class="tag down">goedkoop</span>' : '',
      m.sat > 0.02 ? `<span class="tag down" title="Je hebt hier veel van verkocht">verzadigd −${Math.round(m.sat * 100)}%</span>` : ''].join(' ');
    const unit = D.crops[key] ? 't' : D.products[key].unit;
    return `<div class="mrow2 ${stock < 0.05 ? 'empty' : ''}">
      <div class="row">${color ? `<span class="dot" style="background:${color}"></span>` : ''}<b class="grow">${goodName(key)} ${tags}</b>
        ${sparkline(m.history)}<span class="price">${AT.fmtPrice2(G().price(key), key)}/${unit} ${trendOf(m)}</span></div>
      <div class="row"><span class="grow muted">${stock >= 0.05 ? AT.fmtAmount(stock, key) + ' · ≈ ' + AT.fmtMoney(stock * G().price(key)) : 'geen voorraad'} · beste maand: ${D.months[bestMonth(key)].toLowerCase()}</span>
        <button class="btn small primary" data-action="${action}" data-crop="${key}" data-good="${key}" ${stock < 0.05 ? 'disabled' : ''} title="Laten ophalen: −${Math.round(D.pickupFee * 100)}%">Laat ophalen</button></div>
    </div>`;
  }

  // ---------- prijskalender (heatmap: goedkoop ↔ duur per maand) ----------
  // diverging: rood = goedkoop, grijs = gemiddeld, blauw = duur (goed moment om te verkopen)
  const DIV = { mid: [240, 239, 236], low: [[247, 200, 199], [235, 128, 126], [210, 70, 69]], high: [[205, 226, 251], [109, 167, 236], [37, 106, 191]] };
  function divColor(v) { // v in −1..1
    const arm = v < 0 ? DIV.low : DIV.high, t = Math.min(1, Math.abs(v));
    const stops = [DIV.mid, ...arm], pos = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(pos)), f = pos - i;
    const c = stops[i].map((x, k) => Math.round(x + (stops[i + 1][k] - x) * f));
    return { bg: `rgb(${c.join(',')})`, ink: t > 0.7 ? '#ffffff' : '#0b0b0b' };
  }

  function renderPriceCalendar() {
    const now = AT.weather.month();
    const keys = [...Object.keys(D.crops).filter(k => D.crops[k].basePrice > 0 && D.crops[k].cheapMonth != null),
      ...Object.keys(D.products).filter(k => D.products[k].cheapMonth != null)];
    let html = `<div class="modal-card"><div class="row"><h2 class="grow">📈 Prijskalender</h2><button class="btn small" data-close>Sluiten</button></div>
      <p class="muted">Gemiddelde prijs per maand ten opzichte van het jaargemiddelde. In de oogstmaand is het aanbod groot en de prijs laag; een half jaar later is het duur.
      Bovenop deze lijn schommelt de prijs elke dag een beetje. Een maand duurt ${D.daysPerMonth} dagen.</p>
      <div class="legend-bar"><span>goedkoop</span><span class="grad"></span><span>duur (verkopen!)</span></div>
      <table class="cal heat"><thead><tr><th>Gewas</th>${D.months.map((m, i) => `<th class="${i === now ? 'now' : ''}">${m.slice(0, 3)}</th>`).join('')}<th>Nu</th><th>Beste maand</th></tr></thead><tbody>`;
    for (const k of keys) {
      const base = (D.crops[k] || D.products[k]).basePrice, unit = D.crops[k] ? 't' : D.products[k].unit;
      html += `<tr><th class="rowh">${goodName(k)}</th>`;
      for (let m = 0; m < 12; m++) {
        const f = AT.weather.monthFactor(k, m), v = (f - 1) / D.seasonPrice, col = divColor(v);
        const pct = Math.round((f - 1) * 100);
        html += `<td class="${m === now ? 'now' : ''}" style="background:${col.bg};color:${col.ink}" title="${goodName(k)} in ${D.months[m].toLowerCase()}: ±${AT.fmtPrice2(base * f, k)}/${unit} (${pct > 0 ? '+' : ''}${pct}%)">${pct > 0 ? '+' : ''}${pct}%</td>`;
      }
      html += `<td>${AT.fmtPrice2(G().price(k), k)}/${unit}</td><td><b>${D.months[bestMonth(k)]}</b></td></tr>`;
    }
    html += `</tbody></table></div>`;
    $('#modal').innerHTML = html;
    $('#modal').hidden = false;
  }

  // ---------- Geld: financieel overzicht, bank ----------
  const CAT_NAMES = { gewassen: 'Gewassen', producten: 'Producten', contracten: 'Contracten', doelen: 'Beloningen', dieren: 'Dieren', 'machines verkocht': 'Machines verkocht',
    zaaigoed: 'Zaaigoed', brandstof: 'Brandstof', kunstmest: 'Kunstmest', lonen: 'Lonen', loonwerk: 'Loonwerk', energie: 'Energie', machines: 'Machines', land: 'Land',
    gebouwen: 'Gebouwen', rente: 'Rente', boetes: 'Boetes', kalk: 'Kalk', gewasbescherming: 'Gewasbescherming', water: 'Irrigatiewater',
    pacht: 'Pacht', verzekering: 'Verzekering', uitkering: 'Verzekering (uitkering)', dierenarts: 'Dierenarts', voer: 'Voer', overig: 'Overig' };

  function financeChart(ledger) {
    const days = ledger.slice(-14);
    if (!days.length) return '<p class="muted">Nog geen gegevens.</p>';
    const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
    const data = days.map(d => ({ day: d.day, inc: sum(d.income), exp: sum(d.expense) }));
    const max = Math.max(1000, ...data.map(d => Math.max(d.inc, d.exp)));
    const step = Math.pow(10, Math.floor(Math.log10(max))) * (max / Math.pow(10, Math.floor(Math.log10(max))) > 5 ? 2 : 1);
    const top = Math.ceil(max / step) * step;
    const W = 340, H = 150, padL = 40, padB = 18, plotW = W - padL - 4, plotH = H - padB - 6;
    const gw = plotW / 14, bw = Math.max(3, (gw - 6) / 2);
    const y = v => 6 + plotH - v / top * plotH;
    const bar = (x, v, color) => {
      const h = Math.max(0, v / top * plotH), r = Math.min(4, bw / 2, h);
      if (h <= 0) return '';
      // bovenkant afgerond, onderkant vlak op de as
      return `<path d="M${x},${6 + plotH} v${-(h - r)} q0,${-r} ${r},${-r} h${bw - 2 * r} q${r},0 ${r},${r} v${h - r} z" fill="${color}"/>`;
    };
    let svg = `<svg class="fin-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Inkomsten en uitgaven per dag">`;
    for (let v = 0; v <= top; v += step) {
      svg += `<line x1="${padL}" x2="${W - 4}" y1="${y(v)}" y2="${y(v)}" stroke="#e6e2d8" stroke-width="1"/>`;
      svg += `<text x="${padL - 4}" y="${y(v) + 3}" text-anchor="end" class="ax">${v >= 1000 ? Math.round(v / 1000) + 'k' : v}</text>`;
    }
    data.forEach((d, i) => {
      const x0 = padL + i * gw + 3;
      svg += `<g class="hit"><title>Dag ${d.day}: +${AT.fmtMoney(d.inc)} / −${AT.fmtMoney(d.exp)} = ${AT.fmtMoney(d.inc - d.exp)}</title>
        <rect x="${x0 - 2}" y="6" width="${gw - 2}" height="${plotH}" fill="transparent"/>
        ${bar(x0, d.inc, '#2a78d6')}${bar(x0 + bw + 2, d.exp, '#eb6834')}</g>`;
      if (i % 2 === 0 || data.length < 8) svg += `<text x="${x0 + bw}" y="${H - 4}" text-anchor="middle" class="ax">${d.day}</text>`;
    });
    svg += `</svg>`;
    return `<div class="legend"><span><i style="background:#2a78d6"></i>Inkomsten</span><span><i style="background:#eb6834"></i>Uitgaven</span><span class="muted">per dag · beweeg over een staaf</span></div>${svg}`;
  }

  function renderMoney(s) {
    const L = s.ledger || [];
    const today = L[L.length - 1] || { income: {}, expense: {} };
    const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
    const week = L.slice(-7);
    const wIn = week.reduce((a, d) => a + sum(d.income), 0), wOut = week.reduce((a, d) => a + sum(d.expense), 0);
    let html = `<h2>Geld</h2>
      <div class="tiles">
        <div class="tile"><small>Op de bank</small><b>${AT.fmtMoney(s.money)}</b></div>
        <div class="tile"><small>Laatste 7 dagen</small><b class="${wIn - wOut >= 0 ? 'up' : 'down'}">${wIn - wOut >= 0 ? '+' : '−'}${AT.fmtMoney(Math.abs(wIn - wOut))}</b></div>
        <div class="tile"><small>Lening</small><b>${AT.fmtMoney(s.loan)}</b></div>
      </div>
      <h3>Inkomsten en uitgaven</h3>${financeChart(L)}
      <h3>Vandaag per categorie</h3><table class="ledger"><tbody>`;
    const rows = [...Object.entries(today.income).map(([k, v]) => [k, v]), ...Object.entries(today.expense).map(([k, v]) => [k, -v])].sort((a, b) => b[1] - a[1]);
    html += rows.length ? rows.map(([k, v]) => `<tr><td>${CAT_NAMES[k] || k}</td><td class="${v >= 0 ? 'up' : 'down'}">${v >= 0 ? '+' : '−'}${AT.fmtMoney(Math.abs(v))}</td></tr>`).join('') : '<tr><td class="muted">Nog niets vandaag.</td></tr>';
    html += `</tbody></table>`;
    // bank
    const max = G().maxLoan();
    html += `<h3>Bank</h3><div class="card">
      <div class="row"><span class="grow">Lening</span><b>${AT.fmtMoney(s.loan)} / ${AT.fmtMoney(max)}</b></div>
      <div class="muted">Rente ${(D.bank.ratePerDay * 100).toFixed(1).replace('.', ',')}% per dag${s.loan ? ` (nu ${AT.fmtMoney(s.loan * D.bank.ratePerDay)}/dag)` : ''}. Hoeveel je mag lenen hangt af van je land en machines.</div>
      <div class="row wrap">${D.bank.steps.map(v => `<button class="btn small primary" data-action="borrow" data-v="${v}" ${s.loan + v > max ? 'disabled' : ''}>Leen ${AT.fmtMoney(v)}</button>`).join('')}</div>
      <div class="row wrap"><button class="btn small" data-action="repay" data-v="10000" ${s.loan < 1 ? 'disabled' : ''}>Los €10.000 af</button>
      <button class="btn small" data-action="repay" ${s.loan < 1 ? 'disabled' : ''}>Alles aflossen</button></div></div>`;
    // verzekering en pacht
    const ins = s.insurance || {}, leased = s.fields.filter(f => f.leased);
    html += `<h3>Verzekering en pacht</h3><div class="card">
      <div class="row"><span class="grow"><b>Oogstverzekering</b><br><span class="muted">${ins.crops ? `${AT.fmtMoney(G().insurancePremium())} per dag · al uitgekeerd: ${AT.fmtMoney(ins.paidOut || 0)}` : `${AT.fmtMoney(D.insurance.premiumPerHa)} per ha per dag (nu ${AT.fmtMoney(G().insurancePremium())}/dag)`}. Vergoedt ${Math.round(D.insurance.cover * 100)}% van storm- en vorstschade.</span></span>
        <button class="btn small ${ins.crops ? '' : 'primary'}" data-action="insurance">${ins.crops ? 'Opzeggen' : 'Afsluiten'}</button></div>
      <div class="muted">${leased.length ? `Gepachte velden: ${leased.map(f => 'Veld ' + f.id).join(', ')} · samen ${AT.fmtMoney(leased.reduce((a, f) => a + G().leaseRent(f.id), 0))} per dag.` : 'Je pacht geen velden. Pachten kan in de tab Veld bij een veld dat te koop staat.'}</div></div>`;
    html += `<button class="btn" data-open="goals">🎯 Doelen en statistieken</button>`;
    return html;
  }

  // ---------- Team: personeel, wachtrij en automatisch beheer ----------
  const pctDelta = v => (v >= 1 ? '+' : '−') + Math.abs(Math.round((v - 1) * 100)) + '%';
  const STATUS = { idle: 'vrij', job: 'aan het werk', trip: 'onderweg' };

  function renderTeam(s) {
    AT.staff.ensure();
    const st = s.staff;
    let html = `<h2>Team</h2><p class="muted">Werknemers voeren opdrachten uit de wachtrij uit: ze rijden met jouw machines over de weg naar het veld en weer terug. Loon wordt elke dag betaald.</p>`;
    html += `<h3>Personeel (${st.employees.length}/${D.staff.max})</h3>`;
    if (!st.employees.length) html += `<p class="muted">Nog niemand in dienst. Kies hieronder een kandidaat.</p>`;
    for (const w of st.employees) {
      const job = w.status === 'job' && w.fieldId ? G().field(w.fieldId).job : null;
      const off = w.status === 'idle' ? AT.staff.offDuty(w) : null;
      const where = w.status === 'job' ? `${job && job.phase === 'to' ? 'onderweg naar' : job && job.phase === 'unload' ? 'lost in de silo voor' : 'werkt op'} Veld ${w.fieldId}` : w.status === 'trip' ? 'rijdt terug naar het erf' : w.status === 'delivery' ? 'levert met de vrachtwagen'
        : w.status === 'chaser' ? 'rijdt met de kipper naast een maaidorser' : w.status === 'feed' ? 'brengt voer naar de stal' : off ? off : 'vrij, klaar voor een klus';
      const en = Math.round((w.energy ?? 1) * 100);
      html += `<div class="card"><div class="row"><b class="grow">👷 ${esc(w.name)}</b><span class="badge">niveau ${AT.staff.level(w)}</span></div>
        <div class="muted">Snelheid ${pctDelta(AT.staff.workSpeed(w))} · brandstof ${pctDelta(w.fuel)} · ${AT.fmtMoney(w.salary)}/dag · vrij op ${AT.staff.dayName(w.freeDay)}</div>
        <div class="row small"><span class="grow">Energie${en < 30 ? ' · <b class="warn">moe</b> (werkt trager)' : ''}</span><span>${en}%</span></div>
        <div class="bar thin"><div class="fill" style="width:${en}%;background:${en > 60 ? '#4caf50' : en > 30 ? '#e0b84c' : '#d9534f'}"></div></div>
        <div class="row"><span class="grow ${w.status === 'idle' && !off ? '' : w.status === 'idle' ? 'muted' : 'up'}">${where}</span>
        <button class="btn small" data-action="fire" data-w="${w.id}" ${w.status === 'idle' ? '' : 'disabled'}>Ontslaan</button></div></div>`;
    }
    const hrs = st.hours || [6, 22];
    const hourOpts = (sel, from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i).map(h => `<option value="${h}" ${h === sel ? 'selected' : ''}>${h}:00</option>`).join('');
    html += `<div class="card"><b>Werktijden</b>
      <div class="row wrap small">van <select data-team="hour0">${hourOpts(hrs[0], 4, 10)}</select> tot <select data-team="hour1">${hourOpts(hrs[1], 16, 24)}</select>
        <label class="row small"><input type="checkbox" data-team="night" ${st.nightShift ? 'checked' : ''}> ook 's nachts (+40% loon)</label></div>
      <label class="row small"><input type="checkbox" data-team="carter" ${st.carter !== false ? 'checked' : ''}> <span class="grow">Bij het oogsten rijdt een tweede werknemer met tractor + kipper mee (anders rijdt de maaidorser zelf naar de silo als de bunker vol is)</span></label>
      <p class="muted">Werken maakt moe; wie moe is werkt trager en rust daarna uit. Iedereen heeft één vrije dag per week. Buiten werktijd beginnen ze geen nieuwe klus.</p></div>`;
    html += `<h3>Sollicitanten</h3>`;
    for (const c of st.candidates) {
      html += `<div class="card row"><div class="grow"><b>${esc(c.name)}</b>
        <div class="muted">Snelheid ${pctDelta(c.speed)} · brandstof ${pctDelta(c.fuel)} · ${AT.fmtMoney(c.salary)}/dag</div></div>
        <button class="btn small primary" data-action="hire" data-w="${c.id}" ${st.employees.length >= D.staff.max ? 'disabled' : ''}>Aannemen</button></div>`;
    }
    html += `<button class="btn small" data-action="newCandidates">Nieuwe sollicitanten (${AT.fmtMoney(D.staff.refreshCost)})</button>
      <p class="muted">Elke week komen er vanzelf nieuwe sollicitanten.</p>`;

    html += `<h3>Wachtrij (${s.queue.length})</h3>`;
    html += `<label class="row card"><input type="checkbox" data-team="external" ${st.allowExternal ? 'checked' : ''}>
      <span class="grow">Externe loonwerker inzetten als er geen personeel vrij is <span class="muted">(${AT.fmtMoney(D.workerWagePerHour)}/u)</span></span></label>`;
    if (!s.queue.length) html += `<p class="muted">Leeg. Geef opdrachten in de tab Veld, of zet velden op automatisch beheer.</p>`;
    s.queue.forEach((t, i) => {
      html += `<div class="card row qrow"><span class="grow"><b>Veld ${t.fieldId}</b>: ${esc(AT.staff.TASK_LABEL(t.task, t.crop))}${t.auto ? ' 🤖' : ''}<br><span class="muted">${esc(t.status)}</span></span>
        <button class="btn small" data-action="qup" data-q="${t.id}" ${i === 0 ? 'disabled' : ''} title="Eerder">▲</button>
        <button class="btn small" data-action="qdown" data-q="${t.id}" ${i === s.queue.length - 1 ? 'disabled' : ''} title="Later">▼</button>
        <button class="btn small" data-action="unqueue" data-q="${t.id}" title="Verwijderen">✕</button></div>`;
    });

    html += `<h3>Automatisch beheer</h3>`;
    const owned = s.fields.filter(f => f.owned);
    html += '<div class="field-list">' + owned.map(f => {
      const a = f.auto || {};
      const crop = !a.on ? '' : a.crop === 'rotate' ? 'wisselbouw' : D.crops[a.crop].name.toLowerCase();
      return `<button class="field-row ${a.on ? 'ready' : ''}" data-action="select" data-id="${f.id}"><span>Veld ${f.id}</span><span>${a.on ? '🤖 ' + crop + (a.status ? ' · ' + esc(a.status) : '') : 'handmatig'}</span></button>`;
    }).join('') + '</div>';
    return html;
  }

  // ---------- Bedrijf: dieren & fabrieken ----------
  const recipe = obj => Object.entries(obj).map(([k, v]) => `${AT.fmtAmount(v, k)} ${AT.farm.goodName(k)}`).join(' + ');

  // kippen: legnesten en eierband · schapen: vacht en scheren
  function animalExtra(key, d, a, s) {
    if (d.nest) {
      const cap = AT.farm.nestCap(key), n = Math.floor(a.nest), pct = Math.min(100, a.nest / cap * 100);
      if (a.eggBelt) return `<div class="muted">🥚 Eierband: de eieren rollen vanzelf naar de opslagloods.${AT.weather.season() === 3 ? ' In de winter leggen de kippen minder.' : ''}</div>`;
      return `<div class="row"><span class="grow">🥚 Legnesten${a.nestWarned ? ' · <b class="warn">vol!</b>' : ''}</span><span>${AT.fmtNum(n)} / ${AT.fmtNum(cap)} eieren</span></div>
        <div class="bar thin"><div class="fill" style="width:${pct}%;background:${pct > 90 ? '#d9534f' : '#e9d8a6'}"></div></div>
        <div class="row wrap"><button class="btn small" data-action="collectEggs" data-key="${key}" ${n ? '' : 'disabled'}>Laat rapen (${AT.fmtMoney(n * d.nest.collectCost)})</button>
          <button class="btn small primary" data-action="eggBelt" data-key="${key}" ${s.money < d.nest.beltPrice ? 'disabled' : ''}>Eierband ${AT.fmtMoney(d.nest.beltPrice)} (automatisch)</button></div>
        <div class="muted">Zelf rapen is gratis: loop naar het kippenhok en druk ${AT.keys.name('action')}. Zijn de nesten vol, dan gaan eieren verloren.</div>`;
    }
    if (d.fleece) {
      const f = d.fleece, avg = AT.farm.avgFleece(key), ready = AT.farm.woolReady(key), left = a.count - a.shorn;
      return `<div class="row"><span class="grow">🐑 Vacht${a.fleece > 0.85 && AT.weather.season() === 1 ? ' · <b class="warn">te warm!</b>' : ''}</span><span>${Math.round(avg * 100)}%</span></div>
        <div class="bar thin"><div class="fill" style="width:${Math.round(avg * 100)}%;background:#ece9df"></div></div>
        <div class="muted">${ready ? `Klaar om te scheren: ${left} schapen, ±${AT.fmtNum(ready)} kg wol` : `Vacht nog te kort (minstens ${Math.round(f.minShear * 100)}%)`}${a.shorn ? ` · ${a.shorn} al geschoren` : ''}. Een volle vacht groeit in ${f.growDays} dagen.</div>
        <div class="row wrap"><button class="btn small primary" data-action="shearAll" data-key="${key}" ${ready && s.money >= f.shearCost ? '' : 'disabled'}>Scheerder (${AT.fmtMoney(f.shearCost * left)})</button>
          <label class="row small"><input type="checkbox" data-ashear="${key}" ${a.autoShear ? 'checked' : ''}> automatisch laten scheren als de vacht vol is</label></div>
        <div class="muted">Zelf scheren is gratis: loop de wei in en druk ${AT.keys.name('action')} (${f.perPress} schapen per keer).</div>`;
    }
    return '';
  }

  function renderFarm(s) {
    let html = `<h2>Bedrijf</h2><p class="muted">Dieren eten uit hun voerbak of automatisch uit je silo/loods. Fabrieken maken van je oogst iets dat meer waard is.</p><h3>Dieren</h3>`;
    for (const [key, d] of Object.entries(D.animals)) {
      const a = AT.farm.animal(key), cap = AT.farm.capacity(key);
      const prod = [...(d.fleece ? [`±${AT.fmtNum(d.fleece.perAnimal / d.fleece.growDays)} kg wol (scheren)`] : []),
        ...Object.entries(d.produce).map(([k, v]) => `${D.products[k].unit === 't' && v < 0.1 ? AT.fmtNum(v * 1000) + ' kg' : AT.fmtAmount(v, k)} ${AT.farm.goodName(k)}`)].join(', ');
      if (!a.owned) {
        html += `<div class="card"><div class="row"><b class="grow">${d.building}</b>
          <button class="btn small primary" data-action="buyBuilding" data-key="${key}" ${s.money < d.buildPrice ? 'disabled' : ''}>Bouw ${AT.fmtMoney(d.buildPrice)}</button></div>
          <div class="muted">Plek voor ${d.capacity} ${d.name.toLowerCase()} · per ${d.one} per dag: ${prod} · verkoop ${AT.fmtMoney(d.sellPrice)} per ${d.one}</div></div>`;
        continue;
      }
      const fi = AT.farm.feedInfo(key);
      const fedPct = Math.round(a.fed * 100), hPct = Math.round(a.health * 100);
      const days = fi.days === Infinity ? '—' : fi.days > 99 ? '99+' : fi.days.toFixed(1).replace('.', ',');
      const troughCap = d.trough * D.barnLevels[a.level];
      const inTrough = Object.entries(a.trough).filter(([, v]) => v > 0.005).map(([k, v]) => `${AT.fmtTons(v)} ${G().goodName(k)}`).join(', ') || 'leeg';
      const nextLevel = a.level < D.barnLevels.length - 1;
      html += `<div class="card"><div class="row"><b class="grow">${d.building}: ${a.count}/${cap} ${d.name.toLowerCase()}</b>
          <button class="btn small" data-action="look-farm" data-key="${key}">Zoek</button></div>
        <div class="muted">Per ${d.one} per dag: ${prod} · eet ${AT.fmtNum(d.feedPerDay * 1000, d.feedPerDay < 0.01 ? 1 : 0)} kg ${d.feeds.map(k => G().goodName(k)).join('/')}</div>
        <div class="row"><span class="grow">Gevoerd${a.quality > 1.01 ? ` · voerkwaliteit ×${AT.fmtNum(a.quality, 2)}` : ''}</span><span class="${fedPct < 60 ? 'warn' : ''}">${fedPct}%</span></div>
        <div class="bar thin"><div class="fill grow" style="width:${fedPct}%"></div></div>
        <div class="row"><span class="grow">Gezondheid${a.sick ? ' · <b class="warn">ziek!</b>' : ''}</span><span class="${hPct < 60 ? 'warn' : ''}">${hPct}%</span></div>
        <div class="bar thin"><div class="fill" style="width:${hPct}%;background:${hPct > 70 ? '#4caf50' : hPct > 40 ? '#e0b84c' : '#d9534f'}"></div></div>
        <div class="muted">Voerbak: ${inTrough} (max ${AT.fmtTons(troughCap)}) · ${a.count ? `nodig ${AT.fmtTons(fi.perDay)}/dag · genoeg voor ${days} dagen` : 'nog geen dieren'}</div>
        <label class="row small"><input type="checkbox" data-afeed="${key}" ${a.autoFeed ? 'checked' : ''}> <span class="grow">Voerdienst: automatisch voeren uit silo/loods (+${AT.fmtMoney(D.feedServicePerTon)}/t). Uit = de voerbak vullen met een kipper (zelf met U, of door een werknemer).</span></label>
        <label class="row small"><input type="checkbox" data-wfeed="${key}" ${a.workerFeed ? 'checked' : ''}> <span class="grow">Een werknemer vult de voerbak met tractor + kipper als hij onder 35% komt</span></label>
        ${(s.feedRuns || []).filter(r => r.key === key).map(r => `<div class="muted">🚜 ${esc(r.workerName)} ${r.phase === 'load' ? 'haalt voer' : r.phase === 'deliver' ? 'brengt ' + G().goodName(r.feed) : 'rijdt terug'}</div>`).join('')}
        <div class="row wrap">
          <button class="btn small primary" data-action="buyAnimals" data-key="${key}" data-n="1" ${s.money < d.price || a.count >= cap ? 'disabled' : ''}>+1 (${AT.fmtMoney(d.price)})</button>
          <button class="btn small primary" data-action="buyAnimals" data-key="${key}" data-n="10" ${s.money < d.price * 10 || a.count >= cap ? 'disabled' : ''}>+10</button>
          <button class="btn small" data-action="sellAnimals" data-key="${key}" data-n="${key === 'chickens' ? 10 : 1}" ${a.count ? '' : 'disabled'}>Verkoop ${key === 'chickens' ? 10 : 1} (${AT.fmtMoney(d.sellPrice * (key === 'chickens' ? 10 : 1) * (0.5 + 0.5 * a.health))})</button>
          <button class="btn small" data-action="feedRun" data-key="${key}" ${(s.feedRuns || []).some(r => r.key === key) ? 'disabled' : ''}>Laat voerbak vullen</button>
          <button class="btn small ${a.sick || a.health < 0.7 ? 'primary' : ''}" data-action="vet" data-key="${key}" ${a.count && s.money >= AT.farm.vetCost(key) ? '' : 'disabled'}>Dierenarts ${AT.fmtMoney(AT.farm.vetCost(key))}</button>
          ${nextLevel ? `<button class="btn small" data-action="expandBarn" data-key="${key}" ${s.money < AT.farm.expandCost(key) ? 'disabled' : ''}>Stal uitbreiden → ${d.capacity * D.barnLevels[a.level + 1]} (${AT.fmtMoney(AT.farm.expandCost(key))})</button>` : ''}
        </div>
        ${animalExtra(key, d, a, s)}
        <div class="muted">Jongen: gezonde, goed gevoerde dieren krijgen ${d.young} als er plek is. Mengvoer en kuilvoer geven meer productie.${d.graze ? ` Buiten de winter grazen ze: ${Math.round(d.graze * 100)}% minder voer nodig.` : ''}</div></div>`;
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
        <div class="${f.running ? '' : 'warn'}">Status: ${esc(f.status || 'start op')}</div>
        ${AT.farm.recipes(key).some(r => Object.keys(r.in).some(g => AT.farm.factoryAccepts(key, g))) ? `<div class="muted">Stortplaats: ${Object.entries(AT.farm.buffer(key)).filter(([, v]) => v > 0.01).map(([k, v]) => `${AT.fmtTons(v)} ${G().goodName(k)}`).join(', ') || 'leeg'} · breng oogst met een kipper (U) voor ${Math.round((D.factoryBonus - 1) * 100)}% meer product</div>` : ''}</div>`;
    }
    // kassen
    html += `<h3>Kassen</h3><p class="muted">Het hele jaar groenten, fruit of bloemen. Omschakelen kost ${AT.fmtMoney(D.greenhouse.plantCost)} aan nieuwe planten. Meer kassen? Bouw ze zelf op de kaart (onderaan, Zelf bouwen).</p>`;
    AT.farm.allGreenhouses().forEach(({ g, id, name, lot, rect }) => {
      if (!g.owned) {
        html += `<div class="card row"><div class="grow"><b>${name}</b><div class="muted">Bouwplek bij het dorp · stookkosten hoger in de winter</div></div>
          <button class="btn small primary" data-action="buyGreenhouse" data-i="${lot}" ${s.money < D.greenhouse.price ? 'disabled' : ''}>Bouw ${AT.fmtMoney(D.greenhouse.price)}</button></div>`;
        return;
      }
      const r = AT.farm.ghRates(g), p = D.products[g.crop];
      const value = r.perDay * G().price(g.crop);
      html += `<div class="card"><div class="row"><b class="grow">${name}: ${p.name.toLowerCase()}</b><span class="muted">${esc(g.status || '')}</span>
          <button class="btn small" data-action="look-gh" data-x="${rect.x + rect.w / 2}" data-y="${rect.y + rect.h / 2}">Zoek</button></div>
        <div class="muted">Nu ${AT.fmtNum(r.perDay)} ${p.unit}/dag (±${AT.fmtMoney(value)}) · stookkosten ${AT.fmtMoney(r.energy)}/dag${g.ramp < 1 ? ` · aanloop ${Math.round(g.ramp * 100)}%` : ''}</div>
        <div class="row wrap">${Object.entries(D.greenhouse.crops).map(([k, c]) => `<button class="btn small ${g.crop === k ? 'primary' : ''}" data-action="ghCrop" data-gh="${id}" data-crop="${k}" title="±${AT.fmtMoney(c.perDay * G().price(k))}/dag">${D.products[k].name} (${c.perDay} ${D.products[k].unit}/dag)</button>`).join('')}</div>
        <div class="row wrap">${Object.entries(D.greenhouse.upgrades).map(([k, u]) => g.up[k] ? `<span class="badge" title="${u.desc}">✓ ${u.name}</span>`
          : `<button class="btn small" data-action="ghUp" data-gh="${id}" data-up="${k}" title="${u.desc}" ${s.money < u.price ? 'disabled' : ''}>${u.name} ${AT.fmtMoney(u.price)}</button>`).join('')}</div>
        <div class="muted">${Object.values(D.greenhouse.upgrades).map(u => `${u.name}: ${u.desc}`).join(' · ')}</div></div>`;
    });
    // boomgaard en wijngaard
    html += `<h3>Boomgaard en wijngaard</h3>`;
    for (const [key, d] of Object.entries(D.plantations)) {
      const pl = AT.farm.plantation(key), ripe = AT.farm.ripeCount(key);
      const months = d.harvest.map(m => D.months[m].toLowerCase()).join(', ');
      const yearly = pl.plants.length * d.perPlant;
      if (!pl.owned) {
        html += `<div class="card"><div class="row"><b class="grow">${d.name}</b>
          <button class="btn small primary" data-action="buyPlantation" data-key="${key}" ${s.money < d.price ? 'disabled' : ''}>Koop ${AT.fmtMoney(d.price)}</button></div>
          <div class="muted">${pl.plants.length} ${d.plants} · ±${AT.fmtAmount(yearly, d.product)} ${G().goodName(d.product)} per jaar · oogst in ${months}</div></div>`;
        continue;
      }
      const status = pl.phase === 'ripe' ? `<b>${ripe} ${ripe === 1 ? d.plant : d.plants} plukklaar</b>` : pl.phase === 'grow' ? 'vruchten groeien' : `rust tot de lente · oogst in ${months}`;
      html += `<div class="card"><div class="row"><b class="grow">${d.name}</b><button class="btn small" data-action="look-plant" data-key="${key}">Zoek</button>
          <button class="btn small primary" data-action="pickAll" data-key="${key}" ${ripe ? '' : 'disabled'}>${AT.farm.harvestMachine(key) ? `Laat oogsten met machine (${AT.fmtMoney(d.machineCost)}/${d.plant})` : `Plukkers (${AT.fmtMoney(d.pickCost)}/${d.plant})`}</button></div>
        <div class="muted">${status} · dit jaar geplukt: ${AT.fmtAmount(pl.pickedTotal || 0, d.product)}. Zelf plukken: loop erheen en druk H. Wat je niet plukt, rot na ${D.months[d.harvest[d.harvest.length - 1]].toLowerCase()}.</div></div>`;
    }
    // hooibalen
    if (s.bales.length) {
      const t = s.bales.reduce((a, b) => a + b.t, 0);
      html += `<h3>Hooibalen</h3><div class="card"><div class="row"><span class="grow">${s.bales.length} balen op het veld (${AT.fmtTons(t)})</span>
        <button class="btn small primary" data-action="collectBales">Laat ophalen (${AT.fmtMoney(D.baleCollectCost)}/baal)</button></div>
        <div class="muted">Of haal ze zelf: tractor + kipper over de balen rijden, daarna lossen (U) bij de stortput (opslagloods) of het veevoerbedrijf.</div></div>`;
    }
    // bos
    const wl = AT.farm.woodlot();
    const readyTrees = wl.trees.filter(t => t.growth >= 0.95).length;
    html += `<h3>Bosperceel</h3><div class="card">`;
    if (!wl.owned) html += `<div class="row"><span class="grow">${wl.trees.length} bomen · hout voor de zagerij</span><button class="btn small primary" data-action="buyWoodlot" ${s.money < D.woodlot.price ? 'disabled' : ''}>Koop ${AT.fmtMoney(D.woodlot.price)}</button></div>`;
    else html += `<div class="row"><span class="grow">${readyTrees} van ${wl.trees.length} bomen kapklaar</span><button class="btn small" data-action="look-wood">Zoek</button>
      <button class="btn small primary" data-action="cutAll" ${readyTrees ? '' : 'disabled'}>Laat kappen (${AT.fmtMoney(D.woodlot.cutCost)}/boom)</button></div>
      <div class="muted">Zelf kappen: loop naar een boom en druk H. Er groeit vanzelf een nieuwe boom (${D.woodlot.growDays} dagen, niet in de winter).</div>`;
    html += `</div>`;
    // zelf bouwen
    html += `<h3>Zelf bouwen</h3><p class="muted">Kies een gebouw en klik op de kaart waar het moet komen (op gras, niet op akkers of wegen). Esc of rechtsklik = annuleren. Handig bij verre velden zoals de Oostpolder.</p>`;
    for (const [type, d] of Object.entries(D.buildables)) {
      const n = G().builtOf(type).length, placing = AT.render.view.placing && AT.render.view.placing.type === type;
      html += `<div class="card row"><div class="grow"><b>${d.name}</b>${n ? ` <span class="badge">${n}×</span>` : ''}<div class="muted">${d.desc}</div></div>
        <button class="btn small ${placing ? '' : 'primary'}" data-action="place" data-type="${type}" ${s.money < d.price ? 'disabled' : ''}>${placing ? 'Klik op de kaart…' : 'Plaats ' + AT.fmtMoney(d.price)}</button></div>`;
    }
    if ((s.buildings || []).length) html += `<div class="card">${s.buildings.map(b => `<div class="row"><span class="grow">${D.buildables[b.type].name}</span>
      <button class="btn small" data-action="look-built" data-x="${b.x}" data-y="${b.y}">Zoek</button>
      <button class="btn small" data-action="demolish" data-b="${b.id}">Afbreken (+${AT.fmtMoney(D.buildables[b.type].price / 2)})</button></div>`).join('')}</div>`;
    // opslagloods
    const nextW = D.warehouse[(s.warehouseLevel || 0) + 1];
    html += `<h3>Opslagloods</h3><div class="card"><div class="row"><span class="grow">${AT.fmtNum(G().palletsUsed(), 1)} / ${G().warehouseCapacity()} pallets</span>
      ${nextW ? `<button class="btn small primary" data-action="upgradeWarehouse" ${s.money < nextW.price ? 'disabled' : ''}>Uitbreiden naar ${nextW.pallets} (${AT.fmtMoney(nextW.price)})</button>` : ''}</div>
      <div class="bar"><div class="fill" style="width:${Math.min(100, G().palletsUsed() / G().warehouseCapacity() * 100)}%;background:${G().palletsUsed() / G().warehouseCapacity() > 0.9 ? '#d03b3b' : '#7fb24a'}"></div></div>
      <div class="muted">Vol = productie gaat verloren. Laad een vrachtwagen bij het laadperron (U) en breng het naar de supermarkt, of laat een werknemer leveren.</div>
      ${s.machines.some(m => D.machines[m.type].kind === 'truck') ? `<div class="row wrap"><button class="btn small primary" data-action="deliver-truck" ${(s.deliveries || []).length ? 'disabled' : ''}>🚚 Laat een werknemer leveren</button>
        <label class="row small"><input type="checkbox" data-action="autoDeliver" ${s.autoDeliver ? 'checked' : ''}> automatisch als de loods half vol is</label></div>
        ${(s.deliveries || []).map(dv => `<div class="muted">🚚 ${esc(dv.workerName)}: ${{ dock: 'naar het laadperron', sell: 'onderweg naar ' + (dv.sp ? D.sellPoints[dv.sp].name.toLowerCase() : ''), home: 'terug naar het erf' }[dv.phase]}</div>`).join('')}` : '<div class="muted">Koop een vrachtwagen (Winkel) om producten te laten leveren.</div>'}</div>`;
    html += `<h3>Voorraad</h3><div class="card">`;
    const stocked = Object.entries(D.products).filter(([k]) => s.goods[k] > 0.01);
    html += stocked.length ? stocked.map(([k, d]) => `<div class="row"><span class="grow">${d.name}</span><span>${AT.fmtAmount(s.goods[k], k)}</span></div>`).join('') : '<span class="muted">Leeg</span>';
    html += `</div>`;
    return html;
  }

  // ---------- Doelen ----------
  function renderGoals(s) {
    let html = `<div class="modal-card narrow"><div class="row"><h2 class="grow">🎯 Doelen</h2><button class="btn small" data-close>Sluiten</button></div><ul class="goals">`;
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
      ${AT.keys.ACTIONS.map(([a, label]) => `${AT.keys.name(a)}: ${label.toLowerCase()}`).join(' · ')}<br>Scroll: zoomen · Slepen: rondkijken · 1 / 2 / 3 / 4: snelheid · toetsen wijzigen via ⚙️
    </div>
    <div class="row wrap"><button class="btn" data-open="achievements">🏆 Prestaties</button><button class="btn danger" data-action="reset">Nieuw spel…</button></div></div>`;
    return html;
  }
  function openGoals() { $('#modal').innerHTML = renderGoals(AT.state); $('#modal').hidden = false; }

  const TABS = { field: renderField, garage: renderGarage, shop: renderShop, team: renderTeam, farm: renderFarm, market: renderMarket, money: renderMoney };

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
    }).join('') + '<button class="btn small" data-open="calendar" title="Wanneer zaai en oogst je wat, en wat levert het op?">📅 Zaai- en oogstkalender</button>';
  }

  // zaaikalender: wanneer zaaien, wanneer oogsten en wat het per maand opbrengt
  const kEuro = v => (Math.abs(v) >= 1000 ? '€' + (Math.round(v / 100) / 10).toLocaleString('nl-NL') + 'k' : '€' + Math.round(v));
  // opbrengst per ha als je in maand m oogst en meteen verkoopt (min zaaigoed)
  function harvestValue(key, m) {
    const c = D.crops[key];
    if (c.perennial) return c.yieldPerHa * D.products.hay.basePrice * AT.weather.monthFactor('hay', m);
    return c.yieldPerHa * c.basePrice * AT.weather.monthFactor(key, m) - c.seedCostPerHa;
  }
  function renderCalendar() {
    const now = AT.weather.month();
    let html = `<div class="modal-card"><div class="row"><h2 class="grow">📅 Zaai- en oogstkalender</h2><button class="btn small" data-close>Sluiten</button></div>
      <p class="muted">Een maand duurt ${D.daysPerMonth} dagen. Oogstmaanden gelden bij gemiddeld weer (regen = sneller, droogte = trager). In de winter groeit bijna niets, behalve winterharde gewassen.
      Het bedrag is de opbrengst per hectare als je in die maand oogst en meteen verkoopt (min zaaigoed, bij een gewone bodem). Bewaren tot een dure maand levert meer op (zie 📈 Prijskalender).</p>
      <p>🎪 <b>${D.months[D.fair.month]}: landbouwbeurs</b> bij de haven, met korting op alle machines${G().fairActive() ? ' (nu bezig!)' : ` (over ${G().daysToFair()} dagen)`}.</p>
      <div class="cal-legend"><span><i class="sw sow"></i> zaaien</span><span><i class="sw harvest"></i> oogsten (€ per ha)</span><span><i class="sw both"></i> allebei</span></div>
      <table class="cal crop-cal"><thead><tr><th></th>${D.months.map((m, i) => `<th class="${i === now ? 'now' : ''} ${i >= 9 ? 'winter' : ''}">${m.slice(0, 3)}</th>`).join('')}<th>Op het veld</th><th>Per maand</th><th>Bijzonder</th></tr></thead><tbody>`;
    for (const [key, c] of Object.entries(D.crops)) {
      const plan = AT.weather.harvestPlan(key), hv = new Set(plan.harvest);
      html += `<tr><td class="rowh"><span class="dot" style="background:${c.color}"></span> ${c.name}</td>`;
      let best = -Infinity;
      for (let m = 0; m < 12; m++) {
        const sow = c.sow.includes(m), har = hv.has(m);
        const cls = [sow && har ? 'both' : sow ? 'sow' : har ? 'harvest' : '', m === now ? 'now' : ''].join(' ');
        let text = '', title = `${c.name} in ${D.months[m].toLowerCase()}:`;
        if (sow) title += ' zaaien.';
        if (har) {
          const v = harvestValue(key, m); best = Math.max(best, v);
          text = kEuro(v);
          title += ` oogsten${c.perennial ? ' (maaien → hooi)' : ''}: ±${AT.fmtMoney(v)} per ha.`;
        }
        if (sow) {
          const bs = plan.bySow[m];
          if (bs) title += ` Gezaaid in ${D.months[m].toLowerCase()} → rijp in ${D.months[bs.ripe].toLowerCase()}.`;
        }
        html += `<td class="${cls}" title="${title}">${text}</td>`;
      }
      const months = plan.avgMonths;
      const perMonth = best > -Infinity && months > 0 ? best / Math.max(0.5, months) : null;
      html += `<td>${months ? '±' + months.toLocaleString('nl-NL', { maximumFractionDigits: 1 }) + ' mnd' : '—'}</td>
        <td>${perMonth != null ? '<b>' + AT.fmtMoney(perMonth) + '</b>/ha' : '—'}</td>
        <td class="muted">${cropTraits(c).join(', ') || '—'}</td></tr>`;
    }
    html += `</tbody></table>
      <p class="muted">“Per maand” = de beste opbrengst per ha gedeeld door de tijd dat het gewas op het veld staat. Snelle gewassen kun je vaker per jaar telen; trage gewassen leveren per keer meer op.</p></div>`;
    $('#modal').innerHTML = html;
    $('#modal').hidden = false;
  }

  // ---------- instellingen: opslaan, daglengte, toetsen, uitleg ----------
  const TIME_SCALES = [[4, 6], [2, 12], [1, 24], [0.5, 48]];   // [schaal, minuten per speldag bij 1×]
  let capture = null;   // actie waarvoor je net een nieuwe toets kiest
  function renderSettings() {
    const s = AT.state, ts = (s.settings && s.settings.timeScale) || 1;
    const fmtDate = t => t ? new Date(t).toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
    const slots = G().listSlots().map(({ n, info }) => `<div class="slot"><b>${n}</b><span class="grow">${info
      ? `${esc(info.name || 'Spel ' + n)}<br><span class="muted">dag ${info.day} · ${AT.fmtMoney(info.money)} · ${info.fields} velden · ${fmtDate(info.savedAt)}</span>`
      : '<span class="muted">leeg</span>'}</span>
      <button class="btn small primary" data-set="saveSlot" data-n="${n}">Opslaan</button>
      <button class="btn small" data-set="loadSlot" data-n="${n}" ${info ? '' : 'disabled'}>Laden</button>
      <button class="btn small" data-set="delSlot" data-n="${n}" ${info ? '' : 'disabled'} title="Wissen">✕</button></div>`).join('');
    const keys = AT.keys.ACTIONS.map(([a, label]) => `<tr><td>${label}</td><td><button class="keycap ${capture === a ? 'wait' : ''}" data-set="bind" data-a="${a}">${capture === a ? 'druk een toets…' : AT.keys.name(a)}</button></td></tr>`).join('');
    $('#modal').innerHTML = `<div class="modal-card narrow"><div class="row"><h2 class="grow">⚙️ Instellingen</h2><button class="btn small" data-close>Sluiten</button></div>
      <h3>Opslaan</h3>
      <p class="muted">Het spel slaat zichzelf steeds automatisch op. Hier bewaar je extra kopieën, of zet je je spel in een bestand (bijvoorbeeld om op een andere computer verder te spelen).</p>
      ${slots}
      <div class="row wrap"><button class="btn small" data-set="export">⬇️ Exporteer naar bestand</button>
        <label class="btn small">⬆️ Importeer bestand<input type="file" accept=".json,application/json" data-set="import" hidden></label></div>
      <h3>Daglengte</h3>
      <p class="muted">Hoe lang een speldag duurt bij snelheid 1×. Lopen en rijden blijven even snel; gewassen, dieren en fabrieken gaan mee met de tijd.</p>
      <div class="seg">${TIME_SCALES.map(([v, min]) => `<button class="btn small ${ts === v ? 'primary' : ''}" data-set="time" data-v="${v}">${min} min${v === 1 ? ' (standaard)' : ''}</button>`).join('')}</div>
      <h3>Toetsen</h3>
      <p class="muted">Klik op een toets en druk de nieuwe toets in (Esc = annuleren). De pijltjestoetsen werken altijd om te lopen en te rijden.</p>
      <table class="keys-table"><tbody>${keys}</tbody></table>
      <div class="row"><button class="btn small" data-set="resetKeys">Standaardtoetsen</button></div>
      <h3>Uitleg en geluid</h3>
      <div class="row wrap"><button class="btn small" data-set="tutorial">Uitleg opnieuw tonen</button><button class="btn small" data-open="sound">🔊 Geluid</button>
        <button class="btn small" data-open="achievements">🏆 Prestaties</button>
        <button class="btn small danger" data-action="reset">Nieuw spel…</button></div>
      <p class="muted">Huidig spel: kaart <b>${D.maps[D.mapId].name}</b> · moeilijkheid <b>${D.difficulties[s.difficulty || 'normal'].name}</b></p></div>`;
    $('#modal').hidden = false;
  }
  function onSettings(e) {
    const b = e.target.closest('[data-set]');
    if (!b || b.dataset.set === 'import') return;
    const n = Number(b.dataset.n);
    switch (b.dataset.set) {
      case 'saveSlot': { const name = prompt('Naam voor deze opslag:', `Dag ${G().day()}`); if (name !== null) G().saveSlot(n, name.slice(0, 30)); break; }
      case 'loadSlot': if (confirm('Deze opslag laden? Je huidige spel wordt eerst automatisch opgeslagen (en is terug te halen via "Exporteer" of een opslagplek).')) G().loadSlot(n); break;
      case 'delSlot': if (confirm(`Opslagplek ${n} wissen?`)) G().deleteSlot(n); break;
      case 'export': {
        const blob = new Blob([G().exportSave()], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = `agro-tycoon-dag-${G().day()}.json`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        G().log('Spel geëxporteerd naar een bestand.', 'good');
        break;
      }
      case 'time': AT.state.settings.timeScale = Number(b.dataset.v); G().log(`Daglengte: een speldag duurt nu ${TIME_SCALES.find(t => t[0] === Number(b.dataset.v))[1]} minuten bij 1×.`); break;
      case 'bind': capture = b.dataset.a; AT.keys.capturing = true; break;
      case 'resetKeys': AT.keys.reset(); break;
      case 'tutorial': AT.tutorial.restart(); $('#modal').hidden = true; return;
    }
    renderSettings();
  }
  // nieuwe toets vastleggen (vóór alle andere toetsafhandeling)
  window.addEventListener('keydown', e => {
    if (!capture) return;
    e.preventDefault(); e.stopPropagation();
    if (e.code !== 'Escape') AT.keys.bind(capture, e.code);
    capture = null;
    setTimeout(() => { AT.keys.capturing = false; }, 0);
    renderSettings();
  }, true);

  // ---------- nieuw spel: kaart en moeilijkheid ----------
  const newGameChoice = { map: D.mapId, difficulty: 'normal' };
  function renderNewGame() {
    const opt = (group, key, d) => `<button class="card choice ${newGameChoice[group] === key ? 'on' : ''}" data-new="${group}" data-v="${key}"><b>${d.name}</b><span class="muted">${d.desc}</span></button>`;
    $('#modal').innerHTML = `<div class="modal-card narrow"><div class="row"><h2 class="grow">🌱 Nieuw spel</h2><button class="btn small" data-close>Sluiten</button></div>
      <h3>Kaart</h3><div class="choices">${Object.entries(D.maps).map(([k, m]) => opt('map', k, m)).join('')}</div>
      <h3>Moeilijkheid</h3><div class="choices">${Object.entries(D.difficulties).map(([k, d]) => opt('difficulty', k, Object.assign({}, d, { desc: d.desc + (d.money < 1e7 ? ` Start: ${AT.fmtMoney(d.money)}.` : '') }))).join('')}</div>
      <div class="row"><button class="btn primary" data-new="go">Start nieuw spel</button></div></div>`;
    $('#modal').hidden = false;
  }

  // ---------- prestaties ----------
  function renderAchievements() {
    const list = AT.achievements.list(), done = list.filter(a => a.at).length;
    $('#modal').innerHTML = `<div class="modal-card"><div class="row"><h2 class="grow">🏆 Prestaties <span class="muted">${done} / ${list.length}</span></h2><button class="btn small" data-close>Sluiten</button></div>
      <p class="muted">Prestaties blijven bewaard, ook in een nieuw spel.${AT.state.difficulty === 'sandbox' ? ' <b>In sandbox tellen ze niet.</b>' : ''}</p>
      <div class="ach-grid">${list.map(a => `<div class="ach ${a.at ? 'got' : ''}"><span class="ach-icon">${a.at ? a.icon : '🔒'}</span><div><b>${a.name}</b><div class="muted">${a.desc}</div>${a.at ? `<small>${new Date(a.at).toLocaleDateString('nl-NL')}</small>` : ''}</div></div>`).join('')}</div></div>`;
    $('#modal').hidden = false;
  }

  // geluidsinstellingen
  function renderSound() {
    const st = AT.audio.settings;
    const box = (key, label, hint) => `<label class="row check"><input type="checkbox" data-sound="${key}" ${st[key] ? 'checked' : ''}> <span class="grow"><b>${label}</b><br><span class="muted">${hint}</span></span></label>`;
    $('#modal').innerHTML = `<div class="modal-card narrow"><div class="row"><h2 class="grow">🔊 Geluid</h2><button class="btn small" data-close>Sluiten</button></div>
      <label class="row"><span>Volume</span><input class="grow" type="range" min="0" max="1" step="0.05" value="${st.volume}" data-sound="volume"></label>
      ${box('sfx', 'Motoren en effecten', 'motorgeluid, werktuigen, lossen, kassa, koppelen')}
      ${box('ambient', 'Omgeving', 'wind, regen, onweer, vogels, krekels en dieren')}
      ${box('music', 'Muziek', 'rustige achtergrondmuziek')}
      ${box('muted', 'Alles dempen', 'sneltoets: M')}
      <p class="muted">Het geluid start na je eerste klik of toets (zo werken browsers).</p></div>`;
    $('#modal').hidden = false;
  }
  function soundIcon() { const b = $('#sound-btn'); if (b) b.textContent = AT.audio && AT.audio.settings.muted ? '🔇' : '🔊'; }

  function renderLog() {
    $('#log').innerHTML = AT.state.log.slice(0, 30).map(l =>
      `<div class="log-${l.type}"><span class="muted">Dag ${l.day} ${String(l.hour).padStart(2, '0')}:00</span> ${esc(l.text)}</div>`).join('');
  }

  // waarden die steeds veranderen, zonder knoppen opnieuw op te bouwen
  let sumTimer = 0, teamTimer = 0;
  function updateLive(dt = 1) {
    const s = AT.state;
    $('#money').textContent = AT.fmtMoney(s.money);
    const h = Math.floor(G().hour()), min = Math.floor((G().hour() % 1) * 60);
    const W = AT.weather, se = D.seasons[W.season()];
    $('#clock').textContent = `${se.icon} ${W.monthName()} dag ${W.dayInMonth()} · ${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    $('#clock').title = `${se.name}, jaar ${W.year()}`;
    const wt = D.weatherTypes[s.weather ? s.weather.type : 'sun'];
    $('#weather').textContent = `${wt.icon} ${W.temperature()}°C${W.drought() ? ' · droog!' : ''}`;
    $('#weather').title = `${wt.name} · bodemvocht ${Math.round((s.weather ? s.weather.moisture : 0.6) * 100)}% · jaar ${W.year()}`;
    $('#silo').textContent = `${Math.round(G().siloUsed())} / ${G().siloCapacity()} t`;
    const sIco = document.querySelector('.ico.silo'); if (sIco) sIco.classList.toggle('full', G().siloUsed() > G().siloCapacity() * 0.9);
    document.querySelectorAll('.speed button').forEach(b => {
      const v = b.dataset.speed;
      b.classList.toggle('active', v === 'pause' ? s.paused : !s.paused && Number(v) === s.speed);
    });

    // team-tab regelmatig verversen (status van wachtrij en werknemers)
    teamTimer += dt;
    if (activeTab === 'team' && teamTimer > 1.5) { teamTimer = 0; renderPanel(); return; }
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
      case 'irrigate': G().buyIrrigation(id); break;
      case 'leaseField': G().leaseField(id); break;
      case 'endLease': if (confirm('Pacht beëindigen? Wat er op het veld staat ben je kwijt.')) G().endLease(id); break;
      case 'insurance': G().toggleInsurance(); break;
      case 'deliver-truck': AT.staff.startDelivery(); break;
      case 'autoDeliver': AT.state.autoDeliver = !AT.state.autoDeliver; AT.emit('change'); break;
      case 'job': AT.staff.enqueue(id, a.task); break;
      case 'sow': AT.staff.enqueue(id, 'sow', a.crop); break;
      case 'unqueue': AT.staff.removeTask(a.q); break;
      case 'qup': AT.staff.moveTask(a.q, -1); break;
      case 'qdown': AT.staff.moveTask(a.q, 1); break;
      case 'hire': AT.staff.hire(a.w); break;
      case 'fire': AT.staff.fire(a.w); break;
      case 'newCandidates': AT.staff.refreshCandidates(); break;
      case 'sell': G().sell(a.crop, a.tons ? Number(a.tons) : undefined); break;
      case 'buyMachine': G().buyMachine(a.type); break;
      case 'rentMachine': G().rentMachine(a.type); break;
      case 'returnMachine': G().returnMachine(Number(a.uid)); break;
      case 'repair': G().repair(Number(a.uid)); break;
      case 'gps': G().buyGps(Number(a.uid)); break;
      case 'fuelService': { const m = G().machine(Number(a.uid)); if (m) G().refuel(m, true); break; }
      case 'chaser': { const res = AT.staff.toggleChaser(); if (typeof res === 'string') G().log(res, 'warn'); break; }
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
      case 'vet': AT.farm.callVet(a.key); break;
      case 'collectEggs': { const n = AT.farm.collectEggs(a.key, true); G().log(n ? `${AT.fmtNum(n)} eieren geraapt (${AT.fmtMoney(n * D.animals[a.key].nest.collectCost)}).` : 'Niets geraapt: de loods is vol of je hebt geen geld.', n ? 'good' : 'warn'); break; }
      case 'eggBelt': AT.farm.buyEggBelt(a.key); break;
      case 'shearAll': AT.farm.shearAll(a.key); break;
      case 'feedRun': AT.staff.startFeedRun(a.key); break;
      case 'expandBarn': AT.farm.expandBarn(a.key); break;
      case 'buyAnimals': AT.farm.buyAnimals(a.key, Number(a.n)); break;
      case 'sellAnimals': AT.farm.sellAnimals(a.key, Number(a.n)); break;
      case 'buyFactory': AT.farm.buyFactory(a.key); break;
      case 'toggleFactory': AT.farm.toggleFactory(a.key); break;
      case 'look-trader': { const r = D.trader.lot; AT.render.centerOn(r.x + r.w / 2, r.y + r.h / 2); break; }
      case 'look-farm': { const r = D.animals[a.key].pen; AT.render.centerOn(r.x + r.w / 2, r.y + r.h / 2); break; }
      case 'look-factory': { const r = D.factories[a.key].lot; AT.render.centerOn(r.x + r.w / 2, r.y + r.h / 2); break; }
      case 'crop': AT.state.player.crop = a.crop; renderPanel(); break;
      case 'plowGrass': if (confirm('Het gras omploegen? Daarna moet je opnieuw zaaien.')) { G().startJob(id, 'plow', null, { plowGrass: true }) ; } break;
      case 'acceptContract': G().acceptContract(a.c); break;
      case 'deliver': G().deliverContract(a.c); break;
      case 'borrow': G().borrow(Number(a.v)); break;
      case 'repay': G().repay(a.v ? Number(a.v) : undefined); break;
      case 'buyGreenhouse': AT.farm.buyGreenhouse(Number(a.i)); break;
      case 'ghCrop': AT.farm.setGreenhouseCrop(a.gh, a.crop); break;
      case 'ghUp': AT.farm.buyGhUpgrade(a.gh, a.up); break;
      case 'buyWoodlot': AT.farm.buyWoodlot(); break;
      case 'cutAll': AT.farm.cutAll(); break;
      case 'buyPlantation': AT.farm.buyPlantation(a.key); break;
      case 'place': AT.render.view.placing = { type: a.type }; G().log(`Klik op de kaart waar de ${D.buildables[a.type].name.toLowerCase()} moet komen (Esc = annuleren).`); renderPanel(); break;
      case 'demolish': if (confirm('Dit gebouw afbreken? Je krijgt de helft van de prijs terug.')) G().demolish(a.b); break;
      case 'look-built': AT.render.centerOn(Number(a.x) + 30, Number(a.y) + 30); break;
      case 'look-gh': AT.render.centerOn(Number(a.x), Number(a.y)); break;
      case 'look-fair': { const r = D.fair.area; AT.render.centerOn(r.x + r.w / 2, r.y + r.h / 2); break; }
      case 'pickAll': AT.farm.pickAll(a.key); break;
      case 'collectBales': G().collectBales(a.id ? Number(a.id) : null); break;
      case 'look-plant': { const r = D.plantations[a.key].area; AT.render.centerOn(r.x + r.w / 2, r.y + r.h / 2); break; }
      case 'upgradeWarehouse': G().upgradeWarehouse(); break;
      case 'look-wood': { const r = D.woodlot.area; AT.render.centerOn(r.x + r.w / 2, r.y + r.h / 2); break; }
      case 'look-sp': { const r = a.sp === 'trader' ? D.trader.lot : D.sellPoints[a.sp].lot; AT.render.centerOn(r.x + r.w / 2, r.y + r.h / 2); break; }
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
      const pl = AT.render.view.placing;
      if (pl && e.target === canvas) {
        const w = AT.render.screenToWorld(p.x, p.y), d = D.buildables[pl.type];
        pl.x = Math.round(w.x - d.w / 2); pl.y = Math.round(w.y - d.h / 2);
        canvas.style.cursor = G().placeProblem(pl.type, pl.x, pl.y) ? 'not-allowed' : 'copy';
      }
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
      // plaatsen van een gebouw
      const pl = AT.render.view.placing;
      if (pl) {
        if (e.button === 2) { AT.render.view.placing = null; return; }
        const w = AT.render.screenToWorld(p.x, p.y), d = D.buildables[pl.type];
        const why = G().placeProblem(pl.type, Math.round(w.x - d.w / 2), Math.round(w.y - d.h / 2));
        if (why) { G().log(`Hier kun je niet bouwen: ${why}.`, 'warn'); return; }
        AT.render.view.placing = null;
        if (!G().placeBuilding(pl.type, Math.round(w.x - d.w / 2), Math.round(w.y - d.h / 2))) AT.render.view.placing = pl;
        canvas.style.cursor = 'grab';
        return;
      }
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
      const bld = AT.render.buildingAt(w.x, w.y);
      if (bld) { activeTab = bld.kind === 'trader' ? 'market' : 'farm'; renderPanel(); return; }
      const Y = D.yard;
      if (w.x >= Y.x && w.x <= Y.x + Y.w && w.y >= Y.y && w.y <= Y.y + Y.h) {
        if (w.y <= D.hall.y && w.x <= D.house.x + D.house.w) { openGoals(); return; }
        activeTab = w.y > D.hall.y ? 'garage' : 'market';
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
    $('#tab-content').addEventListener('change', e => {
      const el = e.target;
      if (el.dataset.auto) {
        const patch = el.dataset.auto === 'crop' ? { crop: el.value } : { [el.dataset.auto]: el.checked };
        AT.staff.setAuto(Number(el.dataset.id), patch);
        if (patch.on) G().log(`Veld ${el.dataset.id} staat nu op automatisch beheer.`, 'good');
      }
      if (el.dataset.team === 'external') { AT.state.staff.allowExternal = el.checked; AT.emit('change'); }
      if (el.dataset.team === 'night') { AT.state.staff.nightShift = el.checked; AT.emit('change'); }
      if (el.dataset.team === 'carter') { AT.state.staff.carter = el.checked; AT.emit('change'); }
      if (el.dataset.team === 'hour0' || el.dataset.team === 'hour1') { AT.state.staff.hours[el.dataset.team === 'hour0' ? 0 : 1] = Number(el.value); AT.emit('change'); }
      if (el.dataset.wfeed) { AT.farm.animal(el.dataset.wfeed).workerFeed = el.checked; AT.emit('change'); }
      if (el.dataset.afeed) AT.farm.toggleAutoFeed(el.dataset.afeed);
      if (el.dataset.ashear) AT.farm.toggleAutoShear(el.dataset.ashear);
      el.blur();
    });
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
      if (e.target.closest('[data-open="prices"]')) renderPriceCalendar();
      if (e.target.closest('[data-open="sound"]')) { renderSound(); e.target.closest('button').blur(); }
      if (e.target.closest('[data-open="settings"]')) { renderSettings(); e.target.closest('button').blur(); }
      if (e.target.closest('#modal [data-set]')) onSettings(e);
      if (e.target.closest('[data-open="goals"]') || e.target.closest('#goal')) openGoals();
      if (e.target.closest('#modal [data-action="reset"]')) renderNewGame();
      if (e.target.closest('#modal [data-new]')) {
        const b = e.target.closest('[data-new]');
        if (b.dataset.new === 'go') { if (confirm('Een nieuw spel beginnen? Je huidige spel wordt eerst bewaard als reservekopie; wil je het houden, zet het dan eerst op een opslagplek (⚙️).')) G().newGame(newGameChoice); }
        else { newGameChoice[b.dataset.new] = b.dataset.v; renderNewGame(); }
      }
      if (e.target.closest('[data-open="achievements"]')) renderAchievements();
      if (e.target.closest('[data-close]') || e.target.id === 'modal') $('#modal').hidden = true;
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !capture) { $('#modal').hidden = true; if (AT.render.view.placing) { AT.render.view.placing = null; G().log('Bouwen geannuleerd.'); } } });
    $('#map').addEventListener('contextmenu', e => { if (AT.render.view.placing) { e.preventDefault(); AT.render.view.placing = null; } });

    document.addEventListener('keydown', e => {
      if (e.target.closest && e.target.closest('input, select, textarea')) return;
      if (e.repeat || AT.keys.capturing) return;
      if (AT.keys.is(e, 'pause')) setSpeed('pause');
      const k = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(e.code);
      if (k >= 0) setSpeed(String(D.speeds[k]));
    });

    $('#modal').addEventListener('change', e => {
      if (e.target.dataset && e.target.dataset.set === 'import' && e.target.files[0]) {
        const r = new FileReader();
        r.onload = () => { if (!confirm('Dit spel importeren? Je huidige spel wordt vervangen (het staat nog in "Exporteer" als je het eerst bewaart).')) return; if (!G().importSave(String(r.result))) alert('Dit bestand is geen geldig Agro Tycoon-spel.'); };
        r.readAsText(e.target.files[0]);
      }
    });
    $('#modal').addEventListener('input', e => {
      const k = e.target.dataset && e.target.dataset.sound;
      if (!k) return;
      AT.audio.set({ [k]: e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value) });
    });
    AT.on('audio', soundIcon);
    soundIcon();
    AT.on('change', renderPanel);
    AT.on('newday', () => { if (activeTab === 'market' || activeTab === 'farm') renderPanel(); else renderForecast(); });
    AT.on('weather', renderForecast);
    AT.on('log', renderLog);
    renderPanel();
    renderLog();
  }

  AT.ui = { init, updateLive, renderPanel, renderLog };
})();
