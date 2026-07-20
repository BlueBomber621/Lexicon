// config.js — every tunable number in the game lives here.
// If you're balancing, this is the only file you should need to touch.

const CFG = {

  // --- Composing ------------------------------------------------------
  RACK_SIZE: 12,        // total hand size (rack + stick + tray); 1 more than the
                        // stick holds, so the extra tile is selection headroom
  STICK_SLOTS: 11,      // physical slots on the composing stick
  MIN_WORD_LEN: 1,      // shortest playable word
  MAX_WORD_LEN: 20,     // longest RESOLVED word the dict/validation accepts.
                        // Deliberately decoupled from STICK_SLOTS: multi-letter
                        // sorts (Œ→CE, &→AND) spell more letters than the slots
                        // they occupy, so a full 11-slot stick can read up to 20.

  // --- Round economy --------------------------------------------------
  PLAYS_PER_ROUND: 3,   // words you may forge per round
  REROLLS_PER_ROUND: 3, // reroll charges per round
  TRAY_SLOTS: 3,        // reroll tray capacity; a full tray fires automatically

  // --- Scoring --------------------------------------------------------
  // score = points × mult, where mult = MULT_BASE + word length.
  // Open tuning question: set MULT_BASE to 0 for the flat "mult = length" alternative.
  MULT_BASE: 1,

  // Scrabble-standard letter values.
  TILE_VALUES: {
    A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1,
    J: 8, K: 5, L: 1, M: 3, N: 1, O: 1, P: 3, Q: 10, R: 1,
    S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10,
  },

  // Tiles carry two independent axes — a VARIANT (the slug's material) and a
  // TEXT ALTERATION (its styling). Both can sit on the same tile, and both are
  // scored inside the ScoringEngine choke point. The effect data lives in
  // content.js (VARIANTS / ALTERATIONS); this file only holds tuning numbers.

  // (Per-bag variant/alteration odds live on each bag entry in content.js.)

  // Seed the starting deck with a spread of every variant & alteration so
  // they're visible immediately. Turn OFF for a real run.
  TEST_TILES: false,
  TEST_COPIES: 3,          // copies of each variant / alteration when testing

  // --- Progression ----------------------------------------------------
  // Targets run in 6-level sections ending on a boss. Within a section the
  // increment starts at DELTA and grows by DD each round. After each boss the
  // next section starts at bossTarget × BOSS_MULT, CEILed to a magnitude that
  // climbs every two sections (100, 100, 1000, 1000, 10k, ...), and DELTA/DD
  // grow by DELTA_GROWTH/DD_GROWTH. As a FINAL step each round's requirement
  // is rounded to the NEAREST magnitude one power below the section's
  // (10 for sections 1-2, 100 for 3-4, ...). Full math in Game.target.
  TARGET: {
    START: 100,        // level 1 goal
    DELTA: 60,         // first increment of section 1
    DELTA_GROWTH: 40,  // delta increases per section
    DD: 10,            // delta-delta of section 1
    DD_GROWTH: 15,     // delta-delta increases per section
    BOSS_MULT: 1.2,    // next section's start = last boss target × this
  },
  TICKETS_PER_LETTER: 1,    // tickets = longest word length that round × this
  TICKETS_PER_PLAY_LEFT: 1, // + this for each unused play at round end
  BOSS_EVERY: 6,            // every 6th level is a boss with a rule modifier
  SHOP_EVERY: 2,            // the shop opens after every 2nd level cleared

  // Difficulties, named for paper sizes. `mult` scales the target curve's
  // DELTA / DD (and their growths); START and the rounding rules are shared.
  // Imperial draws from BOSSES_IMPERIAL when that pool has entries.
  DIFFICULTIES: [
    { id: 'note', name: 'Note', mult: 1, icon: 'icon-diff-note' },
    { id: 'letter', name: 'Letter', mult: 1.5, icon: 'icon-diff-letter' },
    { id: 'demy', name: 'Demy', mult: 2.5, icon: 'icon-diff-demy' },
    { id: 'royal', name: 'Royal', mult: 4, icon: 'icon-diff-royal' },
    { id: 'imperial', name: 'Imperial', mult: 8, icon: 'icon-diff-imperial' },
  ],

  // Sticker odds: chance a shop Book carries one, then rarity weights
  // (quickly escalating rarity; Lamination is the rarest).
  STICKER_CHANCE: 0.28,
  STICKER_WEIGHTS: { present: 20, discount: 12, signature: 6, donated: 4, bestseller: 2, lamination: 1 },

  TYPEWRITER_DEPTH: 150, // candidates The Typewriter scores for real

  PEN_PACK_COST: 5,   // the Foundry's pen pack
  PEN_TILE_PULLS: 10, // tiles pulled from the bag to choose from
  PEN_CHOICES: 3,     // pens offered per pack

  // --- Shop -------------------------------------------------------------
  BOOK_SLOTS: 5,           // max Books on the shelf
  CONSUMABLE_SLOTS: 2,     // max consumables held
  SHOP_BOOK_OFFERS: 3,
  SHOP_BAG_OFFERS: 3,      // themed tile bags offered
  SHOP_CONSUMABLE_OFFERS: 2,
  BAG_PICKS: 3,            // tiles you keep from a bag's rolled options
  RARITY_WEIGHTS: { common: 6, uncommon: 3, rare: 1 }, // shop draw odds
  PROFILE_KEY: 'lexicon-profile', // localStorage key for lifetime unlock progress
  ACHIEVEMENTS_KEY: 'lexicon-achievements', // localStorage key for earned achievements
  SAVE_KEY: 'lexicon-run', // localStorage key for the in-progress run (Continue Run)
  SELL_FACTOR: 0.5,        // Books sell for cost × this (floored, min 1)
  RESTOCK_COST: 2,         // reroll the shop's offers
  MIN_DECK_SIZE: 80,       // Hellbox Purge can't thin the deck below this

  // --- Starting deck --------------------------------------------------
  // 94 tiles: a flatter, moderately vowel-forward distribution (~34% vowels)
  // so early words form without racks flooding with vowels. Deliberately NOT
  // the standard Scrabble bag; E stays the clear peak.
  STARTING_DECK: {
    A: 7, E: 9, I: 6, O: 6, U: 4,
    B: 3, C: 3, D: 4, F: 3, G: 3, H: 3, J: 1, K: 2, L: 4, M: 3,
    N: 5, P: 3, Q: 1, R: 5, S: 5, T: 5, V: 2, W: 2, X: 1, Y: 3, Z: 1,
  },

  // --- Animation timing (ms) — the scoring sweep -----------------------
  ANIM: {
    EVENT_STEP: 330,    // base beat per count event (tile pts, book mult, ...)
    SPEED_RAMP: 0.06,   // sweep speed grows by this per event...
    SPEED_CAP: 6,       // ...capped at this multiple
    MULT_HOLD: 550,     // pause on the press-red mult flash
    TOTAL_COUNT: 450,   // total counting up to points × mult
    TOTAL_HOLD: 650,    // pause on the final total
    SPEND: 350,         // spent slugs fading off to the hellbox
    TRAY_FIRE: 300,     // beat between the 3rd tray tile landing and the auto-reroll

    // Scoring-sweep juice (the "amp up" layer — body-level particles, rings,
    // and a table shake). All of it is skipped under prefers-reduced-motion
    // (see UI.reduceMotion / the media block in style.css).
    FX: {
      SPARKS: 9,        // spark particles flung per impactful trigger
      SPARK_DIST: 46,   // px they travel outward
      SHAKE_MAX: 12,    // px the table throws on the biggest totals
      BIG_PTS: 12,      // a single point count >= this also throws sparks
    },
  },
};
