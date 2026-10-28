# The prompt

Give this prompt, unchanged, to the tool or the agent you want to test, with the page served by `docker compose up site` (http://localhost:8099/). It does not say what is wrong with the page.

## English

```text
Open http://localhost:8099/ and review the page at three viewport sizes:
- mobile, 390 x 844 pixels
- tablet, 820 x 1180 pixels
- desktop, 1440 x 900 pixels

For each size, look for anything that would bother a visitor or a developer:
layout, text, interaction, accessibility, console messages, network requests.
Press every button on the page and watch what happens.

Report every problem you find, one per line, with:
- the viewport(s) where it appears,
- where it is on the page (selector or visible text),
- what you observed, and the evidence (a measurement, a message, a screenshot),
- how sure you are.

Say clearly what you could not check with your tools.
Do not modify the page. Do not report anything you did not observe.
```

## Français

```text
Ouvre http://localhost:8099/ et examine la page à trois tailles de fenêtre :
- mobile, 390 x 844 pixels
- tablette, 820 x 1180 pixels
- bureau, 1440 x 900 pixels

Pour chaque taille, cherche tout ce qui gênerait un visiteur ou un développeur :
mise en page, texte, interaction, accessibilité, messages de console, requêtes réseau.
Appuie sur chaque bouton de la page et observe ce qui se passe.

Signale chaque problème trouvé, un par ligne, avec :
- le ou les viewports où il apparaît,
- son emplacement dans la page (sélecteur ou texte visible),
- ce que tu as observé, et la preuve (une mesure, un message, une capture),
- ton degré de certitude.

Dis clairement ce que tes outils ne t'ont pas permis de vérifier.
Ne modifie pas la page. Ne signale rien que tu n'aies pas observé.
```

## Scoring your tool's answer

Compare the list with [DEFECTS.md](DEFECTS.md) by hand. The repository does not score free-text answers; `bench/` only checks the injected audit, which is not a model.
