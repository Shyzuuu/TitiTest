# TitiTest

## TitiSnake

Snake en un seul fichier (`index.html`), sans dépendance, jouable au clavier et au tactile.

- Swipe, pad ou flèches / ZQSD / WASD pour diriger
- Tap ou Espace pour pause
- Record conservé en local

## Abyss Hub // DOORS

Script client Roblox DOORS pour Delta Android (ASCII uniquement, a coller dans l'executeur).

| Fichier | Statut |
|---|---|
| `doors/AbyssPaint.lua` | **Script unique a coller dans Delta** (66 Ko, theme Windows 95 / MS Paint avec ombre, degrade, palette) : ESP (gethui, filtre salle, entites, monstres/PNJ, joueurs DOORS, objets, or), categories ESP par floor (Hotel, Mines, Rooms, Backdoor, Outdoors, Archives, Stairwell) activees selon le floor detecte, protections locales reprises d'Abysall/AbysallContinued (Screech, A90, Halt, Dread, Surge, jumpscares, Giggle, Snare, Dupe, oeufs, banane, lave, Seek, Jeff, Vacuum, Alma, Ransom), alertes avec cachette la plus proche, oxygene, Haste, code bibliotheque, crucifix anime, Fullbright, FOV, bonus de vitesse ajoute a la vitesse ecrite par le jeu avec anti-rollback auto (bonus reduit a chaque recul serveur), anti-acceleration, saut, prompts instantanes, auto-interaction (tiroirs, coffres, or, objets a portee normale), bandeau rouge Rush/A-60, Archives : numero des colis Honcho a recuperer + depot auto, police d'ecriture au choix dont la police exacte de DOORS (lue dans l'interface du jeu) |
| `doors/AbyssMini.lua` | **A utiliser sur Delta Android** (< 30 Ko) : ESP 12 categories + couleurs, Fullbright, brouillard, speed, FOV, alertes, anti-Screech/A90/Halt, auto, crucifix visuel. Affiche l'erreur a l'ecran s'il plante |
| `doors/AbyssV5.lua` | Version complete (88 Ko) avec journal et auto-test : trop grosse pour etre collee dans Delta Android (rien ne s'affiche), utilisable sur PC ou dans Studio |
| `doors/AbyssLite.lua` | Version courte confirmee sur Delta Android |
| `doors/Test.lua` | Diagnostic : affiche un carre rouge si l'executeur fonctionne |
| `doors/AbyssV3.lua`, `doors/AbyssV4.lua` | Anciennes versions, remplacees par V5 |
| `doors/AbyssHub.lua` | Ancienne version avec accents : ne s'execute pas sur Delta Android |

Dans Roblox Studio, V5 fonctionne aussi comme `LocalScript` dans `StarterPlayer > StarterPlayerScripts`
(sans sauvegarde ni ramassage automatique, qui dependent de fonctions d'executeur).

### Tests

`doors/tests/run_tests.sh [chemin/vers/luau]` execute V5, Mini et Paint (chaque bouton clique deux fois, effets, animation du crucifix, fermeture) dans un environnement Roblox simule
(`doors/tests/roblox_mock.luau`) et verifie 79 comportements : navigation, chaque interrupteur, restauration
de l'eclairage, retrait des marqueurs detruits, scenario crucifix, protections anti-A90 / Halt / Screech, journal, re-execution et fermeture.
Le simulateur ne fait aucun rendu : l'affichage reel et les noms d'objets de DOORS restent a verifier en jeu.
