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
    desc: '+12 points on every word.',
    flavor: 'Twelve points to the pica, and not one point more.',
    effect: { points: 12 } },

  { id: 'vowel-press', name: 'Vowel Press', rarity: 'common', cost: 3, trigger: 'letter',
    desc: 'Vowels score +2 extra points.',
    flavor: 'A, E, I, O, U — the load-bearing walls of the language.',
    when: (ctx, step) => Util.spellsAny(step, 'AEIOU'),
    effect: { points: 2 } },

  { id: 'bold-face', name: 'Bold Face', rarity: 'common', cost: 3, trigger: 'letter',
    desc: 'The first letter of every word scores double.',
    flavor: 'Lead with weight.',
    when: (ctx, step) => step.index === 0,
    effect: { points: (ctx, step) => step.pts } },

  { id: 'long-s', name: 'Long S', rarity: 'common', cost: 3, trigger: 'word',
    desc: 'Words containing an S get +3 mult.',
    flavor: 'The antique ſ, miſtaken for an f ſince 1790.',
    when: (ctx) => ctx.word.includes('S'),
    effect: { mult: 3 } },

  { id: 'ticket-punch', name: 'Ticket Punch', rarity: 'common', cost: 3, trigger: 'word',
    desc: '+1 ticket every word you forge.',
    flavor: 'Clip, clip. Every word pays.',
    effect: { tickets: 1 } },

  { id: 'em-quad', name: 'Em Quad', rarity: 'common', cost: 3, trigger: 'word',
    desc: 'Words of exactly 4 letters get +8 mult.',
    flavor: 'A perfect square of blank metal. Knows its size.',
    when: (ctx) => ctx.word.length === 4,
    effect: { mult: 8 } },

  { id: 'copperplate', name: 'Copperplate', rarity: 'common', cost: 3, trigger: 'letter',
    desc: 'Every letter scores +2 points.',
    flavor: 'Engraved, not cast. Everything cuts a little deeper.',
    effect: { points: 2 } },

  { id: 'minuscule', name: 'Minuscule', rarity: 'common', cost: 3, trigger: 'word',
    desc: 'Words of 3 or fewer letters get +5 mult.',
    flavor: 'Small type, sharp teeth.',
    when: (ctx) => ctx.word.length <= 3,
    effect: { mult: 5 } },

  { id: 'widows-word', name: "The Widow's Word", rarity: 'common', cost: 3, trigger: 'letter',
    desc: 'The last letter of every word scores double.',
    flavor: 'No line left behind.',
    when: (ctx, step) => step.index === ctx.tiles.length - 1,
    effect: { points: (ctx, step) => step.pts } },

  { id: 'reprint', name: 'Reprint', rarity: 'common', cost: 3, trigger: 'word',
    desc: '+10 points if the word shares a letter with your previous word.',
    flavor: "Yesterday's news, today's ink.",
    when: (ctx, step, game) => !!game.lastWord && [...ctx.word].some((c) => game.lastWord.includes(c)),
    effect: { points: 10 } },

  { id: 'colophon', name: 'Colophon', rarity: 'common', cost: 3, trigger: 'word',
    desc: 'Words ending in S get +4 mult.',
    flavor: 'The closing mark, pluralised.',
    when: (ctx) => ctx.word.endsWith('S'),
    effect: { mult: 4 } },

  // --- Shelf-position Books: effects read `pos` (index on The Shelf) -----
  { id: 'spine', name: 'The Spine', rarity: 'common', cost: 3, trigger: 'word',
    desc: '+1 mult for every Book to its left on The Shelf.',
    flavor: 'It holds the whole row together, from the far end.',
    when: (ctx, step, game, state, pos) => pos > 0,
    effect: { mult: (ctx, step, game, state, pos) => pos } },

  { id: 'table-of-contents', name: 'Table of Contents', rarity: 'common', cost: 3, trigger: 'word',
    desc: '+15 points while it is the leftmost Book.',
    flavor: 'Everything begins here, or it complains.',
    when: (ctx, step, game, state, pos) => pos === 0,
    effect: { points: 15 } },

  { id: 'manuscript', name: 'The Manuscript', rarity: 'common', cost: 3, trigger: 'word',
    desc: 'Starts at +30 points; fades by 1 with every word forged.',
    flavor: 'Brilliant, urgent, and already yellowing.',
    initState: { pts: 30 },
    status: (state) => `+${state.pts} pts`,
    grow: { forge: (state) => { state.pts = Math.max(0, state.pts - 1); } },
    effect: { points: (ctx, step, game, state) => state.pts } },

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

  { id: 'day-book', name: 'The Day Book', rarity: 'uncommon', cost: 5, trigger: 'roundWin',
    desc: '+1 more ticket for each unused play when you clear a level.',
    flavor: 'Idle presses, dutifully invoiced.',
    effect: { tickets: (ctx, step, game) => game.plays } },

  { id: 'etaoin', name: 'Etaoin Shrdlu', rarity: 'uncommon', cost: 5, trigger: 'letter',
    desc: 'E, T, A, O, I and N score +2 extra points.',
    flavor: 'The first column of the Linotype, summoned by accident.',
    when: (ctx, step) => Util.spellsAny(step, 'ETAOIN'),
    effect: { points: 2 } },

  { id: 'monotype', name: 'Monotype', rarity: 'uncommon', cost: 5, trigger: 'word',
    desc: 'Words with no repeated letters get +3 mult.',
    flavor: 'One of each, never twice.',
    when: (ctx) => new Set(ctx.word).size === ctx.word.length,
    effect: { mult: 3 } },

  { id: 'broadsheet', name: 'Broadsheet', rarity: 'uncommon', cost: 6, trigger: 'word',
    desc: '+1 mult per distinct vowel in the word.',
    flavor: 'All the vowels fit to print.',
    when: (ctx) => [...'AEIOU'].some((v) => ctx.word.includes(v)),
    effect: { mult: (ctx) => [...'AEIOU'].filter((v) => ctx.word.includes(v)).length } },

  { id: 'quire', name: 'The Quire', rarity: 'uncommon', cost: 6, trigger: 'word',
    desc: 'Every 4th word you forge scores ×2 mult.',
    flavor: 'Fold four sheets; the last one sings.',
    when: (ctx, step, game) => (game.stats.wordsForged + 1) % 4 === 0,
    effect: { xMult: 2 } },

  { id: 'sort-merchant', name: 'The Sort Merchant', rarity: 'uncommon', cost: 5, trigger: 'letter',
    desc: 'Slugs bought from bags score +4 extra points.',
    flavor: 'You get what you pay for.',
    when: (ctx, step) => !!step.tile.bought,
    effect: { points: 4 } },

  { id: 'foundry-mark', name: 'The Foundry Mark', rarity: 'uncommon', cost: 6, trigger: 'letter',
    desc: '+1 mult for each variant or alteration on a slug when it scores.',
    flavor: 'Signed work commands a premium.',
    when: (ctx, step) => !!(step.tile.variant || step.tile.alteration),
    effect: { mult: (ctx, step) => (step.tile.variant ? 1 : 0) + (step.tile.alteration ? 1 : 0) } },

  { id: 'the-index', name: 'The Index', rarity: 'uncommon', cost: 5, trigger: 'word',
    desc: '+3 mult while it is the rightmost Book.',
    flavor: 'The last word on every subject.',
    when: (ctx, step, game, state, pos) => pos === game.books.shelf.length - 1,
    effect: { mult: 3 } },

  { id: 'second-volume', name: 'The Second Volume', rarity: 'uncommon', cost: 6, trigger: 'word',
    desc: '+2 mult for every Book to its right on The Shelf.',
    flavor: 'It insists the story is only getting started.',
    when: (ctx, step, game, state, pos) => pos < game.books.shelf.length - 1,
    effect: { mult: (ctx, step, game, state, pos) => 2 * (game.books.shelf.length - 1 - pos) } },

  { id: 'serial', name: 'The Serial', rarity: 'uncommon', cost: 6, trigger: 'word',
    desc: '+1 mult for every level cleared this run.',
    flavor: 'To be continued. And continued. And continued.',
    when: (ctx, step, game) => game.level > 1,
    effect: { mult: (ctx, step, game) => game.level - 1 } },

  { id: 'appendix', name: 'The Appendix', rarity: 'uncommon', cost: 5, trigger: 'word',
    desc: '+20 points while rightmost on a shelf of 3+ Books.',
    flavor: 'Nobody reads it. It scores anyway.',
    when: (ctx, step, game, state, pos) =>
      game.books.shelf.length >= 3 && pos === game.books.shelf.length - 1,
    effect: { points: 20 } },

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

  // Scaling rares: per-run state that GROWS from play. `initState` seeds it,
  // `grow.<event>` mutates it at commit moments, `status` renders the badge.
  { id: 'compendium', name: 'The Compendium', rarity: 'rare', cost: 8, trigger: 'word',
    desc: 'Gains +3 points for every word forged while shelved.',
    flavor: 'It files everything you say, and it is always hungry.',
    initState: { pts: 0 },
    status: (state) => `+${state.pts} pts`,
    grow: { forge: (state) => { state.pts += 3; } },
    effect: { points: (ctx, step, game, state) => state.pts } },

  { id: 'bellows', name: 'The Bellows', rarity: 'rare', cost: 7, trigger: 'word',
    desc: 'Gains +1 mult every time you fire the reroll tray.',
    flavor: 'Every gust feeds the fire.',
    initState: { mult: 0 },
    status: (state) => `+${state.mult} mult`,
    grow: { reroll: (state) => { state.mult += 1; } },
    effect: { mult: (ctx, step, game, state) => state.mult } },

  { id: 'trilogy', name: 'The Trilogy', rarity: 'rare', cost: 8, trigger: 'word',
    desc: '×2 mult while EXACTLY 3 Books sit on The Shelf.',
    flavor: 'Three volumes. No more. It has opinions about sequels.',
    when: (ctx, step, game) => game.books.shelf.length === 3,
    effect: { xMult: 2 } },

  { id: 'anthology', name: 'The Anthology', rarity: 'rare', cost: 9, trigger: 'word',
    desc: '×2 mult while The Shelf is full.',
    flavor: 'Every voice at once, bound in one cover.',
    when: (ctx, step, game) => game.books.shelf.length >= CFG.BOOK_SLOTS,
    effect: { xMult: 2 } },

  // ===== Substitution Books =============================================
  // trigger 'passive' — no scoring effect at all. `substitute` maps a tile
  // letter to the letters it MAY ALSO BE READ AS when checking the word
  // against the dictionary. Scoring always uses the real tile letters.
  // Rare, not common: with Z at 10 points, reading Z-as-S turns a pile of
  // cheap Zs into 40-point plays. The Turned Sort stays common because N and
  // U are both worth 1, so it has no equivalent scoring exploit.
  { id: 'the-lisp', name: 'The Lisp', rarity: 'rare', cost: 7, trigger: 'passive',
    desc: 'For spelling, any S may be read as a Z — and any Z as an S.',
    flavor: 'The compositor has a slight impediment. The dictionary is being very polite about it.',
    substitute: { S: ['Z'], Z: ['S'] } },

  { id: 'turned-sort', name: 'The Turned Sort', rarity: 'common', cost: 4, trigger: 'passive',
    desc: 'For spelling, any N may be read as a U — and any U as an N.',
    flavor: 'Drop an N on its head and it comes up U. Every apprentice learns this the hard way.',
    substitute: { N: ['U'], U: ['N'] } },

  { id: 'great-vowel-shift', name: 'The Great Vowel Shift', rarity: 'rare', cost: 8, trigger: 'passive',
    desc: 'Any vowel may be read as any other vowel — but vowels score 0, and their materials and alterations do nothing.',
    flavor: 'Middle English did this to itself over two centuries. You are doing it over one round.',
    substitute: { A: [...'AEIOU'], E: [...'AEIOU'], I: [...'AEIOU'],
      O: [...'AEIOU'], U: [...'AEIOU'] },
    // Mutes the vowel entirely: no points, no variant, no alteration, no retrigger.
    letterSetup: (ctx, step) => {
      if ('AEIOU'.includes(step.tile.letter)) { step.pts = 0; step.mute = true; }
    } },

  // ===== Style-scaling Books (grow off materials & alterations) =========
  { id: 'shredded-book', name: 'The Shredded Book', rarity: 'uncommon', cost: 5, trigger: 'word',
    desc: 'Gains +1 mult every time a Paper slug is destroyed.',
    flavor: 'It feeds on pulp. It is not fussy about whose.',
    initState: { mult: 0 },
    status: (state) => `+${state.mult} mult`,
    grow: { destroy: (state, data) => {
      state.mult += (data.tiles || []).filter((t) => t.variant === 'paper').length;
    } },
    effect: { mult: (ctx, step, game, state) => state.mult } },

  { id: 'ink-ledger', name: 'The Ink Ledger', rarity: 'uncommon', cost: 6, trigger: 'word',
    desc: 'Gains +3 points for every altered slug you play.',
    flavor: 'Every drop of coloured ink, itemised and billed.',
    initState: { pts: 0 },
    status: (state) => `+${state.pts} pts`,
    grow: { play: (state, data) => {
      state.pts += 3 * data.tiles.filter((t) => t.alteration).length;
    } },
    effect: { points: (ctx, step, game, state) => state.pts } },

  { id: 'the-impression', name: 'The Impression', rarity: 'uncommon', cost: 6, trigger: 'word',
    desc: 'Gains +4 points for every slug cast in a material that you play.',
    flavor: 'It keeps a rubbing of everything the press has ever bitten.',
    initState: { pts: 0 },
    status: (state) => `+${state.pts} pts`,
    grow: { play: (state, data) => {
      state.pts += 4 * data.tiles.filter((t) => t.variant).length;
    } },
    effect: { points: (ctx, step, game, state) => state.pts } },

  { id: 'master-printer', name: 'The Master Printer', rarity: 'rare', cost: 8, trigger: 'word',
    desc: '+3 mult for each DISTINCT text alteration you have played this run.',
    flavor: 'Knows every hand in the shop, and holds a grudge against three of them.',
    initState: { seen: '' }, // comma list — kept flat so state copies cleanly
    status: (state) => `+${3 * state.seen.split(',').filter(Boolean).length} mult`,
    grow: { play: (state, data) => {
      for (const t of data.tiles) {
        if (t.alteration && !state.seen.split(',').includes(t.alteration)) {
          state.seen += t.alteration + ',';
        }
      }
    } },
    effect: { mult: (ctx, step, game, state) => 3 * state.seen.split(',').filter(Boolean).length } },

  { id: 'the-encore', name: 'The Encore', rarity: 'rare', cost: 8, trigger: 'word',
    desc: 'Is worth +3 more points for every retrigger this whole run.',
    flavor: 'Again! Again! It has never once been satisfied with a single pull.',
    initState: { pts: 0 },
    status: (state) => `+${state.pts} pts`,
    grow: { retrigger: (state, data) => { state.pts += 3 * data.n; } },
    effect: { points: (ctx, step, game, state) => state.pts } },

  { id: 'textbook', name: 'The Textbook', rarity: 'rare', cost: 8, trigger: 'word',
    desc: 'Starts at ×1 mult, and gains +0.25× every time you play an Underlined or Italic slug.',
    flavor: 'Required reading. Annotated to death by everyone who held it before you.',
    initState: { x: 1 },
    status: (state) => `×${state.x.toFixed(2)}`,
    grow: { play: (state, data) => {
      state.x += 0.25 * data.tiles.filter((t) =>
        t.alteration === 'underline' || t.alteration === 'italic').length;
    } },
    effect: { xMult: (ctx, step, game, state) => state.x },
    unlock: { desc: 'Reroll 9 A slugs within a single level.', event: 'reroll',
      test: (data, profile, game) => game.roundRerolledA >= 9 } },

  { id: 'forgotten-tale', name: 'The Forgotten Tale', rarity: 'uncommon', cost: 6, trigger: 'word',
    desc: '+14 mult on any word containing an I, a V or an X.',
    flavor: 'Chapter I, Chapter V, Chapter X. The rest were lost to damp.',
    when: (ctx) => [...'IVX'].some((c) => ctx.word.includes(c)),
    effect: { mult: 14 },
    unlock: { desc: 'Play 5 different runs.', event: 'runEnd',
      test: (data, profile) => profile.runsPlayed >= 5 } },

  { id: 'scroll', name: 'The Scroll', rarity: 'uncommon', cost: 6, trigger: 'passive',
    desc: 'Before each play is counted, one random unaltered slug in the word is inked Italic — permanently.',
    flavor: 'It keeps annotating. Nobody asked it to.',
    // Commit-gated: a preview must never rewrite your deck.
    preScore: (ctx, game) => {
      if (!ctx.commit) return;
      const bare = ctx.tiles.filter((t) => !t.alteration);
      if (bare.length === 0) return;
      const tile = bare[Math.floor(Math.random() * bare.length)];
      tile.alteration = 'italic';
      game.note(`The Scroll italicises ${tile.letter}`);
    } },

  { id: 'journal', name: 'The Journal', rarity: 'common', cost: 4, trigger: 'passive',
    desc: 'Comic Sans slugs score their points AND their mult, instead of only mult.',
    flavor: 'Dear diary: today they let me keep the points as well.',
    preScore: (ctx) => { ctx.keepComicPoints = true; },
    unlock: { desc: "Ink 3 slugs with the Jester's Pen.", event: 'pen',
      test: (data, profile) => profile.jesterPenUsed >= 3 } },

  { id: 'sticky-note', name: 'The Sticky Note', rarity: 'rare', cost: 8, trigger: 'passive',
    desc: 'Every Hellbox Purge slaps a random sticker onto a random Book that has none.',
    flavor: 'It has no opinions of its own. It just really likes putting things on other things.',
    grow: { destroy: (state, data, game) => {
      if (data.source !== 'purge') return;
      const res = game.books.stickRandom();
      if (res) game.note(`${res.sticker.name} stuck to ${res.book.name}`);
    } } },

  // ===== Slug-aware & shelf-aware Books =================================
  { id: 'yellow-books', name: 'The Yellow Books', rarity: 'uncommon', cost: 6, trigger: 'word',
    desc: '+2 mult for every slug in the word worth less than 5 points.',
    flavor: 'Everyone is listed. Nobody is important.',
    effect: { mult: (ctx) => 2 * ctx.tiles.filter((t) => t.value < 5).length } },

  { id: 'tally-stone', name: 'The Tally Stone', rarity: 'uncommon', cost: 6, trigger: 'word',
    desc: '+5 points for every Cornerstone slug in the word — placed correctly or not.',
    flavor: 'Scratch a mark for each one. The stone does not care where they stood.',
    when: (ctx) => ctx.tiles.some((t) => t.variant === 'cornerstone'),
    effect: { points: (ctx) => 5 * ctx.tiles.filter((t) => t.variant === 'cornerstone').length } },

  { id: 'colouring-book', name: 'The Colouring Book', rarity: 'rare', cost: 8, trigger: 'passive',
    desc: 'Every Red Letter slug retriggers.',
    flavor: 'Stay inside the lines. Then go over them again.',
    preScore: (ctx) => { ctx.retriggerAlterations = [...(ctx.retriggerAlterations || []), 'red']; } },

  { id: 'times-tables', name: 'Times Tables', rarity: 'rare', cost: 8, trigger: 'word',
    desc: '×2 mult on any word containing a T.',
    flavor: 'T times two. It refuses to elaborate.',
    when: (ctx) => ctx.word.includes('T'),
    effect: { xMult: 2 },
    unlock: { desc: 'Score a word at ×50 mult or higher.', event: 'forge',
      test: (data) => data.mult >= 50 } },

  { id: 'cookbook', name: 'The Cookbook', rarity: 'uncommon', cost: 6, trigger: 'word',
    desc: '+2 points for every slug worth more than the slug before it.',
    flavor: 'Build the flavours up. Never let a course disappoint the last.',
    effect: { points: (ctx) => {
      let steps = 0;
      for (let i = 1; i < ctx.tiles.length; i++) {
        if (ctx.tiles[i].value > ctx.tiles[i - 1].value) steps++;
      }
      return 2 * steps;
    } },
    unlock: { desc: 'Beat the 3rd boss of a single run.', event: 'roundWin',
      test: (data) => data.bossesThisRun >= 3 } },

  { id: 'grid-notebook', name: 'The Grid Notebook', rarity: 'rare', cost: 8, trigger: 'letter',
    desc: 'Doubles the points of the slug in the same position as this Book sits on The Shelf.',
    flavor: 'Everything in its square. Especially you.',
    when: (ctx, step, game, state, pos) => step.index === pos,
    effect: { points: (ctx, step) => step.pts },
    unlock: { desc: 'Beat the 1st boss on Letter difficulty or above.', event: 'roundWin',
      test: (data, profile, game) => data.bossesThisRun >= 1 && game.difficulty >= 1 } },

  { id: 'rulebook', name: 'The Rulebook', rarity: 'rare', cost: 9, trigger: 'passive',
    desc: 'Every sticker on The Shelf triggers twice.',
    flavor: 'It wrote the rules. It is allowed to read them twice.',
    preScore: (ctx) => { ctx.stickersTwice = true; },
    unlock: { desc: 'Own every kind of sticker at least once.', event: 'sticker',
      test: (data, profile) =>
        Object.keys(CFG.STICKER_WEIGHTS).every((id) => profile.stickersSeen.includes(id)) } },

  { id: 'prequel', name: 'The Prequel', rarity: 'rare', cost: 9, trigger: 'passive',
    desc: "Copies the ability of the Book immediately to its right.",
    flavor: 'It came first, but only after the sequel did well.',
    copiesNeighbor: true,
    unlock: { desc: 'Beat the 4th boss of a run on Letter difficulty or above.', event: 'roundWin',
      test: (data, profile, game) => data.bossesThisRun >= 4 && game.difficulty >= 1 } },

  { id: 'obituary', name: 'The Obituary', rarity: 'rare', cost: 9, trigger: 'word',
    desc: 'Starts at ×1 mult. Every level it destroys another Book at random — and grows +1× when it does.',
    flavor: 'It only ever prints in the past tense.',
    initState: { x: 1 },
    status: (state) => `×${state.x}`,
    // Devours a shelfmate at the start of each level.
    onRoundStartAction: (game, state, self) => {
      const prey = game.books.shelf.filter((b) => b.id !== self.id);
      if (prey.length === 0) return;
      const victim = prey[Math.floor(Math.random() * prey.length)];
      game.books.remove(victim.id);
      state.x += 1;
      game.note(`The Obituary runs ${victim.name} — now ×${state.x}`);
    },
    effect: { xMult: (ctx, step, game, state) => state.x },
    unlock: { desc: 'Beat the 6th boss of a single run.', event: 'roundWin',
      test: (data) => data.bossesThisRun >= 6 } },

  // ===== Not-quite-books (the silly additions; custom cover bases) ======
  { id: 'bitten-book', name: 'The Bitten Book', rarity: 'common', cost: 3, trigger: 'letter',
    desc: 'A, B and C score +5 extra points.',
    flavor: 'Someone took a bite out of the alphabet. Started at the beginning, naturally.',
    when: (ctx, step) => Util.spellsAny(step, 'ABC'),
    effect: { points: 5 } },

  { id: 'bookmark', name: 'The Bookmark', rarity: 'common', cost: 3, trigger: 'word',
    desc: '+20 points on the first word of every round.',
    flavor: 'Always holds your place. Judges you for leaving.',
    when: (ctx, step, game) => game.wordsThisRound === 0,
    effect: { points: 20 } },

  { id: 'coffee-ring', name: 'The Coffee Ring', rarity: 'uncommon', cost: 5, trigger: 'word',
    desc: '×1.5 mult on your last play of the round.',
    flavor: 'Deadline fuel, brewed to a dark roast.',
    when: (ctx, step, game) => game.plays === 1,
    effect: { xMult: 1.5 } },

  { id: 'receipt', name: 'The Receipt', rarity: 'uncommon', cost: 5, trigger: 'word',
    desc: '+1 ticket if the word contains a T.',
    flavor: 'Proof of purchase. The T stands for Ticket. Thank you, come again.',
    when: (ctx) => ctx.word.includes('T'),
    effect: { tickets: 1 } },

  { id: 'quizlet', name: 'Quizlet', rarity: 'uncommon', cost: 6, trigger: 'word',
    desc: '×2 mult on words starting or ending with Y or N.',
    flavor: 'Yes or no? Either way, it studied for this.',
    when: (ctx) => 'YN'.includes(ctx.word[0]) || 'YN'.includes(ctx.word[ctx.word.length - 1]),
    effect: { xMult: 2 },
    unlock: { desc: 'Play 10 Y slugs in one run.', event: 'forge',
      test: (data, profile, game) => game.runYCount >= 10 } },

  { id: 'square-book', name: 'The Square Book', rarity: 'rare', cost: 7, trigger: 'word',
    desc: 'Adds the SQUARE of the highest prime base value among your slugs.',
    flavor: "It's hip to be square. It is not hip to argue whether 1 is prime.",
    when: (ctx) => ctx.tiles.some((t) => [1, 2, 3, 5, 7, 11, 13].includes(t.value)),
    effect: { points: (ctx) => {
      const primes = [1, 2, 3, 5, 7, 11, 13]; // per the house rules, 1 counts
      const best = Math.max(...ctx.tiles.map((t) => (primes.includes(t.value) ? t.value : 0)));
      return best * best;
    } },
    unlock: { desc: 'Reach exactly 100 round score at any moment.', event: 'forge',
      test: (data, profile, game) => game.roundScore === 100 } },

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
    when: (ctx, step) => !Util.spellsAny(step, 'AEIOU'),
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
    unlock: { desc: 'Use a Hellbox Purge.', event: 'destroy',
      test: (data) => data.source === 'purge' } },

  { id: 'hellbox-codex', name: 'Hellbox Codex', rarity: 'uncommon', cost: 6, trigger: 'word',
    desc: '+1 mult for every tile destroyed this run.',
    flavor: 'A ledger of everything melted down.',
    effect: { mult: (ctx, step, game) => game.stats.tilesDestroyed },
    unlock: { desc: 'Destroy 5 tiles (lifetime).', event: 'destroy',
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

  { id: 'book-of-finance', name: 'The Book of Finance', rarity: 'rare', cost: 8, trigger: 'roundWin',
    desc: 'When you clear a level: +1 ticket per 4 tickets you hold (max +10).',
    flavor: 'Compound interest, set in small caps.',
    effect: { tickets: (ctx, step, game) => Math.min(10, Math.floor(Math.max(0, game.tickets) / 4)) },
    // event 'always': tested on every unlock check, whatever caused it.
    unlock: { desc: 'Hold more than 50 tickets at once.', event: 'always',
      test: (data, profile, game) => game.tickets > 50 } },

  { id: 'smelter', name: 'The Smelter', rarity: 'rare', cost: 8, trigger: 'word',
    desc: 'Gains +12 points for every tile destroyed while shelved.',
    flavor: 'Feed it your dead weight; it pays in molten lead.',
    initState: { pts: 0 },
    status: (state) => `+${state.pts} pts`,
    grow: { destroy: (state, data) => { state.pts += 12 * data.n; } },
    effect: { points: (ctx, step, game, state) => state.pts },
    unlock: { desc: 'Destroy 15 tiles (lifetime).', event: 'destroy',
      test: (data, profile) => profile.purgedTiles >= 15 } },

  { id: 'long-gallery', name: 'The Long Gallery', rarity: 'rare', cost: 8, trigger: 'word',
    desc: 'Gains +2 mult each time you forge a word of 7+ letters.',
    flavor: 'Hang the long ones where visitors can see them.',
    initState: { mult: 0 },
    status: (state) => `+${state.mult} mult`,
    grow: { forge: (state, data) => { if (data.word.length >= 7) state.mult += 2; } },
    effect: { mult: (ctx, step, game, state) => state.mult },
    unlock: { desc: 'Forge 5 words of 7+ letters (lifetime).', event: 'forge',
      test: (data, profile) => profile.longWords >= 5 } },

  { id: 'first-edition', name: 'The First Edition', rarity: 'rare', cost: 9, trigger: 'word',
    desc: '×1 mult, growing ×0.5 stronger for every boss defeated while shelved.',
    flavor: 'Value appreciates with every printing it survives.',
    initState: { x: 1 },
    status: (state) => `×${state.x.toFixed(1)}`,
    grow: { roundWin: (state, data) => { if (data.wasBoss) state.x += 0.5; } },
    effect: { xMult: (ctx, step, game, state) => state.x },
    unlock: { desc: 'Defeat 3 bosses (lifetime).', event: 'roundWin',
      test: (data, profile) => profile.bossesBeaten >= 3 } },

  // ===== Expansion set ==================================================
  { id: 'digraph', name: 'The Digraph', rarity: 'uncommon', cost: 5, trigger: 'word',
    desc: '+6 points for each TH, CH, SH, PH, CK, NG or QU in the word.',
    flavor: 'Two letters, one sound, double the ink.',
    effect: { points: (ctx) => {
      const pairs = ['TH', 'CH', 'SH', 'PH', 'CK', 'NG', 'QU'];
      let n = 0;
      for (let i = 0; i < ctx.word.length - 1; i++) {
        if (pairs.includes(ctx.word.substr(i, 2))) n++;
      }
      return 6 * n;
    } },
    unlock: { desc: 'Beat the 2nd boss of a run on Letter difficulty or above.',
      event: 'roundWin',
      test: (data, profile, game) => data.wasBoss && data.bossesThisRun >= 2 && game.difficulty >= 1 } },

  { id: 'kerning', name: 'Kerning', rarity: 'uncommon', cost: 5, trigger: 'word',
    desc: '+5 points for each pair of adjacent letters in alphabetical order (AB, ST).',
    flavor: 'Mind the gap between the letters.',
    effect: { points: (ctx) => {
      let n = 0;
      for (let i = 0; i < ctx.word.length - 1; i++) {
        if (ctx.word.charCodeAt(i + 1) - ctx.word.charCodeAt(i) === 1) n++;
      }
      return 5 * n;
    } },
    unlock: { desc: 'Beat the 2nd boss of a run on Letter difficulty or above.',
      event: 'roundWin',
      test: (data, profile, game) => data.wasBoss && data.bossesThisRun >= 2 && game.difficulty >= 1 } },

  { id: 'abecedarian', name: 'Abecedarian', rarity: 'rare', cost: 8, trigger: 'word',
    desc: '+45 points if the whole word runs in alphabetical order.',
    flavor: 'It learned its letters in order and never forgot.',
    when: (ctx) => {
      const w = ctx.word;
      if (w.length < 3) return false;
      for (let i = 1; i < w.length; i++) if (w[i] < w[i - 1]) return false;
      return true;
    },
    effect: { points: 45 },
    unlock: { desc: 'Play at least one of every letter A–Z within a single round.',
      event: 'forge',
      test: (data, profile, game) => game.roundLetters && game.roundLetters.size >= 26 } },

  { id: 'bodkin', name: 'The Bodkin', rarity: 'rare', cost: 8, trigger: 'letter',
    desc: 'Every slug worth 8 or more points scores ×2 mult.',
    flavor: 'A spike for the heaviest sorts.',
    when: (ctx, step) => step.tile.value >= 8,
    effect: { xMult: 2 },
    unlock: { desc: 'Play 20 slugs worth 8+ points (lifetime).', event: 'forge',
      test: (data, profile) => profile.heavyLettersPlayed >= 20 } },

  { id: 'padlocked-book', name: 'The Padlocked Book', rarity: 'uncommon', cost: 6, trigger: 'letter',
    desc: 'A vowel sitting next to another vowel scores +5 extra points.',
    flavor: 'Two vowels, locked together.',
    when: (ctx, step) => {
      if (!Util.spellsAny(step, 'AEIOU')) return false;
      const t = ctx.tiles, i = step.index;
      const isV = (tile) => tile && 'AEIOU'.includes(tile.letter);
      return isV(t[i - 1]) || isV(t[i + 1]);
    },
    effect: { points: 5 },
    unlock: { desc: 'Defeat the 2nd boss of a run.', event: 'roundWin',
      test: (data) => data.wasBoss && data.bossesThisRun >= 2 } },

  { id: 'almanac', name: 'The Almanac', rarity: 'rare', cost: 8, trigger: 'word',
    desc: '+1 mult for every distinct word you have forged this run.',
    flavor: "Every word you've ever set, filed by the day.",
    effect: { mult: (ctx, step, game) => game.runWords.size },
    unlock: { desc: 'Beat the 2nd boss of a run on Demy difficulty or above.',
      event: 'roundWin',
      test: (data, profile, game) => data.wasBoss && data.bossesThisRun >= 2 && game.difficulty >= 2 } },

  { id: 'business-contract', name: 'The Business Contract', rarity: 'uncommon', cost: 6, trigger: 'word',
    desc: 'While shelved, selling a Book pays 0 tickets — but this gains +4 points every time you sell one.',
    flavor: 'Signed in triplicate. Paid in lead, not coin.',
    initState: { pts: 0 },
    status: (state) => `+${state.pts} pts`,
    grow: { sell: (state) => { state.pts += 4; } },
    effect: { points: (ctx, step, game, state) => state.pts },
    unlock: { desc: 'Buy 50 items from the Foundry (lifetime).', event: 'buy',
      test: (data, profile) => profile.itemsBought >= 50 } },

  { id: 'coupon-book', name: 'The Coupon Book', rarity: 'rare', cost: 8, trigger: 'passive',
    desc: 'Your first purchase in every Foundry visit is free.',
    flavor: 'Clip along the dotted line. One on the house.',
    unlock: { desc: 'Buy 100 items from the Foundry (lifetime).', event: 'buy',
      test: (data, profile) => profile.itemsBought >= 100 } },

  { id: 'spellbook', name: 'The Spellbook', rarity: 'rare', cost: 9, trigger: 'passive',
    desc: 'Every slug with a material but no text alteration retriggers.',
    flavor: 'The unmarked sorts know the words by heart.',
    preScore: (ctx) => { ctx.retriggerPlain = true; },
    unlock: { desc: 'Beat the 3rd boss of a run on Demy difficulty or above.',
      event: 'roundWin',
      test: (data, profile, game) => data.bossesThisRun >= 3 && game.difficulty >= 2 } },

  { id: 'magazine', name: 'The Magazine', rarity: 'rare', cost: 8, trigger: 'passive',
    desc: 'While shelved, Bestseller Stickers give ×2 mult instead of ×1.5.',
    flavor: "This week's bestseller, marked up.",
    preScore: (ctx) => { ctx.bestsellerBoost = true; },
    unlock: { desc: 'Use 10 pens within a single run.', event: 'pen',
      test: (data, profile, game) => game.runPensUsed >= 10 } },

  { id: 'censored-edition', name: 'The Censored Edition', rarity: 'rare', cost: 8, trigger: 'word',
    desc: '×2 mult on every word — but the letter E scores 0 points.',
    flavor: 'Every E struck through in heavy black.',
    effect: { xMult: 2 },
    // Zero E on the silent letter-rule channel (after the slug's own material /
    // alteration), so an E genuinely scores nothing.
    letterRule: (ctx, step) => { if (step.tile.letter === 'E') step.pts = 0; },
    unlock: { desc: 'Beat the 3rd boss of a run using the Archaic Case.',
      event: 'roundWin',
      test: (data, profile, game) => data.bossesThisRun >= 3 && game.deckDef.id === 'archaic' } },

  { id: 'insurance-form', name: 'The Insurance Form', rarity: 'rare', cost: 13, trigger: 'passive',
    desc: 'Costs extra. If your final play still falls short of the goal, it tops you up by 25% of the goal — then is destroyed. Buy it again anytime.',
    flavor: 'Read the fine print. There is always fine print.',
    lastResort: { fraction: 0.25 },
    unlock: { desc: 'Buy 150 items from the Foundry (lifetime).', event: 'buy',
      test: (data, profile) => profile.itemsBought >= 150 } },

  { id: 'the-switch', name: 'The Switch', rarity: 'uncommon', cost: 5, trigger: 'passive',
    desc: 'For spelling, any C may be read as a K — and any K as a C.',
    flavor: 'C or K? The compositor flips a coin.',
    substitute: { C: ['K'], K: ['C'] },
    unlock: { desc: 'Buy a Peculiar Case from the Foundry.', event: 'bag',
      test: (data) => data.bagId === 'peculiars' } },

  { id: 'empty-book', name: 'The Empty Book', rarity: 'uncommon', cost: 6, trigger: 'letter',
    desc: 'Each blank (_) slug scores the base points of the letter it stands in for.',
    flavor: 'Blank metal, suddenly worth its weight.',
    when: (ctx, step) => { const sp = SPECIAL_SLUGS[step.tile.letter]; return !!(sp && sp.wild); },
    effect: { points: (ctx, step) => CFG.TILE_VALUES[step.spells] || 0 },
    unlock: { desc: 'Forge a word using 2 or more multi-letter sorts.', event: 'forge',
      test: (data) => (data.multiSorts || 0) >= 2 } },
];

// --- Starting cases (Balatro-style decks) ---------------------------------
// Picked at run start. `dist: null` = the standard CFG.STARTING_DECK.
// `seedStyled` pre-casts that many random slugs with a variant/alteration.
// `mods` bend the run: startTickets once, plays/rerolls per round.
// Unlocks persist in the profile like Books. Icons: #icon-deck-<id>.

const DECKS = [
  { id: 'standard', name: 'The Standard Case', icon: 'icon-deck-standard',
    desc: 'The house distribution — 94 slugs, vowel-forward, dependable.',
    dist: null },

  { id: 'pamphlet', name: 'The Pamphlet Case', icon: 'icon-deck-pamphlet',
    desc: 'Just 70 slugs. Thin, quick, consistent — your best letters come around far more often.',
    dist: {
      A: 6, E: 7, I: 4, O: 5, U: 3,
      B: 2, C: 2, D: 3, F: 2, G: 2, H: 2, J: 1, K: 1, L: 3, M: 2,
      N: 4, P: 2, Q: 1, R: 4, S: 4, T: 4, V: 1, W: 1, X: 1, Y: 2, Z: 1,
    },
    unlock: { desc: 'Clear level 8 in any run.', event: 'roundWin',
      test: (data, profile, game) => game.level >= 8 } },

  { id: 'gilded', name: 'The Gilded Case', icon: 'icon-deck-gilded',
    desc: 'The standard case, but six slugs arrive pre-cast with variants or alterations.',
    dist: null, seedStyled: 6,
    unlock: { desc: 'Cast 10 styled slugs from bags (lifetime).', event: 'bagcast',
      test: (data, profile) => profile.styledCast >= 10 } },

  { id: 'archaic', name: 'The Archaic Case', icon: 'icon-deck-archaic',
    desc: 'Not a single E in the case — but the heavy antique sorts run double, and vowels lean rich.',
    dist: {
      A: 9, E: 0, I: 8, O: 8, U: 5,
      B: 3, C: 3, D: 4, F: 3, G: 3, H: 3, J: 2, K: 3, L: 4, M: 3,
      N: 5, P: 3, Q: 2, R: 5, S: 5, T: 5, V: 3, W: 3, X: 2, Y: 4, Z: 2,
    },
    unlock: { desc: 'Defeat The Censor.', event: 'roundWin',
      test: (data) => data.bossId === 'the-censor' } },

  { id: 'jobbing', name: 'The Jobbing Case', icon: 'icon-deck-jobbing',
    desc: 'Standard slugs and a working wage: start with 6 tickets, but every round gives 1 fewer reroll.',
    dist: null, mods: { startTickets: 6, rerolls: -1 },
    unlock: { desc: 'Fire the reroll tray 30 times (lifetime).', event: 'reroll',
      test: (data, profile) => profile.rerollsUsed >= 30 } },
];

// --- Stickers (corner marks on shop Books) ---------------------------------
// Rolled onto shop Book offers (CFG.STICKER_CHANCE / STICKER_WEIGHTS).
// Scoring stickers fire in the WORD phase, at the Book's shelf position,
// just before that Book's own word effect (or exactly where it would have
// been, for letter/economy Books). costDelta adjusts the shop price;
// removedOnBuy stickers don't survive the purchase; noSlot Books don't
// count toward the shelf limit. Icons: #icon-sticker-<id>.

const STICKERS = {
  present: { id: 'present', name: 'Present Sticker',
    desc: '+5 points on every word.', effect: { points: 5 } },
  discount: { id: 'discount', name: 'Discount Sticker',
    desc: '-1 cost. Removed on buy.', costDelta: -1, removedOnBuy: true },
  signature: { id: 'signature', name: 'Signature Sticker',
    desc: '+10 mult on every word.', effect: { mult: 10 } },
  donated: { id: 'donated', name: 'Donated Sticker',
    desc: "Doesn't count toward your shelf limit.", noSlot: true },
  bestseller: { id: 'bestseller', name: 'Bestseller Sticker',
    desc: '×1.5 mult on every word!', effect: { xMult: 1.5 } },
  lamination: { id: 'lamination', name: 'Lamination Sticker',
    desc: "Retriggers the Book's ability.", retrigger: true },
};

// --- Pens (the Foundry's pen pack) -----------------------------------------
// Buying a pack pulls CFG.PEN_TILE_PULLS random tiles from your bag and
// offers CFG.PEN_CHOICES pens; pick one of each. Alteration pens rewrite the
// tile's alteration; variant pens recast its material — replacing whatever
// was there. `ink` colors the pen's nib art.

const PENS = [
  { id: 'pen-red', name: 'The Red Pen', alteration: 'red', ink: 'var(--press-red)' },
  { id: 'pen-comic', name: "The Jester's Pen", alteration: 'comic', ink: '#8e6bbf' },
  { id: 'pen-bold', name: 'The Broad Nib', alteration: 'bold', ink: '#3a3a40' },
  { id: 'pen-italic', name: 'The Slant Pen', alteration: 'italic', ink: '#4a6a8a' },
  { id: 'pen-underline', name: 'The Underscore', alteration: 'underline', ink: '#2f7d68' },
  { id: 'pen-paper', name: "The Papermaker's Pen", variant: 'paper', ink: '#b3a577' },
  { id: 'pen-wood', name: 'The Woodcut Pen', variant: 'woodblock', ink: '#6b4a2a' },
  { id: 'pen-stone', name: "The Mason's Pen", variant: 'cornerstone', ink: '#71767c' },
  { id: 'pen-braze', name: "The Brazier's Pen", variant: 'ligature', ink: 'var(--verdigris)' },
  { id: 'pen-deckle', name: 'The Deckle Pen', variant: 'deckle', ink: '#c9bd9f' },
  // Rare pens (weighted low in the pack) — the only source of rare styles.
  { id: 'pen-double', name: 'The Double-Tipped Pen', alteration: 'fuzzy',
    ink: '#9a86c9', icon: 'icon-pen-double', rare: true },
  { id: 'pen-highlighter', name: 'The Highlighter', alteration: 'highlight',
    ink: '#e0cb2d', icon: 'icon-pen-highlighter', rare: true },
  { id: 'pen-rough', name: 'The Rough Pen', variant: 'cardstock',
    ink: '#c77b3a', icon: 'icon-pen-rough', rare: true },
];

// --- Imperial bosses --------------------------------------------------------
// The 5th difficulty draws from this pool once it has entries (falls back to
// BOSSES while empty). Same hook contract as BOSSES.

const BOSSES_IMPERIAL = [];

// --- Bosses (blind-style rule modifiers, every 6th level) ----------------
// Equal-weight debuffs, each bending a different aspect of play. Picked at
// random per boss round (never the same twice in a row). Hook contract:
//   letterHook(ctx, step, game, state) — priority 100, lands AFTER Books
//   wordHook(ctx, game, state)         — same
//   validWord(word)                    — extra dictionary-level constraint
//   validPlay(game, state)             — constraint on the composed stick
//   onRoundStart(game, state)          — set up per-round boss state
//   onDraw(game, state)                — after every draw-to-full (round
//                                        start and each forge refill)
//   afterForge(game, playedTiles, state) — touch the played tiles before
//                                        they cycle to the hellbox
//   playsDelta / rerollsDelta / handDelta — economy bends
// Every boss has an SVG seal in index.html's sprite: #icon-boss-<id>.

const BOSSES = [

  { id: 'vowel-void', name: 'The Vowel Void', icon: 'icon-boss-vowel-void',
    desc: 'Vowels (excluding Y) score 0 points.',
    letterHook: (ctx, step) => { if ('AEIOU'.includes(step.tile.letter)) step.pts = 0; } },

  { id: 'leaden-mult', name: 'The Leaden Mult', icon: 'icon-boss-leaden-mult',
    // A FLAT cap doesn't scale: by level 24 a ×5 ceiling demanded ~1,100 base
    // points, which no board produces. Halving is proportional — it hurts
    // exactly as much late as early, like every other boss rule.
    desc: 'Mult is halved (minimum ×1).',
    wordHook: (ctx) => { ctx.mult = Math.max(1, ctx.mult / 2); } },

  { id: 'fine-print', name: 'The Fine Print', icon: 'icon-boss-fine-print',
    desc: 'Words under 5 letters are invalid.',
    validWord: (word) => word.length >= 5 },

  { id: 'the-smudge', name: 'The Smudge', icon: 'icon-boss-the-smudge',
    desc: 'Letters worth 4+ points score 0.',
    letterHook: (ctx, step) => { if (step.tile.value >= 4) step.pts = 0; } },

  { id: 'the-miser', name: 'The Miser', icon: 'icon-boss-the-miser',
    desc: 'One fewer play this round.',
    playsDelta: -1 },

  { id: 'the-ration', name: 'The Ration', icon: 'icon-boss-the-ration',
    desc: 'No rerolls this round.',
    rerollsDelta: -99 }, // clamped to 0 by the game

  { id: 'the-assessor', name: 'The Assessor', icon: 'icon-boss-the-assessor',
    desc: 'Every letter worth more than 3 points costs you 1 ticket when played.',
    // Commit-gated: previews must not tax. Tickets may go negative.
    letterHook: (ctx, step, game) => {
      if (ctx.commit && step.tile.value > 3) game.tickets -= 1;
    } },

  { id: 'the-censor', name: 'The Censor', icon: 'icon-boss-the-censor',
    desc: 'Words containing the letter E are invalid.',
    validWord: (word) => !word.includes('E') },

  { id: 'the-foreman', name: 'The Foreman', icon: 'icon-boss-the-foreman',
    desc: 'Each play, one tile is demanded: your word must include it, and it cannot be rerolled.',
    onDraw: (game, state) => {
      const pool = game.rack;
      state.mustId = pool.length ? pool[Math.floor(Math.random() * pool.length)].id : null;
    },
    validPlay: (game, state) =>
      state.mustId == null || game.stick.some((t) => t.id === state.mustId) },

  { id: 'the-short-case', name: 'The Short Case', icon: 'icon-boss-the-short-case',
    desc: 'Your hand holds only 10 tiles this round.',
    handDelta: -2 },

  { id: 'the-crucible', name: 'The Crucible', icon: 'icon-boss-the-crucible',
    desc: 'Each play, one random tile from your word is destroyed forever.',
    afterForge: (game, played) => {
      if (played.length === 0) return;
      const gone = played.splice(Math.floor(Math.random() * played.length), 1);
      game.destroyTiles(gone, 'boss');
    } },

  { id: 'the-gatekeeper', name: 'The Gatekeeper', icon: 'icon-boss-the-gatekeeper',
    desc: 'Two slots on the stick are cursed: letters there score 0 points unless they are vowels.',
    onRoundStart: (game, state) => {
      const a = Math.floor(Math.random() * CFG.STICK_SLOTS);
      let b = Math.floor(Math.random() * (CFG.STICK_SLOTS - 1));
      if (b >= a) b++;
      state.spots = [a, b];
    },
    letterHook: (ctx, step, game, state) => {
      if (state.spots.includes(step.index) && !'AEIOU'.includes(step.tile.letter)) step.pts = 0;
    } },
];

// --- Consumables ----------------------------------------------------------
// Single-use items. use(game) returns false to signal "couldn't be used"
// (the item is not consumed in that case).

// Every sundry is a printer's SLIP — a torn paper docket. `weight` sets how
// often it appears in the shop; `icon` names its SVG in index.html's sprite.
// use(game) returns false when it couldn't apply (the slip is NOT spent), or
// optionally a string to toast.

const CONSUMABLES = [

  { id: 'proofing-ink', name: 'Proofing Ink', cost: 3, weight: 10, icon: 'icon-slip-ink',
    desc: '+1 reroll this round.',
    use: (game) => { game.rerolls++; } },

  { id: 'overtime-slip', name: 'Overtime Slip', cost: 4, weight: 10, icon: 'icon-slip-overtime',
    desc: '+1 play this round.',
    use: (game) => { game.plays++; } },

  { id: 'hellbox-purge', name: 'Hellbox Purge', cost: 4, weight: 10, icon: 'icon-slip-purge',
    desc: 'Destroy the slugs in your reroll tray — gone from the deck forever.',
    use: (game) => game.purgeTray() },

  { id: 'pulp-slip', name: 'Pulp Slip', cost: 4, weight: 8, icon: 'icon-slip-pulp',
    desc: 'Recasts a random slug in your hand as Paper (double points, one use).',
    use: (game) => {
      const t = game.styleRandomHandTile({ variant: 'paper' });
      return t ? `${t.letter} recast in Paper` : false;
    } },

  { id: 'ink-slip', name: 'Ink Slip', cost: 5, weight: 8, icon: 'icon-slip-inkblot',
    desc: 'Scrawls a random text alteration onto a random slug in your hand.',
    use: (game) => {
      const t = game.styleRandomHandTile({ alteration: Util.randomKey(ALTERATIONS, true) });
      return t ? `${t.letter} inked ${ALTERATIONS[t.alteration].name}` : false;
    } },

  { id: 'vowel-slip', name: 'The Vowel Slip', cost: 4, weight: 8, icon: 'icon-slip-vowel',
    desc: 'Turns up to 2 slugs in your reroll tray: every A becomes an E, every E becomes an A.',
    use: (game) => game.swapTrayVowels() },

  { id: 'sticker-slip', name: 'Sticker', cost: 10, weight: 3, icon: 'icon-slip-sticker',
    desc: 'Slaps a random sticker onto a random Book that has none.',
    use: (game) => {
      const res = game.books.stickRandom();
      return res ? `${res.sticker.name} stuck to ${res.book.name}` : false;
    } },

  { id: 'typewriter', name: 'The Typewriter', cost: 20, weight: 1, rare: true,
    icon: 'icon-slip-typewriter',
    desc: 'Reads every word your hand can spell, picks the highest-scoring one, and sets it on the stick for you.',
    use: (game) => {
      const word = game.autoCompose();
      return word ? `The Typewriter sets ${word}` : false;
    } },
];

// --- SPECIAL SLUGS (the sorts that aren't plain letters) ------------------
// A slug's `spells` is what it contributes to the SPELLING; the glyph on its
// face is the key. Multi-letter sorts spell several letters but still trigger
// ONCE, scoring their combined value. `wild: true` spells any single letter.
// Longer spellings mean a longer word, which means more mult.

const SPECIAL_SLUGS = {
  'Œ': { spells: 'CE', value: 4, name: 'Ethel', tip: 'A C and an E, cast as one sort.' },
  'Æ': { spells: 'AE', value: 2, name: 'Ash', tip: 'An A and an E, cast as one sort.' },
  '&': { spells: 'AND', value: 4, name: 'Ampersand', tip: 'Spells AND — three letters from one slug.' },
  'ß': { spells: 'SS', value: 2, name: 'Eszett', tip: 'The double-S, cast as one sort.' },
  '!': { spells: 'I', value: 10, name: 'Bang', tip: 'An I anywhere — and a heavy one.' },
  '@': { spells: 'A', value: 5, name: 'At', tip: 'An A, worth rather more than an A.' },
  '№': { spells: 'NO', value: 2, name: 'Numero', tip: 'Spells NO.' },
  '_': { spells: null, wild: true, value: 0, name: 'Quad', tip: 'Blank metal: any letter at all, worth nothing.' },
};

const ALL_LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];

// What a slug contributes to the spelling (its glyph, or its expansion).
function slugSpells(letter) {
  const s = SPECIAL_SLUGS[letter];
  return s ? s.spells : letter;
}

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
  cardstock: {
    id: 'cardstock', name: 'Cardstock', cls: 'v-cardstock', rare: true,
    desc: '+1 ticket every time it scores.',
    ticket: 1, // paid by the engine on trigger (retriggers pay again)
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
  highlight: {
    id: 'highlight', name: 'Highlighted', cls: 'a-highlight', rare: true,
    desc: '×1.5 mult when scored.',
    xMult: 1.5, // sequenced by the engine after the tile's additive mult
  },
  fuzzy: {
    id: 'fuzzy', name: 'Fuzzy', cls: 'a-fuzzy', rare: true,
    desc: 'Prints double — the whole letter scores again (retrigger).',
    retrigger: true, // the engine replays the letter's full pass
  },
};

// --- Tile BAGS (what the shop sells instead of single letters) ------------
// Buying a bag rolls `options` candidate tiles from its weighted `pool`
// string (repeated letters = higher odds); the player KEEPS CFG.BAG_PICKS
// of them via the selection screen. Every candidate rolls the bag's `style`
// chances for a variant and/or alteration (independently — both can land).
// `icon` names the SVG symbol in index.html's sprite.

const BAGS = [
  { id: 'vowel', name: 'Vowel Sack', cost: 4, options: 5, icon: 'icon-vowel',
    rarity: 'common', pool: 'AAAEEEIIOOU',
    style: { variant: 0.12, alteration: 0.12 },
    desc: 'Pick 3 of 5 vowels — keeps words formable.' },

  { id: 'consonant', name: 'Consonant Sack', cost: 4, options: 5, icon: 'icon-consonant',
    rarity: 'common', pool: 'NNRRSSTTLLCDPMGBH',
    style: { variant: 0.12, alteration: 0.12 },
    desc: 'Pick 3 of 5 common consonants.' },

  { id: 'suffix', name: 'Suffix Case', cost: 5, options: 6, icon: 'icon-suffix',
    rarity: 'uncommon', pool: 'EEDDRSSTGNGYILN',
    style: { variant: 0.15, alteration: 0.15 },
    desc: 'Pick 3 of 6 word-enders — the makings of -ING, -ED, -ER, -EST.' },

  { id: 'latin', name: 'Latin Case', cost: 5, options: 6, icon: 'icon-latin',
    rarity: 'uncommon', pool: 'CCIILVXMTUSAER',
    style: { variant: 0.15, alteration: 0.15 },
    desc: 'Pick 3 of 6 classical letters — C, I, V, X, M, L lean.' },

  { id: 'science', name: 'Lab Case', cost: 6, options: 6, icon: 'icon-science',
    rarity: 'uncommon', pool: 'OOXYGNHPSCKZ',
    style: { variant: 0.18, alteration: 0.18 },
    desc: 'Pick 3 of 6 technical letters, skewed toward high value.' },

  { id: 'sorts', name: 'Sorts Tray', cost: 9, options: 6, icon: 'icon-sorts',
    rarity: 'rare', pool: 'EAIORNSTLDUCMPBG',
    style: { variant: 0.65, alteration: 0.65 },
    desc: 'Pick 3 of 6 slugs cast with heavy variant & alteration odds.' },

  // The peculiar sorts: ligatures, wildcards and punctuation that spell.
  { id: 'peculiars', name: 'The Peculiar Case', cost: 12, options: 3, picks: 2,
    icon: 'icon-peculiars', rarity: 'rare', pool: Object.keys(SPECIAL_SLUGS).join(''),
    style: { variant: 0.2, alteration: 0.2 },
    desc: 'Pick 2 of 3 peculiar sorts — ligatures, blanks and marks that spell.' },
];

// --- Achievements ----------------------------------------------------------
// A cosmetic progress layer (see js/achievements.js). Each entry pops up in the
// corner the first time its `test` passes on the matching `event`. Earned state
// persists to its own localStorage key — the game rules never read it.
//   icon  — a #icon-ach-* sprite (index.html).
//   event — 'forge' {word,total,mult,repeat} | 'roundWin' {wasBoss,bossesThisRun}
//         | 'reroll' | 'destroy' {n} | 'sticker' | 'runEnd' | 'always'.
//   test  — (data, game) => boolean; runs after the lifetime profile updates,
//           so it may read game.unlocks.profile counters and live game state.

const ACHIEVEMENTS = [
  { id: 'first-word', icon: 'icon-ach-quill', title: 'Set the First Line',
    desc: 'Forge your first word.', event: 'forge', test: () => true },

  { id: 'seven-letters', icon: 'icon-ach-quill', title: 'Broadsheet',
    desc: 'Forge a word of 7 or more letters.', event: 'forge',
    test: (d) => !!d.word && d.word.length >= 7 },

  { id: 'full-measure', icon: 'icon-ach-quill', title: 'Full Measure',
    desc: 'Forge an 11-letter word.', event: 'forge',
    test: (d) => !!d.word && d.word.length >= 11 },

  { id: 'all-vowels', icon: 'icon-ach-star', title: 'A, E, I, O and U',
    desc: 'Forge a word containing every vowel.', event: 'forge',
    test: (d) => !!d.word && [...'AEIOU'].every((v) => d.word.includes(v)) },

  { id: 'vowelless', icon: 'icon-ach-star', title: 'Dry Type',
    desc: 'Forge a word of 3+ letters with no vowels.', event: 'forge',
    test: (d) => !!d.word && d.word.length >= 3 && ![...d.word].some((c) => 'AEIOU'.includes(c)) },

  { id: 'off-the-stone', icon: 'icon-ach-flame', title: 'Off the Stone',
    desc: 'Score 500 or more on a single word.', event: 'forge',
    test: (d) => (d.total || 0) >= 500 },

  { id: 'red-hot', icon: 'icon-ach-flame', title: 'Red Hot',
    desc: 'Reach ×25 mult on a single word.', event: 'forge',
    test: (d) => (d.mult || 0) >= 25 },

  { id: 'first-boss', icon: 'icon-ach-medal', title: 'Blind Broken',
    desc: 'Defeat your first boss.', event: 'roundWin', test: (d) => !!d.wasBoss },

  { id: 'press-run', icon: 'icon-ach-medal', title: 'Press Run',
    desc: 'Beat the 3rd boss in a single run.', event: 'roundWin',
    test: (d) => (d.bossesThisRun || 0) >= 3 },

  { id: 'second-edition', icon: 'icon-ach-book', title: 'Second Edition',
    desc: 'Reach level 12 in a run.', event: 'roundWin',
    test: (d, game) => game.level >= 12 },

  { id: 'solvent', icon: 'icon-ach-coin', title: 'Solvent',
    desc: 'Hold 100 tickets at once.', event: 'always',
    test: (d, game) => game.tickets >= 100 },

  { id: 'to-the-hellbox', icon: 'icon-ach-flame', title: 'To the Hellbox',
    desc: 'Melt a slug out of your deck for good.', event: 'destroy',
    test: (d) => (d.n || 0) > 0 },

  { id: 'spoiled', icon: 'icon-ach-star', title: 'Spoiled for Choice',
    desc: 'Land your first sticker.', event: 'sticker', test: () => true },

  { id: 'prolific', icon: 'icon-ach-book', title: 'Prolific',
    desc: 'Forge 100 words (lifetime).', event: 'forge',
    test: (d, game) => game.unlocks.profile.wordsForged >= 100 },
];
