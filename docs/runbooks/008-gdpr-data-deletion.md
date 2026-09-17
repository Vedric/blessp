# Export et suppression de compte

L’API authentifiée `GET /api/v1/users/export` fournit les données de profil, adresses, commandes, panier, favoris, avis, préférences, fidélité, fournisseurs OAuth et correspondances/newsletter liées à l’adresse confirmée. Les mots de passe, facteurs MFA et jetons ne font pas partie de l’export.

`DELETE /api/v1/users/account` exige le mot de passe et la MFA si activée. Un compte OAuth sans mot de passe doit configurer une MFA avant suppression. Les moyens de paiement sont détachés de Stripe ; le compte est marqué supprimé et ses sessions sont invalidées. Une erreur du prestataire doit être traitée avant de considérer l’opération complète.

Après 30 jours, la maintenance supprime les informations de session, sécurité, adresse, panier, favoris, avis et préférences, les inscriptions newsletter, la correspondance et l’outbox adressées à cet email ; elle anonymise l’identité du compte et désactive ses coupons. Les commandes et leurs instantanés de livraison/facturation sont conservés pour la traçabilité financière.

Vérifier la disponibilité de la maintenance et son absence d’erreurs. Une sauvegarde restaurée peut réintroduire des données déjà supprimées : prévoir le rejeu des demandes et une durée de rétention des sauvegardes. Les obligations et durées de conservation financière doivent être définies par l’entreprise ; cette implémentation seule ne certifie pas une conformité réglementaire.
