// Agro Tycoon 2.0 — uitleg bij de eerste keer
// Stap voor stap, met een stuiterende pijl op de kaart naar waar je heen moet
// (tractor, veld, zaaimachine, maaidorser, stortput). Overslaan kan altijd.
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const S = () => AT.state;
  const G = () => AT.game;
  const K = a => AT.keys.name(a);
  const kind = m => D.machines[m.type].kind;
  const rigKind = () => { const r = AT.vehicle.rig(); return r ? r : null; };
  const field1 = () => G().fieldDef(1);
  const center = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const machineOf = test => S().machines.find(m => test(m));
  const inField = (p, f) => p.x >= f.x && p.x <= f.x + f.w && p.y >= f.y && p.y <= f.y + f.h;

  // elke stap: tekst, doel op de kaart (of null) en wanneer hij klaar is
  const STEPS = [
    { text: () => `Welkom! Je bent de boer met de witte ring. Loop met ${K('up')}${K('left')}${K('down')}${K('right')} naar je rode tractor (de pijl) en druk <b>${K('enter')}</b> om in te stappen.`,
      target: () => machineOf(m => kind(m) === 'tractor'), done: () => S().player.mode === 'drive' },
    { text: () => `Rij het erf af door de poort en naar <b>Veld 1</b>. De witte pijl rond je tractor wijst ook de weg. Op de weg rij je het snelst.`,
      target: () => center(field1()), done: () => inField(S().player, field1()) || S().stats.plowedHa > 0 },
    { text: () => `Druk <b>${K('tool')}</b>: de ploeg gaat omlaag. Rij heen en weer over het veld om te ploegen.`,
      target: () => center(field1()), done: () => S().stats.plowedHa >= 0.3 },
    { text: () => `Goed zo! Laat de rest gerust door personeel doen (tab Veld). Rij nu terug naar het erf, zet de ploeg neer (<b>${K('hitch')}</b>) en rij achteruit tegen de <b>zaaimachine</b>, dan weer <b>${K('hitch')}</b>.`,
      target: () => machineOf(m => kind(m) === 'seeder' && !m.attached), done: () => { const r = rigKind(); return !!(r && r.toolDef && r.toolDef.kind === 'seeder') || S().stats.sownHa > 0; } },
    { text: () => `Kies je zaaigoed met <b>${K('crop')}</b> (gerst of haver groeit snel), rij naar het geploegde stuk en zet de zaaimachine omlaag (<b>${K('tool')}</b>).`,
      target: () => center(field1()), done: () => S().stats.sownHa >= 0.3 },
    { text: () => `Het gewas groeit. Zet de tijd sneller met de knoppen rechtsboven (of toets 2, 3, 4). In de tussentijd kun je in de Winkel kijken of velden kopen.`,
      target: () => null, done: () => G().summary(G().field(1)).ready > 0 || S().stats.harvestedHa > 0 },
    { text: () => `Het gewas is rijp! Stap uit (<b>${K('enter')}</b>), loop naar de <b>maaidorser</b> en oogst het veld. Is het te nat, wacht dan tot het droog is.`,
      target: () => machineOf(m => kind(m) === 'harvester'), done: () => S().stats.harvestedHa >= 0.3 },
    { text: () => `Is de bunker vol of klaar? Rij naar de <b>stortput bij de silo</b> en druk <b>${K('unload')}</b>. Of roep met <b>${K('chaser')}</b> een chauffeur met kipper.`,
      target: () => center(D.siloPit), done: () => S().stats.deliveredTons > 0 || (S().stats.chaserTons || 0) > 0 },
    { text: () => `Klaar met de basis! Verkoop je graan in de tab Markt (kijk naar de prijskalender), koop meer velden en machines en neem personeel aan. Veel plezier!`,
      target: () => null, done: () => false, last: true },
  ];

  let card = null, shownStep = -1;
  function el() {
    if (!card) {
      card = document.createElement('div');
      card.id = 'tutorial'; card.className = 'tutorial';
      document.querySelector('.canvas-box').appendChild(card);
      card.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.tut === 'skip' || b.dataset.tut === 'close') finish();
        b.blur();
      });
    }
    return card;
  }
  function finish() { S().tutorial.done = true; render(); }
  function restart() { S().tutorial = { step: 0, done: false }; shownStep = -1; render(); }

  function render() {
    const t = S().tutorial || { done: true }, c = el();
    if (t.done) { c.hidden = true; return; }
    const st = STEPS[t.step];
    c.hidden = false;
    c.innerHTML = `<div class="tut-step">Uitleg · stap ${t.step + 1} van ${STEPS.length}</div><p>${st.text()}</p>
      <div class="row">${st.last ? '<button class="btn small primary" data-tut="close">Begrepen</button>' : '<button class="btn small" data-tut="skip">Uitleg overslaan</button>'}</div>`;
    shownStep = t.step;
  }

  let timer = 0;
  function update(dt) {
    const t = S().tutorial;
    if (!t || t.done) { if (card && !card.hidden) card.hidden = true; return; }
    timer += dt;
    if (timer < 0.25 && shownStep === t.step) return;
    timer = 0;
    if (STEPS[t.step].done()) { t.step = Math.min(STEPS.length - 1, t.step + 1); AT.emit('sfx', 'goal'); }
    // stappen die je al gedaan hebt meteen overslaan
    while (t.step < STEPS.length - 1 && STEPS[t.step].done()) t.step++;
    if (shownStep !== t.step || (card && card.hidden)) render();
  }

  // stuiterende pijl boven het doel (in wereldcoördinaten)
  function drawWorld(ctx, time, zoom) {
    const t = S().tutorial;
    if (!t || t.done) return;
    const tg = STEPS[t.step].target();
    if (!tg) return;
    const bounce = Math.sin(time * 5) * 4 / zoom, s = 1 / zoom;
    const x = tg.x, y = tg.y - 22 * s + bounce;
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.moveTo(-13 + 2, -30 + 3); ctx.lineTo(13 + 2, -30 + 3); ctx.lineTo(2, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffd34d'; ctx.strokeStyle = '#7a5a00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-13, -30); ctx.lineTo(13, -30); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    // ring rond het doel
    ctx.strokeStyle = `rgba(255,211,77,${0.5 + 0.3 * Math.sin(time * 5)})`; ctx.lineWidth = 2.5 * s;
    ctx.beginPath(); ctx.arc(tg.x, tg.y, 16 * s + 6, 0, Math.PI * 2); ctx.stroke();
  }

  AT.tutorial = { update, drawWorld, restart, finish, render, STEPS };
})();
