import { mountGame, loadDraft, type GameDoc } from '@theideaguards/pixin'
import '@theideaguards/pixin/styles.css'
import gameDoc from '../content/game.json'

const root = document.getElementById('root')!

// pixin 0.1.5's assetUrl() baked the LIBRARY's own build-time BASE_URL ('/') into dist-lib,
// so at runtime it ignores OUR sub-path base and fetches game assets from the origin root
// (e.g. '/atlases/x.png' → 404 under '/the-grandmas-shispering/'). Pre-resolve our asset
// refs against OUR BASE_URL so the engine's assetUrl yields '/<repo>/atlases/x.png'.
// (Covers atlases/, sounds/ and assets/baked/ alike — data:/blob:/http refs are left as-is.)
const BASE = import.meta.env.BASE_URL
function rebaseAssets<T>(node: T): T {
  if (typeof node === 'string')
    return (/^(?:atlases|sounds|assets)\//.test(node) ? BASE + node : node) as unknown as T
  if (Array.isArray(node)) return node.map((v) => rebaseAssets(v)) as unknown as T
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {}
    for (const k in node) out[k] = rebaseAssets((node as Record<string, unknown>)[k])
    return out as unknown as T
  }
  return node
}

if (import.meta.env.DEV && new URLSearchParams(location.search).has('edit')) {
  // Visual editor (dev only). It edits an IndexedDB draft; "Test in game" reloads to play it.
  void import('@theideaguards/pixin/editor').then(({ mountEditor }) => mountEditor(root))
} else {
  // Play the editor draft (dev) over the committed game.json, else the committed game.
  const draft = import.meta.env.DEV ? await loadDraft() : null
  mountGame(rebaseAssets((draft ?? gameDoc)) as GameDoc, root)
}
