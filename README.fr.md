# claude-browser-eyes-bench

Un banc d'essai reproductible qui montre ce que « voient » les navigateurs pilotés par Playwright (Chromium, Firefox, WebKit) sur une page à huit défauts connus, à trois viewports : mobile 390x844, tablette 820x1180, bureau 1440x900.

C'est le compagnon d'un article de blog sur les outils qui donnent un navigateur à un agent de code. C'est aussi fait pour vous : servez la même page, donnez le même [prompt](PROMPT.md) à votre outil (serveur MCP, extension, script) et comparez son rapport à [DEFECTS.md](DEFECTS.md) (en anglais ; les défauts sont aussi listés plus bas).

Article : à venir. English version: [README.md](README.md).

## Lancer

Il faut Docker avec Compose, rien d'autre (ni Node ni Playwright sur la machine).

```sh
docker compose run --rm --build bench
```

`--build` garantit que l'image correspond à vos fichiers (sans lui, Compose réutilise une image plus ancienne). La commande construit l'image (l'image officielle de Playwright, épinglée en v1.64.1 et par son digest), démarre un petit serveur statique dans le conteneur, audite `site/` et `site-fixed/` dans les trois moteurs aux trois viewports, écrit `out/report.json` et `out/*.png`, lance d'abord quelques tests unitaires, puis `bench/check.mjs`. Le code de sortie est non nul si quoi que ce soit diffère de l'attendu.

Le conteneur tourne avec l'uid/gid 1000 pour que `out/` vous appartienne. Autre uid : `BENCH_UID=$(id -u) BENCH_GID=$(id -g) docker compose run --rm --build bench`. Voir [Dépannage](#dépannage).

Pour tester un autre outil sur la même page :

```sh
docker compose up --build site          # http://localhost:8099/  (127.0.0.1 uniquement ; BENCH_PORT=18099 pour changer)
docker compose up --build site-fixed    # http://localhost:8100/  la même page, défauts corrigés (BENCH_FIXED_PORT)
docker compose down                     # quand vous avez fini
```

## Contenu

| chemin | rôle |
|---|---|
| `site/` | la page testée (en français, formulations neutres ; elle ne décrit jamais ses propres défauts) |
| `site-fixed/` | la même page sans les huit défauts, produite par `bench/make-fixed.mjs` (un correctif par défaut, dérive vérifiée) |
| `audit/audit.js` | l'audit : une fonction asynchrone injectée dans la page |
| `bench/run.mjs` | exécuteur Playwright (3 moteurs x 3 viewports x 2 pages), rapport et captures |
| `bench/check.mjs` | verdict réussite/échec (voir ci-dessous) |
| `bench/canary/` | une troisième page qui montre chaque nature de constat, pour prouver à chaque exécution que chaque détecteur fonctionne |
| `bench/expected.json` | par moteur : les défauts et les constats bruts que `site/` doit montrer, par viewport |
| `bench/test/` | tests unitaires (serveur statique, logique du verdict) |
| `DEFECTS.md` | la vérité terrain |
| `PROMPT.md` | le prompt à donner à un outil ou à un agent, sans liste de défauts |

`check.mjs` échoue sauf si toutes ces conditions sont réunies :
1. le rapport a été produit à partir des fichiers présents sur le disque (un `out/report.json` périmé est refusé) ;
2. `site/` produit exactement les identifiants de défauts attendus **et** exactement les constats bruts attendus (débordement, contenu coupé, cibles petites, cibles proches, `<img>` sans `alt`, contraste faible, règle `vh`, CSS non géré, erreurs de page, erreurs HTTP, requêtes échouées, messages de console), par moteur et par viewport ;
3. `site-fixed/` ne produit aucun constat, de quelque nature que ce soit, et chaque bouton y est réellement cliquable ;
4. la page canari, qui montre une fois chaque nature de constat, est détectée nature par nature. Désactiver un seul détecteur de l'audit ou de l'exécuteur fait donc passer le contrôle au rouge, même si un autre détecteur signale encore le même défaut ;
5. l'audit a lu chaque feuille de style (il consigne dans `notes` ce qu'il n'a pas pu lire) et rien n'a tenté de sortir de localhost (voir ci-dessous) ;
6. `site-fixed/` est exactement `site/` plus les correctifs documentés.

L'exécuteur ne lit pas `DEFECTS.md` : l'audit fonctionne par nature de constat, et la comparaison avec `expected.json` vient après.

**Hors ligne.** Le service `bench` tourne sans aucun réseau (`network_mode: none`), et l'exécuteur interrompt et consigne en plus toute requête vers un hôte autre que localhost. Le canari en contient une exprès, pour prouver que la garde fonctionne. La construction de l'image, elle, a besoin du réseau (npm, image de base).

Le mobile utilise `devices['iPhone 15']` (tactile, user agent mobile) avec viewport et écran forcés à 390x844 ; la tablette utilise `devices['iPad (gen 7)']` ; le bureau utilise le descripteur de bureau du moteur. Firefox n'a pas de mode mobile : `isMobile` y est retiré.

## Les huit défauts

| id | défaut | viewport | moteurs |
|----|--------|----------|---------|
| D1 | Débordement horizontal : un bloc fixé à 600 px de large | mobile | tous |
| D2 | Texte de carte coupé (hauteur fixe 90 px + `overflow:hidden` entre 700 et 900 px) ; le titre en position absolue frôle le texte | tablette | tous |
| D3 | Deux boutons de 26 px de haut, collés (0 px entre eux) | tous | tous |
| D4 | Bandeau d'accueil en `height:100vh` avec son bouton collé au bord bas : sur un vrai iPhone dans Safari, la barre d'adresse le masque (comportement attendu, non vérifié sur un vrai iPhone ici) | iOS Safari réel uniquement | aucun des trois moteurs sans écran ; trouvé ici uniquement par une règle CSS statique |
| D5 | `height: calc-size(auto, size + 24px)` après un repli à 40 px : les moteurs qui ne connaissent pas `calc-size()` ignorent la déclaration et le texte déborde sur la section suivante | tous | Firefox 157 et WebKit 27.2 ; pas Chromium (qui le gère : ce n'est pas un défaut chez lui) |
| D6 | Erreur JavaScript au clic : `calculerTotal` n'est pas définie | tous, au clic | tous |
| D7 | Requête en 404 : `GET api/promotions.json` au chargement | tous | tous |
| D8 | `<img>` sans `alt` et légende en `#aaa` sur `#fff` (contraste 2,32:1, sous 4,5:1) | tous | tous |

Résultat attendu (`bench/expected.json`) : Chromium 7 sur 7 défauts applicables (D5 n'existe pas chez lui), Firefox 8 sur 8, WebKit 8 sur 8, **D4 comptant comme trouvé par la seule règle statique**. Détail (sélecteurs, correctifs) : [DEFECTS.md](DEFECTS.md).

## Ce que l'audit détecte, et comment

| méthode | contrôles |
|---|---|
| Rendu (mesuré sur la page vivante, par moteur et par viewport) | débordement horizontal, contenu coupé par `overflow:hidden`, cibles tactiles de moins de 44 px et proches l'une de l'autre, `<img>` sans `alt`, contraste du texte sous 4,5:1 |
| Événements (collectés par l'exécuteur, pas par la fonction injectée) | erreurs de page non interceptées après appui sur chaque bouton, réponses HTTP à partir de 400, requêtes échouées vers localhost, erreurs et avertissements de console |
| Heuristique statique (lue dans le CSS, pas dans la mise en page) | hauteurs de type `100vh` (D4) ; déclarations `calc-size()` que `CSS.supports` refuse dans le moteur utilisé (D5 : le texte de la feuille de style est lu car une déclaration rejetée disparaît du CSSOM ; `calc-size()` est la seule fonctionnalité contrôlée). Les feuilles illisibles sont consignées dans `notes`, jamais ignorées en silence |

D4 est l'exception honnête, et les « 7 sur 7 » et « 8 sur 8 » ci-dessus l'incluent. C'est un vrai problème d'iOS Safari qu'aucun moteur sans écran ne reproduit : dans Chromium, Firefox et WebKit, même avec le descripteur iPhone, `100vh` vaut `innerHeight`. Le banc ne trouve donc D4 que par la règle statique, et l'heuristique signalerait aussi des usages anodins de `vh`. Un contrôle par le rendu demande un vrai iPhone ou un simulateur sur Mac, que ce dépôt n'a pas.

## Mesures de l'étude

Ces chiffres sont ceux de l'étude que ce banc accompagne, pas la sortie de ce dépôt. Les trois lignes sont reprises telles quelles des notes de l'étude dans [docs/etude.md](docs/etude.md) (en anglais, avec les lignes d'origine en français), avec les raisons pour lesquelles les chiffres de ce dépôt diffèrent. Banc : WSL2 avec Docker, image `mcr.microsoft.com/playwright:v1.64.1-noble`, Playwright 1.64.1 en script, 3 passes, médiane (écart max-min entre parenthèses), en millisecondes. « Démarrage » va du lancement à la première capture ; « tâche » est le travail complet : 3 viewports, capture pleine page, audit, clic sur chaque bouton, console et réseau.

| moteur (version lue dans le navigateur) | démarrage | tâche | défauts trouvés (D4 par règle statique seulement) |
|---|---|---|---|
| Chromium 156.0.8078.4 | 5 778 (122) | 7 158 (58) | 7 sur 7 applicables |
| Firefox 157.0 | 2 269 (77) | 4 406 (114) | 8 sur 8 |
| WebKit 27.2 | 1 916 (131) | 3 748 (177) | 8 sur 8 |

Remarques de l'étude : les chiffres de Chromium incluent environ 3 s perdues sur un clic qui expire en émulation tactile sur une page qui déborde (WebKit et Firefox cliquent normalement). 0 échec sur 3 passes. L'audit de l'étude était du même genre (fonction injectée) : ces nombres disent la vitesse de chaque moteur sur la tâche et ce qu'il peut détecter, pas quel outil est meilleur ; les défauts trouvés sont identiques pour tous les candidats.

Réserve pour les réutiliser ici : la page de ce dépôt est une version reformulée et nettoyée de celle de l'étude (textes neutres, pas d'avertissements d'accessibilité étrangers aux défauts), donc les durées ci-dessus n'ont pas été mesurées sur cette page exacte. `out/report.json` enregistre les durées de votre propre exécution.

## Vérifié / non vérifié

| | statut |
|---|---|
| `docker compose run --rm --build bench` se termine avec le code 0 depuis un clone neuf, sur Docker avec WSL2 (Linux x86-64) | vérifié |
| `site/` produit les défauts attendus (7 en Chromium, 8 en Firefox et WebKit) et `site-fixed/` ne produit aucune alerte, aux 3 viewports | vérifié |
| `check.mjs` sort avec un code non nul quand un signal quelconque est désactivé (`imgNoAlt`, `lowContrast`, `smallTargets`, `httpErrors`, `requestsFailed`, `console`, et les autres), quand `site-fixed/` retrouve un défaut, quand un repli de clic apparaît sur `site-fixed/`, quand `expected.json` exige un neuvième défaut, ou quand le rapport est périmé | vérifié par des mutations faites à la main (une par signal) |
| D4 tel qu'il apparaît sur un vrai iPhone (barre Safari dynamique) | non vérifié : pas d'appareil réel ; seule la règle statique s'exécute |
| Coût en tokens d'image d'une capture pour un modèle | non mesuré ; seules les tailles de fichiers figurent dans l'étude |
| Serveurs MCP et CLI de l'étude (Playwright MCP, Chrome DevTools MCP, ...) | mesurés dans l'étude, **non** exécutés par ce dépôt |
| Extensions de navigateur pilotant un vrai profil | non testé, ni dans l'étude ni ici |
| Un modèle qui juge la page | non fait : l'audit est un programme |
| Hôtes Windows, macOS, ARM | non vérifié |

## Limites

- L'audit est un programme injecté, pas un modèle qui juge. Il ne départage pas les outils : tout outil capable d'exécuter la même fonction trouve les mêmes défauts. Ce que le banc teste, c'est ce qu'un outil est capable de détecter, et ce qu'il rapporte quand vous le questionnez avec vos mots (utilisez [PROMPT.md](PROMPT.md) et notez à la main).
- Trois moteurs sous Linux ne sont pas trois vrais appareils : WebKit pour Linux n'a ni barre dynamique, ni zone de sécurité, ni rendu des polices d'iOS.
- D5 est trouvé à partir du texte de la feuille de style et de `CSS.supports`, pas à partir du débordement visible du panneau.
- En émulation tactile Chromium sur la page mobile qui déborde, le vrai clic sur un bouton expire ; l'exécuteur envoie alors l'événement de clic et le compte (`clicks.fallback` dans `report.json`). C'est attendu sur `site/` en Chromium au viewport mobile (D1 en est la cause) ; `check.mjs` échoue pour tout autre repli, et pour tout repli sur `site-fixed/`.
- Le léger chevauchement du titre de carte (D2) se voit sur la capture mais n'est pas détecté.

## Limites connues

Laissées telles quelles, volontairement ou faute de temps :
- L'audit est fait pour cette page. Ailleurs il peut donner de fausses alertes : le texte masqué visuellement compte comme contenu coupé, les liens en ligne comptent comme cibles petites et proches, le contraste ignore l'opacité, les dégradés et le seuil du grand texte, et `vh` n'est lu que dans `height`, `min-height` et `max-height`.
- Seuls les chemins des erreurs vers localhost sont consignés ; l'hôte n'est pas conservé.
- Pas de test de l'audit lui-même en dehors de la page canari.
- `npm run make-fixed` (pour régénérer `site-fixed/` après une modification de `site/`) demande Node 20 ou plus sur la machine ; le banc lui-même n'en a pas besoin.
- `docker compose up site` n'est joignable que depuis la machine : un outil lancé dans un autre conteneur ne l'atteint pas sans changer la liaison du port.
- Fins de ligne Windows : `.gitattributes` impose LF, car le correctif de D2 cherche un texte sur plusieurs lignes.
- Dependabot ne touche pas à Playwright : la version se change à la main dans `package.json`, le Dockerfile et `expected.json` en même temps.

## Dépannage

| symptôme | cause et remède |
|---|---|
| `permission denied ... /var/run/docker.sock` | votre utilisateur n'est pas dans le groupe `docker` : ajoutez-l'y (puis reconnectez-vous) ou lancez Docker en administrateur vous-même |
| `address already in use` avec `up site` | quelque chose écoute déjà sur 8099 (ou 8100) : `BENCH_PORT=18099 docker compose up --build site` (`BENCH_FIXED_PORT` pour la page corrigée) |
| `out/ is not writable by uid ...` ou `EACCES` sur `out/` | `out/` est absent ou appartient à root, ou votre uid n'est pas 1000. Créez-le avec votre utilisateur (`mkdir -p out`) et lancez `BENCH_UID=$(id -u) BENCH_GID=$(id -g) docker compose run --rm --build bench`. Si Docker a créé `out/` en root, supprimez-le avec les droits dont vous disposez et recommencez |
| `FAIL ... stale report` ou `drift:` | le rapport ou l'image ne correspond pas à vos fichiers : utilisez toujours `--build` |
| conteneurs restés après Ctrl-C sur `up` | `docker compose down` |

## Licence

MIT, voir [LICENSE](LICENSE).
