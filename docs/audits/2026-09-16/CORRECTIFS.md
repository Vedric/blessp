# Correctifs et validation de BLE$$ P

**16 septembre 2026 — modifications locales après l’audit de la révision `b20ad8f`.**

**Suite de la validation :** [la deuxième passe](SUITE.md) ajoute les métadonnées HTML, sitemaps, réponses 404 et des correctifs d’accessibilité/chargement. Elle contient les chiffres les plus récents ; les résultats ci-dessous décrivent la première passe et restent conservés.

Les défauts critiques d’authentification, de réservation, de paiement et de livraison identifiés dans [l’audit initial](AUDIT.md) ont reçu des corrections et des tests de régression. Le travail comprend le serveur, le client, la migration PostgreSQL, les dépendances, Docker, les workflows et les procédures d’exploitation. Les modifications sont présentes dans le workspace ; aucun commit, push, déploiement, débit bancaire ou envoi transactionnel réel n’a été effectué.

**La réussite des contrôles locaux ne clôt pas la recette de production.** Les vrais prestataires, la migration d’une base métier, la restauration de sauvegarde et les décisions commerciales restent à valider. Ces limites sont détaillées ci-dessous et dans [PRODUCTION_READINESS.md](../../PRODUCTION_READINESS.md).

## Résultats exécutés

| Contrôle | Résultat après correction |
|---|---|
| ESLint serveur/client | Réussi, sans avertissement |
| TypeScript serveur/client et build Vite | Réussis |
| Jest, unitaires et intégration avec PostgreSQL, 2 workers | **398 tests réussis, 28 suites** |
| Couverture de l’ensemble des sources instrumentables | **85,98 % statements ; 71,7 % branches ; 81,87 % fonctions ; 87,34 % lignes** |
| Seuils de couverture CI | 80 / 70 / 75 / 80 %, tous atteints |
| Playwright Chromium | **49 tests réussis**, aucun ignoré |
| Axe WCAG 2/2.1 A/AA | Aucune violation sur boutique, connexion, confidentialité et recherche de commande |
| npm audit, 3 lockfiles, dépendances de développement comprises | **0 vulnérabilité signalée** dans chaque arbre |
| Trivy, image corrigée, OS et paquets Node, toutes sévérités | **0 vulnérabilité signalée** au moment du scan |
| Docker | Build réussi ; utilisateur non root ; Prisma migration CLI et seed compilé fonctionnels |
| Runtime de l’image | Readiness 200 avec révision attendue, métriques 404 sans token/200 avec token, index non caché, assets immuables et gzip |
| Migration sur ancienne base peuplée synthétique | Réussie ; trois lignes de panier fusionnées en une quantité 9, statut financier repris, pending historique laissé sans expiration inventée |
| Redis configuré mais indisponible | Catalogue HTTP 200 en **76 ms** dans la reproduction ; 11e essai d’authentification rejeté 429 malgré rotation de X-Forwarded-For |
| Semgrep | 74 règles, 210 fichiers source, aucune alerte après correction du tag AES-GCM ; parsing partiel d’un libellé JSX du panneau de développement |
| Gitleaks, état courant | 341 fichiers ; un vecteur public RFC de test, aucun secret réel confirmé |
| OpenAPI | Document 3.1 validé structurellement |
| Workflows/scripts | Actionlint et ShellCheck réussis ; absence d’erreurs de whitespace Git |

Ces chiffres ne se comparent pas directement au nombre de tests initial : des tests unitaires validant l’ancien comportement dangereux ont été remplacés/complétés par des tests d’intégration réels. La couverture inclut désormais les sources auparavant absentes des racines Jest. Les fournisseurs externes sont simulés ; PostgreSQL ne l’est pas.

Les preuves finales sont dans [preuves-correctifs](preuves-correctifs/). Les rapports navigateur détaillés se trouvent localement dans `client/playwright-report/`, la couverture dans `server/coverage/` et les rapports Lighthouse HTML dans `artifacts/lighthouse/`.

## Mesure des pages après correction

Un passage local par page sur le build de production servi par Express ; simulation Lighthouse 13.4.1. Ces mesures fluctuent et ne sont pas des statistiques d’utilisateurs réels.

| Page | Performance | Accessibilité | Bonnes pratiques | SEO | LCP | CLS |
|---|---:|---:|---:|---:|---:|---:|
| home-desktop | 97 | 100 | 96 | 100 | 890 ms | 0.000 |
| shop-desktop | 97 | 98 | 96 | 100 | 823 ms | 0.083 |
| signin-desktop | 97 | 100 | 96 | 63 | 1156 ms | 0.000 |
| home-mobile | 84 | 100 | 96 | 100 | 3746 ms | 0.000 |

La connexion est volontairement exclue de l’indexation, d’où son score SEO de 63. Le bootstrap anonyme reçoit un 401 attendu sur `/auth/refresh`, compté par Lighthouse comme erreur console. La performance mobile et le CLS de la boutique restent des axes d’amélioration ; le score desktop ne les masque pas. L’accueil mobile passe de 64 à 84 et son LCP de 7,2 s à 3,7 s dans ces passages locaux, sans garantie de comparaison à environnement strictement identique.

## Changements majeurs

### Sécurité et identité

Les access tokens et refresh tokens ont des usages distincts, des audiences/émetteurs vérifiés et un identifiant unique. Les sessions portent une version revérifiée en base. Les rotations concurrentes sont sérialisées et un rejeu révoque la famille ; les changements sensibles invalident les anciennes sessions.

Les inscriptions passent par une confirmation email, avec une réponse générique sans session. L’association OAuth par simple égalité d’email a été retirée ; un compte déjà lié et protégé par MFA reste soumis à son second facteur. Les tokens de récupération/vérification sont hachés, expirent et ne sont utilisables qu’une fois. Les liens utilisent le fragment de l’URL et ne sont plus journalisés.

Les secrets MFA sont chiffrés en AES-256-GCM avec une clé indépendante et un tag de 16 octets obligatoire. Les tests rejettent les tags tronqués, enveloppes malformées et ciphertexts altérés. Les codes de secours sont hachés et consommés atomiquement. Les opérations de setup/refus ne désactivent plus une MFA existante. Le frontend permet de conserver les codes de secours avant la reconnexion imposée.

Le proxy de confiance doit être déclaré par IP/CIDR. Les limites locales restent actives lorsque Redis tombe. Les métriques exigent un secret ; la cardinalité des routes inconnues est bornée. Les erreurs et logs limitent l’exposition de données, et les textes utilisateurs inclus dans les emails sont échappés.

### Commerce et fiabilité

Le serveur réserve le stock dans la transaction de création, agrège les lignes identiques, impose les variantes et empêche les quantités négatives. Un `checkoutKey` stable rend la reprise idempotente et refuse un changement de contenu sous la même clé.

Le checkout conserve son contexte de paiement après rechargement et redirection. La confirmation affichée attend l’état financier du serveur. L’expiration et l’annulation vérifient le PaymentIntent avant de restituer le stock ; un paiement déjà réussi est rapproché. Les anciennes réservations non démontrables sont exclues de la restitution automatique.

Les événements Stripe contrôlent leur liaison avec la commande, montant et devise. Leur déduplication et tous les effets DB sont atomiques. Le statut logistique est séparé du paiement ; un remboursement demandé attend la confirmation Stripe, et son cumul met à jour revenu et fidélité sans double effet. Cela suit les mécanismes décrits par Stripe pour [les événements](https://docs.stripe.com/webhooks) et [l’idempotence](https://docs.stripe.com/api/idempotent_requests).

Les coupons privés sont réservés au propriétaire et consommés à travers la commande, pas par une simple prévisualisation. La conversion de points produit un coupon effectivement utilisable. Les statistiques excluent les impayés, déduisent les remboursements, répartissent les remises et couvrent le nombre de journées UTC demandé.

Une outbox PostgreSQL conserve les intentions d’envoi dans la transaction métier. Elle résiste aux redémarrages, prend des baux et retente les échecs ; les payloads livrés sont effacés. Les emails critiques ne dépendent plus de Redis.

### Interface, données et exploitation

Les contrats des produits administrateur, variantes/stock, adresses et commandes client sont raccordés. Les listes affichent le numéro public de commande. Les erreurs du catalogue sont visibles avec reprise. L’état de session est restauré par cookie ; les réponses asynchrones d’un ancien compte ne repeuplent pas une session déconnectée.

Le débordement mobile est corrigé et vérifié à 360, 390 et 768 px. Les modales principales gèrent le focus, Tab et Escape. Les labels, contrastes, cibles tactiles et langue du document ont été améliorés. Les polices sont locales ; les ressources statiques sont comprimées et mises en cache. Le SDK Google est chargé sur les formulaires d’authentification uniquement ; la vidéo d’accueil ne se charge pas automatiquement sur petit écran, en économie de données ou en préférence de mouvement réduit.

L’export ne contient pas de facteurs secrets. La suppression révoque les accès puis la maintenance anonymise après 30 jours et purge les données associées, y compris correspondances et outbox de l’adresse concernée. Les snapshots des commandes restent conservés pour la traçabilité financière. Newsletter : consentement exigé par l’API, double confirmation et désinscription par token. Le stockage des produits récemment vus respecte le refus.

Docker embarque le runtime, Prisma et le seed compilé ; npm, npx, Jest, ESLint et tsx sont absents de l’image finale. Les trois lockfiles ont été actualisés et la base Alpine corrigée. Le setup préserve les configurations/volumes existants et ne seed qu’explicitement.

La CI exécute de vrais tests DB/navigateur et scanne les dépendances/l’image. La release construit une seule image, scanne et publie ce même artefact, migre par digest, vérifie la révision servie puis crée la release GitHub. Le workflow Lighthouse échoue en cas d’erreur réelle et archive ses rapports au lieu de publier implicitement sur un stockage public.

## Suivi des 36 constats

« Corrigé » signifie correction présente et vérifiée localement ; cela ne certifie pas une configuration externe. « Partiel » indique un reliquat explicite.

| ID | État | Correction ou limite |
|---|---|---|
| SEC-01 | Corrigé | Usage access/refresh séparé, claims stricts, refus du refresh comme Bearer |
| SEC-02 | Corrigé | MFA protégée sur récupération, OAuth et changements de facteurs |
| SEC-03 | Corrigé | Vérification email ; absence d’association automatique OAuth |
| SEC-04 | Corrigé | Liens sensibles absents des logs, tokens hachés/expirants |
| SEC-05 | Corrigé | Rotation sérialisée, révocation, CAS, chiffrement MFA, codes à usage unique |
| SEC-06 | Corrigé | Proxy explicite, port Compose local, quota local testé en panne |
| SEC-07 | Corrigé | Échappement HTML des champs utilisateurs dans les emails |
| BIZ-01 | Corrigé | Réservation transactionnelle, variantes obligatoires et stock borné |
| BIZ-02 | Corrigé | Reprise checkout, réservation de 30 min, annulation sûre |
| BIZ-03 | Corrigé | Idempotence commande/Stripe/webhook, effets DB atomiques |
| BIZ-04 | Corrigé | Statuts financier/logistique distincts, confirmation du remboursement |
| BIZ-05 | Corrigé | Propriété et réservation des coupons, aperçu sans consommation |
| BIZ-06 | Corrigé | Coupon de fidélité concret, débit atomique et historique |
| BIZ-07 | Corrigé | Outbox et référence publique cohérente |
| BIZ-08 | Corrigé | Revenu net payé, remise/remboursement, fenêtre UTC exacte |
| API-01 | Corrigé | Routes admin/variantes, adresses et commandes alignées |
| API-02 | Corrigé | Produits inactifs exclus du public, invalidation du cache |
| API-03 | Corrigé | Codes d’erreurs adaptés et erreurs UI visibles |
| WEB-01 | Corrigé | Bootstrap de session, refresh partagé, protection contre réponses obsolètes |
| WEB-02 | Corrigé | Mise en page mobile sans débordement dans les trois tailles testées |
| WEB-03 | Partiel | Corrections automatiques et modales ; revue humaine exhaustive d’accessibilité restante |
| WEB-04 | Partiel | Chargements différés, compression, cache, polices locales ; performance mobile encore à améliorer |
| WEB-05 | Partiel | CSP/polices/favicon corrigés ; SEO des fiches et aperçus sociaux restent limités par le rendu SPA |
| OPS-01 | Corrigé | Commandes Redis bornées, cache contourné, clients séparés |
| OPS-02 | Corrigé | Variables Compose transmises ; migration/seed réels dans l’image |
| OPS-03 | Corrigé côté dépôt | Référence immuable, build unique, contrôles ; recette GitHub/plateforme réelle restante |
| OPS-04 | Corrigé | Audits npm et Trivy sans vulnérabilité signalée à la date du contrôle |
| OPS-05 | Corrigé | Protection des métriques, cardinalité bornée, OTel opt-in et outbox observable |
| QA-01 | Corrigé | Couverture sur toutes les sources instrumentables et seuils vérifiés |
| QA-02 | Corrigé | Schémas DB isolés par worker, exécution parallèle vérifiée |
| QA-03 | Partiel | 49 parcours navigateur et invariants API ; vraie autorisation bancaire non testée |
| DATA-01 | Partiel | Export/purge automatisés et suppression du Customer ; politique de rétention financière à définir |
| DATA-02 | Corrigé pour les nouveaux flux | Consentement et double confirmation ; reprise des abonnements historiques nécessaire |
| DATA-03 | Partiel | Seuil gratuité corrigé à 100 CAD inclus ; identité, fiscalité, destinations, taux et engagements à décider |
| DOC-01 | Corrigé | README, API, schéma, readiness, ADR et runbooks alignés sur les comportements livrés |
| DEV-01 | Corrigé | Configuration conservée, migrations versionnées, seed explicite, absence de reset |

## Conditions de migration

Lire [le runbook dédié](../../runbooks/010-audit-remediation-migration.md) avant d’appliquer la migration à une base existante.

1. Sauvegarder et tester la restauration ; planifier l’interruption de l’ancienne version.
2. Préparer les secrets persistants, surtout la clé MFA, et l’envoi d’emails de confirmation.
3. Prévoir l’invalidation des anciennes sessions et la confirmation des emails existants.
4. Réconcilier les anciennes commandes pending et stocks ; aucune réservation historique n’est inventée.
5. Corriger les données historiques avant validation des CHECK créés `NOT VALID` ; vérifier la reprise des facteurs MFA et consentements anciens.
6. Exécuter la recette Stripe/email/OAuth/GitHub dans un staging réel, puis vérifier sauvegardes, supervision, TLS et proxy.

L’outbox livre au moins une fois ; avec un fournisseur sans déduplication, un crash après envoi peut produire un doublon de mail. Les quotas de secours sont par instance pendant une panne Redis. La cohérence transactionnelle PostgreSQL n’élimine pas la nécessité de rapprocher périodiquement les événements Stripe en cas de panne prolongée.

## Reproduire les contrôles

La reprise d’une base historique est également testée par `scripts/verify-legacy-migration.cjs`, intégré à la CI. Les commandes sont dans [le README](../../../README.md#vérifications-reproductibles). Utiliser `scripts/test-env.cjs` avec une base jetable au suffixe `_test`, `_audit` ou `_ci`. Les clés et services externes y sont neutralisés. Ne pas exécuter Playwright et Lighthouse simultanément : ils utilisent le même port local 3107.

Les preuves du premier audit restent inchangées dans `preuves/`, à distinguer de `preuves-correctifs/`. Les chiffres de sécurité dépendent des bases d’avis consultées au moment du contrôle ; les scans doivent continuer en CI.
