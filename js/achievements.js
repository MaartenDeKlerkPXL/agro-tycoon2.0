// Agro Tycoon 2.0 — prestaties (achievements)
// Ze blijven bewaard in je browser, ook als je een nieuw spel begint. In sandbox tellen ze niet.
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const KEY = 'agro-tycoon-2-achievements';
  const S = () => AT.state;
  const owned = s => s.fields.filter(f => f.owned && !f.leased);
  const kindCount = (s, kind) => s.machines.filter(m => D.machines[m.type].kind === kind && !m.rented).length;

  const LIST = [
    ['first_harvest', '🌾', 'Eerste oogst', 'Oogst je eerste hectare.', s => s.stats.harvestedHa >= 1],
    ['first_sale', '💶', 'Eerste euro', 'Verkoop iets.', s => s.stats.earned > 0],
    ['harvest_1000', '🏭', 'Volle schuur', 'Oogst in totaal 1.000 ton.', s => s.stats.tonsHarvested >= 1000],
    ['all_crops', '🌈', 'Alleskunner', 'Oogst 10 verschillende gewassen.', s => Object.keys(s.stats.cropsHarvested || {}).length >= 10],
    ['money_100k', '💰', 'Ton op de bank', 'Heb €100.000 op de bank.', s => s.money >= 100000],
    ['millionaire', '👑', 'Miljonair', 'Heb €1.000.000 op de bank.', s => s.money >= 1000000],
    ['fields_10', '🗺️', 'Grootgrondbezitter', 'Bezit 10 velden (niet gepacht).', s => owned(s).length >= 10],
    ['all_fields', '🏰', 'Heer van het land', 'Bezit alle velden.', s => s.fields.every(f => f.owned && !f.leased)],
    ['polder', '🌊', 'Polderpionier', 'Koop of pacht een veld in de Oostpolder.', s => s.fields.some(f => f.owned && (D.fields.find(d => d.id === f.id) || {}).region === 'oost')],
    ['team_8', '👷', 'Vol team', 'Heb 8 werknemers in dienst.', s => s.staff && s.staff.employees.length >= 8],
    ['animals_100', '🐄', 'Dierenvriend', 'Heb 100 dieren tegelijk.', s => Object.values(s.animals).reduce((a, x) => a + (x.count || 0), 0) >= 100],
    ['births_50', '🐣', 'Kraamkamer', 'Laat 50 jonge dieren geboren worden.', s => (s.stats.births || 0) >= 50],
    ['all_factories', '⚙️', 'Industrieel', 'Bouw alle fabrieken.', s => Object.values(s.factories).every(f => f.owned)],
    ['contracts_10', '📜', 'Betrouwbare leverancier', 'Voltooi 10 contracten.', s => s.stats.contractsDone >= 10],
    ['bales_100', '🧶', 'Balenkoning', 'Haal 100 hooibalen op.', s => (s.stats.balesCollected || 0) >= 100],
    ['fruit', '🍎', 'Fruitteler', 'Oogst 10.000 kg fruit of druiven.', s => (s.stats.picked || 0) >= 10000],
    ['truck_25', '🚚', 'Transporteur', 'Lever 25 keer met de vrachtwagen.', s => s.stats.truckDeliveries >= 25],
    ['builder', '🏗️', 'Bouwer', 'Plaats 3 eigen gebouwen.', s => (s.buildings || []).length >= 3],
    ['gps', '🛰️', 'Kaarsrecht', 'Bouw GPS in een machine.', s => s.machines.some(m => m.gps)],
    ['crawler', '🛞', 'Rupsenrijder', 'Koop een rupstrekker.', s => s.machines.some(m => m.type === 'tractor_crawler' && !m.rented)],
    ['fleet', '🚜', 'Machinepark', 'Bezit 5 tractoren.', s => kindCount(s, 'tractor') >= 5],
    ['soil_perfect', '🌱', 'Groene vingers', 'Krijg een veld op 98% bodemkwaliteit.', s => s.fields.some(f => f.owned && f.soil >= 0.98)],
    ['debt_free', '🏦', 'Schuldenvrij', 'Los in totaal €50.000 lening af.', s => (s.stats.loanRepaid || 0) >= 50000],
    ['night_harvest', '🌙', 'Nachtwerk', 'Oogst zelf midden in de nacht.', s => !!s.stats.nightHarvest],
    ['snow_driver', '❄️', 'Sneeuwschuiver', 'Rij door een dik pak sneeuw.', s => !!s.stats.snowDrive],
    ['chaser', '🤝', 'Teamwerk', 'Laat 100 t overladen in een meerijdende kipper.', s => (s.stats.chaserTons || 0) >= 100],
    ['eggs', '🥚', 'Eierboer', 'Laat je kippen 10.000 eieren leggen.', s => ((s.animals.chickens && s.animals.chickens.produced && s.animals.chickens.produced.eggs) || 0) >= 10000],
    ['shear_100', '✂️', 'Schapenscheerder', 'Scheer 100 schapen.', s => (s.stats.sheared || 0) >= 100],
    ['greenhouses_4', '🌷', 'Glastuinbouwer', 'Heb 4 kassen.', s => AT.farm.allGreenhouses().filter(x => x.g.owned).length >= 4],
    ['fair_buy', '🎪', 'Beurskoopje', 'Koop een machine op de landbouwbeurs.', s => (s.stats.fairBuys || 0) >= 1],
    ['year_1', '📅', 'Eerste jaar', 'Speel een volledig jaar (24 dagen).', s => s.time >= 24 * 24],
    ['hard_mode', '🔥', 'Doorzetter', 'Verdien €250.000 op Moeilijk.', s => s.difficulty === 'hard' && s.stats.earned >= 250000],
  ].map(([id, icon, name, desc, check]) => ({ id, icon, name, desc, check }));

  let got = {};
  try { got = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { got = {}; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(got)); } catch (e) { /* ok */ } };

  let toastEl = null, toastQueue = [], toastBusy = false;
  function toast(a) {
    toastQueue.push(a);
    if (toastBusy) return;
    const next = () => {
      const x = toastQueue.shift();
      if (!x) { toastBusy = false; return; }
      toastBusy = true;
      if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'ach-toast'; document.body.appendChild(toastEl); }
      toastEl.innerHTML = `<span class="ach-icon">${x.icon}</span><div><small>Prestatie behaald</small><b>${x.name}</b><div>${x.desc}</div></div>`;
      toastEl.classList.add('show');
      setTimeout(() => { toastEl.classList.remove('show'); setTimeout(next, 450); }, 3800);
    };
    next();
  }

  let timer = 0;
  function update(dt) {
    const s = S();
    if (!s || s.difficulty === 'sandbox') return;
    timer += dt;
    if (timer < 2) return;
    timer = 0;
    for (const a of LIST) {
      if (got[a.id]) continue;
      let ok = false;
      try { ok = a.check(s); } catch (e) { ok = false; }
      if (!ok) continue;
      got[a.id] = Date.now();
      save();
      AT.emit('sfx', 'goal');
      toast(a);
      if (AT.game) AT.game.log(`🏆 Prestatie behaald: ${a.name}!`, 'goal');
    }
  }

  const list = () => LIST.map(a => ({ ...a, at: got[a.id] || null }));
  function reset() { got = {}; save(); }

  AT.achievements = { update, list, reset, LIST };
})();
