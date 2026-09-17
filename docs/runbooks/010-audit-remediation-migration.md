# Migration des correctifs du 16 septembre 2026

Migration concernée : `20260916000000_audit_remediation`. Elle a été testée localement depuis une base vide et depuis l’ancien schéma avec paniers dupliqués, commande expédiée et commande en attente. Ces fixtures ne remplacent pas un essai sur une copie de la base cible.

## Préparation

1. Préparer une sauvegarde restaurable et tester sa restauration isolée. Conserver les clés RSA/MFA dans le gestionnaire de secrets.
2. Installer les nouveaux paramètres : `MFA_ENCRYPTION_KEY` persistante, `METRICS_TOKEN`, `CLIENT_URL` HTTPS, origines CORS, provider email et Stripe. La clé MFA est indépendante de la clé JWT.
3. Arrêter les anciennes instances et suspendre les nouvelles commandes pendant la migration. Ne pas mélanger anciennes et nouvelles versions ; les anciens JWT et contrats d’inscription ne sont pas compatibles.
4. Sur une copie, repérer les anomalies historiques : stocks négatifs, remises en pourcentage supérieures à 100, remboursements incohérents et anciennes commandes pending. Réconcilier avec Stripe et l’inventaire physique, sans supposer que l’ancien code avait réservé le stock.

## Effets attendus

- Les doublons du panier dont taille/couleur sont NULL ou vides fusionnent, en conservant la somme des quantités.
- Les refresh tokens et liens de récupération existants sont invalidés. Les nouvelles sessions portent des claims d’usage/version/audience et les tokens persistés sont hachés.
- Les emails des comptes existants restent non confirmés : organiser le parcours « renvoyer le lien de vérification ». Ne pas marquer globalement ces emails comme vérifiés sans preuve. Le seed préserve les identifiants d’un administrateur existant.
- Les états logistiques historiques payés sont reportés dans `payment_status`. Le statut financier doit ensuite suivre les événements Stripe vérifiés.
- Les anciennes commandes pending n’obtiennent pas de date d’expiration automatique. Le code refuse de restituer un stock dont la réservation historique n’est pas démontrable. Traiter ces commandes manuellement avant de clôturer la migration.
- Les anciens facteurs MFA en clair sont chiffrés par lots au démarrage de la maintenance. Vérifier la fin de cette reprise avant de considérer le stockage entièrement chiffré.
- Les anciennes inscriptions newsletter sans trace de consentement/confirmation doivent être réconciliées ou reconfirmées avant un envoi marketing. Ne pas assimiler `is_active` historique à une preuve de consentement.
- Des contraintes CHECK sont créées `NOT VALID` : elles protègent les nouvelles écritures mais ne certifient pas les anciennes lignes.

## Application et vérification

Exécuter la migration avec l’image immuable validée, en fournissant uniquement la connexion cible nécessaire :

```bash
docker run --rm --env-file /chemin/protege/migration.env IMAGE@sha256:DIGEST node_modules/prisma/build/index.js migrate deploy
```

Vérifier le succès de toutes les migrations, puis démarrer la nouvelle image. Tester readiness/révision, login d’un compte confirmé, vérification email, réservation d’un article, annulation, paiement de test et webhook de test. Vérifier la reprise de l’outbox et les journaux de maintenance.

Après rapprochement des anomalies historiques, exécuter dans PostgreSQL :

```sql
ALTER TABLE product_variants VALIDATE CONSTRAINT stock_nonnegative;
ALTER TABLE orders VALIDATE CONSTRAINT refund_bounds;
ALTER TABLE coupons VALIDATE CONSTRAINT coupon_discount_bounds;
```

Ces instructions échouent si des anciennes lignes violent encore les règles ; corriger les données avec justification métier avant de relancer. Ne pas supprimer les contraintes pour faire passer la validation.

La migration contient des modifications et suppressions de tokens : elle n’a pas de rollback automatique. En cas d’échec, ne pas exécuter aveuglément `migrate resolve` ; inspecter l’état réel et la sauvegarde. Un retour à l’ancienne image seule ne restaure ni les sessions ni les anciennes données. Préférer une correction en avant ; une restauration doit tenir compte des paiements et écritures réalisés depuis la sauvegarde.

La migration additive suivante, `20260917000000_inventory_adjustments`, est décrite dans [le guide des stocks](011-inventory.md).
