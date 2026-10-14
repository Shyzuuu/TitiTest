# Subway Surfers Infinite Lab — Ultimate Run Control System

Prototype **autonome** de runner à trois voies inspiré de Subway Surfers, conçu comme banc d'essai :
ressources de test illimitées, ralenti de 0,10× à 1,00× modifiable à chaud, enregistrement intégral
d'une run et **rejeu déterministe vérifié** événement par événement.

Application web sans dépendance (HTML + JavaScript modules + Canvas 2D), jouable au clavier sur ordinateur
et au doigt sur Android (navigateur ou application installée « Ajouter à l'écran d'accueil »).

---

## Démarrage rapide

```bash
cd subway-lab
npm start            # ou : node server.mjs 8080
```

1. Ouvrez `http://localhost:8080/` (ordinateur) ou l'adresse « Réseau local » affichée dans le terminal
   (téléphone Android connecté au même Wi-Fi).
2. Appuyez sur **● REC**, jouez (flèches / glissements), changez la vitesse dans l'onglet **Vitesse**.
3. Appuyez sur **■ STOP** puis renommez la run.
4. Onglet **Rejeu** → choisissez la run → **Charger** → **▶ Lecture**. Le rapport de comparaison
   s'affiche à la fin (« Reproduction exacte » si tout concorde).

Sur téléphone, le bouton rond **LAB** ouvre le menu du laboratoire par-dessus le jeu.

---

## 1. Présentation

| Élément | Choix |
|---|---|
| Forme | Application web autonome (PWA), aucune dépendance d'exécution |
| Rendu | Canvas 2D, projection perspective manuelle (pseudo-3D) |
| Simulation | Pas fixe de 1/60 s, RNG `mulberry32` à graine, état entièrement déterministe |
| Stockage | `localStorage` via un `SaveManager` atomique (temporaire → vérification → sauvegarde `.bak` → remplacement) |
| Tests | `node:test` (71 tests) + test navigateur Playwright (10 étapes) |

**Pourquoi le web plutôt que Godot / Android natif ?** L'environnement ne contient ni moteur de jeu ni SDK
Android ; une application web tourne telle quelle dans Chrome Android, s'installe comme une application,
et se teste automatiquement (Node + Chromium headless). Le déterminisme est garanti par la conception
(pas fixe, RNG à état entier, aucune lecture de l'horloge dans la simulation), pas par le moteur.

## 2. Fonctionnalités

- Gameplay : 3 voies, changement de voie, saut, glissade (chute rapide en l'air), barrières basses / hautes,
  trains, trébuchement latéral, pièces, clés, bonus (aimant, score ×2, super-baskets), score, distance,
  difficulté progressive, fin de partie, résurrection payée en clés, recommencer.
- Générateur à graine avec **invariant d'équité** : jamais trois voies bloquées par des trains, toujours une
  voie sûre atteignable sans traverser de train (vérifié sur 60 graines × 6 km).
- Ressources de test : modes Normal / Illimité / Personnalisé, indépendants pour pièces et clés.
- Boutique fictive (améliorations, bonus de départ, tenues, résurrection) pour éprouver les ressources.
- Vitesse : préréglages 0,10× / 0,25× / 0,50× / 0,75× / 1,00× et curseur au centième, à chaud.
- Pause distincte du ralenti.
- Enregistreur : REC / PAUSE / REPRENDRE / STOP, vidage incrémental, récupération après fermeture brutale.
- Rejeu : lecture, pause, reprise, arrêt, recommencer, ralenti, progression, détection de divergence en direct.
- Comparateur : manquants, supplémentaires, écarts temporels, écarts de position / score / distance, divergences d'état.
- Bibliothèque : renommer, dupliquer, supprimer (avec confirmation), exporter / importer JSON, trier, rechercher,
  filtrer, détails, comparer deux runs.
- Diagnostic mesuré : FPS, durée de mise à jour et de rendu, pas par image, pas abandonnés, tampon,
  sauvegardes, stockage, mémoire (si exposée), erreurs, transitions d'état.
- Pilote automatique (optionnel) dont les actions sont enregistrées comme celles d'un joueur.

## 3. Prérequis

- Pour jouer : un navigateur récent (Chrome / Edge / Firefox / Safari ; Chrome Android recommandé).
- Pour servir les fichiers et lancer les tests : **Node.js ≥ 20** (testé avec Node 22.22).
- Pour le test navigateur (facultatif) : Playwright + Chromium (`npm i -D playwright && npx playwright install chromium`).

Les modules ES ne se chargent pas depuis `file://` : passez toujours par un serveur HTTP.

## 4. Installation

```bash
git clone <ce dépôt>
cd TitiTest/subway-lab
# Aucune dépendance à installer pour jouer ni pour les tests Node.
```

## 5. Lancement

| Cible | Procédure |
|---|---|
| Ordinateur | `npm start` puis `http://localhost:8080/` |
| Android, même Wi-Fi | `npm start` sur l'ordinateur, puis sur le téléphone l'URL « Réseau local » affichée |
| Android, installation | Hébergez le dossier en HTTPS (GitHub Pages, Netlify…), ouvrez l'URL dans Chrome → menu ⋮ → **Ajouter à l'écran d'accueil**. Le service worker permet ensuite le jeu hors connexion. |
| Autre port | `node server.mjs 3000` ou `PORT=3000 npm start` |

Le serveur fourni ne sert que les fichiers de l'application (pas les tests) et écoute sur `0.0.0.0`.

## 6. Commandes de gameplay

| Action | Clavier (remappable) | Tactile |
|---|---|---|
| Voie gauche | ← ou A | glisser vers la gauche |
| Voie droite | → ou D | glisser vers la droite |
| Saut | ↑, Espace ou W | glisser vers le haut |
| Glissade | ↓ ou S | glisser vers le bas |
| Pause / reprise | Échap ou P | bouton LAB → Jeu → Pause |
| Recommencer | R (désactivé pendant un rejeu) | — |

Les lettres sont reconnues par leur caractère **et** leur position : « A » fonctionne en AZERTY comme en QWERTY.
Remappage : onglet **Réglages** → **Changer** puis appuyez sur la touche (Échap annule). Boutons tactiles
optionnels et distance minimale de glissement réglables au même endroit.

## 7. Utilisation du ralenti

- Onglet **Vitesse** : préréglages ou curseur (0,10× à 1,00×, pas de 0,01). L'effet est immédiat.
- La vitesse peut être changée à tout moment (jeu, enregistrement, rejeu) : position, obstacles, objets
  collectés, timers de bonus et enregistrement sont conservés.
- Principe : la simulation avance par **pas fixes de 1/60 s de temps simulé**. Le multiplicateur ne change que
  le nombre de pas exécutés par seconde réelle (60 à 1,00×, 6 à 0,10×). Il est appliqué à un seul endroit
  (`SimulationClock`), jamais dans les systèmes de jeu : aucune double application possible, et le résultat d'une
  run ne dépend pas des vitesses utilisées. L'affichage interpole entre deux pas pour rester fluide à 0,10×.
- La **pause** est distincte : le temps simulé s'arrête, l'interface reste active, la reprise restaure le
  multiplicateur précédent.

## 8. Enregistrement d'une run

1. **● REC** (écran d'accueil ou onglet REC, nom optionnel) : nouvel identifiant, capture de la graine, de la
   configuration (améliorations, bonus de départ, tenue), de la vitesse initiale et de l'empreinte de l'état initial.
2. Jouez. Indicateur rouge **REC** + durée en haut à droite ; compteur d'événements dans la barre supérieure.
3. **⏸ PAUSE / ⏵ REPRENDRE** : marqueurs `PAUSE` / `RESUME` enregistrés.
4. **■ STOP** : finalisation, calcul de la durée, comptage, empreinte d'intégrité, validation, sauvegarde, puis
   proposition de renommage.

**Politique pendant la pause** : une commande reçue pendant une pause est **ignorée** — ni appliquée, ni mise en
file, ni enregistrée — et comptée dans le diagnostic (« Entrées ignorées »). Ainsi la reprise ne déclenche jamais
d'action fantôme.

Événements capturés : `RUN_START`, `RUN_END`, `PAUSE`, `RESUME`, `SPEED_CHANGE`, `LANE_LEFT`, `LANE_RIGHT`,
`JUMP`, `SLIDE`, `REVIVE`, `RESTART`, `COIN`, `KEY`, `POWERUP_START`, `POWERUP_END`, `COLLISION`, `STUMBLE`,
`SCORE_CHANGE` (tous les 1 000 points), `DISTANCE_MILESTONE` (tous les 100 m), `PLAYER_STATE`, `CHECKPOINT`
(toutes les 2 s simulées : position, score, distance, pièces, clés, empreinte exacte de l'état), `SIM_ERROR`.

### Format des données (version 1)

```json
{
  "format": "subway-lab-run",
  "version": 1,
  "id": "run_mv8k6kp3_hhnnp8",
  "name": "Ma run",
  "createdAt": "2026-10-14T20:24:51.015Z",
  "updatedAt": "2026-10-14T20:24:51.040Z",
  "meta": { "endTick": 3660, "realDurationMs": 20504, "simDurationS": 61, "eventCount": 185,
            "score": 1522, "distance": 772.1, "coins": 40, "keys": 0, "recovered": false },
  "setup": { "seed": 12345, "physicsVersion": 1, "initialSpeed": 1, "initialHash": "1a2b3c4d",
             "config": { "upgrades": { "MAGNET": 0, "DOUBLE": 0, "SNEAKERS": 0 }, "startBonus": null, "skin": "DEFAULT" } },
  "events": [
    [0, 0, 0, "RUN_START", { "seed": 12345, "speed": 1, "physics": 1 }],
    [12, 270, 7200, "LANE_LEFT", {}]
  ],
  "checksum": "fnv1a:89abcdef"
}
```

Chaque événement est un tuple compact `[séquence, tick, tempsRéelMs, type, payload]` (≈ 3× plus petit qu'un
objet). Sa forme développée, `{ sequence, simulationTime, realTime, type, payload }` (avec
`simulationTime = tick / 60`), est fournie par `toVerboseEvent()` et acceptée à l'import (fichiers v0).
Le schéma de chaque type (champs autorisés et validés) est défini dans `src/recorder/EventSchema.js`.

### Enregistrements longs

Les événements sont gardés en mémoire et **vidés par morceaux** (`draft:<id>:c000001`, … tous les 512
événements ou 5 s) : seul le nouveau morceau est écrit, jamais le fichier entier. Si l'onglet est tué, le
brouillon est reconstitué au lancement suivant (run marquée « récupérée », dernier pas potentiellement incomplet
écarté). Si une écriture échoue, les événements restent en mémoire et l'erreur est affichée ; à l'arrêt, une run
non sauvegardable reste exportable en JSON depuis l'onglet REC.

## 9. Sauvegarde

- Écriture atomique (`SaveManager.writeAtomic`) : `<clé>.tmp` → relecture et validation → copie de l'ancienne
  version en `<clé>.bak` → remplacement → suppression du temporaire. `setItem` est atomique par clé dans
  `localStorage` ; la copie `.bak` protège contre un contenu corrompu.
- À la lecture, une version principale invalide bascule automatiquement sur `.bak` avec un avertissement.
- Vérification d'espace avant chaque écriture (budget 4,8 M caractères ≈ 9,6 Mo UTF-16, proche de la limite de
  5 M caractères de `localStorage`) ; message explicite en cas de dépassement (« Exportez puis supprimez
  d'anciennes runs »).
- Réentrance interdite (pas de sauvegardes entrelacées). Les temporaires orphelins sont nettoyés au lancement.
- Clés utilisées : `sslab:resources`, `sslab:profile`, `sslab:settings`, `sslab:runs:index`, `sslab:run:<id>`,
  `sslab:draft:<id>:…`. Une mise à jour de l'application ne supprime jamais les runs.

## 10. Rejeu

1. Onglet **Rejeu** → sélection → **Charger** : existence, structure, version, ordre, horodatages, données
   initiales et empreinte sont vérifiés ; avertissement si la version de physique diffère.
2. **▶ Lecture** : environnement réinitialisé avec la graine et la configuration **de la run** (pas celles du
   profil actuel), vitesse initiale d'origine, curseur à zéro, puis injection des actions à leur pas d'origine,
   dans leur ordre de séquence.
3. Contrôles : **⏸ Pause** (arrête réellement la simulation), **⏵ Reprendre**, **■ Arrêt** (rapport partiel),
   **↺ Depuis le début**, vitesse (onglet Vitesse ; dès que vous la touchez, la chronologie de vitesse d'origine
   n'est plus suivie — case à cocher pour la réactiver).
4. Pendant le rejeu, les commandes du joueur et la touche R sont refusées ; aucune ressource n'est dépensée ni
   gagnée ; le rejeu enregistre dans un enregistreur **sans stockage** : il ne peut pas écraser l'original.
5. Fin : rapport de comparaison. **Critères d'exactitude** : 0 manquant, 0 supplémentaire, 0 écart temporel,
   0 donnée différente (dont chaque empreinte de point de contrôle), score et distance finaux identiques.
   Les divergences sont aussi signalées en direct (onglet Rejeu et Diagnostic).

## 11. Exportation et importation

- **Exporter** (onglet Runs) : télécharge la run au format JSON ci-dessus.
- **Importer JSON…** : fichier ≤ 25 Mo, ≤ 1 000 000 événements. Le contenu est **une donnée, jamais du code** :
  types, champs (aucun champ inattendu accepté), valeurs numériques, identifiants, horodatages, ordre, version
  (inconnue → refus, ancienne → migration), troncature (absence de `RUN_END`) et empreinte sont vérifiés.
  Un fichier invalide est refusé avec la liste des problèmes. Un identifiant déjà présent reçoit un nouvel
  identifiant (aucun écrasement).

## 12. Pièces et clés de test

Onglet **Ressources** :

| Bouton | Effet |
|---|---|
| ∞ Pièces / ∞ Clés / ∞ Les deux | Mode illimité pour la ou les ressources |
| Désactiver l'illimité | Revient au mode précédent (Normal ou Personnalisé) |
| Mode normal | Les deux ressources repassent en mode Normal (soldes conservés) |
| Réinitialiser | Portefeuille et quantités personnalisées à 0 (avec confirmation) |
| Quantité personnalisée → Appliquer | Mode Personnalisé avec la quantité saisie (entier 0 – 999 999 999 ; négatifs, décimaux et textes refusés) |

En mode illimité, un achat ne modifie ni le solde ni le mode (vérifié sur 5 000 achats). Les débits sont
atomiques (pièces et clés ensemble ou rien). Les paramètres sont sauvegardés avec le mode, les quantités, la date
de modification et la version (migration automatique du format v1). L'onglet **Boutique** propose des achats
simulés et un test « 1 000 achats ».

Ces ressources n'existent **que dans ce prototype**. Aucun compte, achat ou sauvegarde d'un service tiers n'est
lu ni modifié.

## 13. Dépannage

| Symptôme | Cause / solution |
|---|---|
| Page blanche, erreur de module | Ouverture en `file://` : lancez `npm start`. |
| « Stockage local indisponible » | Navigation privée stricte ou stockage bloqué : les runs ne survivront pas à la fermeture. Autorisez le stockage du site. |
| « Espace insuffisant » | Budget `localStorage` atteint (≈ 10 runs de 30 min) : exportez puis supprimez des runs. |
| Run « récupérée » dans la liste | L'onglet a été fermé pendant un REC ; la run a été reconstituée depuis le brouillon. |
| Rejeu « Divergence détectée » | Run altérée, ou enregistrée avec une autre version de physique (avertissement au chargement). |
| Téléphone : pas d'accès à l'URL locale | Même réseau Wi-Fi requis ; autorisez Node dans le pare-feu ; utilisez l'IP affichée. |
| Le jeu se met en pause seul | Comportement voulu quand l'onglet est masqué (évite de perdre des actions). |
| Saccades sur un vieux téléphone | Le pas abandonné est compté dans Diagnostic ; la simulation reste déterministe (seule la vitesse réelle baisse). |

## 14. Tests automatisés

```bash
npm test                 # 71 tests : unitaires + intégration + régression + rejeu long (≈ 1,5 s)
npm run test:unit        # modules isolés
npm run test:integration # scénarios A à E et contrôles du LabController
npm run test:regression  # déterminisme, empreinte de référence, rejeu de 30 min
npm run test:perf        # mesures d'une run de 30 min simulées (argument : minutes)
npm run test:e2e         # navigateur réel (Playwright + Chromium), 10 étapes via l'interface
```

L'empreinte de référence (`tests/regression/determinism.test.mjs`) détecte toute modification involontaire de la
physique ou du générateur : en cas de changement volontaire, incrémentez `PHYSICS_VERSION`
(`src/game/constants.js`) puis mettez à jour l'empreinte. Résultats détaillés : [`docs/VALIDATION.md`](docs/VALIDATION.md).

## 15. Architecture

```
src/
  app/        LabController (orchestrateur sans DOM), StateMachine
  simulation/ SimulationClock, FixedStepRunner, RandomProvider
  game/       GameWorld (GameStateManager), PlayerController, AutoPilot, constants, runConfig
    systems/  LaneMovement, Jump, Slide, Collision, ObstacleSpawner, Collectible, Powerup, Score, Difficulty
  recorder/   EventSchema, RunValidator (validation, empreinte, migration), RunRecorder
  replay/     ReplayEngine (planificateur), ReplayComparator (rapport)
  resources/  ResourceTestManager, PurchaseSimulator
  storage/    StorageAdapter (localStorage / mémoire), SaveManager, RunRepository
  input/      InputController (clavier remappable, glissements)
  render/     Renderer (Canvas pseudo-3D, interpolation)
  ui/         App, panneaux (Jeu, REC, Vitesse, Rejeu, Runs, Ressources, Boutique, Diagnostic, Réglages)
tests/        unit, integration, regression, replay, perf, e2e, helpers
```

- L'UI n'a aucune logique métier : chaque bouton appelle une méthode publique de `LabController`, et l'état des
  boutons est dérivé de `capabilities()` (lui-même dérivé de la machine à états).
- **Machine à états** : `INITIALIZING`, `READY`, `RUNNING`, `PAUSED`, `RECORDING`, `RECORDING_PAUSED`,
  `REPLAYING`, `REPLAY_PAUSED`, `FINISHED`, `ERROR`. Table des transitions dans `src/app/StateMachine.js` ;
  aucune transition ne relie enregistrement et rejeu ; chaque transition est journalisée (onglet Diagnostic).
  `PAUSED` (pause d'une partie non enregistrée) complète la liste demandée.
- **Ordre d'un pas** (identique en jeu, enregistrement et rejeu) : redémarrage éventuel → actions dans l'ordre →
  `GameWorld.step()` → point de contrôle → tick + 1. Une action est enregistrée avant d'être appliquée : elle
  précède toujours ses conséquences.
- **Erreur de simulation** : l'enregistrement en cours est sauvegardé avec un événement `SIM_ERROR`, l'application
  passe en `ERROR`, puis « Revenir à l'état prêt » restaure un état cohérent.
- Performances : aucune allocation dans les boucles par pas (compaction en place, tableaux réutilisés), interface
  rafraîchie à 10 Hz avec écriture DOM uniquement si la valeur change, aucune écriture disque par image.

## 16. Limites d'intégration avec le jeu officiel

- Ce projet **ne modifie pas Subway Surfers** (SYBO). Son code, ses cartes, ses modèles et ses sauvegardes ne
  sont pas accessibles ici, et le prototype n'en contient aucun élément : décor, personnages et trains sont
  dessinés de façon générique.
- Il n'existe pas d'API autorisée permettant de lire ou d'écrire les pièces, les clés ou l'horloge du jeu
  officiel. Injecter un « mod menu » dans l'APK (pièces/clés illimitées, ralenti) reviendrait à modifier une
  application commerciale et à contourner ses achats intégrés : ce n'est pas réalisé ici et ne le sera pas.
- Tout ce que le cahier des charges demande (ressources illimitées, ralenti, enregistrement, rejeu, comparaison)
  est donc implémenté et vérifié **dans ce prototype**, dont la simulation est entièrement contrôlée.
- Limites propres au prototype : stockage limité par `localStorage` (~10 runs de 30 min) ; le rejeu est exact
  sur la même version de physique (une version différente est signalée) ; FPS et ressenti tactile non mesurés sur
  un appareil Android physique (tests navigateur effectués en Chromium, émulation mobile comprise).
