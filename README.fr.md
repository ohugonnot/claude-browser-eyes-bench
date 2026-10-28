# claude-browser-eyes-bench

Un banc d'essai reproductible qui montre ce que « voient » les navigateurs pilotés par Playwright (Chromium, Firefox, WebKit) sur une page à huit défauts connus, à trois viewports : mobile 390x844, tablette 820x1180, bureau 1440x900.

C'est le compagnon d'un article de blog sur les outils qui donnent un navigateur à un agent de code. C'est aussi fait pour vous : servez la même page, donnez le même [prompt](PROMPT.md) à votre outil (serveur MCP, extension, script) et comparez son rapport à [DEFECTS.md](DEFECTS.md) (en anglais ; les défauts sont aussi listés plus bas).

Article : à venir. English version: [README.md](README.md).

## Lancer

Il faut Docker avec Compose, rien d'autre (ni Node ni Playwright sur la machine).

```sh
docker compose run --rm bench
```

La commande construit l'image (l'image officielle de Playwright, épinglée en v1.64.1 et par son digest), démarre un petit serveur statique dans le conteneur, audite `site/` et `site-fixed/` dans les trois moteurs aux trois viewports, écrit `out/report.json` et `out/*.png`, puis lance `bench/check.mjs`. Le code de sortie est non nul si quoi que ce soit diffère de l'attendu.

Le conteneur tourne avec l'uid/gid 1000 pour que `out/` vous appartienne. Autre uid : `BENCH_UID=$(id -u) BENCH_GID=$(id -g) docker compose run --rm bench`.

Pour tester un autre outil sur la même page :

```sh
docker compose up site          # http://localhost:8099/  (127.0.0.1 uniquement)
docker compose up site-fixed    # http://localhost:8100/  la même page, défauts corrigés
```

## Contenu

| chemin | rôle |
|---|---|
| `site/` | la page testée (en français, formulations neutres ; elle ne décrit jamais ses propres défauts) |
| `site-fixed/` | la même page sans les huit défauts, produite par `bench/make-fixed.mjs` (un correctif par défaut, dérive vérifiée) |
| `audit/audit.js` | l'audit : une fonction asynchrone injectée dans la page |
| `bench/run.mjs` | exécuteur Playwright (3 moteurs x 3 viewports x 2 pages), rapport et captures |
| `bench/check.mjs` | verdict réussite/échec (voir ci-dessous) |
| `bench/expected.json` | les défauts que chaque moteur doit signaler, par viewport |
| `DEFECTS.md` | la vérité terrain |
| `PROMPT.md` | le prompt à donner à un outil ou à un agent, sans liste de défauts |

`check.mjs` échoue sauf si (1) `site/` produit exactement les défauts attendus par moteur et par viewport, (2) `site-fixed/` ne produit aucune alerte, de quelque nature que ce soit, (3) `site-fixed/` est exactement `site/` plus les correctifs documentés, (4) le rapport couvre chaque moteur et chaque viewport avec la version de Playwright épinglée. L'exécuteur ne lit pas `DEFECTS.md` : l'audit détecte par nature de constat, et la comparaison avec `expected.json` vient après.

Le mobile utilise `devices['iPhone 15']` (tactile, user agent mobile) avec viewport et écran forcés à 390x844 ; la tablette utilise `devices['iPad (gen 7)']` ; le bureau utilise le descripteur de bureau du moteur. Firefox n'a pas de mode mobile : `isMobile` y est retiré.

## Les huit défauts

| id | défaut | viewport | moteurs |
|----|--------|----------|---------|
| D1 | Débordement horizontal : un bloc fixé à 600 px de large | mobile | tous |
| D2 | Texte de carte coupé (hauteur fixe 90 px + `overflow:hidden` entre 700 et 900 px) ; le titre en position absolue frôle le texte | tablette | tous |
| D3 | Deux boutons de 26 px de haut, collés (0 px entre eux) | tous | tous |
| D4 | Bandeau d'accueil en `height:100vh` avec son bouton collé au bord bas : sur un vrai iPhone dans Safari, la barre d'adresse le masque (comportement attendu, non vérifié sur un vrai iPhone ici) | iOS Safari réel uniquement | aucun des trois moteurs sans écran |
| D5 | `height: calc-size(auto, size + 24px)` après un repli à 40 px : les moteurs qui ne connaissent pas `calc-size()` ignorent la déclaration et le texte déborde sur la section suivante | tous | Firefox 157 et WebKit 27.2 ; pas Chromium (qui le gère : ce n'est pas un défaut chez lui) |
| D6 | Erreur JavaScript au clic : `calculerTotal` n'est pas définie | tous, au clic | tous |
| D7 | Requête en 404 : `GET api/promotions.json` au chargement | tous | tous |
| D8 | `<img>` sans `alt` et légende en `#aaa` sur `#fff` (contraste 2,32:1, sous 4,5:1) | tous | tous |

Résultat attendu (`bench/expected.json`) : Chromium 7 sur 7 défauts applicables (D5 n'existe pas chez lui), Firefox 8 sur 8, WebKit 8 sur 8. Détail (sélecteurs, correctifs) : [DEFECTS.md](DEFECTS.md).

## Ce que l'audit détecte, et comment

| méthode | contrôles |
|---|---|
| Rendu (mesuré sur la page vivante, par moteur et par viewport) | débordement horizontal, contenu coupé par `overflow:hidden`, cibles tactiles de moins de 44 px et proches l'une de l'autre, `<img>` sans `alt`, contraste du texte sous 4,5:1 |
| Événements (collectés par l'exécuteur, pas par la fonction injectée) | erreurs de page non interceptées après appui sur chaque bouton, réponses HTTP à partir de 400, requêtes échouées, erreurs et avertissements de console |
| Heuristique statique (lue dans le CSS, pas dans la mise en page) | hauteurs de type `100vh` (D4) ; déclarations `calc-size()` que `CSS.supports` refuse dans le moteur utilisé (D5 ; le texte de la feuille de style est lu car une déclaration rejetée disparaît du CSSOM) |

D4 est l'exception honnête. C'est un vrai problème d'iOS Safari qu'aucun moteur sans écran ne reproduit : dans Chromium, Firefox et WebKit, même avec le descripteur iPhone, `100vh` vaut `innerHeight`. Le banc ne trouve donc D4 que par la règle statique, et l'heuristique signalerait aussi des usages anodins de `vh`. Un contrôle par le rendu demande un vrai iPhone ou un simulateur sur Mac, que ce dépôt n'a pas.

## Mesures de l'étude

Ces chiffres sont ceux de l'étude que ce banc accompagne, pas la sortie de ce dépôt. Banc : WSL2 avec Docker, image `mcr.microsoft.com/playwright:v1.64.1-noble`, Playwright 1.64.1 en script, 3 passes, médiane (écart max-min entre parenthèses), en millisecondes. « Démarrage » va du lancement à la première capture ; « tâche » est le travail complet : 3 viewports, capture pleine page, audit, clic sur chaque bouton, console et réseau.

| moteur (version lue dans le navigateur) | démarrage | tâche | défauts trouvés |
|---|---|---|---|
| Chromium 156.0.8078.4 | 5 778 (122) | 7 158 (58) | 7 sur 7 applicables |
| Firefox 157.0 | 2 269 (77) | 4 406 (114) | 8 sur 8 |
| WebKit 27.2 | 1 916 (131) | 3 748 (177) | 8 sur 8 |

Remarques de l'étude : les chiffres de Chromium incluent environ 3 s perdues sur un clic qui expire en émulation tactile sur une page qui déborde (WebKit et Firefox cliquent normalement). 0 échec sur 3 passes. L'audit de l'étude était du même genre (fonction injectée) : ces nombres disent la vitesse de chaque moteur sur la tâche et ce qu'il peut détecter, pas quel outil est meilleur ; les défauts trouvés sont identiques pour tous les candidats.

Réserve pour les réutiliser ici : la page de ce dépôt est une version reformulée et nettoyée de celle de l'étude (textes neutres, pas d'avertissements d'accessibilité étrangers aux défauts), donc les durées ci-dessus n'ont pas été mesurées sur cette page exacte. `out/report.json` enregistre les durées de votre propre exécution.

## Vérifié / non vérifié

| | statut |
|---|---|
| `docker compose run --rm bench` se termine avec le code 0 depuis un clone neuf, sur Docker avec WSL2 (Linux x86-64) | vérifié |
| `site/` produit les défauts attendus (7 en Chromium, 8 en Firefox et WebKit) et `site-fixed/` ne produit aucune alerte, aux 3 viewports | vérifié |
| `check.mjs` sort avec un code non nul quand l'audit est affaibli, quand `site-fixed/` retrouve un défaut, ou quand `expected.json` exige un neuvième défaut | vérifié par des mutations faites à la main |
| D4 tel qu'il apparaît sur un vrai iPhone (barre Safari dynamique) | non vérifié : pas d'appareil réel ; seule la règle statique s'exécute |
| Coût en tokens d'image d'une capture pour un modèle | non mesuré ; seules les tailles de fichiers figurent dans l'étude |
| Serveurs MCP et CLI de l'étude (Playwright MCP, Chrome DevTools MCP, ...) | mesurés dans l'étude, **non** exécutés par ce dépôt |
| Extensions de navigateur pilotant un vrai profil | non testé, ni dans l'étude ni ici |
| Un modèle qui juge la page | non fait : l'audit est un programme |
| Hôtes Windows, macOS, ARM | non vérifié |

## Limites

- L'audit est un programme injecté, pas un modèle qui juge. Il ne départage pas les outils : tout outil capable d'exécuter la même fonction trouve les mêmes défauts. Ce que le banc teste, c'est ce qu'un outil est capable de détecter, et ce qu'il rapporte quand vous le questionnez avec vos mots (utilisez [PROMPT.md](PROMPT.md) et notez à la main).
- Trois moteurs sous Linux ne sont pas trois vrais appareils : WebKit pour Linux n'a ni barre dynamique, ni zone de sécurité, ni rendu des polices d'iOS.
- En émulation tactile Chromium sur la page mobile qui déborde, un vrai clic sur un bouton peut expirer ; l'exécuteur envoie alors l'événement de clic et le consigne (`clicks.fallback` dans `report.json`).
- Le léger chevauchement du titre de carte (D2) se voit sur la capture mais n'est pas détecté par l'audit.
- Le banc ne fait aucune requête vers Internet à l'exécution, hormis la construction de l'image.

## Licence

MIT, voir [LICENSE](LICENSE).
