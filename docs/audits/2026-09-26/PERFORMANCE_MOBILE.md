# Chargement de l’accueil sur mobile

L’accueil attendait le JavaScript pour découvrir la photo principale. Son JPEG
pesait 189 445 octets. Sur la mesure locale de référence, Lighthouse donnait
78 en performance mobile et un LCP de 5 255 ms.

## Changements

La photo est préchargée depuis le HTML de l’accueil avec une priorité élevée.
Les autres pages ne déclenchent pas ce téléchargement. Une image WebP remplace
le poster du lecteur. Elle reste visible jusqu’au début de la vidéo et revient
si la vidéo est indisponible. Les modes mobile, économie de données et réduction
des animations ne chargent toujours aucune vidéo.

Le WebP pèse 106 998 octets, soit 43,5 % de moins que le JPEG. Il garde les
dimensions de 2 048 × 1 574 pixels et le cadrage de la photo. Le JPEG original
reste intact pour le partage et le repli en cas de panne du fichier optimisé.
La section de présentation utilise la même image. Elle réutilise donc le
téléchargement de l’accueil.

`npm run assets:home` reproduit le fichier avec Sharp 0.35.4, qualité 82 et
effort 6. La version est fixée dans le verrou des dépendances. Sharp est un outil
de développement sous licence Apache-2.0. Il n’entre ni dans le JavaScript
client ni dans l’image de production. Ses dépendances directes sont `@img/colour`,
`detect-libc` et `semver`. Les paquets natifs optionnels couvrent les plateformes
prises en charge. L’audit des dépendances ne signale aucune vulnérabilité lors
de l’ajout. Le contrôle local confirme la reproduction du WebP et l’absence
de modification du JPEG original.

## Défauts trouvés pendant les essais

Précharger le JPEG seul ne suffisait pas : le score mobile restait à 78.
Le passage à une image WebP distincte du lecteur a réduit le LCP.

Une première version avec `picture` déclenchait aussi le JPEG dans WebKit lors
du montage de l’image. Une image avec `src` direct et repli sur erreur supprime
ce téléchargement inutile.

WebKit rechargeait ensuite le WebP lors du défilement vers son second affichage.
Une page minimale reproduit le défaut avec et sans les variantes de cache
`Origin` et `Accept-Encoding`. Les huit essais donnent deux requêtes avec
la seconde image différée, contre une seule avec son chargement immédiat.
Cette photo déjà préchargée n’utilise donc plus `loading="lazy"`.
Les autres images gardent leur chargement différé. Les en-têtes de cache et
de sécurité restent inchangés.

La revue relève aussi une ancienne hauteur déclarée de 1 536 pixels dans la
section de présentation. Elle est corrigée à 1 574 pixels pour correspondre
au fichier et réserver le bon rapport d’image avant son chargement.

Le test de réutilisation laisse le cache natif actif. La découverte précoce est
vérifiée dans un contexte distinct sans JavaScript. Cette séparation évite un
biais du test : [l’interception des requêtes désactive le cache HTTP](https://playwright.dev/docs/api/class-page#page-route).

## Vérifications locales

- Compilation et lint réussis.
- 543 tests serveur et 20 tests des scripts réussis.
- 48 exécutions des contrôles média réussies, sans retry : huit scénarios,
  deux répétitions, Chromium, Firefox et WebKit.
- 13 parcours Chromium réussis avec une fenêtre visible et un seul worker.
  Ils couvrent les médias, le catalogue, le changement de langue et les pages
  publiques. Les contrôles à 320, 390 et 1 440 px ne détectent ni débordement
  ni image cassée. Les audits axe des pages publiques ne signalent aucune
  violation. Les captures de l’accueil et du catalogue sont aussi inspectées.
- Après la correction des dimensions, 12 contrôles supplémentaires réussissent
  sur les trois moteurs. Ils couvrent les pages publiques à 390 et 1 440 px,
  la réutilisation de la photo et son repli en cas de panne.
- Une seule requête WebP et aucune requête JPEG exigées pour l’accueil sain,
  y compris après défilement vers la section de présentation.
- Repli JPEG vérifié pour les deux emplacements avec une réponse WebP 503.
- Lecture, pause, reprise, changement de largeur et panne des deux formats
  vidéo vérifiés. La navigation vers le catalogue reste utilisable.
- Test HTTP du préchargement sur l’accueil, y compris avec une query de campagne.
  Absence de préchargement sur le catalogue, la connexion, une fiche et une 404.

## Mesures finales

Lighthouse 13.4.1 mesure l’application compilée avec son API réelle et une base
de test isolée. Chaque page utilise un processus et un profil Chromium neufs.
Les réglages mobiles restent ceux du script du dépôt. Aucun autre test
navigateur ne tourne pendant ces mesures.

| Mesure mobile | Référence | Final 1 | Final 2 | Final 3 |
| --- | ---: | ---: | ---: | ---: |
| Performance | 78 | 85 | 85 | 85 |
| LCP | 5 255 ms | 3 916 ms | 3 922 ms | 3 924 ms |
| Octets transférés | 1 245 227 | 1 162 922 | 1 162 922 | 1 162 922 |
| Décalage visuel CLS | 0 | 0 | 0 | 0 |

Le LCP médian final est de 3 922 ms, soit une baisse de 25,4 % par rapport
à cette référence. Le transfert total de la page baisse de 6,6 %. Les trois
passages finaux sont publiés ; le résultat intermédiaire à 90 ne décrit pas
le code livré. Il reste une marge de progression pour le chargement mobile.

La mesure finale sur ordinateur donne 99 pour l’accueil, 98 pour le catalogue
et 100 pour la connexion. L’accessibilité vaut 100 sur les quatre pages
mesurées. Les bonnes pratiques valent 96. Le SEO vaut 100 sur les pages
publiques et 66 sur la connexion, volontairement exclue de l’indexation.
Les variations du catalogue et de la connexion ne sont pas attribuées à cette
modification de l’accueil.

Les journaux, captures et diagnostics sont conservés dans
`artifacts/performance-mobile-20260926/`. Les essais intermédiaires en échec
restent disponibles avec leur explication dans `DIAGNOSTIC.md`.

## Contrôle de la révision en CI

La première CI de `ed69253` bloque une intermittence du parcours d’édition des
photos dans WebKit. Le login, le premier renouvellement de session et la
sauvegarde répondent 200. Le test ouvre ensuite directement l’éditeur dès le
changement d’URL, avant l’affichage de la liste. Deux polices signalent une
erreur interne WebKit. Le renouvellement suivant répond 401 car sa requête ne
contient aucun cookie. La capture montre alors le formulaire de connexion.
La relance du cas réussit, mais la CI reste rouge grâce à `failOnFlakyTests`.

Dix passages locaux du test original ne reproduisent pas la perte du cookie.
Sa cause précise reste indéterminée. Le parcours attend désormais la fiche
dans la liste et utilise son lien Modifier. Il recharge ensuite réellement
l’éditeur et exige une réponse 200 au renouvellement de session, le nom du
produit et la bonne langue. Les contrôles de sauvegarde, d’ordre des photos
et de suppression restent présents. Aucun délai ni nombre de retries n’est
augmenté. Le test ne réinjecte pas de cookie et ne reconnecte pas l’utilisateur.
Ce parcours renforcé réussit ensuite cinq fois par langue et par moteur,
soit 30 exécutions sans retry. Les 543 tests serveur passent de nouveau après
les modifications des textes et des métadonnées.

Les règles de rédaction sont aussi appliquées aux textes de l’interface,
aux titres HTML et aux sujets de newsletter. Les intervalles de prix utilisent
« à » ou « to ». Les valeurs manquantes affichent « N/D » ou « N/A ».
Le message promotionnel de la bibliothèque de traduction est désactivé par
son option prévue à cet effet. Les erreurs de console restent visibles.
Les cinq derniers parcours Chromium avec une fenêtre visible passent. Leurs
traces ne contiennent plus le message promotionnel. Le contrôle des fichiers
suivis dans `client`, `server`, `scripts` et `config` ne trouve plus de tiret
cadratin. Les titres de partage, les changements de langue à 320 et 1 440 px,
la newsletter et la photo d’accueil sont vérifiés dans cette session.

Les mesures locales servent à comparer les versions. Elles ne remplacent pas
les mesures sur le domaine déployé et sur des téléphones physiques.
Les conditions d’ouverture commerciale restent dans la
[checklist de lancement](../../LAUNCH_CHECKLIST.md).
