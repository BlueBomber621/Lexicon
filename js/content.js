// content.js — pure data: the Book library, boss modifiers, and consumables.
// Adding content means adding an entry here; the frameworks in books.js,
// game.js, and shop.js interpret these — no new code per item.

// --- Books (the jokers) -------------------------------------------------
// One config entry each. Shape:
//   trigger: 'letter' (per tile, left→right) | 'word' (once per forge)
//          | 'roundStart' | 'reroll' | 'roundWin' (economy moments)
//   when:   optional predicate — (ctx, step, game)
//   effect: { points, mult, xMult, tickets, plays, rerolls }
//           values are numbers or (ctx, step, game) => number
//   roundStart: optional EXTRA economy effect for scoring-trigger Books
//               (e.g. Incunabula's downside), applied when a round begins
//   unlock: absent = always available. Present = starts locked; unlocks
//           permanently (localStorage) when `event` fires and `test` passes.
//           Events: 'forge' {word,total,repeat} | 'reroll' | 'purge' {n}
//                   | 'roundWin' {wasBoss}
// The interpreter lives in BookManager (books.js); unlocks in unlocks.js.
// Every Book has an SVG cover in index.html's sprite: #icon-book-<id>.

const BOOKS = [

  // ===== Starting pool — Common =========================================
  { id: 'pica', name: 'Pica', rarity: 'common', cost: 3, trigger: 'word',
    desc: '+15 points on every word.',
    flavor: 'Twelve points to the pica; fifteen to the faithful.',
    effect: { points: 15 } },

  { id: 'vowel-press', name: 'Vowel Press', rarity: 'common', cost: 4, trigger: 'letter',
    desc: 'Vowels score +2 extra points.',
    flavor: 'A, E, I, O, U — the load-bearing walls of the language.',
    when: (ctx, step) => 'AEIOU'.includes(step.tile.letter),
    effect: { points: 2 } },

  { id: 'bold-face', name: 'Bold Face', rarity: 'common', cost: 4, trigger: 'letter',
    desc: 'The first letter of every word scores double.',
    flavor: 'Lead with weight.',
    when: (ctx, step) => step.index === 0,
    effect: { points: (ctx, step) => step.pts } },

  { id: 'long-s', name: 'Long S', rarity: 'common', cost: 3, trigger: 'word',
    desc: 'Words containing an S get +2 mult.',
    flavor: 'The antique ſ, miſtaken for an f ſince 1790.',
    when: (ctx) => ctx.word.includes('S'),
    effect: { mult: 2 } },

  { id: 'ticket-punch', name: 'Ticket Punch', rarity: 'common', cost: 4, trigger: 'word',
    desc: '+1 ticket every word you forge.',
    flavor: 'Clip, clip. Every word pays.',
    effect: { tickets: 1 } },

  { id: 'em-quad', name: 'Em Quad', rarity: 'common', cost: 3, trigger: 'word',
    desc: 'Words of exactly 4 letters get +3 mult.',
    flavor: 'A perfect square of blank metal. Knows its size.',
    when: (ctx) => ctx.word.length === 4,
    effect: { mult: 3 } },

  { id: 'copperplate', name: 'Copperplate', rarity: 'common', cost: 4, trigger: 'letter',
    desc: 'Every letter scores +2 points.',
    flavor: 'Engraved, not cast. Everything cuts a little deeper.',
    effect: { points: 2 } },

  // ===== Starting pool — Uncommon =======================================
  { id: 'drop-cap', name: 'Drop Cap', rarity: 'uncommon', cost: 5, trigger: 'word',
    desc: 'Words of 6+ letters get +4 mult.',
    flavor: 'One ornate initial, three lines deep.',
    when: (ctx) => ctx.word.length >= 6,
    effect: { mult: 4 } },

  { id: 'rubricator', name: 'Rubricator', rarity: 'uncommon', cost: 6, trigger: 'word',
    desc: '+2 mult for every J, Q, X or Z in the word.',
    flavor: 'The rare letters are inked in red, and paid in full.',
    when: (ctx) => [...ctx.word].some((c) => 'JQXZ'.includes(c)),
    effect: { mult: (ctx) => 2 * [...ctx.word].filter((c) => 'JQXZ'.includes(c)).length } },

  { id: 'doublet', name: 'Doublet', rarity: 'uncommon', cost: 5, trigger: 'word',
    desc: '+25 points for each adjacent double letter.',
    flavor: 'LL, SS, EE — cast as one proud piece.',
    when: (ctx) => /(.)\1/.test(ctx.word),
    effect: { points: (ctx) => 25 * (ctx.word.match(/(.)\1/g) || []).length } },

  { id: 'gilded-type', name: 'Gilded Type', rarity: 'uncommon', cost: 6, trigger: 'letter',
    desc: 'Letters worth 5+ points score triple.',
    flavor: 'Gold leaf on the heavy sorts.',
    when: (ctx, step) => step.tile.value >= 5,
    effect: { points: (ctx, step) => step.tile.value * 2 } },

  { id: 'overtime', name: 'Overtime', rarity: 'uncommon', cost: 6, trigger: 'roundStart',
    desc: '+1 play every round.',
    flavor: 'The press runs past midnight.',
    effect: { plays: 1 } },

  { id: 'galley-proof', name: 'Galley Proof', rarity: 'uncommon', cost: 5, trigger: 'roundStart',
    desc: '+1 reroll every round.',
    flavor: 'Check the galley twice; recast what reads wrong.',
    effect: { rerolls: 1 } },

  { id: 'second-impression', name: 'Second Impression', rarity: 'uncommon', cost: 6, trigger: 'word',
    desc: '+1 mult for every word already forged this round.',
    flavor: 'The plate remembers its last pull.',
    effect: { mult: (ctx, step, game) => game.wordsThisRound } },

  // ===== Starting pool — Rare ===========================================
  { id: 'folio', name: 'Folio', rarity: 'rare', cost: 8, trigger: 'word',
    desc: '×2 mult on words of 8+ letters.',
    flavor: 'The grand format. Reserved for grand statements.',
    when: (ctx) => ctx.word.length >= 8,
    effect: { xMult: 2 } },

  { id: 'palindrome-press', name: 'Palindrome Press', rarity: 'rare', cost: 7, trigger: 'word',
    desc: '×3 mult on palindromes of 3+ letters.',
    flavor: 'Reads the same coming off the press backwards.',
    when: (ctx) => ctx.word.length >= 3 && ctx.word === [...ctx.word].reverse().join(''),
    effect: { xMult: 3 } },

  // ===== Unlockables ====================================================
  { id: 'marginalia', name: 'Marginalia', rarity: 'common', cost: 4, trigger: 'word',
    desc: '+5 points per Book on your shelf.',
    flavor: 'The notes in the margin outgrow the text.',
    effect: { points: (ctx, step, game) => 5 * game.books.shelf.length },
    unlock: { desc: 'Forge 25 words (lifetime).', event: 'forge',
      test: (data, profile) => profile.wordsForged >= 25 } },

  { id: 'specimen-book', name: 'The Specimen Book', rarity: 'common', cost: 4, trigger: 'word',
    desc: '+2 points per distinct letter in the word.',
    flavor: 'One of every sort, pinned and labelled.',
    effect: { points: (ctx) => 2 * new Set(ctx.word).size },
    unlock: { desc: 'Forge a word using all five vowels.', event: 'forge',
      test: (data) => [...'AEIOU'].every((v) => data.word.includes(v)) } },

  { id: 'ghostwriter', name: 'Ghostwriter', rarity: 'uncommon', cost: 5, trigger: 'letter',
    desc: 'Consonants score +1 extra point.',
    flavor: 'Nobody saw who set the type.',
    when: (ctx, step) => !'AEIOU'.includes(step.tile.letter),
    effect: { points: 1 },
    unlock: { desc: 'Forge a vowelless word of 3+ letters.', event: 'forge',
      test: (data) => data.word.length >= 3 && ![...data.word].some((c) => 'AEIOU'.includes(c)) } },

  { id: 'scarlet-letter', name: 'The Scarlet Letter', rarity: 'uncommon', cost: 5, trigger: 'word',
    desc: 'Words containing an A get +3 mult.',
    flavor: 'Worn openly. Scores boldly.',
    when: (ctx) => ctx.word.includes('A'),
    effect: { mult: 3 },
    unlock: { desc: 'Score 500+ with a single word.', event: 'forge',
      test: (data) => data.total >= 500 } },

  { id: 'waste-type', name: 'Waste Type', rarity: 'uncommon', cost: 6, trigger: 'word',
    desc: '+2 mult for each unused reroll.',
    flavor: 'The sorts you never spilled are worth the most.',
    effect: { mult: (ctx, step, game) => 2 * game.rerolls },
    unlock: { desc: 'Fire the reroll tray 15 times (lifetime).', event: 'reroll',
      test: (data, profile) => profile.rerollsUsed >= 15 } },

  { id: 'salvage-slip', name: 'Salvage Slip', rarity: 'uncommon', cost: 5, trigger: 'reroll',
    desc: '+1 ticket every time you fire the reroll tray.',
    flavor: 'Even the hellbox pays scrap rates.',
    effect: { tickets: 1 },
    unlock: { desc: 'Use a Hellbox Purge.', event: 'purge',
      test: () => true } },

  { id: 'hellbox-codex', name: 'Hellbox Codex', rarity: 'uncommon', cost: 6, trigger: 'word',
    desc: '+1 mult for every tile destroyed this run.',
    flavor: 'A ledger of everything melted down.',
    effect: { mult: (ctx, step, game) => game.stats.tilesDestroyed },
    unlock: { desc: 'Destroy 5 tiles (lifetime).', event: 'purge',
      test: (data, profile) => profile.purgedTiles >= 5 } },

  { id: 'concordance', name: 'The Concordance', rarity: 'rare', cost: 8, trigger: 'word',
    desc: '+1 mult for every letter beyond the 5th.',
    flavor: 'Every word, indexed against every other.',
    when: (ctx) => ctx.word.length > 5,
    effect: { mult: (ctx) => ctx.word.length - 5 },
    unlock: { desc: 'Forge a 9-letter word.', event: 'forge',
      test: (data) => data.word.length >= 9 } },

  { id: 'errata', name: 'Errata', rarity: 'rare', cost: 7, trigger: 'word',
    desc: '×2 mult if the word starts with the same letter as your previous word.',
    flavor: 'The corrections page, printing its own corrections.',
    when: (ctx, step, game) => !!game.lastWord && ctx.word[0] === game.lastWord[0],
    effect: { xMult: 2 },
    unlock: { desc: 'Forge the same word twice in one run.', event: 'forge',
      test: (data) => data.repeat } },

  { id: 'leaden-tome', name: 'The Leaden Tome', rarity: 'rare', cost: 7, trigger: 'word',
    desc: '+5 mult on every word during boss rounds.',
    flavor: 'Heavy reading for heavy days.',
    when: (ctx, step, game) => game.isBossLevel,
    effect: { mult: 5 },
    unlock: { desc: 'Defeat a boss.', event: 'roundWin',
      test: (data) => data.wasBoss } },

  { id: 'atlas-of-type', name: 'Atlas of Type', rarity: 'rare', cost: 8, trigger: 'roundWin',
    desc: '+3 tickets every time you clear a level.',
    flavor: 'Every foundry from here to Antwerp, mapped.',
    effect: { tickets: 3 },
    unlock: { desc: 'Earn 100 tickets (lifetime).', event: 'roundWin',
      test: (data, profile) => profile.ticketsEarned >= 100 } },

  { id: 'incunabula', name: 'Incunabula', rarity: 'rare', cost: 9, trigger: 'word',
    desc: '×2 mult on every word — but 1 fewer play each round.',
    flavor: 'Printed before 1501. It makes the rules now.',
    effect: { xMult: 2 },
    roundStart: { plays: -1 },
    unlock: { desc: 'Reach level 12.', event: 'roundWin',
      test: (data, profile, game) => game.level >= 12 } },
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
