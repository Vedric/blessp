# Préparation du lancement — passe du 17 septembre 2026

Le propriétaire confirme une entreprise au Canada, sans domaine, hébergement ni comptes Stripe/email disponibles. La province, les pays livrés, les tarifs, la devise commerciale et la politique de retour restent à préciser. Le code continue à calculer en CAD ; cela ne constitue pas une confirmation commerciale.

## Correctifs livrés

### Livraison

- Règles par pays configurées dans `SHIPPING_RATES_JSON`, obligatoires en production ; validation des montants entiers, bornes et doublons.
- Configuration publique chargée par le checkout, tarif adapté au pays et au seuil après remise. Un échec de chargement masque les montants inconnus, bloque la préparation et propose une nouvelle tentative.
- Destination refusée côté serveur avant réservation ou consommation du coupon. Le pays de facturation reste indépendant ; un ancien pays enregistré n’est pas remplacé silencieusement.
- Une commande déjà créée conserve son tarif lors d’un rejeu idempotent, même après modification des règles.

Les valeurs de développement restent des exemples. Ce calcul n’inclut pas de moteur fiscal.

### Support

- Message et notification enregistrés atomiquement dans PostgreSQL ; reprise durable par l’outbox après panne du transport.
- Destinataire configurable avec `SUPPORT_EMAIL`, obligatoire en production ; plus d’adresse administrative codée en dur.
- `/admin/contact` : recherche nom/email/objet, filtres lu/non lu, pagination, lecture et lien vers le logiciel de messagerie pour répondre. Accès refusé aux visiteurs et clients ordinaires.
- Texte utilisateur rendu inerte ; anonymisation du compte supprimant aussi la copie contact encore dans l’outbox. Les boîtes externes restent soumises à la procédure de conservation du gestionnaire.

### Commandes et remboursements

- Langue FR/EN persistée avec la commande et utilisée dans la confirmation après paiement. Les anciens enregistrements prennent `en`. Un webhook signé et rejoué ne crée qu’une confirmation.
- Rendu email vérifié à 320 px : référence de commande répartie proprement, colonnes réservées à la quantité et au prix, montants sur une ligne et contrastes renforcés. Les contenus de test contenant des balises restent du texte.
- Dialogue de remboursement affichant tout le solde restant et précisant le traitement des frais ainsi que l’absence de remise en stock automatique.
- Vérification du solde observé avant appel Stripe ; conservation des paramètres lors d’une reprise réseau dans le même dialogue.
- Rafraîchissement des commandes sans démontage de la liste après fermeture : le focus revient sur le bouton d’origine.

Le remboursement partiel/par article et les emails d’authentification FR ne sont pas implémentés dans cette passe. Aucun paiement ni remboursement réel n’a été effectué.

### Listes volumineuses et navigation

La recette Firefox a révélé que les numéros de toutes les pages de commandes se comprimaient jusqu’à environ 15 px sur mobile. Les commandes, produits et avis administratifs, ainsi que les commandes et transactions de fidélité du client, utilisent désormais une pagination bornée : première/dernière page et pages voisines, boutons d’au moins 44 px, retour à la ligne si nécessaire. Le nombre de boutons ne croît plus avec le nombre de pages.

Le pied de page conserve ses liens et formulaires à leur position finale dès le rendu. Les animations d’entrée qui déplaçaient ces contrôles ont été retirées pour stabiliser les interactions et leur contraste.

### Chargement direct des pages administratives

La vérification HTTP a révélé que `/admin/inventory` et `/admin/contact` rendaient l’interface React avec un statut initial 404. Le serveur reconnaît désormais ces deux documents et leurs variantes avec slash final : réponse 200, `noindex`, puis contrôle de session et des droits dans l’interface. Les API restent protégées et renvoient 401/403 sans autorisation. Les véritables routes inconnues conservent le statut 404.

### Garde-fous de lancement

- Modèle de revue `config/launch.example.json` et commande `npm run check:launch` ; le workflow de release exige le contrôle statique avant publication d’image.
- Contrôle complet des variables attendues, cohérence des origines, modes Stripe, paire RSA et configuration de livraison, sans afficher les valeurs secrètes ni appeler les prestataires.
- Refus attendu aujourd’hui : dossier de revue absent et informations légales publiques incomplètes. Aucune attestation fictive n’a été remplie.
- Documentation OpenAPI et guide d’exploitation mis à jour : [configuration et lancement](../../runbooks/012-launch-configuration.md).

Le contrôle lit des déclarations et des paramètres. Il ne prouve ni les taxes, ni la réception email, ni la sécurité d’une infrastructure déployée.

## Validation

- **466 tests serveur, 34 suites**, exécutés sur PostgreSQL isolé ; couverture : 87,09 % des instructions et 75,33 % des branches.
- Compilation TypeScript/Vite, lint sans avertissement et validation structurelle OpenAPI réussis.
- **923 clés FR et 923 clés EN**, sans clé manquante entre les deux fichiers.
- Image Docker construite et testée avec ses migrations sur un schéma jetable, dans un réseau interne sans accès aux prestataires. Onze contrôles passent : configuration obligatoire, disponibilité, routes, protections, assets, métriques, utilisateur non root et arrêt propre.
- **172 scénarios × 3 navigateurs = 516 cas vérifiés**, via la matrice complète et les reprises ciblées ci-dessous. Playwright 1.58.2 : Chromium 145.0.7632.6, Firefox 146.0.1, WebKit 26.0 sous Linux.
- Les fichiers frontend de l’image Docker sont identiques au build servi aux navigateurs : entrée `/assets/index-BCKsm86r.js`.

### Détail des reprises

La première passe de 486 exécutions a révélé les boutons comprimés des commandes sous Firefox/WebKit et un clic de pied de page non abouti. Les corrections de l’application décrites plus haut ont été suivies d’une nouvelle matrice de 516 exécutions.

Cette matrice a produit **510 réussites et 6 constats de test** en 17,2 minutes : cinq mesures Firefox de 44 px rendues à `43,999992 px`, et une inspection WebKit capturant l’interruption de la requête d’accueil pendant le passage immédiat de la connexion à l’administration. Les huit pages administratives de cette inspection avaient toutes un statut 200, sans débordement, image cassée ou violation axe.

Les mesures du test sont désormais arrondies au centième de pixel ; la préparation de l’inspection attend la stabilisation de la page de connexion aboutie. **21 reprises ciblées passent sur 21**, sur les trois navigateurs, en 1,3 minute. Aucun code applicatif n’a changé entre ces deux exécutions. Les résultats initiaux restent conservés ; il ne s’agit pas de présenter la matrice initiale comme intégralement verte. Aucun scénario ignoré ou nouvelle tentative automatique.

### Preuves

[Vue de synthèse](preuves-lancement/verification-summary.html), [matrice avec la provenance des validations](preuves-lancement/browser-results.json), [reprises ciblées](preuves-lancement/targeted-results.json), [build et image](preuves-lancement/build-proof.json), [contrôles Docker](preuves-lancement/docker-smoke.json), [blocage avant lancement](preuves-lancement/preflight-static.json), [empreintes](preuves-lancement/SHA256SUMS).

Captures : [support desktop FR](preuves-lancement/support-desktop-fr.png), [support mobile FR](preuves-lancement/support-mobile-fr.png), [remboursement mobile FR](preuves-lancement/refund-mobile-fr.png), [confirmation email FR](preuves-lancement/order-email-mobile-fr.png) et [EN](preuves-lancement/order-email-mobile-en.png). Les journaux complets et traces restent dans `artifacts/launch-20260917/`, hors Git.

Le [script de reproduction Docker](preuves-lancement/smoke-reproduction.cjs) utilise exclusivement le conteneur PostgreSQL d’audit local indiqué dans le script, un schéma temporaire et des identifiants synthétiques. Il supprime son schéma, son conteneur et son réseau à la fin.

Les essais utilisent PostgreSQL isolé et des identités synthétiques. Les interfaces de remboursement sont testées avec des réponses fournisseur explicitement simulées ; le serveur vérifie séparément les événements signés et les invariants financiers. Les tests de tarifs spécifiques interceptent seulement la configuration publique du navigateur ; les mêmes règles sont exercées côté serveur sur la vraie base isolée.

## Conditions restant ouvertes

Consulter [LAUNCH_CHECKLIST.md](../../LAUNCH_CHECKLIST.md). Priorités : identité/province, taxes et justificatifs, règles de livraison, alignement des retours, catalogue réel, domaine/hébergement, Stripe et messagerie, puis recette sur préproduction avec sauvegarde restaurée, alertes reçues, appareils physiques et charge représentative.

Cette passe ne déploie aucun service, ne crée aucun compte fournisseur et n’enregistre aucun commit/push. L’application n’est pas encore validée pour une ouverture commerciale.
