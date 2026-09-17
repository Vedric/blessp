# Gestion des stocks — 17 septembre 2026

La gestion des stocks était utile : le serveur réservait déjà les unités à la commande, mais l’administration n’offrait ni vue d’inventaire ni historique des corrections. L’ancien éditeur renvoyait également toutes les quantités lors d’un simple changement de nom ou de prix, ce qui pouvait rétablir des unités vendues depuis son ouverture.

## Changements

- Page `/admin/inventory`, liens depuis le tableau de bord, la liste et l’éditeur de produits. Recherche différée et annulable par nom/SKU ; filtres disponible/faible/rupture ; pagination de 25 variantes ; totaux sur les résultats filtrés et signalement des produits sans variante.
- Ajustement de la quantité disponible finale, avec motif et note facultative. Contrôle du stock attendu au moment de l’écriture ; un conflit demande une relecture et une nouvelle vérification. Quantités entières entre 0 et 1 000 000 pour les saisies manuelles.
- Historique transactionnel des ajustements : auteur, date, motif, note et avant/après, paginé par dix dans l’interface. Les snapshots produit/taille/couleur sont conservés si la variante est supprimée physiquement. Aucun faux historique n’est créé pour le stock existant.
- UUID d’opération réutilisé lors d’une reprise identique après erreur réseau. L’écriture et son historique sont atomiques ; deux reprises ne créent pas deux mouvements. Réutiliser la clé avec un contenu différent est refusé.
- Éditeur de produit : seules les quantités nouvelles ou modifiées sont envoyées. Un lot obsolète est entièrement annulé ; les options et doublons sont validés. Si la création du produit réussit avant un échec sur ses variantes, son identifiant est conservé pour la reprise dans le même formulaire.
- Dialogue natif modal : arrière-plan inactif, confinement du focus, fermeture par Échap, restitution du focus et verrouillage du défilement. Cette correction a suivi un échec axe sur l’arrière-plan du premier dialogue à 320 px. Interface et messages FR/EN. La revue des captures a également conduit à réserver une ligne entière à la recherche sur petit écran ; un contrôle de largeur complète désormais le contrôle de débordement.
- Migration additive `20260917000000_inventory_adjustments`, contrat OpenAPI et [guide d’exploitation](../../runbooks/011-inventory.md). Les PUT de variantes existantes exigent désormais `expectedStock` ; les variantes omises sont conservées.

## Vérifications

Tests réalisés contre PostgreSQL isolé et le build optimisé, sans envoi d’email ni paiement réel. Les fixtures d’inventaire utilisent leurs propres produits et comptes administrateurs.

- 12 nouveaux tests d’intégration : autorisations sur toutes les routes, recherche/filtres/pagination, historique, idempotence séquentielle et concurrente, validation et conflits, deux inventaires concurrents, commande concurrente, rollback des lots, création des variantes et conservation des snapshots.
- 10 nouveaux scénarios Playwright : ajustement et historique, conflit/relecture, vente pendant un changement de métadonnées, stock modifié dans un éditeur obsolète, réponse perdue/reprise, rupture et réapprovisionnement, FR à 320 px avec axe, accès client refusé, pagination de l’inventaire/historique, panne de lecture et reprise.
- Les 30 exécutions ciblées passent sur Chromium, Firefox et WebKit. Le test réseau fait volontairement disparaître la réponse après la véritable écriture serveur, puis vérifie l’unicité du mouvement à la reprise.
- Les 437 tests serveur passent dans 31 suites : couverture des lignes 88,09 % au total, 100 % sur le nouveau module d’inventaire (94,44 % des branches). Lint et compilation réussissent ; OpenAPI validé avec Swagger Parser ; parité des 894 clés FR/EN vérifiée.

La régression générale du dernier build passe : **456/456 exécutions**, soit **152 scénarios sur chacun des trois moteurs**, en 14,3 minutes, sans échec, test ignoré ou nouvelle tentative. Une première régression avait été arrêtée volontairement pour corriger la largeur du champ de recherche mobile ; ces exécutions interrompues ne sont pas incluses dans ce résultat final. Les journaux de travail sont dans `artifacts/inventory-20260917/`.

Les [résultats navigateur](preuves-stocks/browser-results.json), [résultats serveur](preuves-stocks/server-full.log), [migrations locales](preuves-stocks/migrations.json), [empreintes du build](preuves-stocks/build-proof.json), [capture bureau](preuves-stocks/inventory-desktop-fr.png) et [capture mobile](preuves-stocks/inventory-mobile-fr.png) sont conservés avec un manifeste SHA-256. Le build testé charge `/assets/index-DNhNZuiy.js`. La migration a été appliquée uniquement aux bases locales isolées.

## Limites opérationnelles

Stock unique par variante, seuil faible fixé à 1–5, historique des ajustements manuels uniquement. Les réservations et restitutions automatiques restent dans le cycle des commandes déjà testé. Un remboursement ne remet pas automatiquement un article en stock. Aucun stock commercial n’est inventé ou rempli en production.

Pas de gestion multi-entrepôts, lots, commandes fournisseurs, import massif ou notifications de réapprovisionnement. L’actualisation est explicite, sans diffusion temps réel. La pagination et l’annulation des requêtes évitent de charger tout l’inventaire dans le navigateur ; elles ne constituent pas une certification de capacité de l’infrastructure cible. Réception des emails, Stripe/3DS, fournisseurs OAuth et appareils physiques restent soumis aux validations du [bilan de mise en production](../../PRODUCTION_READINESS.md).
