// Agro Tycoon 2.0 — speldata
// Alles wat "content" is (gewassen, machines, velden, upgrades, doelen) staat hier.
// Nieuwe extra's toevoegen = meestal alleen een regel in dit bestand.
window.AT = window.AT || {};

AT.data = {
  version: 5,

  // Wereld in pixels (1 px ≈ 1 meter). Velden zijn opgebouwd uit cellen van CELL px.
  world: { w: 2400, h: 1900 },
  CELL: 8,

  start: {
    money: 20000,
    hour: 6,
    // machines met startplek op de parkeerplaats (slot) en wat er aangekoppeld is
    machines: [
      { type: 'tractor_small', slot: 0, impl: 'plow_small' },
      { type: 'seeder_small', slot: 1 },
      { type: 'harvester_old', slot: 4 },
    ],
    farmer: { x: 338, y: 812 },
    siloLevel: 0,
  },

  // 1 echte seconde = zoveel speluren (bij snelheid 1×)
  hoursPerSecond: 0.35,

  // Gewassen. Prijzen in € per ton, opbrengst in ton per hectare.
  // sow          = maanden waarin je mag zaaien (0 = maart … 11 = februari)
  // winterHardy  = overleeft vorst; winterGrowth = groeisnelheid in de winter
  // soilDemand   = hoeveel bodemkwaliteit een volledige oogst kost (negatief = bodem wordt béter)
  // droughtProof = geen last van droogte
  // harvester    = welke machine oogst: 'combine' (maaidorser), 'potato', 'beet' of null (niet oogsten)
  // cheapSeason  = seizoen waarin de prijs laag is (oogsttijd)
  // style        = hoe het gewas er op het veld uitziet
  crops: {
    wheat:     { name: 'Tarwe',       seedCostPerHa: 120, growDays: 3, yieldPerHa: 8,   basePrice: 220, color: '#e0b84c', growColor: '#7fb24a', sow: [0, 1, 6, 7], winterHardy: true, winterGrowth: 0.3, soilDemand: 0.08, harvester: 'combine', cheapSeason: 1, style: 'grain' },
    barley:    { name: 'Gerst',       seedCostPerHa: 100, growDays: 2, yieldPerHa: 6.5, basePrice: 200, color: '#d6c27a', growColor: '#8cbf5a', sow: [0, 1, 2, 3],                                     soilDemand: 0.06, harvester: 'combine', cheapSeason: 1, style: 'barley' },
    oats:      { name: 'Haver',       seedCostPerHa: 90,  growDays: 2, yieldPerHa: 5.5, basePrice: 230, color: '#e3d9a8', growColor: '#93c26a', sow: [0, 1, 2],                                        soilDemand: 0.04, harvester: 'combine', cheapSeason: 1, style: 'oats' },
    corn:      { name: 'Maïs',        seedCostPerHa: 220, growDays: 5, yieldPerHa: 11,  basePrice: 210, color: '#f2cf3a', growColor: '#4f9a3a', sow: [1, 2, 3],                                        soilDemand: 0.12, harvester: 'combine', cheapSeason: 2, style: 'corn' },
    canola:    { name: 'Koolzaad',    seedCostPerHa: 80,  growDays: 5, yieldPerHa: 4,   basePrice: 450, color: '#f2d22e', growColor: '#5e9c3a', sow: [5, 6],       winterHardy: true, winterGrowth: 0.4, soilDemand: 0.1,  harvester: 'combine', cheapSeason: 1, style: 'canola' },
    sunflower: { name: 'Zonnebloem',  seedCostPerHa: 110, growDays: 4, yieldPerHa: 3,   basePrice: 420, color: '#f5b800', growColor: '#5a9a3c', sow: [1, 2],       droughtProof: true,                     soilDemand: 0.07, harvester: 'combine', cheapSeason: 2, style: 'sunflower' },
    soy:       { name: 'Soja',        seedCostPerHa: 130, growDays: 4, yieldPerHa: 3.2, basePrice: 400, color: '#c2a35e', growColor: '#3f7f3a', sow: [1, 2],                                           soilDemand: -0.06, harvester: 'combine', cheapSeason: 2, style: 'soy' },
    beans:     { name: 'Veldbonen',   seedCostPerHa: 150, growDays: 3, yieldPerHa: 4.5, basePrice: 300, color: '#5b4a32', growColor: '#4a8a3f', sow: [0, 1],                                           soilDemand: -0.08, harvester: 'combine', cheapSeason: 1, style: 'beans' },
    potato:    { name: 'Aardappelen', seedCostPerHa: 600, growDays: 4, yieldPerHa: 30,  basePrice: 140, color: '#d8b47a', growColor: '#4f8f3a', sow: [0, 1],                                           soilDemand: 0.1,  harvester: 'potato',  cheapSeason: 2, style: 'potato' },
    beet:      { name: 'Suikerbieten', seedCostPerHa: 250, growDays: 6, yieldPerHa: 40, basePrice: 50,  color: '#efe2d8', growColor: '#3d7a35', sow: [0, 1],                                           soilDemand: 0.1,  harvester: 'beet',    cheapSeason: 2, style: 'beet' },
    clover:    { name: 'Klaver',      seedCostPerHa: 60,  growDays: 2, yieldPerHa: 0,   basePrice: 0,   color: '#e8a3c7', growColor: '#5fa14a', sow: [0, 1, 2, 3, 4, 5, 6],                         soilDemand: 0,    harvester: null, greenManure: 0.3, style: 'clover' },
  },

  // ---------- kalender ----------
  months: ['Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December', 'Januari', 'Februari'],
  daysPerMonth: 2,
  witherAfter: 0.5,   // rijp gewas begint te verwelken als het 50% langer staat dan de groeitijd
  seasonPrice: 0.12,  // prijzen ±12%: goedkoop in oogsttijd, duur een half jaar later

  // ---------- seizoenen & weer ----------
  daysPerSeason: 6,   // = 3 maanden van 2 dagen
  seasons: [
    { name: 'Lente',  icon: '🌱', growth: 1.0,  temp: 13, weather: { sun: 0.35, clouds: 0.3,  rain: 0.3,  storm: 0.05 } },
    { name: 'Zomer',  icon: '☀️', growth: 1.15, temp: 24, weather: { sun: 0.55, clouds: 0.2,  rain: 0.15, storm: 0.1 } },
    { name: 'Herfst', icon: '🍂', growth: 0.8,  temp: 12, weather: { sun: 0.2,  clouds: 0.35, rain: 0.38, storm: 0.07 } },
    { name: 'Winter', icon: '❄️', growth: 0,    temp: 2,  weather: { sun: 0.2,  clouds: 0.35, rain: 0.15, snow: 0.3 } },
  ],
  // growth = groeibonus, moisture = verandering bodemvocht per uur, wet = te nat om te oogsten
  weatherTypes: {
    sun:    { name: 'Zonnig',  icon: '☀️', growth: 1.0,  moisture: -0.010, temp: 3,  wet: false },
    clouds: { name: 'Bewolkt', icon: '⛅', growth: 1.0,  moisture: -0.004, temp: 0,  wet: false },
    rain:   { name: 'Regen',   icon: '🌧️', growth: 1.25, moisture: 0.04,   temp: -3, wet: true },
    storm:  { name: 'Onweer',  icon: '⛈️', growth: 1.1,  moisture: 0.06,   temp: -4, wet: true, damage: true },
    snow:   { name: 'Sneeuw',  icon: '🌨️', growth: 0,    moisture: 0.01,   temp: -4, wet: true },
  },
  droughtBelow: 0.2, // bodemvocht onder deze waarde = droogte (trage groei, minder opbrengst)

  // ---------- bodem ----------
  startSoil: 0.75,          // bodemkwaliteit van een nieuw veld (0..1)
  fertCostPerHa: 90,        // kunstmest per hectare
  fertBonus: 1.25,          // opbrengst ×1,25 met kunstmest
  manurePerHa: 3,           // ton mest per hectare
  manureSoil: 0.3,          // bodemkwaliteit erbij per volledig bemest veld
  manureBonus: 1.1,
  rotationBonus: 1.1,       // ander gewas dan vorige keer
  monoculturePenalty: 0.9,  // zelfde gewas als vorige keer

  // ---------- producten (dieren en fabrieken) ----------
  products: {
    milk:   { name: 'Melk',   unit: 'L',  basePrice: 0.55, decimals: 0 },
    eggs:   { name: 'Eieren', unit: 'st', basePrice: 0.6,  decimals: 0 },
    wool:   { name: 'Wol',    unit: 'kg', basePrice: 6,    decimals: 0 },
    manure: { name: 'Mest',   unit: 't',  basePrice: 15,   decimals: 1 },
    flour:  { name: 'Meel',   unit: 't',  basePrice: 480,  decimals: 1 },
    bread:  { name: 'Brood',  unit: 'st', basePrice: 1.4,  decimals: 0 },
    cheese: { name: 'Kaas',   unit: 'kg', basePrice: 9,    decimals: 0 },
    beer:   { name: 'Bier',   unit: 'L',  basePrice: 1.2,  decimals: 0 },
    oil:    { name: 'Olie',   unit: 'L',  basePrice: 1.5,  decimals: 0 },
    sugar:  { name: 'Suiker', unit: 'kg', basePrice: 0.6,  decimals: 0 },
    chips:  { name: 'Chips',  unit: 'zakken', basePrice: 0.35, decimals: 0 },
  },

  // Dieren: eten graan uit de silo (feeds = voorkeur), produceren per dier per dag
  animals: {
    cows: {
      name: 'Koeien', one: 'koe', building: 'Koeienstal', buildPrice: 25000, capacity: 20, price: 900,
      feedPerDay: 0.04, feeds: ['corn', 'oats', 'barley', 'soy', 'wheat'], produce: { milk: 80, manure: 0.08 },
      pen: { x: 48, y: 1608, w: 400, h: 272 }, barn: { x: 60, y: 1620, w: 130, h: 80 },
    },
    chickens: {
      name: 'Kippen', one: 'kip', building: 'Kippenhok', buildPrice: 8000, capacity: 200, price: 10,
      feedPerDay: 0.0006, feeds: ['wheat', 'corn', 'oats', 'soy', 'barley'], produce: { eggs: 1.5 },
      pen: { x: 470, y: 1608, w: 240, h: 272 }, barn: { x: 482, y: 1620, w: 84, h: 56 },
    },
    sheep: {
      name: 'Schapen', one: 'schaap', building: 'Schaapskooi', buildPrice: 12000, capacity: 40, price: 150,
      feedPerDay: 0.006, feeds: ['oats', 'barley', 'wheat', 'corn'], produce: { wool: 1, manure: 0.01 },
      pen: { x: 732, y: 1608, w: 492, h: 272 }, barn: { x: 744, y: 1620, w: 110, h: 70 },
    },
  },

  // Fabrieken: verwerken per "batch" in → uit, batchesPerDay als alles op voorraad is
  factories: {
    mill:    { name: 'Graanmolen',  price: 45000, in: { wheat: 1 },                out: { flour: 0.85 }, batchesPerDay: 8, costPerBatch: 20,
               lot: { x: 1290, y: 1612, w: 180, h: 130 }, roof: '#b9a27a' },
    bakery:  { name: 'Bakkerij',    price: 70000, in: { flour: 0.2, eggs: 40 },   out: { bread: 250 },  batchesPerDay: 6, costPerBatch: 10,
               lot: { x: 1500, y: 1612, w: 170, h: 120 }, roof: '#c0704a' },
    dairy:   { name: 'Kaasmakerij', price: 55000, in: { milk: 200 },              out: { cheese: 22 },  batchesPerDay: 8, costPerBatch: 5,
               lot: { x: 1690, y: 1612, w: 170, h: 120 }, roof: '#7f9cb0' },
    brewery: { name: 'Brouwerij',   price: 60000, in: { barley: 0.5 },            out: { beer: 300 },   batchesPerDay: 5, costPerBatch: 20,
               lot: { x: 1930, y: 1612, w: 200, h: 130 }, roof: '#8a5a3c' },
    oilpress: { name: 'Oliepers',   price: 50000, in: { canola: 0.5 }, out: { oil: 200 }, alt: [{ in: { sunflower: 0.5 }, out: { oil: 180 } }],
               batchesPerDay: 6, costPerBatch: 15, lot: { x: 2150, y: 1612, w: 200, h: 130 }, roof: '#b8962e' },
    sugar:   { name: 'Suikerfabriek', price: 90000, in: { beet: 5 },              out: { sugar: 800 },  batchesPerDay: 6, costPerBatch: 30,
               lot: { x: 1290, y: 1764, w: 200, h: 112 }, roof: '#d8d3c7' },
    chips:   { name: 'Chipsfabriek', price: 75000, in: { potato: 1, oil: 20 },    out: { chips: 1200 }, batchesPerDay: 6, costPerBatch: 20,
               lot: { x: 1520, y: 1764, w: 190, h: 112 }, roof: '#c0562b' },
  },

  // Machines. kind bepaalt wat ze doen:
  //  tractor   : rijdt en trekt een werktuig (power = vermogen)
  //  plow      : ploegen (stoppel -> geploegd)
  //  seeder    : zaaien (geploegd -> ingezaaid)
  //  spreader  : kunstmest strooien (meer opbrengst), heeft tractor nodig
  //  manure    : mest uitrijden (betere bodem), heeft tractor nodig
  //  harvester : oogsten (rijp -> stoppel), zelfrijdend
  // rate   = hectare per speluur als een loonwerker het doet
  // width  = werkbreedte in px als je zelf rijdt
  // minPower = minimaal tractorvermogen
  // speed  = topsnelheid op de weg (km/u), workSpeed = max snelheid met werktuig omlaag (km/u)
  machines: {
    tractor_small:  { kind: 'tractor', name: 'Tractor 75 pk',  price: 25000,  power: 1.0, fuelPerHour: 10, speed: 30, color: '#c0392b' },
    tractor_medium: { kind: 'tractor', name: 'Tractor 150 pk', price: 65000,  power: 2.0, fuelPerHour: 18, speed: 40, color: '#2e7d32' },
    tractor_large:  { kind: 'tractor', name: 'Tractor 300 pk', price: 150000, power: 3.5, fuelPerHour: 32, speed: 50, color: '#1565c0' },

    plow_small:   { kind: 'plow',   name: 'Ploeg 3-schaar',  price: 4000,  rate: 0.5, width: 16, workSpeed: 8, minPower: 1.0, color: '#7f8c8d' },
    plow_large:   { kind: 'plow',   name: 'Ploeg 6-schaar',  price: 14000, rate: 1.1, width: 32, workSpeed: 10, minPower: 2.0, color: '#566573' },
    seeder_small: { kind: 'seeder', name: 'Zaaimachine 3 m', price: 6000,  rate: 0.7, width: 24, workSpeed: 12, minPower: 1.0, color: '#2874a6' },
    seeder_large: { kind: 'seeder', name: 'Zaaimachine 6 m', price: 20000, rate: 1.5, width: 48, workSpeed: 14, minPower: 2.0, color: '#1b4f72' },

    spreader_fert:   { kind: 'spreader', name: 'Kunstmeststrooier', price: 7000,  rate: 2.0, width: 40, workSpeed: 15, minPower: 1.0, color: '#e67e22' },
    manure_spreader: { kind: 'manure',   name: 'Mestverspreider',   price: 12000, rate: 0.8, width: 20, workSpeed: 10, minPower: 1.0, color: '#6d4c2f' },

    harvester_old: { kind: 'harvester', harvests: 'combine', name: 'Maaidorser (oud)', price: 40000,  rate: 0.5, width: 24, speed: 20,  workSpeed: 7, fuelPerHour: 22, color: '#c9a227' },
    harvester_mid: { kind: 'harvester', harvests: 'combine', name: 'Maaidorser 6 m',   price: 120000, rate: 1.2, width: 40, speed: 22, workSpeed: 8, fuelPerHour: 35, color: '#27ae60' },
    harvester_big: { kind: 'harvester', harvests: 'combine', name: 'Maaidorser 9 m',   price: 260000, rate: 2.2, width: 56, speed: 25, workSpeed: 9, fuelPerHour: 50, color: '#d35400' },
    potato_harvester: { kind: 'harvester', harvests: 'potato', name: 'Aardappelrooier', price: 90000,  rate: 0.6, width: 16, speed: 20, workSpeed: 5, fuelPerHour: 25, color: '#7d4e9e' },
    beet_harvester:   { kind: 'harvester', harvests: 'beet',   name: 'Bietenrooier',    price: 150000, rate: 0.7, width: 24, speed: 20, workSpeed: 6, fuelPerHour: 35, color: '#2c7a7b' },
  },

  fuelPrice: 1.6,          // € per liter diesel
  workerWagePerHour: 20,   // € per speluur voor een loonwerker

  // Erf: boerderij, silo's, machinehal en parkeerplaats voor machines
  yard: { x: 40, y: 600, w: 320, h: 424, gate: { y: 812, h: 52 } },
  house: { x: 56, y: 616, w: 120, h: 84 },
  silos: { x: 226, y: 636, dx: 36, dy: 42, perRow: 4, r: 15 },
  hall: { x: 56, y: 722, w: 294, h: 72 },
  parking: { x: 52, y: 806, w: 300, h: 210 },
  // parkeerplekken (oostwaarts gericht), van de poort af gevuld
  slots: [300, 236, 172, 108].flatMap(x => [834, 884, 934, 984].map(y => ({ x, y }))).sort((a, b) => a.y - b.y || b.x - a.x),
  pond: { x: 200, y: 1118, rx: 120, ry: 36 },

  // snelheden in km/u; zo veel pixels per seconde is 1 km/u op de kaart
  kmhToPx: 1.15,
  walkSpeed: 6, runSpeed: 14,

  // Wegen (rechthoeken)
  roads: [
    { x: 380, y: 0, w: 24, h: 1900 },
    { x: 1240, y: 0, w: 24, h: 1900 },
    { x: 1880, y: 0, w: 24, h: 1900 },
    { x: 0, y: 1568, w: 2400, h: 24 },
    { x: 0, y: 560, w: 2400, h: 24 },
    { x: 0, y: 1040, w: 2400, h: 24 },
    { x: 624, y: 584, w: 16, h: 456 },
    { x: 872, y: 584, w: 16, h: 456 },
    { x: 808, y: 0, w: 24, h: 560 },
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
    { id: 12, x: 48,   y: 1176, w: 312, h: 376 },
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
    { id: 'drive',    text: 'Loop naar je tractor en druk E om in te stappen', reward: 0, check: s => s.stats.drove },
    { id: 'plow1',    text: 'Rij naar Veld 1 en ploeg 1 ha (spatie = ploeg omlaag)',  reward: 0,     check: s => s.stats.plowedHa >= 1 },
    { id: 'sow1',     text: 'Koppel de zaaimachine (F) en zaai 1 ha',                            reward: 0,     check: s => s.stats.sownHa >= 1 },
    { id: 'harvest1', text: 'Oogst 1 ha met de maaidorser',                           reward: 2000,  check: s => s.stats.harvestedHa >= 1 },
    { id: 'sell1',    text: 'Verkoop graan op de markt',            reward: 1000,  check: s => s.stats.earned > 0 },
    { id: 'worker',   text: 'Laat een loonwerker een veld doen',    reward: 1000,  check: s => s.stats.workerJobs >= 1 },
    { id: 'fert',     text: 'Bemest 1 ha (kunstmest of mest) voor meer opbrengst', reward: 2000, check: s => s.stats.fertHa >= 1 },
    { id: 'rotation', text: 'Oogst 1 ha met vruchtwisseling (ander gewas dan de vorige keer)', reward: 2000, check: s => s.stats.rotationHa >= 1 },
    { id: 'crops3',   text: 'Oogst 3 verschillende gewassen',       reward: 3000,  check: s => Object.keys(s.stats.cropsHarvested || {}).length >= 3 },
    { id: 'clover',   text: 'Zaai klaver en ploeg het onder (groenbemester)', reward: 2000, check: s => s.stats.greenManureHa >= 1 },
    { id: 'animals',  text: 'Bouw een stal en koop dieren (tab Bedrijf)', reward: 3000, check: s => Object.values(s.animals).some(a => a.count > 0) },
    { id: 'factory',  text: 'Bouw een fabriek (tab Bedrijf)',        reward: 5000,  check: s => Object.values(s.factories).some(f => f.owned) },
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
