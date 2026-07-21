// game.js — run state and the rules of play. Owns the rack, stick, and
// reroll tray; enforces plays/rerolls, level targets, boss modifiers,
// tickets, and consumables. All actual score math is delegated to
// ScoringEngine (the choke point).

class Game {

  constructor(dictionary) {
    this.dict = dictionary;
    this.scoring = new ScoringEngine();
    this.books = new BookManager(this);
    this.unlocks = new Unlocks(this);
    this.achievements = new Achievements(this);
    this.newUnlocks = []; // Books earned this session, queued for the UI to announce
    this.newAchievements = []; // achievements earned this session, queued for the UI
    this.pendingNotes = []; // one-off messages for the UI to toast (Sticky Note, ...)
    this.newRun();
  }

  // Fan a play event out to BOTH progress trackers (unlocks first, so its
  // lifetime counters are fresh when achievement tests read them), queueing
  // anything freshly earned for the UI to announce. Every place that used to
  // call unlocks.notify directly goes through here now.
  progress(event, data = {}) {
    this.newUnlocks.push(...this.unlocks.notify(event, data));
    this.newAchievements.push(...this.achievements.notify(event, data));
  }

  // --- Run / round lifecycle -----------------------------------------

  // Start a fresh run with the given starting case and difficulty (falls
  // back to the profile's last picks, then standard / Note).
  newRun(deckId, difficulty) {
    // Count the run being left behind, but only if it was actually played —
    // so booting up and picking a case doesn't burn a run.
    if (this.stats && this.stats.wordsForged > 0) {
      this.progress('runEnd', {});
    }
    this.deckDef = DECKS.find((d) => d.id === (deckId || this.unlocks.profile.lastDeck))
      || DECKS[0];
    this.difficulty = difficulty != null ? difficulty
      : (this.unlocks.profile.lastDifficulty || 0);
    this.level = 1;
    this.deck = new Deck(this.deckDef.dist || CFG.STARTING_DECK); // fresh pool per run
    // The Gilded Case: pre-cast some slugs with a variant or alteration
    // (never the pen-only rare styles).
    for (let i = 0; i < (this.deckDef.seedStyled || 0); i++) {
      const t = this.deck.all[Math.floor(Math.random() * this.deck.all.length)];
      if (Math.random() < 0.5) t.variant = Util.randomKey(VARIANTS, true);
      else t.alteration = Util.randomKey(ALTERATIONS, true);
    }
    this.tickets = (this.deckDef.mods && this.deckDef.mods.startTickets) || 0;
    this.books.clear();
    this.consumables = [];
    this.lastBossId = null;
    this.runWords = new Set(); // every word forged this run (Errata's unlock)
    this.runYCount = 0;        // Y slugs played this run (Quizlet's unlock)
    this.bossesThisRun = 0;    // how deep this run has gone (boss-depth unlocks)
    this.endless = false;      // set once the WIN_BOSSES-th boss is beaten and the
                               // player chooses to carry on past the win screen
    this.bookOutput = {};      // book id -> cumulative raw score it added this run
                               // (drives the win screen's "most valuable Book")
    this.rerollCost = CFG.RESTOCK_COST; // shop-reroll price; climbs per reroll, partly
                                        // persists between shops (see decayRerollCost)
    this.bin = null;           // a single Book stashed out of play (see binPark);
    this.binState = null;      // its scaling state + sticker are kept safe with it
    this.binSticker = null;
    this.stats = {
      wordsForged: 0, bestWord: '—', bestScore: 0,
      bossesBeaten: 0, ticketsEarnedTotal: 0, tilesDestroyed: 0,
    };
    this.startRound();
  }

  // Queue a message for the UI to toast on its next render.
  note(msg) {
    this.pendingNotes.push(msg);
  }

  // Single funnel for permanent tile destruction (purge, Paper, The Crucible):
  // updates stats, feeds scaling Books, and fires unlock checks.
  destroyTiles(tiles, source) {
    if (tiles.length === 0) return;
    this.deck.destroy(tiles);
    this.stats.tilesDestroyed += tiles.length;
    // `tiles` rides along so Books can inspect what was broken (The Shredded
    // Book counts Paper slugs specifically).
    this.books.dispatchGrow('destroy', { n: tiles.length, source, tiles });
    this.progress('destroy', { n: tiles.length, source, tiles });
  }

  startRound() {
    this.clearBoss();
    this.deck.reset(); // every tile back in the bag, fresh shuffle
    this.stick = [];
    this.tray = [];
    this.handSize = CFG.RACK_SIZE;
    this.plays = CFG.PLAYS_PER_ROUND;
    this.rerolls = CFG.REROLLS_PER_ROUND;
    // Starting-case round mods (The Jobbing Case's -1 reroll, etc.)
    if (this.deckDef.mods) {
      this.plays += this.deckDef.mods.plays || 0;
      this.rerolls += this.deckDef.mods.rerolls || 0;
    }
    this.roundScore = 0;
    this.roundLongest = 0;
    this.lastTicketsEarned = 0;
    this.lastPayout = [];
    this.wordsThisRound = 0; // Second Impression reads this while scoring
    this.lastWord = null;    // previous word this round (Errata reads it)
    this.roundRerolledA = 0; // A slugs rerolled this level (The Textbook's unlock)
    if (this.isBossLevel) this.applyBoss(); // boss bends economy (and handSize) first
    this.rack = this.deck.draw(this.handSize);
    if (this.boss && this.boss.onDraw) this.boss.onDraw(this, this.bossState);
    this.books.onRoundStart();              // roundStart Books apply last
    this.plays = Math.max(1, this.plays);   // Incunabula etc. can't zero you out
    this.rerolls = Math.max(0, this.rerolls);
    this.state = 'playing'; // 'playing' | 'roundWon' | 'gameOver'
  }

  nextLevel() {
    this.level++;
    this.startRound();
  }

  // Score target for the current level. Normal play (levels 1 .. BOSS_EVERY ×
  // WIN_BOSSES) runs the sectioned DELTA/DD curve; beyond the winning boss the
  // Endless multiplier model takes over. Both round to 2 significant figures.
  get target() {
    const lastNormal = CFG.BOSS_EVERY * CFG.WIN_BOSSES;
    return this.level <= lastNormal
      ? this._normalTarget(this.level)
      : this._endlessTarget(this.level, lastNormal);
  }

  // The sectioned raw curve: within a section the increment starts at DELTA and
  // grows by DD per round; between sections the start is the prior boss target ×
  // BOSS_MULT, and DELTA/DD grow by their _GROWTH amounts. Difficulty scales the
  // whole delta system. Rounded to 2 significant figures as the final step.
  _normalTarget(level) {
    const T = CFG.TARGET;
    const f = CFG.DIFFICULTIES[this.difficulty || 0].mult;
    const section = Math.floor((level - 1) / CFG.BOSS_EVERY); // 0-based
    const round = (level - 1) % CFG.BOSS_EVERY;               // 0-based

    // Walk prior sections in raw space to find this section's start.
    let start = T.START;
    for (let s = 0; s < section; s++) {
      const delta = (T.DELTA + T.DELTA_GROWTH * s) * f;
      const dd = (T.DD + T.DD_GROWTH * s) * f;
      const n = CFG.BOSS_EVERY - 1;
      const bossRaw = start + n * delta + dd * (n * (n - 1) / 2);
      start = bossRaw * T.BOSS_MULT;
    }

    const delta = (T.DELTA + T.DELTA_GROWTH * section) * f;
    const dd = (T.DD + T.DD_GROWTH * section) * f;
    const raw = start + round * delta + dd * (round * (round - 1) / 2);
    return Util.sig2(raw);
  }

  // Endless: starting from the winning-boss requirement, each level multiplies
  // the requirement by a multiplier that itself grows every level (DELTA and DD
  // gone multiplicative); an Endless boss multiplies by BOSS_BONUS + that
  // multiplier. Computed fresh from level so it stays a pure getter.
  _endlessTarget(level, lastNormal) {
    const E = CFG.ENDLESS;
    let req = this._normalTarget(lastNormal);
    let dm = E.DELTA_MULT;
    for (let L = lastNormal + 1; L <= level; L++) {
      req *= (L % CFG.BOSS_EVERY === 0) ? (E.BOSS_BONUS + dm) : dm;
      dm += E.DELTA_MULT_GROWTH;
    }
    return Util.sig2(req);
  }

  get isBossLevel() {
    return this.level % CFG.BOSS_EVERY === 0;
  }

  // The shop opens after clearing every SHOP_EVERYth level.
  get shopDue() {
    return this.level % CFG.SHOP_EVERY === 0;
  }

  // Called when a new shop opens: the reroll price relaxes back toward its base,
  // but a cost that climbed past RESTOCK_STICKY only decays part-way (it stays
  // elevated), so serial rerollers keep paying a premium for a while.
  decayRerollCost() {
    this.rerollCost = this.rerollCost > CFG.RESTOCK_STICKY
      ? Math.max(CFG.RESTOCK_FLOOR, this.rerollCost - CFG.RESTOCK_DECAY)
      : CFG.RESTOCK_COST;
  }

  // --- The Bin: a one-slot stash for a Book, worked between rounds ----------
  // Park a shelf Book into the (empty) Bin, keeping its scaling state and
  // sticker safe; it stops scoring and frees its shelf slot until retrieved.
  binPark(bookId) {
    if (this.bin) return false; // one at a time
    const def = this.books.shelf.find((b) => b.id === bookId);
    if (!def) return false;
    this.binState = this.books.state[def.id] || null;
    this.binSticker = this.books.stickers[def.id] || null;
    this.books.remove(bookId); // off the shelf (this also drops its state/sticker)
    this.bin = def;
    return true;
  }

  // Bring the stashed Book back onto the shelf (if there's room), restoring
  // exactly the state and sticker it went in with.
  binRetrieve() {
    if (!this.bin || this.books.isFull) return false;
    const def = this.bin;
    if (!this.books.add(def)) return false;
    if (this.binSticker) this.books.stickers[def.id] = this.binSticker;
    if (this.binState) this.books.state[def.id] = this.binState;
    this.books.syncHooks(); // the restored sticker may add a word-phase rider
    this.bin = null; this.binState = null; this.binSticker = null;
    return true;
  }

  // Sell a held consumable back — slips refund little (mostly 1 ticket).
  sellConsumable(index) {
    const def = this.consumables[index];
    if (!def) return false;
    this.consumables.splice(index, 1);
    this.tickets += Math.max(1, Math.floor((def.cost || 0) * CFG.SELL_FACTOR));
    return true;
  }

  // --- Boss modifiers ---------------------------------------------------

  applyBoss() {
    // Imperial difficulty draws its own boss pool once it has entries.
    const roster = (this.difficulty === 4 && BOSSES_IMPERIAL.length > 0)
      ? BOSSES_IMPERIAL : BOSSES;
    const noRepeat = roster.filter((b) => b.id !== this.lastBossId);
    const pool = noRepeat.length ? noRepeat : roster;
    this.boss = pool[Math.floor(Math.random() * pool.length)];
    this.lastBossId = this.boss.id;
    this.bossState = {}; // per-round boss scratch (cursed spots, demanded tile, ...)
    this.bossUnregs = [];
    this.reapplyBossHooks(); // register the letter/word rules on the choke point
    this.plays = Math.max(1, this.plays + (this.boss.playsDelta || 0));
    this.rerolls = Math.max(0, this.rerolls + (this.boss.rerollsDelta || 0));
    this.handSize += this.boss.handDelta || 0;
    if (this.boss.onRoundStart) this.boss.onRoundStart(this, this.bossState);
  }

  clearBoss() {
    (this.bossUnregs || []).forEach((un) => un());
    this.bossUnregs = [];
    this.boss = null;
    this.bossState = null;
  }

  // Register the boss's scoring hooks (priority 100, AFTER every Book so caps
  // actually cap). Split out of applyBoss so a resumed run can re-hook its
  // boss without re-rolling it or re-applying its economy/round-start effects.
  reapplyBossHooks() {
    if (!this.boss) return;
    this.bossUnregs = this.bossUnregs || [];
    // Letter rules run on the SILENT channel: they bend each letter's own
    // value before its count events are emitted.
    if (this.boss.letterHook) {
      this.bossUnregs.push(this.scoring.register('onLetterRule',
        (ctx, step) => this.boss.letterHook(ctx, step, this, this.bossState),
        100, { source: 'boss' }));
    }
    if (this.boss.wordHook) {
      this.bossUnregs.push(this.scoring.register('onWordForged',
        (ctx) => this.boss.wordHook(ctx, this, this.bossState),
        100, { source: 'boss' }));
    }
  }

  // --- Composing (rack ↔ stick) ---------------------------------------

  stickWord() {
    return this.stick.map((t) => t.letter).join('');
  }

  // 'empty' | 'valid' | 'invalid' — drives the readout and the Forge button.
  // Resolve what the composed slugs actually spell. Every slug contributes
  // one or more POSITIONS, each carrying the letters it will accept:
  // a plain slug accepts its own letter (plus any substitution Books allow),
  // a multi-letter sort contributes several positions, a wildcard accepts
  // anything. Returns { word, perTile } where perTile[i] is the letters that
  // slug ended up spelling, or null when it spells nothing in the dictionary.
  resolveStick(tiles = this.stick) {
    if (tiles.length === 0) return null;
    const subs = this.books.substitutions();
    const opts = [];
    const spans = []; // how many positions each slug occupies
    for (const t of tiles) {
      const spells = slugSpells(t.letter);
      if (spells === null) { opts.push(ALL_LETTERS); spans.push(1); continue; }
      for (const c of spells) opts.push(subs[c] ? [c, ...subs[c]] : [c]);
      spans.push(spells.length);
    }
    if (opts.length < CFG.MIN_WORD_LEN || opts.length > CFG.MAX_WORD_LEN) return null;
    const word = this.dict.findReadingFromOptions(opts);
    if (!word) return null;
    const perTile = [];
    let at = 0;
    for (const span of spans) { perTile.push(word.slice(at, at + span)); at += span; }
    return { word, perTile };
  }

  stickStatus() {
    if (this.stick.length === 0) return 'empty';
    const res = this.resolveStick();
    this.reading = null;
    if (!res) return 'invalid';
    // Show the reading whenever it differs from the glyphs on the slugs.
    if (res.word !== this.stickWord()) this.reading = res.word;
    if (this.boss && this.boss.validWord && !this.boss.validWord(res.word)) return 'invalid';
    if (this.boss && this.boss.validPlay && !this.boss.validPlay(this, this.bossState)) return 'invalid';
    return 'valid';
  }

  // Live score breakdown for the readout; null unless the word is valid.
  // Not committed: Books with outside-the-ctx effects (tickets) stay quiet.
  previewScore() {
    if (this.stickStatus() !== 'valid') return null;
    const res = this.resolveStick();
    return this.scoring.score(this.stick, { word: res.word, spells: res.perTile });
  }

  // Shared zone-to-zone mover: splices the tile out of `from`, pushes to `to`.
  _transfer(tileId, from, to) {
    const i = from.findIndex((t) => t.id === tileId);
    if (i === -1) return false;
    to.push(from.splice(i, 1)[0]);
    return true;
  }

  moveToStick(tileId) {
    if (this.stick.length >= CFG.STICK_SLOTS) return false;
    return this._transfer(tileId, this.rack, this.stick);
  }

  returnToRack(tileId) {
    return this._transfer(tileId, this.stick, this.rack);
  }

  clearStick() {
    while (this.stick.length) this.returnToRack(this.stick[this.stick.length - 1].id);
  }

  // Shuffle the rack's display order — a fresh arrangement for inspiration.
  // Pure reordering: no draw, no cost, the pool is untouched.
  shuffleRack() {
    Util.shuffle(this.rack);
  }

  // --- Free tile movement (drag & drop) ---------------------------------
  // Pull a tile out of whichever hand zone holds it, returning it (or null).
  _extract(tileId) {
    for (const zone of [this.rack, this.stick, this.tray]) {
      const i = zone.findIndex((t) => t.id === tileId);
      if (i !== -1) return zone.splice(i, 1)[0];
    }
    return null;
  }

  // Move any hand tile into the stick at a target index (drag to compose /
  // reorder). Rejects a NEW tile when the stick is already full; the index is
  // adjusted for the tile's own removal so a within-stick drag lands where the
  // pointer is.
  placeInStick(tileId, index) {
    const cur = this.stick.findIndex((t) => t.id === tileId);
    if (cur === -1 && this.stick.length >= CFG.STICK_SLOTS) return false;
    const tile = this._extract(tileId);
    if (!tile) return false;
    let i = index;
    if (cur !== -1 && cur < index) i -= 1; // the removal shifted later slots left
    i = Math.max(0, Math.min(i, this.stick.length));
    this.stick.splice(i, 0, tile);
    return true;
  }

  // Move any hand tile back to the rack (drag off the stick, or reorder the
  // rack). index null = append.
  moveTileToRack(tileId, index = null) {
    const cur = this.rack.findIndex((t) => t.id === tileId);
    const tile = this._extract(tileId);
    if (!tile) return false;
    if (index == null) { this.rack.push(tile); return true; }
    let i = index;
    if (cur !== -1 && cur < index) i -= 1;
    i = Math.max(0, Math.min(i, this.rack.length));
    this.rack.splice(i, 0, tile);
    return true;
  }

  // Draw the hand back up to full; rack + stick + tray together total
  // handSize (RACK_SIZE, less any boss reduction).
  refill() {
    const need = this.handSize - this.rack.length - this.stick.length - this.tray.length;
    if (need > 0) this.rack.push(...this.deck.draw(need));
  }

  // --- Reroll tray -------------------------------------------------------

  // Stage a rack tile for reroll. Needs a charge available and tray space;
  // the Foreman's demanded tile can never be rerolled.
  moveToTray(tileId) {
    if (this.rerolls <= 0 || this.tray.length >= CFG.TRAY_SLOTS) return false;
    if (this.bossState && this.bossState.mustId === tileId) return false;
    return this._transfer(tileId, this.rack, this.tray);
  }

  trayToRack(tileId) {
    return this._transfer(tileId, this.tray, this.rack);
  }

  // Fire the reroll: replacements are drawn FIRST, then the tray tiles are
  // shuffled back into the bag — so you can never immediately redraw them.
  fireReroll() {
    if (this.rerolls <= 0 || this.tray.length === 0) return false;
    const returned = this.tray.splice(0);
    this.roundRerolledA += returned.filter((t) => t.letter === 'A').length;
    this.rack.push(...this.deck.draw(returned.length));
    this.deck.toBag(returned);
    this.rerolls--;
    this.books.onReroll(); // reroll-trigger Books (Salvage Slip) pay out
    this.books.dispatchGrow('reroll'); // The Bellows swells
    this.progress('reroll');
    return true;
  }

  // Hellbox Purge consumable: destroy the tray's tiles permanently
  // (no reroll charge spent), then draw the hand back to full.
  purgeTray() {
    if (this.tray.length === 0) return false;
    if (this.deck.all.length - this.tray.length < CFG.MIN_DECK_SIZE) return false;
    this.destroyTiles(this.tray.splice(0), 'purge');
    this.refill();
    return true;
  }

  // --- Consumables ---------------------------------------------------------

  addConsumable(def) {
    if (this.consumables.length >= CFG.CONSUMABLE_SLOTS) return false;
    this.consumables.push(def);
    return true;
  }

  // Returns false (and keeps the item) if the effect couldn't apply; otherwise
  // true, or a string the UI can toast.
  useConsumable(index) {
    const item = this.consumables[index];
    if (!item) return false;
    const result = item.use(this);
    if (result === false) return false;
    this.consumables.splice(index, 1);
    return result === undefined ? true : result;
  }

  // --- Slip effects ------------------------------------------------------

  // Recast a random slug anywhere in the hand. Returns the tile, or false.
  styleRandomHandTile(style) {
    const hand = [...this.rack, ...this.stick, ...this.tray];
    if (hand.length === 0) return false;
    const tile = hand[Math.floor(Math.random() * hand.length)];
    if (style.variant) tile.variant = style.variant;
    if (style.alteration) tile.alteration = style.alteration;
    return tile;
  }

  // The Vowel Slip: flip A↔E on up to 2 slugs sitting in the reroll tray.
  swapTrayVowels() {
    const targets = this.tray.filter((t) => t.letter === 'A' || t.letter === 'E').slice(0, 2);
    if (targets.length === 0) return false;
    for (const t of targets) {
      t.letter = t.letter === 'A' ? 'E' : 'A';
      t.value = CFG.TILE_VALUES[t.letter];
    }
    return `${targets.length} slug${targets.length > 1 ? 's' : ''} turned`;
  }

  // The Typewriter: read every word the hand can spell, score the strongest
  // candidates through the real engine (Books, stickers, slug styles and boss
  // rules all count), and set the best one on the stick.
  autoCompose() {
    this.clearStick();
    const have = {};
    for (const t of this.rack) have[t.letter] = (have[t.letter] || 0) + 1;

    // Cheap pass: which dictionary words can the rack physically spell?
    const maxLen = Math.min(this.rack.length, CFG.STICK_SLOTS);
    const shortlist = [];
    for (let len = maxLen; len >= CFG.MIN_WORD_LEN; len--) {
      for (const w of (this.dict.byLength.get(len) || [])) {
        const need = {};
        let ok = true;
        for (const c of w) {
          need[c] = (need[c] || 0) + 1;
          if (need[c] > (have[c] || 0)) { ok = false; break; }
        }
        if (!ok) continue;
        let pts = 0;
        for (const c of w) pts += CFG.TILE_VALUES[c];
        shortlist.push({ w, heuristic: pts * (CFG.MULT_BASE + len) });
      }
    }
    if (shortlist.length === 0) return null;

    // Expensive pass: real scoring on the most promising candidates only.
    shortlist.sort((a, b) => b.heuristic - a.heuristic);
    let best = null;
    for (const cand of shortlist.slice(0, CFG.TYPEWRITER_DEPTH)) {
      const tiles = this.tilesSpelling(cand.w);
      if (!tiles) continue;
      this.stick = tiles;                  // borrow the stick so boss rules apply
      const legal = this.stickStatus() === 'valid';
      this.stick = [];
      if (!legal) continue;
      const total = this.scoring.score(tiles).total;
      if (!best || total > best.total) best = { word: cand.w, tiles, total };
    }
    if (!best) return null;

    for (const t of best.tiles) this.moveToStick(t.id);
    return best.word;
  }

  // Pick actual rack slugs spelling `word`, preferring styled ones (they
  // usually score more). Returns null if the rack can't spell it.
  tilesSpelling(word) {
    const pool = this.rack.slice().sort((a, b) =>
      ((b.variant ? 1 : 0) + (b.alteration ? 1 : 0)) - ((a.variant ? 1 : 0) + (a.alteration ? 1 : 0)));
    const out = [];
    for (const c of word) {
      const i = pool.findIndex((t) => t.letter === c);
      if (i === -1) return null;
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  }

  // --- Actions ---------------------------------------------------------

  // Forge the composed word. Caller must have checked validity.
  // Returns { result, outcome } where outcome is 'continue' | 'won' | 'lost'.
  forge() {
    // Scoring happens FIRST: Second Impression / Errata read wordsThisRound
    // and lastWord as they stood before this word. `game` rides along so
    // ticket-clipping tiles (Cardstock) can pay out on commit.
    const res = this.resolveStick();
    const result = this.scoring.score(this.stick.slice(),
      { commit: true, game: this, word: res && res.word, spells: res && res.perTile });

    this.plays--;
    this.roundScore += result.total;
    this.roundLongest = Math.max(this.roundLongest, result.word.length);

    const repeat = this.runWords.has(result.word); // Errata's unlock condition
    this.runWords.add(result.word);
    this.runYCount += [...result.word].filter((c) => c === 'Y').length;
    this.lastWord = result.word;
    this.wordsThisRound++;

    this.stats.wordsForged++;
    if (result.total > this.stats.bestScore) {
      this.stats.bestScore = result.total;
      this.stats.bestWord = result.word;
    }
    this.creditBooks(result.events); // tally each Book's raw score contribution

    // Played slugs go to the hellbox — except one-use variants (Paper) and
    // anything a boss claims (The Crucible), which are destroyed for good.
    // Then the hand draws back up to full.
    const played = this.stick.splice(0);
    // Style-scaling Books read what was actually played (commit-only, so
    // previews never grow anything).
    this.books.dispatchGrow('play', { tiles: played.slice(), word: result.word });
    const copies = result.events.filter((e) => e.type === 'copy').length;
    if (copies) this.books.dispatchGrow('retrigger', { n: copies });
    if (this.boss && this.boss.afterForge) this.boss.afterForge(this, played, this.bossState);
    const oneUse = played.filter((t) => VARIANTS[t.variant] && VARIANTS[t.variant].oneUse);
    this.deck.toDiscard(played.filter((t) => !oneUse.includes(t)));
    if (oneUse.length) this.destroyTiles(oneUse, 'play'); // Paper burns up
    this.refill();
    if (this.boss && this.boss.onDraw) this.boss.onDraw(this, this.bossState); // Foreman demands anew

    this.books.dispatchGrow('forge', { word: result.word, total: result.total });
    this.progress('forge',
      { word: result.word, total: result.total, mult: result.mult, repeat });

    let outcome = 'continue';
    if (this.roundScore >= this.target) {
      // Round ends the moment the target is hit; leftover plays are unused —
      // but they're worth tickets. The payout is itemised for the win card.
      outcome = 'won';
      this.state = 'roundWon';
      if (this.isBossLevel) { this.stats.bossesBeaten++; this.bossesThisRun++; }
      this.lastPayout = [
        { label: `Longest word — ${this.roundLongest} letters`,
          amount: this.roundLongest * CFG.TICKETS_PER_LETTER },
        { label: `Plays left — ${this.plays}`,
          amount: this.plays * CFG.TICKETS_PER_PLAY_LEFT },
      ];
      this.tickets += this.lastPayout[0].amount + this.lastPayout[1].amount;
      this.lastPayout.push(...this.books.onRoundWin()); // Books itemise themselves
      this.lastTicketsEarned = this.lastPayout.reduce((sum, p) => sum + p.amount, 0);
      this.stats.ticketsEarnedTotal += this.lastTicketsEarned;
      this.books.dispatchGrow('roundWin', { wasBoss: this.isBossLevel }); // First Edition appreciates
      this.progress('roundWin',
        { wasBoss: this.isBossLevel, tickets: this.lastTicketsEarned,
          bossId: this.boss ? this.boss.id : null, bossesThisRun: this.bossesThisRun });
      // Beating the WIN_BOSSES-th boss wins the run (once) — the UI shows the
      // victory screen instead of the shop / next level. Endless runs past it.
      if (this.isBossLevel && !this.endless && this.bossesThisRun >= CFG.WIN_BOSSES) {
        outcome = 'wonGame';
        this.state = 'gameWon';
      }
    } else if (this.plays === 0) {
      outcome = 'lost';
      this.state = 'gameOver';
    }
    return { result, outcome };
  }

  // Attribute each scoring event's marginal effect on the running total
  // (runP × runM) to whichever Book produced it. Book/sticker events carry
  // their shelf index `b`; letter events don't, so they're skipped. Summed
  // across the run this ranks Books by raw score added (see mostEffectiveBook).
  creditBooks(events) {
    let prev = 0;
    for (const e of events) {
      const product = (e.runP || 0) * (e.runM || 0);
      const delta = product - prev;
      prev = product;
      if (e.b == null) continue; // a letter/tile event, not a Book's doing
      const book = this.books.shelf[e.b];
      if (book) this.bookOutput[book.id] = (this.bookOutput[book.id] || 0) + delta;
    }
  }

  // The Book that added the most raw score this run, for the victory screen.
  // Looks up by id against the full catalogue so a sold Book still counts.
  mostEffectiveBook() {
    let bestId = null, best = 0;
    for (const [id, val] of Object.entries(this.bookOutput)) {
      if (val > best) { best = val; bestId = id; }
    }
    if (!bestId) return null;
    const def = BOOKS.find((b) => b.id === bestId);
    return def ? { name: def.name, output: Math.round(best) } : null;
  }

  // --- Save / resume ----------------------------------------------------
  // A run is snapshotted to localStorage after each action (see UI.saveRun
  // call sites). The pool is saved as flat tile records + id lists per zone;
  // Books/consumables/boss are saved by id and rehydrated against content.js.

  serialize() {
    const ids = (arr) => arr.map((t) => t.id);
    return {
      v: 1,
      level: this.level,
      difficulty: this.difficulty,
      deckId: this.deckDef.id,
      tickets: this.tickets,
      lastBossId: this.lastBossId,
      bossesThisRun: this.bossesThisRun,
      endless: this.endless,
      bookOutput: this.bookOutput,
      rerollCost: this.rerollCost,
      bin: this.bin ? this.bin.id : null,
      binState: this.binState,
      binSticker: this.binSticker,
      runWords: [...this.runWords],
      runYCount: this.runYCount,
      stats: this.stats,
      // the whole pool + where each tile currently sits
      tiles: this.deck.all.map((t) => ({ id: t.id, letter: t.letter,
        variant: t.variant, alteration: t.alteration, bought: !!t.bought })),
      bag: ids(this.deck.bag), discard: ids(this.deck.discard),
      rack: ids(this.rack), stick: ids(this.stick), tray: ids(this.tray),
      nextTileId: Tile.nextId,
      // round state
      plays: this.plays, rerolls: this.rerolls, handSize: this.handSize,
      roundScore: this.roundScore, roundLongest: this.roundLongest,
      wordsThisRound: this.wordsThisRound, lastWord: this.lastWord,
      roundRerolledA: this.roundRerolledA,
      lastTicketsEarned: this.lastTicketsEarned, lastPayout: this.lastPayout,
      // boss (by id; hooks re-registered on resume)
      bossId: this.boss ? this.boss.id : null, bossState: this.bossState,
      // shelf (by id) + per-book scaling state + stickers
      shelf: this.books.shelf.map((b) => b.id),
      bookState: this.books.state, stickers: this.books.stickers,
      consumables: this.consumables.map((c) => c.id),
      state: this.state,
    };
  }

  // Rebuild this Game in place from a serialize() snapshot.
  resume(data) {
    this.deckDef = DECKS.find((d) => d.id === data.deckId) || DECKS[0];
    this.difficulty = data.difficulty || 0;
    this.level = data.level;
    this.tickets = data.tickets || 0;
    this.lastBossId = data.lastBossId || null;
    this.bossesThisRun = data.bossesThisRun || 0;
    this.endless = data.endless || false;
    this.bookOutput = data.bookOutput || {};
    this.rerollCost = data.rerollCost || CFG.RESTOCK_COST;
    this.bin = data.bin ? (BOOKS.find((b) => b.id === data.bin) || null) : null;
    this.binState = data.binState || null;
    this.binSticker = data.binSticker || null;
    this.runWords = new Set(data.runWords || []);
    this.runYCount = data.runYCount || 0;
    this.stats = data.stats || { wordsForged: 0, bestWord: '—', bestScore: 0,
      bossesBeaten: 0, ticketsEarnedTotal: 0, tilesDestroyed: 0 };

    // Rehydrate the tile pool, then rebuild each zone by id reference.
    const byId = new Map();
    this.deck = new Deck({});
    this.deck.all = [];
    for (const t of data.tiles || []) {
      const tile = new Tile(t.letter, { variant: t.variant, alteration: t.alteration });
      tile.id = t.id;
      if (t.bought) tile.bought = true;
      this.deck.all.push(tile);
      byId.set(t.id, tile);
    }
    Tile.nextId = Math.max(Tile.nextId, data.nextTileId || 0);
    const pick = (list) => (list || []).map((id) => byId.get(id)).filter(Boolean);
    this.deck.bag = pick(data.bag);
    this.deck.discard = pick(data.discard);
    this.rack = pick(data.rack);
    this.stick = pick(data.stick);
    this.tray = pick(data.tray);

    this.plays = data.plays; this.rerolls = data.rerolls; this.handSize = data.handSize;
    this.roundScore = data.roundScore || 0; this.roundLongest = data.roundLongest || 0;
    this.wordsThisRound = data.wordsThisRound || 0; this.lastWord = data.lastWord || null;
    this.roundRerolledA = data.roundRerolledA || 0;
    this.lastTicketsEarned = data.lastTicketsEarned || 0;
    this.lastPayout = data.lastPayout || [];

    // Rebuild the shelf (defs by id) + its scaling state and stickers.
    this.books.clear();
    for (const id of (data.shelf || [])) {
      const def = BOOKS.find((b) => b.id === id);
      if (def) this.books.shelf.push(def);
    }
    this.books.state = data.bookState || {};
    this.books.stickers = data.stickers || {};
    this.books.syncHooks();

    this.consumables = (data.consumables || [])
      .map((id) => CONSUMABLES.find((c) => c.id === id)).filter(Boolean);

    // Re-hook the boss if the resumed round is a live boss round.
    this.clearBoss();
    if (data.bossId) {
      this.boss = BOSSES.find((b) => b.id === data.bossId)
        || BOSSES_IMPERIAL.find((b) => b.id === data.bossId) || null;
      this.bossState = data.bossState || {};
      this.bossUnregs = [];
    }
    this.state = data.state || 'playing';
    if (this.boss && this.state === 'playing') this.reapplyBossHooks();
    return this;
  }

  // Snapshot the run (or clear it once the run is over).
  saveRun() {
    // A finished run (lost or won) has nothing to resume; the victory flow
    // makes its own Endless save explicitly.
    if (this.state === 'gameOver' || this.state === 'gameWon') return this.clearSave();
    try {
      localStorage.setItem(CFG.SAVE_KEY, JSON.stringify(this.serialize()));
    } catch (e) { /* storage blocked — no autosave this session */ }
  }

  clearSave() {
    try { localStorage.removeItem(CFG.SAVE_KEY); } catch (e) { /* nothing to do */ }
  }

  // The saved run, if any and still resumable (not a finished game). Static so
  // the boot code can check before deciding what to offer.
  static loadSave() {
    try {
      const raw = localStorage.getItem(CFG.SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const resumable = data && data.v === 1
        && data.state !== 'gameOver' && data.state !== 'gameWon';
      return resumable ? data : null;
    } catch (e) {
      return null;
    }
  }
}
