// Synthesize placeholder game sounds into public/sounds/*.wav (16-bit PCM, no deps).
// For now just a soft dialogue "voice" blip used by every NPC's typewriter. The
// pickup / transition / footstep SFX use Pixin's built-in procedural sounds.
//
//   node scripts/build-sounds.mjs

import { writeFile, mkdir } from 'node:fs/promises'

const OUT = '/Users/martinsafka/WebstormProjects/the-grandmas-shispering/gamejame/public/sounds'
const SR = 44100

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2)
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]))
    data.writeInt16LE(Math.round(v * 32767), i * 2)
  }
  const h = Buffer.alloc(44)
  h.write('RIFF', 0)
  h.writeUInt32LE(36 + data.length, 4)
  h.write('WAVE', 8)
  h.write('fmt ', 12)
  h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20) // PCM
  h.writeUInt16LE(1, 22) // mono
  h.writeUInt32LE(SR, 24)
  h.writeUInt32LE(SR * 2, 28)
  h.writeUInt16LE(2, 32)
  h.writeUInt16LE(16, 34)
  h.write('data', 36)
  h.writeUInt32LE(data.length, 40)
  return Buffer.concat([h, data])
}

// A short, soft blip: a low-ish sine with a quick decay — gentle for a sad story.
function blip() {
  const dur = 0.055
  const n = Math.floor(SR * dur)
  const s = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const t = i / SR
    const env = Math.exp(-t * 55) // quick decay
    s[i] = Math.sin(2 * Math.PI * 300 * t) * env * 0.3
  }
  return s
}

async function main() {
  await mkdir(OUT, { recursive: true })
  await writeFile(`${OUT}/dialog-blip.wav`, wav(blip()))
  console.log(`Wrote ${OUT}/dialog-blip.wav`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
