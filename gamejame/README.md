# {{name}}

A [Pixin](https://github.com/Martinsafka/point-and-click-pixin) point-and-click adventure.

```bash
pnpm install
pnpm dev          # play the game
```

## Authoring (the no-code editor)

Open the dev server with **`?edit`** (e.g. `http://localhost:5173/?edit`) for the visual
editor. It saves your work to an **IndexedDB draft**; **Test in game** reloads the page to
play it.

When you're happy, **Export** the document from the editor and ship it:

```bash
# drop the exported game.json into export/, then:
pnpm assets       # externalize embedded art/audio → public/assets/baked + lean content/game.json
pnpm build        # production build → dist/
```

The game is one serializable `GameDoc` (`content/game.json`); you can also hand-edit it.
See the [Pixin docs](https://github.com/Martinsafka/point-and-click-pixin) for the schema,
the editor guide, and the bundled Claude Code skills.
