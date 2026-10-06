# TODO — Agro Tycoon 2.0

Legenda: `[x]` klaar · `[ ]` te doen. Bovenaan staat wat eerst moet. Achtergrond staat in [`docs/ONDERZOEK.md`](docs/ONDERZOEK.md).
Doel: een singleplayer farming tycoon voor in de desktopbrowser.

## ✅ Fase 0: Basisspel
- [x] Grote kaart (2700×1900) met 19 velden, wegen, erf, machinehal, silo's, weides, fabrieksterrein, graanhandel, veevoerbedrijf, haven en supermarkt
- [x] **Lopen als boer** en **zelf rijden** over de hele kaart (WASD/pijltjes), camera volgt je
- [x] Realistische snelheden: tractor 30–50 km/u, werken 5–15 km/u, lopen 9 km/u
- [x] Shift = een stukje sneller (lopen 13 km/u, voertuigen +25%)
- [x] Tijd: 1 echte seconde = 1 speelminuut; snelheid 1×/5×/20×/60× (toetsen 1–4)
- [x] Machines blijven staan waar je uitstapt; nieuwe machines staan op de parkeerplaats
- [x] Werktuigen zelf aan- en afkoppelen (achteruit tegen het werktuig + F)
- [x] Pijl die de weg wijst naar het gekozen veld
- [x] Werktuig omlaag/omhoog met spatie, E = in-/uitstappen, C = zaaigoed wisselen
- [x] Velden bestaan uit cellen: de grond verandert precies waar je rijdt
- [x] Veldcyclus: stoppel → ploegen → zaaien → groeien → rijp → oogsten
- [x] Loonwerker inhuren die een heel veld automatisch doet (met jouw vrije machines)
- [x] 12 gewassen (zie Fase 4)
- [x] Machines: 3 tractoren, 3 aanhangers, 2 ploegen, 2 zaaimachines, 2 strooiers, 3 maaidorsers, aardappel- en bietenrooier
- [x] Diesel-, zaai- en loonkosten
- [x] Silo met capaciteit en 5 upgrade-niveaus
- [x] Markt met dagelijkse prijsschommeling, trendpijl en grafiekje
- [x] **Prijskalender**: per gewas/product de prijs per maand, met de duurste en goedkoopste maand gemarkeerd
- [x] Velden kopen, machines kopen en verkopen
- [x] Minimap, zoomen (scroll) en kaart verschuiven (slepen)
- [x] Doelen/tutorial met beloningen + statistieken
- [x] Dag/nacht en pauze (P)
- [x] Automatisch opslaan (localStorage)
- [x] Live link via GitHub Pages

## 🎨 Mooiere game graphics
- [x] Eigen sprites voor tractoren, maaidorsers en werktuigen (in plaats van blokjes), met draaiende wielen
- [x] Gedetailleerde gebouwen: boerderij, schuur, silo's en graanhandel met schaduwen
- [x] Mooiere veldtexturen: voren die de rijrichting volgen, gewassen die wiegen in de wind
- [x] Elk gewas herkenbaar: tarwe, gerst en maïs zien er echt anders uit, ook tijdens het groeien
- [x] Natuur: bomen (per seizoen), vijver met waterlelies, bloemetjes in het gras, hekken rond erf en weides
- [x] Schaduwen en licht: zachte schaduw onder machines en gebouwen, mooiere zonsopgang en -ondergang
- [x] Effecten: stofwolken, kaf, bandensporen, uitlaatrook, meeuwen die achter de ploeg aan vliegen
- [x] Graanstroom bij het lossen
- [x] 's Nachts koplampen en lantaarns op het erf
- [x] Mooiere wegen (asfalt/grind met randen) en een erf met bestrating
- [x] Stijlkeuze: bovenaanzicht met getekende details (isometrisch zou een volledige herbouw zijn)
- [x] Afbeeldingen van machines in de winkel en garage
- [ ] Iconen voor geld, tijd en silo in de bovenbalk
- [x] Graanhandel als gebouw op de kaart
- [ ] Hagen langs sommige akkers en sloten tussen de velden
- [ ] Seizoenen ook op de akkers zelf: stoppel en kale grond onder de sneeuw

## 🚜 Fase 1: Meer machines en vervoer
- [ ] **Extra tractormodellen** (50 pk oldtimer, 200 pk, 400 pk rupstrekker)
- [x] **Graanbunker in de maaidorser** (5–12 t): als hij vol is, moet je lossen
- [x] **Aanhangers** (kipper 8 t, 16 t, overlaadwagen 30 t): graan zelf naar de silo of graanhandel rijden
- [x] Lossen met U: maaidorser → aanhanger (losbuis), aanhanger → stortput silo of graanhandel
- [x] Graanhandel op de kaart: volle prijs; verkopen vanuit de silo kost 10% ophaalkosten
- [ ] Overladen tijdens het rijden (maaidorser en tractor naast elkaar)
- [ ] Werknemer-chauffeur die met de aanhanger naast de maaidorser meerijdt en zelf wegbrengt
- [ ] Graan naar een fabriek brengen (bonus voor directe levering)
- [ ] **Cultivator** (sneller dan ploegen)
- [x] **Spuitmachine** en **kalkstrooier** (zie Fase 3)
- [ ] Rol, egalisatie en stenen rapen
- [ ] Machineslijtage + onderhoud/reparatie in de schuur
- [ ] Brandstoftank: tank leeg = bijtanken op het erf
- [ ] Machines huren in plaats van kopen
- [ ] Botsen met gebouwen, hekken en bomen (nu rijd je overal doorheen)
- [ ] Langzamer rijden over akkers en gras dan over de weg
- [ ] Machine-upgrades (GPS = automatisch recht rijden)

## 👷 Fase 2: Personeel en automatisering
- [x] Vaste werknemers aannemen (dagloon, eigen snelheid en zuinigheid; ervaring maakt ze sneller)
- [x] Sollicitanten: elke week nieuwe, of zelf een nieuwe ronde starten
- [x] Werknemers rijden echt over de weg van de machine naar het veld en weer terug (route via de wegen)
- [x] Taken in een wachtrij zetten ("ploeg veld 3, daarna zaaien met maïs"), volgorde aanpassen
- [x] Automatische veldcyclus per veld: vast gewas of wisselbouw, eventueel kunstmest voor het zaaien
- [x] Externe loonwerker als er niemand vrij is (aan/uit)
- [ ] Werknemers lossen zelf graan met een aanhanger (nu gaat het direct naar de silo)
- [ ] Werknemers voeren dieren en rijden mest uit (dieren-taken)
- [ ] Werktijden en vrije dagen; werknemers worden moe

## 🌦️ Fase 3: Seizoenen, weer en bodem
- [x] Seizoenen (lente, zomer, herfst, winter) met 12 maanden van 2 dagen: elk gewas heeft eigen zaaimaanden
- [x] Zaai- en oogstkalender: zaaimaanden, oogstmaanden, opbrengst per ha per oogstmaand en per maand op het veld
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
- [x] Bodem-pH en kalk strooien: oogsten en kunstmest maken de bodem zuurder, de kalkstrooier maakt hem weer goed
- [x] Groenbemester (klaver): onderploegen herstelt de bodem
- [x] Irrigatie per veld: bij droogte groeit het gewas gewoon door (kost water)
- [x] Onkruid (lente), ziektes (nat weer) en plagen (warm en droog) kosten elke dag opbrengst; de spuitmachine haalt ze weg en beschermt tot de oogst
- [x] Rijp gewas verwelkt als je te lang wacht (minder opbrengst)
- [x] Rijden over natte akkers verdicht de bodem (−15% tot je ploegt), met zichtbare sporen

## 🌽 Fase 4: Meer gewassen en producten
- [x] Haver, koolzaad (winterhard, gele bloei), zonnebloem (droogtebestendig), soja en veldbonen (verbeteren de bodem)
- [x] Aardappelen en suikerbieten met eigen aardappelrooier en bietenrooier
- [x] Klaver als groenbemester
- [x] Aardappelpootmachine en bietenzaaier (de gewone zaaimachine doet alleen granen, zaden en klaver)
- [x] Gras/hooi: maaien → schudden → drogen → persen; gras groeit daarna vanzelf terug
- [x] Bosperceel kopen, bomen kappen (H) en hout tot planken zagen in de zagerij; bomen groeien terug
- [x] Kassen met tomaten of sla, het hele jaar (stookkosten in de winter)
- [x] Regen vertraagt het drogen van hooi
- [x] Echte balen op het veld: ophalen met tractor + kipper (eroverheen rijden) of laten ophalen
- [x] Boomgaard (appels) en wijngaard (druiven → wijnmakerij): plukken met H of plukkers inhuren
- [ ] Fruit- en druivenoogstmachine

**Waarom zou je niet altijd het duurste gewas kiezen?** Elk gewas moet een eigen reden hebben:
- [x] **Seizoenen**: niet elk gewas mag in elk seizoen gezaaid worden (tarwe in lente/herfst, gerst en maïs in lente/zomer)
- [x] **Vruchtwisseling**: steeds hetzelfde gewas geeft −10%, wisselen geeft +10%
- [x] **Bodem**: elk gewas put de bodem anders uit (maïs het meest)
- [x] **Fabrieken en dieren vragen specifieke gewassen**: brouwerij wil gerst, molen wil tarwe, koeien eten graag maïs
- [x] **Marktverzadiging**: als je veel van één gewas verkoopt, zakt de prijs daarvan tijdelijk
- [x] **Vraag en contracten**: opdrachten voor een bepaald gewas met een bonusprijs
- [x] **Elk gewas zijn eigen dure maand**: de prijskalender laat zien wanneer je wat het best verkoopt
- [x] **Groeitijd vs. opbrengst**: snelle gewassen voor tussendoor, trage voor de grote winst
- [x] **Seizoensprijzen**: wie bewaart tot buiten de oogsttijd, krijgt meer
- [x] **Stikstofbinders** (bonen, klaver, soja) maken de bodem juist béter voor het volgende gewas
- [x] **Risico**: zonnebloem kan tegen droogte; alleen tarwe en koolzaad overleven vorst
- [x] **Machines per gewas**: aardappelen en bieten vragen een eigen rooier (investering)

## 🐄 Fase 5: Dieren
- [x] Koeien (melk + mest), kippen (eieren), schapen (wol + mest)
- [x] Stallen bouwen, dieren kopen/verkopen, dieren lopen rond in de wei
- [x] Dieren eten graan uit de silo; honger = minder productie
- [x] Varkens (veel biggetjes, verkopen als ze vetgemest zijn)
- [x] Voer zelf naar de stal rijden: voerbak vullen met een kipper (U); automatisch voeren uit de silo kost voerdienst
- [x] Hooi als voer voor koeien en schapen
- [x] Voer maken van eigen oogst: sleufsilo (kuilvoer) en veevoermengerij (mengvoer) geven meer productie
- [x] Dierengezondheid (ziektes, dierenarts), jongen en stallen uitbreiden (×2, ×3 plek)
- [ ] Voermengwagen als eigen machine

## 🏭 Fase 6: Productie en economie
- [x] Fabrieken: graanmolen (meel), bakkerij (brood van meel + eieren), kaasmakerij (kaas van melk), brouwerij (bier van gerst)
- [x] Producten verkopen op de markt met schommelende prijzen
- [x] Oliepers (koolzaad/zonnebloem → olie), suikerfabriek (bieten → suiker), chipsfabriek (aardappelen + olie → chips), zagerij (hout → planken)
- [x] Vrachtwagen: pallets laden bij het laadperron en zelf naar de supermarkt/haven rijden (volle prijs)
- [x] Opslagloods met beperkte ruimte (pallets) en 4 niveaus; vol = fabrieken stoppen
- [x] Contracten met deadline, bonus en boete als je te laat bent
- [x] Meerdere verkooppunten: graanhandel, veevoerbedrijf, haven en supermarkt, elk met eigen prijzen
- [x] Leningen bij de bank met dagelijkse rente (max. op basis van je bezit)
- [x] Financieel overzicht: grafiek inkomsten/uitgaven per dag + kasboek per categorie
- [x] Marktverzadiging en seizoensprijzen per maand (prijskalender)
- [x] Werknemers rijden zelf met de vrachtwagen (laden, beste verkooppunt, terug), ook automatisch als de loods half vol is
- [x] Oogstverzekering: 80% vergoeding van storm- en vorstschade
- [x] Grond pachten in plaats van kopen (huur per dag, later alsnog kopen)

## 🗺️ Fase 7: Wereld en progressie
- [ ] Nog grotere kaart / meerdere kaarten
- [ ] Gebouwen zelf plaatsen (silo's, schuren, stallen)
- [ ] Sandbox-modus + moeilijkheidsgraden
- [ ] Prestaties (achievements)

## 🎨 Fase 8: Presentatie en gemak
- [x] Geluid: motoren, werktuigen, wind/regen/onweer, vogels, krekels, dieren, effecten en rustige muziek (🔊-knop, M = dempen)
- [ ] Geluid van machines van werknemers in de buurt
- [ ] Opslaan exporteren/importeren (bestand) + meerdere saves
- [ ] Instelling voor de daglengte (nu vast: 1 seconde = 1 minuut)
- [ ] Uitleg in het spel bij de eerste keer (pijlen naar tractor, veld, stortput)
- [ ] Toetsen zelf instellen

## 🛠️ Techniek
- [ ] Unit tests voor `game.js` (economie, cycli) en een vaste speltest in de browser
- [x] Opslag behouden bij updates (oude saves worden omgezet, met reservekopie)
- [ ] Balans-spreadsheet (verdienen per uur per gewas/machine)
- [ ] Overstappen op ES-modules + Vite wanneer het project groter wordt
