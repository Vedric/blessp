# 013. PayPal, cartes et connexions externes

Révision : 17 septembre 2026. Intégration locale et contrats simulés ; les comptes fournisseurs restent à créer et à recetter. Voir [le lancement depuis zéro](../GUIDE_LANCEMENT.md).

## Moyens demandés

Visa, Mastercard, American Express, Discover et Diners Club figurent dans les [réseaux pris en charge par Stripe au Canada](https://docs.stripe.com/payments/cards). La boutique utilise PaymentElement et les moyens automatiques du compte Stripe. Les portefeuilles Apple Pay et Google Pay sont en mode automatique : leur apparition dépend du compte, du domaine enregistré, de l’appareil et de l’éligibilité du client. Chaque méthode proposée devra être testée avec le vrai environnement de test Stripe puis vérifiée dans la configuration commerciale.

**PayPal est un prestataire distinct pour cette boutique canadienne.** Le traitement PayPal intégré à Stripe est réservé aux pays européens listés dans sa [documentation](https://docs.stripe.com/payments/paypal). Activer CAD ne rend pas un compte canadien éligible à ce traitement.

## Configurer PayPal

1. Créer le compte de l’exploitant et une application de recette dans le tableau de bord développeur PayPal. Conserver séparément les identifiants sandbox et commerciaux.
2. Configurer ensemble `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`. Laisser les trois vides pour désactiver PayPal. Aucun de ces champs n’est requis dans le bundle client : le parcours utilise la page d’approbation hébergée par PayPal.
3. Définir `PAYPAL_ENVIRONMENT=sandbox` pour la recette. Seule la configuration commerciale validée utilise `live`. Les origines API sont fixes dans le code.
4. Enregistrer le webhook HTTPS `/api/v1/payments/paypal/webhook` de cet environnement avec `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.PENDING`, `PAYMENT.CAPTURE.DENIED` et `PAYMENT.CAPTURE.REFUNDED`.
5. Vérifier `CLIENT_URL` : il sert à construire `/checkout?paypal=return` et `/checkout?paypal=cancel`. Le client ignore les paramètres `token` et `PayerID` comme preuve de paiement.
6. Recetter avec un acheteur sandbox distinct. Références : [Orders API](https://developer.paypal.com/api/orders/v2), [Captures et remboursements](https://developer.paypal.com/api/payments/v2), [Vérification des notifications](https://developer.paypal.com/api/webhooks/v1).

Le serveur crée le montant CAD depuis la commande réservée et transmet l’adresse de livraison approuvée dans le checkout. Il vérifie la propriété de la commande, lie la référence PayPal et refuse de passer d’un prestataire à l’autre sans annuler la réservation précédente. Les liens d’approbation sont limités au domaine PayPal de l’environnement.

La capture n’est possible qu’après approbation et via le serveur. Un marqueur durable est écrit avant l’appel externe. Si sa réponse se perd, les réservations restent conservées et une reprise consulte le paiement existant. Les demandes concurrentes sont sérialisées par commande. Une clé stable est réutilisée pour créer, capturer et rembourser. Après cinq heures d’incertitude, le serveur refuse une nouvelle capture automatique : intervention de support et rapprochement fournisseur nécessaires.

Les événements sont vérifiés auprès de PayPal, puis les montants et états sont relus via son API. Une approbation ou une redirection ne déclenche ni préparation ni email de confirmation. La confirmation, la fidélité et le panier sont mis à jour par la même logique métier que les paiements Stripe.

## Remboursements et incidents

Le dialogue administratif existant sélectionne le bon prestataire à partir de la commande. Il demande le remboursement de tout le solde disponible. Les remboursements PayPal partiels effectués chez le prestataire sont rapprochés par leurs notifications, avec déduplication par référence et cumul monotone. Le dialogue ne permet toujours pas de choisir un montant ou des articles.

Un remboursement `PENDING` n’est pas considéré comme terminé. Sa reprise consulte sa référence ; une notification confirmée actualise le solde. Vérifier les états dans les deux systèmes avant toute intervention manuelle. Une erreur externe reste une erreur, et ne doit pas être interprétée comme un remboursement confirmé.

En cas de capture incertaine, consulter la commande et sa référence dans PayPal. Ne pas modifier directement le stock ou marquer la commande payée pour débloquer le parcours. Rejouer la notification valide ou réconcilier le résultat, puis vérifier commande, fidélité, email et réservation. La remise en stock après retour reste une décision physique distincte du remboursement.

## Connexion email, Google et Apple

La connexion email/mot de passe, vérification email, récupération et MFA conservent leurs parcours. Google et Apple sont activés par leurs identifiants publics de compilation, avec une audience serveur identique. Les identifiants, domaines et URL de retour sont détaillés dans [le guide des comptes](009-stripe-and-oauth-setup.md).

Google vérifie audience, expiration et email, puis récupère les noms manquants via UserInfo en contrôlant le même sujet et la même adresse. Voir [la référence Google](https://developers.google.com/identity/openid-connect/reference). Apple vérifie signature RSA, émetteur, audience, expiration et email. Apple ne transmet le profil nominatif qu’à la première autorisation ; voir [la configuration web Apple](https://developer.apple.com/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple).

Si les noms manquent, l’interface les demande et permet d’annuler. Elle traite aussi les fenêtres bloquées/fermées et l’échec de chargement du SDK, avec nouvelle tentative et maintien de la connexion classique. Le MFA est respecté pour les comptes concernés. Le code ne fusionne jamais deux comptes uniquement parce que leurs emails correspondent : utiliser le mode de connexion existant. Un futur écran de liaison explicite de comptes nécessitera une authentification préalable des deux identités.

## Reproduire les vérifications locales

Utiliser uniquement une base nommée avec le suffixe `_test`, `_audit` ou `_ci`. `scripts/test-env.cjs` remplace les clés réelles et retire les variables PayPal. Les comptes et commandes de recette sont synthétiques.

```bash
# TEST_DATABASE_URL doit désigner la base isolée de recette.
node scripts/test-env.cjs npm --prefix server run test:coverage -- --maxWorkers=2
node scripts/build-e2e.cjs --providers
E2E_SIMULATE_PROVIDERS=1 node scripts/test-env.cjs npm --prefix client run test:e2e -- --config playwright.providers.config.ts
```

Le lanceur applique les migrations et démarre un serveur isolé sur 3107 ; ce port doit être libre. Les trois navigateurs Playwright doivent être installés. Le simulateur n’est chargé que par le script de recette, sous `NODE_ENV=test` et dans le schéma `e2e`. Il est exclu du contexte Docker. Aucun contournement de vérification n’est ajouté aux routes de production.

La suite navigateur traverse l’application, ses routes et PostgreSQL avec des SDK/identités/paiements simulés. La suite serveur teste séparément les contrôles des contrats, dont de vraies signatures RSA de test pour Apple. **Ces résultats ne certifient pas une autorisation ou une réception chez un fournisseur réel.**

Après cette recette, reconstruire avec `npm run build:test` pour retrouver la prévisualisation locale sans identifiants publics synthétiques. La CI exécute les parcours ordinaires et ceux des fournisseurs dans des jobs séparés, puis conserve les rapports. La release commerciale est manuelle et limitée à `main` ; les contrôles de lancement restent obligatoires.
