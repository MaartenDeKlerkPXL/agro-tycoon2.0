// Agro Tycoon 2.0 — speldata
// Alles wat "content" is (gewassen, machines, velden, upgrades, doelen) staat hier.
// Nieuwe extra's toevoegen = meestal alleen een regel in dit bestand.
window.AT = window.AT || {};

AT.data = {
  version: 14,

  // Wereld in pixels (1 px ≈ 1 meter). Velden zijn opgebouwd uit cellen van CELL px.
  world: { w: 3500, h: 1900 },   // met de Oostpolder (velden 20–26) achter de haven
  CELL: 8,

  start: {
    money: 20000,
    hour: 6,
    // machines met startplek op de parkeerplaats (slot) en wat er aangekoppeld is
    machines: [
      { type: 'tractor_small', slot: 0, impl: 'plow_small' },
      { type: 'seeder_small', slot: 1 },
      { type: 'harvester_old', slot: 4 },
      { type: 'trailer_small', slot: 2 },
    ],
    farmer: { x: 338, y: 812 },
    siloLevel: 0,
  },

  // 1 echte seconde = 1 speelminuut (bij snelheid 1×)
  hoursPerSecond: 1 / 60,
  speeds: [1, 5, 20, 60],   // knoppen 1×/5×/20×/60× (toetsen 1–4)

  // Gewassen. Prijzen in € per ton, opbrengst in ton per hectare.
  // sow          = maanden waarin je mag zaaien (0 = maart … 11 = februari)
  // winterHardy  = overleeft vorst; winterGrowth = groeisnelheid in de winter
  // soilDemand   = hoeveel bodemkwaliteit een volledige oogst kost (negatief = bodem wordt béter)
  // droughtProof = geen last van droogte
  // harvester    = welke machine oogst: 'combine' (maaidorser), 'potato', 'beet' of null (niet oogsten)
  // cheapMonth   = maand waarin de prijs het laagst is (oogsttijd); een half jaar later het hoogst
  // planter      = welke zaaimachine nodig is ('potato' pootmachine, 'beet' bietenzaaier, anders gewone zaaimachine)
  // gras         = maaien → (schudden) → drogen → persen tot hooi; groeit daarna vanzelf weer aan
  // style        = hoe het gewas er op het veld uitziet
  crops: {
    wheat:     { name: 'Tarwe',       seedCostPerHa: 120, growDays: 3, yieldPerHa: 8,   basePrice: 220, color: '#e0b84c', growColor: '#7fb24a', sow: [0, 1, 6, 7], winterHardy: true, winterGrowth: 0.3, soilDemand: 0.08, harvester: 'combine', cheapMonth: 5, style: 'grain' },
    barley:    { name: 'Gerst',       seedCostPerHa: 100, growDays: 2, yieldPerHa: 6.5, basePrice: 200, color: '#d6c27a', growColor: '#8cbf5a', sow: [0, 1, 2, 3],                                     soilDemand: 0.06, harvester: 'combine', cheapMonth: 4, style: 'barley' },
    oats:      { name: 'Haver',       seedCostPerHa: 90,  growDays: 2, yieldPerHa: 5.5, basePrice: 230, color: '#e3d9a8', growColor: '#93c26a', sow: [0, 1, 2],                                        soilDemand: 0.04, harvester: 'combine', cheapMonth: 5, style: 'oats' },
    corn:      { name: 'Maïs',        seedCostPerHa: 220, growDays: 5, yieldPerHa: 11,  basePrice: 210, color: '#f2cf3a', growColor: '#4f9a3a', sow: [1, 2, 3],                                        soilDemand: 0.12, harvester: 'combine', cheapMonth: 7, style: 'corn' },
    canola:    { name: 'Koolzaad',    seedCostPerHa: 80,  growDays: 5, yieldPerHa: 4,   basePrice: 450, color: '#f2d22e', growColor: '#5e9c3a', sow: [5, 6],       winterHardy: true, winterGrowth: 0.4, soilDemand: 0.1,  harvester: 'combine', cheapMonth: 4, style: 'canola' },
    sunflower: { name: 'Zonnebloem',  seedCostPerHa: 110, growDays: 4, yieldPerHa: 3,   basePrice: 420, color: '#f5b800', growColor: '#5a9a3c', sow: [1, 2],       droughtProof: true,                     soilDemand: 0.07, harvester: 'combine', cheapMonth: 6, style: 'sunflower' },
    soy:       { name: 'Soja',        seedCostPerHa: 130, growDays: 4, yieldPerHa: 3.2, basePrice: 400, color: '#c2a35e', growColor: '#3f7f3a', sow: [1, 2],                                           soilDemand: -0.06, harvester: 'combine', cheapMonth: 7, style: 'soy' },
    beans:     { name: 'Veldbonen',   seedCostPerHa: 150, growDays: 3, yieldPerHa: 4.5, basePrice: 300, color: '#5b4a32', growColor: '#4a8a3f', sow: [0, 1],                                           soilDemand: -0.08, harvester: 'combine', cheapMonth: 5, style: 'beans' },
    potato:    { name: 'Aardappelen', seedCostPerHa: 600, growDays: 4, yieldPerHa: 30,  basePrice: 140, color: '#d8b47a', growColor: '#4f8f3a', sow: [0, 1],                                           soilDemand: 0.1,  harvester: 'potato',  planter: 'potato', cheapMonth: 6, style: 'potato' },
    beet:      { name: 'Suikerbieten', seedCostPerHa: 250, growDays: 6, yieldPerHa: 40, basePrice: 50,  color: '#efe2d8', growColor: '#3d7a35', sow: [0, 1],                                           soilDemand: 0.1,  harvester: 'beet',    planter: 'beet', cheapMonth: 8, style: 'beet' },
    grass:     { name: 'Gras',        seedCostPerHa: 90,  growDays: 2, yieldPerHa: 6,   basePrice: 0,   color: '#7fbf4f', growColor: '#6aae45', sow: [0, 1, 2, 3, 4, 5, 6],                         soilDemand: 0.03, harvester: 'grass', perennial: true, style: 'grass' },
    clover:    { name: 'Klaver',      seedCostPerHa: 60,  growDays: 2, yieldPerHa: 0,   basePrice: 0,   color: '#e8a3c7', growColor: '#5fa14a', sow: [0, 1, 2, 3, 4, 5, 6],                         soilDemand: 0,    harvester: null, greenManure: 0.3, style: 'clover' },
  },

  // ---------- kalender ----------
  months: ['Maart', 'April', 'Mei', 'Juni', 'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December', 'Januari', 'Februari'],
  daysPerMonth: 2,
  witherAfter: 0.5,   // rijp gewas begint te verwelken als het 50% langer staat dan de groeitijd
  seasonPrice: 0.15,  // prijzen ±15% door het jaar: goedkoop in de oogstmaand, duur een half jaar later
  hayDryHours: 16,    // gemaaid gras droogt in 16 uur (in 6 uur als je het schudt)
  hayDryRate: { sun: 1.15, clouds: 0.7, rain: 0.1, storm: 0.05, snow: 0.05 },  // regen vertraagt het drogen
  baleTons: 0.4,      // één ronde baal hooi; zelf persen = balen op het veld die je ophaalt met een aanhanger
  baleCollectCost: 8, // balen laten ophalen (per baal)

  // ---------- economie ----------
  saturation: { perEuro: 1 / 400000, max: 0.4, recovery: 0.85 }, // veel verkopen drukt de prijs tijdelijk
  bank: { ratePerDay: 0.004, steps: [10000, 50000, 100000], maxShare: 0.5, base: 50000 },
  contracts: { offers: 3, refreshDays: 4, minDays: 6, maxDays: 12, fine: 0.15 },
  // oogstverzekering: premie per hectare per dag, keert 80% uit van storm- en vorstschade
  insurance: { premiumPerHa: 5, cover: 0.8 },
  // grond pachten: huur per dag als deel van de koopprijs
  leaseRate: 0.008,
  // werknemer met de vrachtwagen: externe chauffeur kost per rit
  truckDriverFee: 150,
  // opslagloods voor producten (in pallets); mest heeft een eigen mestput
  warehouse: [
    { pallets: 30, price: 0 }, { pallets: 80, price: 20000 }, { pallets: 200, price: 60000 }, { pallets: 500, price: 150000 },
  ],
  dock: { x: 150, y: 796, w: 80, h: 12 },  // laadperron bij de machinehal (vrachtwagen laden met U)
  // verkooppunten op de kaart: wat ze kopen en hoeveel extra (×) ze betalen
  sellPoints: {
    trader:  { name: 'Graanhandel',    kind: 'crops', mult: {}, roof: '#3f6e8c' },
    feed:    { name: 'Veevoerbedrijf', kind: 'mixed', only: ['corn', 'barley', 'oats', 'soy', 'beans', 'hay'],
               mult: { corn: 1.08, barley: 1.08, oats: 1.1, soy: 1.1, beans: 1.05, hay: 1.15 }, roof: '#6d8f3a',
               lot: { x: 2450, y: 620, w: 230, h: 200 }, pit: { x: 2462, y: 690, w: 74, h: 22 } },
    harbor:  { name: 'Haven',          kind: 'mixed', only: ['wheat', 'canola', 'sunflower', 'soy', 'sugar', 'planks', 'oil', 'wine', 'apples'],
               mult: { wheat: 1.08, canola: 1.1, sunflower: 1.08, soy: 1.06, sugar: 1.05, planks: 1.1, oil: 1.1, wine: 1.12, apples: 1.05 }, roof: '#5a6b7c',
               lot: { x: 2450, y: 1250, w: 240, h: 300 }, pit: { x: 2462, y: 1280, w: 74, h: 22 } },
    shop:    { name: 'Supermarkt',     kind: 'products', mult: {}, roof: '#c0392b',
               lot: { x: 2450, y: 60, w: 230, h: 180 }, pit: { x: 2462, y: 130, w: 74, h: 22 } },
  },

  // kassen: hele jaar groenten, in de winter hogere stookkosten
  // heat = hoeveel stookkosten het gewas vraagt; omschakelen kost nieuwe planten (plantCost) en een dag aanloop
  greenhouse: {
    price: 45000,
    crops: {
      tomatoes:     { perDay: 300, heat: 1 },
      lettuce:      { perDay: 500, heat: 0.7 },
      cucumbers:    { perDay: 520, heat: 1 },
      peppers:      { perDay: 200, heat: 1.1 },
      strawberries: { perDay: 110, heat: 1.2 },
      herbs:        { perDay: 260, heat: 0.8 },
      tulips:       { perDay: 650, heat: 0.6 },
    },
    plantCost: 600,
    energyPerDay: [40, 30, 60, 160],   // per seizoen
    winterLight: 0.7,                  // zonder groeilampen groeit het in de winter minder
    upgrades: {
      led:  { name: 'Groeilampen (LED)', price: 15000, desc: '+20% productie en geen winterdip · +€35/dag stroom', grow: 1.2, power: 35 },
      chp:  { name: 'Warmtekrachtkoppeling', price: 20000, desc: 'stookkosten −50%', heatCut: 0.5 },
      drip: { name: 'Druppelirrigatie + klimaatcomputer', price: 8000, desc: '+15% productie', grow: 1.15 },
      layers: { name: 'Teelt in lagen', price: 25000, desc: 'stellingen met meerdere lagen: +50% productie, +30% stookkosten', grow: 1.5, heat: 1.3 },
    },
    lots: [{ x: 1016, y: 1612, w: 200, h: 124 }, { x: 1016, y: 1748, w: 200, h: 124 }],
  },
  // boomgaard en wijngaard: vruchten groeien in de zomer, oogsten in de oogstmaanden
  // (zelf plukken met H, of plukkers inhuren). Wat je niet plukt, rot aan het eind van de oogsttijd.
  plantations: {
    orchard:  { name: 'Boomgaard', plant: 'boom', plants: 'bomen', price: 60000, area: { x: 2448, y: 846, w: 236, h: 182 },
                product: 'apples', perPlant: 1200, grow: [1, 2, 3, 4], harvest: [5, 6, 7], pickCost: 40, machineCost: 12, spacing: [24, 22] },
    vineyard: { name: 'Wijngaard', plant: 'wijnstok', plants: 'wijnstokken', price: 70000, area: { x: 2448, y: 1600, w: 236, h: 284 },
                product: 'grapes', perPlant: 90, grow: [1, 2, 3, 4, 5], harvest: [6, 7], pickCost: 4, machineCost: 1.2, spacing: [9, 16] },
  },
  // bosperceel: bomen groeien, kappen geeft hout (te voet: H bij een boom)
  woodlot: { price: 40000, area: { x: 2075, y: 1762, w: 305, h: 126 }, growDays: 8, woodPerTree: 2.5, cutCost: 15 },

  // landbouwbeurs: elk jaar in november op de kade bij de haven. Alle machines goedkoper, een paar
  // beursaanbiedingen met flinke korting, en extra korting als je zelf langsgaat (lopen of rijden)
  fair: {
    month: 8, discount: 0.1, deals: 4, dealMin: 0.2, dealMax: 0.3, visitBonus: 0.05,
    area: { x: 2454, y: 1406, w: 96, h: 138 },
  },

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
  // zuurgraad (pH): elke oogst en kunstmest maken de bodem zuurder; kalk strooien maakt hem weer goed
  soilPh: { start: 6.4, good: 6.3, min: 4.8, max: 7.5, perHarvest: 0.15, perFert: 0.05, perLime: 1.0 },
  limeCostPerHa: 60,
  // onkruid, ziektes en plagen (0..1). Zolang ze er zijn kost het elke dag opbrengst; spuiten haalt ze weg
  pests: { weedsPerDay: 0.14, diseaseWet: 0.2, pestsSummer: 0.14, lossPerDay: 0.07, maxLoss: 0.5, warnAt: 0.35 },
  sprayCostPerHa: 70,
  // irrigatie: geen last van droogte (groei en opbrengst), kost water tijdens droogte
  irrigation: { pricePerHa: 1200, waterPerHaDay: 25 },
  compaction: 0.85,         // over natte grond gereden: 15% minder opbrengst tot je ploegt

  // ---------- producten (dieren en fabrieken) ----------
  products: {
    // perPallet = hoeveel er op één pallet in de opslagloods past
    milk:   { name: 'Melk',   unit: 'L',  basePrice: 0.55, decimals: 0, perPallet: 1000 },
    eggs:   { name: 'Eieren', unit: 'st', basePrice: 0.6,  decimals: 0, perPallet: 3000 },
    wool:   { name: 'Wol',    unit: 'kg', basePrice: 6,    decimals: 0, perPallet: 300 },
    manure: { name: 'Mest',   unit: 't',  basePrice: 15,   decimals: 1, perPallet: 0 },   // mestput, telt niet mee
    flour:  { name: 'Meel',   unit: 't',  basePrice: 480,  decimals: 1, perPallet: 1 },
    bread:  { name: 'Brood',  unit: 'st', basePrice: 1.4,  decimals: 0, perPallet: 800 },
    cheese: { name: 'Kaas',   unit: 'kg', basePrice: 9,    decimals: 0, perPallet: 400 },
    beer:   { name: 'Bier',   unit: 'L',  basePrice: 1.2,  decimals: 0, perPallet: 1000 },
    oil:    { name: 'Olie',   unit: 'L',  basePrice: 1.8,  decimals: 0, perPallet: 1000 },
    sugar:  { name: 'Suiker', unit: 'kg', basePrice: 0.6,  decimals: 0, perPallet: 1000 },
    chips:  { name: 'Chips',  unit: 'zakken', basePrice: 0.35, decimals: 0, perPallet: 1500 },
    hay:    { name: 'Hooi',   unit: 't',  basePrice: 120,  decimals: 1, perPallet: 1, cheapMonth: 3, color: '#cdb86a' },
    wood:   { name: 'Hout',   unit: 'm³', basePrice: 70,   decimals: 1, perPallet: 2 },
    planks: { name: 'Planken', unit: 'm³', basePrice: 260, decimals: 1, perPallet: 2 },
    tomatoes: { name: 'Tomaten', unit: 'kg', basePrice: 1.6, decimals: 0, perPallet: 500, cheapMonth: 4 },
    lettuce:  { name: 'Sla',     unit: 'krop', basePrice: 0.8, decimals: 0, perPallet: 1000, cheapMonth: 3 },
    cucumbers: { name: 'Komkommers', unit: 'st', basePrice: 0.62, decimals: 0, perPallet: 1200, cheapMonth: 4 },
    peppers:  { name: 'Paprika',  unit: 'kg', basePrice: 2.4, decimals: 0, perPallet: 600, cheapMonth: 5 },
    strawberries: { name: 'Aardbeien', unit: 'kg', basePrice: 4.4, decimals: 0, perPallet: 400, cheapMonth: 3 },
    herbs:    { name: 'Kruiden',  unit: 'potjes', basePrice: 1.6, decimals: 0, perPallet: 1200, cheapMonth: 4 },
    tulips:   { name: 'Tulpen',   unit: 'stelen', basePrice: 0.55, decimals: 0, perPallet: 2500, cheapMonth: 1 },
    apples:   { name: 'Appels',  unit: 'kg', basePrice: 0.45, decimals: 0, perPallet: 1000, cheapMonth: 6, color: '#c0392b' },
    grapes:   { name: 'Druiven', unit: 'kg', basePrice: 0.9,  decimals: 0, perPallet: 1000, cheapMonth: 7, color: '#6c3483' },
    silage:   { name: 'Kuilvoer', unit: 't', basePrice: 180, decimals: 1, perPallet: 2, color: '#7a8f3a' },
    feedmix:  { name: 'Mengvoer', unit: 't', basePrice: 330, decimals: 1, perPallet: 1, color: '#c49a5a' },
    wine:     { name: 'Wijn',    unit: 'L',  basePrice: 3.8,  decimals: 0, perPallet: 600, color: '#7b241c' },
  },

  // Dieren eten uit hun voerbak (zelf vullen met een aanhanger: U bij de voerbak) of, als
  // "automatisch voeren" aan staat, uit de silo/opslagloods (kost voerdienst per ton).
  // feeds = voorkeursvolgorde; births = jongen per dier per dag; sellPrice = verkoopprijs per dier
  // trough = inhoud voerbak (ton); mengvoer en kuilvoer geven meer productie (feedBonus)
  animals: {
    cows: {
      name: 'Koeien', one: 'koe', young: 'kalfjes', building: 'Koeienstal', buildPrice: 25000, capacity: 20, price: 900, sellPrice: 700,
      feedPerDay: 0.04, feeds: ['feedmix', 'silage', 'hay', 'corn', 'oats', 'barley', 'soy', 'wheat'], produce: { milk: 80, manure: 0.08 },
      births: 0.025, trough: 8,
      pen: { x: 48, y: 1608, w: 400, h: 272 }, barn: { x: 60, y: 1620, w: 130, h: 80 },
    },
    chickens: {
      name: 'Kippen', one: 'kip', young: 'kuikens', building: 'Kippenhok', buildPrice: 8000, capacity: 200, price: 10, sellPrice: 7,
      feedPerDay: 0.0006, feeds: ['feedmix', 'wheat', 'corn', 'oats', 'soy', 'barley'], produce: { eggs: 1.5 },
      births: 0.06, trough: 2,
      // eieren komen in de legnesten; rapen met H bij het kippenhok, laten rapen, of een eierband (automatisch)
      nest: { good: 'eggs', cap: 600, collectCost: 0.03, beltPrice: 6000, winterLay: 0.7 },
      pen: { x: 470, y: 1608, w: 240, h: 272 }, barn: { x: 482, y: 1620, w: 84, h: 56 },
    },
    sheep: {
      name: 'Schapen', one: 'schaap', young: 'lammetjes', building: 'Schaapskooi', buildPrice: 12000, capacity: 40, price: 150, sellPrice: 120,
      feedPerDay: 0.006, feeds: ['feedmix', 'silage', 'hay', 'oats', 'barley', 'wheat', 'corn'], produce: { manure: 0.01 },
      births: 0.04, trough: 3,
      // wol groeit op de schapen (vol in growDays dagen); scheren met H in de wei of een scheerder inhuren
      fleece: { good: 'wool', perAnimal: 12, growDays: 12, minShear: 0.25, shearCost: 4, perPress: 5 },
      graze: 0.6,   // buiten de winter halen ze 60% van hun eten uit de wei
      pen: { x: 732, y: 1608, w: 268, h: 272 }, barn: { x: 744, y: 1620, w: 110, h: 70 },
    },
    pigs: {
      name: 'Varkens', one: 'varken', young: 'biggetjes', building: 'Varkensstal', buildPrice: 20000, capacity: 40, price: 120, sellPrice: 240,
      feedPerDay: 0.01, feeds: ['feedmix', 'corn', 'barley', 'wheat', 'potato', 'soy'], produce: { manure: 0.015 },
      births: 0.1, trough: 5,
      pen: { x: 2448, y: 1072, w: 236, h: 168 }, barn: { x: 2460, y: 1084, w: 104, h: 62 },
    },
  },
  feedBonus: { feedmix: 1.3, silage: 1.15 },  // betere productie met mengvoer/kuilvoer
  feedServicePerTon: 40,    // automatisch voeren uit silo/loods kost €40 per ton
  barnLevels: [1, 2, 3],    // stal uitbreiden: ×2 en ×3 zoveel plek
  vetBase: 60, vetPerAnimal: 4,

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
    sawmill: { name: 'Zagerij',     price: 40000, in: { wood: 2 },                out: { planks: 1.5 }, batchesPerDay: 6, costPerBatch: 15,
               lot: { x: 1912, y: 1764, w: 150, h: 112 }, roof: '#7b5a3a' },
    winery:  { name: 'Wijnmakerij', price: 80000, in: { grapes: 150 },            out: { wine: 100 },   batchesPerDay: 8, costPerBatch: 25,
               lot: { x: 2448, y: 252, w: 236, h: 128 }, roof: '#7b241c' },
    silage:  { name: 'Sleufsilo (kuilvoer)', price: 25000, in: { corn: 1 }, out: { silage: 1.25 }, alt: [{ in: { hay: 0.8 }, out: { silage: 1 } }],
               batchesPerDay: 10, costPerBatch: 5, lot: { x: 2448, y: 474, w: 236, h: 78 }, roof: '#5f6a4a' },
    feedmix: { name: 'Veevoermengerij', price: 50000, in: { silage: 0.5, barley: 0.3, soy: 0.2 }, out: { feedmix: 1 },
               alt: [{ in: { silage: 0.5, oats: 0.3, beans: 0.2 }, out: { feedmix: 1 } }, { in: { corn: 0.5, wheat: 0.3, soy: 0.2 }, out: { feedmix: 0.9 } }],
               batchesPerDay: 8, costPerBatch: 10, lot: { x: 2448, y: 392, w: 236, h: 74 }, roof: '#8d6e3f' },
    chips:   { name: 'Chipsfabriek', price: 75000, in: { potato: 1, oil: 20 },    out: { chips: 1200 }, batchesPerDay: 6, costPerBatch: 20,
               lot: { x: 1520, y: 1764, w: 190, h: 112 }, roof: '#c0562b' },
  },

  // Machines. kind bepaalt wat ze doen:
  //  tractor   : rijdt en trekt een werktuig (power = vermogen)
  //  plow      : ploegen (stoppel -> geploegd)
  //  seeder    : zaaien (geploegd -> ingezaaid)
  //  spreader  : kunstmest strooien (meer opbrengst), heeft tractor nodig
  //  manure    : mest uitrijden (betere bodem), heeft tractor nodig
  //  trailer   : aanhanger voor graan (capacity in ton), lossen met U
  //  mower/tedder/baler: gras maaien, schudden en tot hooi persen
  //  truck     : vrachtwagen voor producten (pallets), laden bij het laadperron, lossen bij een verkooppunt
  //  harvester : oogsten (rijp -> stoppel), zelfrijdend, met graanbunker (tank in ton)
  // rate   = hectare per speluur als een loonwerker het doet
  // width  = werkbreedte in px als je zelf rijdt
  // minPower = minimaal tractorvermogen
  // speed  = topsnelheid op de weg (km/u), workSpeed = max snelheid met werktuig omlaag (km/u)
  machines: {
    tractor_old:    { kind: 'tractor', name: 'Oldtimer 50 pk',  price: 9000,   power: 0.7, fuelPerHour: 6,  speed: 25, color: '#8a9a3b', old: true, wearRate: 2 },
    tractor_small:  { kind: 'tractor', name: 'Tractor 75 pk',  price: 25000,  power: 1.0, fuelPerHour: 10, speed: 30, color: '#c0392b' },
    tractor_medium: { kind: 'tractor', name: 'Tractor 150 pk', price: 65000,  power: 2.0, fuelPerHour: 18, speed: 40, color: '#2e7d32' },
    tractor_200:    { kind: 'tractor', name: 'Tractor 200 pk', price: 95000,  power: 2.6, fuelPerHour: 24, speed: 45, color: '#e67e22' },
    tractor_large:  { kind: 'tractor', name: 'Tractor 300 pk', price: 150000, power: 3.5, fuelPerHour: 32, speed: 50, color: '#1565c0' },
    tractor_crawler: { kind: 'tractor', name: 'Rupstrekker 400 pk', price: 240000, power: 5.0, fuelPerHour: 42, speed: 40, color: '#34495e', tracks: true },

    plow_small:   { kind: 'plow',   name: 'Ploeg 3-schaar',  price: 4000,  rate: 0.5, width: 16, workSpeed: 8, minPower: 0.7, color: '#7f8c8d' },
    plow_large:   { kind: 'plow',   name: 'Ploeg 6-schaar',  price: 14000, rate: 1.1, width: 32, workSpeed: 10, minPower: 2.0, color: '#566573' },
    plow_huge:    { kind: 'plow',   name: 'Ploeg 10-schaar', price: 30000, rate: 2.0, width: 52, workSpeed: 11, minPower: 3.5, color: '#2c3e50' },
    cultivator:       { kind: 'cultivator', name: 'Cultivator 4 m', price: 11000, rate: 1.6, width: 32, workSpeed: 14, minPower: 1.0, color: '#b03a2e' },
    cultivator_large: { kind: 'cultivator', name: 'Cultivator 9 m', price: 36000, rate: 3.6, width: 72, workSpeed: 16, minPower: 3.5, color: '#1f618d' },
    roller:       { kind: 'roller', name: 'Rol 6 m',         price: 6000,  rate: 2.4, width: 48, workSpeed: 15, minPower: 0.7, color: '#7f8c8d' },
    stonepicker:  { kind: 'stonepicker', name: 'Stenenraper', price: 14000, rate: 1.0, width: 20, workSpeed: 8,  minPower: 1.0, color: '#d35400' },
    seeder_small: { kind: 'seeder', sows: 'seeder', name: 'Zaaimachine 3 m', price: 6000,  rate: 0.7, width: 24, workSpeed: 12, minPower: 0.7, color: '#2874a6' },
    seeder_large: { kind: 'seeder', sows: 'seeder', name: 'Zaaimachine 6 m', price: 20000, rate: 1.5, width: 48, workSpeed: 14, minPower: 2.0, color: '#1b4f72' },

    potato_planter: { kind: 'seeder', sows: 'potato', name: 'Aardappelpootmachine', price: 18000, rate: 0.6, width: 12, workSpeed: 8,  minPower: 1.0, color: '#7d4e9e' },
    beet_seeder:    { kind: 'seeder', sows: 'beet',   name: 'Bietenzaaier',         price: 16000, rate: 0.9, width: 18, workSpeed: 10, minPower: 1.0, color: '#2c7a7b' },
    mower:   { kind: 'mower',  name: 'Maaier 3 m',  price: 9000,  rate: 1.2, width: 22, workSpeed: 14, minPower: 0.7, color: '#c0392b' },
    tedder:  { kind: 'tedder', name: 'Schudder',    price: 7000,  rate: 1.6, width: 30, workSpeed: 14, minPower: 0.7, color: '#e67e22' },
    baler:   { kind: 'baler',  name: 'Balenpers',   price: 28000, rate: 0.8, width: 10, workSpeed: 10, minPower: 1.0, color: '#2e7d32' },
    truck:   { kind: 'truck',  name: 'Vrachtwagen', price: 60000, pallets: 12, speed: 70, fuelPerHour: 25, color: '#34495e' },

    spreader_fert:   { kind: 'spreader', name: 'Kunstmeststrooier', price: 7000,  rate: 2.0, width: 40, workSpeed: 15, minPower: 0.7, color: '#e67e22' },
    manure_spreader: { kind: 'manure',   name: 'Mestverspreider',   price: 12000, rate: 0.8, width: 20, workSpeed: 10, minPower: 1.0, color: '#6d4c2f' },
    lime_spreader:   { kind: 'lime',     name: 'Kalkstrooier',      price: 8000,  rate: 1.8, width: 36, workSpeed: 14, minPower: 1.0, color: '#9aa3a8' },
    sprayer:         { kind: 'sprayer',  name: 'Spuitmachine 24 m', price: 15000, rate: 3.0, width: 48, workSpeed: 16, minPower: 1.0, color: '#2e86c1' },

    mixer_wagon:   { kind: 'mixer',   name: 'Voermengwagen 6 t',   price: 22000, capacity: 6,  width: 16, length: 18, minPower: 1.0, color: '#16a085' },
    trailer_small: { kind: 'trailer', name: 'Kipper 8 t',          price: 6000,  capacity: 8,  width: 14, length: 16, minPower: 0.7, color: '#b03a2e' },
    trailer_large: { kind: 'trailer', name: 'Kipper 16 t',         price: 14000, capacity: 16, width: 16, length: 20, minPower: 2.0, color: '#2e86c1' },
    trailer_huge:  { kind: 'trailer', name: 'Overlaadwagen 30 t',  price: 38000, capacity: 30, width: 18, length: 24, minPower: 3.5, color: '#7d3c98' },

    harvester_old: { kind: 'harvester', harvests: 'combine', tank: 5, name: 'Maaidorser (oud)', price: 40000,  rate: 0.5, width: 24, speed: 20,  workSpeed: 7, fuelPerHour: 22, color: '#c9a227' },
    harvester_mid: { kind: 'harvester', harvests: 'combine', tank: 8, name: 'Maaidorser 6 m',   price: 120000, rate: 1.2, width: 40, speed: 22, workSpeed: 8, fuelPerHour: 35, color: '#27ae60' },
    harvester_big: { kind: 'harvester', harvests: 'combine', tank: 12, name: 'Maaidorser 9 m',   price: 260000, rate: 2.2, width: 56, speed: 25, workSpeed: 9, fuelPerHour: 50, color: '#d35400' },
    grape_harvester: { kind: 'fruitharvester', harvests: 'vineyard', name: 'Druivenoogster', price: 95000, width: 10, speed: 20, workSpeed: 6, fuelPerHour: 18, color: '#8e44ad' },
    tree_shaker:     { kind: 'fruitharvester', harvests: 'orchard',  name: 'Boomschudder',   price: 70000, width: 14, speed: 25, workSpeed: 5, fuelPerHour: 15, color: '#c0392b' },
    potato_harvester: { kind: 'harvester', harvests: 'potato', tank: 6, name: 'Aardappelrooier', price: 90000,  rate: 0.6, width: 16, speed: 20, workSpeed: 5, fuelPerHour: 25, color: '#7d4e9e' },
    beet_harvester:   { kind: 'harvester', harvests: 'beet',   tank: 10, name: 'Bietenrooier',    price: 150000, rate: 0.7, width: 24, speed: 20, workSpeed: 6, fuelPerHour: 35, color: '#2c7a7b' },
  },

  fuelPrice: 1.6,          // € per liter diesel
  // dieselpomp op het erf (T = tanken); tankinhoud = fuelTank of tankHours uur rijden
  // eigen spullen verkopen: deel van wat het nieuw kost
  resale: { machine: 0.6, wearLoss: 0.4, field: 0.75, building: 0.5, plantation: 0.6 },
  tankHours: 60,
  tankMult: { harvester: 3, fruitharvester: 3 },   // oogstmachines: 3× zo grote tank
  fuelWarnCrossings: 1.5,   // waarschuwing als je nog maar ±1,5 keer de kaart over kunt rijden
  fuelPump: { x: 318, y: 758, r: 7 },
  fuelService: 150,        // tankservice die naar je toe komt
  // slijtage per uur gebruik; boven 90% kan een machine kapotgaan. Repareren in de Garage.
  wearPerHour: 0.006, repairShare: 0.12, repairCallOut: 400,
  rentPerDay: 0.025,       // huren: 2,5% van de nieuwprijs per dag
  gpsPrice: 6000,          // GPS-stuursysteem: rijdt zelf recht (G)
  stoneYield: 0.9, rollBonus: 1.06,   // stenen kosten opbrengst, rollen geeft net iets meer
  factoryBonus: 1.1,       // direct bij je eigen fabriek gelost: 10% meer product
  surfaceSpeed: { road: 1, field: 0.65, grass: 0.8 },   // niet-werkend rijden over akkers en gras gaat langzamer
  workerWagePerHour: 20,   // € per speluur voor een loonwerker

  // Erf: boerderij, silo's, machinehal en parkeerplaats voor machines
  yard: { x: 40, y: 600, w: 320, h: 424, gate: { y: 812, h: 52 } },
  house: { x: 56, y: 616, w: 120, h: 84 },
  silos: { x: 226, y: 636, dx: 36, dy: 42, perRow: 4, r: 15 },
  hall: { x: 56, y: 722, w: 224, h: 72 },
  // stortput bij de silo's: hier los je graan in de silo (rij erheen via de oprit rechts van de hal)
  siloPit: { x: 290, y: 700, w: 62, h: 20 },
  // graanhandel: hier verkoop je graan direct (volle prijs, geen ophaalkosten)
  trader: { lot: { x: 1730, y: 1764, w: 140, h: 112 }, pit: { x: 1742, y: 1842, w: 70, h: 22 } },
  pickupFee: 0.1,   // verkopen vanuit de silo (laten ophalen) kost 10%
  unloadRate: { harvester: 2.5, trailer: 3.5 },  // ton per seconde bij lossen
  parking: { x: 52, y: 806, w: 300, h: 210 },
  // parkeerplekken (oostwaarts gericht), van de poort af gevuld
  slots: [300, 236, 172, 108].flatMap(x => [834, 884, 934, 984].map(y => ({ x, y }))).sort((a, b) => a.y - b.y || b.x - a.x),
  pond: { x: 200, y: 1118, rx: 120, ry: 36 },

  // snelheden in km/u; zo veel pixels per seconde is 1 km/u op de kaart
  kmhToPx: 1.15,
  walkSpeed: 9, runSpeed: 13,
  shiftBoost: 1.25,          // Shift met het werktuig omlaag = 25% sneller
  shiftSpeed: 50,            // Shift zonder werktuig omlaag: elk voertuig rijdt 50 km/u (op de weg)

  // personeel
  staff: { max: 8, refreshCost: 250, jobsPerLevel: 4, maxLevel: 5 },

  // Wegen (rechthoeken)
  roads: [
    { x: 380, y: 0, w: 24, h: 1900 },
    { x: 1240, y: 0, w: 24, h: 1900 },
    { x: 1880, y: 0, w: 24, h: 1900 },
    { x: 2404, y: 0, w: 24, h: 1900 },
    { x: 0, y: 1568, w: 3500, h: 24 },
    { x: 0, y: 560, w: 3500, h: 24 },
    { x: 0, y: 1040, w: 3500, h: 24 },
    { x: 624, y: 584, w: 16, h: 456 },
    { x: 872, y: 584, w: 16, h: 456 },
    { x: 808, y: 0, w: 24, h: 560 },
    { x: 3060, y: 0, w: 24, h: 1592 },   // Oostpolder
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
    // Oostpolder: grote, vruchtbare velden ver van het erf (bouw er een werkplaats of silo bij)
    { id: 20, x: 2712, y: 48,   w: 336, h: 496, region: 'oost' },
    { id: 21, x: 3104, y: 48,   w: 352, h: 496, region: 'oost' },
    { id: 22, x: 2712, y: 600,  w: 336, h: 424, region: 'oost' },
    { id: 23, x: 3104, y: 600,  w: 352, h: 296, region: 'oost' },   // eronder: bouwkavel
    { id: 24, x: 2712, y: 1080, w: 336, h: 472, region: 'oost' },
    { id: 25, x: 3104, y: 1080, w: 352, h: 472, region: 'oost' },
    { id: 26, x: 2712, y: 1608, w: 560, h: 264, region: 'oost' },   // rechts: bouwkavel
  ],
  landPricePerHa: 9000,
  regionSoil: { oost: 0.88 },   // de polderklei is vruchtbaarder

  // zelf bouwen: plaats ze waar je wilt op gras (niet op akkers of wegen)
  buildables: {
    silo:      { name: 'Extra silo',             price: 30000, w: 34, h: 34, capacity: 250, desc: '+250 t opslag, met eigen stortput' },
    warehouse: { name: 'Extra opslagloods',      price: 45000, w: 92, h: 60, pallets: 150, desc: '+150 pallets voor producten' },
    shed:      { name: 'Werkplaats + dieselpomp', price: 35000, w: 80, h: 50, desc: 'tanken (T) en repareren zonder voorrijkosten, ook ver van het erf' },
    greenhouse: { name: 'Kas',                   price: 45000, w: 140, h: 90, desc: 'nog een kas, waar je maar wilt: het hele jaar groenten, fruit of bloemen' },
  },

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
    { id: 'deliver',  text: 'Breng zelf graan weg: los een aanhanger bij de silo of graanhandel (U)', reward: 2000, check: s => s.stats.deliveredTons >= 1 },
    { id: 'crops3',   text: 'Oogst 3 verschillende gewassen',       reward: 3000,  check: s => Object.keys(s.stats.cropsHarvested || {}).length >= 3 },
    { id: 'clover',   text: 'Zaai klaver en ploeg het onder (groenbemester)', reward: 2000, check: s => s.stats.greenManureHa >= 1 },
    { id: 'lime',     text: 'Strooi kalk op een zure bodem (kalkstrooier)', reward: 2000, check: s => (s.stats.limeHa || 0) >= 1 },
    { id: 'spray',    text: 'Spuit tegen onkruid, ziektes of plagen (spuitmachine)', reward: 2000, check: s => (s.stats.sprayHa || 0) >= 1 },
    { id: 'hay',      text: 'Maai gras en pers het tot hooi',       reward: 2000,  check: s => s.stats.hayTons >= 1 },
    { id: 'bales',    text: 'Haal hooibalen op met een tractor en kipper', reward: 2000, check: s => (s.stats.balesCollected || 0) >= 1 },
    { id: 'fruit',    text: 'Koop een boomgaard of wijngaard en pluk de oogst (H)', reward: 4000, check: s => (s.stats.picked || 0) >= 1 },
    { id: 'contract', text: 'Voltooi een contract (tab Markt)',     reward: 3000,  check: s => s.stats.contractsDone >= 1 },
    { id: 'animals',  text: 'Bouw een stal en koop dieren (tab Bedrijf)', reward: 3000, check: s => Object.values(s.animals).some(a => a.count > 0) },
    { id: 'truck',    text: 'Breng producten met de vrachtwagen naar de supermarkt', reward: 3000, check: s => s.stats.truckDeliveries >= 1 },
    { id: 'lease',    text: 'Pacht een veld (goedkoper beginnen dan kopen)', reward: 1000, check: s => s.fields.some(f => f.leased) },
    { id: 'factory',  text: 'Bouw een fabriek (tab Bedrijf)',        reward: 5000,  check: s => Object.values(s.factories).some(f => f.owned) },
    { id: 'trough',   text: 'Vul een voerbak met een kipper (zelf met U, of laat een werknemer het doen)', reward: 2000, check: s => (s.stats.troughTons || 0) >= 0.5 },
    { id: 'young',    text: 'Laat je dieren jongen krijgen (goed voeren en gezond houden)', reward: 2000, check: s => (s.stats.births || 0) >= 1 },
    { id: 'field3',   text: 'Koop een extra veld',                  reward: 5000,  check: s => s.fields.filter(f => f.owned).length >= 3 },
    { id: 'hire',     text: 'Neem een werknemer aan (tab Team)',   reward: 2000,  check: s => s.staff && s.staff.employees.length >= 1 },
    { id: 'auto',     text: 'Zet een veld op automatisch beheer (tab Veld)', reward: 3000, check: s => s.fields.some(f => f.auto && f.auto.on) },
    { id: 'tractor2', text: 'Koop een tweede tractor',              reward: 5000,  check: s => s.machines.filter(m => AT.data.machines[m.type].kind === 'tractor').length >= 2 },
    { id: 'refuel',   text: 'Tank je tractor bij de dieselpomp op het erf (T)', reward: 1000, check: s => (s.stats.refuels || 0) >= 1 },
    { id: 'chaser',   text: 'Laat een chauffeur met kipper naast je maaidorser rijden (K)', reward: 3000, check: s => (s.stats.chaserTons || 0) >= 1 },
    { id: 'factoryDirect', text: 'Breng oogst direct naar je eigen fabriek (U bij de stortplaats)', reward: 2000, check: s => (s.stats.factoryTons || 0) >= 1 },
    { id: 'silo1',    text: 'Vergroot je silo',                     reward: 5000,  check: s => s.siloLevel >= 1 },
    { id: 'earn100k', text: 'Verdien in totaal €100.000',           reward: 10000, check: s => s.stats.earned >= 100000 },
    { id: 'allfields',text: 'Bezit alle velden',                    reward: 25000, check: s => s.fields.every(f => f.owned) },
    { id: 'million',  text: 'Word miljonair (€1.000.000 op de bank)', reward: 0,   check: s => s.money >= 1000000 },
  ],
};

// ---------- kaarten ----------
// Dezelfde wereld (wegen, erf, gebouwen), maar een andere verkaveling. Kiezen bij "Nieuw spel".
AT.data.maps = {
  standaard: { name: 'Gemengd bedrijf', desc: '26 velden van klein tot groot, ideaal om rustig te beginnen.', fields: AT.data.fields },
  groot: {
    name: 'Grootschalig', desc: 'Minder maar veel grotere kavels: meer werk per veld, grote machines lonen.',
    fields: [
      { id: 1, x: 424, y: 600, w: 200, h: 128, owned: true }, { id: 2, x: 648, y: 600, w: 224, h: 176, owned: true },
      { id: 3, x: 424, y: 744, w: 200, h: 280 }, { id: 4, x: 648, y: 792, w: 224, h: 232 },
      { id: 5, x: 424, y: 48, w: 384, h: 496 }, { id: 7, x: 48, y: 48, w: 312, h: 496 },
      { id: 9, x: 896, y: 600, w: 336, h: 424 }, { id: 10, x: 832, y: 48, w: 400, h: 496 },
      { id: 12, x: 48, y: 1176, w: 312, h: 376 }, { id: 13, x: 424, y: 1080, w: 800, h: 472 },
      { id: 14, x: 1280, y: 48, w: 584, h: 496 }, { id: 15, x: 1280, y: 600, w: 584, h: 424 }, { id: 16, x: 1280, y: 1080, w: 584, h: 472 },
      { id: 17, x: 1920, y: 48, w: 440, h: 496 }, { id: 18, x: 1920, y: 600, w: 440, h: 424 }, { id: 19, x: 1920, y: 1080, w: 440, h: 472 },
      { id: 20, x: 2712, y: 48, w: 744, h: 496, region: 'oost' }, { id: 22, x: 2712, y: 600, w: 336, h: 424, region: 'oost' },
      { id: 23, x: 3104, y: 600, w: 352, h: 296, region: 'oost' }, { id: 24, x: 2712, y: 1080, w: 744, h: 472, region: 'oost' },
      { id: 26, x: 2712, y: 1608, w: 560, h: 264, region: 'oost' },
    ],
  },
};
// moeilijkheid: startgeld, verkoopprijzen, lopende kosten en rente
AT.data.difficulties = {
  easy:    { name: 'Makkelijk', money: 60000,     sell: 1.15, cost: 0.85, interest: 0.5, desc: 'Meer startgeld, betere prijzen, lagere kosten.' },
  normal:  { name: 'Normaal',   money: 20000,     sell: 1,    cost: 1,    interest: 1,   desc: 'Zoals het spel bedoeld is.' },
  hard:    { name: 'Moeilijk',  money: 8000,      sell: 0.9,  cost: 1.15, interest: 1.5, desc: 'Weinig geld, lagere prijzen, hogere kosten en rente.' },
  sandbox: { name: 'Sandbox',   money: 100000000, sell: 1,    cost: 1,    interest: 1,   allFields: true, desc: 'Alle velden en €100 miljoen: bouw en probeer alles uit. Prestaties tellen niet.' },
};
// welke kaart is gekozen (opgeslagen in de browser; een nieuw spel kan hem wijzigen)
AT.data.mapId = (() => { try { return localStorage.getItem('agro-tycoon-2-map') || 'standaard'; } catch (e) { return 'standaard'; } })();
if (!AT.data.maps[AT.data.mapId]) AT.data.mapId = 'standaard';
AT.data.fields = AT.data.maps[AT.data.mapId].fields;

// ha uit oppervlakte (1 px = 1 m → 10.000 px² = 1 ha), afgerond op 0,5
for (const m of Object.values(AT.data.maps)) m.fields.forEach(f => {
  f.ha = Math.max(0.5, Math.round((f.w * f.h) / 10000 * 2) / 2);
  f.cols = f.w / AT.data.CELL;
  f.rows = f.h / AT.data.CELL;
});
