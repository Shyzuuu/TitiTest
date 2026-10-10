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
| `doors/AbyssPaint.lua` | Theme Windows 95 / MS Paint (31,6 Ko) : ESP par etiquettes 3D + contours (joueurs DOORS, entites, monstres/PNJ de tout jeu, objets), bouton de test ESP, avec nom, distance et vie, crucifix anime (chaines, cercle, aspiration), Fullbright, speed, FOV, anti-Screech/A90/Halt |
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
