# État de préparation à la production

Évaluation mise à jour le 17 septembre 2026, après les corrections locales. Les résultats et preuves sont dans [CORRECTIFS.md](audits/2026-09-16/CORRECTIFS.md), [la deuxième passe](audits/2026-09-16/SUITE.md), [la recette Chromium](audits/2026-09-16/INTERFACE.md) et [l’approfondissement multi-navigateurs](audits/2026-09-16/APPROFONDISSEMENT.md) ; l’audit initial est conservé comme historique.

Optimisations de réactivité et mesures sur 10 000 produits : [fluidité et croissance du catalogue](audits/2026-09-16/FLUIDITE.md).

Refonte de l’interface, galerie, pagination de recherche, contrôles de stock et matrice des parcours : [interface et expérience](audits/2026-09-16/EXPERIENCE.md).

Les contrôles locaux couvrent les contrats API, la sécurité des sessions, MFA, les transactions de stock, l’idempotence des événements de paiement, les parcours navigateur, la compilation et l’image de production. Cela ne prouve pas la configuration des services déployés.

## Revue concrète des points restants

La [checklist de lancement](LAUNCH_CHECKLIST.md) précise les décisions, développements et validations encore nécessaires. La passe de lancement du 17 septembre ajoute des tarifs de livraison configurables et validés côté API, une boîte support avec notifications transactionnelles et un dialogue explicite de remboursement du solde. Le calcul des taxes et les écarts entre politique de retour et remboursement intégral restent à résoudre. Le Canada est confirmé ; la province et les services externes ne sont pas encore définis. Ces sujets s’ajoutent aux raccordements et contrôles d’exploitation ; ils ne sont pas couverts par une simple mise en ligne du build testé.

La dernière validation couvre **466 tests serveur et 172 scénarios sur trois navigateurs**, avec reprises ciblées documentées dans [la passe de lancement](audits/2026-09-16/LANCEMENT.md). Les [preuves de la recette des stocks](audits/2026-09-16/STOCKS.md) restent conservées. Aucun déploiement ou essai fournisseur réel n’a été effectué.

## Conditions avant ouverture publique

1. Répéter la migration sur une copie restaurée et anonymisée de la base réelle ; réconcilier les anciennes commandes en attente et les stocks. Prévoir la déconnexion des anciennes sessions et la vérification des emails non confirmés. Voir [le runbook de migration](runbooks/010-audit-remediation-migration.md).
2. En staging, tester un paiement Stripe complet, authentification 3DS, retour après redirection, webhook retardé/rejoué, annulation et remboursement. Vérifier la devise CAD et les moyens de paiement réellement activés.
3. Configurer le domaine d’envoi et vérifier réception, expiration et utilisation unique des emails de vérification, récupération et confirmation. Tester les rebonds et surveiller l’outbox.
4. Si ces connexions sont retenues au lancement, tester Google/Apple avec les applications et URLs de retour réelles, notamment la MFA d’un compte déjà lié. L’association automatique par simple égalité d’adresse email est désactivée.
5. Exécuter les workflows GitHub avec les secrets, permissions, registre et webhook de déploiement réels. Contrôler le digest exécuté et `/health/ready.revision`.
6. Configurer TLS, reverse proxy de confiance, origines CORS, sauvegardes PostgreSQL, supervision et alertes. Restaurer une sauvegarde dans un environnement isolé et vérifier les données et clés MFA.
7. Renseigner les informations réelles de l’entreprise, pays desservis, règles fiscales, conditions de livraison, retours et conservation documentaire. Les mentions légales contiennent encore des champs à compléter. Confirmer les adresses de support et renseigner les vrais profils sociaux via les variables `VITE_*_URL` documentées dans `client/.env.example`. Configurer les stocks réels dans l’administration : une variante absente ne peut pas être achetée. Ces décisions ne peuvent pas être déduites du code.
8. Effectuer des essais de charge représentatifs et mesurer les pages sur mobiles et réseaux réels. Lighthouse local n’est pas un engagement de disponibilité ou de performance.

## Limites suivies

- Les contrôles axe couvrent les routes publiques, client et administrateur en deux tailles d’écran ; les dialogues principaux sont exercés au clavier. Une revue avec lecteurs d’écran et appareils réels reste nécessaire.
- Les quotas de secours sont locaux à chaque instance pendant une panne Redis : la limite agrégée peut être multipliée par le nombre de replicas.
- L’outbox livre au moins une fois ; Resend reçoit une clé d’idempotence. Avec un fournisseur sans déduplication, un arrêt entre l’envoi et l’accusé DB peut produire un doublon de mail.
- La conservation des commandes et coordonnées de facturation après anonymisation du compte requiert une politique d’entreprise documentée et une durée de purge appropriée.
- Les sauvegardes, alarmes, CDN et restrictions réseau ne sont pas créés par le dépôt.

Aucun déploiement, débit bancaire, remboursement réel, envoi d’email ou modification de service externe n’a été réalisé pour cette validation locale.

## Gestion des stocks

La page `/admin/inventory` ajoute recherche, filtres, ajustements manuels tracés et contrôle des conflits avec les commandes. La fiche produit préserve désormais le stock lors des seules modifications de métadonnées. Consulter [la recette des stocks](audits/2026-09-16/STOCKS.md) et [le guide de migration et d’exploitation](runbooks/011-inventory.md). Les quantités commerciales doivent être rapprochées avec l’inventaire physique et les réservations avant mise en vente.
