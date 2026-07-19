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
- Once you've reconciled a batch on the computer, delete those entries (or move
  them under a `## Reconciled` heading) to keep the live list short.

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

<!--
ENTRY TEMPLATE (copy for each new edit):

### NNN — YYYY-MM-DD — short title
- **File:** path/to/file.js (function / area)
- **What:** one-line summary of the change
- **Why:** the reason / goal
- **Before → After:** old behavior/value → new behavior/value  (optional but useful)
- **[commit]:** <hash>  (optional)
-->
