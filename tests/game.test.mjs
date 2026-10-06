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
