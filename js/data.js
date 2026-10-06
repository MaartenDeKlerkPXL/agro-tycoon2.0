// Agro Tycoon 2.0 — speldata
// Alles wat "content" is (gewassen, machines, velden, upgrades, doelen) staat hier.
// Nieuwe extra's toevoegen = meestal alleen een regel in dit bestand.
window.AT = window.AT || {};

AT.data = {
  version: 2,

  // Wereld in pixels (1 px ≈ 1 meter). Velden zijn opgebouwd uit cellen van CELL px.
  world: { w: 2400, h: 1600 },
  CELL: 8,

  start: {
    money: 20000,
    hour: 6,
    machines: ['tractor_small', 'plow_small', 'seeder_small', 'harvester_old'],
    siloLevel: 0,
  },

  // 1 echte seconde = zoveel speluren (bij snelheid 1×)
  hoursPerSecond: 0.5,

  // Gewassen. Prijzen in € per ton, opbrengst in ton per hectare.
  crops: {
    wheat:  { name: 'Tarwe', seedCostPerHa: 120, growDays: 3, yieldPerHa: 8,   basePrice: 220, color: '#e0b84c', growColor: '#7fb24a' },
    barley: { name: 'Gerst', seedCostPerHa: 100, growDays: 2, yieldPerHa: 6.5, basePrice: 200, color: '#d6c27a', growColor: '#8cbf5a' },
    corn:   { name: 'Maïs',  seedCostPerHa: 220, growDays: 5, yieldPerHa: 11,  basePrice: 210, color: '#f2cf3a', growColor: '#4f9a3a' },
  },

  // Machines. kind bepaalt wat ze doen:
  //  tractor   : rijdt en trekt een werktuig (power = vermogen)
  //  plow      : ploegen (stoppel -> geploegd)
  //  seeder    : zaaien (geploegd -> ingezaaid)
  //  harvester : oogsten (rijp -> stoppel), zelfrijdend
  // rate   = hectare per speluur als een loonwerker het doet
  // width  = werkbreedte in px als je zelf rijdt
  // minPower = minimaal tractorvermogen
  // speed  = topsnelheid op de weg (px/s), workSpeed = max snelheid met werktuig omlaag
  machines: {
    tractor_small:  { kind: 'tractor', name: 'Tractor 75 pk',  price: 25000,  power: 1.0, fuelPerHour: 10, speed: 120, color: '#c0392b' },
    tractor_medium: { kind: 'tractor', name: 'Tractor 150 pk', price: 65000,  power: 2.0, fuelPerHour: 18, speed: 150, color: '#2e7d32' },
    tractor_large:  { kind: 'tractor', name: 'Tractor 300 pk', price: 150000, power: 3.5, fuelPerHour: 32, speed: 170, color: '#1565c0' },

    plow_small:   { kind: 'plow',   name: 'Ploeg 3-schaar',  price: 4000,  rate: 0.5, width: 16, workSpeed: 45, minPower: 1.0, color: '#7f8c8d' },
    plow_large:   { kind: 'plow',   name: 'Ploeg 6-schaar',  price: 14000, rate: 1.1, width: 32, workSpeed: 50, minPower: 2.0, color: '#566573' },
    seeder_small: { kind: 'seeder', name: 'Zaaimachine 3 m', price: 6000,  rate: 0.7, width: 24, workSpeed: 55, minPower: 1.0, color: '#2874a6' },
    seeder_large: { kind: 'seeder', name: 'Zaaimachine 6 m', price: 20000, rate: 1.5, width: 48, workSpeed: 60, minPower: 2.0, color: '#1b4f72' },

    harvester_old: { kind: 'harvester', name: 'Maaidorser (oud)', price: 40000,  rate: 0.5, width: 24, speed: 90,  workSpeed: 40, fuelPerHour: 22, color: '#c9a227' },
    harvester_mid: { kind: 'harvester', name: 'Maaidorser 6 m',   price: 120000, rate: 1.2, width: 40, speed: 100, workSpeed: 50, fuelPerHour: 35, color: '#27ae60' },
    harvester_big: { kind: 'harvester', name: 'Maaidorser 9 m',   price: 260000, rate: 2.2, width: 56, speed: 110, workSpeed: 55, fuelPerHour: 50, color: '#d35400' },
  },

  fuelPrice: 1.6,          // € per liter diesel
  workerWagePerHour: 20,   // € per speluur voor een loonwerker

  // Erf met boerderij, silo's en schuur
  yard: { x: 40, y: 600, w: 320, h: 424 },
  shedExit: { x: 372, y: 820, angle: 0 },

  // Wegen (rechthoeken)
  roads: [
    { x: 380, y: 0, w: 24, h: 1600 },
    { x: 1240, y: 0, w: 24, h: 1600 },
    { x: 1880, y: 0, w: 24, h: 1600 },
    { x: 0, y: 560, w: 2400, h: 24 },
    { x: 0, y: 1040, w: 2400, h: 24 },
    { x: 624, y: 584, w: 16, h: 456 },
    { x: 872, y: 584, w: 16, h: 456 },
    { x: 808, y: 0, w: 24, h: 560 },
    { x: 360, y: 280, w: 20, h: 16 },
  ],

  // Velden (veelvouden van CELL). ha wordt berekend uit de oppervlakte.
  fields: [
    { id: 1,  x: 424,  y: 600,  w: 200, h: 128, owned: true },
    { id: 2,  x: 648,  y: 600,  w: 224, h: 176, owned: true },
    { id: 3,  x: 424,  y: 744,  w: 200, h: 280 },
    { id: 4,  x: 648,  y: 792,  w: 224, h: 232 },
    { id: 5,  x: 424,  y: 48,   w: 384, h: 232 },
    { id: 6,  x: 424,  y: 296,  w: 384, h: 248 },
    { id: 7,  x: 48,   y: 48,   w: 312, h: 232 },
    { id: 8,  x: 48,   y: 296,  w: 312, h: 248 },
    { id: 9,  x: 896,  y: 600,  w: 336, h: 424 },
    { id: 10, x: 832,  y: 48,   w: 400, h: 232 },
    { id: 11, x: 832,  y: 296,  w: 400, h: 248 },
    { id: 12, x: 48,   y: 1080, w: 312, h: 472 },
    { id: 13, x: 424,  y: 1080, w: 800, h: 472 },
    { id: 14, x: 1280, y: 48,   w: 584, h: 496 },
    { id: 15, x: 1280, y: 600,  w: 584, h: 424 },
    { id: 16, x: 1280, y: 1080, w: 584, h: 472 },
    { id: 17, x: 1920, y: 48,   w: 440, h: 496 },
    { id: 18, x: 1920, y: 600,  w: 440, h: 424 },
    { id: 19, x: 1920, y: 1080, w: 440, h: 472 },
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
    { id: 'drive',    text: 'Stap in je tractor (tab Garage → Instappen)', reward: 0, check: s => s.stats.drove },
    { id: 'plow1',    text: 'Ploeg 1 ha (spatie = ploeg omlaag)',  reward: 0,     check: s => s.stats.plowedHa >= 1 },
    { id: 'sow1',     text: 'Zaai 1 ha',                            reward: 0,     check: s => s.stats.sownHa >= 1 },
    { id: 'harvest1', text: 'Oogst 1 ha',                           reward: 2000,  check: s => s.stats.harvestedHa >= 1 },
    { id: 'sell1',    text: 'Verkoop graan op de markt',            reward: 1000,  check: s => s.stats.earned > 0 },
    { id: 'worker',   text: 'Laat een loonwerker een veld doen',    reward: 1000,  check: s => s.stats.workerJobs >= 1 },
    { id: 'field3',   text: 'Koop een extra veld',                  reward: 5000,  check: s => s.fields.filter(f => f.owned).length >= 3 },
    { id: 'tractor2', text: 'Koop een tweede tractor',              reward: 5000,  check: s => s.machines.filter(m => AT.data.machines[m.type].kind === 'tractor').length >= 2 },
    { id: 'silo1',    text: 'Vergroot je silo',                     reward: 5000,  check: s => s.siloLevel >= 1 },
    { id: 'earn100k', text: 'Verdien in totaal €100.000',           reward: 10000, check: s => s.stats.earned >= 100000 },
    { id: 'allfields',text: 'Bezit alle velden',                    reward: 25000, check: s => s.fields.every(f => f.owned) },
    { id: 'million',  text: 'Word miljonair (€1.000.000 op de bank)', reward: 0,   check: s => s.money >= 1000000 },
  ],
};

// ha uit oppervlakte (1 px = 1 m → 10.000 px² = 1 ha), afgerond op 0,5
AT.data.fields.forEach(f => {
  f.ha = Math.max(0.5, Math.round((f.w * f.h) / 10000 * 2) / 2);
  f.cols = f.w / AT.data.CELL;
  f.rows = f.h / AT.data.CELL;
});
