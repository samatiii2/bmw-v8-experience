# BMW M3 GTS — étude du V8

Une expérience web pour explorer le V8 atmosphérique S65B44 de la
BMW M3 GTS E92 : maquette 3D procédurale avec Three.js, atelier de démontage
et coupe pédagogique 2D. Les fichiers et la bibliothèque sont servis localement,
sans CDN ni modèle distant.

## Lancer le site

Depuis ce dossier, exécutez :

```sh
npm ci
npm start
```

Puis ouvrez [http://localhost:4173](http://localhost:4173). Python 3 est requis
pour le serveur statique, ainsi que Node.js et npm pour préparer les fichiers.
`npm start` génère `_site/` puis le sert ; relancez-le après une modification.
`npm run check` vérifie la syntaxe JavaScript. `npm run build` prépare le
site statique dans `_site/`, avec les modules Three.js et leur licence.

## Voir la version en ligne

Avant la première publication, activez GitHub Pages dans **Settings → Pages →
Build and deployment → Source: GitHub Actions**. Sans cette configuration,
`configure-pages` ne trouve pas encore de site Pages et le déploiement échoue.
Le workflow publie ensuite automatiquement le site à
[https://samatiii2.github.io/bmw-v8-experience/](https://samatiii2.github.io/bmw-v8-experience/).
Il se lance à chaque mise à jour de `main` ou de la branche de travail actuelle.
La première publication peut prendre quelques minutes ; son état et son URL
s’affichent dans **Actions → Deploy to GitHub Pages**.

## Explorer

- Faites glisser le moteur pour l’orienter ; utilisez la molette ou le pincement
  pour zoomer. Cinq vues caméra donnent accès aux différents angles.
- Sur le canvas au clavier, les flèches tournent la caméra, `+` et `−` zooment.
  Tous les ensembles sont aussi sélectionnables avec les boutons sous la vue.
- Démontez progressivement le moteur, puis remontez-le. La vue intérieure
  dégage les pièces mobiles ; désactivez-la pour voir les enveloppes.
- Sélectionnez et isolez l’un des dix ensembles pour observer ses détails.
- Modifiez l’accélérateur : les papillons s’ouvrent et les pistons, bielles,
  soupapes, arbres à cames et vilebrequin s’animent ensemble.
- Mettez la mécanique en pause ou figez un angle précis avec le curseur de
  cycle. Sélectionner un des quatre temps met également la mécanique en pause.
- Lancez la visite guidée : sept étapes caméra / démontage. La progression
  automatique s’arrête lorsque le moteur est en pause, hors écran ou l’onglet
  masqué. « Étape suivante » reste disponible. Une manipulation manuelle du
  modèle met fin à la visite ; l’accélérateur reste utilisable pendant celle-ci.
- « Réinitialiser » restaure le ralenti, l’angle initial, le moteur assemblé,
  la vue intérieure et la caméra de départ.

## Limites de la représentation

Ce modèle pédagogique est construit avec des géométries procédurales, pas à
partir de plans BMW : proportions, conduits et détails de fabrication sont
simplifiés. Il illustre le V à 90°, le vilebrequin en croix, les huit pistons,
les 32 soupapes et les quatre arbres à cames. Ce n’est ni une CAO constructeur,
ni un outil de réparation ou de simulation physique. La distribution ne
reproduit pas le calage variable VANOS. Les particules représentent les flux,
sans calcul thermodynamique ni simulation du circuit d’huile.

La rotation est affichée à 2 % du régime indiqué pour rendre le cycle lisible.
La relation accélérateur / régime est illustrative, sans charge ni transmission
simulées. Le démontage sépare des ensembles, pas chaque vis individuellement.

WebGL 2 est nécessaire pour la 3D. Si le rendu ne peut pas être initialisé ou si
son contexte est perdu, la coupe SVG interactive reste disponible, de même
que l’accélérateur et les explications. Elle peut aussi être ouverte sous la 3D.
Avec la préférence de réduction des animations, la mécanique est figée,
les transitions sont immédiates et la visite avance manuellement ; le curseur
du cycle permet toujours d’explorer les mouvements.
