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
| `doors/AbyssV5.lua` | **Version actuelle.** 9 pages (Dashboard, ESP, Fullbright, Joueur, Entites, Crucifix, Auto, Debug, Reglages), journal + auto-test integres |
| `doors/AbyssLite.lua` | Version courte confirmee sur Delta Android, a utiliser si V5 ne passe pas au collage |
| `doors/Test.lua` | Diagnostic : affiche un carre rouge si l'executeur fonctionne |
| `doors/AbyssV3.lua`, `doors/AbyssV4.lua` | Anciennes versions, remplacees par V5 |
| `doors/AbyssHub.lua` | Ancienne version avec accents : ne s'execute pas sur Delta Android |

Dans Roblox Studio, V5 fonctionne aussi comme `LocalScript` dans `StarterPlayer > StarterPlayerScripts`
(sans sauvegarde ni ramassage automatique, qui dependent de fonctions d'executeur).

### Tests

`doors/tests/run_tests.sh [chemin/vers/luau]` execute V5 dans un environnement Roblox simule
(`doors/tests/roblox_mock.luau`) et verifie 79 comportements : navigation, chaque interrupteur, restauration
de l'eclairage, retrait des marqueurs detruits, scenario crucifix, protections anti-A90 / Halt / Screech, journal, re-execution et fermeture.
Le simulateur ne fait aucun rendu : l'affichage reel et les noms d'objets de DOORS restent a verifier en jeu.
