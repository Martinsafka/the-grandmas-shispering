// Build character sprite atlases (+ intro animated-layer strips) from the frame
// folders on the Desktop into public/atlases/*.png, and emit _views.json with the
// Pixin ViewDescriptors. Souls (player, grandma, reconciled mother) are desaturated
// + made slightly translucent for an ethereal look; the monster is left as-is.
//
//   node scripts/build-atlases.mjs
//
// Frames are 92x92 .webp. Walk packs only S/SE/E/NE/N — Pixin mirrors the W-side.

import sharp from 'sharp'
import { readdir, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const SRC = '/Users/martinsafka/Desktop/Gamejame/Animace'
const OUT = '/Users/martinsafka/WebstormProjects/the-grandmas-shispering/gamejame/public/atlases'
const CELL = 92
const SAT = 0.45 // soul saturation (1 = full colour, 0 = greyscale)
const ALPHA = 0.78 // soul opacity (1 = opaque)

const DIRS = [
  ['S', 'South'],
  ['SE', 'South-east'],
  ['E', 'East'],
  ['NE', 'North-east'],
  ['N', 'North'],
]
const numSort = (a, b) => (parseInt(a) || 0) - (parseInt(b) || 0)

async function listFrames(dir) {
  if (!existsSync(dir)) return []
  const files = (await readdir(dir)).filter((x) => /\.(webp|png)$/i.test(x)).sort(numSort)
  return files.map((x) => path.join(dir, x))
}

// Multiply the alpha channel by `a` (uniform opacity) on a PNG buffer.
async function applyAlpha(buf, a) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * a)
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer()
}

async function cell(file, ethereal) {
  let img = sharp(file).resize(CELL, CELL, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  if (ethereal) img = img.modulate({ saturation: SAT })
  let buf = await img.png().toBuffer()
  if (ethereal) buf = await applyAlpha(buf, ALPHA)
  return buf
}

// groups: [{ key, files }] — packs unique files into a grid (dedup by path so an
// idle clip can reuse a walk frame), returns { columns, rows, frames, clips }.
async function buildAtlas(name, groups, ethereal) {
  const fileIndex = new Map()
  const order = []
  const clips = {}
  for (const g of groups) {
    const idx = []
    for (const f of g.files) {
      if (!fileIndex.has(f)) {
        fileIndex.set(f, order.length)
        order.push(f)
      }
      idx.push(fileIndex.get(f))
    }
    clips[g.key] = idx
  }
  const n = order.length
  if (!n) {
    console.warn(`  (skip ${name}: no frames found)`)
    return null
  }
  const columns = Math.min(n, 8)
  const rows = Math.ceil(n / columns)
  const composite = []
  for (let i = 0; i < n; i++) {
    composite.push({
      input: await cell(order[i], ethereal),
      left: (i % columns) * CELL,
      top: Math.floor(i / columns) * CELL,
    })
  }
  await sharp({
    create: {
      width: columns * CELL,
      height: rows * CELL,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composite)
    .png()
    .toFile(path.join(OUT, `${name}.png`))
  console.log(`  ${name}.png — ${columns}x${rows} grid, ${n} frames`)
  return { columns, rows, frames: n, clips }
}

const clip = (frames, fps, loop) => ({ frames, fps, loop })

// Directional character: walk.<dir> + idle.<dir> (idle = first walk frame).
async function character(name, walkSub, ethereal) {
  const walk = []
  const idle = []
  for (const [tag, folder] of DIRS) {
    const files = await listFrames(path.join(SRC, walkSub, folder))
    if (files.length) {
      walk.push({ key: `walk.${tag}`, files })
      idle.push({ key: `idle.${tag}`, files: [files[0]] })
    }
  }
  const res = await buildAtlas(name, [...walk, ...idle], ethereal)
  if (!res) return null
  const view = {
    atlas: `/atlases/${name}.png`,
    frameWidth: CELL,
    frameHeight: CELL,
    columns: res.columns,
    anchorX: 0.5,
    anchorY: 1,
    clips: {},
  }
  for (const k of Object.keys(res.clips))
    view.clips[k] = clip(res.clips[k], k.startsWith('idle') ? 4 : 8, true)
  return view
}

// Static idle-only character (one folder of frames → idle.S).
async function idleChar(name, sub, ethereal, fps = 4) {
  const files = await listFrames(path.join(SRC, sub))
  const res = await buildAtlas(name, [{ key: 'idle.S', files }], ethereal)
  if (!res) return null
  return {
    atlas: `/atlases/${name}.png`,
    frameWidth: CELL,
    frameHeight: CELL,
    columns: res.columns,
    anchorX: 0.5,
    anchorY: 1,
    clips: { 'idle.S': clip(res.clips['idle.S'], fps, true) },
  }
}

// Strip for an animated scene layer (one row); returns LayerData-ish params.
async function strip(name, sub, ethereal, fps = 6) {
  const files = await listFrames(path.join(SRC, sub))
  const res = await buildAtlas(name, [{ key: 'all', files }], ethereal)
  if (!res) return null
  return {
    src: `/atlases/${name}.png`,
    frameWidth: CELL,
    frameHeight: CELL,
    columns: res.columns,
    frames: res.frames,
    fps,
    loop: true,
  }
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const out = { views: {}, strips: {} }

  console.log('Characters (ViewDescriptors):')
  out.views.vnucka = await character('vnucka', 'Vnučka/Walking', true)
  out.views.prisera = await character('prisera', 'Příšera/Walking', false)
  out.views['babicka-old'] = await idleChar('babicka-old', 'Babička/idle/old', true)
  out.views['babicka-sad'] = await idleChar('babicka-sad', 'Babička/idle/sad', true)
  out.views['matka-smirena'] = await idleChar('matka-smirena', 'Dcera_matka/Idle', true)

  console.log('Animated-layer strips (intro):')
  out.strips['vnucka-wake'] = await strip('vnucka-wake', 'Vnučka/Wake', false)
  out.strips['vnucka-sleep'] = await strip('vnucka-sleep', 'Vnučka/Sleep', false)
  out.strips['babicka-chair'] = await strip('babicka-chair', 'Babička/idle/old', false)

  await writeFile(path.join(OUT, '_views.json'), JSON.stringify(out, null, 2))
  console.log(`\nWrote ${path.join(OUT, '_views.json')}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
