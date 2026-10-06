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
| Scroll / slepen | Zoomen / rondkijken |
| P | Pauze |
| 1 / 2 / 3 | Snelheid 1×, 2×, 4× |

## Hoe het werkt
1. Je staat als boer op het erf. Loop naar de rode tractor (de ploeg hangt er al aan) en druk **E**
2. Rij het erf af naar Veld 1 (de witte pijl wijst de weg) en druk **spatie** om te ploegen
3. Rij terug, zet de ploeg neer (**F**), rij achteruit tegen de **zaaimachine** en koppel die aan (**F**). Kies een gewas (**C**) en zaai
4. Is het gewas rijp, dan oogst je met de **maaidorser**. Het graan gaat naar de silo
5. Verkoop in de **Markt**, waar de prijzen elke dag veranderen
6. Geen zin om alles zelf te doen? Huur in de tab **Veld** een **loonwerker** in
7. Koop extra velden, tractoren en werktuigen

## Projectstructuur
```
index.html        pagina + layout
css/style.css     opmaak
js/data.js        ALLE content: gewassen, machines, velden, silo, doelen
js/game.js        spellogica (cellen, loonwerkers, economie, opslaan)
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
