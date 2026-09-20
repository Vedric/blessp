# Emails de compte FR/EN et fiabilité de livraison

## Problème et correction

La récupération de mot de passe et plusieurs messages de compte étaient en anglais. Le bienvenue Google/Apple était envoyé directement après création du compte ; une erreur du prestataire ne bénéficiait pas des reprises de l’outbox.

Les demandes d’inscription, de renvoi, de récupération, de changement d’adresse et de connexion sociale acceptent maintenant une langue facultative `en` ou `fr`. Le frontend transmet la langue active au moment de la demande. Les anciens clients restent compatibles avec la valeur par défaut `en`.

Les modèles de vérification, récupération, bienvenue et notification de changement d’adresse partagent une présentation responsive avec contenu dynamique échappé. La langue du lien est transmise dans `?lng=fr` ou `?lng=en`, prioritaire sur la langue mémorisée au chargement. Le jeton reste dans le fragment `#token=…`, hors des paramètres transmis au serveur lors de la navigation.

La migration `20260920000000_verification_locale` ajoute la langue au jeton de vérification, avec valeur par défaut `en` pour les lignes existantes et contrainte de valeurs autorisées. La confirmation utilise cette langue pour le bienvenue ou la notification à l’ancienne adresse. Ce stockage ne constitue pas une préférence linguistique permanente du compte.

La création d’un compte social, de son identité et de son bienvenue utilise une seule transaction. Une panne de mise en file annule la création ; une nouvelle connexion à un compte existant ne crée pas de deuxième bienvenue. Le transport et ses reprises sont pris en charge par l’outbox existante. Aucun coupon n’est promis aux comptes sociaux ; les inscriptions par mot de passe conservent leur coupon effectivement créé à la confirmation.

## Vérifications locales

- Lint serveur/client et compilation de test réussis.
- 523 tests serveur dans 37 suites : langues, anciennes requêtes sans langue, validation, renvoi et invalidation du lien précédent, usage unique, récupération neutre, changement d’adresse, rollback des inscriptions Google/Apple et absence de bienvenue dupliqué.
- Migration d’une base ancienne réussie, avec conservation des données et invariants financiers contrôlés par le script existant.
- 36 exécutions Playwright sur Chromium, Firefox et WebKit : parcours inscription/confirmation/récupération/connexion dans chaque langue, liens ouverts après mémorisation de la langue opposée, dix aperçus d’emails à 320 px par navigateur (commandes et compte).
- 39 contrats fournisseurs Google/Apple/PayPal réussis sur les trois navigateurs, avec SDK et réponses externes simulés et application/base réelles.
- 27 contrôles d’accessibilité de neuf pages réussis sur les trois navigateurs après correction de l’attente de l’accueil.
- Aucun débordement horizontal ni violation axe sur les critères automatisés WCAG A/AA testés dans les aperçus. Les noms et codes contenant du HTML restent du texte inerte. Captures conservées dans `artifacts/account-emails-20260920/`.

Le contrôle post-fusion de la révision précédente (`35526611683`) a révélé une attente `networkidle` intermittente sur l’accueil Firefox. Le test d’accessibilité de cette page attend désormais le titre, les produits rendus et les polices, sans dépendre de la fin du téléchargement de la vidéo. Les reprises intermittentes restent bloquantes en CI.

La CI exécute aussi la matrice complète de parcours, les contrats fournisseurs, les audits de dépendances et la construction/analyse de l’image. Son résultat sur la révision finale fait foi pour la fusion.

## Exercices locaux d’exploitation

Sur le même code applicatif, une sauvegarde PostgreSQL au format personnalisé du schéma synthétique `e2e` a été restaurée dans une base temporaire distincte. Les nombres de lignes et empreintes de contenu ont été comparés table par table : 27 tables, 142 lignes identiques. La base temporaire a été supprimée après contrôle ; l’archive de test est conservée avec droits restreints. Preuve : `artifacts/account-emails-20260920/restore-drill.json`.

Une sonde en lecture seule du catalogue a exécuté trois paliers de 15 secondes, avec 1, 5 et 20 clients concurrents et une pause de 50 ms entre requêtes. Résultat : 7 195 réponses HTTP 200, aucune erreur ; p95 maximal observé de 6,52 ms. Ce résultat porte sur huit produits synthétiques, en boucle locale, en mode test et sans Redis ni services externes. Il ne mesure ni la capacité d’un hébergement, ni les écritures concurrentes, ni le comportement des quotas de production. Script et mesures : `artifacts/account-emails-20260920/catalogue-load-probe.cjs` et `catalogue-load.json`.

Ces exercices ne ferment pas les validations de sauvegarde/charge du futur environnement commercial.

## Limites avant ouverture

Les boîtes et transports fournisseurs réels ne sont pas configurés. La recette locale ne prouve pas la réception Gmail/Outlook/Apple Mail, le rendu dans leurs logiciels, la délivrabilité, les DNS ni le bon fonctionnement du domaine public. Tester ces points sur la préproduction, avec le worker d’outbox actif, puis vérifier une panne/reprise et un message effectivement reçu. Les clés et domaines Google/Apple réels restent également à provisionner et à recetter.
