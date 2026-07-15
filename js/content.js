// content.js — pure data: the Book library, boss modifiers, and consumables.
// Adding content means adding an entry here; the frameworks in books.js,
// game.js, and shop.js interpret these — no new code per item.

// --- Books (the jokers) -------------------------------------------------
// One config entry each. Shape:
//   trigger: 'letter' (per tile, left→right) | 'word' (once per forge)
//          | 'roundStart' (when a round begins)
//   when:   optional predicate — (ctx, step) for letter/word triggers
//   effect: { points, mult, xMult, tickets, plays, rerolls }
//           values are numbers or (ctx, step) => number
// The interpreter lives in BookManager.applyEffect (books.js).

const BOOKS = [

  // Common
  { id: 'pica', name: 'Pica', rarity: 'common', cost: 3, trigger: 'word',
    desc: '+15 points on every word.',
    effect: { points: 15 } },

  { id: 'vowel-press', name: 'Vowel Press', rarity: 'common', cost: 4, trigger: 'letter',
    desc: 'Vowels score +2 extra points.',
    when: (ctx, step) => 'AEIOU'.includes(step.tile.letter),
    effect: { points: 2 } },

  { id: 'bold-face', name: 'Bold Face', rarity: 'common', cost: 4, trigger: 'letter',
    desc: 'The first letter of every word scores double.',
    when: (ctx, step) => step.index === 0,
    effect: { points: (ctx, step) => step.pts } },

  { id: 'long-s', name: 'Long S', rarity: 'common', cost: 3, trigger: 'word',
    desc: 'Words containing an S get +2 mult.',
    when: (ctx) => ctx.word.includes('S'),
    effect: { mult: 2 } },

  { id: 'ticket-punch', name: 'Ticket Punch', rarity: 'common', cost: 4, trigger: 'word',
    desc: '+1 ticket every word you forge.',
    effect: { tickets: 1 } },

  // Uncommon
  { id: 'drop-cap', name: 'Drop Cap', rarity: 'uncommon', cost: 5, trigger: 'word',
    desc: 'Words of 6+ letters get +4 mult.',
    when: (ctx) => ctx.word.length >= 6,
    effect: { mult: 4 } },

  { id: 'rubricator', name: 'Rubricator', rarity: 'uncommon', cost: 6, trigger: 'word',
    desc: '+2 mult for every J, Q, X or Z in the word.',
    when: (ctx) => [...ctx.word].some((c) => 'JQXZ'.includes(c)),
    effect: { mult: (ctx) => 2 * [...ctx.word].filter((c) => 'JQXZ'.includes(c)).length } },

  { id: 'ligature', name: 'Ligature', rarity: 'uncommon', cost: 5, trigger: 'word',
    desc: '+25 points for each adjacent double letter.',
    when: (ctx) => /(.)\1/.test(ctx.word),
    effect: { points: (ctx) => 25 * (ctx.word.match(/(.)\1/g) || []).length } },

  { id: 'gilded-type', name: 'Gilded Type', rarity: 'uncommon', cost: 6, trigger: 'letter',
    desc: 'Letters worth 5+ points score triple.',
    when: (ctx, step) => step.tile.value >= 5,
    effect: { points: (ctx, step) => step.tile.value * 2 } },

  { id: 'overtime', name: 'Overtime', rarity: 'uncommon', cost: 6, trigger: 'roundStart',
    desc: '+1 play every round.',
    effect: { plays: 1 } },

  // Rare
  { id: 'folio', name: 'Folio', rarity: 'rare', cost: 8, trigger: 'word',
    desc: '×2 mult on words of 8+ letters.',
    when: (ctx) => ctx.word.length >= 8,
    effect: { xMult: 2 } },

  { id: 'palindrome-press', name: 'Palindrome Press', rarity: 'rare', cost: 7, trigger: 'word',
    desc: '×3 mult on palindromes of 3+ letters.',
    when: (ctx) => ctx.word.length >= 3 && ctx.word === [...ctx.word].reverse().join(''),
    effect: { xMult: 3 } },
];

// --- Bosses (blind-style rule modifiers, every 6th level) ----------------
// letterHook/wordHook register on the ScoringEngine at high priority so
// they land AFTER every Book (caps actually cap). validWord adds an extra
// playability constraint on top of the dictionary. playsDelta/rerollsDelta
// bend the round's economy.

const BOSSES = [

  { id: 'vowel-void', name: 'The Vowel Void',
    desc: 'Vowels score 0 points.',
    letterHook: (ctx, step) => { if ('AEIOU'.includes(step.tile.letter)) step.pts = 0; } },

  { id: 'leaden-mult', name: 'The Leaden Mult',
    desc: 'Mult is capped at ×5.',
    wordHook: (ctx) => { ctx.mult = Math.min(ctx.mult, 5); } },

  { id: 'fine-print', name: 'The Fine Print',
    desc: 'Words under 5 letters are invalid.',
    validWord: (word) => word.length >= 5 },

  { id: 'the-smudge', name: 'The Smudge',
    desc: 'Letters worth 4+ points score 0.',
    letterHook: (ctx, step) => { if (step.tile.value >= 4) step.pts = 0; } },

  { id: 'the-miser', name: 'The Miser',
    desc: 'One fewer play this round.',
    playsDelta: -1 },

  { id: 'the-ration', name: 'The Ration',
    desc: 'No rerolls this round.',
    rerollsDelta: -99 }, // clamped to 0 by the game
];

// --- Consumables ----------------------------------------------------------
// Single-use items. use(game) returns false to signal "couldn't be used"
// (the item is not consumed in that case).

const CONSUMABLES = [

  { id: 'proofing-ink', name: 'Proofing Ink', cost: 3,
    desc: '+1 reroll this round.',
    use: (game) => { game.rerolls++; } },

  { id: 'overtime-slip', name: 'Overtime Slip', cost: 4,
    desc: '+1 play this round.',
    use: (game) => { game.plays++; } },

  { id: 'hellbox-purge', name: 'Hellbox Purge', cost: 4,
    desc: 'Destroy the tiles in your reroll tray — removed from the deck forever.',
    use: (game) => game.purgeTray() },
];

// --- Tile VARIANTS (the slug's material) ----------------------------------
// One of these per tile (or none). Effects are placement-based — they care
// about WHERE the tile sits in the word, not raw value. Applied inside the
// ScoringEngine choke point.
//
//   apply(ctx, step, tiles)     — per-tile, may adjust step.pts / ctx.mult.
//                                 step.index is the tile's position in the word.
//   neighbor(i, bonus, tiles)   — optional pre-pass; add points to bonus[i±1].
//   oneUse: true                — the tile is destroyed after the forge it's in.
//   cls                         — CSS class for its look.

const VARIANTS = {
  paper: {
    id: 'paper', name: 'Paper', cls: 'v-paper',
    desc: 'Scores double points, then is destroyed (one use).',
    oneUse: true,
    apply: (ctx, step) => { step.pts *= 2; },
  },
  woodblock: {
    id: 'woodblock', name: 'Woodblock', cls: 'v-woodblock',
    desc: '+8 points when it leads the word (first letter).',
    apply: (ctx, step) => { if (step.index === 0) step.pts += 8; },
  },
  cornerstone: {
    id: 'cornerstone', name: 'Cornerstone', cls: 'v-cornerstone',
    desc: '+3 mult when it ends the word (last letter).',
    apply: (ctx, step, tiles) => { if (step.index === tiles.length - 1) ctx.mult += 3; },
  },
  ligature: {
    id: 'ligature', name: 'Ligature', cls: 'v-ligature',
    desc: '+4 points to each neighbouring tile in the word.',
    neighbor: (i, bonus, tiles) => {
      if (i > 0) bonus[i - 1] += 4;
      if (i < tiles.length - 1) bonus[i + 1] += 4;
    },
  },
  deckle: {
    id: 'deckle', name: 'Deckle', cls: 'v-deckle',
    desc: '+1 point for each letter that comes before it — rewards long words.',
    apply: (ctx, step) => { step.pts += step.index; },
  },
};

// --- Tile TEXT ALTERATIONS (the slug's styling) ---------------------------
// Independent of the variant — a tile may have both. Scoring-flavored.
//   apply(ctx, step)     — adjusts step.pts / ctx.mult.
//   redirectToMult: true — after everything, this tile's points are moved
//                          into mult and its point contribution becomes 0.

const ALTERATIONS = {
  red: {
    id: 'red', name: 'Red Letter', cls: 'a-red',
    desc: '+2 mult when scored.',
    apply: (ctx) => { ctx.mult += 2; },
  },
  comic: {
    id: 'comic', name: 'Comic Sans', cls: 'a-comic',
    desc: 'Its points count toward MULT instead of points.',
    redirectToMult: true,
  },
  bold: {
    id: 'bold', name: 'Bold', cls: 'a-bold',
    desc: 'Doubles this tile\'s point contribution.',
    apply: (ctx, step) => { step.pts *= 2; },
  },
  italic: {
    id: 'italic', name: 'Italic', cls: 'a-italic',
    desc: '+1 mult when scored.',
    apply: (ctx) => { ctx.mult += 1; },
  },
  underline: {
    id: 'underline', name: 'Underline', cls: 'a-underline',
    desc: '+10 points when scored.',
    apply: (ctx, step) => { step.pts += 10; },
  },
};

// --- Tile BAGS (what the shop sells instead of single letters) ------------
// Each bag grants `count` random tiles drawn from a weighted `pool` string
// (repeated letters = higher odds). `styled` bags roll variants/alterations
// onto their tiles. `icon` names the SVG symbol in index.html's sprite.

const BAGS = [
  { id: 'vowel', name: 'Vowel Sack', cost: 4, count: 4, icon: 'icon-vowel',
    rarity: 'common', pool: 'AAAEEEIIOOU',
    desc: '4 random vowels — keeps words formable.' },

  { id: 'consonant', name: 'Consonant Sack', cost: 4, count: 4, icon: 'icon-consonant',
    rarity: 'common', pool: 'NNRRSSTTLLCDPMGBH',
    desc: '4 random common consonants.' },

  { id: 'suffix', name: 'Suffix Case', cost: 5, count: 4, icon: 'icon-suffix',
    rarity: 'uncommon', pool: 'EEDDRSSTGNGYILN',
    desc: '4 word-enders — the makings of -ING, -ED, -ER, -EST.' },

  { id: 'latin', name: 'Latin Case', cost: 5, count: 3, icon: 'icon-latin',
    rarity: 'uncommon', pool: 'CCIILVXMTUSAER',
    desc: '3 classical letters — C, I, V, X, M, L lean.' },

  { id: 'science', name: 'Lab Case', cost: 6, count: 3, icon: 'icon-science',
    rarity: 'uncommon', pool: 'OOXYGNHPSCKZ',
    desc: '3 technical letters, skewed toward high value.' },

  { id: 'sorts', name: 'Sorts Tray', cost: 9, count: 2, icon: 'icon-sorts',
    rarity: 'rare', pool: 'EAIORNSTLDUCMPBG', styled: true,
    desc: '2 tiles cast with random variants & alterations.' },
];
