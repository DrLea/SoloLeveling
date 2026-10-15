# The Shadow Army — asset generation sheet

Generate this cast **once**. The app then stages it: your real shadow count, real ranks, elites named and
forward, fallen ones dimmed, on a background of the moment. Nothing is generated per month, nothing costs
money per image, and "generate" in the app becomes instant and offline.

**40 images total.** On an Arc iGPU with SDXL expect roughly 1–3 minutes each, so about two hours of
rendering spread over an evening. Do the troops first — they carry the whole thing.

---

## 1. The rules that make compositing work

These are not style choices. Break them and the sprites won't sit together.

| | Canvas | Framing |
|---|---|---|
| **Troops** | 512 × 768, transparent | Feet **touching the bottom edge**. Full body, no crop. Centred horizontally, ~10% margin each side. |
| **Monarch** | 768 × 1152, transparent | Same: feet on the bottom edge. |
| **Backgrounds** | 2048 × 1152 (16:9), opaque | Horizon at ~62% height. **Keep the lower third simple and dark** — the army stands there. |
| **Props** | 512 × 512, transparent | Loose, no ground contact needed. |

- **All troops lit from the same direction**: a cold rim-light from the upper left, nothing else.
- **No ground, no shadow, no base plate** under any sprite. The app draws contact shadows itself.
- **Same apparent height within a rank.** Across ranks they should get taller: E and D roughly the same,
  C a little taller, B noticeably, A clearly, S towering. Don't fix this in the prompt — fix it by cropping
  all four variants of a rank to the same body height before you save.
- **PNG with real alpha.** Not white, not black, not a checkerboard baked in.

### Naming

```
art/troops/E1.png  E2.png  E3.png  E4.png
art/troops/D1.png … S4.png
art/monarch/E.png  D.png  C.png  B.png  A.png  S.png  national.png  monarch.png
art/bg/dusk.png  ruins.png  frost.png  throne.png  storm.png  gate.png
art/props/banner.png  crow.png  embers.png  fog1.png  fog2.png  spears.png
```

---

## 2. The style anchor

Paste this **verbatim at the start of every troop, monarch and prop prompt**. It is what makes forty
separate generations look like one artist.

> `dark fantasy anime key art, shadow soldier rendered as a near-black armoured silhouette, deep
> desaturated charcoal body with almost no interior detail, sharp clean edges, thin glowing rim light
> along one side, glowing eyes, faint smoke dissolving off the shoulders and feet, cinematic, high
> contrast, painted digital illustration, Solo Leveling aesthetic`

Then add the subject line, then the rank colour line, then the variant line.

**Seeds:** pick one base seed and use `seed`, `seed+1`, `seed+2`, `seed+3` for the four variants of a rank.
Keep the same base seed across all ranks. If a rank drifts off-style, change the base seed and redo that
whole rank — never one variant alone.

### Rank colours (these are the app's real values — match them)

| Rank | Hex | Say it as |
|---|---|---|
| E | `#9aa7b8` | pale cold grey-blue glow |
| D | `#6fe3a1` | mint green glow |
| C | `#4fb6ff` | bright cyan glow |
| B | `#b07cff` | violet glow |
| A | `#ff9f43` | amber-orange glow |
| S | `#ff4d6d` | crimson glow |

### Negative prompt (every image)

> `face detail, facial features, bright colours, saturated, daylight, white background, ground, floor,
> shadow on ground, pedestal, base, text, watermark, signature, logo, multiple characters, crowd,
> cropped limbs, cut off head, blurry, lowres, extra limbs, deformed hands, jpeg artifacts, border, frame`

### Settings

**SDXL** — 1024×1536 then downscale to 512×768. 30–35 steps, CFG 6.5, DPM++ 2M Karras.
**Flux dev** — 20–25 steps, guidance 3.0–3.5. Needs less negative prompting; keep the first half of the
negative list only.

**Transparency.** Generate against a flat background, then cut out. Either route works:
- Add `on a plain flat solid magenta background` to the prompt, then key out the magenta.
- Or render normally and run the result through a background-removal node (InspyreNet or RMBG-1.4 in
  ComfyUI gives much cleaner edges than rembg on glowing shapes).

Check the alpha edge on a dark background afterwards — glow and smoke tend to get eaten. If it does,
keep a soft outer glow in the alpha rather than a hard cut.

---

## 3. Troops — 24 sprites

Format for each: **anchor** + subject + `, 3/4 rear view seen from behind, facing away from the viewer,
standing at attention, full body, feet on the bottom edge` + rank colour + variant.

### E — conscripts · pale cold grey-blue glow `#9aa7b8`
Ragged, barely held together. The newest and weakest of the dead.

1. `ragged foot soldier in torn rags and a broken leather jerkin, hunched shoulders, holding a cracked short spear pointed down`
2. `thin soldier in a tattered hooded cloak, empty hands at its sides, head bowed`
3. `bare-armed conscript with cloth wrapped around its forearms, carrying a notched woodcutter's axe low`
4. `stooped figure with a splintered wooden shield slung across its back, no weapon drawn`

### D — soldiers · mint green glow `#6fe3a1`
Properly equipped. Nothing ornate.

1. `foot soldier in plain segmented leather armour, round shield on the left arm, straight spear held upright`
2. `soldier in a mail hauberk and open helm, short sword drawn and held at its side`
3. `archer in light armour, longbow held unstrung at its side, quiver on the hip`
4. `spearman in a knee-length tabard, tall spear planted in front of it, both hands on the shaft`

### C — veterans · bright cyan glow `#4fb6ff`
Survivors. Heavier, scarred, confident stance.

1. `veteran warrior in dented half-plate armour with a crested helm, longsword resting point-down in front of it`
2. `heavy infantry in layered plate with a tower shield held at its side, broad stance`
3. `armoured swordsman with a torn half-cape over one shoulder, twin shortswords at the hips`
4. `battle-worn soldier in reinforced plate and a horned open-faced helm, war axe over one shoulder`

### B — knights · violet glow `#b07cff`
Full plate, capes, real presence. Noticeably taller than C.

1. `knight in full articulated plate armour with a long flowing cape, greatsword held point-down with both hands`
2. `knight in ornate plate with high ridged pauldrons, halberd held vertically at its side`
3. `armoured knight with a heavy chained mace and a kite shield, cape caught in the wind`
4. `tall knight in plate and a hooded mantle, two-handed warhammer resting head-down on the ground line`

### A — commanders · amber-orange glow `#ff9f43`
Elites. Clearly larger, ornamented, commanding. These stand at the front of the scene and carry names.

1. `towering shadow commander in ornate baroque plate armour with vast spiked pauldrons, massive greatsword planted in front of it, long torn cape`
2. `shadow general in layered ceremonial armour with a tall war banner planted beside it, one gauntleted hand raised`
3. `heavily armoured commander with four pauldron spikes and a long trailing mantle, enormous war axe held one-handed`
4. `armoured captain in horned ceremonial plate with a long cloak of ragged strips, twin curved blades held low and wide`

### S — generals · crimson glow `#ff4d6d`
Monstrous. Half again the height of a knight. Rare — these are the ones he remembers.

1. `colossal shadow general in immense horned plate armour, vast tattered cloak, enormous two-handed greatsword driven into the ground in front of it, smoke pouring from its shoulders`
2. `towering armoured monarch's general with an antlered crown-helm and a long trailing mantle, massive glaive held upright`
3. `giant armoured revenant with a shattered winged pauldron, chains hanging from its arms, huge cleaver-like blade at its side`
4. `enormous shadow knight in spined obsidian plate, six ragged banners rising from its back, colossal warhammer held in both hands`

---

## 4. The monarch — 8 figures

You. Same anchor, but **facing the viewer** (this is the one figure that does), standing before the army.
Add: `front view, facing the viewer, standing, full body, feet on the bottom edge, heroic proportions`.

Keep the face in deep shadow under the hood or helm in every one — no readable features. That keeps it
consistent and keeps it *you*.

| File | Prompt addition |
|---|---|
| `E.png` | `a lone figure in plain dark clothes and a worn jacket, no armour, hands empty at its sides, faint pale grey aura, barely more than a man` |
| `D.png` | `a figure in reinforced dark leather and a short cloak, a single dagger at the belt, thin mint-green aura` |
| `C.png` | `a hunter in dark segmented half-plate over dark cloth, a longsword sheathed at the hip, cyan aura, hood up and face in shadow` |
| `B.png` | `a hunter in full matte-black plate with a long dark coat over it, one hand on a sheathed sword, violet aura, confident stance` |
| `A.png` | `a shadow hunter in ornate black plate with sharp pauldrons and a vast ragged cloak, amber aura, wisps of shadow curling up from the ground around its boots` |
| `S.png` | `a shadow monarch in regal black armour with a tall spiked crown-helm, enormous trailing cloak of shadow, crimson aura, violet shadow flames at its feet` |
| `national.png` | `a sovereign in obsidian plate chased with faint gold, a long mantle of pure darkness spreading behind it, crown of black spikes, white-gold aura, arms crossed` |
| `monarch.png` | `the Monarch of Shadows, immense regal figure in black and violet armour, a crown of seven shadow spikes, a cloak that dissolves into a storm of shadow, violet-white aura flooding outward, absolute stillness` |

---

## 5. Backgrounds — 6 scenes

No anchor line. Use this one instead, then the scene:

> `dark fantasy anime key art background, cinematic wide establishing shot, empty landscape with no
> characters and no figures, dramatic sky, deep desaturated palette of blue-black and cold grey, painted
> digital illustration, high contrast, Solo Leveling aesthetic, horizon low in the frame, the lower third
> of the image dark, empty and uncluttered`

Negative for backgrounds: `people, characters, figures, soldiers, army, crowd, silhouettes, text, watermark, bright colours, daylight, busy foreground, clutter`

1. **`dusk.png`** — `a vast empty plain under a dying violet and orange sunset, low broken hills on the horizon, drifting mist across the ground, a single enormous dead tree far to one side`
2. **`ruins.png`** — `the ruins of a shattered modern city at night, collapsed towers and twisted steel, cold blue moonlight, dust hanging in the air, an empty cracked avenue running toward the horizon`
3. **`frost.png`** — `an endless frozen waste under a black sky, snow blowing low across the ground, jagged ice spires in the far distance, faint green aurora overhead`
4. **`throne.png`** — `the interior of a colossal dark throne hall, impossibly tall black pillars receding into darkness, a cold shaft of violet light from far above, polished black floor, empty`
5. **`storm.png`** — `a black mountain range under a violent thunderstorm, forked violet lightning, heavy rain, a wide empty rocky plateau in the foreground`
6. **`gate.png`** — `an enormous glowing blue dimensional gate standing open on a barren plain at night, light spilling from it across the ground, swirling particles, otherwise empty landscape`

---

## 6. Props — layered for depth

Anchor + the subject + `isolated on a plain flat solid magenta background, no ground, no shadow`.

- **`banner.png`** — `a tall tattered war banner on a spear shaft, black cloth shredded at the edges, no emblem`
- **`crow.png`** — `a single black crow in flight with wings spread wide, seen from slightly above, trailing wisps of shadow` *(for the crow's-eye framing — the app can drift it across the foreground)*
- **`embers.png`** — `a scattering of floating violet embers and glowing motes of ash rising upward, on black`
- **`fog1.png`** / **`fog2.png`** — `a soft horizontal band of thin ground mist, pale blue-grey, wispy and uneven, on black` *(two different shapes; the app layers them at different depths and drifts them)*
- **`spears.png`** — `a loose cluster of broken spears and swords driven into the ground at angles, black metal, no ground beneath them`

---

## 7. Before you hand them over

- [ ] Every troop and monarch PNG has **real alpha** and **feet flush with the bottom edge**
- [ ] All four variants within a rank are the **same body height**
- [ ] Rim light comes from the **upper left** on all of them
- [ ] No ground, base, pedestal or drop shadow baked into any sprite
- [ ] Backgrounds have a **dark, empty lower third** and no figures in them
- [ ] Files named exactly as in §1 and dropped into `art/` in the Tracker folder

Then I wire up the staging: army laid out in depth with the ranks sorted back-to-front, elites forward and
labelled with the task that raised them, fallen rendered dim and kneeling, the monarch at the front matched
to your Hunter rank, fog and embers drifting, and a **Generate** button that stages the current army, stamps
the date and your numbers in the corner, and files it in the gallery — where you can look back through the
months and delete any you don't want.

Start with E1–E4 and S1–S4. If the weakest and the strongest both look right next to each other, the
sixteen in between will be easy.
