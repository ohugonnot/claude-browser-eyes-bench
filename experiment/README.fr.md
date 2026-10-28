# Expérience « Claude dans la boucle » (résumé)

Le banc de la racine mesure ce que voient les outils de navigation sur une page à huit défauts connus. Ce dossier pose la question suivante : **que vaut chaque outil quand c'est Claude qui l'utilise, et pas seulement l'outil seul ?** La version complète, en anglais, est dans [README.md](README.md).

## Protocole en bref

- **Même énoncé** pour tous ([`task/TASK.md`](task/TASK.md), et [`task/TASK-source-only.md`](task/TASK-source-only.md) sans navigateur) : auditer la page `http://localhost:8099/` à 390x844, 820x1180 et 1440x900, lister les défauts avec identifiant, viewport et preuve, 40 appels d'outil au plus.
- **Conditions sur WSL/Docker** : C0 sources seules (Read/Grep/Glob), C1 Playwright MCP, C2 Chrome DevTools MCP, C3 script Playwright écrit par Claude (Write + wrapper `pw-run`). **Sur Windows** : W1 extension Claude in Chrome, W2 Playwright MCP (témoin).
- **3 runs par condition**, modèle Sonnet, depuis un dossier vide, sans réglages ni skills ni mémoire automatique, liste d'outils stricte (`--tools`, `--allowedTools`, `dontAsk`, `--strict-mcp-config`), arrêt au-delà de 40 appels ou 600 s. Ordre entrelacé tiré avec une graine fixe sur WSL.
- **Réseau coupé hors localhost** : réseau Docker interne et relais du seul port 8099.
- **Surcoût fixe** mesuré par un run « réponds OK » par condition ; **coûts** lus dans la sortie JSON de `claude -p`.
- **Jugement aveugle** : rapports anonymisés (nettoyage lexical) et mélangés, juge d'un autre modèle, barème dans [`rubric.md`](rubric.md) : D1 à D8 notés T/P/M, fausses affirmations, défauts réels hors liste, preuve dominante, note sur 10.

## Rejouer

Prérequis : Docker, Claude Code installé et authentifié, Node 18+, Python 3 ; sous Windows, Node 22+, Chrome et l'extension Claude in Chrome. Coût : 12 runs de tâche + 4 de surcoût sur WSL (6 + 2 sous Windows), de l'ordre de quelques dixièmes de dollar « liste » par condition de 3 runs.

```sh
node bench/serve.mjs site 8099 0.0.0.0   # racine du dépôt : sert la page
cd experiment
harness/setup.sh && harness/net-up.sh
harness/run-all.sh                       # ou harness/run-one.sh c1 1
node harness/summarize.js && node harness/blind.js
harness/net-down.sh
```

Les sorties vont dans `experiment/run/` (ignoré par git). Sous Windows : `harness\windows\run-all.ps1`. Les variables `EXP_RUN_DIR`, `SITE_DIR`, `DOCKER_USER` et `EXP_IMAGE` sont décrites en tête des scripts. L'expérience a tourné sur la page du commit `0aa489b` (le lien « Retour » de `a-propos.html` a été corrigé ensuite).

## Résultats

Dix-huit runs de Claude Sonnet (3 par condition), jugés à l'aveugle. Moyennes sur 3 runs ; « trouvés » compte les D1 à D8 notés T par le juge ; coût « liste » du JSON de `claude -p`, pas le quota. Les durées WSL et Windows ne se comparent pas.

| Condition | Trouvés /8 (moy., min-max) | Fausses affirmations nettes | Score du juge /10 | Coût par run | Appels d'outil |
|---|---|---|---|---|---|
| WSL : sources seules (pas de navigateur) | 8,0 (8-8) | 0,7 | 8,3 | 0,028 $ | 6,0 |
| WSL : Playwright MCP 0.0.83 | 5,3 (3-8) | 0,3 | 6,3 | 0,078 $ | 6,7 |
| WSL : Chrome DevTools MCP 1.12.0 | 7,3 (6-8) | 0,3 | 7,7 | 0,097 $ | 18,7 |
| WSL : script Playwright écrit par Claude | 4,3 (4-5) | 1,0 | 4,7 | 0,057 $ | 4,0 |
| Windows : extension Claude in Chrome 1.0.102 | 5,7 (3-7) | 1,7 | 5,3 | 0,153 $ | 19,0 |
| Windows : Playwright MCP 0.0.83 (témoin) | 7,0 (5-8) | 0,3 | 7,8 | 0,078 $ | 7,0 |

Détail par run : [`results-per-run.csv`](results-per-run.csv). Les sources seules ont fait le mieux au plus bas prix sur CETTE page (petite, statique, CSS lisible) ; un même outil varie beaucoup d'un run à l'autre (Playwright MCP : 3 à 8 défauts) ; les valeurs mesurées étaient presque toujours justes, les erreurs sont des causes inventées et de fausses absences. Voir le README anglais pour la lecture complète.

## Limites

3 runs seulement ; une page, un navigateur (Chromium/Chrome) ; jugement subjectif d'un modèle, avec une anonymisation seulement lexicale ; coûts « liste » et non quota d'abonnement ; l'auteur de l'orchestration Windows avait lu plus tôt la liste de défauts d'une ancienne page, mais les runs sont des invocations à contexte vide ; aucun vrai iPhone ; résultats propres à cette page et à cette tâche, pas un classement général des outils.
