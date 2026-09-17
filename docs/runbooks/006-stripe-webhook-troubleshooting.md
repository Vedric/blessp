# Diagnostic des paiements Stripe

1. Vérifier l’environnement Stripe, l’endpoint HTTPS `/api/v1/payments/webhook`, le secret de signature correspondant et les tentatives de livraison dans le tableau de bord du fournisseur.
2. Rapprocher PaymentIntent, commande, montant et devise. Un paiement externe réussi ne suffit pas si l’événement est lié à une autre commande ou si les montants divergent ; l’application refuse ces incohérences.
3. Consulter les identifiants d’événement et logs expurgés. Le corps brut est nécessaire pour vérifier la signature. Une réponse 400 indique notamment une signature invalide ; une erreur serveur doit déclencher une reprise du fournisseur.
4. Rejouer depuis Stripe un événement légitime une fois la cause résolue. L’identifiant est dédupliqué avec les effets métier dans une transaction PostgreSQL. Ne pas supprimer aveuglément les entrées `stripe_webhook_events`.
5. Vérifier `payment_status`, `refunded_cents`, stock, fidélité et outbox. `status` représente aussi la logistique : une commande déjà expédiée ne doit pas revenir au statut paid lors d’un rejeu.

Événements gérés : succès/échec/annulation du PaymentIntent et remboursement de charge. Les échecs de tentative ne libèrent pas automatiquement une réservation encore utilisable. L’expiration tente d’annuler le paiement avant restitution de stock ; un paiement réussi découvert à ce moment est rapproché au lieu d’être annulé localement.

Une demande de remboursement administrateur appelle Stripe avec une clé d’idempotence stable ; l’état local attend la confirmation vérifiée. Contrôler les remboursements partiels et leur cumul. Les points de fidélité peuvent devenir débiteurs si un client a déjà dépensé ceux d’un achat ensuite remboursé.

Les anciennes commandes pending, créées avant les invariants de réservation, demandent un rapprochement manuel avec Stripe et l’inventaire. Ne pas marquer arbitrairement une commande payée ni restituer son stock pour faire disparaître une alerte.

Les tests du dépôt utilisent des événements signés localement et des doublures du SDK. La recette du prestataire en staging doit couvrir paiement, 3DS, redirection, webhooks retardés/rejoués, annulation et remboursement. Voir la [documentation Stripe sur les webhooks](https://docs.stripe.com/webhooks) et [les clés d’idempotence](https://docs.stripe.com/api/idempotent_requests).
