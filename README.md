# 🚜 Agro Tycoon 2.0

Een farming tycoon die je in de browser speelt. Hij is geïnspireerd op [Agro Tycoon](https://store.steampowered.com/app/4660350/Agro_Tycoon/) (Steam, 2027). Ploeg, zaai en oogst je velden met je eigen machinepark, verkoop op het juiste moment en groei uit tot landbouwmagnaat.

## Spelen
Open `index.html` in je browser. Een server of installatie is niet nodig.

Of start een lokale server:
```bash
npx serve .
```

**Besturing**
- Klik op een veld om het te selecteren en een taak te starten
- Spatie = pauze, `1` / `2` / `3` = snelheid 1×, 2× en 4×
- De voortgang wordt automatisch opgeslagen in je browser

## Hoe het werkt
1. **Ploegen** (tractor + ploeg) → **Zaaien** (tractor + zaaimachine, kies een gewas) → **Groeien** → **Oogsten** (maaidorser)
2. Het graan gaat naar de **silo**. Verkoop het in de **Markt**, waar de prijzen elke dag veranderen
3. Koop **extra velden, tractoren en werktuigen**. Elke machine doet één taak tegelijk, dus met meer machines werk je meerdere velden tegelijk

## Projectstructuur
```
index.html        pagina + layout
css/style.css     opmaak
js/data.js        ALLE content: gewassen, machines, velden, silo, doelen
js/game.js        spellogica (tijd, taken, economie, opslaan)
js/render.js      tekenen van de kaart op het canvas
js/ui.js          zijpaneel, topbalk, logboek
js/main.js        opstarten + game loop
docs/ONDERZOEK.md onderzoek naar Agro Tycoon en concurrenten
todo.md           roadmap met alle extra's
```

**Een nieuwe tractor of nieuw gewas toevoegen?** Voeg een regel toe in `js/data.js`. De winkel en de markt pakken het automatisch op.
