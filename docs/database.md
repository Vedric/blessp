# Modèle de données et migrations

Le schéma de référence est [`server/prisma/schema.prisma`](../server/prisma/schema.prisma). PostgreSQL 16 ; accès via Prisma et transactions SQL pour les invariants concurrents.

## Domaines

| Domaine | Tables principales | Invariants |
|---|---|---|
| Identité | users, oauth_accounts, refresh_tokens, password_reset_tokens, email_verification_tokens, mfa_setups | Email confirmé, sessions versionnées, tokens hachés, facteurs chiffrés |
| Catalogue | products, product_variants | Produits actifs publics, unicité de variante, stock non négatif |
| Panier et favoris | cart_items, wishlist_items | Propriétaire vérifié, taille/couleur normalisées, une ligne par variante |
| Commandes | orders, order_items, order_status_history | Montants serveur, réservation atomique, checkout idempotent, snapshots conservés |
| Paiement | stripe_customers, stripe_webhook_events | Événement dédupliqué dans la transaction métier ; remboursements bornés |
| Fidélité/coupons | loyalty_transactions, coupons | Débit atomique, ledger dédupliqué, coupon privé utilisable par son propriétaire |
| Données client | addresses, reviews, email_preferences | Autorisation par propriétaire et unicité des valeurs métier |
| Communication | newsletter_subscriptions, contact_messages, email_outbox | Consentement confirmé, reprise des envois et purge des payloads livrés |

Les noms exacts sont définis par les `@@map` du schéma. Les ordres et montants historiques sont conservés pour rapprochement ; la politique de rétention financière doit être définie par l’entreprise.

## Transactions

Les verrous transactionnels sérialisent les opérations sensibles : session/refresh, réservation/annulation/paiement, usage coupon et solde fidélité. Les mises à jour conditionnelles empêchent de soustraire un stock indisponible et d’utiliser deux fois un token.

L’outbox utilise une prise de bail par `FOR UPDATE SKIP LOCKED`. Les effets financiers et l’intention d’envoi sont validés ensemble. L’appel réseau au prestataire se fait en dehors de la transaction de commande ; l’email est livré au moins une fois.

## Migrations

```bash
# Développement : générer une migration après une modification de schema.prisma.
cd server
npx --no-install prisma migrate dev --name description_du_changement
# Déploiement d’une migration versionnée existante :
npx --no-install prisma migrate deploy
```

Les commandes ci-dessus supposent un checkout de développement avec ses dépendances. Dans l’image de production, utiliser `node_modules/prisma/build/index.js` via l’entrypoint Node, comme décrit dans [deployment.md](deployment.md).

Le script de setup ne fait ni reset ni `db push`. Le seed est explicite ; en production il crée seulement l’administrateur absent et préserve les identifiants déjà présents.

La migration `20260916000000_audit_remediation` normalise les paniers, invalide les anciens tokens, sépare finance/logistique et ajoute les tables de confirmation/outbox. Lire [son runbook](runbooks/010-audit-remediation-migration.md) pour les réservations historiques, les CHECK `NOT VALID` et la vérification d’emails existants.

## Tests

Les tests d’intégration exigent une base nommée avec suffixe `_test`, `_audit` ou `_ci`. Chaque worker Jest utilise son schéma ; les tests navigateur emploient `e2e`. Les nettoyages ne doivent jamais viser une base métier. Les tests locaux incluent l’application sur base vide et la reprise de données de l’ancien schéma.

## Sauvegarde et purge

Sauvegarder la base et protéger séparément la clé MFA. Tester une restauration isolée. La maintenance anonymise les comptes supprimés après 30 jours et supprime leurs données personnelles associées ; elle ne supprime pas les snapshots financiers des commandes. Voir [le runbook de suppression](runbooks/008-gdpr-data-deletion.md).
