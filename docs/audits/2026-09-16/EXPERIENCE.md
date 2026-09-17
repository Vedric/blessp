# Interface et continuité des parcours — 17 septembre 2026

Cette passe modernise la boutique et corrige des parcours incomplets. Elle prolonge [l’audit fonctionnel multi-navigateurs](APPROFONDISSEMENT.md) et [les optimisations mesurées](FLUIDITE.md). Les essais utilisent le build optimisé, une API réelle et PostgreSQL isolé. Les pannes et les états difficiles à reproduire utilisent des réponses contrôlées explicitement dans les tests.

## Changements livrés

- **Accueil** : composition éditoriale crème/noir, typographie ample, photos et vidéo de la marque conservées, entrées par collection et accès au guide des tailles, au suivi de commande et à la FAQ. Quatre produits mis en avant au maximum ; chargement, catalogue vide et panne traités. Vidéo désactivée sur petit écran, économie de données et préférence de mouvement réduit ; arrêt lors du passage au format mobile. Sélection et chargement explicites de la source différée pour éviter un démarrage intermittent en pause dans Chromium.
- **Catalogue et recherche** : cartes produit partagées, chargement différé des images, lien et prix conservés en cas de photo cassée. Recherche paginée au-delà des 24 premiers résultats, URL et historique conservés. Pagination bornée à cinq boutons numérotés avec cibles de 44 px. Liens de catégorie du pied de page acceptés quelle que soit la casse. Emplacement des filtres réservé dès le premier rendu : leur arrivée différée ne décale plus la grille ni la barre d’outils.
- **Fiche produit** : galerie agrandie avec miniatures, zoom, flèches, navigation clavier, fermeture par Échap et restitution du focus. Quantité plafonnée au stock de la variante choisie. Une variante absente est indisponible ; une panne de lecture du stock bloque l’achat et propose de réessayer. Les dates de livraison calculées arbitrairement ont été remplacées par un renvoi aux options confirmées au checkout.
- **Données de démonstration** : variantes ajoutées au seed hors production. La relance conserve les stocks existants ; elle ne remet pas les quantités vendues à leur valeur initiale. Le seed de production continue de ne pas créer de catalogue de démonstration.
- **Compte** : après connexion, retour à la route protégée initialement demandée. Les destinations externes ou vers les formulaires d’authentification sont rejetées. La destination est également utilisée après les branches OAuth/MFA ; les fournisseurs OAuth réels restent à valider en staging.
- **Suivi invité** : formulaire adapté au mobile, erreurs visibles, états de paiement traduits, étapes de préparation/livraison, remboursements et accès au support. Pas de requête supplémentaire à une route réservée aux clients connectés.
- **Pied de page** : accordéons mobiles réellement masqués pour le clavier, newsletter avec erreur persistante, saisie conservée et protection contre les doubles soumissions. Le succès demande honnêtement de confirmer l’adresse email. Les préférences cookies peuvent être rouvertes et le consentement retiré avec effacement des produits récemment consultés. L’ouverture ou la fermeture manuelle annule le délai initial pour empêcher la bannière de réapparaître après un choix rapide.
- **Navigation et accessibilité** : lien FAQ relié à une vraie section focalisable, en-tête révélé au focus clavier, fil d’Ariane lisible et sans dépassement à 320 px, styles de focus et préférence de mouvement réduit. Libellés FR/EN des nouveaux contrôles.
- **Informations commerciales** : liens sociaux configurables vers de vrais profils uniquement, suppression des liens génériques et logos de paiement non vérifiés dans le pied de page. Les nouveaux textes ne promettent ni délai arbitraire ni livraison gratuite non confirmée.

## Matrice de vérification

| Domaine | Parcours couverts localement | Limite à conserver |
| --- | --- | --- |
| Identité | Inscription, confirmation via outbox locale, connexion, rechargement de session, déconnexion, changement/récupération du mot de passe, MFA et codes de secours, suppression du compte | Réception des emails et applications Google/Apple réelles |
| Catalogue | Catégories, filtres combinés, prix, tri, devise, historique, annulation des requêtes obsolètes, recherche paginée, panne/reprise et catalogue vide | Performance de l’infrastructure et taille réelle des médias à surveiller |
| Produit | Photos, galerie/zoom/clavier, tailles/couleurs, stocks disponibles/absents, plafonnement de quantité, favoris, comparaison et avis | Stock commercial réel à renseigner dans l’administration |
| Panier/checkout | Quantités, coupons valides/invalides, adresses, facturation distincte, contexte de paiement restauré et faux paramètres de succès rejetés | Paiement Stripe/3DS, moyens activés, remboursements et webhooks de staging |
| Commandes | Commandes membre, suivi invité avec vérification email, total/remise/livraison, historique et progression, états de remboursement | Transporteurs et règles de livraison commerciales |
| Compte | Profil, carnet d’adresses, préférences, fidélité, sécurité et moyens de paiement avec fixtures fournisseur explicites | Coffre fournisseur et cartes réelles |
| Administration | Création/modification/suppression de produits et stocks, commandes et transitions, modération des avis | Autorisations et exploitation dans l’environnement déployé |
| Support | Formulaire contact enregistré, FAQ, newsletter/confirmation/désinscription, retrait du consentement | Envoi réel, rebonds, coordonnées et politiques validées |
| Interface | Chromium/Firefox/WebKit, pages publiques/client/admin, clavier, axe, FR/EN, petits écrans et bureau, mouvement réduit | Appareils physiques et lecteurs d’écran ; WebKit local n’est pas Safari iOS sur iPhone |

## Résultats et preuves

La recette complète du dernier build passe : **426/426 exécutions**, soit **142 scénarios sur chacun des trois moteurs**, en 14,0 minutes, sans échec, test ignoré ou nouvelle tentative. Cette passe ajoute 19 scénarios d’expérience et un scénario de stabilité de la grille. Les 84 exécutions ciblées passent également. Les cinq scénarios vidéo ont passé 45 exécutions répétées, et les deux scénarios cookies 18 exécutions pendant le diagnostic ; ces répétitions ne sont pas comptées comme des scénarios distincts.

Les **425 tests serveur** passent dans 30 suites, avec 87,77 % de couverture des lignes. Lint et build TypeScript/Vite réussissent. La relance du seed conserve un stock volontairement diminué de 20 à 19, sans variante dupliquée ; la valeur d’origine est restaurée après cette vérification locale. Les deux traductions possèdent les mêmes **855 clés** (ce contrôle de parité ne remplace pas une revue linguistique).

Le test de grille retarde volontairement les facettes et vérifie la position horizontale et la largeur des cartes à 1440 et 390 px. La [mesure Lighthouse avant/après](preuves-experience/layout-stability.json) passe d’un CLS de **0,102 à 0** sur la boutique après réservation de l’espace des filtres. Les [mesures du catalogue](preuves-experience/browser-final.json) confirment aussi une requête pour la saisie « 123 », 8 cartes conservées pendant l’actualisation, un appel de facettes par visite (deux visites mesurées), cinq boutons pour 1 000 pages et aucun dépassement à 320 px. Les requêtes produit/stock démarrent ensemble dans le cas à 200 ms de délai simulé.

Lighthouse 13.4.1 est exécuté après les tests, sur l’API réelle et le build optimisé local. Ces scores sont des échantillons de laboratoire, sensibles à la machine et aux conditions d’exécution, et ne constituent pas un engagement de performance en production.

| Page | Performance | Accessibilité | Bonnes pratiques | SEO | LCP | CLS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Accueil bureau | 99 | 100 | 96 | 100 | 778 ms | 0.013 |
| Boutique bureau | 92 | 100 | 96 | 100 | 1918 ms | 0.000 |
| Connexion bureau | 100 | 100 | 96 | 66 | 715 ms | 0.000 |
| Accueil mobile | 86 | 100 | 96 | 100 | 3867 ms | 0.000 |

La connexion reste volontairement `noindex`, ce qui pénalise son score SEO. Les rapports Lighthouse complets sont conservés dans `artifacts/lighthouse/` ; leur [résumé final](preuves-experience/lighthouse-summary.json) accompagne les preuves.

Captures finales en français, préférence de mouvement réduit activée pour stabiliser l’image : [accueil bureau](preuves-experience/home-desktop-final.png), [accueil mobile](preuves-experience/home-mobile-final.png), [page complète](preuves-experience/home-full-final.png) et [galerie mobile](preuves-experience/gallery-mobile-final.png). Les captures de parcours supplémentaires restent dans `client/test-results/`, avec leurs empreintes dans les preuves.

Le [résumé Playwright](preuves-experience/playwright-summary.json), les sorties des contrôles, les empreintes des sources et du build, ainsi que la correspondance entre le JavaScript servi et le build local sont conservés dans [preuves-experience](preuves-experience/). `SHA256SUMS` permet de vérifier ces fichiers. L’espace de travail reste non commité ; le commit de base sert de repère historique, pas d’identifiant de livraison.

Les campagnes de diagnostic et les recettes précédentes sont conservées dans `artifacts/experience-20260917/`. Les exécutions interrompues ne sont pas présentées comme des recettes complètes. Une première recette de 423 exécutions était verte avant le dernier ajustement de stabilité des filtres ; le résultat de 426 ci-dessus porte sur le build final incluant cet ajustement.

## Reproduction

Utiliser une base locale jetable terminée par `_test`, `_audit` ou `_ci`, avec les navigateurs Playwright et leurs dépendances natives installés. `scripts/test-env.cjs` isole les données et désactive les prestataires externes. Le build optimisé de test ne reprend pas les clés publiques réelles de paiement ou de connexion sociale.

```sh
npm run build:test
npm run lint
TEST_DATABASE_URL="$LOCAL_TEST_DATABASE_URL" node scripts/test-env.cjs \
  npm --prefix server run test:coverage -- --maxWorkers=2
TEST_DATABASE_URL="$LOCAL_TEST_DATABASE_URL" E2E_CROSS_BROWSER=1 \
  node scripts/test-env.cjs npm --prefix client run test:e2e -- --workers=4
```

La dernière commande démarre son serveur local si `E2E_BASE_URL` n’est pas fourni ; libérer le port 3107 auparavant. Pour réutiliser un serveur isolé déjà lancé, fournir cette variable et le redémarrer après chaque compilation. Les mesures Lighthouse se font après les tests, avec `scripts/lighthouse.mjs` exécuté à travers le même environnement de test et le port 3107 libre. Les bibliothèques natives utilisées localement sous WSL sont décrites dans le rapport [d’approfondissement](APPROFONDISSEMENT.md).

## Éléments nécessitant des informations réelles

Les coordonnées légales (raison sociale, identifiant, adresse, téléphone et hébergeur) comportent encore des champs à compléter dans les traductions. Les liens sociaux attendent `VITE_INSTAGRAM_URL`, `VITE_TIKTOK_URL` et `VITE_FACEBOOK_URL` ; un lien absent ou invalide n’est pas affiché. Les pays, tarifs, délais de livraison, retours et règles fiscales doivent être confirmés par l’entreprise, puis confrontés aux textes et à la configuration serveur. Une question a été adressée au propriétaire pendant les travaux ; aucune valeur commerciale n’a été inventée pour la remplacer.

La disponibilité des services réels, les migrations sur une copie restaurée, sauvegardes, supervision et essais de charge restent ceux décrits dans [PRODUCTION_READINESS.md](../../PRODUCTION_READINESS.md). Un audit local et des tests verts ne permettent pas de garantir qu’aucun défaut n’existe.

Aucun déploiement, paiement, remboursement ou envoi externe n’a été réalisé. Le navigateur visible et le rapport local permettent de revoir la version testée.
