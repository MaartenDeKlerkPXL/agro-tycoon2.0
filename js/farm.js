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
    G().spend(d.buildPrice, 'gebouwen');
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
    G().spend(cost, 'dieren');
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
    G().earn(value, true, 'dieren');
    G().log(`${n} ${n === 1 ? d.one : d.name.toLowerCase()} verkocht voor ${AT.fmtMoney(value)}.`, 'money');
    AT.emit('change');
  }

  // voer dat er per dag nodig is en hoeveel dagen de silo nog meegaat
  function feedInfo(key) {
    const d = D.animals[key], a = S().animals[key];
    const perDay = a.count * d.feedPerDay;
    const available = d.feeds.reduce((sum, k) => sum + G().stock(k), 0);
    return { perDay, days: perDay > 0 ? available / perDay : Infinity };
  }

  const hungerWarned = {};
  let fullWarned = 0;
  function warnFull() {
    if (G().day() === fullWarned) return;
    fullWarned = G().day();
    G().log('De opslagloods is vol! Productie gaat verloren. Verkoop producten of breid de loods uit.', 'warn');
  }
  function updateAnimals(dtHours) {
    for (const key of Object.keys(D.animals)) {
      const d = D.animals[key], a = S().animals[key];
      if (!a.owned || a.count === 0) continue;
      // voeren uit de silo, in volgorde van voorkeur
      let need = a.count * d.feedPerDay / 24 * dtHours;
      const wanted = need;
      for (const k of d.feeds) {
        const got = Math.min(need, G().stock(k));
        G().take(k, got);
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
        const added = G().addGood(p, amount);
        a.produced[p] = (a.produced[p] || 0) + added;
        if (added < amount - 1e-9) warnFull();
      }
    }
  }

  // ---------- fabrieken ----------
  function buyFactory(key) {
    const d = D.factories[key], f = S().factories[key];
    if (f.owned) return;
    if (S().money < d.price) { G().log(`Niet genoeg geld voor de ${d.name}.`, 'warn'); return; }
    G().spend(d.price, 'gebouwen');
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

  // een fabriek kan meerdere recepten hebben (bijv. olie uit koolzaad óf zonnebloemen)
  function recipes(key) {
    const d = D.factories[key];
    return [{ in: d.in, out: d.out }, ...(d.alt || [])];
  }
  const lacking = r => Object.entries(r.in).filter(([k, amt]) => G().stock(k) < amt).map(([k]) => k);
  function usableRecipe(key) { return recipes(key).find(r => !lacking(r).length) || null; }
  function missingInputs(key) {
    if (usableRecipe(key)) return [];
    return [...new Set(recipes(key).flatMap(lacking))];
  }

  function goodName(k) { return (D.crops[k] || D.products[k]).name.toLowerCase(); }

  function updateFactories(dtHours) {
    for (const key of Object.keys(D.factories)) {
      const d = D.factories[key], f = S().factories[key];
      if (!f.owned) continue;
      if (!f.on) { f.status = 'uit'; f.running = false; continue; }
      f.progress = Math.min(1, f.progress + d.batchesPerDay / 24 * dtHours);
      if (f.progress < 1) continue;
      const recipe = usableRecipe(key);
      if (!recipe) {
        f.status = 'wacht op ' + missingInputs(key).map(goodName).join(recipes(key).length > 1 ? ' of ' : ' en ');
        f.running = false;
        continue;
      }
      if (S().money < d.costPerBatch) { f.status = 'geen geld voor energie'; f.running = false; continue; }
      if (Object.entries(recipe.out).some(([k, amt]) => G().warehouseRoom(k) < amt)) { f.status = 'opslagloods vol'; f.running = false; continue; }
      for (const [k, amt] of Object.entries(recipe.in)) G().take(k, amt);
      for (const [k, amt] of Object.entries(recipe.out)) G().addGood(k, amt);
      G().spend(d.costPerBatch, 'energie');
      f.progress -= 1;
      f.made = (f.made || 0) + 1;
      f.status = 'draait';
      f.running = true;
    }
  }

  // ---------- kassen ----------
  function greenhouses() {
    const s = S();
    if (!s.greenhouses) s.greenhouses = D.greenhouse.lots.map(() => ({ owned: false, crop: 'tomatoes', status: '' }));
    return s.greenhouses;
  }
  function buyGreenhouse(i) {
    const g = greenhouses()[i];
    if (g.owned) return;
    if (S().money < D.greenhouse.price) { G().log('Niet genoeg geld voor een kas.', 'warn'); return; }
    G().spend(D.greenhouse.price, 'gebouwen');
    g.owned = true;
    G().log('Kas gebouwd! Hier groeien het hele jaar groenten.', 'money');
    AT.emit('change');
  }
  function setGreenhouseCrop(i, crop) { greenhouses()[i].crop = crop; AT.emit('change'); }
  function updateGreenhouses(dtHours) {
    const se = AT.weather.season();
    for (const g of greenhouses()) {
      if (!g.owned) continue;
      const energy = D.greenhouse.energyPerDay[se] / 24 * dtHours;
      if (S().money < energy) { g.status = 'geen geld voor stookkosten'; continue; }
      G().spend(energy, 'energie');
      const amount = D.greenhouse.crops[g.crop].perDay / 24 * dtHours;
      const added = G().addGood(g.crop, amount);
      g.status = added < amount - 1e-9 ? 'opslagloods vol' : se === 3 ? 'groeit (verwarmd)' : 'groeit';
      if (added < amount - 1e-9) warnFull();
    }
  }

  // ---------- bosperceel ----------
  function woodlot() {
    const s = S();
    if (!s.woodlot) {
      // vaste raster van bomen met wat variatie
      const A = D.woodlot.area, trees = [];
      let seed = 99;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let y = A.y + 12; y < A.y + A.h - 8; y += 22) {
        for (let x = A.x + 12; x < A.x + A.w - 8; x += 22) {
          trees.push({ x: Math.round(x + (rnd() - 0.5) * 8), y: Math.round(y + (rnd() - 0.5) * 8), variant: 6 + Math.floor(rnd() * 3), growth: 0.6 + rnd() * 0.4 });
        }
      }
      s.woodlot = { owned: false, trees };
    }
    return s.woodlot;
  }
  function buyWoodlot() {
    const w = woodlot();
    if (w.owned) return;
    if (S().money < D.woodlot.price) { G().log('Niet genoeg geld voor het bosperceel.', 'warn'); return; }
    G().spend(D.woodlot.price, 'land');
    w.owned = true;
    G().log('Bosperceel gekocht! Kap bomen te voet met H, of laat ze kappen in de tab Bedrijf.', 'money');
    AT.emit('change');
  }
  // één boom kappen: hout erbij, er komt een jong boompje terug
  function cutTree(t, paid) {
    const wood = D.woodlot.woodPerTree * t.growth;
    if (G().warehouseRoom('wood') < wood) { G().log('De opslagloods is te vol voor hout.', 'warn'); return false; }
    if (paid) { if (S().money < D.woodlot.cutCost) return false; G().spend(D.woodlot.cutCost, 'loonwerk'); }
    G().addGood('wood', wood);
    t.growth = 0.05;
    return true;
  }
  function nearestTree(x, y, max = 16) {
    const w = woodlot();
    if (!w.owned) return null;
    let best = null, bd = max;
    for (const t of w.trees) { const d = Math.hypot(t.x - x, t.y - y); if (d < bd && t.growth >= 0.6) { bd = d; best = t; } }
    return best;
  }
  // laat alle volgroeide bomen kappen
  function cutAll() {
    const w = woodlot();
    let n = 0, wood = 0;
    for (const t of w.trees) if (t.growth >= 0.95) { const v = D.woodlot.woodPerTree * t.growth; if (cutTree(t, true)) { n++; wood += v; } }
    G().log(n ? `${n} bomen gekapt: ${AT.fmtNum(wood, 1)} m³ hout.` : 'Er zijn nog geen volgroeide bomen.', n ? 'good' : 'warn');
    AT.emit('change');
  }
  function updateWoodlot(dtHours) {
    const w = woodlot();
    if (AT.weather.season() === 3) return; // in de winter groeit het bos niet
    const g = dtHours / (D.woodlot.growDays * 24);
    for (const t of w.trees) if (t.growth < 1) t.growth = Math.min(1, t.growth + g);
  }

  function update(dtHours) {
    updateAnimals(dtHours);
    updateFactories(dtHours);
    updateGreenhouses(dtHours);
    updateWoodlot(dtHours);
  }

  AT.farm = { update, greenhouses, buyGreenhouse, setGreenhouseCrop, woodlot, buyWoodlot, cutTree, nearestTree, cutAll, buyBuilding, buyAnimals, sellAnimals, feedInfo, buyFactory, toggleFactory, missingInputs, goodName, recipes };
})();
