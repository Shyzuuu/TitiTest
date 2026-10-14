# Rapport de validation

Physique v2 (rampes, toits, jetpack, hoverboard). Environnement : Linux, Node.js 22.22.0, Chromium 141 (Playwright 1.56.1, headless), 14/10/2026.
Commandes : `npm test`, `npm run test:perf`, `npm run test:e2e`, plus un clone propre du dépôt (voir fin).

## Résultats des suites

| Suite | Résultat |
|---|---|
| `npm test` (unitaires, intégration, régression, rejeu long) | **80 / 80 réussis**, ≈ 1,7 s |
| `npm run test:e2e` (vraie interface dans Chromium) | **12 / 12 étapes réussies** (dont boutique et hoverboard par double appui), aucune erreur JavaScript |
| `npm run test:perf` (30 min simulées) | **Reproduction exacte** |

### Scénarios du cahier des charges (`tests/integration/scenarios.test.mjs`)

| Scénario | Résultat |
|---|---|
| A — run normale (voies, sauts, glissades, pièces, fin, score, distance) | réussi |
| B — run ralentie 1,00× → 0,50× → 0,10× → 1,00× (120 / 60 / 12 / 120 pas en 2 s réelles, chronologie monotone, 8 s réelles pour 5,2 s simulées) | réussi |
| C — enregistrer, sauvegarder, nouvelle instance sur le même stockage, charger, rejouer, comparer | réussi (rejeu exact, original intact) |
| D — ressources illimitées, achats, persistance après redémarrage | réussi |
| E — fichier invalide, double REC, rejeu pendant REC, panne de sauvegarde, reprise | réussi |

### Mesures de performance (`npm run test:perf`, 30 minutes simulées)

| Mesure | Valeur |
|---|---|
| Pas simulés | 108 000 |
| Simulation + enregistrement | 223 ms (2,06 µs/pas) |
| Rejeu + comparaison | 182 ms (1,68 µs/pas) |
| Événements | 9 260 (dont 900 points de contrôle) |
| Taille stockée | 950 Ko (UTF-16) ≈ 20 % du budget `localStorage` |
| Écritures de stockage pendant la run | 67 (morceaux incrémentaux + sauvegarde finale) |
| Croissance du tas JS | +6,3 Mo |
| Validation / comparaison de 300 000 événements | ≈ 150 ms / ≈ 160 ms |

Limites observées : le budget `localStorage` limite la bibliothèque à environ 10 runs de 30 minutes ; les FPS
de rendu n'ont pas été mesurés sur un téléphone Android physique (le diagnostic intégré les mesure en direct).

## Conditions de validation finale (chapitre 17)

| Condition | Résultat | Preuve |
|---|---|---|
| Le prototype est jouable | réussi | E2E : clavier + glissement dans Chromium ; captures desktop et mobile |
| Les trois voies fonctionnent | réussi | `Voies : trois voies…`, scénario A |
| Les sauts fonctionnent | réussi | `Saut : hauteur maximale…` |
| Les glissades fonctionnent | réussi | `Glissade : durée fixe…` |
| Les obstacles fonctionnent | réussi | `Collisions…`, `Générateur : jamais trois voies bloquées…` |
| Les collisions fonctionnent | réussi | `Collisions…`, `Collision latérale…` |
| Le score fonctionne | réussi | `Pièces, clés, bonus, score et distance`, scénario A |
| La distance fonctionne | réussi | idem |
| Mode pièces illimitées (prototype) | réussi | `Mode illimité…`, scénario D, E2E |
| Mode clés illimitées (prototype) | réussi | idem |
| Le curseur de vitesse fonctionne | réussi | E2E (préréglages) ; curseur câblé sur le même `setSpeed` (non cliqué en E2E) |
| Le ralenti à 0,10× fonctionne | réussi | scénario B (12 pas en 2 s), E2E (pas/s mesurés) |
| Le retour à 1,00× fonctionne | réussi | scénario B, E2E |
| La pause fonctionne | réussi | `Pause : simulation gelée…`, E2E (Échap) |
| L'enregistrement fonctionne | réussi | scénarios B, C ; E2E |
| La sauvegarde fonctionne | réussi | tests `SaveManager`, scénario E (panne puis réessai) |
| Le chargement fonctionne | réussi | scénario C, E2E après rechargement de page |
| Le rejeu fonctionne | réussi | scénario C, rejeu 30 min, E2E |
| Les événements conservent leur ordre | réussi | `Ordre des événements…`, validateur |
| Les divergences sont détectées | réussi | `Rejeu : divergence détectée…`, tests du comparateur |
| Plusieurs runs peuvent être stockées | réussi | tests `RunRepository` (tri, duplication, import) |
| Les fichiers invalides sont gérés | réussi | `RunValidator : détecte…`, import refusé (scénario E) |
| Les tests automatisés passent | réussi | 80/80 + 12/12 |
| Le README est complet | réussi | 16 sections + démarrage rapide |
| Le lancement est documenté | réussi | README §4–5, vérifié sur un clone propre |

## Non testé

- Jeu sur un appareil Android physique (seule l'émulation mobile de Chromium a été utilisée).
- Glisser le curseur de vitesse à la souris en E2E (les préréglages et l'API sont testés).
- Installation PWA / mode hors connexion (service worker non exercé en test automatique).
