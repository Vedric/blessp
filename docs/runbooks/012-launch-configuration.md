# Configuration de la livraison, du support et du contrôle de lancement

## État commercial connu

Le propriétaire indique que l’entreprise est au Canada et qu’aucun domaine, hébergement, compte Stripe ou compte d’envoi d’emails n’est encore prêt. La province, les marchés livrés, la devise commerciale et les conditions de retour restent à confirmer. Les montants du dépôt sont des exemples, pas des décisions approuvées.

## Migration et configuration

Déployer les migrations dans l’ordre sur une base préalablement sauvegardée. `20260917010000_support_inbox` ajoute les index de tri de la boîte contact et la langue `en`/`fr` des commandes. Les anciennes commandes prennent `en`. Répéter la migration sur une copie isolée avant utilisation commerciale.

- `SUPPORT_EMAIL` : boîte réelle de réception des notifications contact, obligatoire en production. Le domaine et les boîtes publiées dans les pages du site doivent exister.
- `SHIPPING_RATES_JSON` : tableau non vide de pays uniques, codes à deux lettres majuscules, frais et seuils en centimes CAD. Exemple purement technique : `[{"country":"CA","feeCents":750,"freeThresholdCents":10000}]`. `freeThresholdCents: null` signifie aucune gratuité ; `feeCents: 0` signifie livraison gratuite. Le seuil est évalué après réduction.
- La production refuse de démarrer si ces paramètres sont absents ou invalides. Les pays de démonstration CA/US/GB/FR et les montants 995/10000 servent uniquement au développement/test.

`GET /api/v1/commerce/config` expose seulement devise et règles de livraison, sans cache. Le checkout affiche les tarifs selon le pays, bloque la préparation d’une nouvelle commande si la configuration ne peut pas être chargée et permet une nouvelle tentative. Le serveur recalcule le montant et refuse les pays absents avant toute réservation. Un rejeu idempotent d’une commande existante conserve son tarif enregistré.

Le pays de facturation est indépendant du pays livré. Les taxes ne sont pas calculées par ce mécanisme : elles constituent un travail distinct avant commercialisation.

## Support et emails

Le formulaire écrit le message et la notification dans la même transaction. Une panne de transport email laisse la notification dans l’outbox pour reprise par la maintenance. Surveiller les erreurs et l’ancienneté des éléments en attente selon le [runbook outbox](007-email-queue-recovery.md).

La page `/admin/contact`, réservée aux administrateurs, recherche nom/email/objet, filtre lu/non lu et pagine les résultats. Le texte reste affiché comme du texte, y compris les balises envoyées par un visiteur. Lire ou changer le statut ne déclenche pas d’envoi. « Répondre par email » ouvre le logiciel de messagerie du gestionnaire ; une réponse nécessite une boîte configurée et une action humaine.

L’anonymisation d’un compte supprime aussi les notifications de ses messages contact encore conservées dans l’outbox. Les copies déjà livrées à une messagerie externe relèvent de la procédure de conservation/suppression du support.

La confirmation de commande est générée en français ou anglais selon la langue persistée à la création. Les emails de vérification et récupération restent en anglais. La réception et le rendu Gmail/Outlook doivent être testés avec un vrai fournisseur en préproduction.

## Remboursements

Le dialogue affiche le solde restant, inclut les frais encore remboursables et envoie le solde précédemment observé. Un changement de ce solde est refusé avant l’appel Stripe ; fermer le dialogue recharge la commande. Une nouvelle tentative après erreur réseau conserve les paramètres de la tentative dans le même dialogue. Le webhook confirme le résultat final.

Cette interface demande un remboursement de tout le solde ; elle ne gère pas le montant partiel ni le remboursement par article. Elle ne réapprovisionne pas le stock : inspecter physiquement le retour puis enregistrer l’ajustement. Aligner la politique publique avec ce fonctionnement ou développer les opérations supplémentaires requises.

## Contrôle avant publication

1. Compléter les mentions publiques FR/EN et préparer `config/launch.json` à partir du modèle. Ce dossier ne contient aucun secret et doit accompagner la version revue. Ne marquer les attestations `true` qu’après obtention des preuves correspondantes.
2. Exécuter `npm run check:launch -- --static`. Le workflow de release exige ce résultat avant publication d’image.
3. Depuis un terminal où les variables de l’environnement cible sont déjà installées, exécuter `npm run check:launch -- --staging` pour Stripe test, puis le contrôle sans option pour Stripe live au moment approprié. Ne jamais coller les secrets dans les rapports ni utiliser `set -x`.
4. Effectuer la recette fournisseurs, restauration, alertes, appareils physiques et charge. Le script vérifie des déclarations et la cohérence de configuration ; il ne certifie aucun de ces résultats.

Le contrôle échoue volontairement aujourd’hui : dossier de revue absent et mentions incomplètes. Aucune validation fictive n’est enregistrée pour contourner ce blocage.
