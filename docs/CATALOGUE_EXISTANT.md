# Catalogue et médias existants

Inventaire du 18 septembre 2026. Les photos des produits sont déjà dans le dépôt ; il n’est pas nécessaire de les redemander pour préparer le catalogue. Cette inspection porte sur les fichiers et leurs références dans le code, pas sur un inventaire physique ni sur une base commerciale.

## Repères dans l’arborescence

| Emplacement | Contenu et rôle |
| --- | --- |
| `client/public/img/` | 29 fichiers : 13 photos distinctes utilisées par les fiches, une photo de marque, logos et éléments graphiques. Source publique effectivement copiée dans le build. |
| `client/public/video/` | Vidéo de marque en MP4 et WebM, utilisée sur l’accueil. |
| `img/` | 27 fichiers historiques, tous identiques octet par octet à leur homonyme dans `client/public/img/`. Aucune photo produit supplémentaire. |
| `video/` | Copie historique du MP4 public, identique octet par octet. |
| `server/prisma/seed.ts` | Huit fiches de démonstration, descriptions, prix, galeries, tailles, couleurs et stock synthétique. Le catalogue est volontairement ignoré en production. |
| `server/prisma/schema.prisma` et `migrations/` | Modèles produits, variantes, commandes et mouvements de stock. |
| `client/src/pages/` et `components/` | Boutique, fiches, galeries, panier, compte et administration. L’accueil réutilise les photos du catalogue et `blessp_story.jpeg`. |
| `server/src/features/` et `core/` | API métier et infrastructure. Les produits renvoyés par l’API proviennent de PostgreSQL. |
| `client/tests/`, `server/tests/` | Parcours navigateur, tests unitaires et intégration. Les données y sont synthétiques. |
| `docs/`, `scripts/`, `config/`, `.github/` | Documentation, outils de lancement, exemple de revue commerciale et workflows. |
| `artifacts/`, rapports, couvertures et répertoires de build | Preuves et fichiers produits par les validations ; leurs captures ne constituent pas un autre shooting produit. |

L’exploration a aussi inclus les copies de travail locales cachées, sans les modifier. Une ancienne version JPEG de `pink_hoody_1` y subsiste : c’est une capture avec bandes noires et barre de téléphone, pas une nouvelle vue produit. Le PNG public actuel reprend le détail sans ces bordures.

Le parcours des fichiers locaux a exclu le contenu des dépendances `node_modules` et des objets internes `.git`. Aucun fichier CSV, Excel ou ODS d’inventaire commercial n’a été trouvé dans ce périmètre.

## Fiches déjà préparées

Les montants ci-dessous sont ceux du **seed de démonstration**, pas des prix de vente validés.

| Fiche existante | Photos associées | Prix de démonstration, CAD |
| --- | --- | --- |
| Classic Black Hoodie | `black_hoody_1`, `black_hoody_2`, `black_hoody_3` | 89,99 |
| Ocean Blue Hoodie | `blue_hoody_1`, `blue_hoody_2` | 89,99 |
| Rose Pink Hoodie | `pink_hoody_2`, `pink_hoody_1.png` | 89,99 |
| Rose Pink Pants | `pink_hoody_1.png` | 69,99 |
| Essential Blue Pants | `blue_pants_1` | 69,99 |
| Black Hoodie & Pants Set | `black_hoody_n_pants_1`, `black_hoody_n_pants_2` | 149,99 |
| Blue Hoodie & Pants Set | `blue_hoody_n_pants_1` | 149,99 |
| Pink Hoodie & Pants Set | `pink_hoody_n_pants_1`, `pink_hoody_n_pants_2` | 149,99 |

Chaque fiche propose actuellement S, M, L et XL dans sa couleur, avec 20 unités initiales par variante au premier seed. Cela représente 32 variantes de démonstration. Ces quantités et tailles ne prouvent pas le stock disponible. Aucun pantalon noir vendu seul n’est défini dans ce seed, même si le pantalon apparaît sur les photos d’ensemble.

## Photos vérifiées

Les 13 photos produit ont été ouvertes et examinées visuellement. Tous les fichiers raster publics ont passé une vérification de décodage. Aucun chemin d’image du seed ne manque ; les 13 fichiers produits sont également présents à l’identique dans le build local inspecté.

| Fichier public | Dimensions, pixels | Taille, octets |
| --- | --- | --- |
| [black_hoody_1.jpeg](../client/public/img/black_hoody_1.jpeg) | 1365 × 2047 | 63,533 |
| [black_hoody_2.jpeg](../client/public/img/black_hoody_2.jpeg) | 946 × 1372 | 89,222 |
| [black_hoody_3.jpeg](../client/public/img/black_hoody_3.jpeg) | 1365 × 2047 | 83,238 |
| [black_hoody_n_pants_1.jpeg](../client/public/img/black_hoody_n_pants_1.jpeg) | 946 × 1345 | 75,716 |
| [black_hoody_n_pants_2.jpeg](../client/public/img/black_hoody_n_pants_2.jpeg) | 1365 × 2047 | 78,486 |
| [blue_hoody_1.jpeg](../client/public/img/blue_hoody_1.jpeg) | 1365 × 2047 | 127,385 |
| [blue_hoody_2.jpeg](../client/public/img/blue_hoody_2.jpeg) | 1404 × 2047 | 139,270 |
| [blue_hoody_n_pants_1.jpeg](../client/public/img/blue_hoody_n_pants_1.jpeg) | 1364 × 2046 | 766,657 |
| [blue_pants_1.jpeg](../client/public/img/blue_pants_1.jpeg) | 1430 × 2046 | 163,974 |
| [pink_hoody_1.png](../client/public/img/pink_hoody_1.png) | 599 × 773 | 435,033 |
| [pink_hoody_2.jpeg](../client/public/img/pink_hoody_2.jpeg) | 1336 × 2048 | 123,838 |
| [pink_hoody_n_pants_1.jpeg](../client/public/img/pink_hoody_n_pants_1.jpeg) | 1282 × 1867 | 84,827 |
| [pink_hoody_n_pants_2.jpeg](../client/public/img/pink_hoody_n_pants_2.jpeg) | 1332 × 2048 | 56,593 |

## Points à compléter à partir de l’existant

- Valider les prix et compter les quantités par taille et couleur ; reprendre les photos existantes.
- Confirmer les noms commerciaux, la composition, les mesures, l’entretien et les caractéristiques. Les mentions actuelles « coton biologique », « 400/380 GSM », broderie et résistance à la décoloration ne sont pas démontrées par les photos.
- Décider si les ensembles disposent d’un stock physique séparé ou utilisent les mêmes pièces que les ventes à l’unité. Le code gère actuellement chaque produit indépendamment ; il ne déduit pas automatiquement les composants d’un ensemble.
- Améliorer les vues si possible : le pantalon rose dispose surtout d’un détail, partagé avec le hoodie ; le pantalon bleu n’a qu’un détail et l’ensemble bleu une seule vue arrière. Les autres photos existantes peuvent déjà enrichir les galeries, sans attendre un nouveau shooting.
- Le PNG rose est plus petit (599 × 773) mais pèse environ 425 Kio ; l’ensemble bleu pèse environ 749 Kio. Préparer ultérieurement des formats et tailles adaptés à l’affichage en conservant les originaux.
- Rapprocher les fiches avec les produits réellement vendus, puis les enregistrer par le parcours administratif. Ne pas lancer le seed de démonstration pour remplir la production.

Les médias locaux sont livrés avec l’application ; un service externe de stockage d’images n’est pas nécessaire pour exploiter ce catalogue existant.

## Parcours des recommandations (20 septembre 2026)

La section « Compléter le look » présente désormais le prix de chaque article et un lien vers sa fiche pour sélectionner taille et couleur. Elle ne promet plus une réduction de 10 % absente du calcul serveur et n’ajoute plus silencieusement deux premières variantes au panier. Une panne de recommandations ne bloque pas la fiche principale. Les noms longs reviennent à la ligne sur mobile, y compris dans les produits associés.

Cette correction ne crée pas de stock partagé pour les ensembles et ne valide ni leurs prix ni leurs quantités physiques.
