// Validates content/game.json: (1) referential integrity — every referenced id
// exists; (2) completability — simulates the intended solution path and asserts it
// reaches `endGame` with no broken precondition (catches soft-locks / mis-gates).
//
//   node scripts/validate-game.mjs

import { readFile } from 'node:fs/promises'

const ROOT = '/Users/martinsafka/WebstormProjects/the-grandmas-shispering/gamejame'
const doc = JSON.parse(await readFile(`${ROOT}/content/game.json`, 'utf8'))

const items = new Set(Object.keys(doc.items))
const scenes = new Set(Object.keys(doc.scenes))
const dialogs = new Set(Object.keys(doc.dialogs || {}))
const sequences = new Set(Object.keys(doc.sequences || {}))
const npcs = new Set(Object.keys(doc.npcs || {}))
const sounds = new Set([...Object.keys(doc.sounds || {}), 'sfx-ambient', 'sfx-pickup', 'sfx-transition', 'sfx-footstep', 'sfx-rain'])

const errors = []
const err = (m) => errors.push(m)

// ---- referential integrity -------------------------------------------------
function walkCond(c, where) {
  if (!c) return
  if (c.kind === 'hasItem' && !items.has(c.item)) err(`${where}: hasItem unknown item '${c.item}'`)
  if (c.kind === 'visited' && !scenes.has(c.scene)) err(`${where}: visited unknown scene '${c.scene}'`)
  if (c.kind === 'all' || c.kind === 'any') (c.of || []).forEach((x) => walkCond(x, where))
  if (c.kind === 'not') walkCond(c.of, where)
}
function walkEffects(effs, where) {
  for (const e of effs || []) {
    if ((e.kind === 'giveItem' || e.kind === 'takeItem') && !items.has(e.item)) err(`${where}: ${e.kind} unknown item '${e.item}'`)
    if (e.kind === 'goTo' && !scenes.has(e.scene)) err(`${where}: goTo unknown scene '${e.scene}'`)
    if (e.kind === 'startDialog' && !dialogs.has(e.dialog)) err(`${where}: startDialog unknown '${e.dialog}'`)
    if (e.kind === 'startSequence' && !sequences.has(e.sequence)) err(`${where}: startSequence unknown '${e.sequence}'`)
    if (e.kind === 'moveNpc' && (!npcs.has(e.npc) || !scenes.has(e.scene))) err(`${where}: moveNpc bad '${e.npc}'→'${e.scene}'`)
    if (e.kind === 'despawnNpc' && !npcs.has(e.npc)) err(`${where}: despawnNpc unknown '${e.npc}'`)
    if (e.kind === 'playSound' && !sounds.has(e.sound)) err(`${where}: playSound unknown '${e.sound}'`)
  }
}

if (!scenes.has(doc.start)) err(`start scene '${doc.start}' missing`)
if (!doc.player?.atlas) err('player view missing')
for (const pv of doc.playerViews || []) {
  walkCond(pv.when, 'playerViews.when')
  if (!pv.view?.atlas) err('playerViews view missing atlas')
}
for (const [sid, s] of Object.entries(doc.scenes)) {
  if (!s.depth) err(`scene ${sid}: missing depth`)
  if (!s.spawn) err(`scene ${sid}: missing spawn`)
  walkEffects(s.onEnter, `scene ${sid}.onEnter`)
  for (const it of s.interactables || []) {
    const w = `scene ${sid}/${it.id}`
    walkCond(it.when, w)
    if (it.kind === 'pickable' && !items.has(it.item)) err(`${w}: pickable unknown item '${it.item}'`)
    if (it.kind === 'exit' && !scenes.has(it.to)) err(`${w}: exit unknown scene '${it.to}'`)
    walkEffects(it.effects, w)
    walkEffects(it.exitEffects, `${w}.exitEffects`)
    for (const u of it.uses || []) {
      if (!items.has(u.item)) err(`${w}: uses unknown item '${u.item}'`)
      walkEffects(u.effects, `${w}.uses`)
    }
  }
  for (const p of s.npcs || []) {
    if (!npcs.has(p.npc)) err(`scene ${sid}: placement unknown npc '${p.npc}'`)
    walkCond(p.when, `scene ${sid} placement ${p.npc}.when`)
  }
}
for (const r of doc.recipes || []) for (const k of ['a', 'b', 'output']) if (!items.has(r[k])) err(`recipe: unknown item '${r[k]}'`)
for (const [did, d] of Object.entries(doc.dialogs || {})) {
  const ns = new Set(Object.keys(d.nodes))
  if (!ns.has(d.start)) err(`dialog ${did}: start '${d.start}' missing`)
  for (const [nid, n] of Object.entries(d.nodes)) {
    const w = `dialog ${did}/${nid}`
    walkEffects(n.effects, w)
    if (n.next && !ns.has(n.next)) err(`${w}: next '${n.next}' missing`)
    for (const c of n.choices || []) {
      walkCond(c.when, `${w} choice`)
      walkEffects(c.effects, `${w} choice`)
      if (c.next && !ns.has(c.next)) err(`${w}: choice next '${c.next}' missing`)
    }
    for (const b of n.branch || []) {
      walkCond(b.when, `${w} branch`)
      if (!ns.has(b.to)) err(`${w}: branch to '${b.to}' missing`)
    }
  }
}
for (const [qid, q] of Object.entries(doc.sequences || {}))
  for (const st of q.steps || []) {
    if (st.dialog && !dialogs.has(st.dialog)) err(`sequence ${qid}: dialog '${st.dialog}' missing`)
    if (st.actor && st.actor !== 'player' && !npcs.has(st.actor)) err(`sequence ${qid}: actor '${st.actor}' missing`)
    walkEffects(st.effects, `sequence ${qid}`)
  }
for (const [id, n] of Object.entries(doc.npcs || {})) {
  if (!n.view?.atlas) err(`npc ${id}: view missing atlas`)
  if (n.dialog && !dialogs.has(n.dialog)) err(`npc ${id}: dialog '${n.dialog}' missing`)
  if (n.vision) {
    walkCond(n.vision.unless, `npc ${id}.vision.unless`)
    walkEffects(n.vision.effects, `npc ${id}.vision`)
  }
}

// ---- completability simulation ---------------------------------------------
const S = { scene: doc.start, inv: new Set(), flags: new Map(), visited: new Set([doc.start]), ended: false }
for (const [f, v] of Object.entries(doc.initialFlags || {})) S.flags.set(f, v)
const sim = []
const fail = (m) => sim.push(`SIM FAIL: ${m}`)
const cond = (c) => {
  if (!c) return true
  switch (c.kind) {
    case 'hasItem': return S.inv.has(c.item)
    case 'flag': return (S.flags.get(c.flag) ?? false) === (c.value ?? true)
    case 'visited': return S.visited.has(c.scene)
    case 'all': return c.of.every(cond)
    case 'any': return c.of.some(cond)
    case 'not': return !cond(c.of)
    default: return true
  }
}
function apply(effs) {
  for (const e of effs || []) {
    if (e.kind === 'setFlag') S.flags.set(e.flag, e.value ?? true)
    else if (e.kind === 'giveItem') S.inv.add(e.item)
    else if (e.kind === 'takeItem') S.inv.delete(e.item)
    else if (e.kind === 'goTo') { S.scene = e.scene; S.visited.add(e.scene) }
    else if (e.kind === 'endGame' || e.kind === 'gameOver') S.ended = true
    else if (e.kind === 'startSequence') applySeq(e.sequence)
    else if (e.kind === 'startDialog') applyDialogLinear(e.dialog)
  }
}
function applySeq(id) {
  for (const st of doc.sequences[id].steps) {
    if (st.effects) apply(st.effects)
    if (st.dialog) applyDialogLinear(st.dialog)
  }
}
function walkChain(d, nid) {
  const seen = new Set()
  while (nid && !seen.has(nid)) {
    seen.add(nid)
    const n = d.nodes[nid]
    if (n.effects) apply(n.effects)
    nid = n.next
  }
}
function applyDialogLinear(id) { walkChain(doc.dialogs[id], doc.dialogs[id].start) }
const findI = (id) => (doc.scenes[S.scene].interactables || []).find((x) => x.id === id)

// action helpers (assert precondition, then apply)
function pickup(id) {
  const el = findI(id)
  if (!el) return fail(`pickup ${id}: not in ${S.scene}`)
  if (!cond(el.when)) return fail(`pickup ${id}: when not met`)
  S.inv.add(el.item)
  if (el.effects) apply(el.effects)
}
function combine(a, b) {
  const r = (doc.recipes || []).find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a))
  if (!r) return fail(`combine ${a}+${b}: no recipe`)
  if (!S.inv.has(a) || !S.inv.has(b)) return fail(`combine ${a}+${b}: missing input`)
  S.inv.delete(a); S.inv.delete(b); S.inv.add(r.output)
}
function useOn(id, item) {
  const el = findI(id)
  if (!el) return fail(`use ${item} on ${id}: not in ${S.scene}`)
  if (!cond(el.when)) return fail(`use ${item} on ${id}: when not met`)
  if (!S.inv.has(item)) return fail(`use ${item} on ${id}: not held`)
  const rule = (el.uses || []).find((u) => u.item === item)
  if (!rule) return fail(`use ${item} on ${id}: no use rule`)
  apply(rule.effects)
}
function choice(dialogId, nodeId, text) {
  const d = doc.dialogs[dialogId]
  const n = d.nodes[nodeId]
  const c = (n.choices || []).find((x) => x.text === text)
  if (!c) return fail(`choice "${text}" not in ${dialogId}/${nodeId}`)
  if (!cond(c.when)) return fail(`choice "${text}": when not met`)
  apply(c.effects)
  if (c.next) walkChain(d, c.next)
}
function takeExit(id) {
  const el = findI(id)
  if (!el || el.kind !== 'exit') return fail(`exit ${id}: not found`)
  if (!cond(el.when)) return fail(`exit ${id}: when not met`)
  apply(el.effects)
  S.scene = el.to; S.visited.add(el.to)
}
function onEnter() { apply(doc.scenes[S.scene].onEnter) }

// ---- the canonical solution ----
onEnter() // pokoj-realita intro → goTo pokoj-spirit
pickup('p-fotoalbum')
choice('babicka-spirit', 'before', 'Našla jsem tohle album.')
pickup('p-klic')
useOn('i-suplik-locked', 'klic') // unlocks drawer AND grants 'obrazek' via use-effect (no separate pickup)
pickup('p-hracka')
pickup('p-fotka-matky')
combine('hracka', 'obrazek')
combine('mem-mom-tmp', 'fotka-matky')
choice('babicka-spirit', 's', 'Co se vlastně mamince stalo?') // → obyvak
pickup('p-kapesnik')
choice('babicka-obyvak', 's', 'Babi, čí to je krev?') // transform kapesnik
pickup('p-lekarska-zprava'); pickup('p-parte'); pickup('p-kazeta'); pickup('p-leky'); pickup('p-darek')
combine('leky', 'lekarska-zprava')
combine('darek', 'kazeta')
choice('babicka-obyvak', 's', 'Babi? Co se děje? Vypadáš tak smutně.') // → hrbitov
useOn('i-hrob', 'parte')
pickup('p-svicka'); pickup('p-zapalovac')
combine('svicka', 'zapalovac')
useOn('i-tmave-papiry', 'zapalena-svicka')
pickup('p-ultrazvuk')
combine('ultrazvuk', 'nesouhlas')
pickup('p-papir-1'); pickup('p-papir-2'); pickup('p-papir-3'); pickup('p-papir-4')
combine('kus-papiru-1', 'kus-papiru-2')
combine('fotka-tmp1', 'kus-papiru-3')
combine('fotka-tmp2', 'kus-papiru-4')
pickup('p-lahev-leky')
combine('lahev-leky', 'fotka-babicky')
useOn('denik-0', 'vzpominka-maminka')
useOn('denik-1', 'vzpominka-prababicka')
useOn('denik-2', 'vzpominka-dobre-casy')
useOn('denik-3', 'vzpominka-hrozne-casy')
useOn('denik-4', 'vzpominka-tehotenstvi')
useOn('denik-5', 'vzpominka-sebevrazda')
pickup('denik-complete')
combine('kapesnik-babicky', 'kompletni-denik')
useOn('i-hrob', 'smireni') // → smireno, finale-hrbitov
takeExit('x-kostel') // → kostel
onEnter() // kostel finale dialog → endGame

if (!S.ended) fail('did not reach endGame')

// ---- report ----------------------------------------------------------------
console.log(`Referential errors: ${errors.length}`)
errors.forEach((e) => console.log('  ✗ ' + e))
console.log(`Simulation issues: ${sim.length}`)
sim.forEach((e) => console.log('  ✗ ' + e))
if (!errors.length && !sim.length) {
  console.log(`\n✅ OK — game.json is referentially sound and the solution path reaches the ending.`)
  console.log(`   Final inventory leftover: ${[...S.inv].join(', ') || '(empty)'}`)
} else {
  process.exit(1)
}
