# Rétablissement des emails transactionnels

Les nouveaux emails de vérification, récupération, newsletter et confirmation de commande utilisent `email_outbox` dans PostgreSQL. Ils sont inscrits dans la transaction métier. La maintenance les traite toutes les dix secondes avec un bail de deux minutes et des reprises espacées jusqu’à une heure.

1. Vérifier que l’application et sa maintenance tournent, que PostgreSQL est disponible et que le fournisseur configuré répond.
2. Examiner les métriques `email_outbox_pending` et `email_outbox_oldest_seconds`. Lire les identifiants/compteurs dans les logs ; ne pas copier les payloads contenant des liens secrets dans un ticket.
3. Corriger identifiants, domaine d’envoi, quota ou panne prestataire. Les tentatives reprennent automatiquement. Après redémarrage, attendre l’expiration du bail avant de diagnostiquer un blocage.
4. Les envois réussis gardent leur identifiant mais effacent leur payload. Ne pas effacer les identifiants de déduplication d’un email déjà envoyé.

La livraison est au moins une fois. Resend reçoit une clé d’idempotence stable. Un fournisseur sans cette capacité peut envoyer deux fois après un crash entre envoi et enregistrement du succès. Ne pas annoncer une livraison exactement une fois.

En développement sans fournisseur, l’outbox est conservée pour inspection locale explicite ; les emails ne sont ni envoyés ni journalisés. Les liens expirés doivent être redemandés.

Si l’ancienne version a laissé des jobs BullMQ dans Redis, les inventorier séparément et décider de leur traitement avant suppression. La nouvelle outbox ne migre pas automatiquement ces anciennes files.
