# Recette de l’interface dans Chromium

**17 septembre 2026 — suite de [l’audit](AUDIT.md), des [correctifs](CORRECTIFS.md) et de la [deuxième passe](SUITE.md).** Chromium a été ouvert avec une fenêtre visible sur le bureau, puis piloté avec Playwright. Les tests utilisent PostgreSQL jetable, des comptes et commandes synthétiques, le frontend compilé en production et l’API en environnement de test.

## Périmètre

Deux nouvelles suites ajoutent 29 tests aux 67 parcours existants : [interface.spec.ts](../../../client/tests/e2e/interface.spec.ts) et [workflows.spec.ts](../../../client/tests/e2e/workflows.spec.ts). Six tests effectuent **66 visites** : 19 routes publiques, 8 routes client et 6 routes administrateur, chacune en 1440 et 390 pixels. Le cas 404 est inclus. La comparaison à trois produits est aussi contrôlée à 360 pixels ; les anciens contrôles couvrent notamment 768 pixels.

Playwright 1.58.2 utilise Chromium 145.0.7632.6, en mode avec fenêtre visible.

Les visites vérifient l’URL attendue, la présence durable de l’interface, les erreurs JavaScript et React, les réponses HTTP 5xx, les images cassées après défilement, les débordements horizontaux et les règles axe WCAG 2 A/AA, 2.1 AA et 2.2 AA. Les captures couvrent les contenus chargés au défilement. Un écran de secours React ne peut plus être pris pour une page fonctionnelle.

Les actions passent par les formulaires et boutons du navigateur ; la base sert à préparer des fixtures puis à vérifier la persistance :

- Inscription et confirmation d’email, connexion/déconnexion et restauration de session ; changement et récupération de mot de passe, rejet d’un lien réutilisé, suppression d’un compte synthétique.
- Activation MFA depuis le profil, authentification TOTP, connexion avec code de secours en minuscules, refus de réutilisation du code, désactivation et nouvelle connexion.
- Profil, préférences email, création/modification/défaut/suppression d’adresse, favoris et conversion des points de fidélité en coupon.
- Filtres combinés, tri, conversion de devise et suppression individuelle des filtres ; recherche, effacement et changement de requête, réponses réseau dans le désordre, panne simulée puis réessai ; comparaison de produits, quantité du panier, coupon valide/invalide et facturation distincte.
- Création/modification/suppression d’avis ; création/modification/suppression de produit et stock ; modération d’avis ; transitions d’une commande payée jusqu’à la livraison et historique enregistré.
- Contact, consentement newsletter, confirmation puis désabonnement à partir des liens conservés dans l’outbox locale.
- Menus, recherche, guide des tailles et dialogues au clavier ; fermeture par Échap et retour du focus ; interface française, cookies et mouvement réduit dans les suites existantes.

## Correctifs issus de la navigation

| Défaut | Correction |
|---|---|
| Recherche conservant des résultats après effacement, ou remplacés par une réponse ancienne | Champ contrôlé, synchronisation avec l’URL, invalidation des réponses obsolètes et réessai explicite après erreur |
| Frais de livraison calculés par différence avec le sous-total malgré une remise | Utilisation du montant enregistré, ligne de remise distincte et étape « Paid » dans le suivi |
| Codes de secours rejetés par le formulaire de connexion | Acceptation des TOTP et des codes de secours, libellés adaptés ; l’API conserve leur consommation unique |
| Gestion MFA annoncée mais absente du profil | Commandes d’activation et de désactivation, vérification du facteur et nouvelle connexion après changement |
| Fenêtre MFA peu utilisable sur petit écran | Hauteur bornée, défilement, rendu hors des conteneurs transformés et retrait du toast qui recouvrait le bouton de fermeture |
| Lecture d’un portefeuille vide créant un client Stripe | Retour vide sans appel au prestataire lorsqu’aucun client Stripe n’existe |
| Paiement et ajout de carte encore proposés sans clé publique | Actions désactivées, message explicite et garde avant création de commande |
| Administration des avis plantant avec des données réelles | Interface alignée sur `productName` renvoyé par l’API |
| Filtre administratif par note ignoré | Validation de la note, filtrage en base et pagination/count cohérents |
| Contrôles sans nom ou champs sans association de label | Profil, préférences, adresses, quantité produit, administration, images et facturation corrigés |
| Dialogues incomplets au clavier | Noms accessibles, focus contenu dans le dialogue, fermeture et restauration du focus |
| Contrastes insuffisants dans le suivi et les remises | Couleurs de texte renforcées ; vérification dans les états avec remise |
| Chaînes manquantes et information incohérente | Traductions des commandes, prix admin en CAD, description de suppression conforme à la désactivation puis anonymisation différée |
| Numéros de commande longs débordant de la page admin mobile | En-tête et actions autorisant plusieurs lignes ; scénario de livraison exercé à 390 pixels |
| Filtres actifs sans nom accessible sur les boutons de retrait | Libellé incluant le filtre supprimé et cible de clic agrandie |
| Comparaison chargée sur écran étroit | Disposition adaptée à trois produits et boutons de suppression accessibles |

## Validation finale

| Contrôle | Résultat final |
|---|---|
| Playwright Chromium avec fenêtre visible, 2 workers | **96 / 96 réussis**, 0 échec, 0 ignoré, 0 flaky ; 4 min 14 s |
| Visites publiques/client/admin en 1440 et 390 pixels | **66 / 66 validées** |
| Images cassées, erreurs React/JavaScript, réponses 5xx, débordements sur ces visites | **0 détecté** |
| Violations axe sur les règles exécutées dans ces visites | **0 détectée** |
| Build TypeScript/Vite optimisé et lint serveur/client | Réussis |
| Runtime local | Readiness 200 ; JavaScript servi identique au build présent sur disque |

Les [preuves](preuves-interface/) contiennent les journaux, le détail des tests, les résultats par route, la couverture et les empreintes SHA-256 des sources, du build et des captures. Les résultats intermédiaires restent dans `artifacts/browser-20260916/` : le premier passage avait 9 échecs sur 12 nouveaux tests, puis la première suite complète a révélé le débordement mobile (94/95). Les corrections ont été revalidées avant le passage final 96/96.

Les tests serveur finaux comptent **419 tests réussis dans 29 suites**, avec une couverture de 87,69 % des lignes, 86,39 % des statements, 73,21 % des branches et 82,38 % des fonctions. Compilation TypeScript/Vite et ESLint serveur/client réussis.

## Reproduction et consultation

Suivre les commandes du [README](../../../README.md#vérifications-reproductibles) depuis la racine du dépôt, avec une base jetable. `npm run build:test` compile avec `NODE_ENV=production` et sans clés Google/Apple/Stripe, même si `client/.env` en contient. Le processus API de recette utilise ensuite `scripts/test-env.cjs`. Cela évite à la fois d’activer le panneau de développement dans le navigateur et de charger involontairement la configuration des prestataires locaux. La CI et Lighthouse utilisent ce build isolé.

Pour voir les fenêtres pendant la recette, ajouter `-- --headed --workers=2` à la commande Playwright. Le rapport HTML, avec les 66 captures attachées aux étapes, est dans `client/playwright-report/`, les captures par route dans `client/test-results/` et les six captures de la fenêtre Chromium pilotée dans `artifacts/browser-20260916/visible-*.png`.

L’interface locale reste accessible sur **http://127.0.0.1:3107** et le rapport sur **http://127.0.0.1:9323**. Les deux onglets sont ouverts dans Chromium. Le conteneur `blessp-browser-20260916-db` ne contient que les données synthétiques de cette recette.

## Limites

Ces parcours ne couvrent pas toutes les combinaisons possibles de données, navigateurs ou appareils. Les contrôles axe et clavier ne remplacent pas un audit manuel complet avec lecteurs d’écran et matériels réels.

Les commandes payées sont des fixtures : aucun paiement, remboursement ou email réel n’est effectué. Le scénario des cartes enregistrées intercepte explicitement les réponses du prestataire pour tester les contrôles visuels ; il ne valide pas Stripe. Les liens email proviennent de l’outbox locale, sans test de réception. OAuth Google/Apple, Stripe/3DS, délivrabilité, services déployés et exigences métier restent à valider en staging, comme détaillé dans [PRODUCTION_READINESS.md](../../PRODUCTION_READINESS.md).

Les résultats Docker, scans de sécurité et Lighthouse des passes précédentes sont historiques ; ils ne sont pas présentés comme de nouvelles mesures de ce build.
