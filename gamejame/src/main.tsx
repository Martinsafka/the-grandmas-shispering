import { mountGame, loadDraft, type GameDoc } from '@theideaguards/pixin'
import '@theideaguards/pixin/styles.css'
import gameDoc from '../content/game.json'

const root = document.getElementById('root')!

if (import.meta.env.DEV && new URLSearchParams(location.search).has('edit')) {
  // Visual editor (dev only). It edits an IndexedDB draft; "Test in game" reloads to play it.
  void import('@theideaguards/pixin/editor').then(({ mountEditor }) => mountEditor(root))
} else {
  // Play the editor draft (dev) over the committed game.json, else the committed game.
  const draft = import.meta.env.DEV ? await loadDraft() : null
  mountGame((draft ?? gameDoc) as GameDoc, root)
}
