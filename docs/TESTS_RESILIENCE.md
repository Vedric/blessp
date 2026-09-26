# Campagne de fiabilité et de charge

Les validations locales et CI utilisent des données synthétiques, PostgreSQL isolé et des fournisseurs simulés. Elles peuvent avancer sans catalogue commercial ni compte marchand. Les tests ne démontrent pas une absence absolue de défauts ; leurs résultats sont attachés à une révision, un environnement et des scénarios précis.

## Matrice des parcours

Les chemins des tests serveur ci-dessous sont relatifs à `server/tests/`, ceux des tests navigateur à `client/tests/e2e/`. Cette matrice décrit des familles de parcours, pas une preuve de toutes les combinaisons possibles.

| Parcours | Preuves automatisées principales | Points restant externes |
| --- | --- | --- |
| Inscription FR/EN, confirmation, lien expiré/rejoué, connexion, déconnexion | `integration/auth.api.test.ts`, `integration/account-email.api.test.ts`, `deep-ui.spec.ts`, `account-email.spec.ts` | Délivrabilité réelle des emails |
| Mot de passe oublié/changé, MFA, récupération, suppression et export | `integration/security-commerce.api.test.ts`, `integration/customer-admin.api.test.ts`, `workflows.spec.ts`, `privacy.spec.ts` | Recette avec boîte email et appareils réels |
| Connexion Google/Apple, profil incomplet, popup fermée/bloquée | `integration/social-auth.api.test.ts`, `providers.spec.ts` | Comptes, audiences et callbacks des fournisseurs |
| Renouvellement entre trois onglets, déconnexion propagée, panne réseau temporaire, révocation à reprendre et connexion volontaire | `session-resilience.spec.ts` | Politiques particulières des navigateurs/appareils physiques |
| Recherche, filtres, tri, historique, comparaison, favoris, recommandations | `integration/products.api.test.ts`, `integration/customer-admin.api.test.ts`, `performance.spec.ts`, `recommendations.spec.ts`, `workflows.spec.ts` | Catalogue commercial et caractéristiques validées |
| Panier invité/membre, fusion, quantités, adresses et coupons | `integration/cart.api.test.ts`, `integration/security-commerce.api.test.ts`, `deep-ui.spec.ts`, `workflows.spec.ts` | Tarifs et politique commerciale |
| Commande invitée/membre, paiement, refus, retour fournisseur et preuve serveur | `integration/paypal.api.test.ts`, `integration/security-commerce.api.test.ts`, `providers.spec.ts`, `remediation.spec.ts` | Stripe/PayPal, 3DS, cartes et portefeuilles réellement disponibles |
| Réponse perdue après création de commande ou paiement PayPal, reprise puis annulation | `providers.spec.ts` | Réponses des fournisseurs simulées ; application et base réelles |
| Stock insuffisant, achats simultanés, rejeux, coupons concurrents, paiement contre expiration | `integration/resilience.api.test.ts`, `integration/inventory.api.test.ts` | Stock physique et éventuels composants d’ensembles |
| Webhooks signés répétés, remboursements désordonnés, fidélité et notification unique | `integration/security-commerce.api.test.ts`, `integration/resilience.api.test.ts` | Recette financière avec les comptes de test externes |
| Gestion des produits/stocks, comptage périmé, remboursement, préparation et livraison | `inventory.spec.ts`, `launch.spec.ts`, `workflows.spec.ts`, `integration/orders.api.test.ts` | Procédure réelle de préparation, transport et retours |
| Support, avis/modération, newsletter, préférences email | `integration/contact.api.test.ts`, `integration/customer-admin.api.test.ts`, `launch.spec.ts`, `workflows.spec.ts` | Réception et traitement réels des demandes |
| File email, bail interrompu, reprise après panne et expiration par lots | `integration/resilience.api.test.ts`, `integration/customer-admin.api.test.ts` | Reprise des processus et alertes dans l’hébergement retenu |
| Pages publiques, compte et administration ; images, focus, débordements et accessibilité | `interface.spec.ts`, `deep-ui.spec.ts`, `experience.spec.ts`, `launch-http.spec.ts` | Lecteur d’écran, zoom et téléphones physiques ; axe ne couvre pas toute l’accessibilité |
| Quotas, faux JWT et adresses transmises non fiables | `unit/rate-limit.test.ts`, tests de sécurité et contrats HTTP | Répartition des quotas entre réplicas et réseau du déploiement |

## Répétitions et diagnostic

Configurer `TEST_DATABASE_URL` vers une base PostgreSQL isolée, dont le nom se termine par `_test`, `_audit` ou `_ci`. `scripts/test-env.cjs` neutralise les identifiants fournisseurs et les fichiers dotenv avant de lancer le processus. Ne pas utiliser les données commerciales.

```sh
node scripts/test-env.cjs npm --prefix server run test:all -- --maxWorkers=2 --randomize --seed=260926 --showSeed
node scripts/test-env.cjs npm --prefix server run test:all -- --maxWorkers=2 --randomize --seed=260927 --showSeed
node scripts/test-env.cjs npm --prefix server run test:coverage -- --maxWorkers=2 --randomize --seed=260928 --showSeed
```

Les graines rendent l’ordre des tests reproductible. Conserver le premier échec, ses logs et sa graine avant de corriger ; une répétition verte n’efface pas un échec précédent. La CI principale garde `failOnFlakyTests` pour les navigateurs et ne rend pas un scénario intermittent vert grâce à une relance.

Les scénarios navigateur sont exécutés contre les assets optimisés. Préparer `npm run build:test` pour la matrice normale. Pour les contrats fournisseurs, utiliser `node scripts/build-e2e.cjs --providers`, puis `E2E_SIMULATE_PROVIDERS=1` avec `playwright.providers.config.ts`. Attendre l’arrêt du serveur avant de reconstruire les assets. Les instructions générales figurent dans le [README](../README.md).

Le workflow [Resilience](../.github/workflows/resilience.yml) exécute les trois graines puis la charge sur les PR touchant le serveur ou le script, chaque mardi, et sur déclenchement manuel. Les rapports sont conservés 14 jours. Les campagnes navigateur et leurs captures restent dans la CI principale.

## Charge locale reproductible

Après installation et compilation du serveur :

```sh
npm --prefix server run db:generate
npm --prefix server run build
node scripts/test-env.cjs npm run test:load -- artifacts/load-commerce.json
```

Le script refuse une base non locale ou sans suffixe de test. Il crée un schéma temporaire unique, applique les migrations et lance sa propre API sur un port local libre. Il ne réutilise aucun catalogue existant et supprime son schéma à la fin. Éviter de lancer une autre charge pendant la mesure ; celle-ci partage sinon les ressources matérielles.

- 1000 produits synthétiques, chacun avec une variante.
- Quatre paliers de 15 secondes, avec 1, 8, 32 et 64 clients simultanés en boucle fermée. Chaque client attend sa réponse avant d’envoyer la suivante.
- Lecture de listes, filtres, fiches, variantes et configuration commerciale.
- 192 commandes : création, rejeu de la même clé, puis annulation. Vérification de l’unicité et du stock total restauré.
- Pic de 64 acheteurs pour 7 unités : exactement 7 réservations, 57 refus métier et aucun stock négatif.
- Vérification de disponibilité après charge et fermeture du serveur.

Le rapport conserve la révision, l’état modifié ou propre du dépôt, Node, les ressources logiques, le nombre de requêtes, les statuts, les latences p50/p95/p99/max, le débit, la mémoire du processus et les invariants en base. Le budget de régression est p95 inférieur à 2000 ms par phase ; ce seuil n’est pas un engagement commercial.

La mesure concerne l’API locale avec un pool de 12 connexions, sans Redis ni proxy. Les quotas sont désactivés dans cette charge synthétique et vérifiés séparément avec le vrai middleware dans `rate-limit.test.ts`. Ni le réseau public, ni le rendu navigateur, ni les paiements externes ne sont mesurés. Un pic court et une boucle fermée ne remplacent pas un test d’endurance ou une mesure de saturation sur l’infrastructure de préproduction.

## Corrections issues de la campagne du 26 septembre 2026

- Un nom de produit uniquement composé d’espaces était accepté. La normalisation précède maintenant la validation de présence, en création et en modification.
- Prix, ordre d’affichage et montants de commande hors capacité des entiers PostgreSQL pouvaient provoquer une erreur 500. Ils sont refusés avec une erreur de validation, sans commande, perte de stock ou consommation de coupon. La livraison est incluse dans la vérification du total.
- Les 25 plus anciennes réservations dont le paiement restait impossible à réconcilier monopolisaient les passages de maintenance. La maintenance parcourt maintenant les lots avec un curseur stable et une limite temporelle fixée au début du cycle, puis revient aux échecs. La restitution du stock reste subordonnée à l’état du paiement. Après redémarrage, un nouveau cycle repart du début ; les verrous et transitions idempotentes protègent contre les traitements concurrents.
- Une requête de déconnexion interrompue laissait le cookie utilisable et pouvait reconnecter automatiquement le navigateur au rechargement. Une intention locale de déconnexion bloque maintenant le renouvellement automatique et masque le contenu privé des autres onglets. La révocation est reprise au retour du réseau, avant une nouvelle connexion volontaire. Ce marqueur ne contient aucun jeton ; la révocation serveur n'est effective qu'après sa réponse. Le navigateur utilise les stockages disponibles et garde un secours en mémoire si leur accès échoue.

Les journaux locaux, y compris les échecs reproduits avant correction, sont dans `artifacts/resilience-20260926/`. Les derniers chiffres et les preuves de fusion sont à consulter dans les exécutions CI de la PR correspondante. Les critères commerciaux et de recette externe restent dans la [checklist de lancement](LAUNCH_CHECKLIST.md).
