# Onderzoek: Agro Tycoon (2027) en concurrenten

## 1. Agro Tycoon (Ushurileo, Steam 2027)

**Wat het is:** een managementsimulator in isometrische pixel-art. Je begint met een klein stuk grond en startkapitaal en bouwt dat uit tot een groot landbouwbedrijf. De nadruk ligt op technisch veldbeheer, machines en een realistische economie, niet op "casual" farming.

**Status:** de demo staat sinds 25 juli 2026 op Steam en itch.io. De user reviews zijn erg positief (21/21 positief op het moment van onderzoek). De volledige release staat gepland voor 2027.

**Kernfeatures (store page en devlogs):**

| Systeem | Wat het doet |
|---|---|
| Bodembewerking | Ploegen, zaaien, gewasresten beheren, irrigatie en spuiten voor maximale opbrengst |
| Machinepark | Tractoren, maaidorsers met maaibord, zaaimachines en aanhangers vanuit de schuur. Meerdere voertuigen tegelijk uitrijden |
| Gewassen | Tarwe, maïs, soja, gerst, haver, koolzaad en bonen |
| Silo's | Plaatsbare silo's die de opslagcapaciteit vergroten |
| NPC-automatisering | Schuren bouwen, personeel aannemen (12 verschillende werknemers met eigen kosten en skills) en veldcycli automatiseren met pathfinding |
| Graantransport (v0.3.16) | Arbeider met tractor en aanhanger rijdt mee met de maaidorser, laadt over tijdens het rijden en brengt het graan naar de silo |
| Gewasbescherming (v0.4.0) | Spuitmachine met herbicide |
| Sfeer | Bandensporen op aarde, modder en gras, deeltjes bij het lossen van graan |

**Sterk:** het voelt "echt": machines rijden zichtbaar over het veld en de veldcyclus is concreet (ploegen → zaaien → spuiten → oogsten → transport).
**Zwakker / kansen voor ons:** het spel draait alleen op desktop (Steam), heeft een vrij technische leercurve, en multiplayer of een browserversie zijn niet aangekondigd.

## 2. Concurrenten

| Spel | Platform | Wat ze goed doen | Wat wij kunnen overnemen |
|---|---|---|---|
| **Farming Simulator 25** (Giants) | PC/console | 400+ echte machines, seizoenen, weer (hagel, tornado's), productieketens (bakkerij, kaas, zagerij), contracten, GPS-sturing | Contracten (loonwerk voor geld), productieketens, merk-achtige machinevariatie |
| **Farm Manager 2021 / World** | PC | Echte tycoon: personeel met tevredenheid en training, dierengezondheid, irrigatie, kassen, campagne en sandbox, ziektes en plagen | Personeel met skills, scenario's of campagne, plagen |
| **Farm Manager (mobiel, 2026)** | Mobiel | Echte velden wereldwijd, bodem-pH, grondsoorten, echte weerdata | Bodemkwaliteit per veld, weer dat de opbrengst beïnvloedt |
| **Farm Tycoon** | Switch/PC | Leningen voor uitbreiding, weer en pesticiden, economie-tab (inkomsten/uitgaven), personeelslijst | Leningen en een financieel overzicht |
| **Hay Day** (Supercell) | Mobiel | Bestellingen per truck of boot, eigen winkeltje, buurten (clans), wekelijkse Derby | Orderbord, sociale features (later) |
| **Goodgame Big Farm** | Browser/mobiel | Diepe productieketens, handel tussen spelers, missies | Bewijs dat een farming tycoon in de browser werkt |
| **FarmVille 2/3** | Browser → mobiel | Real-time groei, vrienden | Laagdrempelig en altijd speelbaar |

## 3. Conclusie: wat moet erin zitten?

Uitgangspunt: een singleplayer spel voor in de desktopbrowser.

**Kern (staat er nu in):**
1. **Zelf rijden** met tractor of maaidorser over een grote kaart (zoals in Agro Tycoon en Farming Simulator)
2. Velden waarvan de grond verandert precies waar je werktuig komt (ploegen → zaaien → groeien → oogsten)
3. Loonwerkers voor velden die je niet zelf wilt doen (een eerste stap naar de NPC-automatisering van Agro Tycoon)
4. Gewassen met verschillende groeitijd, zaaikosten en opbrengst
5. Silo met beperkte capaciteit plus een markt met schommelende prijzen, zodat het uitmaakt wanneer je verkoopt
6. Uitbreiden: velden kopen, machines kopen en verkopen, silo upgraden
7. Doelen als tutorial, automatisch opslaan, pauze en snelheid

**Wat we van de concurrenten overnemen (later):** graanbunker en aanhangers (Agro Tycoon), contracten en productieketens (FS25), personeel met skills (Farm Manager), leningen (Farm Tycoon).

Zie [`../todo.md`](../todo.md) voor de volledige lijst met extra's.

## Bronnen
- [Agro Tycoon op Steam](https://store.steampowered.com/app/4660350/Agro_Tycoon/)
- [Agro Tycoon Demo op Steam](https://store.steampowered.com/app/4923570/Agro_Tycoon_Demo/)
- [Agro Tycoon op itch.io + devlogs (v0.3.15, v0.3.16, v0.4.0)](https://ushurileo.itch.io/agro-tycoon)
- [Agro Tycoon op IGDB](https://www.igdb.com/games/agro-tycoon)
- [Agro Tycoon op ModDB](https://www.moddb.com/games/agro-tycoon)
- [Farming Simulator 25](https://www.farming-simulator.com/fs25) · [FS25 wiki](https://farmingsimulator.wiki.gg/wiki/Farming_Simulator_25)
- [Farm Manager 2021 op Steam](https://store.steampowered.com/app/1123830/Farm_Manager_2021/) · [Farm Manager World](https://store.steampowered.com/app/2206350/Farm_Manager_World/)
- [Farm Manager (mobiel)](https://play.google.com/store/apps/details?id=com.trophygames.farmmanager)
- [Farm Tycoon review](https://ladiesgamers.com/farm-tycoon-review/)
- [Hay Day vs Township vs FarmVille](https://haydaymodapk.com/hay-day-vs-township-vs-farmville/)
- [Games like FarmVille](https://www.blog.udonis.co/top-games/games-like-farmville)
