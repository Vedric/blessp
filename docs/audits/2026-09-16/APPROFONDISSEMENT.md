# Approfondissement des parcours et du responsive — 17 septembre 2026

Cette passe complète [la première recette de l’interface](INTERFACE.md). Elle répond notamment à la lacune des comptes préparés par fixtures : les nouveaux parcours créent réellement les comptes depuis le formulaire, utilisent le lien de confirmation enregistré dans l’outbox locale, puis se connectent depuis l’interface. PostgreSQL, les API et les sessions sont réels, dans une base jetable. Aucun email ni paiement externe n’est envoyé.

## Corrections issues des reproductions

| Défaut reproduit | Correction et contrôle |
|---|---|
| Inscription acceptée avec une confirmation de mot de passe vide | Validation obligatoire, message traduit, `aria-invalid`, association des messages aux champs et focus sur le premier champ invalide ; aucun appel d’inscription ni compte créé pour ce cas |
| Messages de force/confirmation et erreurs insuffisamment contrastés | Textes renforcés ; axe exécuté après saisie et après soumission invalide, pas seulement sur formulaire vide |
| Bouton d’inscription déplacé lors du blur du champ de confirmation | Espace réservé sans effondrement des marges et suppression du déplacement/zoom du formulaire ; contrôle de la stabilité du bouton |
| Interactions et focus perturbés par des mouvements automatiques sous WebKit | Suppression du défilement animé global ; animations de scroll conservées sur les actions explicites. Les contrôles produit apparaissent sans déplacement et la taille sélectionnée expose `aria-pressed` |
| Saisie immédiatement effectuée sur la page suivante puis effacée | Suppression de la transition sortante autour d’`Outlet`, qui montait puis démontait la nouvelle page ; test de conservation de la saisie et renvoi réel du lien |
| Panneau de filtres fixé à la barre floutée plutôt qu’au viewport | Portail vers `document.body`, contenu interne défilable et suppression du double verrouillage du scroll ; contrôle de sa position et de sa hauteur en paysage |
| Derniers liens et devise inaccessibles dans un menu mobile peu haut | Menu défilable, éléments non comprimés et listes de langue/devise ouvertes vers le haut ; interaction tactile à 667 × 320 |
| État et fermeture clavier incomplets des listes langue/devise | `aria-expanded`, `aria-controls`, fermeture Escape et restauration du focus |
| Page locale vide dans WebKit : ressources HTTP forcées vers HTTPS | CSP et HSTS adaptés à l’environnement ; HTTPS reste imposé en production. Trois tests vérifient les réponses après Helmet, en développement, test et production |
| Contraste de la description de collection trop proche du seuil | Texte renforcé, vérifié sur les différents moteurs |

## Nouveaux scénarios

18 scénarios sont ajoutés dans `client/tests/e2e/deep-ui.spec.ts` :

- Inscription EN et FR avec noms accentués, connexion refusée avant vérification, confirmation, connexion, cookie HttpOnly, nouvel onglet, rechargement, déconnexion et reconnexion.
- Panier invité créé depuis la fiche produit, conservé au rechargement, fusionné une seule fois dans le compte, retrouvé à la reconnexion ; coupon de bienvenue unique vérifié en base.
- Renvoi de confirmation, invalidation de l’ancien lien, expiration, refus de réutilisation, inscription répétée avec réponse neutre et compte unique.
- Erreur serveur simulée à l’inscription, conservation des champs et nouvelle tentative réussie.
- Adresse créée par formulaire puis réellement réutilisée au checkout ; second compte sans accès au panier ni aux adresses du premier.
- Six configurations : 320 × 568, 430 × 932, 844 × 390, 768 × 1024, 1024 × 768, 1920 × 1080. Huit routes par configuration : accueil, boutique, produit, inscription, connexion, contact, suivi et confidentialité. Contrôles de débordement, erreurs JavaScript, axe et captures. Menus et filtres ouverts aux dimensions pertinentes.
- Menu paysage tactile à 667 × 320, clavier des sélecteurs, états de force du mot de passe, champs invalides, stabilité du bouton et conservation de la saisie après navigation.

Les scénarios antérieurs restent exécutés : MFA/TOTP et codes de secours, changement et réinitialisation du mot de passe, suppression du compte, adresses, préférences, fidélité, commandes, avis, wishlist, comparaison, coupons, recherche, administration et modération.

## Résultats et preuves

| Contrôle | Résultat final |
|---|---|
| 114 scénarios sur chacun des trois moteurs | **342/342 réussis** : Chromium 114, Firefox 114, WebKit 114 ; aucun échec, test ignoré ou flaky |
| Durée de la passe complète | 12 min 21 s ; 4 workers au total, WebKit limité à 2 |
| Inspection systématique public/client/admin en 1440 et 390 px | **198 visites** ; aucune erreur détectée : JavaScript/React, réponse 5xx, image cassée, débordement ou violation axe sur les règles exécutées |
| Matrice responsive supplémentaire, huit routes et six dimensions sur trois moteurs | **144 visites**, avec captures, axe, contrôle des débordements et des erreurs JavaScript/5xx |
| Tests serveur | **422/422**, 30 suites ; couverture des lignes 87,72 %, branches 73,38 %, statements 86,43 %, fonctions 82,45 % |
| TypeScript/Vite optimisé et ESLint serveur/client | Réussis |
| CI | YAML contrôlé et commande multi-navigateurs exécutée localement ; workflow GitHub non publié/non exécuté |
| Runtime | Readiness OK ; JavaScript servi identique au build sur disque |

Le [dossier de preuves](preuves-approfondissement/) contient les résultats par scénario, les rapports des routes, les journaux, la couverture et les empreintes SHA-256 des sources, des builds client/serveur et des captures. Le rapport HTML complet est dans `client/playwright-report/`, consultable localement sur **http://127.0.0.1:9323**. L’application reste sur **http://127.0.0.1:3107**.

Une session Chromium **visible** distincte a créé un compte par formulaire, confirmé son adresse, connecté le compte et vérifié le profil après rechargement à 320 px. La passe complète multi-navigateurs utilise les moteurs sans fenêtre. Les captures `visible-*.png`, `menu-after.png` et `filters-after.png` sont dans `artifacts/deep-ui-20260917/`.

La première passe complète comptait 325/342 réussites. Les problèmes corrigés, les décodeurs ajoutés et la stabilisation des mesures après animation ont été vérifiés par 12 tests ciblés WebKit réussis, puis par la nouvelle passe **342/342 sans retry**. Les journaux et traces intermédiaires restent dans `artifacts/deep-ui-20260917/` ; leurs échecs et interruptions ne sont pas présentés comme des réussites.

## Reproduction

Voir les commandes du [README](../../../README.md#vérifications-reproductibles). La variable `E2E_CROSS_BROWSER=1` ajoute Firefox et WebKit au projet Chromium. La CI installe désormais les trois moteurs et active cette variable, avec un délai maximal porté à 35 minutes. Son exécution sur GitHub reste à vérifier après publication des modifications. Le build de recette est `npm run build:test`, avec prestataires externes désactivés et assets optimisés. Ne pas reconstruire les assets pendant un test ; redémarrer le serveur de recette après chaque build.

Sur cette machine, Firefox et WebKit ont été installés dans le cache utilisateur. Les bibliothèques Ubuntu manquantes de WebKit et les décodeurs FFmpeg/GStreamer nécessaires à la vidéo ont été téléchargés et extraits sous `artifacts/deep-ui-20260917/webkit-libs/`, sans installation système. Les deux lanceurs WebKit locaux ajoutent ce chemin ; leurs originaux sont sauvegardés. Le contrôle préalable des paquets système est désactivé pour ces exécutions ; `LD_LIBRARY_PATH` et `GST_PLUGIN_PATH_1_0` référencent les bibliothèques extraites, avec un registre GStreamer local. Le lancement, la navigation et la lecture vidéo sont réellement vérifiés. WebKit utilise au maximum deux workers. En CI ou sur une machine administrable, utiliser la commande standard `playwright install --with-deps chromium firefox webkit`.

## Limites de portée

WebKit sur Linux n’est pas Safari sur un iPhone physique. Firefox utilise des viewports et événements tactiles sans l’option `isMobile`, non prise en charge par Playwright sur ce moteur. Les captures et axe ne remplacent pas un audit avec lecteurs d’écran, ni les essais de tous les appareils, niveaux de zoom et combinaisons de données.

Stripe/3DS, remboursements, OAuth Google/Apple et réception effective des emails restent à valider avec des prestataires sandbox configurés. Les tests locaux de cartes utilisent des réponses explicitement simulées ; les commandes payées de recette sont des fixtures. Aucun succès bancaire ni délivrabilité réelle n’est revendiqué. Les mesures Docker, sécurité et Lighthouse des rapports précédents restent historiques.
