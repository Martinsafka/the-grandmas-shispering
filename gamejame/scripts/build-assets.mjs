#!/usr/bin/env node
/**
 * Externalize + compress a GameDoc's embedded art/audio.
 *
 * The editor bakes uploaded images and sounds into `content/game.json` as base64 `data:`
 * URLs, which bloats the JSON (and the JS bundle that inlines it) to tens of MB. This
 * walks the document, writes every `data:` blob out to `public/assets/baked/…` (images
 * re-encoded to downscaled WebP via sharp, audio passed through), de-duplicates by content
 * hash, and rewrites each ref to a relative path the runtime resolves via BASE_URL
 * (src/data/asset-url.ts). Re-run any time after re-exporting the doc; it is idempotent
 * (a doc with no `data:` strings is left unchanged) and skips files already on disk.
 *
 *   pnpm assets   # export/game.json → lean content/game.json + public/assets/baked/
 *   node scripts/build-assets.mjs --in export/game.json --max-height 1620 --quality 80
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const args = parseArgs(process.argv.slice(2))
const IN = args.in ?? 'export/game.json' // raw editor export (gitignored — see export/README.md)
const OUT = args.out ?? 'content/game.json' // lean committed source of truth
const ASSET_DIR = args.assets ?? 'public/assets/baked' // files written here
const REF_BASE = args.base ?? 'assets/baked' // ref prefix stored in the doc (relative)
const MAX_HEIGHT = Number(args['max-height'] ?? 1620)
const QUALITY = Number(args.quality ?? 80)

if (!existsSync(IN)) {
  console.error(
    `Input not found: ${IN}\n` +
      `Drop your editor "Export" game.json there (or pass --in <path>), then run \`pnpm assets\`.`,
  )
  process.exit(1)
}

const DATA_RE = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,(.*)$/i
const byHash = new Map() // content hash → relative ref (de-dupe identical blobs)
const stats = { images: 0, audio: 0, other: 0, reused: 0, srcBytes: 0, outBytes: 0 }

async function externalize(dataUrl) {
  const m = DATA_RE.exec(dataUrl)
  if (!m) return null
  const [, mime, b64] = m
  const input = Buffer.from(b64, 'base64')
  const hash = createHash('sha1').update(input).digest('hex').slice(0, 16)
  if (byHash.has(hash)) {
    stats.reused += 1
    return byHash.get(hash)
  }
  stats.srcBytes += dataUrl.length

  let out = input
  let sub = 'misc'
  let ext = (mime.split('/')[1] || 'bin').replace(/[^a-z0-9]/gi, '')

  if (mime.startsWith('image/')) {
    sub = 'img'
    try {
      out = await sharp(input)
        .resize({ height: MAX_HEIGHT, withoutEnlargement: true })
        .webp({ quality: QUALITY })
        .toBuffer()
      ext = 'webp'
      stats.images += 1
    } catch (err) {
      // Unsupported/corrupt image → keep the original bytes + extension.
      console.warn(`  ! sharp failed on an image (${err.message}); keeping original`)
      out = input
    }
  } else if (mime.startsWith('audio/')) {
    sub = 'audio'
    ext = mime === 'audio/mpeg' ? 'mp3' : ext
    stats.audio += 1
  } else {
    stats.other += 1
  }

  const ref = `${REF_BASE}/${sub}/${hash}.${ext}`
  const abs = join(ASSET_DIR, sub, `${hash}.${ext}`)
  if (!existsSync(abs)) {
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, out)
  }
  stats.outBytes += out.length
  byHash.set(hash, ref)
  return ref
}

async function walk(node) {
  if (typeof node === 'string') {
    if (node.startsWith('data:')) return (await externalize(node)) ?? node
    return node
  }
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) node[i] = await walk(node[i])
    return node
  }
  if (node && typeof node === 'object') {
    for (const k of Object.keys(node)) node[k] = await walk(node[k])
    return node
  }
  return node
}

const raw = await readFile(IN, 'utf8')
const doc = JSON.parse(raw)
await walk(doc)
const lean = JSON.stringify(doc, null, 2) + '\n'
await writeFile(OUT, lean)

const mb = (n) => (n / 1e6).toFixed(1)
console.log(`✓ ${IN} → ${OUT}`)
console.log(`  json:    ${mb(raw.length)} MB → ${mb(lean.length)} MB`)
console.log(
  `  art:     ${stats.images} images, ${stats.audio} audio, ${stats.other} other` +
    ` (${stats.reused} duplicates skipped)`,
)
console.log(
  `  on disk: ${mb(stats.srcBytes)} MB base64 → ${mb(stats.outBytes)} MB files in ${ASSET_DIR}/`,
)

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue
    const key = argv[i].slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[key] = next
      i += 1
    } else {
      out[key] = true
    }
  }
  return out
}
