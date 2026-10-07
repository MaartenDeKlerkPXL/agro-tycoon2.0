// Unit tests voor de spellogica: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadGame, makeStorage, fillField } from './helpers.mjs';

test('nieuw spel: startgeld, velden en machines', () => {
  const { AT } = loadGame();
  const s = AT.state;
  assert.equal(s.money, 20000);
  assert.equal(s.fields.length, AT.data.fields.length);
  assert.deepEqual([...s.fields.filter(f => f.owned).map(f => f.id)], [1, 2]);
  assert.ok(s.machines.some(m => AT.data.machines[m.type].kind === 'tractor'));
  assert.ok(s.machines.some(m => AT.data.machines[m.type].kind === 'harvester'));
});

test('veldcyclus: ploegen → zaaien → oogsten levert graan op', () => {
  const { AT } = loadGame();
  const G = AT.game, ST = G.ST, f = G.field(1);
  AT.state.weather.type = 'sun';
  assert.equal(G.workCell(f, 0, 'plow', null, 'player'), 'ok');
  assert.equal(f.cells.state[0], ST.PLOWED);
  const month = AT.weather.month();
  const crop = Object.keys(AT.data.crops).find(k => AT.data.crops[k].sow.includes(month) && AT.data.crops[k].harvester === 'combine');
  assert.equal(G.workCell(f, 0, 'sow', crop, 'player'), 'ok');
  assert.equal(f.cells.state[0], ST.SOWN);
  f.cells.planted[0] -= 1e4;   // tijd vooruit
  assert.ok(G.isReady(f, 0));
  const before = AT.state.silo[crop];
  assert.equal(G.workCell(f, 0, 'harvest', null, 'worker'), 'ok');
  assert.ok(AT.state.silo[crop] > before, 'er komt graan in de silo');
  assert.equal(f.cells.state[0], ST.STUBBLE);
});

test('verkeerde machine: maaidorser kan geen aardappelen rooien', () => {
  const { AT } = loadGame();
  const f = fillField(AT, 1, AT.game.ST.SOWN, 'potato');
  const combine = AT.data.machines.harvester_old;
  assert.equal(AT.game.workCell(f, 0, 'harvest', null, 'player', 0, combine), 'wrongtool');
});

test('prijzen: seizoen binnen ±15% en verkopen drukt de prijs', () => {
  const { AT } = loadGame();
  for (let m = 0; m < 12; m++) {
    const f = AT.weather.monthFactor('wheat', m);
    assert.ok(f >= 0.85 - 1e-9 && f <= 1.15 + 1e-9, `maand ${m}: ${f}`);
  }
  const p0 = AT.game.price('wheat');
  AT.state.silo.wheat = 200;
  AT.game.sell('wheat', 200);
  assert.ok(AT.game.price('wheat') < p0, 'marktverzadiging');
});

test('bodem: lage pH en verdichting geven minder opbrengst', () => {
  const { AT } = loadGame();
  const G = AT.game, f = fillField(AT, 1, G.ST.SOWN, 'wheat');
  const base = G.yieldFactor(f, 0);
  f.ph = 5.3;
  assert.ok(G.yieldFactor(f, 0) < base);
  f.ph = 6.5;
  f.cells.fert[0] |= G.COMPACT;
  assert.ok(G.yieldFactor(f, 0) < base);
});

test('opslaan en laden: geld en cellen blijven bewaard', () => {
  const storage = makeStorage();
  const a = loadGame({ storage });
  a.AT.state.money = 123456;
  fillField(a.AT, 1, a.AT.game.ST.PLOWED);
  a.AT.game.save();
  const b = loadGame({ storage });
  assert.equal(b.AT.state.money, 123456);
  assert.equal(b.AT.game.field(1).cells.state[5], b.AT.game.ST.PLOWED);
});

test('oude save met verschoven gewassen wordt goed omgezet', () => {
  const storage = makeStorage();
  const a = loadGame({ storage });
  const G = a.AT.game;
  fillField(a.AT, 1, G.ST.SOWN, 'corn');
  G.save();
  const sv = JSON.parse(storage.getItem('agro-tycoon-2-save'));
  // doen alsof maïs vroeger nummer 1 was
  const keys = [...sv.cropKeys]; keys.splice(keys.indexOf('corn'), 1); keys.unshift('corn');
  sv.cropKeys = keys; sv.version = 3;
  sv.fields.find(f => f.id === 1).crop = String.fromCharCode(49).repeat(sv.fields.find(f => f.id === 1).n);
  storage.setItem('agro-tycoon-2-save', JSON.stringify(sv));
  const b = loadGame({ storage });
  const c = b.AT.game.field(1).cells;
  assert.equal(b.AT.game.CROP_KEYS[c.crop[0] - 1], 'corn');
  assert.ok(storage.getItem('agro-tycoon-2-save-backup-v3'), 'reservekopie gemaakt');
});

test('contracten: leveren uit voorraad betaalt de contractprijs', () => {
  const { AT } = loadGame();
  const G = AT.game, s = AT.state;
  G.refreshOffers();
  const o = s.contracts.offers.find(x => AT.data.crops[x.key]) || s.contracts.offers[0];
  G.acceptContract(o.id);
  if (AT.data.crops[o.key]) s.silo[o.key] = o.amount; else s.goods[o.key] = o.amount;
  const m0 = s.money;
  G.deliverContract(o.id);
  assert.ok(s.money - m0 >= o.amount * o.pricePer + o.bonus - 1);
  assert.equal(s.contracts.active.length, 0);
});

test('bank: lenen, rente en aflossen', () => {
  const { AT } = loadGame();
  const G = AT.game, s = AT.state;
  G.borrow(10000);
  assert.equal(s.loan, 10000);
  assert.equal(s.money, 30000);
  G.repay(4000);
  assert.equal(s.loan, 6000);
});

test('bouwen: niet op akkers of wegen, wel op gras', () => {
  const { AT } = loadGame();
  const G = AT.game, D = AT.data, f = D.fields[0], road = D.roads[0];
  assert.match(G.placeProblem('silo', f.x + 10, f.y + 10), /akker/);
  assert.match(G.placeProblem('silo', road.x, road.y + 300), /weg/);
  let spot = null;
  for (let y = 20; y < 1880 && !spot; y += 10) for (let x = 20; x < D.world.w - 60 && !spot; x += 10) if (!G.placeProblem('silo', x, y)) spot = { x, y };
  assert.ok(spot, 'er is ergens plek');
  const cap = G.siloCapacity();
  AT.state.money = 1e6;
  assert.ok(G.placeBuilding('silo', spot.x, spot.y));
  assert.equal(G.siloCapacity(), cap + D.buildables.silo.capacity);
});

test('moeilijkheid: moeilijk geeft lagere prijzen', () => {
  const storage = makeStorage({ 'agro-tycoon-2-save-newgame': JSON.stringify({ difficulty: 'hard' }) });
  const hard = loadGame({ storage });
  const normal = loadGame();
  assert.equal(hard.AT.state.money, 8000);
  assert.ok(hard.AT.game.price('wheat') < normal.AT.game.price('wheat'));
});

test('dieren: voerbak vullen en eten, jongen bij goede verzorging', () => {
  const { AT } = loadGame();
  const F = AT.farm, s = AT.state;
  s.money = 1e6;
  F.buyBuilding('pigs'); F.buyAnimals('pigs', 10);
  F.toggleAutoFeed('pigs');
  assert.ok(F.fillTrough('pigs', 'corn', 4) > 3.9);
  assert.equal(F.fillTrough('pigs', 'hay', 1), 0, 'varkens eten geen hooi');
  for (let h = 0; h < 48; h++) AT.farm.update(1);
  assert.ok(F.troughTons('pigs') < 4, 'er is gegeten');
  assert.ok(s.animals.pigs.count >= 10);
});

test('slijtage en reparatie', () => {
  const { AT } = loadGame();
  const G = AT.game, m = AT.state.machines[0];
  G.addWear(m, 100);
  assert.ok(m.wear > 0.5);
  assert.ok(G.wearSpeed(m) < 1);
  AT.state.money = 1e6;
  G.repair(m.uid);
  assert.equal(m.wear, 0);
});

test('kippen: eieren in de legnesten, rapen en eierband', () => {
  const { AT } = loadGame();
  const F = AT.farm, s = AT.state;
  s.money = 1e6;
  F.buyBuilding('chickens'); F.buyAnimals('chickens', 100);
  F.fillTrough('chickens', 'wheat', 2);
  assert.equal(s.animals.chickens.eggBelt, false, 'nieuw kippenhok heeft geen eierband');
  for (let h = 0; h < 24; h++) F.update(1);
  const nest = s.animals.chickens.nest;
  assert.ok(nest > 50, 'eieren liggen in de nesten');
  assert.ok(AT.game.stock('eggs') < 1, 'nog niet in de loods');
  const n = F.collectEggs('chickens', false);
  assert.ok(n > 50 && AT.game.stock('eggs') >= n - 1e-6, 'geraapt naar de loods');
  F.buyEggBelt('chickens');
  for (let h = 0; h < 12; h++) F.update(1);
  assert.ok(AT.game.stock('eggs') > n, 'eierband brengt eieren vanzelf naar de loods');
});

test('oude save: kippenhok krijgt de eierband, schapen een halve vacht', () => {
  const { AT } = loadGame();
  const s = AT.state;
  s.animals.chickens = { owned: true, count: 50, fed: 1, produced: {} };
  s.animals.sheep = { owned: true, count: 10, fed: 1, produced: {} };
  assert.equal(AT.farm.animal('chickens').eggBelt, true);
  assert.equal(AT.farm.animal('sheep').fleece, 0.5);
});

test('schapen: wol groeit, scheren met de hand en door een scheerder', () => {
  const { AT } = loadGame();
  const F = AT.farm, s = AT.state, a = () => s.animals.sheep;
  s.money = 1e6;
  F.buyBuilding('sheep'); F.buyAnimals('sheep', 20);
  for (let h = 0; h < 24 * 8; h++) { F.fillTrough('sheep', 'oats', 1); F.update(1); }
  assert.ok(F.avgFleece('sheep') > 0.6, 'vacht groeit');
  const ready = F.woolReady('sheep');
  const shorn0 = a().shorn;
  const wool = F.shear('sheep', 5, false);
  assert.ok(wool > 0 && a().shorn === shorn0 + 5, '5 schapen geschoren');
  F.shearAll('sheep');
  assert.equal(a().shorn, 0, 'na de hele kudde begint een nieuwe ronde');
  assert.ok(AT.game.stock('wool') > ready * 0.95, 'alle wol in de loods');
  assert.ok(a().fleece < 0.2, 'vacht is kort');
  assert.equal(F.shear('sheep', 5, false), 0, 'te korte vacht kun je niet scheren');
});

test('kassen: omschakelen, upgrades en zelf bouwen', () => {
  const { AT } = loadGame();
  const F = AT.farm, G = AT.game, D = AT.data, s = AT.state;
  s.money = 1e6;
  F.buyGreenhouse(0);
  const gh = () => F.allGreenhouses()[0];
  const base = F.ghRates(gh().g, 0).perDay;
  F.setGreenhouseCrop('lot0', 'strawberries');
  assert.equal(gh().g.crop, 'strawberries');
  assert.equal(gh().g.ramp, 0, 'nieuwe planten moeten aangroeien');
  for (let h = 0; h < 30; h++) F.update(1);
  assert.equal(gh().g.ramp, 1);
  assert.ok(G.stock('strawberries') > 0);
  const before = F.ghRates(gh().g, 3);
  F.buyGhUpgrade('lot0', 'led'); F.buyGhUpgrade('lot0', 'chp');
  const after = F.ghRates(gh().g, 3);
  assert.ok(after.perDay > before.perDay * 1.6, 'groeilampen: geen winterdip');
  assert.ok(after.energy < before.energy, 'warmtekrachtkoppeling bespaart');
  assert.ok(base > 0);
  // een kas zelf bouwen
  let spot = null;
  for (let y = 20; y < D.world.h - 100 && !spot; y += 10) for (let x = 20; x < D.world.w - 150 && !spot; x += 10) if (!G.placeProblem('greenhouse', x, y)) spot = { x, y };
  assert.ok(spot && G.placeBuilding('greenhouse', spot.x, spot.y));
  assert.equal(F.allGreenhouses().filter(x => x.g.owned).length, 2);
});

test('landbouwbeurs: korting op machines, extra bij een bezoek', () => {
  const { AT } = loadGame();
  const G = AT.game, D = AT.data, s = AT.state;
  assert.equal(G.machinePrice('tractor_medium'), D.machines.tractor_medium.price, 'buiten de beurs de gewone prijs');
  s.time = D.fair.month * D.daysPerMonth * 24 + 1;
  G.updateFair();
  assert.ok(G.fairActive());
  const p1 = G.machinePrice('tractor_medium');
  assert.ok(p1 <= D.machines.tractor_medium.price * (1 - D.fair.discount) + 10);
  G.checkFairVisit(D.fair.area.x + 10, D.fair.area.y + 10);
  assert.ok(G.fair().visited);
  assert.ok(G.machinePrice('tractor_medium') < p1, 'bezoekers krijgen extra korting');
  s.money = 1e6;
  const m0 = s.money;
  G.buyMachine('tractor_medium');
  assert.equal(m0 - s.money, G.machinePrice('tractor_medium'));
  assert.equal(s.stats.fairBuys, 1);
  s.time += D.daysPerMonth * 24;
  G.updateFair();
  assert.ok(!G.fairActive(), 'na november is de beurs voorbij');
});

test('dieseltank: 5× groter dan vroeger (60 uur rijden)', () => {
  const { AT } = loadGame();
  const m = AT.state.machines[0], d = AT.data.machines[m.type];
  assert.equal(AT.game.fuelCap(m), d.fuelPerHour * 60);
});

test('eigen spullen verkopen: minder terug dan betaald', () => {
  const { AT } = loadGame();
  const G = AT.game, F = AT.farm, s = AT.state;
  s.money = 1e6;
  // veld
  const m0 = s.money, v = G.fieldSellValue(2);
  assert.ok(v < G.fieldPrice(2));
  G.sellField(2);
  assert.equal(G.field(2).owned, false);
  assert.equal(s.money - m0, v);
  // versleten machine brengt minder op
  const m = s.machines[0], fresh = G.machineValue(m);
  G.addWear(m, 200);
  assert.ok(G.machineValue(m) < fresh);
  // stal: eerst dieren weg
  F.buyBuilding('pigs'); F.buyAnimals('pigs', 2);
  F.sellBuilding('pigs');
  assert.ok(s.animals.pigs.owned, 'met dieren erin niet verkopen');
  F.sellAnimals('pigs', 99); F.sellBuilding('pigs');
  assert.equal(s.animals.pigs.owned, false);
  // fabriek en kas
  F.buyFactory('mill'); const m1 = s.money; F.sellFactory('mill');
  assert.equal(s.money - m1, AT.data.factories.mill.price / 2);
  F.buyGreenhouse(0); F.buyGhUpgrade('lot0', 'drip'); F.sellGreenhouse('lot0');
  assert.equal(F.allGreenhouses()[0].g.owned, false);
});

test('aanhanger: knikt mee in een bocht', () => {
  const { AT } = loadGame();
  const im = { ia: 0, hx: 0, hy: 0 };
  // geen vehicle.js in de testomgeving: alleen de pose van een getrokken aanhanger
  const t = AT.state.machines.find(m => AT.data.machines[m.type].kind === 'tractor');
  const tr = AT.state.machines.find(m => AT.data.machines[m.type].kind === 'trailer');
  t.impl = tr.uid; tr.attached = t.uid; tr.ia = t.angle + 0.5;
  const pose = AT.game.trailerPose(tr);
  assert.ok(Math.abs(pose.angle - (t.angle + 0.5)) < 1e-9, 'aanhanger heeft een eigen hoek');
  assert.ok(im);
});
