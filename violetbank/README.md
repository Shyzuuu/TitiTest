# VBanque — simulation bancaire fictive (web + Android)

Application créée par **Titi**, développée et améliorée avec Claude.

> **SIMULATION BANCAIRE — ARGENT ET CRÉDITS FICTIFS.** Application de démonstration : aucun compte réel, aucun fonds détenu, aucun paiement émis, aucune banque n’examine les demandes de prêt. Sans affiliation avec un établissement bancaire ou une fintech existante. Le nom est personnalisable dans les paramètres.

Application React + TypeScript entièrement locale (stockage navigateur) : comptes, cartes virtuelles « DEMO », historique, virements et contacts fictifs, coffres, budgets, statistiques, notifications et **module complet de prêts simulés** (simulateur, demande en 6 étapes, moteur de décision local, activation idempotente, échéancier, remboursements échéance / partiel / anticipé / total, révisions d’hypothèses, reports, contrepassations, calendrier, comparateur, relevé filigrané).

## Application Android (APK)

Projet Android natif Capacitor dans `android/` (paquet `com.violetbank.demo`, nom « VBanque », icône et écran de démarrage au logo V, thème violet, bouton Retour géré, données stockées localement sur l’appareil, aucune dépendance Internet pour les fonctions principales).

**Télécharger l’APK** : le workflow GitHub Actions `.github/workflows/violetbank-android.yml` compile, signe, installe sur un émulateur Android 14 (lancement, bouton Retour, fermeture et réouverture), puis publie `VioletBank.apk` dans la release `violetbank-latest` du dépôt.

**Compiler soi-même** (JDK 21 + Android SDK 35, ou Android Studio) :

```bash
cd violetbank
npm ci
npm run apk        # → android/app/build/outputs/apk/release/app-release.apk
```

Dans Android Studio : `npm run build:android`, puis ouvrir le dossier `violetbank/android` et lancer *Build › Build APK(s)*.

L’APK est signé avec une **clé de démonstration** versionnée (`android/app/violetbank-demo.keystore`) pour permettre l’installation et les mises à jour : elle ne doit jamais servir à une publication réelle.

Exports (CSV, relevé de prêt, sauvegarde JSON) : enregistrés dans `Documents/VBanque/` sur le téléphone. La sauvegarde se restaure depuis *Profil › Données de démonstration*.

## Démarrage (web)

```bash
cd violetbank
npm install
npm run dev          # http://127.0.0.1:5180
```

Production : `npm run build` puis `npm run preview` (http://127.0.0.1:4780). Le dossier `dist/` est un site statique (fallback SPA fourni pour Netlify via `public/_redirects`).

Au premier lancement, un jeu de données d’exemple est généré (3 mois d’opérations, cartes, coffres, budgets, un prêt actif avec deux échéances payées, un dossier refusé). Page **Réinitialisation** : tout effacer ou recharger l’exemple.

## Tests

```bash
npm test                 # Vitest : moteur financier et règles métier (57 tests)
npm run typecheck
PW_CHROMIUM_PATH=/chemin/vers/chrome npm run test:e2e   # Playwright : scénarios A à G + mobile
```

`PW_CHROMIUM_PATH` est facultatif (sinon `npx playwright install chromium`).

| Suite | Couverture |
|---|---|
| `test/loanMath.test.ts` | formule de mensualité, taux nul, arrondis, dernière échéance, capital constant, mensualité imposée, dates de fin de mois |
| `test/loans.test.ts` | décision (limites, motif, mode manuel, avertissement de solde), activation unique, rechargement, paiement en double, ordre des échéances, solde insuffisant, partiel, total, anticipé (durée / mensualité, frais), contrepassation, révision, report, annulation, rappels, invariant capital |
| `test/ledger.test.ts` | dépôts, montants invalides, virements, cartes verrouillées, plafonds et cartes jetables, coffres, budgets, jeu d’exemple, données corrompues |
| `e2e/scenarios.spec.ts` | A (dépôt + actualisation), B (carte), C–F (prêt de bout en bout avec double-clics), G (erreurs) |
| `e2e/mobile.spec.ts` | 25 pages sans débordement horizontal ni erreur JS, navigation mobile |

## Architecture

```
src/
  domain/            Moteur métier pur (aucune dépendance React)
    money.ts         Centimes entiers, analyse des saisies, arrondi commercial, formats
    dates.ts         Dates calendaires sans fuseau, addMonths borné en fin de mois
    loanMath.ts      Mensualité P×r/(1−(1+r)^−n), tableau d'amortissement, devis
    schema.ts        Modèle de données (Zod) = types + validation au chargement
    core.ts          Contexte d'horloge, résultats d'opération, grand livre, soldes dérivés
    accounts.ts      Dépôts, retraits, dépenses, virements, contacts, contrepassations
    cards.ts / vaults.ts / misc.ts   Cartes, coffres, budgets, contacts, scénarios de prêt
    loans.ts         Demandes, décision, activation, paiements, révisions, reports, annulation
    selectors.ts     Valeurs dérivées (tableau de bord, portefeuille de prêts, statistiques)
    persistence.ts   Validation de schéma + intégrité référentielle et comptable
    seed.ts          État initial et jeu d'exemple rejoué via les vraies opérations
  store/             Zustand : application synchrone des opérations, persistance, multi-onglets
  components/        Kit UI, mise en page, carte virtuelle, modales d'opérations, prêts
  pages/             22 rubriques (+ sous-pages de prêts), chargées à la demande
  lib/               Hooks, libellés, export CSV, relevé de prêt, paramètres de simulation
```

### Règles de cohérence

- **Montants** : entiers en centimes ; aucune addition de flottants.
- **Soldes** : jamais stockés, toujours recalculés depuis le grand livre → historique et soldes concordent par construction. Les coffres et virements déplacent des fonds sans en créer.
- **Prêts** : capital initial = capital remboursé + capital restant dû (vérifié à chaque paiement et au chargement). Les intérêts ne sont jamais ajoutés au capital. Le total remboursé est la somme de l’échéancier réellement généré (1 000 € / 12 mois / 6 % → 11 × 86,07 € + 86,03 € = 1 032,80 €).
- **Idempotence** : opérations synchrones dans le store, boutons verrouillés pendant le traitement, contrôles domaine (dossier déjà activé, échéance déjà payée) → ni double crédit ni double paiement, y compris après actualisation.
- **Corrections** : rien n’est supprimé ; une contrepassation liée est créée. Pour un prêt, seule la dernière opération est contrepassable (pile LIFO) afin de restaurer un échéancier exact.
- **Horloge de simulation** réglable dans les paramètres pour tester échéances à venir, échues et « en retard dans la simulation ».

## Limites connues

- Remboursement anticipé : les intérêts de la période en cours sont recalculés sur le capital réduit (pas de prorata au jour).
- Report d’échéance : décalage d’un mois sans intérêt supplémentaire (simplification affichée à l’utilisateur).
- La devise d’affichage ne change que le symbole (aucune conversion).
- Stockage `localStorage` uniquement, par navigateur ; entre onglets, la dernière écriture l’emporte (les onglets se resynchronisent automatiquement).
- Le relevé de prêt est un fichier HTML imprimable (« Imprimer » → PDF via le navigateur), pas un PDF natif.
- Le chunk Recharts (~395 Ko, ~109 Ko gzip) n’est chargé que par les pages qui affichent des graphiques.
