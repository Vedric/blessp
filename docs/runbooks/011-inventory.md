# Gestion des stocks

## Mise en service

Appliquer `20260917000000_inventory_adjustments` avec le processus Prisma habituel, avant de démarrer cette version serveur. Cette migration additive crée l’historique et ses contraintes ; elle ne modifie aucune quantité existante. Tester d’abord sur une copie de la base cible. Les anciennes interfaces doivent être rechargées : un PUT de variante existante sans `expectedStock` est désormais refusé (409).

## Utilisation

Ouvrir **Administration → Gestion des stocks** (`/admin/inventory`). Rechercher un nom ou SKU, puis filtrer les ruptures ou les faibles stocks. Le seuil indicatif est de 1 à 5 unités. Les quantités portent sur les unités **disponibles**, hors unités déjà réservées dans les commandes en attente. Les produits inactifs et anciennes options restent visibles et signalés ; les produits supprimés sont exclus.

1. Cliquer **Ajuster le stock** sur la taille/couleur concernée.
2. Indiquer la quantité disponible finale, pas le nombre à ajouter. Exemple : disponible 4, réception contrôlée de 12 unités → saisir 16.
3. Choisir le motif (réapprovisionnement, comptage, articles abîmés/perdus, retour contrôlé ou correction) et ajouter une note utile sans données personnelles.
4. Enregistrer. Si une commande ou un autre administrateur a changé la quantité, recharger le stock actuel puis revoir la saisie. Ne pas recopier aveuglément l’ancien total.
5. Consulter **Historique manuel** pour retrouver date, auteur, motif et avant/après. Les anciennes quantités n’ont pas de faux historique rétrospectif.

Pour un comptage physique, déduire les unités déjà réservées et encore présentes en entrepôt. Pour un retour, réintégrer uniquement les articles reçus, contrôlés et revendables. Un remboursement financier ne prouve pas qu’un article est revenu. L’expiration ou l’annulation autorisée d’une commande restitue automatiquement sa réservation une seule fois ; ne pas la remettre manuellement une seconde fois.

La maintenance traite les réservations expirées par lots de 25, avec un parcours stable de tous les lots avant une nouvelle tentative sur les paiements bloqués. Une date limite fixée au début du cycle empêche les nouvelles expirations de prolonger indéfiniment ce cycle. Un redémarrage reprend le parcours depuis le début sans restituer deux fois le stock. Le message `Reservation could not be cancelled; inventory retained for retry` indique un paiement à réconcilier : examiner son état chez le prestataire avant toute correction manuelle.

Les produits sans aucune variante sont signalés. Configurer leurs tailles/couleurs et quantités dans **Produits**. Une combinaison absente reste indisponible dans la boutique. Les modifications de description/prix seules préservent les ventes survenues depuis l’ouverture de l’éditeur. Si un enregistrement échoue sur le stock, les métadonnées du produit peuvent déjà être sauvegardées ; consulter le message et recharger avant de poursuivre.

## Périmètre

Gestion mono-stock par variante ; pas de lots, entrepôts, bons fournisseurs, import CSV ou alertes email automatiques. L’historique couvre les ajustements manuels, pas un journal comptable intégral des commandes. Le seuil n’est pas configurable par produit. Les transactions protègent les quantités concurrentes, mais une session déjà ouverte ne reçoit pas de diffusion temps réel : actualiser avant de faire un comptage.

La conservation de l’historique reste à intégrer à la politique d’exploitation : la suppression physique d’un acteur ou d’une variante conserve le mouvement avec la relation mise à NULL. Les notes doivent rester opérationnelles. Ne pas publier les données de test ou prendre les quantités de démonstration pour un inventaire commercial.
