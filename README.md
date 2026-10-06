# 🚜 Agro Tycoon 2.0

Een farming tycoon die je in de browser speelt. Hij is geïnspireerd op [Agro Tycoon](https://store.steampowered.com/app/4660350/Agro_Tycoon/) (Steam, 2027). Ploeg, zaai en oogst je velden met je eigen machinepark, verkoop op het juiste moment en groei uit tot landbouwmagnaat.

## Spelen
**Live:** https://maartendeklerkpxl.github.io/agro-tycoon2.0/

Of open `index.html` lokaal in je browser (desktop). Een server is niet nodig.

**Besturing**
| Toets | Actie |
|---|---|
| WASD / pijltjes | Rijden (of de camera verschuiven als je niet rijdt) |
| Spatie | Werktuig omlaag/omhoog (ploeg, zaaimachine, maaibord) |
| C | Zaaigoed wisselen |
| E | In-/uitstappen |
| Scroll / slepen | Zoomen / kaart verschuiven |
| P | Pauze |
| 1 / 2 / 3 | Snelheid 1×, 2×, 4× |

## Hoe het werkt
1. Ga naar **Garage** en stap in je tractor met de ploeg. Rij naar Veld 1 en druk op **spatie** om te ploegen
2. Koppel daarna de **zaaimachine**, kies een gewas (C) en zaai
3. Is het gewas rijp, dan oogst je met de **maaidorser**. Het graan gaat naar de silo
4. Verkoop in de **Markt**, waar de prijzen elke dag veranderen
5. Geen zin om alles zelf te doen? Huur in de tab **Veld** een **loonwerker** in
6. Koop extra velden, tractoren en werktuigen

## Projectstructuur
```
index.html        pagina + layout
css/style.css     opmaak
js/data.js        ALLE content: gewassen, machines, velden, silo, doelen
js/game.js        spellogica (cellen, loonwerkers, economie, opslaan)
js/vehicle.js     zelf rijden: besturing + werken onder het werktuig
js/render.js      tekenen: camera, velden, machines, minimap, HUD
js/ui.js          zijpaneel, topbalk, logboek
js/main.js        opstarten + game loop
docs/ONDERZOEK.md onderzoek naar Agro Tycoon en concurrenten
todo.md           roadmap met alle extra's
```

**Een nieuwe tractor of nieuw gewas toevoegen?** Voeg een regel toe in `js/data.js`. De winkel en de markt pakken het automatisch op.
