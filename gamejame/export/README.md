# export/

Drop your editor **Export** here as `game.json`, then run:

```bash
pnpm assets
```

It externalizes the embedded art/audio into `public/assets/baked/` and writes a lean
`content/game.json`. Raw exports here are gitignored (they hold megabytes of inline base64).
