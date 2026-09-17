# Lancer BLE$$ P en partant de zéro

Guide mis à jour le 18 septembre 2026. L’établissement prévu est à Montréal, au Québec, Canada, selon la confirmation du porteur du projet. Aucun budget n’est prévu pour l’instant ; aucun domaine, hébergement, compte Stripe ou service email n’est encore disponible. L’entreprise n’est pas encore créée ; les produits sont déjà disponibles. La livraison sera limitée au Canada au lancement. L’identité juridique future, l’adresse exacte et les inscriptions fiscales restent à préciser. Les étapes ci-dessous sont à réaliser ; elles ne constituent pas une validation de production.

Nous avancerons une étape à la fois. Tu fournis les décisions commerciales et ouvres les comptes à ton nom ; je prépare la configuration, les modifications du projet et les vérifications. Les achats et l’ouverture publique auront lieu après choix explicite du service et du coût. Aucun abonnement n’est nécessaire pour commencer à préciser le projet.

## 1. Poser les bases de la boutique

À préparer, même si certaines réponses sont encore « à décider » :

- Entreprise encore en projet à Montréal (Québec) : préparer l’identité et les coordonnées qui pourront figurer sur le site.
- Livraison au Canada uniquement au lancement ; confirmer la devise souhaitée. Le code utilise actuellement CAD ; changer de devise demanderait une adaptation et une recette.
- Produits à vendre, prix, stock physique, dimensions/poids des colis et adresse de départ des expéditions.
- Conditions souhaitées de livraison et de retour : tarifs, délais, frais de retour, échanges et remboursement de la livraison.
- Budget mensuel maximal pour les services, en précisant la devise du budget, et ordre de grandeur des commandes attendues.

**Résultat attendu :** une fiche commerciale assez précise pour choisir les services et chiffrer leurs coûts. La province et la situation réelle de l’entreprise permettront aussi de faire vérifier les inscriptions et règles fiscales applicables. La page de l’[Agence du revenu du Canada sur l’inscription à la TPS/TVH](https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/when-register-charge.html) est un point de départ ; elle ne tranche pas à elle seule toutes les obligations provinciales de la boutique.

## 2. Choisir les services et le nom de domaine

Nous comparerons les offres au moment du choix, à partir du budget et des besoins de résidence des données. Le projet a besoin d’un hébergement exécutant l’application Node/Docker et PostgreSQL, avec HTTPS, sauvegardes et secrets protégés. Un hébergement des seuls fichiers du frontend ne suffit pas : Express sert aussi l’API et les réponses nécessaires au référencement.

La liste à prévoir est courte :

| Service | Ce que tu fais | Ce que je prépare et vérifie |
| --- | --- | --- |
| Domaine | Choisir le nom, vérifier sa disponibilité et l’enregistrer sur ton compte | Configuration DNS du site et des services d’email, redirection vers le domaine principal |
| Hébergement et base | Choisir l’offre et ouvrir le compte après estimation | Préproduction séparée, image Docker, base privée, secrets, migrations, HTTPS et déploiement |
| Boîte support | Créer une boîte que tu consulteras pour répondre aux clients | Adresse publique cohérente et destinataire du formulaire de contact |
| Emails automatiques | Choisir Resend ou Postmark, transports déjà présents dans le code | Domaine d’envoi, configuration et essais d’inscription/récupération/commande |
| Stripe | Ouvrir le compte et renseigner les informations demandées par Stripe | Clés de test, webhook et parcours de paiement ; configuration commerciale après recette |
| PayPal | Ouvrir le compte de l’exploitant et préparer une application sandbox | Intégration distincte pour le Canada, notifications, capture, annulation et remboursement |
| Médias | Fournir photos et contenus dont tu disposes des droits | URLs durables, formats/poids et contrôle d’affichage du catalogue |

Conserve la propriété des comptes, active leur authentification renforcée et conserve leurs moyens de récupération. Les clés privées seront installées dans les paramètres protégés de l’hébergement, jamais collées dans une conversation ou un fichier Git. Pour chaque console choisie, je pourrai ensuite indiquer précisément les écrans et champs à renseigner.

**Résultat attendu :** services choisis, coût initial et récurrent compris, accès disponibles. Google/Apple pour la connexion et les outils marketing peuvent rester désactivés au lancement.

## 3. Monter une boutique de préproduction

Il s’agit d’une copie de recette sur une URL distincte, avec sa propre base, ses secrets et ses données synthétiques. Son accès sera limité aux personnes qui testent ; un simple `noindex` ne constitue pas une protection d’accès.

Je préparerai l’application et les migrations selon le [guide de déploiement](deployment.md). Les domaines publics du site et des liens email devront correspondre à cet environnement. Nous configurerons le premier administrateur et son MFA, puis les tarifs approuvés et la boîte support selon le [guide de configuration](runbooks/012-launch-configuration.md).

**Résultat attendu :** une URL HTTPS de recette accessible, une connexion administrateur fonctionnelle, une base isolée et une révision de code identifiable.

## 4. Brancher paiement et emails

Stripe sera d’abord relié en environnement de test, avec clés publiques, privées et webhook du même environnement. Les essais utiliseront les [moyens de paiement de test Stripe](https://docs.stripe.com/testing). Le [guide Stripe du projet](runbooks/009-stripe-and-oauth-setup.md) indique les variables et les quatre événements pris en charge. Nous garderons ces essais dans la préproduction séparée.

Pour les emails, nous ajouterons les enregistrements DNS fournis par le prestataire et attendrons sa validation du domaine. Avec Resend, cette vérification est décrite dans la [documentation des domaines](https://resend.com/docs/dashboard/domains/introduction). La boîte de réception du support et le service d’envoi automatique remplissent deux fonctions différentes : configurer l’envoi ne crée pas, à lui seul, une boîte de travail pour répondre aux clients.

**Résultat attendu :** paiement de test rapproché de la commande, notification reçue, inscription vérifiée par email et récupération de compte réussie. Nous vérifierons également les refus, remboursements, événements retardés et reprises d’email. Les emails d’authentification restent à adapter au français si les deux langues sont proposées au lancement.

## 5. Finaliser les règles et le catalogue

Le calcul fiscal n’est pas encore implémenté. Une fois le traitement validé avec le responsable comptable, je pourrai adapter le calcul, l’affichage, les commandes, les justificatifs et les remboursements, puis tester des montants attendus par destination. Activer une option dans Stripe ne complète pas ce travail dans l’application.

Nous alignerons les pages FR/EN avec l’identité réelle et les engagements retenus. Aujourd’hui, certains textes promettent des procédures que le site n’automatise pas. L’administration rembourse tout le solde restant ; si la politique impose des remboursements partiels ou par article, il faudra les implémenter et les tester.

Nous renseignerons ensuite chaque produit et variante avec son prix et son stock réel. La remise en stock après retour nécessite une inspection et une décision explicite. Nous établirons une procédure utilisable pour préparer, expédier et traiter le retour d’une commande, y compris lorsqu’une étape est manuelle.

**Résultat attendu :** prix et taxes cohérents, textes approuvés, stock rapproché du physique, photos disponibles et procédure de commande réalisable de bout en bout.

## 6. Faire la recette avant ouverture

Je rejouerai les parcours sur les vrais services de préproduction : invité et membre, inscription, connexion, mot de passe oublié, panier, coupon, paiement, stocks, support et administration. Nous compléterons les tests automatisés par des essais sur téléphones physiques et avec un lecteur d’écran, ainsi que par la réception effective des emails.

Il faudra aussi restaurer une sauvegarde sur une base isolée, recevoir une alerte de test, vérifier une reprise après redémarrage et mesurer une charge correspondant au trafic attendu. Les essais de charge utiliseront des fournisseurs simulés pour les opérations externes ; ils ne bombarderont pas Stripe ni les destinataires d’emails.

**Résultat attendu :** preuves datées sur une version précise, aucun blocage de lancement ouvert et responsables identifiés pour le support et l’exploitation. Les preuves locales existantes restent consultables dans le [rapport de lancement](audits/2026-09-16/LANCEMENT.md).

## 7. Préparer puis ouvrir la production

Une fois les étapes précédentes validées, nous préparerons une base commerciale propre et les identifiants de production. Les variables publiques de paiement sont intégrées à la compilation : l’image de production devra être construite avec les bonnes valeurs. Je vérifierai les changements entre préproduction et production et le déploiement sur la version finale.

Nous compléterons `config/launch.json` à partir de son exemple seulement lorsque les points de revue sont réellement clos. Le contrôle `npm run check:launch -- --static`, puis le contrôle complet dans l’environnement configuré, devront réussir. Ces commandes contrôlent la configuration ; elles ne remplacent pas les essais des fournisseurs.

L’ouverture publique sera une étape explicite après examen du résultat. Aucun seed de démonstration ne doit alimenter le catalogue commercial. La première période d’exploitation demandera un suivi des commandes, réservations, emails, erreurs et demandes de support.

**Résultat attendu :** domaine public opérationnel, version déployée vérifiée, fonctionnement commercial observé et procédure de reprise connue.

## Notre prochaine étape

Montréal (Québec) est confirmé. Avec aucun budget prévu pour l’instant, poursuivre les développements et les tests locaux sans souscrire à des services. La livraison au Canada uniquement et l’entreprise encore en projet sont confirmées. Les produits sont déjà disponibles : préparer en priorité leurs fiches, photos, prix et quantités par variante. Le code conserve CAD ; les frais, délais, retours et le traitement fiscal restent à définir avant ouverture. Nous comparerons les coûts avant de choisir les comptes à ouvrir ; cette confirmation ne valide aucun abonnement ni lancement commercial. Il n’est pas nécessaire de remplir toutes les étapes aujourd’hui.

La [checklist de lancement](LAUNCH_CHECKLIST.md) reste la liste de référence des points ouverts. Ce guide donne leur ordre de traitement et ne coche aucune validation à ta place.
