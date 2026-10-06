# TODO — Agro Tycoon 2.0

Legenda: `[x]` klaar · `[ ]` te doen. Bovenaan staat wat eerst moet. Achtergrond staat in [`docs/ONDERZOEK.md`](docs/ONDERZOEK.md).

## ✅ Fase 0: Basisspel (MVP)
- [x] Kaart met 8 velden, erf, schuur, silo en graanhandel (canvas)
- [x] Veldcyclus: stoppel → ploegen → zaaien → groeien → rijp → oogsten
- [x] Machines rijden zichtbaar in banen over het veld (bewerkt deel verandert mee)
- [x] 3 gewassen: tarwe, gerst, maïs
- [x] Machines: 3 tractoren, 2 ploegen, 2 zaaimachines, 3 maaidorsers
- [x] Machine kan maar 1 taak tegelijk doen, dus een extra tractor = meer capaciteit
- [x] Sterkere tractor = sneller werken; zwaar werktuig vereist 150+ pk
- [x] Dieselkosten en zaaikosten
- [x] Silo met capaciteit en 5 upgrade-niveaus
- [x] Markt met dagelijkse prijsschommeling, trendpijl en grafiekje
- [x] Velden kopen, machines kopen en verkopen (60% restwaarde)
- [x] Doelen/tutorial met beloningen + statistieken
- [x] Dag/nacht, pauze, snelheid 1×/2×/4× (spatie, 1, 2, 3)
- [x] Automatisch opslaan (localStorage)
- [x] Werkt op mobiel

## 🚜 Fase 1: Meer machines en vervoer
- [ ] **Extra tractormerken/-modellen** (bijv. 50 pk oldtimer, 200 pk, 400 pk rupstrekker)
- [ ] **Aanhangers / overlaadwagens**: graan moet naar de silo gereden worden
- [ ] Maaidorser met eigen bunker die vol raakt (overladen tijdens het rijden, zoals Agro Tycoon v0.3.16)
- [ ] **Cultivator** (sneller dan ploegen, minder opbrengstbonus)
- [ ] **Spuitmachine**: onkruid/herbicide
- [ ] **Kunstmeststrooier / mestinjecteur**: hogere opbrengst
- [ ] Rol, egalisatie en stenen rapen
- [ ] Machineslijtage + onderhoud/reparatie in de schuur
- [ ] Brandstoftank op het erf (diesel inkopen tegen dagprijs)
- [ ] Machines leasen/huren i.p.v. kopen
- [ ] Machines zichtbaar over de wegen laten rijden (pathfinding erf → veld)
- [ ] Machine-upgrades (bredere werkbreedte, GPS = sneller)

## 👷 Fase 2: Personeel en automatisering
- [ ] Personeel aannemen (salaris per dag, skills: snelheid, zuinigheid)
- [ ] Taken in een wachtrij zetten ("ploeg veld 3, daarna zaaien met maïs")
- [ ] Automatische veldcyclus per veld (herhaal gewas X)
- [ ] Personeelstevredenheid en training (zoals Farm Manager)

## 🌦️ Fase 3: Seizoenen, weer en bodem
- [ ] Seizoenen: zaaien alleen in bepaalde maanden per gewas
- [ ] Weer: regen (niet ploegen), droogte (lagere opbrengst), hagel/storm (schade)
- [ ] Weersvoorspelling van 3 dagen
- [ ] Bodemkwaliteit per veld (pH, voedingsstoffen, vruchtwisseling-bonus)
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
- [ ] Contracten/orders met deadline en bonus (zoals FS25/Hay Day)
- [ ] Meerdere verkooppunten met verschillende prijzen
- [ ] Leningen bij de bank + rente
- [ ] Financieel overzicht (grafiek inkomsten/uitgaven per dag)
- [ ] Eigen boerderijwinkel
- [ ] Graan opslaan en speculeren (vaste prijs vooruit verkopen)

## 🗺️ Fase 7: Wereld en progressie
- [ ] Grotere kaart met scrollen/zoomen
- [ ] Meerdere kaarten/regio's (bijv. Vlaanderen, Nederland, VS-prairie)
- [ ] Gebouwen zelf plaatsen (silo's, schuren, stallen)
- [ ] Campagne/scenario's + sandbox-modus
- [ ] Prestaties (achievements)
- [ ] Moeilijkheidsgraden (startgeld, prijzen)

## 🎨 Fase 8: Presentatie
- [ ] Pixel-art sprites (isometrisch?)
- [ ] Geluid: motoren, ambient, muziek
- [ ] Animaties: graanstroom, bandensporen, stof, vogels
- [ ] Tutorial met pijlen/highlights
- [ ] Meerdere talen (NL/EN)
- [ ] Opslaan export/import (bestand) + meerdere saves

## 🌐 Fase 9: Online (onderscheidend t.o.v. Agro Tycoon)
- [ ] Account + cloud save (bijv. Supabase)
- [ ] Leaderboard (rijkste boer, grootste oogst)
- [ ] Gedeelde markt tussen spelers
- [ ] Co-op: samen één boerderij
- [ ] Loonwerk: elkaars velden bewerken voor geld

## 🛠️ Techniek
- [ ] Unit tests voor `game.js` (economie, cycli)
- [ ] Balans-spreadsheet (verdienen per uur per gewas/machine)
- [ ] GitHub Pages deploy
- [ ] Overstappen op ES-modules + Vite wanneer het project groter wordt
- [ ] PWA (offline spelen, installeerbaar op telefoon)
