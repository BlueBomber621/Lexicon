# Changelog

All notable changes to **LEXICON**, newest first. Versions are the project's
own milestones; the `git:` / `PR` tags map each to the repository history.
Early milestones were built before git tracking began and were folded into the
initial commit — those are tagged `pre-git`.

The format loosely follows [Keep a Changelog](https://keepachangelog.com).

---

## [0.14.0] — 2026-07-21 · Redesigned expansion covers  <sub>git 380c1cd / 2f4d515 · desktop</sub>
### Changed
- **Redrawn covers for all 14 expansion Books** — the placeholder text-glyph
  covers become distinctive, mechanic-driven emblems in the letterpress style
  (single-colour + `currentColor`, so rarity still tints them): a ligature
  swash (Digraph), kerning measure-marks, an A→Z staircase (Abecedarian), an
  awl (The Bodkin), a vowel-locked padlock, a sun-and-moon almanac page, a
  wax-sealed contract, a clipped coupon, a ringed spell-star, a magazine
  masthead + bestseller badge, redaction bars (Censored Edition), a shield with
  a yellow cross (Insurance Form), C/K swap arrows, and a blank sort + coin
  (Empty Book).
### Fixed
- **Expansion covers, boss seals and achievement emblems never rendered.** A
  stray `</defs></svg>` closed the icon sprite early, orphaning every `<symbol>`
  after it into the HTML (XHTML) namespace — where `<use>` draws nothing and
  the child paths are dropped, so those covers showed blank (text only) with no
  console error. Reuniting the sprite restores all 96 Book covers, the boss
  seals and the achievement icons. (See the hazard note in `CLAUDE_PHONE_EDITS.md`.)

## [0.13.1] — 2026-07-21 · Spellbook: a material, not a blank  <sub>git d7bc8c3 · PR #6 · phone</sub>
### Changed
- **The Spellbook** now retriggers only slugs that have a **material (variant)
  and no text alteration** — a materials-yes / alterations-no build-around,
  rather than a blanket retrigger of every unaltered slug.

## [0.13.0] — 2026-07-21 · Expansion set: 14 new Books  <sub>git f4ac6aa · PR #6 · phone</sub>
### Added
- **14 new Books** → **96 Books**: **The Digraph** (+points per digraph),
  **Kerning** (+points per ascending adjacent pair), **Abecedarian** (bonus for
  a fully alphabetical word), **The Bodkin** (×2 on 8+-point slugs), **The
  Padlocked Book** (vowel-beside-vowel bonus), **The Almanac** (+mult per
  distinct word forged this run), **The Business Contract** (Books sell for 0
  tickets, but it grows +points per sale), **The Coupon Book** (first Foundry
  purchase each visit is free), **The Spellbook** (materialled slugs
  retrigger), **The Magazine** (Bestseller Stickers give ×2), **The Censored
  Edition** (×2 mult, but E scores 0), **The Insurance Form** (last-resort
  top-up if your final play falls short, then self-destructs), **The Switch**
  (C↔K reading) and **The Empty Book** (blanks score their stand-in letter).
- New engine hooks behind them: lifetime `itemsBought` / `heavyLettersPlayed`
  counters and `buy` / `bag` events; per-run pen and per-round letter tracking;
  a plain-slug retrigger path; a book-level letter-rule channel; the Coupon
  free-purchase and Insurance last-resort paths — all folded into save/resume.

## [0.12.0] — 2026-07-21 · Shelf & Foundry UI rework  <sub>git ee04f11 · desktop</sub>
### Changed
- **The Book shelf moves into a top bar** (Bin · Shelf · Consumables), and the
  **Foundry now renders inline** in the play area instead of a dimmed paper
  overlay. Shop offers are compact icon + name + cost tiles with the
  description on hover; click a tile to reveal **BUY** (or why it's blocked),
  click again to close. Click an owned shelf Book to reveal **SELL** (drag
  still reorders); Consumables get a **USE / SELL** menu.
### Added
- **The Bin** — a one-slot Book stash worked between rounds; it keeps the
  stashed Book's scaling state and sticker, and is serialized for Continue Run.

## [0.11.0] — 2026-07-20 · Win, Endless & a balance pass  <sub>git 01544c8 · desktop</sub>
### Added
- **You can win.** Beating the 7th boss wins the run and opens a **victory
  screen** (run stats + most-valuable Book), with an opt-in **Endless mode**
  past it that ramps multiplicatively.
### Changed
- **Target curve** drops the old power-of-10 snapping for 2-significant-figure
  rounding, with eased mid-game growth and **doubled ticket income**.
- **Balance pass** tuned with a headless in-browser simulator (`tools/sim.js`,
  dev-only) toward ~a 1-in-8 win rate for a decent auto-player on Note: common
  Books re-slanted by rule specificity (broad = modest, narrow = big), The Book
  of Finance capped at +10 tickets/round, escalating shop reroll cost, and
  `MIN_DECK_SIZE` 80 → 50.

## [0.10.0] — 2026-07-20 · Comprehensive dictionary  <sub>git e78bdc0 · desktop</sub>
### Changed
- **Replaced the ENABLE1 Scrabble list** (no proper nouns, no modern words)
  with a rebuild from the dwyl `words_alpha` list plus a 72-word modern
  supplement: **369,848 words, 2–20 letters** — so JULY, TUESDAY, INTERNET and
  WEBSITE now validate.
- **`CFG.MAX_WORD_LEN` 11 → 20**, deliberately decoupled from the 11-slot stick:
  12–20-letter readings stay reachable only through multi-letter sorts. Word
  length floored at 2 so single letters aren't valid words.

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

[0.14.0]: https://github.com/BlueBomber621/Lexicon/commit/380c1cd
[0.13.1]: https://github.com/BlueBomber621/Lexicon/commit/d7bc8c3
[0.13.0]: https://github.com/BlueBomber621/Lexicon/commit/f4ac6aa
[0.12.0]: https://github.com/BlueBomber621/Lexicon/commit/ee04f11
[0.11.0]: https://github.com/BlueBomber621/Lexicon/commit/01544c8
[0.10.0]: https://github.com/BlueBomber621/Lexicon/commit/e78bdc0
[0.9.1]: https://github.com/BlueBomber621/Lexicon/commit/af3097a
[0.9.0]: https://github.com/BlueBomber621/Lexicon/commit/2291507
[0.8.1]: https://github.com/BlueBomber621/Lexicon/commit/8101444
[0.8.0]: https://github.com/BlueBomber621/Lexicon/commit/036b1df
[0.7.0]: https://github.com/BlueBomber621/Lexicon/commit/20040c8
[0.6.0]: https://github.com/BlueBomber621/Lexicon/commit/9b78fd4
[0.4.0]: https://github.com/BlueBomber621/Lexicon/commit/daffa1c
