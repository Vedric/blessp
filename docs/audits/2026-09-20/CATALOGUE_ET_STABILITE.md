# Catalogue et stabilité des parcours — 20 septembre 2026

## Corrections

- Livraison de démonstration limitée au Canada et FAQ FR/EN alignée sur ce périmètre. Les tarifs restent à valider commercialement.
- Inventaire des huit fiches et treize photos produit déjà présentes dans le dépôt : voir [le catalogue existant](../../CATALOGUE_EXISTANT.md). Les tailles, prix et quantités du seed ne constituent pas un inventaire physique.
- Les filtres de prix conservent les frappes rapides pendant les transitions du routeur. La pagination change ensemble ses couleurs de texte et de fond pour conserver le contraste.
- Les fenêtres prennent le focus avant leur affichage et le rendent après la mise à jour du DOM. La galerie ne perd plus sa première flèche ; le menu mobile rend le focus au bouton d’ouverture.
- La vérification d’e-mail lit le jeton du lien courant, même lorsque cette page est déjà ouverte. Les parcours attendent la fin de la vérification avant la connexion ; les liens invalidés, expirés et réutilisés restent refusés.
- Les recommandations affichent les prix individuels de l’API. La remise d’ensemble de 10 % auparavant annoncée sans calcul serveur et l’ajout implicite d’une première variante ont été retirés. Le client ouvre la fiche recommandée pour choisir ses options et ajouter l’article.
- Les titres longs, le fil d’Ariane et les cartes associées restent dans la largeur d’un écran de 320 pixels, y compris sous Firefox.

## Vérifications locales

| Périmètre | Résultat observé |
| --- | --- |
| Filtres, pagination, authentification et navigation avant le correctif du focus | 18 cas ciblés puis 45 exécutions répétées, tous réussis sur trois navigateurs |
| Focus de la galerie, menus mobiles, filtres, recherche et guide des tailles | 54 exécutions, dont répétitions, réussies sur Chromium, Firefox et WebKit |
| Inscription FR/EN, liens de vérification, isolation des comptes, MFA, adresses et dialogues administratifs | 45 cas réussis sur trois navigateurs après les correctifs du focus et des liens |
| Recommandations, prix, taille indisponible, panier, checkout et panne de recommandation | 9 cas réussis, puis 9 à nouveau après intégration des correctifs précédents |
| Compilation et analyse statique | Réussies ; aucune reprise automatique dans les campagnes locales ci-dessus |

Les 54 et 45 exécutions ciblées portent sur les modifications de `d67fa2b`. La recette combinée du catalogue porte sur `5836d0b`. Ces nombres ne désignent pas autant de scénarios distincts : les répétitions et les navigateurs multiplient les exécutions. Les rapports locaux figurent dans `artifacts/dialog-focus-20260920/`, `artifacts/dialog-auth-20260920/` et `artifacts/catalogue-integrated-20260920/` ; ces répertoires générés ne sont pas versionnés. Les navigateurs et le serveur de recette ont été fermés après les campagnes.

Les résultats de la matrice complète, les journaux et les révisions distantes sont attachés aux [PR #68](https://github.com/Vedric/blessp/pull/68) et [PR #69](https://github.com/Vedric/blessp/pull/69). Les tests instables restent bloquants en CI. Un résultat ciblé local ne vaut pas validation de la matrice distante ni autorisation d’ouverture commerciale.

## Décisions et services encore nécessaires

Le propriétaire confirme Montréal, la livraison initiale au Canada, une entreprise encore en projet et l’absence de budget ou de comptes fournisseurs. Il reste notamment à compter le stock réel, valider les prix, décider si les ensembles utilisent les mêmes pièces que les ventes à l’unité, définir livraison/retours et faire préciser le traitement fiscal avant son implémentation.

Les photos actuelles suffisent pour poursuivre la préparation locale. Aucun abonnement ni déploiement commercial n’a été effectué. Les moyens de paiement et les connexions externes nécessitent encore des comptes de test, un domaine et une recette auprès des vrais fournisseurs. La [checklist de lancement](../../LAUNCH_CHECKLIST.md) conserve les critères de clôture et le [guide pas à pas](../../GUIDE_LANCEMENT.md) décrit leur ordre de traitement.
