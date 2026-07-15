# LEXICON

A word-forging roguelike deck-builder. Balatro's structure — escalating
targets, joker-driven scoring, shop economy — but the scoring engine is
valid English words. Letter tiles are the deck, **Books** are the jokers,
**tickets** are the currency.

## Run it

Static site, no build step. Serve the folder and open it:

```
npx -y http-server -p 8123 -c-1 .
```

(Any static server works; `file://` works too since there are no modules.)

## How to play

- Click rack tiles (or just type) to set them on the composing stick.
- Forge any valid English word, 1–11 letters. `score = points × mult`,
  where points are Scrabble tile values and `mult = 1 + word length`.
- 3 plays and 3 rerolls per round. Right-click (or shift-click) tiles into
  the 3-slot reroll tray; a full tray fires automatically. Replacements are
  drawn first, then the tray's tiles are shuffled back into the bag.
- Hit the level target before your plays run out. Targets scale forever.
- Every 6th level is a boss with a rule modifier (vowels score 0, mult
  capped, short words banned, …).
- Tickets earned = length of your longest word that round. The Foundry
  (shop) opens after every 2nd level: Books (persistent scoring modifiers,
  5 shelf slots, three rarities), new tiles for the deck (plain / foil /
  gilt editions), and single-use consumables.

## Architecture

| File | Role |
| --- | --- |
| `js/config.js` | Every tunable number (`CFG`). Balance lives here. |
| `js/scoring.js` | `ScoringEngine` — the single choke-point all scoring flows through. Books (Stage 3) register hooks here and nowhere else. |
| `js/deck.js` | `Tile` + `Deck`: bag → rack → discard cycle with mid-draw reshuffle. |
| `js/game.js` | Run/round state, plays/rerolls/tray, boss modifiers, targets, tickets, consumables. |
| `js/content.js` | Pure data: Books, bosses, consumables, tile **variants** + **alterations**, and shop **bags**. New content = new entry. |
| `js/books.js` | `BookManager`: the trigger/effect interpreter; registers hooks on the choke point. |
| `js/shop.js` | The Foundry: offer generation, buy/sell/restock. |
| `js/audio.js` | WebAudio synth sfx (patchwork layer — failures play silent). |
| `js/ui.js` | DOM rendering, input, the scoring-sweep animation, shop screen. |
| `js/dictionary.js` | ENABLE1 (141k words, 1–11 letters) decompressed at load via `DecompressionStream`. |

## Rebuilding the dictionary

```
node tools/build-dictionary.mjs path/to/enable1.txt
```

Emits `js/data/lexicon.data.js` (gzip+base64).

## Build stages

1. **Core engine** — ✅ rack, stick, validation, scoring, deck cycle, UI shell.
2. **Progression & bosses** — ✅ boss every 6th level, endless scaling.
3. **Shop & Books** — ✅ trigger/effect framework, buy/sell, slots, rarity.
4. **Content & juice** — ✅ 12 Books, two-axis tiles (5 variants × 5 alterations, stackable), themed shop bags with SVG art, consumables, synth audio, run stats.

## Tiles: two axes

Every tile can carry a **variant** (its material — placement-based effects) and a
**text alteration** (its styling — scoring effects), independently. Both are
applied inside `ScoringEngine.score()`, the single scoring choke point.

- **Variants:** Paper (double points, one-use), Woodblock (first-letter bonus),
  Cornerstone (last-letter mult), Ligature (buffs neighbours), Deckle (bonus by position).
- **Alterations:** Red (+2 mult), Comic Sans (value → mult, not points),
  Bold (double), Italic (+1 mult), Underline (+10 points).

The shop sells them as **themed random bags** (Vowel, Consonant, Suffix, Latin,
Lab, and the rare styled Sorts Tray). `CFG.TEST_TILES` seeds the deck with a
spread of every variant/alteration for testing — **set it to `false` for a real run.**
