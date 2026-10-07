// Agro Tycoon 2.0 — dieren en fabrieken
// Dieren eten graan uit de silo en maken producten (melk, eieren, wol, mest).
// Fabrieken verwerken gewassen en producten tot iets dat meer waard is.
window.AT = window.AT || {};

(function () {
  const D = AT.data;
  const S = () => AT.state;
  const G = () => AT.game;

  // ---------- dieren ----------
  // stal-gegevens aanvullen (oudere saves, nieuwe diersoorten)
  function animal(key) {
    const a = S().animals[key];
    if (a.health == null) a.health = 1;
    if (a.level == null) a.level = 0;
    if (!a.trough) a.trough = {};
    if (a.autoFeed == null) a.autoFeed = true;
    if (a.birthAcc == null) a.birthAcc = 0;
    const d = D.animals[key];
    // kippen: eieren in de legnesten; oudere saves met een kippenhok krijgen de eierband erbij (zoals vroeger)
    if (d.nest) { if (a.nest == null) a.nest = 0; if (a.eggBelt == null) a.eggBelt = !!a.owned; }
    // schapen: wol op de rug. fleece = vacht van de ongeschoren groep, shorn = al geschoren deze ronde (vacht fleeceB)
    if (d.fleece) { if (a.fleece == null) a.fleece = a.owned ? 0.5 : 0; if (a.fleeceB == null) a.fleeceB = 0; if (a.shorn == null) a.shorn = 0; if (a.autoShear == null) a.autoShear = false; fixFlock(a); }
    return a;
  }
  const nestCap = key => D.animals[key].nest.cap * D.barnLevels[animal(key).level || 0];
  // nieuwe dieren (geboren of gekocht) komen bij de geschoren groep, met hun eigen vacht
  function addFlock(a, n, fleece) {
    if (n <= 0) return;
    a.fleeceB = (a.fleeceB * a.shorn + fleece * n) / (a.shorn + n);
    a.shorn += n;
  }
  function fixFlock(a) {
    a.shorn = Math.max(0, Math.min(a.shorn, a.count));
    if (a.count && a.shorn >= a.count) { a.fleece = a.fleeceB; a.fleeceB = 0; a.shorn = 0; }
  }
  const avgFleece = key => { const a = animal(key); return a.count ? (a.fleece * (a.count - a.shorn) + a.fleeceB * a.shorn) / a.count : 0; };
  // hoeveel wol er nu te scheren valt
  function woolReady(key) {
    const d = D.animals[key].fleece, a = animal(key);
    return a.fleece >= d.minShear ? (a.count - a.shorn) * d.perAnimal * a.fleece : 0;
  }

  // ---------- eieren ----------
  function collectEggs(key, paid) {
    const d = D.animals[key], a = animal(key);
    if (!d.nest || !a.owned) return 0;
    let n = Math.floor(Math.min(a.nest, G().warehouseRoom(d.nest.good)));
    if (paid) n = Math.min(n, Math.floor(S().money / d.nest.collectCost));
    if (n <= 0) return 0;
    if (paid) G().spend(n * d.nest.collectCost, 'loonwerk');
    const added = G().addGood(d.nest.good, n);
    a.nest -= added;
    a.produced[d.nest.good] = (a.produced[d.nest.good] || 0) + added;
    S().stats.eggsCollected = (S().stats.eggsCollected || 0) + added;
    AT.emit('change');
    return added;
  }
  function buyEggBelt(key) {
    const d = D.animals[key], a = animal(key);
    if (!d.nest || a.eggBelt || !a.owned) return;
    if (S().money < d.nest.beltPrice) { G().log('Niet genoeg geld voor een eierband.', 'warn'); return; }
    G().spend(d.nest.beltPrice, 'gebouwen');
    a.eggBelt = true;
    if (a.nest >= 1) collectEggs(key, false);
    G().log('Eierband geplaatst: de eieren rollen nu vanzelf naar de opslagloods.', 'money');
    AT.emit('change');
  }

  // ---------- scheren ----------
  // n schapen scheren (uit de ongeschoren groep); geeft terug hoeveel wol (kg)
  function shear(key, n, paid) {
    const d = D.animals[key], f = d.fleece, a = animal(key);
    if (!f || !a.owned || !a.count) return 0;
    if (a.fleece < f.minShear) return 0;
    let k = Math.min(n, a.count - a.shorn);
    const per = f.perAnimal * a.fleece;
    k = Math.min(k, Math.floor(G().warehouseRoom(f.good) / per));
    if (paid) k = Math.min(k, Math.floor(S().money / f.shearCost));
    if (k <= 0) return 0;
    if (paid) G().spend(k * f.shearCost, 'loonwerk');
    const wool = G().addGood(f.good, k * per);
    a.produced[f.good] = (a.produced[f.good] || 0) + wool;
    addFlock(a, k, 0);
    fixFlock(a);
    S().stats.sheared = (S().stats.sheared || 0) + k;
    AT.emit('change');
    return wool;
  }
  function shearAll(key, quiet) {
    const d = D.animals[key], a = animal(key);
    const n = a.count - a.shorn, wool = shear(key, n, true);
    if (!quiet || wool) G().log(wool ? `De scheerder heeft je ${d.name.toLowerCase()} geschoren: +${AT.fmtAmount(wool, d.fleece.good)} wol.` : 'Niets te scheren: de vacht is nog te kort, de loods is vol of je hebt geen geld.', wool ? 'good' : 'warn');
    return wool;
  }
  function toggleAutoShear(key) { const a = animal(key); a.autoShear = !a.autoShear; AT.emit('change'); }
  const capacity = key => D.animals[key].capacity * D.barnLevels[animal(key).level || 0];
  const troughRect = key => { const B = D.animals[key].barn; return { x: B.x + B.w + 8, y: B.y + 10, w: 34, h: 6 }; };
  const troughTons = key => Object.values(animal(key).trough).reduce((s, v) => s + v, 0);

  function buyBuilding(key) {
    const d = D.animals[key], a = animal(key);
    if (a.owned) return;
    if (S().money < d.buildPrice) { G().log(`Niet genoeg geld voor de ${d.building}.`, 'warn'); return; }
    G().spend(d.buildPrice, 'gebouwen');
    a.owned = true;
    G().log(`${d.building} gebouwd! Koop nu ${d.name.toLowerCase()}.`, 'money');
    AT.emit('change');
  }
  // stal uitbreiden: meer plek
  function expandBarn(key) {
    const d = D.animals[key], a = animal(key);
    if (!a.owned || a.level >= D.barnLevels.length - 1) return;
    const cost = expandCost(key);
    if (S().money < cost) { G().log('Niet genoeg geld om de stal uit te breiden.', 'warn'); return; }
    G().spend(cost, 'gebouwen');
    a.level++;
    G().log(`${d.building} uitgebreid: nu plek voor ${capacity(key)} ${d.name.toLowerCase()}.`, 'money');
    AT.emit('change');
  }
  const expandCost = key => Math.round(D.animals[key].buildPrice * 0.7 * (animal(key).level + 1));

  function buyAnimals(key, n) {
    const d = D.animals[key], a = animal(key);
    if (!a.owned) return;
    n = Math.min(n, capacity(key) - a.count);
    if (n <= 0) { G().log(`De ${d.building} zit vol. Breid de stal uit.`, 'warn'); return; }
    const cost = n * d.price;
    if (S().money < cost) { G().log(`Niet genoeg geld voor ${n} ${d.name.toLowerCase()}.`, 'warn'); return; }
    G().spend(cost, 'dieren');
    if (d.fleece) addFlock(a, n, 0.3);
    a.count += n;
    if (d.fleece) fixFlock(a);
    G().log(`${n} ${n === 1 ? d.one : d.name.toLowerCase()} gekocht voor ${AT.fmtMoney(cost)}.`, 'money');
    AT.emit('change');
  }

  function sellAnimals(key, n) {
    const d = D.animals[key], a = animal(key);
    n = Math.min(n, a.count);
    if (n <= 0) return;
    const value = n * d.sellPrice * (0.5 + 0.5 * a.health);   // zieke dieren brengen minder op
    a.count -= n;
    if (d.fleece) fixFlock(a);
    G().earn(value, true, 'dieren');
    G().log(`${n} ${n === 1 ? d.one : d.name.toLowerCase()} verkocht voor ${AT.fmtMoney(value)}.`, 'money');
    AT.emit('change');
  }

  function toggleAutoFeed(key) { const a = animal(key); a.autoFeed = !a.autoFeed; AT.emit('change'); }

  // voerbak vullen vanuit een aanhanger; geeft terug hoeveel erin ging
  function fillTrough(key, good, amount) {
    const d = D.animals[key], a = animal(key);
    if (!d.feeds.includes(good)) return 0;
    const room = d.trough * D.barnLevels[a.level] - troughTons(key);
    const add = Math.max(0, Math.min(amount, room));
    a.trough[good] = (a.trough[good] || 0) + add;
    S().stats.troughTons = (S().stats.troughTons || 0) + add;
    return add;
  }

  function callVet(key) {
    const d = D.animals[key], a = animal(key), cost = vetCost(key);
    if (S().money < cost) { G().log('Niet genoeg geld voor de dierenarts.', 'warn'); return; }
    G().spend(cost, 'dierenarts');
    a.health = 1; a.sick = false;
    G().log(`De dierenarts heeft je ${d.name.toLowerCase()} behandeld (${AT.fmtMoney(cost)}). Ze zijn weer gezond.`, 'good');
    AT.emit('change');
  }
  const vetCost = key => Math.round(D.vetBase + D.vetPerAnimal * animal(key).count);

  // voer dat er per dag nodig is en hoeveel dagen het nog meegaat
  function feedInfo(key) {
    const d = D.animals[key], a = animal(key);
    const perDay = a.count * d.feedPerDay;
    const store = a.autoFeed ? d.feeds.reduce((sum, k) => sum + G().stock(k), 0) : 0;
    const trough = troughTons(key);
    return { perDay, trough, days: perDay > 0 ? (trough + store) / perDay : Infinity, troughDays: perDay > 0 ? trough / perDay : Infinity };
  }

  const hungerWarned = {};
  let fullWarned = 0;
  function warnFull() {
    if (G().day() === fullWarned) return;
    fullWarned = G().day();
    G().log('De opslagloods is vol! Productie gaat verloren. Verkoop producten of breid de loods uit.', 'warn');
  }
  let feeAcc = 0;
  function updateAnimals(dtHours) {
    const dayFrac = dtHours / 24;
    for (const key of Object.keys(D.animals)) {
      const d = D.animals[key], a = animal(key);
      if (!a.owned || a.count === 0) continue;
      // 1) uit de voerbak, 2) automatisch uit silo/loods (met voerdienst)
      const wanted = a.count * d.feedPerDay * dayFrac;
      // grazers halen buiten de winter een deel uit de wei
      const grazed = d.graze && AT.weather.season() !== 3 ? wanted * d.graze : 0;
      let need = wanted - grazed;
      let quality = grazed;
      for (const k of d.feeds) {
        const got = Math.min(need, a.trough[k] || 0);
        if (got > 0) { a.trough[k] -= got; need -= got; quality += got * (D.feedBonus[k] || 1); }
        if (need <= 1e-12) break;
      }
      if (need > 1e-12 && a.autoFeed) {
        for (const k of d.feeds) {
          const got = Math.min(need, G().stock(k));
          if (got > 0) { G().take(k, got); need -= got; quality += got * (D.feedBonus[k] || 1); feeAcc += got * D.feedServicePerTon; }
          if (need <= 1e-12) break;
        }
      }
      for (const k of Object.keys(a.trough)) if (a.trough[k] < 1e-6) delete a.trough[k];
      const eaten = wanted - need;
      const fedNow = wanted > 0 ? eaten / wanted : 1;
      quality = eaten > 0 ? quality / eaten : 1;
      a.fed += (fedNow - a.fed) * Math.min(1, dtHours / 6); // vloeiend gemiddelde
      a.quality = quality;
      if (a.fed < 0.5 && !hungerWarned[key]) {
        hungerWarned[key] = true;
        G().log(`Je ${d.name.toLowerCase()} hebben honger! Vul de voerbak (kipper met voer, U) of zet automatisch voeren aan.`, 'warn');
      }
      if (a.fed > 0.8) hungerWarned[key] = false;
      // gezondheid: honger en een volle stal maken ziek, goed voer maakt beter
      let dh = 0;
      if (a.fed < 0.6) dh -= 0.25 * (0.6 - a.fed) / 0.6;
      if (a.count > capacity(key) * 0.9) dh -= 0.02;
      if (a.fed > 0.8 && !a.sick) dh += 0.04 * quality;
      if (a.sick) dh -= 0.08;
      a.health = Math.max(0, Math.min(1, a.health + dh * dayFrac));
      // af en toe een ziekte (vaker in een volle stal)
      const sickChance = (0.02 + (a.count > capacity(key) * 0.9 ? 0.03 : 0)) * dayFrac;
      if (!a.sick && Math.random() < sickChance) {
        a.sick = true;
        G().log(`Ziekte in de ${d.building.toLowerCase()}! Bel de dierenarts (tab Bedrijf), anders worden je ${d.name.toLowerCase()} steeds zieker.`, 'warn');
      }
      // erg zieke dieren gaan dood
      if (a.health < 0.2) {
        a.deathAcc = (a.deathAcc || 0) + a.count * 0.08 * dayFrac;
        if (a.deathAcc >= 1) { const n = Math.min(a.count, Math.floor(a.deathAcc)); a.deathAcc -= n; a.count -= n; if (d.fleece) fixFlock(a); G().log(`${n} ${n === 1 ? d.one : d.name.toLowerCase()} gestorven door ziekte!`, 'warn'); AT.emit('change'); }
      }
      // jongen: gezonde, goed gevoerde dieren krijgen jongen als er plek is
      if (a.count >= 2 && a.count < capacity(key)) {
        a.birthAcc += a.count * d.births * a.health * fedNow * dayFrac;
        if (a.birthAcc >= 1) {
          const n = Math.min(Math.floor(a.birthAcc), capacity(key) - a.count);
          a.birthAcc -= Math.floor(a.birthAcc);
          if (n > 0) {
            if (d.fleece) addFlock(a, n, 0);
            a.count += n;
            if (d.fleece) fixFlock(a);
            S().stats.births = (S().stats.births || 0) + n;
            a.bornToday = (a.bornToday || 0) + n;
            AT.emit('change');
          }
        }
      }
      // productie: gevoerd × voerkwaliteit × gezondheid
      const health = 0.4 + 0.6 * a.health;
      for (const [p, perDay] of Object.entries(d.produce)) {
        let amount = a.count * perDay * dayFrac * fedNow * quality * health;
        // eieren: in de winter leggen kippen minder, en zonder eierband blijven ze in de legnesten liggen
        if (d.nest && p === d.nest.good) {
          if (AT.weather.season() === 3) amount *= d.nest.winterLay;
          if (!a.eggBelt) {
            const room = nestCap(key) - a.nest;
            a.nest += Math.max(0, Math.min(room, amount));
            if (amount > room && !a.nestWarned) { a.nestWarned = true; G().log('De legnesten in het kippenhok zijn vol! Raap de eieren (H bij het kippenhok), laat ze rapen of koop een eierband.', 'warn'); }
            if (a.nest < nestCap(key) * 0.8) a.nestWarned = false;
            continue;
          }
        }
        const added = G().addGood(p, amount);
        a.produced[p] = (a.produced[p] || 0) + added;
        if (added < amount - 1e-9) warnFull();
      }
      // wol groeit op de rug; een volle vacht in de zomer is te warm
      if (d.fleece) {
        const grow = dayFrac / d.fleece.growDays * fedNow * health;
        a.fleece = Math.min(1, a.fleece + grow);
        a.fleeceB = Math.min(1, a.fleeceB + grow);
        if (AT.weather.season() === 1 && a.fleece > 0.85 && a.count > a.shorn) {
          a.health = Math.max(0, a.health - 0.03 * dayFrac * (a.count - a.shorn) / a.count);
          if (!a.heatWarned) { a.heatWarned = true; G().log(`Je ${d.name.toLowerCase()} hebben het warm met hun dikke vacht. Scheer ze (H in de wei) of huur een scheerder in.`, 'warn'); }
        }
        if (a.fleece < 0.5) a.heatWarned = false;
        if (a.autoShear && a.fleece >= 0.95 && a.count > a.shorn) shearAll(key, true);
      }
    }
    if (feeAcc >= 5) { G().spend(feeAcc, 'voer'); feeAcc = 0; }
  }
  // geboorten één keer per dag melden
  AT.on('newday', () => {
    for (const key of Object.keys(D.animals)) {
      const a = S().animals[key];
      if (a && a.bornToday) { G().log(`${a.bornToday} ${D.animals[key].young} geboren in de ${D.animals[key].building.toLowerCase()}!`, 'good'); a.bornToday = 0; }
    }
  });

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
  // voorraad voor een fabriek: eerst wat er direct bij de fabriek is gelost, dan de silo/loods
  const buffer = key => { const f = S().factories[key]; if (!f.buffer) f.buffer = {}; return f.buffer; };
  const have = (key, k) => (buffer(key)[k] || 0) + G().stock(k);
  const lacking = (key, r) => Object.entries(r.in).filter(([k, amt]) => have(key, k) < amt).map(([k]) => k);
  function usableRecipe(key) { return recipes(key).find(r => !lacking(key, r).length) || null; }
  function missingInputs(key) {
    if (usableRecipe(key)) return [];
    return [...new Set(recipes(key).flatMap(r => lacking(key, r)))];
  }
  // stortplaats bij de fabriek: bovenaan (rij langs de weg) of onderaan
  function factoryPit(key) {
    const L = D.factories[key].lot, top = L.y >= 1600 && L.y < 1700;
    return { x: L.x + L.w - 56, y: top ? L.y + 4 : L.y + L.h - 16, w: 50, h: 12 };
  }
  // neemt deze fabriek dit (uit een aanhanger) aan?
  const factoryAccepts = (key, good) => recipes(key).some(r => good in r.in) && (!!D.crops[good] || good === 'hay');
  function deliverToFactory(key, good, amount) {
    const f = S().factories[key];
    if (!f.owned || !factoryAccepts(key, good)) return 0;
    const b = buffer(key), room = 60 - Object.values(b).reduce((a, v) => a + v, 0);
    const add = Math.max(0, Math.min(amount, room));
    b[good] = (b[good] || 0) + add;
    S().stats.factoryTons = (S().stats.factoryTons || 0) + add;
    return add;
  }
  // weide: poort in het bovenste hek, net breed genoeg voor tractor + kipper naar de voerbak
  function penGate(key) { const B = D.animals[key].barn; return { x0: B.x + B.w + 2, x1: B.x + B.w + 50 }; }

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
      // direct geleverd (vers) = meer product
      const b = buffer(key);
      let fresh = true;
      for (const [k, amt] of Object.entries(recipe.in)) {
        const fromBuf = Math.min(amt, b[k] || 0);
        if (fromBuf > 0) { b[k] -= fromBuf; if (b[k] < 1e-6) delete b[k]; }
        if (amt - fromBuf > 1e-9) { fresh = false; G().take(k, amt - fromBuf); }
      }
      for (const [k, amt] of Object.entries(recipe.out)) G().addGood(k, amt * (fresh ? D.factoryBonus : 1));
      f.fresh = fresh;
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
    if (!s.greenhouses) s.greenhouses = [];
    while (s.greenhouses.length < D.greenhouse.lots.length) s.greenhouses.push({ owned: false, crop: 'tomatoes', status: '' });
    return s.greenhouses;
  }
  function ghState(g) { if (!g.up) g.up = {}; if (g.ramp == null) g.ramp = 1; return g; }
  // alle kassen: de vaste bouwplekken plus de kassen die je zelf ergens hebt gebouwd
  function allGreenhouses() {
    const list = greenhouses().map((g, i) => ({ g: ghState(g), rect: D.greenhouse.lots[i], id: 'lot' + i, lot: i }));
    const bd = D.buildables.greenhouse;
    for (const b of S().buildings || []) {
      if (b.type !== 'greenhouse') continue;
      if (!b.gh) b.gh = { owned: true, crop: 'tomatoes', status: '' };
      list.push({ g: ghState(b.gh), rect: { x: b.x, y: b.y, w: bd.w, h: bd.h }, id: b.id });
    }
    list.forEach((x, k) => { x.name = `Kas ${k + 1}`; });
    return list;
  }
  const ghById = id => allGreenhouses().find(x => x.id === id);
  function buyGreenhouse(i) {
    const g = greenhouses()[i];
    if (g.owned) return;
    if (S().money < D.greenhouse.price) { G().log('Niet genoeg geld voor een kas.', 'warn'); return; }
    G().spend(D.greenhouse.price, 'gebouwen');
    g.owned = true;
    G().log('Kas gebouwd! Hier groeit het hele jaar door. Kies wat erin moet (tab Bedrijf).', 'money');
    AT.emit('change');
  }
  // omschakelen: nieuwe planten kopen en een dag aanloop
  function setGreenhouseCrop(id, crop) {
    const x = ghById(id);
    if (!x || x.g.crop === crop || !D.greenhouse.crops[crop]) return;
    if (S().money < D.greenhouse.plantCost) { G().log('Niet genoeg geld voor nieuwe planten.', 'warn'); return; }
    G().spend(D.greenhouse.plantCost, 'zaaigoed');
    x.g.crop = crop; x.g.ramp = 0;
    G().log(`${x.name}: omgeschakeld naar ${G().goodName(crop)} (${AT.fmtMoney(D.greenhouse.plantCost)} nieuwe planten). Over een dag draait hij weer op volle kracht.`, 'money');
    AT.emit('change');
  }
  function buyGhUpgrade(id, key) {
    const x = ghById(id), u = D.greenhouse.upgrades[key];
    if (!x || !u || x.g.up[key]) return;
    if (S().money < u.price) { G().log(`Niet genoeg geld voor ${u.name.toLowerCase()}.`, 'warn'); return; }
    G().spend(u.price, 'gebouwen');
    x.g.up[key] = true;
    S().stats.ghUpgrades = (S().stats.ghUpgrades || 0) + 1;
    G().log(`${x.name}: ${u.name} geplaatst (${u.desc}).`, 'money');
    AT.emit('change');
  }
  // productie per dag en stookkosten per dag van één kas, nu
  function ghRates(g, se = AT.weather.season()) {
    const c = D.greenhouse.crops[g.crop], U = D.greenhouse.upgrades, up = g.up || {};
    const light = up.led ? U.led.grow : se === 3 ? D.greenhouse.winterLight : 1;
    const perDay = c.perDay * light * (up.drip ? U.drip.grow : 1) * (up.layers ? U.layers.grow : 1) * (g.ramp == null ? 1 : g.ramp);
    const energy = D.greenhouse.energyPerDay[se] * c.heat * (up.chp ? U.chp.heatCut : 1) * (up.layers ? U.layers.heat : 1) + (up.led ? U.led.power : 0);
    return { perDay, energy };
  }
  function updateGreenhouses(dtHours) {
    const se = AT.weather.season();
    for (const { g } of allGreenhouses()) {
      if (!g.owned) continue;
      g.ramp = Math.min(1, g.ramp + dtHours / 24);
      const r = ghRates(g, se), energy = r.energy / 24 * dtHours;
      if (S().money < energy) { g.status = 'geen geld voor stookkosten'; continue; }
      G().spend(energy, 'energie');
      const amount = r.perDay / 24 * dtHours;
      const added = G().addGood(g.crop, amount);
      g.made = (g.made || 0) + added;
      g.status = added < amount - 1e-9 ? 'opslagloods vol' : g.ramp < 1 ? 'nieuwe planten groeien aan' : se === 3 ? (g.up.led ? 'groeit (verwarmd, met lampen)' : 'groeit (verwarmd, weinig licht)') : 'groeit';
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

  // ---------- boomgaard en wijngaard ----------
  function plantation(key) {
    const s = S();
    if (!s.plantations) s.plantations = {};
    if (!s.plantations[key]) {
      const d = D.plantations[key], A = d.area, plants = [];
      const [sx, sy] = d.spacing;
      for (let y = A.y + sy / 2 + 2; y < A.y + A.h - 4; y += sy) {
        for (let x = A.x + sx / 2 + 2; x < A.x + A.w - 4; x += sx) plants.push({ x: Math.round(x), y: Math.round(y), fruit: 0, picked: false });
      }
      s.plantations[key] = { owned: false, plants, phase: 'rest', pickedTotal: 0 };
    }
    return s.plantations[key];
  }
  function buyPlantation(key) {
    const d = D.plantations[key], pl = plantation(key);
    if (pl.owned) return;
    if (S().money < d.price) { G().log(`Niet genoeg geld voor de ${d.name.toLowerCase()}.`, 'warn'); return; }
    G().spend(d.price, 'land');
    pl.owned = true;
    G().log(`${d.name} gekocht! In ${d.harvest.map(m => D.months[m].toLowerCase()).join(', ')} kun je plukken (H) of plukkers inhuren.`, 'money');
    AT.emit('change');
  }
  const ripeCount = key => plantation(key).plants.filter(p => p.fruit >= 1 && !p.picked).length;
  // één plant plukken; geeft terug hoeveel er geplukt is
  function pick(key, plant, paid, cost = D.plantations[key].pickCost) {
    const d = D.plantations[key];
    if (plant.picked || plant.fruit < 1) return 0;
    if (paid) { if (S().money < cost) return 0; G().spend(cost, 'loonwerk'); }
    const amount = d.perPlant * (0.9 + Math.random() * 0.2);
    const added = G().addGood(d.product, amount);
    if (added <= 0) return 0;
    plant.picked = true; plant.fruit = 0;
    const pl = plantation(key);
    pl.pickedTotal += added;
    S().stats.picked = (S().stats.picked || 0) + added;
    return added;
  }
  // eigen oogstmachine (vrij) = goedkoper dan plukkers
  const harvestMachine = key => S().machines.find(m => D.machines[m.type].harvests === key && !m.busy && !m.broken);
  function pickAll(key) {
    const d = D.plantations[key], pl = plantation(key), mach = harvestMachine(key);
    const cost = mach ? d.machineCost : d.pickCost;
    let n = 0, amount = 0;
    for (const p of pl.plants) {
      if (p.fruit < 1 || p.picked) continue;
      const got = pick(key, p, true, cost);
      if (!got) break;
      n++; amount += got;
    }
    if (mach && n) G().addWear(mach, n * (key === 'orchard' ? 0.05 : 0.005));
    G().log(n ? `${mach ? 'Werknemer met de ' + D.machines[mach.type].name.toLowerCase() : 'Plukkers'}: ${n} ${n === 1 ? d.plant : d.plants} geoogst, ${AT.fmtAmount(amount, d.product)} ${G().goodName(d.product)} (${AT.fmtMoney(n * cost)}).`
      : 'Niets geplukt: niets rijp, geen geld of de opslagloods is vol.', n ? 'good' : 'warn');
    AT.emit('change');
  }
  function nearestRipe(x, y, max = 14) {
    let best = null, bd = max;
    for (const key of Object.keys(D.plantations)) {
      const pl = plantation(key);
      if (!pl.owned || pl.phase !== 'ripe') continue;
      for (const p of pl.plants) {
        if (p.picked || p.fruit < 1) continue;
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < bd) { bd = d; best = { key, plant: p }; }
      }
    }
    return best;
  }
  function updatePlantations() {
    const m = AT.weather.month(), MH = D.daysPerMonth * 24, frac = (S().time % MH) / MH;
    for (const [key, d] of Object.entries(D.plantations)) {
      const pl = plantation(key);
      const phase = d.harvest.includes(m) ? 'ripe' : d.grow.includes(m) ? 'grow' : 'rest';
      if (phase !== pl.phase) {
        if (pl.owned && phase === 'ripe') G().log(`${d.name}: de ${G().goodName(d.product)} zijn rijp! Pluk ze (H) of huur plukkers in (tab Bedrijf).`, 'good');
        if (pl.owned && pl.phase === 'ripe') {
          const left = pl.plants.filter(p => p.fruit >= 1 && !p.picked).length;
          if (left) G().log(`${d.name}: ${left} ${left === 1 ? d.plant : d.plants} niet geplukt, die oogst is verloren.`, 'warn');
        }
        pl.phase = phase;
      }
      const growFrac = phase === 'grow' ? (d.grow.indexOf(m) + frac) / d.grow.length : 0;
      for (const p of pl.plants) {
        if (phase === 'grow') { p.fruit = growFrac * 0.99; p.picked = false; }
        else if (phase === 'ripe') { if (!p.picked) p.fruit = 1; }
        else { p.fruit = 0; p.picked = false; }
      }
    }
  }
  let plantTimer = 0;

  function update(dtHours) {
    plantTimer += dtHours;
    if (plantTimer > 0.5) { plantTimer = 0; updatePlantations(); }
    updateAnimals(dtHours);
    updateFactories(dtHours);
    updateGreenhouses(dtHours);
    updateWoodlot(dtHours);
  }

  AT.farm = { collectEggs, buyEggBelt, nestCap, shear, shearAll, toggleAutoShear, woolReady, avgFleece, harvestMachine, factoryPit, factoryAccepts, deliverToFactory, penGate, buffer, animal, capacity, troughRect, troughTons, expandBarn, expandCost, toggleAutoFeed, fillTrough, callVet, vetCost, plantation, buyPlantation, pick, pickAll, nearestRipe, ripeCount, update, greenhouses, allGreenhouses, ghRates, buyGhUpgrade, buyGreenhouse, setGreenhouseCrop, woodlot, buyWoodlot, cutTree, nearestTree, cutAll, buyBuilding, buyAnimals, sellAnimals, feedInfo, buyFactory, toggleFactory, missingInputs, goodName, recipes };
})();
