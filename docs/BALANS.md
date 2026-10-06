# Balans van Agro Tycoon 2.0

Automatisch berekend uit `js/data.js` met `npm run balans` (spelversie 13). Basisprijzen, zonder seizoen, marktschommeling, bodem of bemesting.
Een speldag = 24 speluren; een maand = 2 dagen. Diesel €1.6/L, loonwerker €20/u. De CSV-bestanden staan in `docs/balans/` (openen in Excel of Google Sheets).

## Gewassen (gesorteerd op winst per groeidag)

| Gewas | Zaaimaanden | Groeidagen | Opbrengst t/ha | Basisprijs €/t | Zaaigoed €/ha | Omzet €/ha | Winst €/ha | Winst €/ha per groeidag | Bodem per oogst | Oogstmachine | Bijzonder |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Aardappelen | maa apr | 4 | 30 | 140 | 600 | 4200 | 3600 | 900 | −10% | potato |  |
| Gerst | maa apr mei jun | 2 | 6.5 | 200 | 100 | 1300 | 1200 | 600 | −6% | combine |  |
| Haver | maa apr mei | 2 | 5.5 | 230 | 90 | 1265 | 1175 | 588 | −4% | combine |  |
| Tarwe | maa apr sep okt | 3 | 8 | 220 | 120 | 1760 | 1640 | 547 | −8% | combine | winterhard |
| Maïs | apr mei jun | 5 | 11 | 210 | 220 | 2310 | 2090 | 418 | −12% | combine |  |
| Veldbonen | maa apr | 3 | 4.5 | 300 | 150 | 1350 | 1200 | 400 | +8% | combine |  |
| Koolzaad | aug sep | 5 | 4 | 450 | 80 | 1800 | 1720 | 344 | −10% | combine | winterhard |
| Gras | maa apr mei jun jul aug sep | 2 | 6 | 120 (hooi) | 90 | 720 | 630 | 315 | −3% | grass | meerjarig |
| Suikerbieten | maa apr | 6 | 40 | 50 | 250 | 2000 | 1750 | 292 | −10% | beet |  |
| Zonnebloem | apr mei | 4 | 3 | 420 | 110 | 1260 | 1150 | 288 | −7% | combine | droogtebestendig |
| Soja | apr mei | 4 | 3.2 | 400 | 130 | 1280 | 1150 | 288 | +6% | combine |  |
| Klaver | maa apr mei jun jul aug sep | 2 | 0 | 0 | 60 | 0 | -60 | -30 | −0% | onderploegen | groenbemester |

## Werktuigen en oogstmachines

| Machine | Soort | Prijs € | ha per uur | Werkbreedte m | Werksnelheid km/u | Trekker | Kosten €/uur (diesel + loonwerker) | Kosten €/ha | Prijs per ha/uur capaciteit € |
|---|---|---|---|---|---|---|---|---|---|
| Ploeg 3-schaar | plow | 4000 | 0.5 | 16 | 8 | Oldtimer 50 pk | 30 | 59.2 | 8000 |
| Ploeg 6-schaar | plow | 14000 | 1.1 | 32 | 10 | Tractor 150 pk | 49 | 44.4 | 12727 |
| Ploeg 10-schaar | plow | 30000 | 2 | 52 | 11 | Tractor 300 pk | 71 | 35.6 | 15000 |
| Cultivator 4 m | cultivator | 11000 | 1.6 | 32 | 14 | Tractor 75 pk | 36 | 22.5 | 6875 |
| Cultivator 9 m | cultivator | 36000 | 3.6 | 72 | 16 | Tractor 300 pk | 71 | 19.8 | 10000 |
| Rol 6 m | roller | 6000 | 2.4 | 48 | 15 | Oldtimer 50 pk | 30 | 12.3 | 2500 |
| Stenenraper | stonepicker | 14000 | 1 | 20 | 8 | Tractor 75 pk | 36 | 36 | 14000 |
| Zaaimachine 3 m | seeder | 6000 | 0.7 | 24 | 12 | Oldtimer 50 pk | 30 | 42.3 | 8571 |
| Zaaimachine 6 m | seeder | 20000 | 1.5 | 48 | 14 | Tractor 150 pk | 49 | 32.5 | 13333 |
| Aardappelpootmachine | seeder | 18000 | 0.6 | 12 | 8 | Tractor 75 pk | 36 | 60 | 30000 |
| Bietenzaaier | seeder | 16000 | 0.9 | 18 | 10 | Tractor 75 pk | 36 | 40 | 17778 |
| Maaier 3 m | mower | 9000 | 1.2 | 22 | 14 | Oldtimer 50 pk | 30 | 24.7 | 7500 |
| Schudder | tedder | 7000 | 1.6 | 30 | 14 | Oldtimer 50 pk | 30 | 18.5 | 4375 |
| Balenpers | baler | 28000 | 0.8 | 10 | 10 | Tractor 75 pk | 36 | 45 | 35000 |
| Kunstmeststrooier | spreader | 7000 | 2 | 40 | 15 | Oldtimer 50 pk | 30 | 14.8 | 3500 |
| Mestverspreider | manure | 12000 | 0.8 | 20 | 10 | Tractor 75 pk | 36 | 45 | 15000 |
| Kalkstrooier | lime | 8000 | 1.8 | 36 | 14 | Tractor 75 pk | 36 | 20 | 4444 |
| Spuitmachine 24 m | sprayer | 15000 | 3 | 48 | 16 | Tractor 75 pk | 36 | 12 | 5000 |
| Maaidorser (oud) | harvester | 40000 | 0.5 | 24 | 7 | zelfrijdend | 55 | 110.4 | 80000 |
| Maaidorser 6 m | harvester | 120000 | 1.2 | 40 | 8 | zelfrijdend | 76 | 63.3 | 100000 |
| Maaidorser 9 m | harvester | 260000 | 2.2 | 56 | 9 | zelfrijdend | 100 | 45.5 | 118182 |
| Aardappelrooier | harvester | 90000 | 0.6 | 16 | 5 | zelfrijdend | 60 | 100 | 150000 |
| Bietenrooier | harvester | 150000 | 0.7 | 24 | 6 | zelfrijdend | 76 | 108.6 | 214286 |

## Tractoren

| Tractor | Prijs € | Vermogen | Topsnelheid km/u | Diesel L/u | Diesel €/u | Prijs per vermogen € | Bijzonder |
|---|---|---|---|---|---|---|---|
| Oldtimer 50 pk | 9000 | 0.7 | 25 | 6 | 9.6 | 12857 | oldtimer |
| Tractor 75 pk | 25000 | 1 | 30 | 10 | 16 | 25000 |  |
| Tractor 150 pk | 65000 | 2 | 40 | 18 | 28.8 | 32500 |  |
| Tractor 200 pk | 95000 | 2.6 | 45 | 24 | 38.4 | 36538 |  |
| Tractor 300 pk | 150000 | 3.5 | 50 | 32 | 51.2 | 42857 |  |
| Rupstrekker 400 pk | 240000 | 5 | 40 | 42 | 67.2 | 48000 | rupsen |

## Fabrieken

| Fabriek | Bouwprijs € | In | Uit | Waarde in € | Waarde uit € | Energie € | Marge per keer € | Keer per dag | Marge per dag € | Terugverdientijd (dagen) |
|---|---|---|---|---|---|---|---|---|---|---|
| Graanmolen | 45000 | 1 Tarwe | 0.85 Meel | 220 | 408 | 20 | 168 | 8 | 1344 | 33.5 |
| Bakkerij | 70000 | 0.2 Meel + 40 Eieren | 250 Brood | 120 | 350 | 10 | 220 | 6 | 1320 | 53 |
| Kaasmakerij | 55000 | 200 Melk | 22 Kaas | 110 | 198 | 5 | 83 | 8 | 664 | 82.8 |
| Brouwerij | 60000 | 0.5 Gerst | 300 Bier | 100 | 360 | 20 | 240 | 5 | 1200 | 50 |
| Oliepers | 50000 | 0.5 Koolzaad | 200 Olie | 225 | 360 | 15 | 120 | 6 | 720 | 69.4 |
| Oliepers (recept 2) | 50000 | 0.5 Zonnebloem | 180 Olie | 210 | 324 | 15 | 99 | 6 | 594 | 84.2 |
| Suikerfabriek | 90000 | 5 Suikerbieten | 800 Suiker | 250 | 480 | 30 | 200 | 6 | 1200 | 75 |
| Zagerij | 40000 | 2 Hout | 1.5 Planken | 140 | 390 | 15 | 235 | 6 | 1410 | 28.4 |
| Wijnmakerij | 80000 | 150 Druiven | 100 Wijn | 135 | 380 | 25 | 220 | 8 | 1760 | 45.5 |
| Sleufsilo (kuilvoer) | 25000 | 1 Maïs | 1.25 Kuilvoer | 210 | 225 | 5 | 10 | 10 | 100 | 250 |
| Sleufsilo (kuilvoer) (recept 2) | 25000 | 0.8 Hooi | 1 Kuilvoer | 96 | 180 | 5 | 79 | 10 | 790 | 31.6 |
| Veevoermengerij | 50000 | 0.5 Kuilvoer + 0.3 Gerst + 0.2 Soja | 1 Mengvoer | 230 | 330 | 10 | 90 | 8 | 720 | 69.4 |
| Veevoermengerij (recept 2) | 50000 | 0.5 Kuilvoer + 0.3 Haver + 0.2 Veldbonen | 1 Mengvoer | 219 | 330 | 10 | 101 | 8 | 808 | 61.9 |
| Veevoermengerij (recept 3) | 50000 | 0.5 Maïs + 0.3 Tarwe + 0.2 Soja | 0.9 Mengvoer | 251 | 297 | 10 | 36 | 8 | 288 | 173.6 |
| Chipsfabriek | 75000 | 1 Aardappelen + 20 Olie | 1200 Chips | 176 | 420 | 20 | 224 | 6 | 1344 | 55.8 |

## Dieren

| Dier | Stal € | Plek | Aankoop € | Verkoop € | Productie €/dier/dag | Voer t/dier/dag | Goedkoopste voer | Voer €/dier/dag | Jongen €/dier/dag | Winst €/dier/dag | Winst volle stal €/dag | Terugverdientijd stal (dagen) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Koeien | 25000 | 20 | 900 | 700 | 45.2 | 0.04 | Hooi | 4.8 | 17.5 | 57.9 | 1158 | 37.1 |
| Kippen | 8000 | 200 | 10 | 7 | 0.9 | 0.0006 | Gerst | 0.12 | 0.42 | 1.2 | 240 | 41.7 |
| Schapen | 12000 | 40 | 150 | 120 | 6.15 | 0.006 | Hooi | 0.72 | 4.8 | 10.23 | 409 | 44 |
| Varkens | 20000 | 40 | 120 | 240 | 0.22 | 0.01 | Aardappelen | 1.4 | 24 | 22.83 | 913 | 27.2 |

## Boomgaard en wijngaard

| Perceel | Prijs € | Planten | Oogstmaanden | Oogst per jaar | Waarde per jaar € | Plukkers € | Met machine € | Netto met plukkers €/jaar | Terugverdientijd (jaar) |
|---|---|---|---|---|---|---|---|---|---|
| Boomgaard | 60000 | 80 | aug sep okt | 96000 kg appels | 43200 | 3200 | 960 | 40000 | 1.5 |
| Wijngaard | 70000 | 442 | sep okt | 39780 kg druiven | 35802 | 1768 | 530 | 34034 | 2.1 |
