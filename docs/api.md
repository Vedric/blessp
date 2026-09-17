# Contrat HTTP

Le contrat de référence est [openapi.yaml](openapi.yaml), validé structurellement avec Swagger Parser lors des correctifs du 16 septembre 2026. Les routes sont préfixées par `/api/v1`, sauf santé et métriques.

## Principes

- JSON validé côté serveur ; montants en centimes CAD. La conversion affichée est indicative.
- Authentification Bearer avec **access token**. Le refresh token HttpOnly est destiné uniquement à `/auth/refresh`, avec rotation et détection de réutilisation.
- Une inscription retourne 202 sans session. Confirmer le lien puis se connecter. Les liens sont à usage unique et les tokens persistés sont hachés.
- Les méthodes sensibles exigent réauthentification et MFA lorsqu’elle est activée. Les sessions sont invalidées après changement de mot de passe, récupération ou changement des facteurs.
- L’autorisation administrateur et l’état du compte sont revérifiés en base.
- Erreurs : JSON invalide 400, absence d’authentification 401, autorisation insuffisante 403, ressource absente 404, conflit 409, corps trop grand 413, règle métier invalide 422, quota 429. Un problème inattendu renvoie un message générique 500.

## Commandes et paiements

La création requiert un `checkoutKey` unique, réutilisé pour une reprise identique. Une réutilisation avec un contenu différent est refusée. Le serveur agrège les quantités, exige une variante valide, recalcule prix/remise/livraison et réserve le stock dans une transaction.

La réservation expire après 30 minutes. L’annulation vérifie d’abord Stripe ; elle ne restitue pas un stock si le paiement est en cours ou confirmé. Les anciennes commandes sans réservation démontrable requièrent un rapprochement manuel.

`status` suit la logistique ; `paymentStatus` et `refundedCents` suivent la finance. Un paramètre de retour navigateur ou une action de l’administrateur ne peut pas déclarer un paiement réussi. Les événements Stripe signés vérifient l’identifiant, le montant et la devise ; leurs effets DB sont atomiques et dédupliqués. Une demande de remboursement n’est pas une confirmation de remboursement.

Les confirmations email sont écrites dans une outbox PostgreSQL au sein de la transaction. Le numéro public est `orderNumber`, distinct de l’identifiant technique. La consultation invitée nécessite ce numéro et l’email correspondant.

## Confidentialité et marketing

`GET /users/export` retourne les données du compte sans facteurs d’authentification. La suppression exige mot de passe/MFA selon le type de compte, révoque les sessions puis anonymise après le délai documenté.

L’inscription newsletter exige un consentement explicite et une confirmation email. La désinscription utilise un token aléatoire. Les anciennes inscriptions sans preuve ne doivent pas être utilisées comme un consentement acquis.

## Routes

La table suivante est issue des opérations documentées dans OpenAPI. Consulter ce fichier pour les schémas détaillés ; les tests d’intégration couvrent également les contrats critiques.

| Méthode | Chemin | Opération |
|---|---|---|
| POST | `/auth/register` | Register a new user account |
| POST | `/auth/login` | Authenticate with email and password |
| POST | `/auth/refresh` | Rotate the refresh token and issue a new token pair |
| POST | `/auth/logout` | Revoke a refresh token and end the session |
| POST | `/auth/forgot-password` | Request a password reset email |
| POST | `/auth/reset-password` | Set a new password using a reset token |
| GET | `/auth/me` | Retrieve the authenticated user's profile |
| POST | `/auth/google` | Sign in or register with Google |
| POST | `/auth/apple` | Sign in or register with Apple |
| GET | `/users/profile` | Retrieve the authenticated user's full profile |
| PATCH | `/users/profile` | Update the authenticated user's profile |
| POST | `/users/change-password` | Change the authenticated user's password |
| DELETE | `/users/account` | Permanently delete the authenticated user's account (GDPR) |
| GET | `/users/email-preferences` | Retrieve the authenticated user's email preferences |
| PATCH | `/users/email-preferences` | Update the authenticated user's email preferences |
| GET | `/products` | List products with filtering, sorting, and pagination |
| POST | `/products` | Create a new product (admin only) |
| GET | `/products/featured` | List featured products for the storefront |
| GET | `/products/filters` | Retrieve available filter options for the product catalog |
| GET | `/products/{id}` | Retrieve a single product by ID |
| PATCH | `/products/{id}` | Partially update a product (admin only) |
| DELETE | `/products/{id}` | Delete a product (admin only) |
| GET | `/products/{id}/complete-look` | Retrieve complementary products for a complete look |
| GET | `/products/{id}/variants` | List all variants for a product |
| PUT | `/products/{id}/variants` | Replace all variants for a product (admin only) |
| GET | `/cart` | Retrieve the authenticated user's shopping cart |
| POST | `/cart` | Add a product to the cart |
| DELETE | `/cart` | Remove all items from the cart |
| PATCH | `/cart/{itemId}` | Update the quantity of a cart item |
| DELETE | `/cart/{itemId}` | Remove a single item from the cart |
| POST | `/orders` | Place a new order from the current cart |
| GET | `/orders` | List all orders (admin only) |
| POST | `/orders/guest` | Place an order as a guest (no account) |
| GET | `/orders/mine` | List the authenticated user's orders |
| GET | `/orders/{id}` | Retrieve a single order by ID |
| GET | `/orders/{id}/timeline` | Retrieve the status history for an order |
| PATCH | `/orders/{id}/status` | Update the status of an order (admin only) |
| POST | `/payments/create-intent` | Create a Stripe payment intent for an order |
| POST | `/payments/setup-intent` | Create a Stripe setup intent for saving a payment method |
| POST | `/payments/guest-create-intent` | Create a payment intent for a guest order |
| POST | `/payments/webhook` | Process incoming Stripe webhook events |
| GET | `/payments/methods` | List saved payment methods for the authenticated user |
| POST | `/payments/methods` | Attach a payment method to the authenticated user |
| DELETE | `/payments/methods/{id}` | Detach a saved payment method |
| POST | `/payments/methods/{id}/default` | Set a payment method as the default |
| POST | `/payments/refund` | Issue a refund for an order (admin only) |
| POST | `/contact` | Submit a contact form inquiry |
| GET | `/wishlist` | Retrieve the authenticated user's wishlist |
| POST | `/wishlist` | Add a product to the wishlist (toggle behavior) |
| DELETE | `/wishlist/{productId}` | Remove a product from the wishlist |
| POST | `/coupons/validate` | Validate a coupon code against an order total |
| POST | `/coupons/apply` | Calculate the discount for a coupon applied to an order total |
| POST | `/coupons` | Create a new coupon (admin only) |
| GET | `/coupons` | List all coupons (admin only) |
| PATCH | `/coupons/{id}` | Update a coupon (admin only) |
| GET | `/currencies/rates` | Retrieve current exchange rates |
| GET | `/reviews` | List reviews for a specific product |
| POST | `/reviews` | Submit a product review |
| GET | `/reviews/summary/{productId}` | Retrieve the rating summary for a product |
| GET | `/reviews/admin/all` | List all reviews across all products (admin only) |
| DELETE | `/reviews/admin/{id}` | Delete any review (admin only) |
| PATCH | `/reviews/{id}` | Update an existing review |
| DELETE | `/reviews/{id}` | Delete a review authored by the authenticated user |
| POST | `/newsletter/subscribe` | Subscribe an email to the newsletter |
| POST | `/newsletter/unsubscribe` | Unsubscribe an email from the newsletter |
| GET | `/loyalty/balance` | Retrieve the authenticated user's loyalty balance and tier |
| GET | `/loyalty/transactions` | List the authenticated user's loyalty point transactions |
| POST | `/loyalty/redeem` | Redeem loyalty points for store credit |
| GET | `/analytics/overview` | Retrieve high-level business metrics (admin only) |
| GET | `/analytics/revenue` | Retrieve revenue data over a time period (admin only) |
| GET | `/analytics/top-products` | Retrieve best-selling products (admin only) |
| GET | `/analytics/recent-orders` | Retrieve the most recent orders (admin only) |
| GET | `/health/live` | Liveness probe |
| GET | `/health/ready` | Readiness probe |
| GET | `/metrics` | Prometheus metrics endpoint |
| POST | `/auth/verify-email` | Consume the single-use email verification token |
| POST | `/auth/resend-verification` | Request verification mail without revealing whether the account exists |
| POST | `/auth/mfa/setup` | MFA setup |
| POST | `/auth/mfa/verify` | MFA verify |
| POST | `/auth/mfa/disable` | MFA disable |
| POST | `/auth/mfa/backup-codes` | MFA backup-codes |
| POST | `/auth/mfa/refuse` | MFA refuse |
| GET | `/auth/mfa/status` | MFA status |
| GET | `/users/export` | Download the authenticated account’s personal data without authentication secrets |
| GET | `/addresses` | List own saved addresses |
| POST | `/addresses` | Create an owned address; the first becomes default |
| PATCH | `/addresses/{id}` | Update own address or choose the default |
| DELETE | `/addresses/{id}` | Delete own address and select a replacement default |
| GET | `/admin/products` | List products with filtering, sorting, and pagination |
| POST | `/admin/products` | Create a new product (admin only) |
| GET | `/admin/products/{id}` | Retrieve a single product by ID |
| PATCH | `/admin/products/{id}` | Partially update a product (admin only) |
| DELETE | `/admin/products/{id}` | Delete a product (admin only) |
| GET | `/admin/products/{id}/variants` | List all variants for a product |
| PUT | `/admin/products/{id}/variants` | Replace all variants for a product (admin only) |
| POST | `/orders/guest/lookup` | Look up a guest order by order number and matching email |
| POST | `/payments/cancel` | Cancel an unpaid reservation, cancel its Stripe intent and release stock exactly once |
| POST | `/newsletter/confirm` | Confirm a newsletter subscription using its emailed token |

## Gestion des stocks

- `GET /admin/inventory` : variantes paginées, recherche nom/SKU, filtres `all`, `low` (1–5), `out` (0), `available` (>0). Les unités disponibles et le nombre de variantes suivent les filtres ; le nombre de produits sans variante est global.
- `GET /admin/inventory/:id/history` : ajustements manuels paginés, du plus récent au plus ancien, avec auteur, motif, note et quantités avant/après.
- `POST /admin/inventory/:id/adjustments` : `expectedStock`, quantité disponible finale `stock`, `reason`, `requestId` UUID et `note` facultative. Une requête identique peut reprendre avec le même UUID ; une clé réutilisée avec un contenu différent ou un stock devenu obsolète renvoie 409. Relire le stock après un conflit. La réponse d’une reprise désigne l’ajustement initial, pas une nouvelle lecture du stock.

Ces routes exigent un administrateur. Les PUT de variantes (préfixes `/products` et `/admin/products`) conservent les variantes omises et exigent désormais `expectedStock` pour chaque variante existante. Un conflit annule tout le lot. Les mouvements automatiques des commandes restent dans leur cycle transactionnel ; ils ne sont pas présentés comme des ajustements manuels. Voir [le guide d’exploitation des stocks](runbooks/011-inventory.md).

## Livraison et support

- `GET /commerce/config` expose les destinations et frais configurés en CAD, sans cache. Une commande valide sa destination avant réservation et recalcule le tarif après remise. `locale` accepte `en` ou `fr` pour la confirmation.
- `GET /admin/contact` fournit la boîte support paginée ; `PATCH /admin/contact/{id}` accepte `{ "read": true }` ou `false`. Ces routes exigent un administrateur et n’envoient aucune réponse au client.
- `POST /payments/refund` demande tout le solde remboursable. `expectedRefundedCents` permet de refuser un solde devenu obsolète avant l’appel fournisseur ; un webhook confirme le résultat final.

Voir [la configuration et ses limites](runbooks/012-launch-configuration.md).
