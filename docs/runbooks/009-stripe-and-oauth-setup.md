# 009. Configurer Stripe et les connexions sociales

**Révision : 17 septembre 2026.** Ce guide décrit la configuration à réaliser. Aucun compte fournisseur ni paiement réel n’a été validé pour cette boutique. Commencer par le [guide de lancement](../GUIDE_LANCEMENT.md).

## Stripe : commencer dans une préproduction isolée

1. Créer un compte Stripe appartenant à l’exploitant. Fournir les renseignements d’identité, d’activité et de versement demandés dans le tableau de bord. Les exigences et l’état d’activation sont déterminés par Stripe ; ne pas supposer une forme juridique ou un délai de vérification. Voir la [configuration officielle du compte](https://docs.stripe.com/get-started/account/set-up).
2. Sélectionner l’environnement de test Stripe destiné à la préproduction.
3. Installer les valeurs du même environnement :

| Valeur | Destination |
| --- | --- |
| `STRIPE_SECRET_KEY` (`sk_test_…`) | Secret serveur |
| `VITE_STRIPE_PUBLISHABLE_KEY` (`pk_test_…`) | Variable publique à la compilation du client |
| `STRIPE_WEBHOOK_SECRET` (`whsec_…`) | Secret serveur de signature du webhook de cet environnement |

La clé publique n’est pas nommée `STRIPE_PUBLISHABLE_KEY` dans ce projet. Une modification d’une variable `VITE_*` nécessite une nouvelle compilation/image. Ne jamais placer la clé privée dans une variable `VITE_*`.

4. Créer le webhook vers `https://<domaine-de-preproduction>/api/v1/payments/webhook` et sélectionner les quatre événements traités dans `payments.service.ts` :
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.refunded`
5. Configurer également les autres variables obligatoires décrites dans [déploiement](../deployment.md). `NODE_ENV=production` peut être utilisé en préproduction avec les clés Stripe de test : il désigne le mode d’exécution de l’application, pas l’environnement de paiement.
6. Vérifier les parcours avec les [cartes et scénarios de test Stripe](https://docs.stripe.com/testing), sans remplacer les clés d’une boutique commerciale active par des clés de test.

## Moyens de paiement et domaines

Pour cette entreprise canadienne, PayPal passe par [l’intégration distincte du projet](013-paypal-and-provider-testing.md), avec ses propres identifiants et notifications. Il ne suffit pas d’activer PayPal dans Stripe.

Le code crée des PaymentIntents avec `automatic_payment_methods: { enabled: true }` et utilise PaymentElement. Vérifier dans le compte les méthodes effectivement disponibles pour l’activité, le pays, la devise et le parcours proposé. Leur disponibilité et leur recette ne sont pas établies par ce dépôt : ne pas promettre PayPal ou un portefeuille uniquement parce que PaymentElement est intégré.

Pour les méthodes qui l’exigent, enregistrer les domaines et sous-domaines de chaque environnement conformément à la [procédure Stripe pour Elements](https://docs.stripe.com/payments/payment-methods/pmd-registration). Tester chaque moyen effectivement proposé sur un appareil compatible. Apple Pay et Google Pay sont des moyens de paiement ; leur activation ne configure pas les connexions Apple et Google.

## Taxes : travail applicatif encore nécessaire

Le total actuel ne comporte pas de calcul fiscal. Faire valider le traitement applicable à l’entreprise et aux destinations, puis implémenter calcul, ventilation, stockage et remboursement dans l’application.

L’ancienne instruction consistant à ajouter `automatic_tax: { enabled: true }` à la création du PaymentIntent était incorrecte. La [procédure Stripe Tax pour PaymentIntents](https://docs.stripe.com/tax/payment-intent) décrit une intégration avec un calcul fiscal et son association au paiement, avec gestion des transactions et corrections. Sa compatibilité avec la version d’API et le SDK du projet doit être vérifiée lors de l’implémentation. Activer Stripe Tax dans le tableau de bord ne suffit pas.

Aucun seuil fiscal, taux ou statut d’inscription n’est présumé dans ce guide. Voir la [checklist fiscale et commerciale](../LAUNCH_CHECKLIST.md).

## Recette Stripe et passage en production

En préproduction, vérifier et conserver les références non secrètes des commandes et événements :

- Achat invité et membre, paiement accepté, refus et authentification supplémentaire.
- Interruption, reprise et redirection de paiement ; cohérence des montants et devise.
- Webhook signé, retardé et rejoué : une commande ne doit être créditée qu’une fois.
- Annulation et expiration : libération cohérente des réservations.
- Remboursement : rapprochement du montant cumulé et de l’état de la commande. L’administration rembourse actuellement tout le solde restant ; l’inspection et la remise en stock sont distinctes.
- Emails de commande et fidélité cohérents avec l’état du paiement.

Un HTTP 200 du webhook ne suffit pas : un événement sans commande correspondante peut être ignoré. Contrôler les effets métier attendus.

Après recette et décision d’ouverture, préparer séparément les clés `sk_live_…` / `pk_live_…`, le webhook commercial et sa signature. Suivre la [checklist Stripe de mise en service](https://docs.stripe.com/get-started/checklist/go-live). Les essais simulés restent dans les environnements de test ; ne pas créer une charge réelle uniquement pour exécuter un scénario automatisé.

Le contrôle du projet est `npm run check:launch -- --staging` en préproduction et `npm run check:launch` pour la configuration commerciale. Il vérifie notamment les préfixes de clés et leur cohérence, sans contacter Stripe. La revue de lancement et les autres prérequis doivent également être remplis ; un succès ne prouve pas un encaissement.

Lors d’une rotation, installer les nouvelles valeurs, reconstruire si la clé publique change, puis vérifier le service avant révocation des anciennes clés. Vérifier la fenêtre de coexistence proposée par Stripe au moment de l’opération ; aucune durée fixe n’est garantie ici.

## Connexions Google et Apple : facultatives

Ces intégrations peuvent rester désactivées pour lancer avec la connexion email. Les boutons dépendent des variables publiques de compilation.

| Fournisseur | Client | Serveur | Comportement constaté dans le code |
| --- | --- | --- | --- |
| Google | `VITE_GOOGLE_CLIENT_ID` | `GOOGLE_CLIENT_ID` | Jeton d’accès contrôlé par tokeninfo, audience et email vérifié |
| Apple | `VITE_APPLE_CLIENT_ID` | `APPLE_CLIENT_ID` | Jeton d’identité signé, émetteur, audience et email vérifié |

Pour Google, configurer une application web et ses origines autorisées correspondant aux domaines réellement utilisés. Le bouton actuel utilise `useGoogleLogin` en popup. Les informations publiques, permissions et éventuelles vérifications du fournisseur devront être complétées avant activation publique.

Pour Apple, le client actuel configure `usePopup: true` et **`redirectURI: window.location.origin + '/signin'`**. Configurer le Services ID et l’URL de retour en conséquence ; l’ancienne URL `/signin/apple/callback` ne correspond pas à ce code. Vérifier les conditions du programme, les domaines et l’envoi aux adresses de relais au moment de l’activation.

Recetter chaque fournisseur choisi : première connexion, connexion répétée, annulation, email déjà associé, jeton invalide/expiré, mauvaise audience, déconnexion et navigation mobile. Les audiences serveur et client doivent correspondre. Les procédures exactes des consoles seront vérifiées à cette étape ; aucun compte OAuth distant n’est actuellement validé.

## DNS et assistance

Appliquer les enregistrements exacts fournis par l’hébergeur et les prestataires ; ne pas copier un modèle SPF/DMARC sans tenir compte des expéditeurs et de la messagerie existante. Conserver le domaine principal, les sous-domaines de recette et d’envoi, et les URLs publiques de l’application cohérents.

En cas d’incident de paiement, consulter [le diagnostic webhook](006-stripe-webhook-troubleshooting.md). Pour les emails, consulter [la reprise de la file d’envoi](007-email-queue-recovery.md).
