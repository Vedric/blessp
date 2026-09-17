# Déploiement

Le guide décrit une procédure ; il ne certifie pas qu’une production existante est correctement configurée. Voir [les prérequis de validation](PRODUCTION_READINESS.md).

## Configuration

Node 22, PostgreSQL 16, Redis facultatif, reverse proxy TLS. Les ports PostgreSQL/Redis de la composition de production restent internes ; l’application est publiée sur `127.0.0.1:3000` pour le proxy local.

| Valeur | Usage |
|---|---|
| `DATABASE_URL` | PostgreSQL ; compte applicatif et connexion TLS selon hébergement |
| `JWT_PRIVATE_KEY_BASE64`, `JWT_PUBLIC_KEY_BASE64` | Paire RSA propre à l’environnement |
| `MFA_ENCRYPTION_KEY` | 32 octets aléatoires encodés en base64, persistants et indépendants des clés JWT |
| `CLIENT_URL` | URL HTTPS publique, utilisée pour les liens email, URL canoniques et sitemaps |
| `CORS_ALLOWED_ORIGINS` | Liste séparée par virgules des origines du storefront |
| `TRUST_PROXY` | IP/CIDR explicites du proxy ; vide signifie aucun proxy de confiance |
| `METRICS_TOKEN` | Secret d’au moins 32 caractères pour `Authorization: Bearer` sur `/metrics` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Secrets Stripe du même environnement ; endpoint `/api/v1/payments/webhook` |
| `EMAIL_FROM`, `RESEND_API_KEY` ou `POSTMARK_API_KEY` | Expéditeur vérifié et fournisseur transactionnel |
| `SUPPORT_EMAIL` | Boîte de réception des notifications contact, obligatoire en production |
| `SHIPPING_RATES_JSON` | Pays servis et tarifs en centimes CAD, obligatoires en production ; voir le [guide](runbooks/012-launch-configuration.md) |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_ENVIRONMENT` | PayPal distinct : les trois identifiants ensemble ; environnement `sandbox` en recette, `live` en production ; webhook `/api/v1/payments/paypal/webhook` |
| `REDIS_URL` | Cache et quotas partagés ; absence/panne ne bloque pas le catalogue |
| `GOOGLE_CLIENT_ID`, `APPLE_CLIENT_ID` | Audiences OAuth correspondant aux identifiants publics du client |
| `OTEL_ENABLED`, `OTEL_EXPORTER_OTLP_ENDPOINT` | Traces facultatives, activées seulement avec configuration explicite |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Seulement pour la création explicite du premier administrateur |

Ne jamais journaliser ou intégrer les clés privées au bundle. Les fichiers `.env` doivent être protégés et non suivis dans Git. La production refuse de démarrer sans clés MFA, métriques, URL publique, configuration Stripe, fournisseur email, boîte support et tarifs de livraison explicites.

`VITE_STRIPE_PUBLISHABLE_KEY`, `VITE_GOOGLE_CLIENT_ID`, `VITE_APPLE_CLIENT_ID` sont publics et fournis **à la compilation**. Un changement nécessite une nouvelle image. `VCS_REF` donne la révision exposée par la readiness.

## Pages publiques et référencement

Servir les pages via Express, comme dans l’image Docker : le serveur insère les métadonnées des produits actifs dans le HTML initial et génère `/robots.txt`, `/sitemap.xml` et ses sous-sitemaps. Leur domaine provient de `CLIENT_URL`, jamais de l’en-tête Host. Les pages de compte et de transaction portent `noindex` ; les routes et produits absents retournent 404. Conserver ces statuts et en-têtes au niveau du reverse proxy.

Le contenu React reste rendu côté navigateur : il ne s’agit pas d’un rendu serveur complet. Un hébergement du seul répertoire `client/dist` ou `vite preview` ne fournit pas ces réponses dynamiques. Éviter de remplacer les erreurs 404 par une réécriture globale vers `index.html` ou de conserver une ancienne copie HTML dans le CDN. Le HTML et les sitemaps exigent une revalidation (`Cache-Control: no-cache`) ; seuls les assets versionnés sont immuables.

## Image et migration

Construire avec Docker Buildx en fournissant les arguments publics et `VCS_REF`. Scanner l’image puis la publier une seule fois. Déployer sa référence immuable `registre/image@sha256:...`.

```bash
# Le fichier protégé contient DATABASE_URL pour la base cible.
docker run --rm --env-file /chemin/protege/migration.env IMAGE@sha256:DIGEST node_modules/prisma/build/index.js migrate deploy
# Premier administrateur uniquement : aucun seed implicite au démarrage.
docker run --rm --env-file /chemin/protege/production.env IMAGE@sha256:DIGEST prisma/seed.js
```

L’entrypoint de l’image est `node`. Il n’y a pas de npm/npx/tsx dans l’image d’exécution. Le seed compilé conserve les identifiants d’un administrateur existant ; en production il ne charge pas les produits de démonstration.

La migration du 16 septembre change l’authentification et les invariants des commandes : [procédure obligatoire pour une base existante](runbooks/010-audit-remediation-migration.md). Éviter une coexistence d’anciennes et nouvelles instances pendant cette migration. Ne pas utiliser `db push`, `migrate reset` ou une suppression de volume en production.

## Release GitHub

La release est déclenchée manuellement (`workflow_dispatch`), uniquement depuis `main`. Une fusion déclenche la CI et ne déploie pas automatiquement.

Le workflow exige une revue `config/launch.json` complétée et le succès de `node scripts/check-launch.cjs --static`. Ce contrôle bloque actuellement les mentions incomplètes et la revue absente. Il nécessite aussi un environnement `production`. Configurer ses secrets `PRODUCTION_DATABASE_URL`, `DEPLOY_WEBHOOK_URL`, `DEPLOY_WEBHOOK_TOKEN`, `VITE_STRIPE_PUBLISHABLE_KEY`, et, si utilisés, les identifiants publics OAuth. La variable `PRODUCTION_URL` est HTTPS. Les identifiants serveur restent injectés par la plateforme, pas par les arguments de build.

La version de `server/package.json` ou `version_override` doit être une nouvelle version semver. Le workflow refuse une version déjà taguée. Il exécute : CI → précontrôles → build unique → scan → push/digest → attestation → migrations → webhook avec `{image, sha, ref}` → vérification de la readiness et de la révision → release GitHub.

Le destinataire du webhook doit appliquer **le digest reçu**, gérer sa clé d’idempotence et retourner une erreur HTTP si la demande est refusée. Les secrets d’environnement sont accessibles aux jobs de précontrôle, construction et déploiement. Tester cette intégration en staging avant toute release réelle.

## Exploitation

- `/health/live` : processus ; `/health/ready` : base PostgreSQL disponible et révision applicative.
- `/metrics` : accès Bearer ; endpoint masqué sans token valide. Surveiller erreurs HTTP, latences et `email_outbox_pending` / ancienneté du plus vieux mail.
- La maintenance périodique expire les réservations, traite l’outbox et anonymise les comptes supprimés après 30 jours. Une panne ne doit pas rester silencieuse : alertes à configurer côté plateforme.
- Redis indisponible : cache contourné, quota local conservé. Les quotas partagés reprennent à la reconnexion. L’outbox financière/authentification est dans PostgreSQL.
- Arrêt SIGTERM : arrêter les nouvelles requêtes, attendre les travaux en cours puis fermer les clients. La plateforme doit laisser le délai de grâce configuré au processus.
- Sauvegarder PostgreSQL et la clé MFA ; vérifier une restauration sur une base isolée avant de considérer le dispositif opérationnel.

En cas d’échec de migration, conserver la base et examiner `_prisma_migrations`. Ne pas réexécuter une ancienne image sur le nouveau schéma sans vérification de compatibilité. Restaurer une sauvegarde entraîne une perte des écritures postérieures : décider du rollback avec le responsable de l’exploitation.
