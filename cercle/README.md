# Cercle — messagerie sociale multi-personnages

Application web complète (frontend React, backend Node.js, base SQLite, temps réel Socket.IO) dans laquelle vous discutez avec autant de personnages fictifs que vous le souhaitez. Ils vous écrivent d'eux-mêmes, une boîte mail virtuelle reçoit leurs messages, et une IA peut répondre à votre place si vous tardez, sans jamais doubler une réponse manuelle.

## Sommaire

1. [Démarrage rapide](#démarrage-rapide)
2. [Fonctionnalités](#fonctionnalités)
3. [Architecture](#architecture)
4. [Garanties de cohérence](#garanties-de-cohérence)
5. [Configuration de l'IA](#configuration-de-lia)
6. [Commandes](#commandes)
7. [Tests](#tests)
8. [Déploiement](#déploiement)
9. [API](#api)
10. [Limitations connues](#limitations-connues)

## Démarrage rapide

Prérequis : **Node.js ≥ 22.13** (le module `node:sqlite` intégré est utilisé : aucune dépendance native à compiler).

```bash
cd cercle
npm install                 # dépendances des deux espaces (server, client)
cp .env.example .env        # puis ajustez si besoin (mot de passe, clé IA…)
npm run db:seed             # crée la base et les personnages de démonstration (facultatif : fait au 1er démarrage)
npm run dev                 # backend http://127.0.0.1:4000 + frontend http://127.0.0.1:5173
```

Ouvrez <http://127.0.0.1:5173> et connectez-vous avec l'identifiant `moi` et le mot de passe `cercle` (valeur par défaut en développement, à remplacer via `APP_PASSWORD`).

Pour voir les automatisations en quelques secondes : **Paramètres → Vitesse de simulation → Démo rapide** (tous les délais sont divisés par 12 : une réponse IA à 2 minutes arrive en 10 s), ou bouton **« Recevoir un message maintenant »** dans le panneau d'informations d'une conversation.

Tester depuis un smartphone du même réseau : `npm run build`, puis `HOST=0.0.0.0 SERVE_CLIENT=true npm run dev:server`, et ouvrez `http://<adresse-IP-de-l-ordinateur>:4000` sur le téléphone.

Arrêt : `Ctrl+C` (arrêt propre : le planificateur termine ses tâches en cours, les tâches en attente restent en base et reprennent au prochain démarrage).

## Fonctionnalités

| Domaine | Ce qui est implémenté |
|---|---|
| Conversations indépendantes | Une conversation par personnage, identifiants stables, historique paginé, ordre garanti par numéro de séquence. Changement de personne instantané par l'URL (`/chats/:id`) ; aucun événement entrant ne change la conversation affichée. Position de lecture mémorisée par conversation. |
| Messages successifs | Aucune règle sur l'auteur précédent : 5, 10, 50 messages d'affilée sont acceptés, chacun avec son identifiant et son horodatage. |
| Répondre à un message | Action « Répondre » sur chaque bulle (la vôtre, celle du personnage, une réponse IA). Aperçu au-dessus de la saisie, annulation (✕ ou Échap), référence `replyToMessageId`, clic sur la citation → défilement vers l'original (chargement de l'historique si besoin), mention « message cité plus disponible » si supprimé. Citation interdite entre conversations différentes. |
| Brouillons | Un brouillon (texte + citation en cours) par conversation, sauvegardé localement immédiatement et côté serveur (différé, horodaté : une sauvegarde ancienne n'écrase jamais une récente). Restauré après rechargement, sur n'importe quel appareil. |
| Envoi fiable | Affichage optimiste, clé d'idempotence par message (`clientId`), état « Échec de l'envoi » avec **Réessayer** (même clé : aucun doublon possible) et **Supprimer**. |
| Messages entrants | Planificateur serveur persistant : messages spontanés par personnage (intervalle min/max, rafales de 1 à 5 messages, relance si une question reste sans réponse), réponses aux messages de l'utilisateur regroupées (anti-rafale). Contenu contextualisé (personnalité, centres d'intérêt, souvenirs, sujets en suspens) et anti-répétition. Fonctionne navigateur fermé. Mode démo / mode normal, suspension globale ou par personnage. |
| Boîte mail virtuelle | Réception, Non lus, Lus, Envoyés, Archives, Corbeille. Une entrée par message (contrainte d'unicité), lecture partagée avec la conversation, archivage, corbeille puis suppression définitive sans toucher à la conversation. Recherche par contenu, expéditeur et dates. « Répondre dans la conversation ». |
| IA à ma place | Quatre modes par personnage : désactivée, suggestion (à valider / modifier / supprimer), automatique, automatique avec exceptions (sujets sensibles, sujets exclus, demandes ambiguës → confirmation). Délai configurable, compte à rebours visible. |
| Mémoire | Souvenirs par personnage (faits, préférences, projets, événements, « retiens que… »), extraits de vos messages et utilisés dans la génération. Consultation, ajout, modification, suppression, réinitialisation. Strictement cloisonnée. |
| Notifications | Centralisées et persistées, regroupées par conversation (« 3 nouveaux messages de Sarah »), cliquables vers la bonne conversation. Types : nouveau message, suggestion prête, confirmation requise, réponse IA envoyée, erreur IA. Toasts non intrusifs. |
| Administration | État réel (serveur, base, planificateur, clients temps réel, fournisseur IA **non vérifié** tant qu'aucun test n'a abouti), tâches (filtrer, exécuter maintenant, annuler), journaux techniques, test du fournisseur, suspension/reprise, export JSON, réinitialisation avec confirmation saisie, simulation de message entrant. |
| Personnages | Création, modification, désactivation, suppression (confirmation saisie). Nombre illimité. Six personnages de démonstration : Emma, Lucas, Sarah, Nathan, Chloé, Hugo. |
| Interface | Thème sombre par défaut, thème clair et « système ». Trois zones sur ordinateur (navigation + conversations, conversation, informations repliables). Sur smartphone : liste dédiée, conversation plein écran avec retour, barre de navigation basse, panneau d'informations en surimpression. |
| Sécurité | Session par cookie `httpOnly` `SameSite=Lax` (jeton stocké haché), mots de passe scrypt, en-tête anti-CSRF obligatoire, validation Zod stricte de toutes les entrées, requêtes SQL paramétrées, recherche plein texte neutralisée, limitation de débit, en-têtes Helmet/CSP, confirmations `X-Confirm` pour les opérations irréversibles, erreurs internes jamais détaillées au client. |

## Architecture

```
cercle/
├── server/                     Node.js + TypeScript (exécuté par tsx)
│   └── src/
│       ├── config.ts           variables d'environnement validées (Zod)
│       ├── bootstrap.ts        conteneur de dépendances (AppContext)
│       ├── app.ts              Express (REST) + Socket.IO + service du client construit
│       ├── db/                 accès SQLite transactionnel, migrations versionnées, données de démo
│       ├── realtime/           journal d'événements persistant (outbox) et diffusion
│       ├── http/               authentification, anti-CSRF, confirmations, erreurs
│       └── modules/
│           ├── auth/           sessions, profil, mot de passe
│           ├── characters/     personnages et leurs paramètres
│           ├── conversations/  résumés, lecture
│           ├── messages/       envoi, citations, suppression, recherche
│           ├── mailbox/        boîte mail virtuelle
│           ├── notifications/
│           ├── drafts/
│           ├── memory/         extraction et gestion des souvenirs
│           ├── ai/             fournisseurs (Claude, simulation locale), prompts, validation, sensibilité, suggestions
│           ├── scheduler/      file de tâches persistante, politiques d'automatisation, exécuteurs
│           ├── settings/
│           ├── events/         amorçage du client et rattrapage d'événements
│           └── admin/
├── client/                     React 18 + TypeScript + Vite + Tailwind CSS + Zustand
│   └── src/
│       ├── store/              état normalisé, réducteur d'événements pur, temps réel (rattrapage des trous)
│       ├── components/         chat/, info/, layout/, ui/
│       └── pages/              messages, boîte mail, contacts, notifications, personnages, paramètres, administration
└── e2e/                        tests Playwright (serveur réel + navigateur)
```

### Modèle de données (SQLite, migration `001_schema_initial`)

`users`, `sessions`, `characters` (identité + `automation_json` + `ai_json`), `conversations` (`next_seq`, `version`, `last_user_seq`, `last_character_seq`, `auto_chain`), `messages` (`seq` unique par conversation, `author_type`, `origin` ∈ manual / ai_auto / ai_suggestion / simulation / character_reply, `reply_to_message_id`, `client_id` unique par conversation), `messages_fts` (index plein texte FTS5 sans accents), `mailbox_entries` (`message_id` unique), `character_memories`, `scheduled_tasks` (index unique partiel sur `dedupe_key` des tâches en attente), `ai_suggestions`, `notifications`, `drafts`, `settings`, `events` (journal temps réel), `logs`, `ai_usage`.

### Temps réel

Chaque modification écrit un événement numéroté dans la table `events` **dans la même transaction** que la donnée ; la diffusion Socket.IO n'a lieu qu'après validation. Le client applique les événements dans l'ordre, ignore les doublons, détecte les trous de séquence et rattrape via `GET /api/events?after=N` (ou se resynchronise entièrement si l'historique a été purgé). Chaque événement porte l'identifiant de sa conversation.

## Garanties de cohérence

**Priorité absolue aux réponses manuelles.** Une tâche `ai_reply` mémorise `anchorUserSeq` (numéro du dernier message utilisateur au moment de sa programmation). Elle est vérifiée trois fois :

1. à l'envoi d'un message manuel, les tâches IA en attente **de cette conversation seulement** sont annulées ;
2. à l'exécution, avant la génération : si `last_user_seq > anchorUserSeq`, la tâche est marquée `superseded` ;
3. après la génération, **dans la transaction d'écriture** : même contrôle. SQLite étant synchrone et la transaction `BEGIN IMMEDIATE`, aucune réponse manuelle ne peut s'intercaler entre ce contrôle et l'insertion.

Le cas « réponse à 14 h 01 min 59 s pour une IA programmée à 14 h 02 » et le cas « réponse pendant que l'IA génère » sont couverts par des tests.

**Politique de regroupement.** Une seule réponse IA en attente par conversation : elle couvre le groupe de messages non répondus du personnage ; son échéance reste « premier message + délai », avec une marge de 15 s si une rafale arrive au dernier moment. Les réponses du personnage à vos messages successifs sont regroupées de la même façon (attente de la fin de votre rafale). Une chaîne IA ↔ personnage est plafonnée (`maxAutoChain`, 3 par défaut).

**Idempotence et redémarrage.** Les messages produits par une tâche portent la clé `task:<id>:<partie>` (unique par conversation) : rejouer une tâche ne peut pas créer de doublon. Au démarrage, les tâches « running » orphelines sont remises en file (ou marquées remplacées), les tâches en attente reprennent ; les messages spontanés en retard après une suspension sont replanifiés plutôt que rattrapés en rafale. Chaque clôture de tâche est conditionnée à son numéro de tentative (une exécution qui a perdu son bail ne peut plus rien écrire).

**Cloisonnement.** Le contexte envoyé à l'IA est construit uniquement à partir de la conversation et de la mémoire du personnage concerné. Toutes les routes vérifient l'appartenance des ressources à l'utilisateur.

## Configuration de l'IA

Deux fournisseurs :

| Fournisseur | Quand | Remarque |
|---|---|---|
| **Claude (API Anthropic)** | `ANTHROPIC_API_KEY` définie (et `AI_PROVIDER=auto` ou `anthropic`) | Appels serveur uniquement, via le SDK officiel `@anthropic-ai/sdk`. |
| **Simulation locale** | Par défaut sans clé, ou choisie explicitement | Pas d'IA réelle : gabarits contextuels (personnalité, centres d'intérêt, souvenirs, questions). Toujours présentée comme telle dans l'interface. |

Mise en place de Claude :

1. Créez une clé sur <https://console.anthropic.com> (rubrique API Keys).
2. Dans `cercle/.env` : `ANTHROPIC_API_KEY=sk-ant-…` (ne jamais committer ce fichier).
3. Redémarrez le serveur, puis **Administration → Tester le fournisseur** : l'état passe à « Vérifié » uniquement si l'appel réussit.

Réglages (`.env`) : `AI_MODEL` (défaut `claude-opus-5-5`), `AI_EFFORT` (défaut `low`, adapté à la conversation ; `medium`/`high` pour des réponses plus travaillées mais plus lentes et coûteuses), `AI_MAX_TOKENS`, `AI_TIMEOUT_MS`, `AI_SERVER_FALLBACKS` (repli serveur d'Anthropic si le modèle refuse une requête). Le choix d'un modèle moins coûteux (par exemple `claude-haiku-5-5`) se fait simplement via `AI_MODEL`.

Maîtrise des coûts et des pannes : plafond quotidien d'appels (Paramètres, 300 par défaut), délai d'attente par appel, réessais contrôlés par le planificateur (3 tentatives, attente exponentielle), journal des erreurs, compteur de jetons du jour dans l'administration. En cas de panne, les personnages basculent sur la simulation locale (désactivable) ; une réponse **à votre place** n'est jamais envoyée par ce repli sans validation (elle devient au mieux une suggestion).

Protection contre l'injection de consignes : les messages sont transmis comme données balisées (`<historique>`, `<souvenirs>`), les chevrons y sont neutralisés, la consigne système interdit d'exécuter des instructions issues de ces données, aucun secret n'est présent dans les prompts, et la sortie est nettoyée (balises, blocs de code, préfixes de nom, longueur maximale) avant enregistrement. L'IA n'a aucun outil : elle ne peut rien exécuter sur le serveur.

## Commandes

Depuis `cercle/` :

| Commande | Effet |
|---|---|
| `npm install` | Installe les dépendances (espaces `server` et `client`). |
| `npm run db:migrate` | Applique les migrations versionnées. |
| `npm run db:seed` | Crée la base et les personnages de démonstration si elle est vide. |
| `npm run db:reset` | Réinitialise les données de démonstration (l'utilisateur est conservé). |
| `npm run dev` | Backend (rechargement à chaud) + frontend Vite. |
| `npm run dev:server` / `npm run dev:client` | L'un ou l'autre. |
| `npm run build` | Construit le client dans `client/dist`. |
| `npm start` | Démarre le serveur en production (sert aussi le client construit). |
| `npm run typecheck` | Vérification TypeScript des deux espaces. |
| `npm test` | Tests unitaires et d'intégration (serveur + client). |
| `npm run test:e2e` | Construit le client puis lance les tests Playwright. |
| `npm run test:all` | Tout ce qui précède. |

## Tests

Résultats de la dernière exécution dans l'environnement de développement (`npm run typecheck`, `npm test`, `npm run test:e2e`) : **55 tests serveur, 9 tests client, 5 tests de bout en bout, tous réussis.**

Correspondance avec le cahier des charges :

| N° | Scénario | Où |
|---|---|---|
| 1 | Changement de personne, historiques et états conservés | `server/test/messaging.test.ts`, `client/test/store.test.ts`, `e2e/scenario.spec.ts` |
| 2 | Réception en arrière-plan (Socket.IO réel), liste et notification, conversation active intacte | `server/test/realtime.test.ts`, `client/test/store.test.ts`, `e2e/scenario.spec.ts` |
| 3 | Cinq messages successifs (et dix simultanés), ordre et identifiants | `server/test/messaging.test.ts`, `client/test/store.test.ts` |
| 4 | Réponse à son propre message, scénario de la partie 11, citation supprimée, citation inter-conversations refusée | `server/test/messaging.test.ts`, `e2e/scenario.spec.ts`, `e2e/mobile.spec.ts` |
| 5 | Brouillons indépendants (citation incluse), persistance après rechargement | `server/test/resilience.test.ts`, `client/test/store.test.ts`, `e2e/scenario.spec.ts` |
| 6 | Réponse IA différée, modes suggestion / auto / auto avec exceptions, regroupement, plafond de chaîne | `server/test/ai-reply.test.ts` |
| 7 | Priorité manuelle à 14 h 01 min 59 s, réponse pendant la génération, idempotence | `server/test/ai-reply.test.ts`, `e2e/scenario.spec.ts` |
| 8 | Changement de conversation pendant l'attente, annulation ciblée, recalcul du délai | `server/test/ai-reply.test.ts`, `e2e/scenario.spec.ts` |
| 9 | Boîte mail : unicité, lecture partagée et persistante, archives, corbeille, recherche | `server/test/mailbox.test.ts`, `e2e/scenario.spec.ts` |
| 10 | Redémarrage avec tâche en attente, crash en pleine exécution | `server/test/resilience.test.ts` |
| 11 | Messages simultanés de plusieurs personnages, séquences uniques | `server/test/messaging.test.ts`, `client/test/store.test.ts` |
| 12 | Smartphone (Pixel 7) : liste, plein écran, retour, citations au toucher, boîte mail sans défilement horizontal | `e2e/mobile.spec.ts` |
| 13 | Fournisseur IA indisponible, repli, état « non vérifié »/« erreur », plafond quotidien | `server/test/resilience.test.ts` |
| 14 | Persistance complète après fermeture/réouverture | `server/test/resilience.test.ts`, `e2e/scenario.spec.ts` |
| — | Scénario final de la partie 23, de bout en bout dans un vrai navigateur | `e2e/scenario.spec.ts` |
| — | Mémoire cloisonnée, sécurité (session, CSRF, validation, injection SQL/FTS, confirmations, injection de consignes) | `server/test/memory-security.test.ts` |

Les tests serveur utilisent une horloge pilotable et un fournisseur IA contrôlable (blocage, panne, suspension) pour reproduire les courses de manière déterministe. Les tests E2E démarrent un serveur réel sur une base neuve (`e2e/start-server.mjs`). Playwright 1.56.1 est utilisé ; si votre Chromium est ailleurs, définissez `PW_CHROMIUM_PATH`, sinon installez-le avec `npx playwright install chromium`.

## Déploiement

### En ligne en quelques clics (Render, gratuit)

Le fichier `render.yaml` à la racine du dépôt décrit tout. Sur https://render.com : connexion avec GitHub → **New** → **Blueprint** → dépôt `TitiTest`, branche `claude/multi-character-messaging-app-cvbakx` → saisir un mot de passe pour `APP_PASSWORD` → **Apply**. Le site est disponible à l'adresse `https://cercle-xxxx.onrender.com` affichée par Render (identifiant `moi`). Offre gratuite : le service s'endort après inactivité (premier chargement d'environ 1 minute) et le disque n'est pas persistant (les données repartent de la démonstration après un redémarrage).

### Serveur personnel

Le serveur sert lui-même le client construit : un seul processus Node.

```bash
cd cercle
npm ci
npm run build
NODE_ENV=production APP_PASSWORD='un-mot-de-passe-solide' COOKIE_SECURE=true \
  HOST=127.0.0.1 PORT=4000 npm start
```

- `APP_PASSWORD` est obligatoire en production (le serveur refuse de démarrer sans).
- En production, les cookies sont `Secure` et la CSP force le HTTPS. Pour un usage en HTTP simple (réseau local sans TLS), ajoutez `COOKIE_SECURE=false`.
- Placez un reverse proxy HTTPS devant (Nginx, Caddy…) en transmettant les WebSockets :

```nginx
location / {
  proxy_pass http://127.0.0.1:4000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

- Supervision : `systemd` ou `pm2` (`pm2 start npm --name cercle -- start`). L'arrêt sur `SIGTERM` est propre.
- Sauvegarde : la base est le fichier `DATABASE_FILE` (mode WAL). Sauvegardez-la à chaud avec `sqlite3 server/data/cercle.db ".backup sauvegarde.db"`, ou exportez les données au format JSON depuis l'administration.
- Un seul processus doit écrire dans la base (le planificateur n'est pas conçu pour plusieurs instances simultanées).

## API

Toutes les routes sont préfixées par `/api`, exigent une session (sauf connexion et santé) et, pour les requêtes modifiantes, l'en-tête `X-Requested-With: cercle`.

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/auth/login`, `/auth/logout` | Session |
| GET | `/auth/me` · PATCH `/me` · POST `/me/password` | Profil |
| GET | `/bootstrap` | État complet (amorçage, resynchronisation) |
| GET | `/events?after=N` | Rattrapage des événements temps réel |
| GET, POST | `/characters` | Lister, créer un personnage |
| GET, PATCH, DELETE | `/characters/:id` | Lire, modifier (identité, automatisations, IA), supprimer (`X-Confirm: DELETE_CHARACTER`) |
| GET | `/conversations`, `/conversations/:id` | Résumés (non-lus, dernier message, tâches en attente) |
| GET | `/conversations/:id/messages?beforeSeq&limit` | Historique paginé |
| POST | `/conversations/:id/messages` | Envoyer `{ content, clientId, replyToMessageId? }` |
| POST | `/conversations/:id/read` | Marquer comme lu `{ upToSeq? }` |
| DELETE | `/messages/:id` | Supprimer un de ses messages |
| GET | `/search?q&characterId` | Recherche plein texte |
| GET · PUT | `/drafts` · `/conversations/:id/draft` | Brouillons |
| GET · POST | `/suggestions` · `/suggestions/:id/send` · `/suggestions/:id/discard` | Suggestions IA |
| GET | `/mailbox?view&q&characterId&from&to&before` · `/mailbox/:id` · `/mailbox/counts` | Boîte mail |
| POST | `/mailbox/:id/actions` `{ action }` · `/mailbox/read-all` · DELETE `/mailbox/:id` | Lecture, archivage, corbeille, suppression |
| GET, POST, DELETE | `/notifications`, `/notifications/:id/read`, `/notifications/read-all`, `/notifications/:id` | Notifications |
| GET, POST, DELETE · PATCH, DELETE | `/characters/:id/memories` · `/memories/:id` | Mémoire (`X-Confirm: RESET_MEMORY` pour tout effacer) |
| GET, PATCH | `/settings` | Paramètres globaux |
| GET, POST | `/admin/status`, `/admin/tasks`, `/admin/tasks/:id/cancel`, `/admin/tasks/:id/run-now`, `/admin/logs`, `/admin/automation`, `/admin/ai/test`, `/admin/simulate/incoming`, `/admin/export`, `/admin/reset` (`X-Confirm: RESET_DEMO`) | Administration |

Événements Socket.IO (`event`) : `message.created`, `message.updated`, `messages.read`, `conversation.updated`, `character.updated`, `character.deleted`, `notification.upserted`, `notifications.read`, `notification.deleted`, `suggestion.upserted`, `suggestion.removed`, `mailbox.changed`, `memory.changed`, `settings.updated`, `me.updated`, `resync`, et `typing` (éphémère, non numéroté).

## Limitations connues

- **PostgreSQL non implémenté** : la persistance utilise SQLite (`node:sqlite`, encore marqué expérimental dans Node 22 ; l'avertissement est masqué par les scripts). Les requêtes sont en SQL standard paramétré et regroupées par module, mais passer à PostgreSQL demande d'écrire un adaptateur (transactions asynchrones, `SELECT … FOR UPDATE` à la place de la sérialisation SQLite) et de porter la migration et l'index plein texte.
- **Une seule instance serveur** : le planificateur et la diffusion temps réel supposent un processus unique (pas de verrou distribué ni d'adaptateur Socket.IO multi-nœuds).
- **Intégration Claude non vérifiée de bout en bout ici** : aucune clé API valide n'était disponible dans l'environnement de développement. Le code suit le SDK officiel, compile, et l'appel réel avec une clé invalide renvoie bien l'erreur d'authentification attendue ; la génération effective reste à valider avec votre clé (Administration → Tester le fournisseur).
- **Simulation locale volontairement simple** : sans clé, les messages proviennent de gabarits contextuels ; ils sont cohérents et non répétitifs sur la durée d'une démonstration, mais n'ont pas la richesse d'un modèle de langage.
- **Extraction de mémoire par règles** : elle reconnaît les formulations françaises courantes (« j'aime… », « retiens que… », « je vais… samedi »). Les formulations inhabituelles ne sont pas retenues ; ajoutez alors le souvenir à la main.
- **Utilisateur unique** : le modèle de données est rattaché à un utilisateur et toutes les routes vérifient l'appartenance, mais il n'existe pas d'inscription ni de gestion multi-comptes dans l'interface. Le mot de passe initial vient de `APP_PASSWORD` au premier démarrage ; ensuite, il se change dans Paramètres.
- **Notifications système** : les notifications sont internes à l'application (pas de notifications push du navigateur ni d'e-mails réels).
- **Pas d'images ni de pièces jointes** dans les messages.
