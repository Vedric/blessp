# Livraison et retour arrière

La procédure actuelle est décrite dans [deployment.md](../deployment.md). Pour une base antérieure aux correctifs, commencer par [la migration dédiée](010-audit-remediation-migration.md).

1. Vérifier CI, version semver non encore publiée, configuration de l’environnement GitHub `production`, sauvegarde restaurable et fenêtre de migration.
2. Exécuter le workflow Release. Il construit et scanne une seule image, publie son digest, migre avec ce même artefact et appelle le webhook.
3. Le webhook doit déployer le digest fourni. Vérifier `/health/ready` et la révision Git correspondante avant d’accepter la release.
4. Vérifier les parcours réels en staging et les métriques d’erreur, latence et outbox après livraison. Conserver le digest précédent et les logs de migration.

En cas d’incident, arrêter les nouvelles opérations risquées et identifier si la panne vient du code, du schéma ou d’un prestataire. Un rollback d’image exige un schéma compatible. Ne jamais supprimer les volumes, lancer `db push` ou forcer un rollback SQL non vérifié. Une restauration DB peut perdre des commandes postérieures ; rapprocher Stripe et les données après toute restauration.
