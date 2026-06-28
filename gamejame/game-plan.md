# Vývojový plán — point-and-click hra (Pixin)

Plánovací dokument vedle [`game-concept.txt`](./game-concept.txt). Postupně sem zapisujeme,
jak hru rozdělíme do jednotlivých bodů vývoje, a podle toho pak editujeme `content/game.json`.

**Engine:** Pixin (`@theideaguards/pixin` 0.1.5) — celá hra je jeden `GameDoc` v `content/game.json`.
Souřadnice = zlomky 0..1; jeden slovník `Condition`/`Effect` gate-uje vše; flagy jsou stringy
vznikající při prvním použití; recepty jsou **binární** (`a + b → output`).

**Stav dokumentu (úkoly):**
- [x] **Úkol 1 — Analýza:** logická konzistence + co (ne)jde v editoru → sekce A–C níže.
- [x] **Rozhodnutí + revidovaný závěr** zaznamenány → sekce D–F níže.
- [x] **Úkol 2 — Vývoj:** kroky **1–8 HOTOVO** (zvuk, player, NPC, items+flagy+recepty,
  interakce+clues, dialogy, honička, finále).
- [x] **Úkol 3 — `game.json` kompletní a OVĚŘENÝ** (`scripts/validate-game.mjs`: 0 ref. chyb +
  simulovaný průchod dojde k `endGame`; `tsc` OK; atlasy/zvuk se servírují).

### Hotová logika (krok 4–8)
- **34 items, 11 recipes** — maminka (3 věci přes mezičlánek), deník 6 úrovní, fotka babičky ze 4 kusů.
- **Dialogy (7):** intro, babička-spirit (album gate → item větve → přechod), babička-obyvak
  (transform kapesníku → přechod), zvuky, hřbitov-intro, finále (smiřovací dialog → `endGame`).
- **Honička:** příšera patrol-loop + `vision` (80°, range 0.42) → **měkký reset `goTo hrbitov`**;
  `vision.unless any(reading, hidden)`; bezpečná zóna u deníku + 2 úkryty.
- **Finále:** `smíření` na hrob → příšera (`when not smireno`) zmizí, klidná matka (`when smireno`)
  → glide cutscéna → despawn → kostel exit (`when smireno`) → kostel onEnter finále dialog → konec.
- **Intro:** hráč neviditelný (`playerViews when intro` = průhledný atlas), vnučka wake→sleep +
  babička v křesle jako animované vrstvy, cutscéna → `goTo pokoj-spirit`.

### Placeholdery k tvému polishi
Pozadí scén, světla/atmosféra, **rozmístění hotspotů + walkable** (teď default spodní pruh +
default pozice), depth/scale, **ikony itemů** (`Items/`), screens (title/end/credits jen minimální).
Logika je na souřadnicích nezávislá → repozicování v editoru ji nerozbije.
> ⚠️ `game.json` je generován `scripts/build-gamedoc.mjs`. Až začneš polishovat v editoru a
> exportovat, stává se zdrojem export — **negeneruj znovu** (přepsal by polish).

---

## Úkol 1 — Analýza

### A) Logická konzistence a herní smyčka

Příběhová a puzzle-logika **dává smysl a je provázaná**. Smyčka: v každé scéně sbírej +
kombinuj „vzpomínky", nes je dál, na hřbitově jimi ve správném pořadí odemkni deník a usmiř
matku s babičkou. Ověřená ekonomika předmětů (kde vzniká která vzpomínka):

| Vzpomínka | Vzniká kde | Vstupy |
| --- | --- | --- |
| na maminku | dětský pokoj | hračka + obrázek + fotka matky |
| na prababičku | hřbitov | parte (z obýváku) **použít na** hrob |
| na dobré časy | obývák | dárek **použít na** TV/seriál |
| na hrozné časy | obývák | léky + lékařská zpráva |
| na těhotenství | hřbitov | ultrazvuk + nesouhlas s interrupcí (= zapálená svíčka na papíry) |
| na sebevraždu | hřbitov | láhev a léky + **fotka mladší babičky** (= 4 kusy papíru postupně složené) |

Pořadí deníku (maminku → prababičku → dobré → hrozné → těhotenství → sebevraždu) je
**splnitelné** — než hráč dojde na hřbitov, nese si maminku (z pokoje) + dobré a hrozné časy
(z obýváku); prababičku, těhotenství a sebevraždu vyrobí na hřbitově. Pořadí se vynutí samo
(viz Problém 6). Závěr: `babiččin kapesník` + `kompletní deník` → `smíření` → aplikovat na finále.

> ⚠️ **Kritické pro neuváznutí (soft-lock):** vzpomínky `na maminku`, `na dobré časy` a
> `na hrozné časy` slouží **dvakrát** — jako brána pro přechod scény *a* jako vstup do deníku.
> Přechody scén proto musí gate-ovat na **`hasItem`** (jen čtení), **nikdy** přes `takeItem`.
> Kdyby přechod vzpomínku spotřeboval, deník už nepůjde dokončit. Totéž `babiččin kapesník`
> (drž ho až do finále). Při stavbě logiky hlídat.

### B) Implementační problémy

Legenda: 🔴 přímo nelze · 🟡 lze, ale jinak než doslovně v konceptu (obejití) · 🟢 drobnost.

#### 🟡 Problém 1 — Kombinace více než 2 předmětů
Recept je striktně **binární** (`Recipe { a, b, output }`). Koncept ale vyžaduje:
- „vzpomínky na maminku" = **3 předměty** (hračka + obrázek + fotka matky),
- „roztrhaná fotka babičky" = **N kousků papíru**.

**Obejití:** zřetězit přes mezivýsledky, např. `hračka + obrázek → (panenka s obrázkem)`,
`(panenka s obrázkem) + fotka matky → vzpomínky na maminku`. Mezivýsledek se hráči krátce
objeví v inventáři. Pro kousky papíru obdobně (kus1+kus2 → …). Konkrétní řetězce navrhnu v Úkolu 2.

#### 🟡 Problém 2 — Použití předmětu NA postavu (NPC)
V editoru jde „use item on object" jen na **interactable** (`interact`/`exit` mají `uses`).
**NPC (`NpcDef`/`NpcPlacement`) pole `uses` nemá** — předmět tedy nelze přetáhnout na postavu.
Týká se: „kapesník použít na babičku", „dávat collectables duchu babičky", „aplikovat smíření
na příšeru".

**Obejití:** realizovat **dialogem** — možnost (choice) gate-ovaná `when: hasItem X`, jejíž
`effects` udělají potřebné (transformace = `takeItem starý` + `giveItem nový`; nebo `goTo`).
To už ostatně koncept v dialozích používá („when krvavý kapesník …"). **Výjimka: finále
„smíření na příšeru"** — příšera žádný dialog nemá. Možnosti: (a) neviditelný `trigger`/
`interact` hotspot u hrobu s `uses: [smíření → efekty konce]`, (b) hráč dá smíření přes dialog
klidnému duchovi matky. → rozhodnutí v Otevřených otázkách.

> Pozn.: globální **Rule** na finále nepoužít — v Rule jsou „engine" efekty (`startSequence`,
> `playSound`, `playAnim`) **inertní**; spustí se jen stavové efekty. Cutscénu musí spustit
> hotspot/trigger/dialog, ne Rule.

#### 🟡 Problém 3 — Změna nálady/světla uvnitř jedné scény přes flag
`SceneData.colorGrade` ani `ambientLight` **nemají `when`** — celkovou náladu scény (grade,
ambient světlo) nelze přepnout flagem za běhu. Jednotlivé `LightSource` `when` mají.
Týká se: dětský pokoj realita → spirit realm (změna světla) a závěr (zpět v pokoji, babička mrtvá).

**Obejití:** udělat **oddělené varianty scény** se stejným pozadím — `pokoj-realita`,
`pokoj-spirit`, `pokoj-konec` — propojené `goTo`. Každá má vlastní grade/ambient/obsazení.
(Dílčí změny jdou i přes `when` na světlech, ale na výrazný realita→duch přechod jsou čistší
samostatné scény.) Důsledek: víc scén k postavení.

#### 🔴 Problém 4 — Zpomalení příšery za běhu („otevřenější deník ji zpomaluje")
`NpcDef.speed` je **statický**, neexistuje žádný `setSpeed` efekt a speed nejde `when`-gate-ovat.
Plynule zpomalit příšeru podle stavu deníku **přímo nelze**.

**Obejití:** žádné čisté. Aproximace: flagem přepnout příšeře **placement/path** (`paths` s `when`)
na pomalejší/kratší trasu, nebo ji na chvíli `despawnNpc`. Doporučení: pro gamejam **vyškrtnout**,
nebo nahradit „bezpečným čtením" (Problém 5).

> ✅ **ROZHODNUTO: vyškrtnuto.** Zpomalení příšery neřešíme. Bezpečí při čtení zajistí Problém 5.

#### 🟡 Problém 5 — Pauza honičky při čtení/prohlížení (grace period)
Prohlížení předmětu (examine) ani otevřený inventář **automaticky nepozastaví** pohyb a vision
příšery — hrozí dohonění během čtení. (Obava přímo z konceptu, ř. 93–95.)

**Obejití (Pixin-native stealth):**
- **Úkryty** = `trigger` na úkrytu, `on: 'rest'`, `effects: [setFlag hidden]`,
  `exitEffects: [setFlag hidden=false]`; příšera má `vision.unless: { flag: hidden }`.
- **Bezpečné čtení** = čtecí dialog/uzel nastaví `ctu` na začátku a zruší na konci; příšera
  `vision.unless: any[hidden, ctu]`. Příšera dál chodí, ale nespustí `gameOver`.

To je přesně vzor „stealth beat" z Pixinu — funkční.

> ✅ **ROZHODNUTO: úkryty + „bezpečné čtení", a číst jen u deníku.** Číst/prozkoumávat (zvláště
> texty deníku) jde **pouze u deníku** — tj. „bezpečné čtení" (flag, který vypne `vision`) se
> váže na interakci s deníkem. Mimo deník a úkryty je hráč zranitelný a musí příšeře uhýbat.

#### 🟡 Problém 6 — Postupné odemykání deníku ve scéně + vynucené pořadí
`UseRule` **nemá `when`** — nelze říct „tahle kombinace platí jen na úrovni N". Deník přitom
leží ve scéně (hlídaný příšerou) a odemyká se po krocích jen ve správném pořadí.

**Obejití:** deník = **sada naskládaných interactable hotspotů**, každý gate-ovaný
`when: flag denik-N`, každý s jediným use-rule na správnou další vzpomínku → použití špatné
vzpomínky nemá pravidlo = nic se nestane (přesně „jinak se nic nestane", ř. 115). Examine text
per úroveň (texty deníku 1–5 + kompletní jsou v konceptu). Cca 6–7 stavů — funkční, jen ukecané.
*(Alternativa: deník jako inventární item + řetězené recepty — ale to se bije s „hlídaný ve scéně".)*

> ✅ **ROZHODNUTO: in-scene naskládané hotspoty.** Hráč musí nejdřív vyrobit správnou vzpomínku
> a pak ji **použít (use) na deník** ve scéně. Každá úroveň = vlastní hotspot gate-ovaný flagem
> úrovně, s jedním use-rule na správnou vzpomínku.

#### 🟢 Problém 7 — Více kusů téhož předmětu (kousky papíru)
`hasItem` je boolean, inventář nemá množství — nejde držet „2× kus papíru". Každý kus musí být
**vlastní item id** (`kus-papiru-1..N`), pak zřetězené recepty (viz Problém 1).

### C) Co naopak JDE bez problémů (potvrzeno proti schématu)
3 scény + přechody `goTo` · pickable/examine/conditional examine · **use-item-on-object**
(svíčka na papíry, parte na hrob, dárek na TV) · transformace předmětu (`takeItem`+`giveItem`) ·
**binární recepty** (řetěz deníku, zapálená svíčka, těhotenství, sebevražda) · dialogy s větvením
gate-ované na `hasItem` + změna scény z dialogu · **průhledný duch hráče** = `playerViews` varianta
přes flag · **honička** = patrol path + `vision` (kužel/LOS) + `gameOver` + úkryty · **finále bez
výměny vzhledu** = `despawnNpc` příšery + klidní duchové jako 2 samostatná NPC (dle tvého přání) ·
zvuky (`playSound`), hudba jako per-scéna ambient, **ticho na konci** = závěrečná scéna bez ambientu ·
cutscény (`sequences`).

### D) Rozhodnutí (zodpovězeno)
1. **Finále „smíření"** → **use-on-object na HROB** (smíření se použije na hrob, ne na příšeru). ✅
2. **Zpomalení příšery** → **vyškrtnuto**. ✅
3. **Grace period** → **úkryty + „bezpečné čtení", číst jen u deníku**. ✅
4. **Deník** → **in-scene naskládané hotspoty**, use vyrobené vzpomínky na deník. ✅
5. **Kusy papíru** → **4 kusy**, postupně skládané do **kompletní fotky mladší babičky**. ✅

### E) Revidovaný závěr (nahrazuje původní „u hrobu" finále)

Tok po dokončení deníku (`kompletní deník` + `babiččin kapesník` → `smíření`):

1. **Hřbitov — použít `smíření` na HROB** → `setFlag smířeno` + spustí cutscénu:
   - příšera (zlý duch matky) **zmizí** — její placement je `when: not smířeno`, takže `smířeno`
     ji odebere (+ lze `despawnNpc`).
   - objeví se **klidný duch matky** (samostatné NPC id, placement `when: smířeno`), cutscéna ho
     **přesune ke kostelu** (`move` step) a tam **zmizí** (`despawnNpc`).
   - **kostel** (nakreslený ve scéně) se stane aktivním **exitem** → `when: smířeno` → `goTo kostel`.
2. **Scéna 4 „kostel"** — u **velké sochy anděla** stojí **duch babičky + duch matky** vedle sebe
   (placementy obou klidných duchů). `onEnter` → **cutscéna** se **smiřovacím dialogem** (přesun
   původního dialogu „Vnučka: Maminko?… / Matka: …Ale už tě nechci nenávidět." sem).
3. **Konec** — oba duchové **zmizí**, **ticho** (žádný ambient v této scéně/části), hra končí
   (`endGame` nebo závěrečný fade). **Otevřený konec** — záměrně bez explicitního „babička mrtvá"
   epilogu, ať hráč sám zváží: zlý sen vs. babička skutečně zemřela.

*Pozn.: původní lin. 319–325 epilog „Pokoj / Ne… Babi" je tímto nahrazen. Pokud bys ho přesto
chtěl jako krátký poslední záběr, lze doplnit jako scénu 5 — ale dle popisu hra končí u kostela.*

Proveditelnost závěru: ✅ vše stojí na podporovaných prvcích — `uses` na hrobu, podmíněné
placementy NPC (`when` flag), `despawnNpc`, cutscéna (`move`/`dialog`/`effects`), `exit` gate-ovaný
flagem, `endGame`. Žádný nový blocker.

### F) Seznam scén (Pixin)

Narativně 4 lokace; technicky **5 Pixin scén** (dětský pokoj je kvůli Problému 3 rozdělen na
realitu a spirit — tvrdý střih přes transition wash je zde i dramaticky vhodný):

| # | scéna (id) | obsazení | role |
| --- | --- | --- | --- |
| 1 | `pokoj-realita` | babička (živá, v křesle) + vnučka | úvodní cutscéna → přechod do spirit realm |
| 2 | `pokoj-spirit` | duch babičky + **průhledný hráč** | clues + puzzle „vzpomínky na maminku" → `goTo obyvak` |
| 3 | `obyvak` | duch mladší babičky (gauč) | clues + dobré/hrozné časy → `goTo hrbitov` |
| 4 | `hrbitov` | příšera (honička) → klidná matka; kostel jako exit | deník, sub-puzzly, honička, finále-část 1 |
| 5 | `kostel` | duch babičky + duch matky + socha anděla | smiřovací cutscéna → konec (otevřený) |

> **Hráč (duše):** základní view vnučky je **éterické** (odsaturované + lehce průhledné) — duše je
> takto po celou hratelnou část. **Neviditelnost během úvodní cutscény** řeší `playerViews` varianta
> `when: flag intro` = **prázdný/průhledný atlas** (hráč zmizí); po cutscéně se `intro` zruší a hráč
> je vidět. (Odpadá tím samostatný „spirit" flag.)

---

## Úkol 2 — Pořadí vývoje (revidováno dle tvého návrhu)

Atmosféru (světla, ambient) **neřeším** — uděláš si sám. Pořadí (od stabilních id k logice):

1. **Zvuk** — sound library: pickup, scene-transition, footstep, dialog-blip (voice). *(Pozn.:
   pickup/transition/footstep už existují jako vestavěné procedurální `sfx-*` — viz otázky.)*
2. **Player character** — atlas z frames (složka), **5 směrů** idle+walk (W-strana se zrcadlí
   automaticky → SW/W/NW), anchor na nohou; éterické zpracování (odsaturace + průhlednost).
3. **NPC** — `babicka`, `zly-duch-matky` (příšera), `smireny-duch-matky`. Atlasy ze stejné složky.
4. **Items + flagy + recepty** — katalog, řetězce kombinací (deník, vzpomínky, fotka), flag-web.
5. **Interakce + clues** — pickables, inspect, use-on-object, šuplík, deník-hotspoty.
6. **Dialogy** — babička (větvení na `hasItem`), scene-change možnosti, úvodní cutscéna-dialog.
7. **Honička** — příšera: patrol path + `vision` (kužel/LOS) + úkryty + `gameOver`; bezpečné čtení.
8. **Finále + cutscény** — smíření → hrob → kostel → smiřovací dialog → konec.

### Postavy, animace, intro cutscéna (tvé poznámky + technické řešení)

- **Duše = hráč + babička + smířený duch matky** → atlasům **snížit saturaci + lehká průhlednost**.
  **Zlý duch matky (příšera) NENÍ duše** → plná sytost/krytí.
- **Babička** — jen **idle**, do scén se „portuje", **statická** (nechodí).
- **Smířený duch matky** — jen **idle**; na hřbitově po objevení má **path do kostela**, kterou
  projde **velmi rychle** (vysoký `speed`) — gliduje v idle (walk-clip netřeba). Naznačí průchod.
- **Zlý duch matky (příšera)** — chodí (honička). *Otevřené: má walk anim, nebo gliduje v idle?*
- **Úvodní cutscéna (`pokoj-realita`)** — během cutscény **žádný hráč ani NPC babičky**:
  - na posteli **vnučka jako animovaná vrstva (frames)** — „wake" (nespí); během cutscény usne →
    swap na „sleep" (vrstvy gate-ované flagem `asleep`, přepnuto `effects` krokem).
  - babička v křesle **jen animovaná vrstva (frames)** — není NPC.
  - dialog řeší cutscéna `dialog` krokem (speaker „Babička"/„Vnučka" — NPC netřeba).
  - hráč **neviditelný** přes `playerViews when intro`.
- **Po cutscéně** (`goTo pokoj-spirit`): objeví se **hráč** (éterický) **a ANO i NPC babičky**
  (mluvíš s ní, ukazuješ předměty → NPC nutné). Volitelně na posteli zůstane „sleep" vrstva (tělo).

### Úložiště atlasů — doporučení
Atlasy **neinlinovat jako base64**, ale uložit jako **PNG do `public/`** a v `game.json`
referencovat **URL** (`/atlases/player.png`). Vícenásobné MB base64 blob by udělaly `game.json`
obrovský a křehký pro cílené editace logiky. URL refy fungují v dev i buildu (Vite kopíruje
`public/`). Atlasy poskládám skriptem (`sharp`, už v devDeps) — ekvivalent editorového „+ Frames"
(editor UI neumím obsluhovat, ale výsledný `ViewDescriptor` v JSON je identický).

### Save / game-over u honičky (k ověření v kroku 7)
`gameOver` ukazuje obrazovku s **Retry (poslední save)**. Musíme ověřit, kdy engine ukládá — aby
Retry vracel **na začátek hřbitova**, ne na začátek hry. Alternativa (přívětivější, bez závislosti
na save): vision efekt = **`goTo hrbitov`** (měkký reset na spawn) místo `gameOver`.

### Otevřené otázky (Úkol 2)
1. **Zvuky:** stačí vestavěné `sfx-pickup/transition/footstep`, nebo vlastní nahrané? (Reálné audio
   neumím; můžu syntetizovat jednoduché placeholder WAV skriptem.) Dialog-blip = per-postava „voice".
2. **Atlasy:** OK uložit jako URL do `public/` (doporučeno), nebo editorový data-URL flow?
3. **Příšera:** má ve složce **walk** anim, nebo jen idle (glide)?
4. **Honička:** `gameOver` (+ ověřit save), nebo měkký reset přes `goTo`?
5. **Složka animací:** pošli ji — rozměry framů, pojmenování/pořadí, počet framů na klip, a které
   klipy existují (idle/walk po směrech; bed wake/sleep; babička v křesle; pickup/interact?).

---

## Aktiva + finální rozhodnutí (po dodání složky `Desktop/Gamejame`)

Složka má **kompletní art**: `Animace/`, `Items/`, `Scene_1..4` (pozadí + props), `UI/`.
Animace = **92×92 px `.webp`**, jednotné.

**Animace → klipy:**
| Postava | Atlas | Klipy | Duše? |
| --- | --- | --- | --- |
| Vnučka (hráč) | `vnucka` | walk.S/SE/E/NE/N (2–3 f/směr) + idle (= walk frame 0) | ✅ éterická |
| Příšera | `prisera` | walk.S/SE/E/NE/N + idle | ❌ plná sytost |
| Babička | `babicka-old` (2f) + `babicka-sad` (4f) | idle.S | ✅ éterická |
| Smířená matka | `matka-smirena` (2f) | idle.S | ✅ éterická |

**Animované vrstvy (intro, ne postavy):** `vnucka-wake` (9f), `vnucka-sleep` (5f),
`babicka-chair` (= old, 2f) — **normální** (realita, ne éterické).

**Mirroring:** balím jen 5 směrů (S/SE/E/NE/N), W-stranu zrcadlí engine. **Idle hráče/příšery** =
1. frame walk daného směru. Anchor nohou = `anchorY:1` (doladí se).

**Rozhodnutí (doplněná):**
- **Q3 — Příšera má walk** (8 směrů) → chodí. ✅
- **#4 — Save/honička:** autosave **neexistuje** (`saveGame` jen z menu; `gameOver`→Retry načte
  poslední ruční save, jinak **restart celé hry**). → Honička **nepoužije `gameOver`**, ale **měkký
  reset `goTo hrbitov`** (na spawn). Flagy+inventář přežijí → **deníkový postup se nikdy neztratí**.
  Intro/onEnter hřbitova ogate-ovat (ať se po resetu nepřehraje).

**Pipeline:** `scripts/build-atlases.mjs` (`sharp`) → PNG do `public/atlases/` + `_views.json`
(ViewDescriptory). Éterické zpracování = `saturation 0.45` + `alpha 0.78` (laditelné).
