# Paiements, connexions et livraison du code — 17 septembre 2026

## Résultat local

Le checkout propose une intégration PayPal distincte lorsqu’elle est configurée. Stripe conserve les cartes et les portefeuilles éligibles de PaymentElement. La connexion Google récupère désormais les noms absents de tokeninfo via UserInfo, lié à la même identité. Google et Apple proposent un complément de profil si nécessaire, respectent le MFA et gèrent fermeture, blocage et échec de chargement de leurs interfaces externes.

PayPal contrôle le propriétaire, le montant CAD, l’adresse transmise, les références et l’environnement. Création/capture/remboursement sont idempotents et protégés contre les demandes concurrentes. Une capture incertaine conserve le stock jusqu’au rapprochement. Les remboursements sont rapprochés sans remise en stock automatique. Migration ajoutée : `20260917020000_paypal`.

Le [guide des fournisseurs](../../runbooks/013-paypal-and-provider-testing.md) précise comptes, variables, événements, procédure et limites. Les moyens réels ne sont pas activés : le propriétaire ne possède encore aucun compte fournisseur.

## Vérifications observées

| Contrôle | Résultat |
| --- | --- |
| Serveur, PostgreSQL isolé et migrations | 513 tests / 36 suites réussis après suppression de l’ancien producteur BullMQ (516 / 37 avant nettoyage), avec couverture |
| Fournisseurs dans le navigateur | 13 scénarios × Chromium, Firefox et WebKit : 39 réussites, aucune reprise automatique |
| Régression navigateur sur auth, checkout et lancement | 34 scénarios × trois navigateurs : 102 réussites |
| Lint et compilation | Réussis |
| OpenAPI | Document valide après ajout des routes PayPal et du complément de profil |
| Workflows | Actionlint réussi |
| Image Docker locale | 11 contrôles de démarrage/migration/HTTP/arrêt réussis sur l’image initiale puis sur l’image finale après retrait de BullMQ (révision applicative 30090f6, étiquette locale `review-cleanup`) |
| Dépendances npm | Aucune vulnérabilité signalée à la racine, dans le serveur ou le client lors du contrôle |

Les [preuves locales](preuves/) conservent les sorties et leurs SHA-256. Les essais exploratoires ont révélé une erreur de syntaxe dans le SDK Apple simulé et une mesure de largeur prise pendant l’animation d’entrée. Le simulateur a été corrigé, la mesure attend la stabilisation, puis la suite complète des 39 cas a réussi. Les essais serveur ont également nécessité la correction de fixtures partagées et des assertions des nouveaux contrats.

Les fournisseurs sont simulés aux limites des tests. Les routes applicatives, sessions et écritures PostgreSQL sont réelles dans une base de recette. La suite serveur vérifie séparément les signatures RSA Apple de test, les audiences, expirations, emails, l’absence de liaison automatique par email, le MFA, la concurrence, les notifications rejouées et les montants remboursés. Ces validations ne remplacent pas une session chez Google/Apple, un achat sandbox PayPal ou une autorisation Stripe réelle de test.

## CI/CD et Git

Les contrôles ordinaires exécutent la suite navigateur complète dans quatre jobs parallèles, avec une base et un processus applicatif isolés : Chromium, Firefox et deux partitions WebKit. Chaque partition WebKit utilise un seul worker sur sa propre machine afin de limiter la contention pendant les inspections lourdes. Un test qui ne réussit qu’à la reprise automatique fait échouer la CI ; la reprise conserve seulement les éléments de diagnostic. Un job distinct construit avec des identifiants OAuth synthétiques et exécute les contrats fournisseurs sur trois navigateurs, sans secret externe. Les preuves sont conservées en artifacts. Le simulateur est limité au lanceur de recette et exclu du contexte Docker.

La release commerciale devient manuelle, uniquement depuis `main`, avec la revue de lancement obligatoire. Fusionner les correctifs ne déploie donc pas une boutique non configurée. La détection de secrets conserve les règles par défaut, avec exclusions ciblées des manifestes SHA-256 et des exemples historiques documentés ; les fichiers source restent inspectés.

La protection de `main` impose onze contrôles liés à leurs applications GitHub, une branche à jour, les conversations résolues et un historique linéaire. Les poussées forcées et suppressions sont interdites, y compris pour les administrateurs. Lighthouse reste conditionnel aux modifications applicatives afin de ne pas bloquer les PR de documentation seules.

Les résultats distants de CI, scans d’image et Lighthouse doivent être consultés sur la [PR #67](https://github.com/Vedric/blessp/pull/67) et sa révision publiée. Les résultats locaux ci-dessus ne sont pas une attestation de leur succès.

## Revue des détections historiques

GitGuardian a signalé deux valeurs de test dans l’historique de la branche : un mot de passe utilisé uniquement pour les validations de formulaire et le vecteur public RFC 4226. Les mots de passe de ces tests sont désormais générés ; la fixture MFA est dérivée des octets ASCII publiés dans la RFC. Les tests concernés sont rejoués. Une branche locale conserve l’historique antérieur au regroupement ; aucun historique de `main` n’est réécrit. Les nouveaux contrôles distants portent sur le commit regroupé.

## Nettoyage après revue

Le worker et le producteur BullMQ inutilisés, leur connexion Redis dédiée et leur dépendance ont été retirés. Les emails critiques restent envoyés par l’outbox PostgreSQL et la maintenance existante. Trois tests unitaires portaient uniquement sur ce producteur supprimé ; les tests de paiement, notification et reprise de l’outbox sont conservés. La suite finale comporte 513 tests et 36 suites. Le DTO de paiement ne déclare plus de devise client. L’animation Skeleton utilise le nom déclaré dans Tailwind et respecte explicitement la réduction des animations.

## Reprise après la première CI parallèle

Sur `f7ce2fe`, Chromium réussit ses 172 cas. Firefox réussit 171 cas et échoue deux fois sur la reprise de la vidéo ; WebKit réussit 171 cas directement et un cas après reprise, ce qui bloque volontairement la CI. Les rapports de ce lancement restent dans [GitHub Actions](https://github.com/Vedric/blessp/actions/runs/35197878099).

La reproduction Firefox locale échoue six fois avant correction : le fichier MP4 est chargé, mais le moteur reste sans source décodable faute de bibliothèque système H.264. Firefox peut utiliser WebM/VP9 indépendamment de cette bibliothèque, comme le précise la [documentation Mozilla](https://support.mozilla.org/en-US/kb/audio-and-video-firefox). Une version WebM sans piste audio du fichier existant est désormais proposée avant le MP4. L'échec des deux sources conserve le poster et retire le contrôle de lecture inutilisable ; une ancienne promesse de lecture interrompue ne modifie plus l'état de la lecture suivante.

La conversion a utilisé FFmpeg dans un conteneur Debian jetable, sans installation privilégiée sur le poste :

```sh
ffmpeg -i blessp_video.mp4 -an -c:v libvpx-vp9 -b:v 0 -crf 34 \
  -row-mt 1 -threads 2 -deadline good -cpu-used 2 blessp_video.webm
```

L'assertion de lecture conserve le contrôle du temps vidéo réellement écoulé et le vérifie aussi avant redimensionnement. Un scénario supplémentaire exerce l'indisponibilité des deux formats. La matrice générale comporte désormais 173 scénarios par moteur, soit 519 cas, auxquels s'ajoutent les 39 cas fournisseurs.

Le délai WebKit concernait la navigation initiale, sans réponse HTTP enregistrée dans la trace ; aucun défaut applicatif spécifique n'est établi par ce seul constat. Les deux partitions à un worker réduisent la contention, et tout nouvel échec ou reprise instable reste bloquant. Les résultats du dernier commit doivent être lus sur la PR avant fusion.

La vérification média locale valide les six scénarios, répétés trois fois sur chaque moteur : 36 réussites Chromium/Firefox, puis 18 réussites WebKit sans reprise automatique. Les premiers lancements WebKit étaient indisponibles faute de bibliothèques configurées ; les bibliothèques déjà extraites dans le dossier d’audit ont été chargées via `LD_LIBRARY_PATH`/`GST_PLUGIN_PATH`. Le contrôle du cache système `ldconfig`, incompatible avec cette installation sans privilèges, a été désactivé uniquement pour ce lancement local ; les navigateurs et toutes les assertions ont réellement été exécutés. La CI installe normalement les dépendances et conserve cette vérification système.

## Restant avant ouverture complète

- Créer les comptes Stripe, PayPal, Google et Apple ; vérifier les domaines, audiences, clés et notifications de chaque environnement.
- Tester les réseaux de cartes demandés et Apple Pay/Google Pay avec les appareils et comptes compatibles. Le support générique par un prestataire ne certifie pas l’éligibilité du marchand.
- Recetter PayPal sandbox avec acheteur distinct : acceptation, refus, interruption, délai, notification retardée et remboursement ; rapprocher tous les états avec l’administration.
- Recetter Google et Apple réels, y compris email masqué Apple, profil incomplet, MFA et retour au parcours d’achat. La liaison de plusieurs modes à un compte existant nécessite encore un parcours explicite ; aucune fusion automatique par email.
- Finaliser fiscalité, règles de livraison/retour, textes légaux, catalogue, emails réels, sauvegardes, alertes, charge et appareils physiques selon la [checklist de lancement](../../LAUNCH_CHECKLIST.md).

Aucun compte créé auprès d’un fournisseur, paiement réel ou déploiement commercial n’a été effectué pendant cette passe.
