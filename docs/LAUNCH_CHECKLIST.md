# Reste à faire avant ouverture commerciale — 18 septembre 2026

Mise à jour du 20 septembre : [correctifs du catalogue, des liens de vérification et de la navigation au clavier, avec leurs preuves ciblées](audits/2026-09-20/CATALOGUE_ET_STABILITE.md). Voir aussi [les emails de compte FR/EN et leurs tests](audits/2026-09-20/EMAILS_COMPTE.md). Les résultats antérieurs ci-dessous restent des points de référence datés.

**Statut : corrections en revue, ouverture commerciale non validée.** La passe du 20 septembre couvre 523 tests serveur, 36 cas email, 27 contrôles d’accessibilité de pages et 39 contrats fournisseurs sur Chromium, Firefox et WebKit. Les preuves ciblées sont détaillées dans [EMAILS_COMPTE.md](audits/2026-09-20/EMAILS_COMPTE.md), et les contrôles distants de la révision finale dans la [PR #70](https://github.com/Vedric/blessp/pull/70). Les campagnes générales précédentes restent documentées dans [LANCEMENT.md](audits/2026-09-16/LANCEMENT.md) et [PAIEMENTS_AUTH_CI.md](audits/2026-09-17/PAIEMENTS_AUTH_CI.md). Ces résultats ne valident ni les décisions commerciales, ni les prestataires réels, ni une production déployée. Cette revue complète [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) et [la recette des stocks](audits/2026-09-16/STOCKS.md).

## Points à fermer avant lancement

| Sujet | État constaté | Travail restant et critère de clôture |
| --- | --- | --- |
| Identité et marché | Le propriétaire confirme Montréal (Québec), la livraison au Canada uniquement et une entreprise encore en projet. Les mentions contiennent encore `[À compléter]`. L’encaissement en CAD est confirmé. | Préciser la future entité, ses coordonnées et l’hébergeur. Compléter les textes FR/EN et faire valider les engagements commerciaux. |
| Taxes et justificatifs | Le total serveur est articles − remise + livraison. Pas de calcul ni de ventilation des taxes dans les commandes ; la confirmation email n’est pas un système de facturation. | Déterminer les règles avec le responsable comptable, puis implémenter le calcul/affichage et les justificatifs nécessaires, ou un raccordement externe. Vérifier des totaux attendus par destination, remise, livraison et remboursement. |
| Livraison | Tarifs par pays configurables via `SHIPPING_RATES_JSON`, obligatoire en production. Le checkout charge les pays et montants depuis l’API ; le serveur refuse les destinations non desservies avant réservation. Les anciens tarifs restent uniquement les valeurs de démonstration en développement/test. | Configurer le Canada uniquement ; confirmer zones éventuelles, tarifs, seuil, délais, transporteurs et frais éventuels. Installer la configuration approuvée, aligner les textes publics et préparer une vraie procédure d’expédition. |
| Retours et remboursements | Les textes promettent retours nationaux gratuits, autorisation de retour, étiquette prépayée et échanges. Ils mentionnent du crédit boutique avec un code promotionnel/carte-cadeau et des frais de livraison non remboursables. L’administration affiche et demande explicitement le remboursement Stripe ou PayPal de tout le solde restant, avec contrôle du solde observé et restitution du focus. Aucun montant partiel n’est proposé. | Décider et aligner politique, procédure de support et code. Les promesses de crédit boutique et de traitement des frais ne correspondent pas au mécanisme actuel. Prévoir les remboursements partiels/par article si la politique l’exige. Un retour/une étiquette peut être traité manuellement au lancement si ce circuit existe réellement. |
| Paiements | Logique locale Stripe/PayPal et événements simulés testés ; comptes fournisseurs et transactions externes réelles non recettés. | Tester en préproduction isolée : achat invité/membre, refus, 3DS, cartes et portefeuilles éligibles, PayPal sandbox, redirection, interruption/reprise, webhook retardé/rejoué, annulation, remboursement et cohérence des réservations. Valider la même devise et le même environnement pour toutes les clés. |
| Emails | Vérification, récupération et commandes testées via outbox locale ; réception réelle non validée. La confirmation de commande utilise désormais la langue FR/EN enregistrée avec la commande. Les emails d’authentification sont disponibles en FR/EN selon la langue de la demande ; le lien conserve cette langue. Le bienvenue Google/Apple passe aussi par l’outbox transactionnelle. | Configurer le domaine/expéditeur chez le prestataire, tester Gmail/Outlook et mobile, liens publics, rebonds et reprises. Vérifier toutes les boîtes annoncées dans le site. |
| Support | Le formulaire enregistre message et notification dans une transaction. Le destinataire `SUPPORT_EMAIL` est obligatoire en production ; l’outbox reprend les erreurs. Une boîte administrative paginée permet recherche, lecture et marquage lu/non lu, sans dépendre de la réception email. | Créer la vraie boîte support, configurer le destinataire et organiser la lecture/réponse des demandes. Le lien de réponse ouvre le logiciel de messagerie ; il n’envoie rien depuis le site. Vérifier les adresses `hello`, `returns` et `retours` effectivement publiées. |
| Catalogue et stocks | Le propriétaire dispose déjà des produits. [Huit fiches et treize photos produit](CATALOGUE_EXISTANT.md) sont présentes dans le dépôt. CRUD et stock par variante disponibles ; inventaire commercial restant à renseigner et vérifier. | Reprendre les photos locales déjà livrées avec l’application ; valider fiches, tailles, couleurs, prix et quantités réelles. Vérifier chaque combinaison commercialisée et décider si le stock des ensembles est séparé de celui des pièces à l’unité. Aucun seed de démonstration dans la base commerciale. |
| Hébergement | Le propriétaire ne possède encore ni domaine, ni hébergement, ni comptes Stripe/email. Docker, routes de santé et procédure de déploiement sont présents ; aucun environnement distant validé. | Choisir/configurer domaine, HTTPS, proxy, base privée et secrets propres à l’environnement. Préproduction avec base et identifiants séparés. Vérifier exposition réseau, cookies, CORS, logs et accès administrateur avec MFA. |
| Sauvegarde et maintenance | Maintenance/outbox/expiration et métriques implémentées ; sauvegardes et alertes non provisionnées par le dépôt. | Sauvegarder base et clé MFA, restaurer sur une base isolée, déclencher et recevoir une alerte de test. Vérifier le traitement des emails, réservations et demandes de suppression. Définir responsables, conservation et procédure de reprise. |
| Migration et livraison du code | Les migrations passent localement ; les corrections sont commitées et poussées dans la [PR #67](https://github.com/Vedric/blessp/pull/67), qui conserve les résultats des workflows. La protection de `main` impose onze contrôles, une branche à jour et les conversations résolues ; les poussées forcées et la suppression sont bloquées, y compris pour les administrateurs. | Vérifier les contrôles sur la révision finale avant fusion, puis tester le déploiement et vérifier le digest/révision servis. Pour une base existante : restauration d’une copie, répétition des migrations et rapprochement des anciens stocks/commandes. La fusion vers `main` exécute la CI ; la release commerciale se déclenche manuellement, après les validations de lancement. |
| Recette d’exploitation | Navigateurs automatisés, axe et mesures locales disponibles. | Rejouer les parcours sur le domaine de préproduction, iPhone/Android physiques, réseau mobile et lecteur d’écran. Tester une charge correspondant au trafic attendu et une reprise après redémarrage/panne. Contrôler réellement préparation, expédition et réception d’une commande de recette. |

## Fonctions conditionnelles et améliorations ultérieures

La demande de lancement inclut maintenant Visa, Mastercard, Amex, Diners, PayPal, Apple Pay, Google Pay, ainsi que la connexion email, Google et Apple. Le [guide fournisseurs](runbooks/013-paypal-and-provider-testing.md) décrit l’intégration PayPal distincte pour le Canada, les parcours de profil incomplet et les essais simulés. Les comptes, domaines et essais externes réels restent à valider. Les connexions Google/Apple peuvent rester désactivées pendant la préparation, mais leur activation et leur recette font désormais partie du périmètre demandé avant l’ouverture complète.

- Google/Apple : valider les applications et callbacks réels si ces boutons font partie du lancement ; sinon les laisser désactivés. La connexion email reste disponible.
- Suivi transporteur : les statuts de commande sont gérés, mais il n’y a pas de champ de suivi transporteur ni de génération d’étiquettes repérés dans le modèle/parcours actuel. Une procédure manuelle peut suffire au lancement ; intégrer ces fonctions si elles sont promises ou nécessaires au volume.
- Retours : portail client, autorisations et étiquettes automatiques, échanges, remboursements partiels dans l’administration. Priorité à fixer selon la politique retenue ; le texte public doit correspondre au circuit effectivement disponible.
- Médias : upload direct et stockage d’images gérés depuis l’administration. Les URLs actuelles permettent de lancer si les fichiers sont correctement hébergés.
- Stocks : alertes de seuil, import/export, fournisseurs, lots, multi-entrepôts et diffusion en temps réel. La gestion actuelle suffit pour un stock unique par variante.
- Marketing : réseaux sociaux, analytics consentis, campagnes, automatisations et optimisation SEO supplémentaire. Ne pas conditionner le lancement à des profils sociaux inexistants.
- Montée en charge : dimensionner puis mesurer la cible. En panne Redis, les quotas de secours sont locaux à chaque instance ; les essais doivent tenir compte du nombre de réplicas.

## Ordre proposé

Le [guide pour partir de zéro](GUIDE_LANCEMENT.md) détaille cet ordre, les comptes à prévoir et les vérifications de chaque étape.

1. Préparer le catalogue réel et préciser la future identité de l’entreprise à Montréal, les tarifs de livraison au Canada, les retours et les besoins comptables.
2. Implémenter les taxes validées, aligner retours et contenu commercial, configurer livraison et support.
3. Préparer une préproduction isolée avec Stripe de test et un domaine d’envoi vérifié.
4. Recetter les prestataires, le traitement des commandes, les sauvegardes, les alertes et la charge.
5. Figer la version, migrer selon la procédure, vérifier le build déployé et effectuer la recette finale de mise en service.

La fermeture de cette liste doit reposer sur des résultats observés et les décisions du propriétaire. Aucun nombre de tests locaux ne permet de garantir l’absence absolue de défauts.

## Informations nécessaires du propriétaire

- Identité et coordonnées de la future entreprise à Montréal (Québec) ; devise d’encaissement. Livraison au Canada uniquement confirmée.
- Prix avec/sans taxes selon le modèle retenu, informations validées par le responsable comptable et besoin de facturation.
- Tarifs/seuil/délais/transporteurs ; conditions de retour, frais, échanges et remboursement.
- Domaine et hébergement retenus ; existence d’une base commerciale à migrer ; trafic attendu.
- Comptes Stripe et email disponibles ; boîtes de support et éventuels fournisseurs Google/Apple.

Les accès secrets devront être installés dans l’environnement ou son gestionnaire de secrets, pas copiés dans ce document.

## Contrôle de lancement

`npm run check:launch -- --static` vérifie le dossier de revue et les mentions publiques. Le workflow de release applique ce contrôle avant publication d’image. Il doit actuellement échouer : `config/launch.json` n’existe pas et les mentions sont incomplètes. Copier `config/launch.example.json` puis renseigner les informations et attestations seulement après vérification réelle ; aucun secret dans ce fichier.

Le contrôle complet, lancé dans l’environnement configuré avec `npm run check:launch` (ou `-- --staging` pour Stripe test), ajoute la cohérence des variables et clés. Il ne contacte aucun fournisseur et ne prouve pas la validité des taxes ou la réception des emails. Voir [le guide opérationnel](runbooks/012-launch-configuration.md).
