// Balans-spreadsheet: npm run balans
// Rekent uit de speldata (js/data.js) uit wat gewassen, machines, fabrieken, dieren en
// boomgaard/wijngaard opleveren. Schrijft CSV-bestanden (Excel/Sheets, ; als scheidingsteken)
// en een overzicht in docs/BALANS.md. Gebruik het om de balans van het spel te controleren.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));
const ctx = { console, Math, JSON, localStorage: { getItem: () => null, setItem() {}, removeItem() {} } };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(readFileSync(root + 'js/data.js', 'utf8'), ctx);
const D = ctx.AT.data;

const r = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d;
const name = k => (D.crops[k] || D.products[k] || { name: k }).name;
const price = k => (D.crops[k] || D.products[k] || { basePrice: 0 }).basePrice;
const wage = D.workerWagePerHour, fuel = D.fuelPrice;
const months = list => list.map(m => D.months[m].slice(0, 3).toLowerCase()).join(' ');

// ---------- gewassen ----------
const crops = Object.entries(D.crops).map(([k, c]) => {
  const value = c.perennial ? c.yieldPerHa * D.products.hay.basePrice : c.yieldPerHa * c.basePrice;
  const profit = value - c.seedCostPerHa;
  return {
    Gewas: c.name, Zaaimaanden: months(c.sow), 'Groeidagen': c.growDays, 'Opbrengst t/ha': c.yieldPerHa,
    'Basisprijs €/t': c.perennial ? `${D.products.hay.basePrice} (hooi)` : c.basePrice, 'Zaaigoed €/ha': c.seedCostPerHa,
    'Omzet €/ha': r(value), 'Winst €/ha': r(profit), 'Winst €/ha per groeidag': r(profit / c.growDays),
    'Bodem per oogst': c.soilDemand < 0 ? `+${r(-c.soilDemand * 100)}%` : `−${r(c.soilDemand * 100)}%`,
    Oogstmachine: c.harvester || 'onderploegen', Bijzonder: [c.winterHardy && 'winterhard', c.droughtProof && 'droogtebestendig', c.greenManure && 'groenbemester', c.perennial && 'meerjarig'].filter(Boolean).join(', '),
  };
}).sort((a, b) => b['Winst €/ha per groeidag'] - a['Winst €/ha per groeidag']);

// ---------- machines ----------
const tractorFor = minPower => Object.values(D.machines).filter(m => m.kind === 'tractor' && m.power >= minPower).sort((a, b) => a.price - b.price)[0];
const machines = Object.entries(D.machines).filter(([, m]) => m.rate).map(([k, m]) => {
  const tr = m.kind === 'harvester' ? m : tractorFor(m.minPower);
  const litersPerHour = tr ? tr.fuelPerHour : 0;
  const costPerHour = litersPerHour * fuel + wage;
  return {
    Machine: m.name, Soort: m.kind, 'Prijs €': m.price, 'ha per uur': m.rate, 'Werkbreedte m': m.width,
    'Werksnelheid km/u': m.workSpeed || '', 'Trekker': m.kind === 'harvester' ? 'zelfrijdend' : tr ? tr.name : '—',
    'Kosten €/uur (diesel + loonwerker)': r(costPerHour), 'Kosten €/ha': r(costPerHour / m.rate, 1),
    'Prijs per ha/uur capaciteit €': r(m.price / m.rate),
  };
});
const tractors = Object.entries(D.machines).filter(([, m]) => m.kind === 'tractor').map(([, m]) => ({
  Tractor: m.name, 'Prijs €': m.price, Vermogen: m.power, 'Topsnelheid km/u': m.speed, 'Diesel L/u': m.fuelPerHour,
  'Diesel €/u': r(m.fuelPerHour * fuel, 1), 'Prijs per vermogen €': r(m.price / m.power), Bijzonder: [m.tracks && 'rupsen', m.old && 'oldtimer'].filter(Boolean).join(', '),
}));

// ---------- fabrieken ----------
const factories = Object.entries(D.factories).flatMap(([k, f]) => [{ in: f.in, out: f.out }, ...(f.alt || [])].map((rc, i) => {
  const vin = Object.entries(rc.in).reduce((a, [g, n]) => a + n * price(g), 0);
  const vout = Object.entries(rc.out).reduce((a, [g, n]) => a + n * price(g), 0);
  const margin = vout - vin - f.costPerBatch;
  return {
    Fabriek: f.name + (i ? ` (recept ${i + 1})` : ''), 'Bouwprijs €': f.price,
    In: Object.entries(rc.in).map(([g, n]) => `${n} ${name(g)}`).join(' + '), Uit: Object.entries(rc.out).map(([g, n]) => `${n} ${name(g)}`).join(' + '),
    'Waarde in €': r(vin, 1), 'Waarde uit €': r(vout, 1), 'Energie €': f.costPerBatch, 'Marge per keer €': r(margin, 1),
    'Keer per dag': f.batchesPerDay, 'Marge per dag €': r(margin * f.batchesPerDay), 'Terugverdientijd (dagen)': margin > 0 ? r(f.price / (margin * f.batchesPerDay), 1) : '—',
  };
}));

// ---------- dieren ----------
const animals = Object.entries(D.animals).map(([k, a]) => {
  const prod = Object.entries(a.produce).reduce((s, [g, n]) => s + n * price(g), 0) + (a.fleece ? a.fleece.perAnimal / a.fleece.growDays * price(a.fleece.good) : 0);
  const cheapest = a.feeds.filter(g => price(g) > 0).sort((x, y) => price(x) - price(y))[0];
  const feed = a.feedPerDay * price(cheapest);
  const young = a.births * a.sellPrice;
  return {
    Dier: a.name, 'Stal €': a.buildPrice, 'Plek': a.capacity, 'Aankoop €': a.price, 'Verkoop €': a.sellPrice,
    'Productie €/dier/dag': r(prod, 2), 'Voer t/dier/dag': a.feedPerDay, 'Goedkoopste voer': name(cheapest), 'Voer €/dier/dag': r(feed, 2),
    'Jongen €/dier/dag': r(young, 2), 'Winst €/dier/dag': r(prod + young - feed, 2),
    'Winst volle stal €/dag': r((prod + young - feed) * a.capacity), 'Terugverdientijd stal (dagen)': r((a.buildPrice + a.capacity * a.price) / Math.max(1, (prod + young - feed) * a.capacity), 1),
  };
});

// ---------- boomgaard en wijngaard ----------
const plantations = Object.entries(D.plantations).map(([k, p]) => {
  const [sx, sy] = p.spacing, A = p.area;
  const n = Math.floor((A.w - sx / 2 - 6) / sx + 1) * Math.floor((A.h - sy / 2 - 6) / sy + 1);
  const amount = n * p.perPlant, value = amount * price(p.product);
  return {
    Perceel: p.name, 'Prijs €': p.price, Planten: n, Oogstmaanden: months(p.harvest), [`Oogst per jaar`]: `${r(amount)} ${D.products[p.product].unit} ${name(p.product).toLowerCase()}`,
    'Waarde per jaar €': r(value), 'Plukkers €': r(n * p.pickCost), 'Met machine €': r(n * p.machineCost),
    'Netto met plukkers €/jaar': r(value - n * p.pickCost), 'Terugverdientijd (jaar)': r(p.price / (value - n * p.pickCost), 1),
  };
});

// ---------- kassen ----------
const GH = D.greenhouse, avgEnergy = GH.energyPerDay.reduce((a, b) => a + b, 0) / 4;
const greenhouses = Object.entries(GH.crops).map(([k, c]) => {
  const yearAvg = (3 + GH.winterLight) / 4;   // zonder lampen: winter minder licht
  const value = c.perDay * price(k), energy = avgEnergy * c.heat;
  const full = c.perDay * GH.upgrades.led.grow * GH.upgrades.drip.grow * GH.upgrades.layers.grow * price(k);
  const fullEnergy = avgEnergy * c.heat * GH.upgrades.chp.heatCut * GH.upgrades.layers.heat + GH.upgrades.led.power;
  return {
    Gewas: name(k), 'Per dag': `${c.perDay} ${D.products[k].unit}`, 'Prijs €': price(k), 'Waarde €/dag (zomer)': r(value), 'Stoken €/dag (gem.)': r(energy),
    'Winst €/dag (jaargem.)': r(value * yearAvg - energy), 'Met alle upgrades €/dag': r(full - fullEnergy),
    'Terugverdientijd kas (dagen)': r(GH.price / Math.max(1, value * yearAvg - energy), 1),
  };
});

// ---------- schrijven ----------
const sheets = { gewassen: crops, machines, tractoren: tractors, fabrieken: factories, dieren: animals, fruit: plantations, kassen: greenhouses };
const outDir = root + 'docs/balans/';
mkdirSync(outDir, { recursive: true });
const cell = v => { const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
for (const [n, rows] of Object.entries(sheets)) {
  const head = Object.keys(rows[0]);
  writeFileSync(outDir + n + '.csv', '﻿' + [head, ...rows.map(row => head.map(h => row[h]))].map(l => l.map(cell).join(';')).join('\n') + '\n');
}
const md = ['# Balans van Agro Tycoon 2.0', '',
  `Automatisch berekend uit \`js/data.js\` met \`npm run balans\` (spelversie ${D.version}). Basisprijzen, zonder seizoen, marktschommeling, bodem of bemesting.`,
  `Een speldag = 24 speluren; een maand = ${D.daysPerMonth} dagen. Diesel €${D.fuelPrice}/L, loonwerker €${D.workerWagePerHour}/u. De CSV-bestanden staan in \`docs/balans/\` (openen in Excel of Google Sheets).`, ''];
const titles = { gewassen: 'Gewassen (gesorteerd op winst per groeidag)', machines: 'Werktuigen en oogstmachines', tractoren: 'Tractoren', fabrieken: 'Fabrieken', dieren: 'Dieren', fruit: 'Boomgaard en wijngaard', kassen: 'Kassen (per kas)' };
for (const [n, rows] of Object.entries(sheets)) {
  const head = Object.keys(rows[0]);
  md.push(`## ${titles[n]}`, '', '| ' + head.join(' | ') + ' |', '|' + head.map(() => '---').join('|') + '|', ...rows.map(row => '| ' + head.map(h => String(row[h] ?? '').replace(/\|/g, '/')).join(' | ') + ' |'), '');
}
writeFileSync(root + 'docs/BALANS.md', md.join('\n'));
console.log(`Balans geschreven: docs/BALANS.md en ${Object.keys(sheets).length} CSV-bestanden in docs/balans/`);
