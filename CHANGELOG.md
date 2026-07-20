# Changelog

All notable changes to **LEXICON**, newest first. Versions are the project's
own milestones; the `git:` / `PR` tags map each to the repository history.
Early milestones were built before git tracking began and were folded into the
initial commit — those are tagged `pre-git`.

The format loosely follows [Keep a Changelog](https://keepachangelog.com).

---

## [0.9.1] — 2026-07-19 · Eased word colour  <sub>git af3097a · PR #5 · phone</sub>
### Changed
- The composed word's length colour is now a **continuous, eased RGB ramp**
  (mid-blue → light-blue → magenta → pink) instead of four discrete buckets.
  The two gradient stops are typed `@property` custom colours that CSS
  transitions over 0.28s, so each added or removed letter eases to the next
  colour rather than snapping; the left stop trails the right so the spread
  grows smoothly with length.

## [0.9.0] — 2026-07-19 · Shuffle, drag & drop, saveable runs  <sub>git 2291507 · PR #5 · phone</sub>
### Added
- **Shuffle** button — reorders the rack for inspiration (pure display, no
  draw, no cost, pool untouched).
- **Slug drag & drop** — a ghost slug follows the pointer and drops into the
  stick (compose or reorder at a slot), the tray (stage for reroll), or the
  rack. One pointer path for mouse and touch. Taps still quick-move,
  long-press still shows details.
- **Continue Run** — the run autosaves to `localStorage` after every action
  (pool as flat tile records + per-zone id lists; Books, consumables and boss
  by id, hooks re-registered on resume). A **Continue Run** banner on the
  deck-select screen drops you straight back in; cleared on game over / reset.
### Changed
- Drag-to-tray replaces the earlier swipe-down-to-tray touch gesture.

## [0.8.1] — 2026-07-19 · Word particles, colour scale, achievements  <sub>git 8101444 · PR #4 · phone</sub>
### Added
- **Word-display particles** — while a valid word is set, the readout sheds
  tiny drifting copies of its own letters (count scales with word length).
- **Word length colour scale** — the composed word is tinted by length;
  particles are tinted to match. (Refined into a continuous ramp in 0.9.1.)
- **Achievements** — a cosmetic progress layer parallel to Unlocks, on its own
  `localStorage` key: 14 achievements, corner-card popups on earning. Kept
  fully separate from game rules (the rules never read achievement state).
  `Game.progress()` now fans every play event to both trackers.

## [0.8.0] — 2026-07-19 · Scoring-sweep FX overhaul  <sub>git 036b1df / 5467e7b · PR #4 · phone</sub>
### Added
- **Amped scoring sweep** — colour-matched spark bursts and shockwave rings on
  each impactful count, a table-kick on the total (scaled to how close it
  lands to target), and floating numbers that grow with the count size.
- **Living Book auras** on The Shelf (copper glow for rare, verdigris for
  uncommon) and a radial bloom behind a Book on trigger/retrigger.
- `CFG.ANIM.FX` tuning knobs (sparks, spark distance, shake, big-points
  threshold) so the juice stays dialable from the one balance file.
- A `prefers-reduced-motion` gate that switches the heavy motion off.
- **`assets/` design section** — an art / sounds / soundtracks tree with a
  README per folder mapping to the live `#icon-*` sprite ids. Design-only;
  nothing is wired in yet and audio remains the WebAudio synth.
- **`CLAUDE_PHONE_EDITS.md`** — an ordered log of phone-session edits.

## [0.7.0] — 2026-07-19 · Mobile support  <sub>git 20040c8 · PR #3</sub>
### Added
- **Responsive layout** below 860px: the sidebar collapses into a sticky,
  horizontally-scrolling status rail above the table; slugs and Books shrink;
  every overlay card goes full-bleed and scrolls. A tighter tier kicks in
  under 420px.
- **Touch gestures** — tap to compose, long-press any slug or Book for its
  details, and (in this version) swipe a rack slug down to stage it for
  reroll. Tooltips bind on hover *and* long-press so hybrid laptops get both.
- Disabled double-tap zoom, iOS long-press callouts and tap highlights;
  claimed `touch-action` on slugs and Books so a gesture is never stolen as a
  scroll.
### Changed
- **The Shelf reorder rebuilt on pointer events** (mouse *and* touch), replacing
  HTML5 drag-and-drop, which never fired on touchscreens.
### Fixed
- A silent boot crash: `syncHint` read an element that was never cached, which
  threw in the UI constructor and froze the game on the loading screen.

## [0.6.0] — 2026-07-19 · Special sorts & nine Books  <sub>git 9b78fd4 · PR #2</sub>
### Added
- **Special sorts** (the peculiar slugs), sold in the new **Peculiar Case**
  (pick 2 of 3): the ligatures **Œ** (CE), **Æ** (AE), **ß** (SS), **№** (NO)
  and **&** (AND); **!** (an I worth 10), **@** (an A worth 5); and **_**, a
  blank that spells any letter for no points.
- Nine Books: **Times Tables**, **The Tally Stone**, **The Rulebook**, **The
  Colouring Book**, **The Yellow Books**, **The Cookbook**, **The Grid
  Notebook**, **The Prequel** (copies its right-hand neighbour) and **The
  Obituary** (devours a shelfmate each level to grow). → **82 Books**.
- Bags may now carry their own pick count.
### Changed
- Spelling now resolves **per position**, unifying substitution Books,
  wildcards and multi-letter sorts behind one dictionary matcher. Ligatures
  lengthen a word (raising mult), and letter-triggered Books read the *spelled*
  letters, so the E inside Œ still counts as a vowel.
- **The Lisp** rebalanced common → **rare** (cost 7): with Z worth 10, reading
  Z-as-S made cheap ~40-point plays. The Turned Sort stays common (N and U are
  both worth 1, so it has no equivalent exploit).

---

## [0.5.5] — 2026-07-18 · Book secrecy & difficulty gating  <sub>folded into git ab9b3f0 · PR #1</sub>
### Added
- Four Books: **The Textbook** (×mult grows with Underlined/Italic plays),
  **The Forgotten Tale** (+14 mult on I/V/X words), **The Scroll** (inks a
  random slug Italic each play) and **The Journal** (Comic Sans keeps points
  *and* mult). → **73 Books**.
### Changed
- **Undiscovered Books show only `???`** plus their unlock goal — no name,
  effect or flavour is revealed.
- **Difficulties unlock in order** — you must beat a boss on one to open the
  next; a locked pick explains itself rather than being silently disabled.

## [0.5.4] — 2026-07-18 · Sundries as slips & The Typewriter  <sub>folded into git ab9b3f0 · PR #1</sub>
### Added
- Five new sundries (all reworked as torn paper **slips**): **Pulp Slip**,
  **Ink Slip**, **The Vowel Slip**, **Sticker**, and **The Typewriter** (20 TK,
  rare) — which reads every word your hand can spell and sets the best one for
  you, scored through the *real* engine (Books, stickers, boss rules and all).
  → **69 Books** (incl. The Sticky Note).
### Changed
- Shop consumable offers are **weighted**, so the pricey slips surface rarely.

## [0.5.3] — 2026-07-18 · Event-scripted scoring & retriggers  <sub>folded into git ab9b3f0 · PR #1</sub>
### Changed
- **Scoring rewritten as an ordered event script** the UI replays: pre-word
  Books → each letter (points, mult, ×mult, ticket) with letter-Books taking
  their own credit → each Book then its sticker → boss rules. Every count
  pulses its source and pops its own number, accelerating up to 6×.
### Added
- Rare pen-only styles — **Fuzzy** (retrigger), **Highlighted** (×1.5 mult),
  **Cardstock** (+1 ticket) — via the Double-Tipped / Highlighter / Rough pens.
- **Lamination** sticker (rarest): retriggers a Book's ability.
- Non-book "silly" items with custom cover bases — **Quizlet**, **The Square
  Book**, **The Bitten Book** and friends. → **60 Books**.

## [0.5.2] — 2026-07-18 · Stickers, Pens, Difficulties & new Bosses  <sub>folded into git ab9b3f0 · PR #1</sub>
### Added
- **Stickers** — corner badges on shop Books, five escalating tiers (Present,
  Discount, Signature, Donated, Bestseller), scaled to the cover art.
- **Pen Packs** — pick 1 of 3 pens and 1 of 10 pulled slugs to restyle it.
- **Five difficulties** — paper sizes Note → Imperial, scaling the target curve
  ×1 to ×8, with an Imperial-only boss-pool hook.
- **Six new bosses** (12 total), each a different debuff.
### Fixed
- **The Leaden Mult**'s flat ×5 cap replaced with halving — the flat cap was
  effectively impossible late game (a level-24 target demanded ~1,100 base
  points; halving needs ~184).

## [0.5.1] — 2026-07-18 · The Shelf & shelf-play Books  <sub>folded into git ab9b3f0 · PR #1</sub>
### Added
- **The Shelf** — your Books as a horizontal, gently-bobbing row you can
  **drag to reorder**. Order *is* the scoring order, so it's a real strategic
  layer.
- Nine position / arc Books (The Spine, Table of Contents, The Index, The
  Second Volume, The Anthology, The Trilogy, …) plus scaling rares. → **54 Books**.

## [0.5.0] — 2026-07-18 · Economy rework & scaling Books  <sub>folded into git ab9b3f0 · PR #1</sub>
### Changed
- **Target curve rebuilt** as a sectioned delta / delta-delta system with
  clean rounding, replacing pure exponential growth.
- **Round-win payout itemised** — longest word + 1 per unused play + each
  Book's contribution, shown line by line.
### Added
- Many more Books including the first **scaling rares** (grow from forging /
  rerolling / destroying / boss-slaying, with live status badges), **The Day
  Book** and **The Book of Finance**. → **45 Books**.

---

## [0.4.0] — 2026-07-16 · The Book Collection  <sub>git daffa1c · PR #1</sub>
### Added
- Reworked to **28 Books** — 16 in the starting pool plus **12 unlockable**
  through play, tracked by a lifetime profile in `localStorage`.
- **The Library** screen — browse the whole collection.
- **Per-Book SVG cover art**, tinted by rarity.

---

## [0.3.0] — pre-git · Tile bags & two-axis slugs
### Added
- The shop sells **themed tile bags** (Vowel, Consonant, Suffix, Latin,
  Science, Sorts) instead of single letters.
- **Two independent axes on every slug**: a **variant** (material — Paper,
  Woodblock, Cornerstone, Ligature, Deckle) and a **text alteration** (styling
  — Red, Comic Sans, Bold, Italic, Underline), both scored in the choke point
  and stackable on the same slug.

## [0.2.2] — pre-git · Deck & hand tuning
### Changed
- Starting deck vowels trimmed (42% → ~34%) — racks were flooding with vowels.
- Hand size **11 → 12** (the stick still caps words at 11, so the extra slug is
  selection headroom).
- Slugs made **fluid** so all 12 fit narrow screens without overflow.

## [0.2.1] — pre-git · Difficulty tuning
### Changed
- Level-1 target **300 → 150** — 300 sat at the ceiling of optimal play.

## [0.2.0] — pre-git · Bosses, Shop & the Book framework
### Added
- **Reroll tray** — a 3-slot tray (right-click / stage tiles); a full tray
  auto-fires. Replacements are drawn *before* the rerolled slugs return to the
  bag, so you can't immediately redraw them.
- **Bosses** — every 6th level is a boss with a rule modifier; endless scaling.
- **The Foundry (shop)** and the **Book trigger/effect framework** — buy/sell,
  shelf slots, rarity tiers; a new Book is one config entry.
- **Content & juice** — a Book library, foil/gilt tile editions, consumables,
  a WebAudio synth for sound, and run stats.

## [0.1.0] — pre-git · Core engine
### Added
- The base game: an 11-slot composing stick, the **ENABLE1 dictionary**
  (141,045 words, gzip+base64, decompressed at load) for validation,
  left→right scoring (**points × mult**), 3 plays / 3 rerolls per round,
  longest-word → tickets, endless level targets, the bag → rack → discard deck
  cycle, the letterpress UI shell, and the signature **scoring-sweep**
  animation.

[0.9.1]: https://github.com/BlueBomber621/Lexicon/commit/af3097a
[0.9.0]: https://github.com/BlueBomber621/Lexicon/commit/2291507
[0.8.1]: https://github.com/BlueBomber621/Lexicon/commit/8101444
[0.8.0]: https://github.com/BlueBomber621/Lexicon/commit/036b1df
[0.7.0]: https://github.com/BlueBomber621/Lexicon/commit/20040c8
[0.6.0]: https://github.com/BlueBomber621/Lexicon/commit/9b78fd4
[0.4.0]: https://github.com/BlueBomber621/Lexicon/commit/daffa1c
