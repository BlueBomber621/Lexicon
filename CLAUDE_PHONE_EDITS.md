# Claude Phone Edits

A running log of every change Claude makes during **phone / mobile sessions**,
recorded **in the order it happens**. When you're back at the computer, read
this top-to-bottom to see exactly what changed and in what sequence, then
reconcile against the "original."

## How to read this

- Entries are **chronological** — oldest at the top, newest appended at the
  bottom. Reading down = replaying the session in order.
- Each entry lists the **file(s) touched**, **what changed**, and **why**.
- The `[commit]` tag (if present) links the edit to a git commit on this
  branch, so you can `git show` the exact diff on the computer.
- Entries under **Pending** (below the ✅ divider) are new since the last
  computer reconcile. Everything **above** the divider has been pulled to the
  desktop and acknowledged. When you acknowledge the next batch, move the
  divider down past it and bump its "through entry NNN" number.

## Branch

All phone-session work lands on: `claude/file-review-jdleyy`

---

## Log

### 001 — 2026-07-19 — Session start
- **File:** `CLAUDE_PHONE_EDITS.md` (new)
- **What:** Created this tracking file.
- **Why:** Establish an ordered record of phone-session edits so the desktop
  copy can be reconciled precisely.
- **Code changes:** none yet.

### 002 — 2026-07-19 — Asset design section
- **File:** `assets/` (new) — `README.md` + `art/{slugs,books,bosses,stickers,ui}/README.md`
- **What:** Created an assets tree for hand-designed art, with a README per
  folder mapping it to the live `#icon-*` sprite ids and viewBox conventions.
- **Why:** A home to DESIGN real art into. Nothing is loaded yet — design
  first, wire in later. `js/content.js` stays the id source of truth.
- **[commit]:** 5467e7b

### 003 — 2026-07-19 — Sounds & soundtracks folders
- **File:** `assets/sounds/README.md`, `assets/soundtracks/README.md` (new)
- **What:** Placeholder folders for one-shot SFX samples and looping music,
  each with notes on how to wire them into `js/audio.js` later.
- **Why:** Requested "for later." Audio is still the live WebAudio synth in
  `js/audio.js`; these folders are empty until you add samples.
- **[commit]:** 5467e7b

### 004 — 2026-07-19 — FX tuning knobs
- **File:** `js/config.js` (`CFG.ANIM.FX`)
- **What:** Added FX tuning: `SPARKS`, `SPARK_DIST`, `SHAKE_MAX`, `BIG_PTS`.
- **Why:** Keep the new juice tunable from the one balance file, like everything
  else. Change these to dial the effects up or down.
- **[commit]:** 036b1df

### 005 — 2026-07-19 — Freshen slug & Book animations (CSS)
- **File:** `css/style.css` (new "FX LAYER (v2)" section at the end)
- **What:** `fx-spark` / `fx-ring` / `table-shake` keyframes; living rarity
  auras on shelved Books (rare = copper glow, uncommon = verdigris); a radial
  bloom behind a Book on trigger/retrigger; a `prefers-reduced-motion` block
  that switches the heavy motion off.
- **Why:** Freshen the slug/Book feel and add scoring-sweep spectacle, without
  disturbing the base letterpress look (all additive; auras scoped to The Shelf).
- **[commit]:** 036b1df

### 006 — 2026-07-19 — Amp up the scoring sweep (JS)
- **File:** `js/ui.js` (`playScoringSweep`, new `eventFx`/`burst`/`shockwave`/
  `shake`/`popScale` helpers, reworked `popNumber`)
- **What:** Colour-matched spark bursts + shockwave rings on each impactful
  count; a table kick on the total (scaled to how close it lands to target);
  floating numbers that grow with the size of the count; a `reduceMotion` gate.
- **Why:** The "amp up the effects" ask. Body-level effects so a slug's
  `overflow:hidden` never clips them. Verified headless (forged HOSPITAL through
  the full sweep, no JS errors).
- **[commit]:** 036b1df

### 007 — 2026-07-19 — Word display: mini-letter particles
- **File:** `js/ui.js` (`renderReadout` + `ensureWordParticles`/`emitWordParticles`/
  `stopWordParticles`), `css/style.css` (`.wordfx`, `wordfx-drift`)
- **What:** While a valid word is set, the readout sheds tiny drifting copies of
  its own letters; the count scales with word length (more letters = more).
- **Why:** Requested ambient word-display juice. Emitter stops on forge and when
  the word goes invalid/empty; gated by `reduceMotion`.
- **[commit]:** 8101444

### 008 — 2026-07-19 — Word display: length colour scale
- **File:** `js/ui.js` (`applyWordColor`, `clearWordFx`), `css/style.css`
  (`#ro-word.valid` background-clip)
- **What:** The composed word is coloured by length: mid-blue (≤3) → light-blue
  (4–5) → light-blue→magenta gradient (6–8) → magenta→pink gradient (9–11).
  Particles are tinted to match.
- **Why:** Requested colour progression (replaces the flat verdigris "valid"
  colour with a length scale). Gradient fills clip to the glyphs.
- **[commit]:** 8101444

### 009 — 2026-07-19 — Achievement system
- **File:** `js/achievements.js` (new), `js/content.js` (`ACHIEVEMENTS`),
  `js/config.js` (`ACHIEVEMENTS_KEY`), `js/game.js` (`progress()` + routed
  events), `js/books.js` (sticker event), `index.html` (6 `#icon-ach-*` emblems,
  `#achievements` container, script include), `js/ui.js`
  (`drainAchievements`/`showAchievement`), `css/style.css` (`.ach-pop`)
- **What:** A cosmetic progress layer parallel to Unlocks, persisted to its own
  localStorage key. 14 achievements; earning one pops a corner card with icon,
  title, and task description, which fades away. `Game.progress()` fans every
  play event to both the unlock tracker and achievements.
- **Why:** Requested achievement popups. Kept fully separate from game rules —
  the rules never read achievement state.
- **[commit]:** 8101444

### 010 — 2026-07-19 — Shuffle button
- **File:** `js/game.js` (`shuffleRack`), `index.html` (`#btn-shuffle`),
  `js/ui.js` (`onShuffle`, control disable)
- **What:** A SHUFFLE button in the controls reorders the rack for inspiration.
- **Why:** Requested. Pure display reorder — no draw, no cost, pool untouched.
- **[commit]:** 2291507

### 011 — 2026-07-19 — Slug drag & drop
- **File:** `js/game.js` (`_extract`, `placeInStick`, `moveTileToRack`),
  `js/ui.js` (rewrote `onTilePointerDown`; added `_tapTile`, `_makeGhost`,
  `_moveGhost`, `_dropInfoAt`, `_highlightDrop`, `_clearDropHighlight`,
  `_dropTile`), `css/style.css` (`.tile-ghost`, `.drop-zone`, `.dragging-src`)
- **What:** Slugs are now drag & drop — a ghost follows the pointer and drops
  into the stick (compose/reorder at a slot), the tray (stage a rack slug), or
  the rack. Plain taps stay the quick move; long-press still shows details.
  Replaces the old swipe-down-to-tray gesture with drag-to-tray.
- **Why:** Requested. One pointer path covers mouse and touch.
- **[commit]:** 2291507

### 012 — 2026-07-19 — Saveable runs (Continue Run)
- **File:** `js/config.js` (`SAVE_KEY`), `js/game.js` (`serialize`, `resume`,
  `saveRun`, `clearSave`, static `loadSave`, `reapplyBossHooks` + `applyBoss`
  refactor), `js/ui.js` (autosave at every action site; `resumeRun`; Continue
  banner in `renderDeckPick`; `onDeckPickClick` handler), `css/style.css`
  (`.continue-row`)
- **What:** The run autosaves to localStorage after each action (pool as flat
  tile records + per-zone id lists; Books/consumables/boss by id, hooks
  re-registered on resume). A "Continue Run" banner on the deck-pick screen
  drops straight back in. Cleared on game over / file reset.
- **Why:** Requested "continue run." Verified a level-5/42-ticket run survives a
  full page reload.
- **[commit]:** 2291507

### 013 — 2026-07-19 — Word colour: continuous & eased (no snapping)
- **File:** `css/style.css` (`@property --word-c1/--word-c2/--word-glow`,
  `#ro-word.valid` gradient + `transition`), `js/ui.js` (`applyWordColor`
  rewritten; new `_rampColor`/`_rgb`; `clearWordFx` clears the vars)
- **What:** Replaced the four discrete length buckets with a continuous RGB
  ramp (anchors mid-blue@1 → light-blue@5 → magenta@8 → pink@11, lerped
  between). The two gradient stops are typed `<color>` custom properties that
  CSS transitions at 0.28s, so each added/removed letter **eases** to the next
  colour instead of snapping. Left stop trails the right, so the gradient spread
  grows smoothly with length.
- **Why:** Requested — "gradually go to each step, not snap." Refines edit 008.
- **[commit]:** af3097a

<!-- ═══════════════════════════════════════════════════════════════════════ -->

## ✅ Acknowledged through entry 013 · reconciled on the computer 2026-07-21

Entries **001–013** above were pulled to the computer and **acknowledged on
2026-07-21**. Everything below this divider is new phone-session work since the
last reconcile. When the next batch is acknowledged, move this divider down past
it and bump the "through entry NNN".

<!-- ═══════════════════════════════════════════════════════════════════════ -->

## Pending — new phone edits (since last reconcile)

### 014 — 2026-07-21 — Expansion set: 14 new Books
- **File:** `js/content.js` (14 `BOOKS` entries), `index.html` (14
  `#icon-book-*` covers), `js/unlocks.js` (`itemsBought`/`heavyLettersPlayed`
  counters + `buy` event), `js/game.js` (`runPensUsed`, `roundLetters`,
  `freePurchase`; forge feeds `heavy`/`multiSorts`/round-letters; Insurance
  Form payout; save/resume), `js/shop.js` (Coupon free purchase via `spend()`;
  `buy`/`bag` events; Business Contract ticketless sell + `grow.sell`),
  `js/scoring.js` (`retriggerPlain`), `js/books.js` (book `letterRule` channel;
  Magazine Bestseller ×2)
- **What:** Digraph, Kerning, Abecedarian, The Bodkin, The Padlocked Book, The
  Almanac, Business Contract, Coupon Book, Spellbook, Magazine, Censored
  Edition, Insurance Form, The Switch, Empty Book — each with a cover and unlock.
- **Why:** Requested expansion batch (with your tweaks/renames/unlock conditions).
  New engine hooks: `buy`/`bag` events + lifetime item counter, per-run pen
  counter, per-round letter set, plain-slug retrigger, book letter-rule channel,
  Coupon free-purchase, Insurance last-resort.
- **Verified:** headless — every mechanic checked through the real engine; all
  14 covers render; no JS errors.
- **[commit]:** f4ac6aa

### 015 — 2026-07-21 — Spellbook: require a material
- **File:** `js/scoring.js` (`plainRetrigger` condition), `js/content.js`
  (Spellbook `desc`)
- **What:** Spellbook now retriggers only slugs that **have a material (variant)
  and no text alteration** — not every unaltered slug.
- **Why:** Clarified spec ("must have material, but no text alteration"). Makes
  it a materials-yes / alterations-no build-around rather than a blanket
  retrigger. Verified headless: a woodblock slug retriggers; a plain slug and a
  material+Red slug do not.
- **[commit]:** d7bc8c3

<!--
ENTRY TEMPLATE (copy for each new edit):

### NNN — YYYY-MM-DD — short title
- **File:** path/to/file.js (function / area)
- **What:** one-line summary of the change
- **Why:** the reason / goal
- **Before → After:** old behavior/value → new behavior/value  (optional but useful)
- **[commit]:** <hash>  (optional)
-->
