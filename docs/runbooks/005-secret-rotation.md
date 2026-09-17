# Rotation des secrets

Utiliser le gestionnaire de secrets de l’environnement et conserver une trace opérationnelle sans publier les valeurs. Une rotation ne doit pas être testée directement avec des comptes ou paiements réels.

## JWT

L’application accepte une seule paire RSA, via `JWT_PRIVATE_KEY_BASE64` et `JWT_PUBLIC_KEY_BASE64`. Elle n’implémente pas `JWT_OLD_PUBLIC_KEY_BASE64`.

Générer une nouvelle paire RSA d’au moins 2048 bits dans un répertoire protégé (`umask 077`), injecter les deux valeurs de manière cohérente puis remplacer les instances ensemble. Tous les tokens signés par l’ancienne clé cessent immédiatement d’être acceptés ; les utilisateurs doivent se reconnecter. Un déploiement progressif avec deux clés différentes produit des erreurs d’authentification intermittentes.

## MFA

`MFA_ENCRYPTION_KEY` est indépendante des clés JWT. Elle encode 32 octets aléatoires. Sauvegarder cette clé avec une protection adaptée ; ne jamais la remplacer par une simple modification d’environnement lorsque des facteurs existent.

Une rotation MFA exige de déchiffrer les facteurs avec l’ancienne clé puis de les rechiffrer avec la nouvelle, dans une procédure contrôlée, testée et récupérable. Aucun outil automatique de rotation multi-clé n’est fourni. En cas de perte de clé, organiser une récupération d’identité ; ne pas désactiver globalement les MFA.

## Prestataires, base et métriques

- Stripe : préparer la nouvelle clé API et le secret correspondant à l’endpoint webhook, vérifier en staging puis remplacer. Ne pas confondre clé de publication et secret serveur.
- Email : configurer la nouvelle clé et vérifier un envoi de test explicite ; surveiller les reprises de l’outbox.
- PostgreSQL/Redis : coordonner serveur et clients, vérifier readiness et connexions après remplacement. En panne Redis, les quotas locaux protègent encore chaque instance.
- `METRICS_TOKEN` : mettre à jour simultanément application et collecteur. Un token absent/invalide retourne 404 sur `/metrics`.

Contrôler les logs, les parcours d’authentification, la readiness et les métriques après rotation. Révoquer l’ancienne clé chez le fournisseur une fois la transition vérifiée, selon les possibilités de chevauchement qu’il offre.
