# TODO — Agro Tycoon 2.0

Legenda: `[x]` klaar · `[ ]` te doen. Bovenaan staat wat eerst moet. Achtergrond staat in [`docs/ONDERZOEK.md`](docs/ONDERZOEK.md).
Doel: een singleplayer farming tycoon voor in de desktopbrowser.

## ✅ Fase 0: Basisspel
- [x] Grote kaart (2400×1600) met 19 velden, wegen, erf, schuur, silo's en graanhandel
- [x] **Lopen als boer** en **zelf rijden** over de hele kaart (WASD/pijltjes), camera volgt je
- [x] Realistische snelheden: tractor 30–50 km/u, werken 5–15 km/u, lopen 6 km/u (rennen 14)
- [x] Machines blijven staan waar je uitstapt; nieuwe machines staan op de parkeerplaats
- [x] Werktuigen zelf aan- en afkoppelen (achteruit tegen het werktuig + F)
- [x] Pijl die de weg wijst naar het gekozen veld
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
- [x] Eigen sprites voor tractoren, maaidorsers en werktuigen (in plaats van blokjes), met draaiende wielen
- [x] Gedetailleerde gebouwen: boerderij, schuur, silo's en graanhandel met schaduwen
- [x] Mooiere veldtexturen: voren die de rijrichting volgen, gewassen die wiegen in de wind
- [x] Elk gewas herkenbaar: tarwe, gerst en maïs zien er echt anders uit, ook tijdens het groeien
- [x] Natuur rond de velden: bomen, struiken, hagen, sloten, hekken en een vijver
- [x] Schaduwen en licht: zachte schaduw onder machines en gebouwen, mooiere zonsopgang en -ondergang
- [x] Effecten: stofwolken, kaf, bandensporen, uitlaatrook, meeuwen die achter de ploeg aan vliegen
- [x] Graanstroom bij het lossen
- [x] 's Nachts koplampen en lantaarns op het erf
- [x] Mooiere wegen (asfalt/grind met randen) en een erf met bestrating
- [x] Stijlkeuze: bovenaanzicht met getekende details (isometrisch zou een volledige herbouw zijn)
- [x] Afbeeldingen van machines in de winkel en garage
- [ ] Iconen voor geld, tijd en silo in de bovenbalk
- [ ] Graanhandel als gebouw op de kaart
- [ ] Struiken/hagen langs sommige akkers en sloten

## 🚜 Fase 1: Meer machines en vervoer
- [ ] **Extra tractormodellen** (50 pk oldtimer, 200 pk, 400 pk rupstrekker)
- [x] **Graanbunker in de maaidorser** (5–12 t): als hij vol is, moet je lossen
- [x] **Aanhangers** (kipper 8 t, 16 t, overlaadwagen 30 t): graan zelf naar de silo of graanhandel rijden
- [x] Lossen met U: maaidorser → aanhanger (losbuis), aanhanger → stortput silo of graanhandel
- [x] Graanhandel op de kaart: volle prijs; verkopen vanuit de silo kost 10% ophaalkosten
- [ ] Overladen tijdens het rijden (maaidorser en tractor naast elkaar)
- [ ] Loonwerker-chauffeur die met de aanhanger meerijdt en zelf wegbrengt
- [ ] Graan naar een fabriek brengen (bonus voor directe levering)
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
- [x] Seizoenen (lente, zomer, herfst, winter) met 12 maanden van 2 dagen: elk gewas heeft eigen zaaimaanden
- [x] Zaaikalender (welk gewas wanneer, opbrengst en bijzonderheden)
- [x] Vorst: sneeuw beschadigt gewassen die niet winterhard zijn
- [x] Seizoensprijzen: goedkoop in de oogsttijd, duur een half jaar later (bewaren loont)
- [x] In de winter groeit bijna niets (alleen wintertarwe, langzaam)
- [x] Weer: zon, bewolkt, regen, onweer en sneeuw, met weersvoorspelling van 3 dagen
- [x] Regen = snellere groei, maar oogsten kan pas als het droog is
- [x] Droogte (lang zonnig in de zomer) = tragere groei en minder opbrengst
- [x] Onweer geeft stormschade op groeiende/rijpe gewassen
- [x] Seizoenen zichtbaar: herfstbomen, sneeuw en ijs in de winter; regen, sneeuw, bliksem en wolkenschaduwen
- [x] Bodemkwaliteit per veld: elke oogst put de bodem uit, mest maakt hem weer beter
- [x] Kunstmeststrooier (+25% opbrengst) en mestverspreider (betere bodem)
- [x] Vruchtwisseling: ander gewas = +10%, steeds hetzelfde gewas = −10%
- [ ] Bodem-pH en kalk strooien
- [x] Groenbemester (klaver): onderploegen herstelt de bodem
- [ ] Irrigatie tegen droogte
- [ ] Onkruid, ziektes en plagen (spuitmachine)
- [x] Rijp gewas verwelkt als je te lang wacht (minder opbrengst)
- [ ] Rijden in de regen maakt sporen/verdichting in de bodem

## 🌽 Fase 4: Meer gewassen en producten
- [x] Haver, koolzaad (winterhard, gele bloei), zonnebloem (droogtebestendig), soja en veldbonen (verbeteren de bodem)
- [x] Aardappelen en suikerbieten met eigen aardappelrooier en bietenrooier
- [x] Klaver als groenbemester
- [ ] Aardappelpootmachine en bietenzaaier (nu doet de zaaimachine alles)
- [ ] Gras/hooi (maaier, schudder, balenpers)
- [ ] Bomen/houtkap
- [ ] Kassen (groenten, het hele jaar)

**Waarom zou je niet altijd het duurste gewas kiezen?** Elk gewas moet een eigen reden hebben:
- [x] **Seizoenen**: niet elk gewas mag in elk seizoen gezaaid worden (tarwe in lente/herfst, gerst en maïs in lente/zomer)
- [x] **Vruchtwisseling**: steeds hetzelfde gewas geeft −10%, wisselen geeft +10%
- [x] **Bodem**: elk gewas put de bodem anders uit (maïs het meest)
- [x] **Fabrieken en dieren vragen specifieke gewassen**: brouwerij wil gerst, molen wil tarwe, koeien eten graag maïs
- [ ] **Marktverzadiging**: als je veel van één gewas verkoopt, zakt de prijs daarvan tijdelijk
- [ ] **Vraag en contracten**: opdrachten voor een bepaald gewas met een bonusprijs
- [x] **Groeitijd vs. opbrengst**: snelle gewassen voor tussendoor, trage voor de grote winst
- [x] **Seizoensprijzen**: wie bewaart tot buiten de oogsttijd, krijgt meer
- [x] **Stikstofbinders** (bonen, klaver, soja) maken de bodem juist béter voor het volgende gewas
- [x] **Risico**: zonnebloem kan tegen droogte; alleen tarwe en koolzaad overleven vorst
- [x] **Machines per gewas**: aardappelen en bieten vragen een eigen rooier (investering)

## 🐄 Fase 5: Dieren
- [x] Koeien (melk + mest), kippen (eieren), schapen (wol + mest)
- [x] Stallen bouwen, dieren kopen/verkopen, dieren lopen rond in de wei
- [x] Dieren eten graan uit de silo; honger = minder productie
- [ ] Varkens
- [ ] Voer zelf naar de stal rijden (voerwagen) in plaats van automatisch
- [ ] Voer maken van eigen oogst (kuilvoer, hooi, veevoermengerij)
- [ ] Dierengezondheid, jongen en stallen uitbreiden

## 🏭 Fase 6: Productie en economie
- [x] Fabrieken: graanmolen (meel), bakkerij (brood van meel + eieren), kaasmakerij (kaas van melk), brouwerij (bier van gerst)
- [x] Producten verkopen op de markt met schommelende prijzen
- [x] Oliepers (koolzaad/zonnebloem → olie), suikerfabriek (bieten → suiker), chipsfabriek (aardappelen + olie → chips)
- [ ] Producten zelf met een vrachtwagen naar de fabriek/winkel rijden
- [ ] Opslagloods met beperkte ruimte voor producten
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
