# 🚜 Agro Tycoon 2.0

Een farming tycoon die je in de browser speelt. Hij is geïnspireerd op [Agro Tycoon](https://store.steampowered.com/app/4660350/Agro_Tycoon/) (Steam, 2027). Ploeg, zaai en oogst je velden met je eigen machinepark, verkoop op het juiste moment en groei uit tot landbouwmagnaat.

## Spelen
**Live:** https://maartendeklerkpxl.github.io/agro-tycoon2.0/

Of open `index.html` lokaal in je browser (desktop). Een server is niet nodig.

**Besturing**
| Toets | Actie |
|---|---|
| WASD / pijltjes | Lopen of rijden |
| Shift | Rennen |
| E | In-/uitstappen (loop vlak naar de machine) |
| F | Werktuig aan-/afkoppelen (rij achteruit tegen het werktuig) |
| Spatie | Werktuig omlaag/omhoog (ploeg, zaaimachine, maaibord) |
| C | Zaaigoed wisselen |
| U | Lossen: maaidorser → aanhanger, aanhanger → stortput silo of graanhandel |
| Scroll / slepen | Zoomen / rondkijken |
| P | Pauze |
| 1 / 2 / 3 | Snelheid 1×, 2×, 4× |

## Hoe het werkt
1. Je staat als boer op het erf. Loop naar de rode tractor (de ploeg hangt er al aan) en druk **E**
2. Rij het erf af naar Veld 1 (de witte pijl wijst de weg) en druk **spatie** om te ploegen
3. Rij terug, zet de ploeg neer (**F**), rij achteruit tegen de **zaaimachine** en koppel die aan (**F**). Kies een gewas (**C**) en zaai
4. Is het gewas rijp, dan oogst je met de **maaidorser**. Het graan gaat in de **bunker**. Is die vol, zet dan een tractor met **kipper** naast de maaidorser (links, bij de losbuis) en druk **U**
5. Rij de kipper naar de **stortput bij de silo** of naar de **graanhandel** (onderaan de kaart) en druk **U**. Bij de graanhandel krijg je de volle prijs; vanuit de silo laten ophalen (tab Markt) kost 10%
6. Geen zin om alles zelf te doen? Huur in de tab **Veld** een **loonwerker** in
7. Koop extra velden, tractoren en werktuigen
8. Houd je **bodem** gezond: elke oogst put hem uit. Rij **mest** uit (van je koeien en schapen) en strooi **kunstmest** voor meer opbrengst. Wissel van gewas voor een bonus
9. Let op **seizoenen en weer**: elk gewas heeft eigen zaaimaanden (zie de 📅 Zaaikalender), in de winter groeit bijna niets en vorst beschadigt gewassen die niet winterhard zijn. Bij regen kun je niet oogsten, en rijpe gewassen verwelken als je te lang wacht
10. **11 gewassen**: tarwe, gerst, haver, maïs, koolzaad, zonnebloem, soja, veldbonen, aardappelen, suikerbieten en klaver. Elk heeft een eigen reden om te verbouwen: prijs, groeitijd, bodem, droogte/vorst of een fabriek die erom vraagt
11. In de tab **Bedrijf** bouw je **stallen** (koeien, kippen, schapen) en **fabrieken** (molen, bakkerij, kaasmakerij, brouwerij, oliepers, suikerfabriek, chipsfabriek) die je oogst meer waard maken

## Projectstructuur
```
index.html        pagina + layout
css/style.css     opmaak
js/data.js        ALLE content: gewassen, machines, velden, silo, doelen
js/game.js        spellogica (cellen, bodem, loonwerkers, economie, opslaan)
js/weather.js     seizoenen, weer, weersvoorspelling, groeisnelheid
js/farm.js        dieren en fabrieken
js/vehicle.js     lopen en zelf rijden: besturing + werken onder het werktuig
js/sprites.js     tekeningen: machines, gebouwen, bomen
js/effects.js     bandensporen, rook, stof, kaf, meeuwen
js/render.js      tekenen: wereld, camera, velden, licht, minimap, HUD
js/ui.js          zijpaneel, topbalk, logboek
js/main.js        opstarten + game loop
docs/ONDERZOEK.md onderzoek naar Agro Tycoon en concurrenten
todo.md           roadmap met alle extra's
```

**Een nieuwe tractor of nieuw gewas toevoegen?** Voeg een regel toe in `js/data.js`. De winkel en de markt pakken het automatisch op.
