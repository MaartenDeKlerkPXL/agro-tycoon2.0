// Agro Tycoon 2.0 — speldata
// Alles wat "content" is (gewassen, machines, velden, upgrades, doelen) staat hier.
// Nieuwe extra's toevoegen = meestal alleen een regel in dit bestand.
window.AT = window.AT || {};

AT.data = {
  version: 1,

  start: {
    money: 20000,
    day: 1,
    hour: 6,
    machines: ['tractor_small', 'plow_small', 'seeder_small', 'harvester_old'],
    siloLevel: 0,
  },

  // 1 echte seconde = zoveel speluren (bij snelheid 1x)
  hoursPerSecond: 1,

  // Gewassen. Prijzen in € per ton, opbrengst in ton per hectare.
  crops: {
    wheat: {
      name: 'Tarwe', seedCostPerHa: 120, growDays: 3, yieldPerHa: 8,
      basePrice: 220, color: '#e0b84c', growColor: '#7fb24a', unlocked: true,
    },
    barley: {
      name: 'Gerst', seedCostPerHa: 100, growDays: 2, yieldPerHa: 6.5,
      basePrice: 200, color: '#d6c27a', growColor: '#8cbf5a', unlocked: true,
    },
    corn: {
      name: 'Maïs', seedCostPerHa: 220, growDays: 5, yieldPerHa: 11,
      basePrice: 210, color: '#f2cf3a', growColor: '#4f9a3a', unlocked: true,
    },
  },

  // Machines. kind bepaalt welke taak ze kunnen doen.
  //  tractor   : levert vermogen (power) voor werktuigen
  //  plow      : ploegen (stoppel -> geploegd), heeft tractor nodig
  //  seeder    : zaaien (geploegd -> groeiend), heeft tractor nodig
  //  harvester : oogsten (rijp -> stoppel), zelfrijdend
  // rate = hectare per speluur, minPower = minimaal tractorvermogen
  machines: {
    tractor_small:  { kind: 'tractor', name: 'Tractor 75 pk',  price: 25000,  power: 1.0, fuelPerHour: 10, color: '#c0392b' },
    tractor_medium: { kind: 'tractor', name: 'Tractor 150 pk', price: 65000,  power: 2.0, fuelPerHour: 18, color: '#2e7d32' },
    tractor_large:  { kind: 'tractor', name: 'Tractor 300 pk', price: 150000, power: 3.5, fuelPerHour: 32, color: '#1565c0' },

    plow_small:     { kind: 'plow',   name: 'Ploeg 3-schaar',     price: 4000,  rate: 0.5, minPower: 1.0, color: '#7f8c8d' },
    plow_large:     { kind: 'plow',   name: 'Ploeg 6-schaar',     price: 14000, rate: 1.1, minPower: 2.0, color: '#566573' },
    seeder_small:   { kind: 'seeder', name: 'Zaaimachine 3 m',    price: 6000,  rate: 0.7, minPower: 1.0, color: '#2874a6' },
    seeder_large:   { kind: 'seeder', name: 'Zaaimachine 6 m',    price: 20000, rate: 1.5, minPower: 2.0, color: '#1b4f72' },

    harvester_old:  { kind: 'harvester', name: 'Maaidorser (oud)',  price: 40000,  rate: 0.5, fuelPerHour: 22, color: '#c9a227' },
    harvester_mid:  { kind: 'harvester', name: 'Maaidorser 6 m',    price: 120000, rate: 1.2, fuelPerHour: 35, color: '#27ae60' },
    harvester_big:  { kind: 'harvester', name: 'Maaidorser 9 m',    price: 260000, rate: 2.2, fuelPerHour: 50, color: '#d35400' },
  },

  // Brandstof voor werktuigen die door een tractor getrokken worden komt van de tractor.
  fuelPrice: 1.6, // € per liter

  // Velden op de kaart (pixels op het 1000x560 canvas)
  fields: [
    { id: 1, x: 250, y: 30,  w: 200, h: 150, ha: 2, owned: true },
    { id: 2, x: 470, y: 30,  w: 230, h: 150, ha: 3, owned: true },
    { id: 3, x: 720, y: 30,  w: 260, h: 150, ha: 4 },
    { id: 4, x: 250, y: 200, w: 200, h: 150, ha: 3 },
    { id: 5, x: 470, y: 200, w: 230, h: 150, ha: 4 },
    { id: 6, x: 720, y: 200, w: 260, h: 150, ha: 5 },
    { id: 7, x: 250, y: 370, w: 330, h: 170, ha: 6 },
    { id: 8, x: 600, y: 370, w: 380, h: 170, ha: 8 },
  ],
  landPricePerHa: 9000,

  // Silo-niveaus: capaciteit in ton en prijs om naar dat niveau te gaan
  silo: [
    { capacity: 60,   price: 0 },
    { capacity: 150,  price: 15000 },
    { capacity: 300,  price: 40000 },
    { capacity: 600,  price: 90000 },
    { capacity: 1200, price: 200000 },
  ],

  // Markt: prijsfactor beweegt dagelijks tussen min en max
  market: { minFactor: 0.7, maxFactor: 1.35, volatility: 0.08 },

  // Doelen / tutorial. check(state) => true als behaald.
  goals: [
    { id: 'plow1',    text: 'Ploeg een veld (klik op Veld 1)',     reward: 0,     check: s => s.stats.plowed >= 1 },
    { id: 'sow1',     text: 'Zaai een gewas',                       reward: 0,     check: s => s.stats.sown >= 1 },
    { id: 'harvest1', text: 'Oogst je eerste gewas',                reward: 2000,  check: s => s.stats.harvested >= 1 },
    { id: 'sell1',    text: 'Verkoop graan op de markt',            reward: 1000,  check: s => s.stats.earned > 0 },
    { id: 'field3',   text: 'Koop een extra veld',                  reward: 5000,  check: s => s.fields.filter(f => f.owned).length >= 3 },
    { id: 'tractor2', text: 'Koop een tweede tractor',              reward: 5000,  check: s => s.machines.filter(m => AT.data.machines[m.type].kind === 'tractor').length >= 2 },
    { id: 'silo1',    text: 'Vergroot je silo',                     reward: 5000,  check: s => s.siloLevel >= 1 },
    { id: 'earn100k', text: 'Verdien in totaal €100.000',           reward: 10000, check: s => s.stats.earned >= 100000 },
    { id: 'allfields',text: 'Bezit alle velden',                    reward: 25000, check: s => s.fields.every(f => f.owned) },
    { id: 'million',  text: 'Word miljonair (€1.000.000 op de bank)', reward: 0,   check: s => s.money >= 1000000 },
  ],
};
