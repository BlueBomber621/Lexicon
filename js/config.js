// config.js — every tunable number in the game lives here.
// If you're balancing, this is the only file you should need to touch.

const CFG = {

  // --- Composing ------------------------------------------------------
  RACK_SIZE: 12,        // total hand size (rack + stick + tray); 1 more than the
                        // stick holds, so the extra tile is selection headroom
  STICK_SLOTS: 11,      // slots on the composing stick (max word length)
  MIN_WORD_LEN: 1,      // shortest playable word
  MAX_WORD_LEN: 11,     // longest playable word (must match STICK_SLOTS)

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

  // Odds a Sorts Tray tile rolls each axis (independent).
  SORTS_VARIANT_CHANCE: 0.6,
  SORTS_ALTER_CHANCE: 0.6,

  // Seed the starting deck with a spread of every variant & alteration so
  // they're visible immediately. Turn OFF for a real run.
  TEST_TILES: true,
  TEST_COPIES: 3,          // copies of each variant / alteration when testing

  // --- Progression ----------------------------------------------------
  TARGET_BASE: 150,        // level 1 score target
  TARGET_GROWTH: 1.4,      // target = base × growth^(level-1), forever
  TICKETS_PER_LETTER: 1,   // tickets = longest word length that round × this
  BOSS_EVERY: 6,           // every 6th level is a boss with a rule modifier
  SHOP_EVERY: 2,           // the shop opens after every 2nd level cleared

  // --- Shop -------------------------------------------------------------
  BOOK_SLOTS: 5,           // max Books on the shelf
  CONSUMABLE_SLOTS: 2,     // max consumables held
  SHOP_BOOK_OFFERS: 3,
  SHOP_BAG_OFFERS: 3,      // themed tile bags offered
  SHOP_CONSUMABLE_OFFERS: 2,
  RARITY_WEIGHTS: { common: 6, uncommon: 3, rare: 1 }, // shop draw odds
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
    LETTER_STEP: 190,   // per-slug copper flare as points climb
    MULT_HOLD: 550,     // pause on the press-red mult flash
    TOTAL_COUNT: 450,   // total counting up to points × mult
    TOTAL_HOLD: 650,    // pause on the final total
    SPEND: 350,         // spent slugs fading off to the hellbox
    TRAY_FIRE: 300,     // beat between the 3rd tray tile landing and the auto-reroll
  },
};
