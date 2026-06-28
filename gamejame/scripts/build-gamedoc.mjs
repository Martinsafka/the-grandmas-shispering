// Generates the COMPLETE content/game.json — scenes, items, recipes, flags,
// interactables, dialogs, NPCs (chase), cutscenes and the finale — pulling the
// ViewDescriptors from public/atlases/_views.json. Also writes a transparent
// player variant (public/atlases/invisible.png) used to hide the player during
// the intro cutscene.
//
//   node scripts/build-gamedoc.mjs
//
// Re-runnable; it is the source of truth for the game LOGIC. Visual polish
// (backdrops, lighting, layout, item icons) the author does on top in the editor.

import sharp from 'sharp'
import { readFile, writeFile, mkdir } from 'node:fs/promises'

const ROOT = '/Users/martinsafka/WebstormProjects/the-grandmas-shispering/gamejame'
const V = JSON.parse(await readFile(`${ROOT}/public/atlases/_views.json`, 'utf8')).views
const BLIP = 'sounds/dialog-blip.wav'
const voice = { sound: BLIP }

// --- transparent player variant (intro: hide the player) --------------------
await mkdir(`${ROOT}/public/atlases`, { recursive: true })
await sharp({ create: { width: 92, height: 92, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .png()
  .toFile(`${ROOT}/public/atlases/invisible.png`)
const invisible = { atlas: 'atlases/invisible.png', frameWidth: 92, frameHeight: 92, columns: 1, anchorX: 0.5, anchorY: 1, clips: {} }
for (const tag of ['S', 'SE', 'E', 'NE', 'N']) {
  invisible.clips[`idle.${tag}`] = { frames: [0], fps: 4, loop: true }
  invisible.clips[`walk.${tag}`] = { frames: [0], fps: 4, loop: true }
}

// --- condition / effect / shape helpers -------------------------------------
const has = (item) => ({ kind: 'hasItem', item })
const on = (flag) => ({ kind: 'flag', flag, value: true })
const off = (flag) => ({ kind: 'flag', flag, value: false })
const all = (...of_) => ({ kind: 'all', of: of_ })

const eSet = (flag, value = true) => ({ kind: 'setFlag', flag, value })
const eGive = (item) => ({ kind: 'giveItem', item })
const eTake = (item) => ({ kind: 'takeItem', item })
const eGoto = (scene) => ({ kind: 'goTo', scene })
const eSay = (text) => ({ kind: 'say', text })
const eDialog = (dialog) => ({ kind: 'startDialog', dialog })
const eSeq = (sequence) => ({ kind: 'startSequence', sequence })
const eDespawn = (npc) => ({ kind: 'despawnNpc', npc })
const eEnd = () => ({ kind: 'endGame' })
const use = (item, effects) => ({ item, effects })

const box = (cx, cy, hw = 0.05, hh = 0.09) => [cx - hw, cy - hh, cx + hw, cy - hh, cx + hw, cy + hh, cx - hw, cy + hh]
const pickable = (id, item, cx, cy, examine, extra = {}) => ({ kind: 'pickable', id, item, hitArea: box(cx, cy), examine, ...extra })
const interact = (id, cx, cy, examine, extra = {}) => ({ kind: 'interact', id, hitArea: box(cx, cy), examine, effects: extra.effects || [], ...(extra.uses ? { uses: extra.uses } : {}), ...(extra.when ? { when: extra.when } : {}), ...(extra.approachAt ? { approachAt: extra.approachAt } : {}) })
const exitTo = (id, to, cx, cy, extra = {}) => ({ kind: 'exit', id, to, hitArea: box(cx, cy), ...extra })
const trigger = (id, cx, cy, extra) => ({ kind: 'trigger', id, hitArea: box(cx, cy, extra.hw ?? 0.08, extra.hh ?? 0.06), by: extra.by || 'player', effects: extra.effects || [], ...(extra.on ? { on: extra.on } : {}), ...(extra.exitEffects ? { exitEffects: extra.exitEffects } : {}), ...(extra.once ? { once: extra.once } : {}), ...(extra.when ? { when: extra.when } : {}) })

const animLayer = (key, band, xFrac, yFrac, when, scale = 3) => {
  const s = JSON.parse(JSON.stringify(strips[key]))
  return { kind: 'animated', band, src: s.src, frameWidth: s.frameWidth, frameHeight: s.frameHeight, columns: s.columns, frames: s.frames, fps: s.fps, loop: s.loop, xFrac, yFrac, fit: 'none', scale, ...(when ? { when } : {}) }
}
const strips = JSON.parse(await readFile(`${ROOT}/public/atlases/_views.json`, 'utf8')).strips

// --- scene helpers ----------------------------------------------------------
const depth = { yNearFrac: 0.96, yFarFrac: 0.78, scaleNear: 3.5, scaleFar: 2.5 }
const walkable = [0.05, 0.78, 0.95, 0.78, 0.95, 0.96, 0.05, 0.96]
const spawn = { xFrac: 0.5, yFrac: 0.9 }
const scene = (id, name, o = {}) => ({ id, name, width: 1920, layers: o.layers || [], walkable, holes: [], interactables: o.interactables || [], npcs: o.npcs || [], ...(o.onEnter ? { onEnter: o.onEnter } : {}), depth, spawn: o.spawn || spawn })

// ---------------------------------------------------------------------------
// ITEMS
// ---------------------------------------------------------------------------
const itemDefs = [
  // child's room
  ['klic', 'Klíč', 'Starý klíč. Od čeho asi je?'],
  ['hracka', 'Stará panenka', 'Panenka po mamince.'],
  ['obrazek', 'Obrázek', 'Obrázek, který namalovala maminka.'],
  ['fotka-matky', 'Fotka maminky', 'Fotka maminky, když byla šťastná.'],
  ['fotoalbum', 'Fotoalbum', 'Staré rodinné fotoalbum.'],
  ['mem-mom-tmp', 'Maminčiny věci', 'Panenka a obrázek pohromadě.'],
  ['vzpominka-maminka', 'Vzpomínky na maminku', 'Vzpomínky na maminku.'],
  // living room
  ['kapesnik', 'Zakrvácený kapesník', 'Kapesník. A je na něm krev.'],
  ['kapesnik-babicky', 'Babiččin zakrvácený kapesník', 'Babiččin zakrvácený kapesník.'],
  ['lekarska-zprava', 'Lékařská zpráva', 'Papír od doktora.'],
  ['parte', 'Úmrtní oznámení', 'Úmrtní oznámení prababičky.'],
  ['kazeta', 'Stará kazeta', 'Stará kazeta s oblíbeným filmem.'],
  ['leky', 'Léky', 'Spousta dědových léků.'],
  ['darek', 'Starý dárek', 'Dárek z časů, kdy bylo ještě dobře.'],
  ['vzpominka-dobre-casy', 'Vzpomínky na dobré časy', 'Vzpomínky na dobré časy.'],
  ['vzpominka-hrozne-casy', 'Vzpomínky na hrozné časy', 'Vzpomínky na hrozné časy.'],
  // cemetery
  ['svicka', 'Svíčka', 'Obyčejná svíčka.'],
  ['zapalovac', 'Zapalovač', 'Starý zapalovač.'],
  ['zapalena-svicka', 'Zapálená svíčka', 'Hořící svíčka.'],
  ['nesouhlas', 'Nesouhlas s interrupcí', 'Nesouhlas s provedením interrupce u nezletilé.'],
  ['ultrazvuk', 'Fotka z ultrazvuku', 'Fotka z ultrazvuku — zdravé dítě.'],
  ['vzpominka-tehotenstvi', 'Vzpomínky na těhotenství', 'Vzpomínky na těhotenství.'],
  ['kus-papiru-1', 'Kus fotky (1/4)', 'Utržený kus fotky.'],
  ['kus-papiru-2', 'Kus fotky (2/4)', 'Utržený kus fotky.'],
  ['kus-papiru-3', 'Kus fotky (3/4)', 'Utržený kus fotky.'],
  ['kus-papiru-4', 'Kus fotky (4/4)', 'Utržený kus fotky.'],
  ['fotka-tmp1', 'Slepená fotka (2 kusy)', 'Dva slepené kusy fotky.'],
  ['fotka-tmp2', 'Slepená fotka (3 kusy)', 'Tři slepené kusy fotky.'],
  ['fotka-babicky', 'Fotka mladší babičky', 'Složená fotka mladší babičky.'],
  ['lahev-leky', 'Láhev a prášky', 'Prázdná láhev a prášky.'],
  ['vzpominka-sebevrazda', 'Vzpomínky na sebevraždu', 'Vzpomínky na sebevraždu.'],
  ['vzpominka-prababicka', 'Vzpomínky na prababičku', 'Vzpomínky na prababičku.'],
  ['kompletni-denik', 'Kompletní deník', 'Maminčin deník, celý.'],
  ['smireni', 'Smíření', 'Smíření.'],
]
const items = {}
for (const [id, name, examine] of itemDefs) items[id] = { id, name, examine }

// ---------------------------------------------------------------------------
// RECIPES (binary; chains stand in for N-way combines)
// ---------------------------------------------------------------------------
const recipes = [
  { a: 'hracka', b: 'obrazek', output: 'mem-mom-tmp' },
  { a: 'mem-mom-tmp', b: 'fotka-matky', output: 'vzpominka-maminka' },
  { a: 'leky', b: 'lekarska-zprava', output: 'vzpominka-hrozne-casy' },
  { a: 'darek', b: 'kazeta', output: 'vzpominka-dobre-casy' },
  { a: 'svicka', b: 'zapalovac', output: 'zapalena-svicka' },
  { a: 'ultrazvuk', b: 'nesouhlas', output: 'vzpominka-tehotenstvi' },
  { a: 'kus-papiru-1', b: 'kus-papiru-2', output: 'fotka-tmp1' },
  { a: 'fotka-tmp1', b: 'kus-papiru-3', output: 'fotka-tmp2' },
  { a: 'fotka-tmp2', b: 'kus-papiru-4', output: 'fotka-babicky' },
  { a: 'lahev-leky', b: 'fotka-babicky', output: 'vzpominka-sebevrazda' },
  { a: 'kapesnik-babicky', b: 'kompletni-denik', output: 'smireni' },
]

// ---------------------------------------------------------------------------
// DIALOGS
// ---------------------------------------------------------------------------
const dialogs = {
  intro: {
    start: 's',
    nodes: {
      s: { speaker: 'Babička', text: 'Spinkej, jsem dnes velmi unavená a není mi dobře.', next: 'q' },
      q: { speaker: 'Vnučka', text: 'Jak ti není dobře, babičko?', next: 'a' },
      a: { speaker: 'Babička', text: 'Je mi slabo, to bude dobré, spinkej ať si můžu taky lehnout, jsem unavená.' },
    },
  },
  awaken: {
    start: 's',
    nodes: {
      s: { speaker: 'Vnučka', text: 'Co se stalo? Já spinkám? Babičko?', next: 'a' },
      a: { speaker: 'Babička', text: 'Dceruško…' },
    },
  },
  'babicka-spirit': {
    start: 's',
    nodes: {
      // route to the "won't talk" branch until the album has been shown
      s: {
        speaker: 'Babička',
        text: 'Co potřebuješ?',
        branch: [{ when: off('album-shown'), to: 'before' }],
        choices: [
          { text: 'Našla jsem fotku maminky.', when: has('fotka-matky'), next: 'foto' },
          { text: 'Koukni, našla jsem nějaký klíč.', when: has('klic'), next: 'klic' },
          { text: 'Tuhle panenku jsem už někde viděla…', when: has('hracka'), next: 'panenka' },
          { text: 'Babi, čí je tenhle obrázek?', when: has('obrazek'), next: 'obrazek' },
          { text: 'Co se vlastně mamince stalo?', when: has('vzpominka-maminka'), effects: [eGoto('obyvak')] },
          { text: '(už nic)' },
        ],
      },
      before: {
        speaker: 'Babička',
        text: 'Spinkej, nechce se mi povídat.',
        choices: [
          { text: 'Našla jsem tohle album.', when: has('fotoalbum'), effects: [eSet('album-shown')], next: 'album' },
        ],
      },
      album: { speaker: 'Babička', text: 'A hle, naše staré fotoalbum. Tolik vzpomínek, jak jsi byla malá, dokonce i fotky tvojí maminky, než chudák umřela. Dneska jsem na ni hodně myslela, i na dědu. Hodně jsme jí s dědou ublížili.', next: 'album2' },
      album2: { speaker: 'Vnučka', text: 'To jsi mi babi nikdy neříkala.', next: 'album3' },
      album3: { speaker: 'Babička', text: 'Teď už je všechno jinak.' },
      foto: { speaker: 'Babička', text: 'Tady byla šťastná, to je předtím, než moje maminka umřela.' },
      klic: { speaker: 'Babička', text: 'Tak s ním zkus něco odemknout.' },
      panenka: { speaker: 'Babička', text: 'No ne, kde se tu vzala? S tou si hrála tvoje maminka, když byla ještě malá.' },
      obrazek: { speaker: 'Babička', text: 'Ten malovala tvoje maminka, byla moc šikovná.' },
    },
  },
  'babicka-obyvak': {
    start: 's',
    nodes: {
      s: {
        speaker: 'Babička',
        text: 'Ano, holčičko?',
        choices: [
          { text: 'Babi, čí to je krev?', when: has('kapesnik'), effects: [eTake('kapesnik'), eGive('kapesnik-babicky')], next: 'krev' },
          { text: 'Babi, co se tam píše?', when: has('lekarska-zprava'), next: 'zprava' },
          { text: 'Babičko, nerozumím tomu, co se tady píše.', when: has('parte'), next: 'parte' },
          { text: 'Co to tady dělá tahle kazeta?', when: has('kazeta'), next: 'kazeta' },
          { text: 'Babi, proč je tady tolik léků?', when: has('leky'), next: 'leky' },
          { text: 'Babi, čí je tenhle dárek?', when: has('darek'), next: 'darek' },
          { text: 'Babi? Co se děje? Vypadáš tak smutně.', when: all(has('vzpominka-dobre-casy'), has('vzpominka-hrozne-casy')), next: 'odchod' },
          { text: '(už nic)' },
        ],
      },
      krev: { speaker: 'Babička', text: 'To je moje krev. Tvůj děda býval někdy prudký… Ale dřív jsem se ho nemusela bát.' },
      zprava: { speaker: 'Babička', text: 'Že je děda moc nemocný a může se chovat zvláštně.' },
      parte: { speaker: 'Babička', text: 'Tam je napsáno, že moje maminka umřela. Tvoje maminka i já jsme z toho byly velmi smutné. Hlavně kvůli dědovi.' },
      kazeta: { speaker: 'Babička', text: 'Kde se tady vzala? To byl náš s dědou milovaný film. To jsme s dědou pouštěli pořád dokola… tehdy jsme ještě bývali šťastní.' },
      leky: { speaker: 'Babička', text: 'To jsou dědy léky, ale v téhle době, když se blížil konec, už příliš nepomáhaly.' },
      darek: { speaker: 'Babička', text: 'To mi dal děda, když ještě… Když nám bylo ještě dobře.' },
      odchod: { speaker: 'Babička', text: 'Moje dceruška. Dneska na ni moc myslím. Zklamala jsem ji. Mám pocit, že mě volá.', effects: [eGoto('hrbitov')] },
    },
  },
  zvuky: {
    start: 's',
    nodes: {
      s: { speaker: 'Vnučka', text: 'Co to je za zvuky? Tam někdo pláče?', next: 'a' },
      a: { speaker: 'Babička', text: 'Nechoď k těm dveřím, pojď sem ke mně.' },
    },
  },
  'hrbitov-intro': {
    start: 's',
    nodes: { s: { speaker: 'Vnučka', text: 'Kde to jsme? Kdo to je? Babi? Kde jsi?' } },
  },
  finale: {
    start: 's',
    nodes: {
      s: { speaker: 'Vnučka', text: 'Maminko?', next: 'n1' },
      n1: { speaker: 'Matka', text: 'Jsi to ty? Nemůžu uvěřit, že jsi na to všechno přišla.', next: 'n2' },
      n2: { speaker: 'Matka', text: 'Jsi tak hodná a přitom jsi jeho.', next: 'n3' },
      n3: { speaker: 'Vnučka', text: 'Jsem tvoje, mami.', next: 'n4' },
      n4: { speaker: 'Babička', text: 'Promiň, dceruško, chtěla jsem ti pomoct, opravdu. Já nemohla, viděla jsem v ní jeho.', next: 'n5' },
      n5: { speaker: 'Matka', text: 'To já taky.', next: 'n6' },
      n6: { speaker: 'Babička', text: 'Je mi to líto, je mi to všechno tak líto. Chtěla jsem věřit, že ho ještě poznávám.', next: 'n7' },
      n7: { speaker: 'Matka', text: 'A kvůli tomu jsi mě nechala samotnou.', next: 'n8' },
      n8: { speaker: 'Babička', text: 'Ano.', next: 'n9' },
      n9: { speaker: 'Matka', text: 'Nenáviděla jsem tě víc než jeho.', next: 'n10' },
      n10: { speaker: 'Babička', text: 'Vím.', next: 'n11' },
      n11: { speaker: 'Matka', text: 'Ale postarala ses o ni.', next: 'n12' },
      n12: { speaker: 'Babička', text: 'Bylo to jediné, co jsem ještě mohla napravit.', next: 'n13' },
      n13: { speaker: 'Matka', text: 'Myslela jsem, že po něm nezůstalo nic dobrého… Asi jsem se mýlila. Nevím, jestli ti dokážu odpustit.', next: 'n14' },
      n14: { speaker: 'Matka', text: 'Ale už tě nechci nenávidět.', effects: [eDespawn('matka-kostel'), eDespawn('babicka-kostel'), eEnd()] },
    },
  },
}

// ---------------------------------------------------------------------------
// SEQUENCES (cutscenes)
// ---------------------------------------------------------------------------
const sequences = {
  intro: {
    steps: [
      { kind: 'dialog', dialog: 'intro' },
      { kind: 'effects', effects: [eSet('asleep')] },
      { kind: 'wait', ms: 1200 },
      { kind: 'dialog', dialog: 'awaken' },
      { kind: 'effects', effects: [eSet('intro', false), eGoto('pokoj-spirit')] },
    ],
  },
  'finale-hrbitov': {
    steps: [
      { kind: 'wait', ms: 600 },
      { kind: 'move', actor: 'matka-hrbitov', to: { xFrac: 0.5, yFrac: 0.8 } },
      { kind: 'effects', effects: [eDespawn('matka-hrbitov')] },
    ],
  },
}

// ---------------------------------------------------------------------------
// JOURNAL — stacked in-scene hotspots, gated by level flags (order enforced)
// ---------------------------------------------------------------------------
const diary = {
  closed: 'Co je tohle za knížku? Vypadá jako deníček, ale nejde otevřít.',
  d1: 'Dneska jsem ve škole dostala vysvědčení. Měla jsem pár špatných známek, ale maminka se na mě vůbec nezlobila a řekla, že jsem její šikulka.',
  d2: 'Babička je prostě nejvíc nejlepší. Můžu jí říct všechno a moc se o mě stará. Miluju jí!',
  d3: 'Byli jsme s maminkou a tátou na výletě, bylo to super! Táta se vztekal kvůli autu a my se mu s maminkou smály.',
  d4: 'Táta se chová zvláštně. Křičel na maminku, křičel na mě. Bojím se. Maminka plakala. Babička by věděla, co dělat, ale už tu není. Maminka se také bojí, jsem sama.',
  d5: 'To dítě je jeho. Nenávidím ho. Nenávidím ji. Prý je to poslední, co po něm zbylo. I když je pryč, pořád je se mnou. Ať všechno po něm zmizí, ale ona mi to nedovolí. Pořád ho miluje. Nenávidím je všechny.',
  complete: 'Už nemůžu. Je mi to jedno. Nesnáším je obě. Nemůžu si pomoci. Jestli ji chce, ať si ji nechá. Já končím. Zradili mě, zklamali. On mě zničil a ona je zbabělec.',
}
const JX = 0.5
const JY = 0.62
const journalLevel = (id, examine, gateWhen, memItem, nextFlag) =>
  interact(id, JX, JY, examine, { when: gateWhen, uses: [use(memItem, [eTake(memItem), eSet(nextFlag)])] })

const journalHotspots = [
  journalLevel('denik-0', diary.closed, off('denik1'), 'vzpominka-maminka', 'denik1'),
  journalLevel('denik-1', diary.d1, all(on('denik1'), off('denik2')), 'vzpominka-prababicka', 'denik2'),
  journalLevel('denik-2', diary.d2, all(on('denik2'), off('denik3')), 'vzpominka-dobre-casy', 'denik3'),
  journalLevel('denik-3', diary.d3, all(on('denik3'), off('denik4')), 'vzpominka-hrozne-casy', 'denik4'),
  journalLevel('denik-4', diary.d4, all(on('denik4'), off('denik5')), 'vzpominka-tehotenstvi', 'denik5'),
  journalLevel('denik-5', diary.d5, all(on('denik5'), off('denik6')), 'vzpominka-sebevrazda', 'denik6'),
  pickable('denik-complete', 'kompletni-denik', JX, JY, diary.complete, { when: on('denik6') }),
]

// ---------------------------------------------------------------------------
// SCENES
// ---------------------------------------------------------------------------
const scenes = {
  'pokoj-realita': scene('pokoj-realita', 'Dětský pokoj (realita)', {
    onEnter: [eSeq('intro')],
    layers: [
      animLayer('vnucka-wake', 'mid', 0.3, 0.78, off('asleep')),
      animLayer('vnucka-sleep', 'mid', 0.3, 0.78, on('asleep')),
      animLayer('babicka-chair', 'mid', 0.72, 0.8),
    ],
  }),

  'pokoj-spirit': scene('pokoj-spirit', 'Dětský pokoj (duchovní svět)', {
    npcs: [{ npc: 'babicka-old', spawn: { xFrac: 0.7, yFrac: 0.84 } }],
    interactables: [
      pickable('p-fotoalbum', 'fotoalbum', 0.2, 0.66, 'Kde se tady vzalo tohle album?'),
      pickable('p-klic', 'klic', 0.85, 0.7, 'A hele, klíč, od čeho asi tak je?'),
      pickable('p-hracka', 'hracka', 0.45, 0.62, 'To je ale stará panenka!'),
      pickable('p-fotka-matky', 'fotka-matky', 0.32, 0.6, 'Tahle fotka maminky tu nebyla.', { when: on('album-shown') }),
      interact('i-suplik-locked', 0.62, 0.72, 'Hm, zamčený.', {
        when: off('drawer-open'),
        uses: [use('klic', [eTake('klic'), eSet('drawer-open')])],
      }),
      interact('i-suplik-open', 0.62, 0.72, 'Otevřený šuplík.', { when: on('drawer-open') }),
      pickable('p-obrazek', 'obrazek', 0.55, 0.74, 'A hele, to je ale hezký obrázek.', { when: on('drawer-open') }),
    ],
  }),

  obyvak: scene('obyvak', 'Obývák', {
    npcs: [{ npc: 'babicka-sad', spawn: { xFrac: 0.5, yFrac: 0.84 } }],
    interactables: [
      pickable('p-kapesnik', 'kapesnik', 0.22, 0.72, 'Kapesník. A je na něm krev! Babi? Babi, stalo se ti něco?'),
      pickable('p-lekarska-zprava', 'lekarska-zprava', 0.38, 0.62, 'Papír od doktora, ale nerozumím, co se tam píše.'),
      pickable('p-parte', 'parte', 0.52, 0.6, 'Na tomhle papíru je jméno mojí prababičky.'),
      pickable('p-kazeta', 'kazeta', 0.68, 0.64, 'Stará kazeta? Co je na ní asi za film?'),
      pickable('p-leky', 'leky', 0.82, 0.7, 'Tolik léků? Snad se babička nebude zlobit, když na ně sáhnu.'),
      pickable('p-darek', 'darek', 0.6, 0.72, 'Starý dárek. Od koho asi je?'),
      interact('i-zvuky', 0.9, 0.5, 'Tam někdo pláče?', { effects: [eDialog('zvuky')] }),
    ],
  }),

  hrbitov: scene('hrbitov', 'Hřbitov', {
    npcs: [
      { npc: 'prisera', spawn: { xFrac: 0.5, yFrac: 0.85 }, when: off('smireno'), path: { points: [0.3, 0.82, 0.7, 0.82, 0.7, 0.92, 0.3, 0.92], mode: 'loop' } },
      { npc: 'matka-hrbitov', spawn: { xFrac: 0.5, yFrac: 0.76 }, when: on('smireno') },
    ],
    interactables: [
      // grave: gives the great-grandma memory (parte) and triggers the finale (smíření)
      interact('i-hrob', 0.5, 0.45, 'To je hrob mojí prababičky.', {
        approachAt: { xFrac: 0.5, yFrac: 0.82 },
        uses: [
          use('parte', [eTake('parte'), eGive('vzpominka-prababicka')]),
          use('smireni', [eTake('smireni'), eSet('smireno'), eSeq('finale-hrbitov')]),
        ],
      }),
      interact('i-tmave-papiry', 0.18, 0.72, 'Co to je? Nevidím na to.', {
        uses: [use('zapalena-svicka', [eTake('zapalena-svicka'), eGive('nesouhlas'), eSay('Už na to vidím.')])],
      }),
      pickable('p-svicka', 'svicka', 0.12, 0.64, 'A hele, svíčka.'),
      pickable('p-zapalovac', 'zapalovac', 0.88, 0.64, 'Zapalovač. S tím bych si neměla hrát. Co když jen zkusím, jestli funguje?'),
      pickable('p-ultrazvuk', 'ultrazvuk', 0.3, 0.6, 'To je moje fotka v maminčině bříšku.'),
      pickable('p-lahev-leky', 'lahev-leky', 0.72, 0.72, 'Láhev a prášky.'),
      pickable('p-papir-1', 'kus-papiru-1', 0.1, 0.7, 'Kus papíru. Najdu ještě jiný?'),
      pickable('p-papir-2', 'kus-papiru-2', 0.38, 0.74, 'Kus papíru. Najdu ještě jiný?'),
      pickable('p-papir-3', 'kus-papiru-3', 0.62, 0.74, 'Kus papíru. Najdu ještě jiný?'),
      pickable('p-papir-4', 'kus-papiru-4', 0.9, 0.7, 'Kus papíru. Najdu ještě jiný?'),
      ...journalHotspots,
      // safe to read/use memories on the journal while standing here (vision off)
      trigger('z-denik-safe', JX, 0.84, { hw: 0.2, hh: 0.12, on: 'enter', effects: [eSet('reading')], exitEffects: [eSet('reading', false)] }),
      // hiding spots
      trigger('z-ukryt-1', 0.08, 0.86, { hw: 0.06, hh: 0.06, on: 'enter', effects: [eSet('hidden')], exitEffects: [eSet('hidden', false)] }),
      trigger('z-ukryt-2', 0.92, 0.86, { hw: 0.06, hh: 0.06, on: 'enter', effects: [eSet('hidden')], exitEffects: [eSet('hidden', false)] }),
      // one-time cemetery line
      trigger('t-intro', 0.5, 0.9, { hw: 0.2, hh: 0.05, once: true, when: off('hrbitov-seen'), effects: [eSet('hrbitov-seen'), eDialog('hrbitov-intro')] }),
      // the church opens once reconciled → the final scene
      exitTo('x-kostel', 'kostel', 0.5, 0.38, { when: on('smireno'), examine: 'Kostel. Vchod se otevřel.', approachAt: { xFrac: 0.5, yFrac: 0.82 } }),
    ],
  }),

  kostel: scene('kostel', 'Kostel', {
    onEnter: [eDialog('finale')],
    npcs: [
      { npc: 'babicka-kostel', spawn: { xFrac: 0.42, yFrac: 0.86 } },
      { npc: 'matka-kostel', spawn: { xFrac: 0.58, yFrac: 0.86 } },
    ],
  }),
}

// ---------------------------------------------------------------------------
// NPCS
// ---------------------------------------------------------------------------
const npcs = {
  'babicka-old': { id: 'babicka-old', name: 'Babička', view: V['babicka-old'], voice, dialog: 'babicka-spirit' },
  'babicka-sad': { id: 'babicka-sad', name: 'Babička', view: V['babicka-sad'], voice, dialog: 'babicka-obyvak' },
  'babicka-kostel': { id: 'babicka-kostel', name: 'Babička', view: V['babicka-old'], voice },
  prisera: {
    id: 'prisera',
    name: 'Příšera',
    view: V.prisera,
    vision: { range: 0.42, angle: 80, unless: { kind: 'any', of: [on('reading'), on('hidden')] }, effects: [eGoto('hrbitov')] },
  },
  'matka-hrbitov': { id: 'matka-hrbitov', name: 'Matka', view: V['matka-smirena'], voice, speed: 2.5 },
  'matka-kostel': { id: 'matka-kostel', name: 'Matka', view: V['matka-smirena'], voice },
}

// ---------------------------------------------------------------------------
// DOC
// ---------------------------------------------------------------------------
const doc = {
  start: 'pokoj-realita',
  referenceHeight: 1080,
  transition: { color: '#000000', minMs: 600 },
  initialFlags: { intro: true },
  scenes,
  items,
  recipes,
  dialogs,
  sequences,
  npcs,
  player: V.vnucka,
  playerViews: [{ when: on('intro'), view: invisible }],
  sounds: { 'dialog-blip': { id: 'dialog-blip', name: 'Dialog blip', src: BLIP } },
  screens: {
    title: { heading: 'Vzpomínky', tagline: 'point-and-click' },
    end: { text: 'Konec', size: 56, color: '#e8e8ea', align: 'center' },
    credits: { text: 'Vzpomínky\n\nGamejam', size: 32, color: '#e8e8ea', align: 'center', scrollSpeed: 40 },
  },
}

await writeFile(`${ROOT}/content/game.json`, JSON.stringify(doc, null, 2))
console.log(`Wrote content/game.json — ${Object.keys(scenes).length} scenes, ${Object.keys(items).length} items, ${recipes.length} recipes, ${Object.keys(dialogs).length} dialogs, ${Object.keys(npcs).length} NPCs`)
