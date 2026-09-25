# Plan de finalisation avant ouverture

État du 26 septembre 2026. Objectif demandé : terminer et ouvrir cette semaine. La date cible exacte reste à fixer. Aucun domaine, hébergement ni compte fournisseur disponible n’a été confirmé ; le budget annoncé reste nul. Ce plan ne constitue pas une promesse d’ouverture à une date donnée, car les validations externes et les décisions commerciales restent nécessaires.

## Chemin de réalisation

| Étape | Décisions ou actions du propriétaire | Travail technique et preuve de fin |
| --- | --- | --- |
| 1. Fiche commerciale | Confirmer prix et quantités réelles des huit produits, stock partagé ou séparé des ensembles, tarifs/délais de livraison, retours, identité et coordonnées publiables. Canada et CAD sont confirmés. | Reprendre les photos existantes, renseigner le catalogue, rapprocher les variantes du stock physique, aligner pages et configuration. |
| 2. Règles de calcul | Faire déterminer le traitement fiscal adapté à la situation réelle de l’entreprise. | Implémenter les calculs et justificatifs validés ; tester destinations canadiennes, remises, livraison et remboursements avec des montants de référence. |
| 3. Comptes et environnement | Choisir domaine, hébergement, boîte support, service email, Stripe, PayPal, Google et Apple. Valider les coûts avant achat. | Préparer une URL HTTPS de recette, une base isolée, les secrets protégés et les callbacks. Vérifier admin/MFA et domaine d’envoi. |
| 4. Recette externe | Accéder aux comptes et aux appareils physiques nécessaires. | Acheter en environnement de test, vérifier 3DS/refus/portefeuilles disponibles, réception email, connexion Google/Apple, remboursement, stock et préparation/expédition d’une commande de recette. |
| 5. Exploitation | Identifier qui traite commandes, support, alertes et incidents. | Restaurer une sauvegarde, recevoir une alerte, vérifier reprise après redémarrage et mesurer une charge convenue. |
| 6. Ouverture | Valider les textes, le catalogue et le résultat de recette sur la version candidate. | CI verte sur la révision finale, contrôles de lancement réussis, base commerciale propre, déploiement identifié, contrôle immédiat du site et suivi des premières commandes. |

Les étapes 1 à 3 peuvent avancer en parallèle. Les étapes 4 à 6 dépendent de leurs résultats. Le code et les tests locaux peuvent continuer sans abonnement ; une ouverture complète avec tous les prestataires demandés dépend de leurs comptes, de leur disponibilité et de leur validation. La connexion Apple comporte notamment un prérequis développeur payant à prévoir ; voir les sources et la configuration dans le [guide pas à pas](GUIDE_LANCEMENT.md). Ne pas présenter un moyen de paiement ou une connexion comme opérationnel avant sa recette réelle.

## Première action à préparer

Renseigner les prix et le stock physique dans le tableau local `artifacts/catalogue-a-renseigner-20260920.csv`, ou une copie du modèle versionné `config/catalogue.example.csv`. Vérifier la saisie avec `npm run catalogue:check -- chemin-du-tableau.csv`. Ce fichier est un document de préparation, pas un import automatique. Les [photos, fiches existantes et instructions de saisie](CATALOGUE_EXISTANT.md) servent de référence. Décider explicitement si un ensemble consomme les mêmes pièces que les ventes à l’unité avant d’inscrire les quantités disponibles. Le contrôle refuse les ensembles partagés tant que la déduction de leurs composants n’est pas implémentée.

Le [guide pas à pas](GUIDE_LANCEMENT.md) décrit les services à ouvrir et l’ordre de configuration. La [checklist de lancement](LAUNCH_CHECKLIST.md) conserve les points ouverts et les critères de validation. Ne remplir les attestations de `config/launch.json` qu’après vérification réelle.
