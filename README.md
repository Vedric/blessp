# BLE$$ P

Boutique React / TypeScript et API Express / PostgreSQL. Catalogue, panier invité ou connecté, commandes, paiement Stripe, profils, adresses, MFA, fidélité et administration.

**État du projet :** correctifs et vérifications locales documentés dans [le bilan du 16 septembre 2026](docs/audits/2026-09-16/CORRECTIFS.md), [sa deuxième passe](docs/audits/2026-09-16/SUITE.md), [la recette Chromium](docs/audits/2026-09-16/INTERFACE.md) et [son approfondissement multi-navigateurs](docs/audits/2026-09-16/APPROFONDISSEMENT.md). Les prestataires et le déploiement réel doivent encore être validés en staging. Le [rapport initial](docs/audits/2026-09-16/AUDIT.md) décrit l’état avant correction.

Optimisations de réactivité et mesures sur 10 000 produits : [fluidité et croissance du catalogue](docs/audits/2026-09-16/FLUIDITE.md).

Refonte éditoriale, galerie avec zoom, continuité des parcours et matrice des vérifications : [interface et expérience](docs/audits/2026-09-16/EXPERIENCE.md).

Gestion du stock par variante, ajustements tracés et conflits de concurrence : [recette des stocks](docs/audits/2026-09-16/STOCKS.md). Livraison configurable, boîte support, confirmations FR/EN et préparation de la production : [passe de lancement](docs/audits/2026-09-16/LANCEMENT.md).

Le Canada est confirmé comme pays de l’entreprise ; les services externes et les règles commerciales restent à finaliser. La [checklist de lancement](docs/LAUNCH_CHECKLIST.md) et `npm run check:launch -- --static` explicitent les blocages actuels. Le contrôle doit échouer tant que la revue et les mentions publiques sont incomplètes.

Pour partir sans domaine ni comptes fournisseurs : [guide de lancement pas à pas](docs/GUIDE_LANCEMENT.md).

Cartes et portefeuilles Stripe, PayPal distinct pour le Canada, connexion email/Google/Apple et recette des fournisseurs : [guide de configuration et tests](docs/runbooks/013-paypal-and-provider-testing.md).

## Démarrer en local

Prérequis : Node.js 22, npm et Docker Compose avec PostgreSQL 16. Depuis la racine :

```bash
bash scripts/setup-local.sh
# Facultatif, uniquement pour créer les données de démonstration :
bash scripts/setup-local.sh --seed
npm run dev
```

Le script préserve les valeurs existantes de configuration, génère les valeurs manquantes et applique les migrations. Il ne supprime pas les volumes et ne réinitialise pas la base. Consulter les fichiers `.env.example` et `server/.env.example`. Ne pas utiliser `prisma db push` pour une base gérée par les migrations.

Installation manuelle :

```bash
npm ci
npm --prefix server ci
npm --prefix client ci
node scripts/configure-local.cjs
npm --prefix server run db:generate
# Avec PostgreSQL local démarré et DATABASE_URL configurée dans server/.env :
npm run db:migrate
npm run dev
```

L’API écoute sur 3000 et Vite sur 5173. En développement sans prestataire mail, les messages restent dans `email_outbox` pour consultation locale explicite ; aucun lien de vérification n’est journalisé. Une nouvelle inscription doit être confirmée avant connexion. Google/Apple et Stripe nécessitent leurs propres identifiants pour tester les services externes.

## Architecture

- `client/src` : React 19, Vite, Tailwind, i18next ; jeton d’accès en mémoire et renouvellement par cookie HttpOnly.
- `server/src/features` : domaines métier, routes, validation Zod, services et repositories Prisma.
- `server/src/core` : configuration, sécurité, transactions, email durable, cache et observabilité.
- `server/prisma` : schéma et migrations versionnées ; seed explicite et idempotent pour l’administrateur.
- `scripts` : configuration locale et processus de test isolés.
- `docs/openapi.yaml` : contrat HTTP ; préfixe `/api/v1` sauf santé et métriques.

Les commandes réservent le stock transactionnellement pendant 30 minutes. Le serveur calcule les prix, les coupons et la livraison. La confirmation financière vient du paiement vérifié ; les webhooks signés dédupliquent les effets sur commande, fidélité, panier et email. Le statut logistique reste distinct du statut financier.

Redis est facultatif pour le cache. Les quotas locaux restent actifs en cas de panne ; Redis fournit les quotas partagés quand il est disponible. Les emails transactionnels sont enregistrés dans PostgreSQL, indépendamment de Redis.

## Vérifications reproductibles

Utiliser une base **jetable** dont le nom se termine par `_test`, `_audit` ou `_ci`. Les tests utilisent des schémas séparés par worker et un schéma `e2e`. Ne jamais indiquer une base contenant des données à conserver.

```bash
export TEST_DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:5432/blessp_test'
npm run lint
npm run build:test
node scripts/test-env.cjs node scripts/verify-legacy-migration.cjs
node scripts/test-env.cjs npm --prefix server run test:coverage -- --maxWorkers=2
(cd client && npx --no-install playwright install --with-deps chromium)
node scripts/test-env.cjs npm --prefix client run test:e2e
node scripts/test-env.cjs node scripts/lighthouse.mjs
npm audit
npm --prefix server audit
npm --prefix client audit
```

Pour exécuter les mêmes parcours sur Chromium, Firefox et WebKit :

```bash
(cd client && npx --no-install playwright install --with-deps chromium firefox webkit)
E2E_CROSS_BROWSER=1 node scripts/test-env.cjs npm --prefix client run test:e2e
```

`deep-ui.spec.ts` ajoute les inscriptions complètes par formulaire, la confirmation via l’outbox locale, la fusion du panier, les erreurs et une matrice responsive de 320 à 1920 px. Le tactile est émulé ; ces tests ne remplacent pas une recette sur appareils physiques. Firefox ne prend pas en charge l’option Playwright `isMobile` : il utilise les mêmes dimensions avec des événements tactiles.

Ne pas lancer simultanément Playwright et Lighthouse : leurs serveurs isolés utilisent le port 3107. `npm run build:test` produit des assets optimisés avec les intégrations externes désactivées, même si `client/.env` contient des clés. `scripts/test-env.cjs` fournit des clés synthétiques et neutralise les prestataires externes. Les tests vérifient les événements Stripe localement ; ils ne réalisent aucun paiement bancaire.

Couverture : l’ensemble de `server/src` est inclus, sauf démarrage du processus et fichiers d’export. Seuils CI : 80 % statements/lignes, 70 % branches, 75 % fonctions. Les résultats datés sont dans le bilan, pas assimilés à une garantie pour toute future modification.

## Exploiter et livrer

Lire [le guide de déploiement](docs/deployment.md), [la migration des correctifs](docs/runbooks/010-audit-remediation-migration.md) et [les validations encore nécessaires](docs/PRODUCTION_READINESS.md).

L’image contient la CLI Prisma et le seed compilé. Elle s’exécute sans root, npm, npx, Jest ou tsx. Avec l’image déjà construite :

```bash
docker run --rm --env-file /chemin/protege/migration.env IMAGE@sha256:DIGEST node_modules/prisma/build/index.js migrate deploy
# Création explicite du premier administrateur, avec ADMIN_EMAIL/ADMIN_PASSWORD :
docker run --rm --env-file /chemin/protege/production.env IMAGE@sha256:DIGEST prisma/seed.js
```

Les valeurs `VITE_*` sont publiques et intégrées à la compilation. Les clés serveur restent dans le gestionnaire de secrets. `MFA_ENCRYPTION_KEY` doit être persistante et sauvegardée : la remplacer sans rechiffrement rend les facteurs existants illisibles.

La CI exécute lint, compilation, tests avec PostgreSQL, parcours sur Chromium/Firefox/WebKit, audits npm et analyse Docker. La release construit une image, scanne puis publie ce même artefact, migre avec son digest et vérifie la révision servie avant publication de la release GitHub. Ces workflows ont été contrôlés localement ; leur exécution dans votre environnement GitHub reste à vérifier.

La [gestion des stocks](docs/runbooks/011-inventory.md) est accessible depuis l’administration : suivi par taille/couleur, filtres, ajustements tracés et protection contre les écrasements concurrents.
