# Fluidité et croissance du catalogue — 17 septembre 2026

Cette passe améliore les interactions de la boutique, la fiche produit et le calcul des filtres. Elle prolonge [la recette multi-navigateurs](APPROFONDISSEMENT.md). Les mesures portent sur le build optimisé local et des données synthétiques ; elles ne constituent pas un test de capacité de la production.

## Comparaison mesurée

| Cas | Avant | Après |
| --- | --- | --- |
| Saisie de « 123 » dans le prix minimum, 80 ms entre frappes | 3 requêtes produits | 1 requête produits |
| Cartes présentes pendant cette saisie | 0, grille remplacée par les squelettes | 8, grille conservée |
| Chargement des facettes par visite boutique | 2 appels, un par panneau | 1 appel partagé |
| Pagination de 1 000 pages à 320 px | 1 000 boutons, dépassement horizontal de 16 093 px | 5 boutons, aucun dépassement |
| Démarrage des variantes après la requête produit, avec 200 ms de délai réseau simulé | 210 ms | 0 ms |
| Calcul des facettes sur 10 000 produits réels en PostgreSQL, médiane de 10 passages | 57,09 ms | 13,87 ms |
| Lignes renvoyées par PostgreSQL pour les facettes | 10 000 | 1 ligne agrégée |

La mesure navigateur ajoute 250 ms aux requêtes de liste et 200 ms aux requêtes produit/variantes, dans Chromium 145.0.7632.6. Le script ouvre deux fois la boutique : les JSON comptabilisent donc **4 puis 2** appels de facettes au total. Le cas de pagination utilise une réponse simulée avec 12 000 produits et 1 000 pages. Les tests de non-régression vont jusqu’à 10 000 pages simulées, soit 120 000 produits déclarés, sans prétendre charger ces produits réels dans le navigateur.

Le benchmark serveur utilise un schéma PostgreSQL temporaire contenant **10 000 vrais enregistrements synthétiques**, supprimé en fin d’exécution. Il alterne l’ancienne agrégation JavaScript et la nouvelle requête SQL, avec cache PostgreSQL chaud, sans Redis, et vérifie l’équivalence des résultats. Les durées ne mesurent ni un pic de trafic concurrent, ni une infrastructure distante. La représentation JSON des données renvoyées passe de 831 601 à 139 octets ; ce sont des tailles de sérialisation, pas une mesure du protocole réseau PostgreSQL.

## Correctifs

- **Prix** : saisie immédiatement reflétée dans le champ et l’URL, temporisation de 300 ms avant l’appel. Les frappes remplacent l’entrée courante de l’historique. Catégories, couleurs, tailles et tri restent immédiats.
- **Réseau** : annulation des lectures devenues inutiles et garde empêchant une réponse obsolète d’écraser la sélection courante. Le client API transmet aussi le signal d’annulation lors d’une nouvelle tentative après renouvellement de session. La recherche et les produits associés utilisent également cette annulation.
- **Grille** : conservation des cartes pendant une actualisation, indicateur de chargement et `aria-busy`, maintien du contenu en cas d’échec, bouton de nouvelle tentative. Suppression du remontage et de l’animation en cascade à chaque changement de filtre ; les effets de survol restent présents.
- **Filtres** : chargement unique pour les panneaux mobile et bureau ; URL utilisée comme source de vérité, notamment lors de Précédent/Suivant. Correction de « Voir tous les produits », qui écrasait partiellement la remise à zéro des filtres. Messages d’erreur en français et anglais. Ordre vestimentaire des tailles conservé dans les contrôles, indépendamment de l’ordre des facettes SQL.
- **Pagination** : au maximum cinq boutons numérotés, ellipses, retour à la ligne si nécessaire, libellés accessibles et `aria-current`. Le nombre de nœuds ne croît plus avec le nombre total de pages.
- **Fiche produit** : démarrage simultané des requêtes produit et stock. Annulation et remise à zéro des suggestions lors des changements de produit. Le chargement du stock reste terminé avant l’affichage des contrôles d’achat.
- **PostgreSQL** : calcul des facettes dans la base, sans transfert de tout le catalogue vers Node et sans `Math.min(...prices)` sur une liste non bornée. Les tableaux de couleurs et de tailles sont agrégés séparément pour éviter leur produit cartésien. Exclusion des brouillons et produits supprimés conservée.
- **Tri serveur** : identifiant ajouté comme critère final pour garantir des frontières de pages déterministes lorsque les prix ou dates sont identiques, à catalogue inchangé.

## Validation

Les huit nouveaux scénarios Playwright ont passé leurs **24 exécutions** sur Chromium, Firefox et WebKit. Ils vérifient le chargement unique, la temporisation, la conservation effective du même nœud DOM, l’annulation, l’ordre des réponses, l’historique, les erreurs et nouvelles tentatives, la pagination à 320 px avec axe, la remise à zéro et le chargement parallèle du stock.

Les **425 tests serveur** passent, dans 30 suites. Trois nouveaux tests d’intégration couvrent les facettes distinctes avec exclusions et prix zéro, le catalogue vide, et la pagination avec dates/prix identiques. Couverture des lignes : 87,77 %. Build TypeScript/Vite et lint réussis.

La régression complète du build final passe : **366/366 exécutions**, soit 122 scénarios sur chacun des trois moteurs, en 12,5 minutes, sans échec, test ignoré ou nouvelle tentative. Elle reprend notamment inscription, connexion, MFA, panier, checkout local, compte, administration, responsive et accessibilité.

Les [mesures avant](preuves-fluidite/browser-before.json), [après](preuves-fluidite/browser-after.json), le [benchmark PostgreSQL](preuves-fluidite/catalogue-10000.json), le [résumé Playwright](preuves-fluidite/playwright-summary.json) et les empreintes de sources/build sont conservés dans [preuves-fluidite](preuves-fluidite/). La première recette interrompue volontairement pour remettre les tailles dans l’ordre est conservée dans les artefacts locaux et n’est pas comptée comme une recette complète. Les mesures finales ont été prises après la fin des tests navigateur.

## Reproduction

Le serveur local doit servir le build de `npm run build:test`, dans la base isolée configurée par `scripts/test-env.cjs`. Il faut le redémarrer après un rebuild car il garde le document HTML en mémoire.

```sh
node scripts/measure-catalogue.cjs artifacts/performance/catalogue-browser.json
TEST_DATABASE_URL="$LOCAL_TEST_DATABASE_URL" node scripts/test-env.cjs \
  node scripts/benchmark-catalogue.cjs artifacts/performance/catalogue-server.json

TEST_DATABASE_URL="$LOCAL_TEST_DATABASE_URL" E2E_BASE_URL=http://127.0.0.1:3107 \
  E2E_CROSS_BROWSER=1 node scripts/test-env.cjs npm --prefix client run test:e2e
```

`LOCAL_TEST_DATABASE_URL` doit désigner une base locale terminée par `_test`, `_audit` ou `_ci`. Le benchmark refuse les autres cibles. Les dépendances natives des trois navigateurs doivent être installées ; le contournement local sans sudo utilisé dans cette session est décrit dans [APPROFONDISSEMENT.md](APPROFONDISSEMENT.md).

## Limites

Les listes restent paginées à 12 produits dans la boutique et le nombre de contrôles de pagination est borné. Le calcul SQL des facettes continue de parcourir les produits actifs : cette passe réduit fortement les échanges et allocations dans Node, sans rendre ce calcul constant. La pagination serveur utilise encore OFFSET et COUNT ; des volumes bien supérieurs et des écritures concurrentes demanderaient des mesures propres, puis éventuellement une pagination par curseur et des index adaptés aux requêtes observées.

Pas de nouveau cache navigateur de prix ou de stock. Aucun changement de prestataire, déploiement, achat, envoi réel d’email ou nouvelle dépendance nécessaire pour ces optimisations. Les validations externes et sur appareils physiques mentionnées dans la recette précédente restent distinctes.
