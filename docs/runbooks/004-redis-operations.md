# Exploitation Redis

Redis sert au cache et aux quotas partagés. PostgreSQL porte les données métier et la nouvelle outbox email.

Une panne Redis contourne le cache et conserve les quotas locaux à chaque instance. Les commandes Redis de l’API ont une durée bornée et ne sont pas empilées hors connexion. L’API reste disponible ; la limite globale peut cependant atteindre la somme des quotas locaux tant que Redis ne fonctionne pas.

Vérifier le service, la connexion interne et les logs de reconnexion. Après rétablissement, vérifier que le cache et les quotas partagés reprennent. Ne pas exposer le port Redis sur Internet. Préférer une suppression ciblée des clés de cache à `FLUSHALL`, qui effacerait aussi les compteurs et d’éventuels anciens jobs BullMQ.

Les nouveaux emails critiques sont dans `email_outbox` : voir [le runbook email](007-email-queue-recovery.md). Les éventuels jobs BullMQ hérités nécessitent un inventaire séparé.
