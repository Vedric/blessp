# Deuxième passe : référencement, accessibilité et chargement

**16 septembre 2026 — suite des [premiers correctifs](CORRECTIFS.md).** Les modifications restent locales. La validation utilise une nouvelle base PostgreSQL jetable, des données synthétiques et les fournisseurs externes neutralisés.

## Corrections apportées

### Référencement et partage

Express produit désormais les titres, descriptions, URL canoniques, OpenGraph, Twitter et prix CAD des produits actifs dans le HTML initial. Les champs issus de la base sont échappés ; les URL d’image non HTTP(S) sont rejetées. Les URL publiques proviennent de `CLIENT_URL`, sans faire confiance aux en-têtes Host ou X-Forwarded-Host. Un test protège également les caractères `$` contre l’interprétation spéciale des chaînes de remplacement JavaScript.

Les produits absents, inactifs ou supprimés et les routes inconnues répondent réellement 404. Les pages privées et transactionnelles portent `noindex`. Les paramètres marketing sont retirés des URL canoniques ; les pages de catalogue paginées conservent leur numéro et les filtres ne créent pas de pages indexables supplémentaires. Les métadonnées suivent aussi les navigations React, sans conserver les prix d’un produit après son départ.

`/robots.txt` et les sitemaps utilisent le domaine configuré. Le sitemap des produits est paginé par 1 000 entrées, inclut leur date de modification et exclut les produits indisponibles. Les pages portant `noindex` restent accessibles aux robots pour qu’ils puissent lire cette directive. Le comportement est documenté dans [le guide de déploiement](../../deployment.md).

Ces changements rendent les métadonnées lisibles sans JavaScript ; le corps React reste rendu par le navigateur. Ils ne constituent pas un rendu serveur complet ni une garantie d’indexation. Voir les [principes de référencement JavaScript de Google](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).

### Interface et accessibilité

- Recherche et guide des tailles : dialogue nommé, focus contenu, boucle Tab/Shift+Tab, Escape et restitution du focus au déclencheur.
- Verrouillage du défilement partagé entre fenêtres superposées ; seul le dialogue supérieur reçoit les interactions clavier du gestionnaire commun.
- Recherche : les réponses anciennes ne remplacent plus les résultats d’une requête récente ; fermeture et démontage invalident les opérations en attente.
- Fiche produit : changement d’identifiant protégé contre les réponses obsolètes et réinitialisation des choix liés au produit précédent.
- Inscription : boutons d’affichage des mots de passe agrandis. Champs partagés : identifiants uniques et association explicite des erreurs aux champs.
- Lien d’évitement placé avant la navigation et menant au contenu principal ; hiérarchie des titres des filtres corrigée ; page 404 titrée et champ de recherche nommé.
- Vidéo d’accueil : commande pause/reprise, absence de téléchargement automatique sur petit écran, avec économie de données ou préférence de mouvement réduit. La configuration d’animation respecte cette préférence ; l’indicateur décoratif ne boucle plus indéfiniment.

Les tests automatiques axe exécutent les règles marquées WCAG 2 A/AA, 2.1 AA et 2.2 AA sur neuf pages supplémentaires et deux dialogues, avec des parcours clavier dédiés. Ils complètent les pages de la première passe ; ils ne certifient pas une conformité exhaustive au lecteur d’écran.

### Chargement et outillage

La page d’accueil entre dans le bundle initial pour éviter une requête de module supplémentaire avant son affichage. Les deux polices latines utilisées au premier écran sont préchargées ; Vite transforme leurs chemins en assets versionnés. Le fondu initial du conteneur de page a été retiré. Le diagnostic suit les recommandations concernant les [délais du LCP](https://web.dev/articles/optimize-lcp) et les [priorités de chargement](https://web.dev/articles/fetch-priority).

Le préchargement forcé du poster a été essayé puis retiré après mesure comparative : avec les autres changements identiques, le passage mobile sans cette priorité atteint 89 / 3 360 ms contre 82 / environ 4 509 ms avec elle. Retirer le préchargement des polices dégrade au contraire la mesure à 80 / 4 364 ms. Les variantes et leurs résultats sont conservés ; une recommandation générale de préchargement ne remplace pas la mesure de cette application.

La couverture Jest génère maintenant explicitement `coverage-summary.json` : un ancien fichier non régénéré ne peut plus être confondu avec la mesure récente. Le libellé JSX qui empêchait une analyse complète par Semgrep a également été corrigé.

## Validation finale

| Contrôle | Résultat |
|---|---|
| ESLint serveur/client, TypeScript et build Vite | Réussis |
| Jest avec PostgreSQL, 2 workers | **418 tests, 29 suites, tous réussis** |
| Couverture | **86,34 % statements ; 73,14 % branches ; 82,38 % fonctions ; 87,64 % lignes** |
| Playwright Chromium | **67 tests réussis**, aucun ignoré |
| Nouveaux tests | 20 tests HTTP de métadonnées/sitemaps ; 18 parcours navigateur supplémentaires |
| Axe sur les nouvelles pages et dialogues | Aucune violation des règles exécutées |
| npm audit, trois lockfiles, développement compris | Aucune vulnérabilité signalée |
| Semgrep | 74 règles, 213 fichiers, aucune alerte ni erreur de parsing |
| Gitleaks | 346 fichiers exportés, seul le vecteur public RFC 4226 des tests MFA est signalé ; aucun secret réel confirmé |
| Docker reconstruit | Utilisateur non root, CLI de migration et seed compilé fonctionnels, contrôles runtime réussis |
| Trivy sur cette image | Aucune vulnérabilité signalée, toutes sévérités |

Le runtime vérifie aussi les métadonnées échappées d’un produit synthétique, son prix, le domaine configuré, les sitemaps, l’exclusion après désactivation, les réponses 404, les métriques protégées et la politique de cache/compression. L’identifiant de l’image testée est `sha256:470be75b500c36a62c22625b2bd134b4305dda8b60afd3d4014d5f6e525a3cf4`.

Les preuves de cette passe sont séparées des précédentes dans [preuves-suite](preuves-suite/). Les commandes reproductibles restent celles du [README](../../../README.md#vérifications-reproductibles). Les rapports navigateur détaillés sont dans `client/playwright-report/` et les derniers rapports Lighthouse HTML dans `artifacts/lighthouse/`.

## Mesures finales de chargement

Trois passages séquentiels par page, sur le même build final, sans tests ni scans concurrents. Les valeurs ci-dessous sont les médianes ; les douze mesures et leurs plages sont dans [lighthouse-final.json](preuves-suite/lighthouse-final.json). Simulation locale Lighthouse 13.4.1, sans mesure d’utilisateurs réels.

| Page | Performance | Accessibilité | Bonnes pratiques | SEO | LCP médian | CLS médian |
|---|---:|---:|---:|---:|---:|---:|---:|
| Accueil desktop | 99 | 100 | 96 | 100 | 705 ms | 0 |
| Boutique desktop | 90 | 100 | 96 | 100 | 1 914 ms | 0,085 |
| Connexion desktop | 100 | 100 | 96 | 66 | 686 ms | 0 |
| Accueil mobile | 90 | 100 | 96 | 100 | 3 364 ms | 0 |

L’accueil mobile obtient 90 dans les trois passages, avec un LCP entre 3 355 et 3 368 ms. Le premier bilan avait relevé 84 / 3 746 ms en un seul passage. La boutique mesure en revanche 90 / 1 914 ms contre 97 / 823 ms dans ce premier bilan : sa performance reste un point de suivi. Ces comparaisons avec une ancienne mesure unique ne remplacent pas un essai contrôlé sur mobiles réels. La connexion varie de 97 à 100 et reste volontairement non indexable, ce qui explique son SEO de 66.

Le 401 attendu du renouvellement de session anonyme reste compté comme erreur console par Lighthouse, d’où 96 en bonnes pratiques. Le script applique des seuils d’accessibilité, de bonnes pratiques et de SEO ; le score de performance est enregistré sans seuil bloquant. Les [variantes testées](preuves-suite/lighthouse-variants.json), y compris celles qui ont dégradé la mesure, restent disponibles.

## Limites conservées

La recette réelle Stripe, email, OAuth, GitHub, la migration d’une copie des données métier, la restauration des sauvegardes et les décisions fiscales, commerciales et de rétention restent décrites dans [PRODUCTION_READINESS.md](../../PRODUCTION_READINESS.md). Aucun service externe n’a été modifié, aucun paiement ou mail réel n’a été envoyé et aucun déploiement n’a été réalisé.
