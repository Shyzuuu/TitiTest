# TitiTest

## Cercle — messagerie multi-personnages

Application web complète (React + Node.js + SQLite + Socket.IO) : conversations indépendantes avec des personnages fictifs qui écrivent d'eux-mêmes, réponses à ses propres messages, brouillons par conversation, boîte mail virtuelle, notifications, mémoire par personnage et IA (Claude ou simulation locale) capable de répondre à votre place après un délai sans jamais doubler une réponse manuelle.

Documentation, installation et tests : [`cercle/README.md`](cercle/README.md).

```bash
cd cercle && npm install && npm run dev   # http://127.0.0.1:5173 — identifiant « moi », mot de passe « cercle »
```

## TitiSnake

Snake en un seul fichier (`index.html`), sans dépendance, jouable au clavier et au tactile.

- Swipe, pad ou flèches / ZQSD / WASD pour diriger
- Tap ou Espace pour pause
- Record conservé en local

## Abyss Hub // DOORS

Script client Roblox DOORS pour Delta Android (ASCII uniquement, a coller dans l'executeur).

| Fichier | Statut |
|---|---|
| `doors/parts/AbyssPaint_1.lua` a `_3.lua` | **A coller dans Delta Android** : AbyssPaint (hub) decoupe en 3 parties de ~24 Ko (Delta n'execute pas un script colle de plus de ~32 Ko). Executer 1, puis 2, puis 3 : la partie 3 recolle et lance le script. Regenerer avec `python3 doors/build_parts.py` |
| `doors/AbyssPaint.lua` | Hub : ecran de verrou par code (seule l'empreinte du code est stockee, jamais le code), puis choix du jeu : DOORS ou Universel (anti-AFK, rejoindre / changer de serveur). Script complet (source des parties ; utilisable tel quel sur PC ou par loadstring) (66 Ko, theme Windows 95 / MS Paint avec ombre, degrade, palette) : ESP (gethui, filtre salle, entites, monstres/PNJ, joueurs DOORS, objets, or), categories ESP par floor (Hotel, Mines, Rooms, Backdoor, Outdoors, Archives, Stairwell) activees selon le floor detecte, protections locales reprises d'Abysall/AbysallContinued (Screech, A90, Halt, Dread, Surge, jumpscares, Giggle, Snare, Dupe, oeufs, banane, lave, Seek, Jeff, Vacuum, Alma, Ransom), alertes avec cachette la plus proche, oxygene, Haste, code bibliotheque, crucifix anime, Fullbright, FOV, bonus de vitesse ajoute a la vitesse ecrite par le jeu avec anti-rollback auto (bonus reduit a chaque recul serveur), anti-acceleration, saut, prompts instantanes, auto-interaction (tiroirs, coffres, or, objets a portee normale), bandeau rouge Rush/A-60, Archives : numero des colis Honcho a recuperer + depot auto, police d'ecriture au choix dont la police exacte de DOORS (lue dans l'interface du jeu) |
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
