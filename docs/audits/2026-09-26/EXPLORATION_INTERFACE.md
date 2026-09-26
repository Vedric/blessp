# Exploration de l’interface avec une fenêtre visible

Une session Chromium graphique, pilotée par Playwright avec `headless: false`, a parcouru l’application compilée et une base PostgreSQL de test isolée. Les emails sont lus dans la boîte d’envoi locale ; aucun message externe ni paiement réel n’est envoyé.

## Parcours observé

- Accueil en français sur ordinateur, catégories et filtre de couleur.
- Galerie, deuxième photo, agrandissement et fermeture au clavier.
- Choix de la taille M, panier invité, quantité 1 → 2 → 1 et vérification des totaux.
- Inscription par le formulaire, confirmation différente bloquée, puis activation par le lien réellement généré.
- Connexion, proposition de double authentification différée, profil et fusion du panier invité.
- Checkout à 320 px, adresse à Montréal, Canada comme seule destination et récapitulatif sans débordement.
- Menu mobile, recherche, ouverture du produit et ajout aux favoris.
- Déconnexion, refus d’accès au profil et absence de reconnexion après rechargement.

Aucune erreur JavaScript ni réponse serveur 500 n’a été observée dans ce parcours. Deux requêtes interrompues sont conservées dans la trace : une vidéo lors du changement de page et la déconnexion lors d’une navigation immédiate. Le contrôle du profil après rechargement reste réussi. Les erreurs de pilotage initiales, telles qu’une cible Courriel ambiguë avec la newsletter ou un clic derrière la proposition MFA, sont distinguées des défauts applicatifs ; les interactions sont ensuite effectuées dans le bon formulaire et après fermeture du dialogue.

Le paiement est explicitement désactivé dans cet environnement sans prestataire configuré. Le tarif affiché reste une valeur de démonstration, sans validation commerciale. Le compte synthétique, ses données liées et ses emails locaux sont supprimés après l’exploration.

## Correction issue de l’exploration

Plusieurs contrôles restaient en anglais lorsque la page était en français : navigation, langue/devise, fermeture du panier et quantités, recherche, guide des tailles, fil d’Ariane, retour en haut, comparateur, étoiles d’avis, partage et affichage du mot de passe à la connexion. Le séparateur de prix affichait aussi « to ».

Ces textes utilisent désormais les traductions FR/EN, y compris les noms accessibles et les infobulles. Les noms, couleurs et descriptions du catalogue restent des données commerciales à valider.

Deux parcours de régression à 320 et 1440 px changent réellement de langue, recherchent un produit, ouvrent le guide, modifient le panier et vérifient sa conservation. Ils contrôlent aussi que changer de langue dans le formulaire de connexion conserve le mot de passe saisi et traduit les commandes afficher/masquer.

Le défaut est reproduit deux fois avant correction. Après correction, les deux parcours réussissent trois fois sur chacun des moteurs Chromium, Firefox et WebKit, soit 18 exécutions sans relance. Compilation et lint réussissent. Une seconde campagne avec fenêtre visible et un seul worker réussit 24 parcours Chromium, dont les nouvelles régressions, la navigation, les liens email et la gestion des photos produit. Les fenêtres se ferment à la fin des tests. Les tests bilingues existants utilisent désormais les noms accessibles propres à leur langue.

Les traces, captures, journaux et rapports sont dans `artifacts/exploration-20260926/`. Les exécutions CI de la PR correspondante font foi pour la révision finale. Les validations externes encore nécessaires figurent dans la [checklist de lancement](../../LAUNCH_CHECKLIST.md).

La CI après fusion de la PR #74 a ensuite refusé une intermittence WebKit : le test tentait de cliquer le sélecteur de langue de l’en-tête alors que celui-ci était masqué après défilement. La capture et la trace sont conservées dans `ci-main74-webkit-failure/`. Le parcours remonte désormais la page avec la molette et vérifie l’en-tête dans la zone visible avant le clic. Il descend aussi explicitement en bas du formulaire avant le second changement de langue pour exercer cette situation à chaque passage. Les assertions de langue, de panier et de mot de passe restent présentes, sans délai augmenté ni clic forcé.

Le parcours renforcé réussit ensuite cinq répétitions pour chaque largeur et chaque moteur, soit 30 exécutions sans relance.

La première CI de la PR #75 a aussi signalé une page blanche Firefox lors d’une revisite produit après l’audit du comparateur. La trace montre un document texte vide à la suite d’une réponse HTTP 304, sans démarrage de React. Soixante revisites locales avec l’ancien code ne reproduisent pas la page blanche ; sa cause précise reste incertaine.

L’enquête révèle toutefois une incohérence reproductible de cache : la réponse compressée 200 contient `Vary: Origin, Accept-Encoding`, mais la réponse 304 perd `Accept-Encoding`. Le middleware préserve désormais cette variante avant le filtre de compression, conformément aux [en-têtes attendus sur une réponse 304](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/304). Deux tests HTTP échouent avant correction et passent ensuite ; ils vérifient HTML et JS, GET/HEAD conditionnels, ETag, cache-control, corps vide 304 et contenu complet sans compression. Un parcours navigateur exige le rendu et les commandes de la fiche à chaque revisite et rechargement, avec le cache actif. Le correctif HTTP n’est pas présenté comme une preuve de la cause de la page blanche.

Après le correctif HTTP, les inspections publiques à 390/1440 px et le parcours de revisites réussissent deux fois sur chacun des trois moteurs : 18 exécutions sans retry, en 5,7 minutes. Les 542 tests serveur passent, ainsi que le lint et la compilation. Les résultats CI de la révision finale restent la référence avant fusion.

Une autre intermittence Firefox concerne ensuite le contrôle visuel d’un profil dans le premier de trois onglets. Les trois `/auth/refresh` et `/auth/me` réussissent, mais ce premier onglet reste sur le chargement jusqu’à la fermeture des autres onglets pendant le nettoyage ; le profil attendu est alors visible dans le snapshot final. Le scénario vérifie désormais explicitement les trois réponses de profil et leur identité pendant les navigations simultanées, puis active chaque onglet avant ses assertions visuelles. La propagation de déconnexion, l’effacement du checkout, le refus après rechargement et la révocation des tokens restent exigés, sans hausse de délai ni de retry. La trace est conservée dans `ci-pr75-cache-firefox-failure/`.

Ce parcours à trois onglets réussit ensuite dix fois sur chacun des trois moteurs, soit 30 exécutions sans retry en 1,5 minute. Le lint reste vert.

Le passage suivant de la CI capture encore un `page.reload()` Firefox bloqué après déconnexion, alors que les ressources du formulaire de connexion sont reçues et que la page est rendue. La trace `ci-pr75-d5-firefox-failure/` conserve cette attente de `domcontentloaded`. Ce symptôme est compatible avec le [défaut de navigation du pilote Firefox](https://github.com/microsoft/playwright/issues/42731), corrigé dans le [pilote r1551](https://github.com/microsoft/playwright/commit/e5d880b05f9a1d7fb5d17dd031b53739e5e39c0e) : chaque canal reçoit désormais un identifiant unique, évitant les collisions après remplacement du contexte de navigation.

L’outillage de test est figé sur `@playwright/test` **1.64.0-alpha-2026-09-26**, une préversion contenant ce correctif, vérifié directement dans les archives des deux Firefox. Le paquet publié comme stable au moment de cette vérification est 1.63.0 et ne contient pas ce pilote. Il faudra remplacer cette version datée par une stable 1.64 ou ultérieure contenant le correctif après sa publication et validation. Aucun réglage COOP, header de sécurité, cache, retry ni assertion n’est désactivé. Cette dépendance ne fait pas partie du code livré au navigateur client. Deux séries minimales de 200 essais chacune passent sur l’ancien et le nouveau pilote ; le petit reproducer local ne prouve donc pas à lui seul l’origine des incidents CI. Les vrais parcours et la matrice complète restent nécessaires.

Avec cet outillage corrigé : 72 contrôles ciblés de langues et de résilience de session passent (24 par moteur), puis neuf parcours d’inspection publique et de revisite passent sur les trois moteurs en 3,6 minutes. Les vérifications publiques incluent images, débordement et axe. Les 24 premiers démarrages WebKit avaient échoué faute de bibliothèque locale avant toute navigation ; ils sont conservés et la campagne WebKit est rejouée après installation de ses dépendances. Le lint et l’audit npm du client passent, sans vulnérabilité signalée.

La première matrice avec ce pilote rencontre ensuite un échec de mesure Lighthouse `NO_NAVSTART` sur la connexion, après deux audits réussis. Ce message indique une trace de navigation inutilisable, sans établir un défaut du formulaire. Le même script passe localement les quatre pages : l’incident reste intermittent. Le script utilise désormais un processus et un profil Chromium distincts pour chaque mesure, afin d’isoler l’état de l’enregistreur, des renderers et du cache entre routes. Les rapports HTML/JSON, la trace Chromium et le journal DevTools sont écrits avant de refuser un `runtimeError` ; aucun retry automatique ni seuil réduit. Le précédent résumé est retiré au démarrage pour qu’un échec ne laisse pas paraître un ancien résultat réussi. Chaque navigateur et profil sont nettoyés dans `finally`. Les preuves initiales sont dans `ci-pr75-driver-lighthouse-failure.log` ; les campagnes locales sont dans `lighthouse-isolated-*`. Cette isolation réduit les interactions entre mesures, sans prétendre démontrer la cause de l’enregistrement perdu.

Les deux campagnes isolées de quatre mesures passent localement, avec huit traces contenant leurs événements de navigation. Les budgets restent identiques : accessibilité ≥ 90, bonnes pratiques ≥ 90, SEO des pages publiques ≥ 85 ; la connexion conserve volontairement `noindex`. Le lint et les 20 tests de scripts passent. Le score de performance mobile mesuré à 78 reste un résultat de laboratoire à améliorer et à vérifier sur le futur hébergement, sans promesse de performance en production.
