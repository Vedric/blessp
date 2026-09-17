# 006. Transactions métier et outbox PostgreSQL

Statut : adopté dans les correctifs du 16 septembre 2026. Remplace la partie « livraison des emails critiques » de l’ADR 005 et complète l’ADR 002 sur les sessions.

Une commande, ses effets financiers et l’intention d’envoyer son email doivent rester cohérents même si le processus s’arrête. Redis est facultatif pour la disponibilité du catalogue ; il ne peut pas être la seule preuve qu’un email de commande doit être livré.

Les emails critiques sont inscrits dans `email_outbox` au sein de la transaction PostgreSQL. Un worker périodique prend des baux et retente les envois. Il supprime les payloads après livraison. Resend reçoit une clé d’idempotence ; la livraison reste au moins une fois pour les fournisseurs sans déduplication.

Les tokens persistés sont hachés, les facteurs MFA chiffrés avec une clé indépendante, et les sessions portent une version vérifiée en base. Le surcoût de lecture DB est accepté pour permettre la révocation immédiate. Les verrous transactionnels protègent rotation et changements de sécurité.

Le stock est réservé lors de la création, puis restitué uniquement après annulation vérifiée. Le statut financier est distinct du statut logistique. Les événements Stripe sont dédupliqués avec leurs effets dans une transaction. La reprise des données historiques reste explicite : aucune restitution automatique d’une réservation ancienne non démontrée.

Conséquences : nouvelle migration, sauvegarde nécessaire de la clé MFA, surveillance de l’outbox, et tests d’intégration réels pour la concurrence. Redis conserve le cache et les quotas partagés ; une limite locale reste active pendant ses pannes.
