// Agro Tycoon 2.0 — dieren en fabrieken
// Dieren eten graan uit de silo en maken producten (melk, eieren, wol, mest).
// Fabrieken verwerken gewassen en producten tot iets dat meer waard is.
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const S = () => AT.state;
  const G = () => AT.game;

  // ---------- dieren ----------
  function buyBuilding(key) {
    const d = D.animals[key], a = S().animals[key];
    if (a.owned) return;
    if (S().money < d.buildPrice) { G().log(`Niet genoeg geld voor de ${d.building}.`, 'warn'); return; }
    G().spend(d.buildPrice);
    a.owned = true;
    G().log(`${d.building} gebouwd! Koop nu ${d.name.toLowerCase()}.`, 'money');
    AT.emit('change');
  }

  function buyAnimals(key, n) {
    const d = D.animals[key], a = S().animals[key];
    if (!a.owned) return;
    n = Math.min(n, d.capacity - a.count);
    if (n <= 0) { G().log(`De ${d.building} zit vol.`, 'warn'); return; }
    const cost = n * d.price;
    if (S().money < cost) { G().log(`Niet genoeg geld voor ${n} ${d.name.toLowerCase()}.`, 'warn'); return; }
    G().spend(cost);
    a.count += n;
    G().log(`${n} ${n === 1 ? d.one : d.name.toLowerCase()} gekocht voor ${AT.fmtMoney(cost)}.`, 'money');
    AT.emit('change');
  }

  function sellAnimals(key, n) {
    const d = D.animals[key], a = S().animals[key];
    n = Math.min(n, a.count);
    if (n <= 0) return;
    const value = n * d.price * 0.7;
    a.count -= n;
    G().earn(value);
    G().log(`${n} ${n === 1 ? d.one : d.name.toLowerCase()} verkocht voor ${AT.fmtMoney(value)}.`, 'money');
    AT.emit('change');
  }

  // voer dat er per dag nodig is en hoeveel dagen de silo nog meegaat
  function feedInfo(key) {
    const d = D.animals[key], a = S().animals[key];
    const perDay = a.count * d.feedPerDay;
    const available = d.feeds.reduce((sum, k) => sum + S().silo[k], 0);
    return { perDay, days: perDay > 0 ? available / perDay : Infinity };
  }

  const hungerWarned = {};
  function updateAnimals(dtHours) {
    for (const key of Object.keys(D.animals)) {
      const d = D.animals[key], a = S().animals[key];
      if (!a.owned || a.count === 0) continue;
      // voeren uit de silo, in volgorde van voorkeur
      let need = a.count * d.feedPerDay / 24 * dtHours;
      const wanted = need;
      for (const k of d.feeds) {
        const got = Math.min(need, S().silo[k]);
        S().silo[k] -= got;
        need -= got;
        if (need <= 1e-9) break;
      }
      const fedNow = wanted > 0 ? 1 - need / wanted : 1;
      a.fed += (fedNow - a.fed) * Math.min(1, dtHours / 6); // vloeiend gemiddelde
      if (a.fed < 0.5 && !hungerWarned[key]) {
        hungerWarned[key] = true;
        G().log(`Je ${d.name.toLowerCase()} hebben honger! Zorg voor graan in de silo.`, 'warn');
      }
      if (a.fed > 0.8) hungerWarned[key] = false;
      // productie: alleen goed gevoerde dieren produceren volop
      for (const [p, perDay] of Object.entries(d.produce)) {
        const amount = a.count * perDay / 24 * dtHours * fedNow;
        G().addGood(p, amount);
        a.produced[p] = (a.produced[p] || 0) + amount;
      }
    }
  }

  // ---------- fabrieken ----------
  function buyFactory(key) {
    const d = D.factories[key], f = S().factories[key];
    if (f.owned) return;
    if (S().money < d.price) { G().log(`Niet genoeg geld voor de ${d.name}.`, 'warn'); return; }
    G().spend(d.price);
    f.owned = true;
    f.on = true;
    G().log(`${d.name} gebouwd!`, 'money');
    AT.emit('change');
  }

  function toggleFactory(key) {
    const f = S().factories[key];
    f.on = !f.on;
    AT.emit('change');
  }

  function missingInputs(key) {
    const d = D.factories[key];
    return Object.entries(d.in).filter(([k, amt]) => G().stock(k) < amt).map(([k]) => k);
  }

  function goodName(k) { return (D.crops[k] || D.products[k]).name.toLowerCase(); }

  function updateFactories(dtHours) {
    for (const key of Object.keys(D.factories)) {
      const d = D.factories[key], f = S().factories[key];
      if (!f.owned) continue;
      if (!f.on) { f.status = 'uit'; f.running = false; continue; }
      f.progress = Math.min(1, f.progress + d.batchesPerDay / 24 * dtHours);
      if (f.progress < 1) continue;
      const missing = missingInputs(key);
      if (missing.length) {
        f.status = 'wacht op ' + missing.map(goodName).join(' en ');
        f.running = false;
        continue;
      }
      if (S().money < d.costPerBatch) { f.status = 'geen geld voor energie'; f.running = false; continue; }
      for (const [k, amt] of Object.entries(d.in)) G().take(k, amt);
      for (const [k, amt] of Object.entries(d.out)) G().addGood(k, amt);
      G().spend(d.costPerBatch);
      f.progress -= 1;
      f.made = (f.made || 0) + 1;
      f.status = 'draait';
      f.running = true;
    }
  }

  function update(dtHours) {
    updateAnimals(dtHours);
    updateFactories(dtHours);
  }

  AT.farm = { update, buyBuilding, buyAnimals, sellAnimals, feedInfo, buyFactory, toggleFactory, missingInputs, goodName };
})();
