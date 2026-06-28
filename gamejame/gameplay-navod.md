# Gameplay návod / testovací checklist

Průchod hrou krok za krokem podle ověřené cesty (= řešení, které prošlo validátorem).
U každého kroku je **co udělat** a **✅ co se má stát**. Odškrtávej a hlásí, kde to drhne.

> Doprovodné dokumenty: [`game-concept.txt`](./game-concept.txt) (původní koncept) ·
> [`game-plan.md`](./game-plan.md) (plán, rozhodnutí, implementační poznámky).

---

## Spuštění

1. Dev server běží na **`http://localhost:5173/`** (jinak `pnpm dev` v `gamejame/`).
2. Otevři ho v prohlížeči → na titulce klikni **New game**.

> ⚠️ **Když vidíš starý/cizí obsah** (demo, prázdná scéna): na `localhost:5173` dřív běžel
> vedlejší projekt a v IndexedDB může být jeho **draft, který stíní** tvůj `game.json`.
> Oprava: `localhost:5173/?edit` → **Discard draft** (nebo DevTools → Application → IndexedDB →
> smazat) → znovu **New game**.

## Ovládání

- **Chůze:** klikni na podlahu — vnučka tam dojde.
- **Hotspoty jsou neviditelné** (obkreslíš je až při polishi). **Najdeš je najetím myši** — kurzor
  se změní: ✋ seber · ⚙️ použij · 🚪 východ · 👁 prohlédni · 👣 chůze. Klik = dojdi tam a proveď.
- **Mluvení:** klikni na **babičku** (postava) → vnučka k ní dojde a otevře se dialog; vybírej
  odpovědi. (Možnosti se objevují podle toho, co máš v inventáři.)
- **Kombinace předmětů:** v inventáři **klikni 1. předmět** (vybere se) → **klikni 2. předmět**.
  Když na ně existuje recept, spojí se. (Špatná dvojice = nic se nestane.)
- **Použití předmětu na věc/postavu:** v inventáři **vyber předmět** → **klikni na objekt** ve scéně
  (hrob, papíry, deník…).

## Testovací zkratky (`?edit` → okno **World**)

Otevři **`localhost:5173/?edit`**. Svět běží „view-only" (needá se hrát, ale uvidíš a ovládneš stav):

- **Hotspoty jsou tu vidět** jako barevné boxy (zelená=seber, jantar=použij, modrá=východ,
  tyrkys=prohlédni, fialová=trigger) — dobré pro orientaci, kde co je.
- **World → jump scene** = skoč na libovolnou scénu. **Give/Take item**, **set/clear flag** =
  naskripti si stav a otestuj kus hry bez celého průchodu (např. dej si `smireni` a otestuj finále).
- **▶ Test in game** = ulož a hraj nadraft.

---

## Průchod

### 0) Intro — Dětský pokoj (realita)
- [ ] Po **New game** se spustí **úvodní cutscéna** (babička: „Spinkej…", proklikej dialog).
- [ ] ✅ Vnučka „usne" (animace na posteli se přepne), krátký dialog „Co se stalo? Já spinkám?",
      pak se scéna **přepne do duchovního pokoje** a objeví se **éterická hratelná vnučka**.

### 1) Dětský pokoj (duchovní svět) — cíl: „Vzpomínky na maminku" → do obýváku
- [ ] Seber **Fotoalbum**. ✅ Hláška „Kde se tady vzalo tohle album?"
- [ ] Promluv s **babičkou** → vyber **„Našla jsem tohle album."**
      ✅ Babička vypráví o mamince; tím se **objeví fotka maminky** ve scéně.
- [ ] Seber **Klíč**. ✅ „A hele, klíč…"
- [ ] Vyber **Klíč** v inventáři → klikni na **stolek/šuplík**. ✅ Šuplík se odemkne.
- [ ] Seber **Obrázek** (ze šuplíku). ✅ „…to je ale hezký obrázek."
- [ ] Seber **Stará panenka**.
- [ ] Seber **Fotka maminky** (teď viditelná). ✅ „Tahle fotka maminky tu nebyla."
- [ ] Kombinuj **Stará panenka + Obrázek** → **Maminčiny věci**.
- [ ] Kombinuj **Maminčiny věci + Fotka maminky** → **Vzpomínky na maminku**.
- [ ] Promluv s **babičkou** → vyber **„Co se vlastně mamince stalo?"**
      ✅ **Přechod do obýváku.** *(Vzpomínky na maminku ti zůstanou — potřebuješ je pak na deník.)*

### 2) Obývák — cíl: dobré + hrozné časy, přeměna kapesníku → na hřbitov
- [ ] Seber **Zakrvácený kapesník**. ✅ „…A je na něm krev!"
- [ ] Promluv s **babičkou** → vyber **„Babi, čí to je krev?"**
      ✅ Změní se na **Babiččin zakrvácený kapesník** (drž ho až do finále!).
- [ ] Seber: **Lékařská zpráva, Úmrtní oznámení, Stará kazeta, Léky, Starý dárek**.
- [ ] *(volitelné)* Klikni na **zvuky za dveřmi** — atmosférický dialog.
- [ ] Kombinuj **Léky + Lékařská zpráva** → **Vzpomínky na hrozné časy**.
- [ ] Kombinuj **Starý dárek + Stará kazeta** → **Vzpomínky na dobré časy**.
- [ ] Promluv s **babičkou** → vyber **„Babi? Co se děje? Vypadáš tak smutně."**
      *(objeví se, až máš obě vzpomínky)* ✅ **Přechod na hřbitov.**

### 3) Hřbitov — cíl: zbylé vzpomínky, deník v pořadí, smíření *(POZOR: honička!)*
> Po hřbitově chodí **příšera**. Viz [Honička](#honička) níže — u **deníku (uprostřed)** a ve dvou
> **úkrytech** (rohy) tě nevidí. Předměty sbírej s načasováním; když tě chytí, **objevíš se u vchodu
> a postup ti zůstane.**

Vyrob vzpomínky (pořadí sběru je jedno):
- [ ] Vyber **Úmrtní oznámení** → klikni na **hrob**. → **Vzpomínky na prababičku**.
- [ ] Seber **Svíčka** + **Zapalovač** → kombinuj → **Zapálená svíčka**.
- [ ] Vyber **Zapálená svíčka** → klikni na **tmavé papíry**. → **Nesouhlas s interrupcí**.
- [ ] Seber **Fotka z ultrazvuku** → kombinuj **ultrazvuk + Nesouhlas** → **Vzpomínky na těhotenství**.
- [ ] Seber **Kus fotky (1/4)…(4/4)** → kombinuj **v pořadí**: 1/4 + 2/4 → 3/4 → 4/4 →
      **Fotka mladší babičky**.
- [ ] Seber **Láhev a prášky** → kombinuj **Láhev a prášky + Fotka mladší babičky** →
      **Vzpomínky na sebevraždu**.

**Deník** (uprostřed scény) — vyber vzpomínku a klikni na deník, **v tomto pořadí**:
- [ ] Vzpomínky na maminku → ✅ deník se otevře (1)
- [ ] Vzpomínky na prababičku → (2)
- [ ] Vzpomínky na dobré časy → (3)
- [ ] Vzpomínky na hrozné časy → (4)
- [ ] Vzpomínky na těhotenství → (5)
- [ ] Vzpomínky na sebevraždu → ✅ **kompletní deník**
> Špatná vzpomínka mimo pořadí = **nic se nestane** (deník bere jen tu správnou další). Každá
> úroveň má jiný text deníku (proklikni `examine`).
- [ ] Seber **Kompletní deník**.
- [ ] Kombinuj **Babiččin zakrvácený kapesník + Kompletní deník** → **Smíření**.
- [ ] Vyber **Smíření** → klikni na **hrob**.
      ✅ Příšera **zmizí**, objeví se **klidný duch matky** a „doglidne" ke kostelu; **vchod do
      kostela se otevře**.
- [ ] Klikni na **kostel** (vchod). ✅ **Přechod do kostela.**

### 4) Kostel — finále
- [ ] ✅ Spustí se **smiřovací cutscéna** (vnučka, matka, babička) — proklikej dialog.
- [ ] ✅ Po poslední replice **duchové zmizí a hra skončí** (otevřený konec → end screen).

---

## Honička

- **Příšera** chodí ve smyčce kolem deníku. Má **kužel vidění** — když tě uvidí, **objevíš se zpět
  u vchodu** (postup v deníku i inventář zůstávají, nic neztrácíš).
- **Bezpečno:** stoj v **zóně u deníku** (uprostřed dole) — tam tě nevidí, takže můžeš v klidu
  číst deník a aplikovat vzpomínky. Dál jsou **2 úkryty** v dolních rozích.
- Předměty po scéně sbírej, když je příšera otočená/daleko; nouzově se schovej.

---

## Co je teď placeholder (NENÍ to bug)

- **Bez pozadí** — scény jsou černé/prázdné; éterická vnučka je poloprůhledná, takže působí slabě.
- **Hotspoty a postavy jsou v provizorních pozicích**, walkable je jen spodní pruh, velikost postav
  je odhad. Vše si rozmístíš/obkreslíš při polishi (logika na pozicích nezávisí).
- **Bez ikon předmětů, bez světel/atmosféry**, screens (titulka/konec/titulky) jsou minimální.
- Zvuky jsou jen procedurální + jeden dialog-blip.

---

## Příloha — reference

**Pořadí scén:** `pokoj-realita → pokoj-spirit → obyvak → hrbitov → kostel`.

**Recepty (kombinace):**
| Vstupy | Výsledek |
| --- | --- |
| Stará panenka + Obrázek | Maminčiny věci |
| Maminčiny věci + Fotka maminky | Vzpomínky na maminku |
| Léky + Lékařská zpráva | Vzpomínky na hrozné časy |
| Starý dárek + Stará kazeta | Vzpomínky na dobré časy |
| Svíčka + Zapalovač | Zapálená svíčka |
| Fotka z ultrazvuku + Nesouhlas s interrupcí | Vzpomínky na těhotenství |
| Kus fotky 1/4 + 2/4, pak + 3/4, pak + 4/4 | Fotka mladší babičky |
| Láhev a prášky + Fotka mladší babičky | Vzpomínky na sebevraždu |
| Babiččin zakrvácený kapesník + Kompletní deník | Smíření |

**Použití předmětu na objekt (use-on-object):**
| Předmět | Na objekt | Výsledek |
| --- | --- | --- |
| Klíč | stolek/šuplík | odemkne (objeví se obrázek) |
| Úmrtní oznámení | hrob | Vzpomínky na prababičku |
| Zapálená svíčka | tmavé papíry | Nesouhlas s interrupcí |
| (vzpomínky) | deník | postupné odemykání |
| Smíření | hrob | finále |

**Přechody scén (přes dialog/východ):**
- pokoj-spirit → obyvak: babička, „Co se vlastně mamince stalo?" (máš Vzpomínky na maminku)
- obyvak → hrbitov: babička, „Babi? Co se děje?…" (máš dobré + hrozné časy)
- hrbitov → kostel: klikni na kostel (po použití Smíření na hrob)
