# 🚜 Agro Tycoon 2.0

Een farming tycoon die je in de browser speelt. Hij is geïnspireerd op [Agro Tycoon](https://store.steampowered.com/app/4660350/Agro_Tycoon/) (Steam, 2027). Ploeg, zaai en oogst je velden met je eigen machinepark, verkoop op het juiste moment en groei uit tot landbouwmagnaat.

## Spelen
**Live:** https://maartendeklerkpxl.github.io/agro-tycoon2.0/

Of open `index.html` lokaal in je browser (desktop). Een server is niet nodig.

**Besturing**
| Toets | Actie |
|---|---|
| WASD / pijltjes | Lopen of rijden |
| Shift | Een stukje sneller (lopen én rijden) |
| E | In-/uitstappen (loop vlak naar de machine) |
| F | Werktuig aan-/afkoppelen (rij achteruit tegen het werktuig) |
| Spatie | Werktuig omlaag/omhoog (ploeg, zaaimachine, maaibord) |
| C | Zaaigoed wisselen |
| U | Lossen: maaidorser → aanhanger, aanhanger → stortput silo of verkooppunt; vrachtwagen laden (laadperron) of verkopen |
| H | Te voet: boom kappen (bosperceel) of plukken (boomgaard, wijngaard) |
| M | Geluid dempen (🔊-knop rechtsboven voor volume, muziek en omgeving) |
| Scroll / slepen | Zoomen / rondkijken |
| P | Pauze |
| 1 / 2 / 3 / 4 | Snelheid 1×, 5×, 20×, 60× (1× = 1 seconde is 1 speelminuut) |

## Hoe het werkt
1. Je staat als boer op het erf. Loop naar de rode tractor (de ploeg hangt er al aan) en druk **E**
2. Rij het erf af naar Veld 1 (de witte pijl wijst de weg) en druk **spatie** om te ploegen
3. Rij terug, zet de ploeg neer (**F**), rij achteruit tegen de **zaaimachine** en koppel die aan (**F**). Kies een gewas (**C**) en zaai
4. Is het gewas rijp, dan oogst je met de **maaidorser**. Het graan gaat in de **bunker**. Is die vol, zet dan een tractor met **kipper** naast de maaidorser (links, bij de losbuis) en druk **U**
5. Rij de kipper naar de **stortput bij de silo** of naar de **graanhandel** (onderaan de kaart) en druk **U**. Bij de graanhandel krijg je de volle prijs; vanuit de silo laten ophalen (tab Markt) kost 10%
6. Geen zin om alles zelf te doen? Neem in de tab **Team** **werknemers** aan. Geef opdrachten in de tab **Veld** (ze komen in de wachtrij) of zet een veld op **🤖 automatisch beheer**. Werknemers rijden zelf over de weg naar het veld en terug
7. Koop extra velden, tractoren en werktuigen
8. Houd je **bodem** gezond: elke oogst put hem uit. Rij **mest** uit (van je koeien en schapen) en strooi **kunstmest** voor meer opbrengst. Wissel van gewas voor een bonus
9. Let op **seizoenen en weer**: elk gewas heeft eigen zaaimaanden (zie de 📅 Zaai- en oogstkalender: wanneer zaaien, wanneer oogsten en wat het per maand opbrengt), in de winter groeit bijna niets en vorst beschadigt gewassen die niet winterhard zijn. Bij regen kun je niet oogsten, en rijpe gewassen verwelken als je te lang wacht
10. **12 gewassen**: tarwe, gerst, haver, maïs, koolzaad, zonnebloem, soja, veldbonen, aardappelen, suikerbieten, gras en klaver. Elk heeft een eigen reden om te verbouwen: prijs, groeitijd, bodem, droogte/vorst of een fabriek die erom vraagt. Aardappelen en bieten vragen een eigen pootmachine/zaaier; gras maai je, schud je en pers je tot hooi
11. In de tab **Bedrijf** bouw je **stallen** (koeien, kippen, schapen) en **fabrieken** (molen, bakkerij, kaasmakerij, brouwerij, oliepers, suikerfabriek, chipsfabriek) die je oogst meer waard maken. Daar koop je ook **kassen** (tomaten, sla), een **bosperceel** met **zagerij** en bouw je de **opslagloods** uit
12. In de tab **Markt** zie je de **📈 prijskalender**: welke maand elk gewas duur of goedkoop is. Neem **contracten** aan voor een bonus, en let op: veel tegelijk verkopen drukt de prijs
13. Er zijn vier **verkooppunten**: graanhandel, veevoerbedrijf, haven en supermarkt. Breng graan met een kipper en producten met de **vrachtwagen** (laden bij het laadperron, U) voor de volle prijs
14. In de tab **Geld** zie je inkomsten en uitgaven per dag, het kasboek per categorie, en kun je **lenen** bij de bank (met rente). Daar sluit je ook een **oogstverzekering** af tegen storm en vorst
15. **Bodem en gewasgezondheid**: houd de **pH** goed met de **kalkstrooier**, spuit tegen **onkruid, ziektes en plagen** met de **spuitmachine**, leg **irrigatie** aan tegen droogte en rij niet over natte akkers (verdichting)
16. **Hooi**: zelf persen geeft **balen op het veld**. Rij er met tractor + kipper overheen om ze op te rapen en los ze (U) bij de stortput (opslagloods) of het veevoerbedrijf. Bij regen droogt hooi bijna niet
17. **Boomgaard en wijngaard** (rechts op de kaart): pluk appels en druiven met **H** of huur plukkers in. Druiven worden wijn in de **wijnmakerij**
18. **Dieren** hebben een **voerbak**: vul hem zelf met een kipper (U) of laat automatisch voeren (kost voerdienst). Houd ze gezond (dierenarts), dan krijgen ze jongen. **Kuilvoer** en **mengvoer** geven meer productie
19. **Pachten**: een veld huren per dag in plaats van kopen. Een **werknemer** kan ook met de **vrachtwagen** leveren (tab Bedrijf → opslagloods)
20. Je voortgang blijft bewaard als het spel een update krijgt

## Projectstructuur
```
index.html        pagina + layout
css/style.css     opmaak
js/data.js        ALLE content: gewassen, machines, velden, silo, doelen
js/game.js        spellogica (cellen, bodem, taken, economie, contracten, bank, opslaan)
js/weather.js     seizoenen, weer, weersvoorspelling, groeisnelheid
js/farm.js        dieren (voerbak, gezondheid, jongen), fabrieken, kassen, bos, boomgaard en wijngaard
js/staff.js       personeel, wachtrij, automatisch beheer, routes over de wegen
js/vehicle.js     lopen en zelf rijden: besturing + werken onder het werktuig
js/sprites.js     tekeningen: machines, gebouwen, bomen
js/effects.js     bandensporen, rook, stof, kaf, meeuwen
js/render.js      tekenen: wereld, camera, velden, licht, minimap, HUD
js/ui.js          zijpaneel, topbalk, logboek
js/audio.js       geluid (alles live opgewekt): motoren, omgeving, effecten, muziek
js/main.js        opstarten + game loop
docs/ONDERZOEK.md onderzoek naar Agro Tycoon en concurrenten
todo.md           roadmap met alle extra's
```

**Een nieuwe tractor of nieuw gewas toevoegen?** Voeg een regel toe in `js/data.js`. De winkel en de markt pakken het automatisch op.
