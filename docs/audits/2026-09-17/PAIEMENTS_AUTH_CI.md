# Paiements, connexions et livraison du code — 17 septembre 2026

## Résultat local

Le checkout propose une intégration PayPal distincte lorsqu’elle est configurée. Stripe conserve les cartes et les portefeuilles éligibles de PaymentElement. La connexion Google récupère désormais les noms absents de tokeninfo via UserInfo, lié à la même identité. Google et Apple proposent un complément de profil si nécessaire, respectent le MFA et gèrent fermeture, blocage et échec de chargement de leurs interfaces externes.

PayPal contrôle le propriétaire, le montant CAD, l’adresse transmise, les références et l’environnement. Création/capture/remboursement sont idempotents et protégés contre les demandes concurrentes. Une capture incertaine conserve le stock jusqu’au rapprochement. Les remboursements sont rapprochés sans remise en stock automatique. Migration ajoutée : `20260917020000_paypal`.

Le [guide des fournisseurs](../../runbooks/013-paypal-and-provider-testing.md) précise comptes, variables, événements, procédure et limites. Les moyens réels ne sont pas activés : le propriétaire ne possède encore aucun compte fournisseur.

## Vérifications observées

| Contrôle | Résultat |
| --- | --- |
| Serveur, PostgreSQL isolé et migrations | 516 tests / 37 suites réussis, avec couverture |
| Fournisseurs dans le navigateur | 13 scénarios × Chromium, Firefox et WebKit : 39 réussites, aucune reprise automatique |
| Régression navigateur sur auth, checkout et lancement | 34 scénarios × trois navigateurs : 102 réussites |
| Lint et compilation | Réussis |
| OpenAPI | Document valide après ajout des routes PayPal et du complément de profil |
| Workflows | Actionlint réussi |
| Image Docker locale | 11 contrôles de démarrage/migration/HTTP/arrêt réussis sur l’image de la révision 1331834, avant regroupement des commits et ajustement des seules fixtures de test |
| Dépendances npm | Aucune vulnérabilité signalée à la racine, dans le serveur ou le client lors du contrôle |

Les [preuves locales](preuves/) conservent les sorties et leurs SHA-256. Les essais exploratoires ont révélé une erreur de syntaxe dans le SDK Apple simulé et une mesure de largeur prise pendant l’animation d’entrée. Le simulateur a été corrigé, la mesure attend la stabilisation, puis la suite complète des 39 cas a réussi. Les essais serveur ont également nécessité la correction de fixtures partagées et des assertions des nouveaux contrats.

Les fournisseurs sont simulés aux limites des tests. Les routes applicatives, sessions et écritures PostgreSQL sont réelles dans une base de recette. La suite serveur vérifie séparément les signatures RSA Apple de test, les audiences, expirations, emails, l’absence de liaison automatique par email, le MFA, la concurrence, les notifications rejouées et les montants remboursés. Ces validations ne remplacent pas une session chez Google/Apple, un achat sandbox PayPal ou une autorisation Stripe réelle de test.

## CI/CD et Git

Les contrôles ordinaires continuent à exécuter la suite navigateur complète. Un job distinct construit avec des identifiants OAuth synthétiques et exécute les contrats fournisseurs sur trois navigateurs, sans secret externe. Les preuves sont conservées en artifacts. Le simulateur est limité au lanceur de recette et exclu du contexte Docker.

La release commerciale devient manuelle, uniquement depuis `main`, avec la revue de lancement obligatoire. Fusionner les correctifs ne déploie donc pas une boutique non configurée. La détection de secrets conserve les règles par défaut, avec exclusions ciblées des manifestes SHA-256 et des exemples historiques documentés ; les fichiers source restent inspectés.

Les résultats distants de CI, scans d’image et Lighthouse doivent être consultés sur la pull request correspondant à la révision publiée. Les résultats locaux ci-dessus ne sont pas une attestation de leur succès.

## Revue des détections historiques

GitGuardian a signalé deux valeurs de test dans l’historique de la branche : un mot de passe utilisé uniquement pour les validations de formulaire et le vecteur public RFC 4226. Les mots de passe de ces tests sont désormais générés ; la fixture MFA est dérivée des octets ASCII publiés dans la RFC. Les tests concernés sont rejoués. Une branche locale conserve l’historique antérieur au regroupement ; aucun historique de `main` n’est réécrit. Les nouveaux contrôles distants portent sur le commit regroupé.

## Restant avant ouverture complète

- Créer les comptes Stripe, PayPal, Google et Apple ; vérifier les domaines, audiences, clés et notifications de chaque environnement.
- Tester les réseaux de cartes demandés et Apple Pay/Google Pay avec les appareils et comptes compatibles. Le support générique par un prestataire ne certifie pas l’éligibilité du marchand.
- Recetter PayPal sandbox avec acheteur distinct : acceptation, refus, interruption, délai, notification retardée et remboursement ; rapprocher tous les états avec l’administration.
- Recetter Google et Apple réels, y compris email masqué Apple, profil incomplet, MFA et retour au parcours d’achat. La liaison de plusieurs modes à un compte existant nécessite encore un parcours explicite ; aucune fusion automatique par email.
- Finaliser fiscalité, règles de livraison/retour, textes légaux, catalogue, emails réels, sauvegardes, alertes, charge et appareils physiques selon la [checklist de lancement](../../LAUNCH_CHECKLIST.md).

Aucun compte créé auprès d’un fournisseur, paiement réel ou déploiement commercial n’a été effectué pendant cette passe.
