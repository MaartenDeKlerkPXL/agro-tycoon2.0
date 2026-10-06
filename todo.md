# TODO — Agro Tycoon 2.0

Legenda: `[x]` klaar · `[ ]` te doen. Bovenaan staat wat eerst moet. Achtergrond staat in [`docs/ONDERZOEK.md`](docs/ONDERZOEK.md).
Doel: een singleplayer farming tycoon voor in de desktopbrowser.

## ✅ Fase 0: Basisspel
- [x] Grote kaart (2400×1600) met 19 velden, wegen, erf, schuur, silo's en graanhandel
- [x] **Zelf rijden** over de hele kaart (WASD/pijltjes), camera volgt je
- [x] Werktuig omlaag/omhoog met spatie, E = in-/uitstappen, C = zaaigoed wisselen
- [x] Velden bestaan uit cellen: de grond verandert precies waar je rijdt
- [x] Veldcyclus: stoppel → ploegen → zaaien → groeien → rijp → oogsten
- [x] Loonwerker inhuren die een heel veld automatisch doet (met jouw vrije machines)
- [x] 3 gewassen: tarwe, gerst, maïs
- [x] Machines: 3 tractoren, 2 ploegen, 2 zaaimachines, 3 maaidorsers (elk met eigen werkbreedte en snelheid)
- [x] Diesel-, zaai- en loonkosten
- [x] Silo met capaciteit en 5 upgrade-niveaus
- [x] Markt met dagelijkse prijsschommeling, trendpijl en grafiekje
- [x] Velden kopen, machines kopen en verkopen
- [x] Minimap, zoomen (scroll) en kaart verschuiven (slepen)
- [x] Doelen/tutorial met beloningen + statistieken
- [x] Dag/nacht, pauze (P) en snelheid 1×/2×/4×
- [x] Automatisch opslaan (localStorage)
- [x] Live link via GitHub Pages

## 🎨 Mooiere game graphics
- [ ] Eigen sprites voor tractoren, maaidorsers en werktuigen (in plaats van blokjes), met draaiende wielen
- [ ] Gedetailleerde gebouwen: boerderij, schuur, silo's en graanhandel met schaduwen
- [ ] Mooiere veldtexturen: voren die de rijrichting volgen, gewassen die wiegen in de wind
- [ ] Elk gewas herkenbaar: tarwe, gerst en maïs zien er echt anders uit, ook tijdens het groeien
- [ ] Natuur rond de velden: bomen, struiken, hagen, sloten, hekken en een vijver
- [ ] Schaduwen en licht: zachte schaduw onder machines en gebouwen, mooiere zonsopgang en -ondergang
- [ ] Effecten: stofwolken, graanstroom bij lossen, bandensporen, uitlaatrook, vogels boven het veld
- [ ] Mooiere wegen (asfalt/grind met randen) en een erf met bestrating
- [ ] Stijlkeuze maken: pixel-art of isometrisch (zoals Agro Tycoon)
- [ ] Mooiere interface: iconen voor geld, tijd en silo, en afbeeldingen van machines in de winkel

## 🚜 Fase 1: Meer machines en vervoer
- [ ] **Extra tractormodellen** (50 pk oldtimer, 200 pk, 400 pk rupstrekker)
- [ ] **Graanbunker in de maaidorser**: als hij vol is, moet je lossen
- [ ] **Aanhangers / overlaadwagens**: graan zelf naar de silo of graanhandel rijden
- [ ] Werktuigen los in de schuur aan- en afkoppelen (achteruit tegen het werktuig rijden)
- [ ] Machines laten staan waar je uitstapt (niet terug naar de schuur)
- [ ] **Cultivator** (sneller dan ploegen)
- [ ] **Spuitmachine**: onkruid/herbicide
- [ ] **Kunstmeststrooier**: hogere opbrengst
- [ ] Rol, egalisatie en stenen rapen
- [ ] Machineslijtage + onderhoud/reparatie in de schuur
- [ ] Brandstoftank: tank leeg = bijtanken op het erf
- [ ] Machines huren in plaats van kopen
- [ ] Botsen met gebouwen en hekken; sneller rijden op de weg dan op het veld
- [ ] Machine-upgrades (GPS = automatisch recht rijden)

## 👷 Fase 2: Personeel en automatisering
- [ ] Vaste werknemers aannemen (salaris per dag, skills: snelheid, zuinigheid)
- [ ] Loonwerkers rijden echt van de schuur naar het veld over de weg
- [ ] Taken in een wachtrij zetten ("ploeg veld 3, daarna zaaien met maïs")
- [ ] Automatische veldcyclus per veld (herhaal gewas X)

## 🌦️ Fase 3: Seizoenen, weer en bodem
- [ ] Seizoenen: zaaien alleen in bepaalde maanden per gewas
- [ ] Weer: regen (niet ploegen), droogte (lagere opbrengst), hagel/storm (schade)
- [ ] Weersvoorspelling van 3 dagen
- [ ] Bodemkwaliteit per veld (voedingsstoffen, bonus bij vruchtwisseling)
- [ ] Irrigatie
- [ ] Onkruid, ziektes en plagen
- [ ] Rijp gewas verwelkt als je te lang wacht

## 🌽 Fase 4: Meer gewassen en producten
- [ ] Haver, koolzaad, soja, bonen, zonnebloem
- [ ] Aardappelen en suikerbieten (aparte rooimachines)
- [ ] Gras/hooi (maaier, schudder, balenpers)
- [ ] Bomen/houtkap
- [ ] Kassen (groenten, het hele jaar)

## 🐄 Fase 5: Dieren
- [ ] Koeien (melk), varkens, kippen (eieren), schapen (wol)
- [ ] Voer maken van eigen oogst (kuilvoer, hooi)
- [ ] Dierengezondheid en stallen uitbreiden

## 🏭 Fase 6: Productie en economie
- [ ] Fabrieken: bakkerij (meel → brood), molen, oliepers, zuivel
- [ ] Contracten/orders met deadline en bonus
- [ ] Meerdere verkooppunten op de kaart met verschillende prijzen
- [ ] Leningen bij de bank + rente
- [ ] Financieel overzicht (grafiek inkomsten/uitgaven per dag)

## 🗺️ Fase 7: Wereld en progressie
- [ ] Nog grotere kaart / meerdere kaarten
- [ ] Gebouwen zelf plaatsen (silo's, schuren, stallen)
- [ ] Sandbox-modus + moeilijkheidsgraden
- [ ] Prestaties (achievements)

## 🎨 Fase 8: Presentatie
- [ ] Geluid: motoren, ambient, muziek
- [ ] Opslaan exporteren/importeren (bestand) + meerdere saves

## 🛠️ Techniek
- [ ] Unit tests voor `game.js` (economie, cycli)
- [ ] Balans-spreadsheet (verdienen per uur per gewas/machine)
- [ ] Overstappen op ES-modules + Vite wanneer het project groter wordt
