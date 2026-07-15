// game.js — run state and the rules of play. Owns the rack, stick, and
// reroll tray; enforces plays/rerolls, level targets, boss modifiers,
// tickets, and consumables. All actual score math is delegated to
// ScoringEngine (the choke point).

class Game {

  constructor(dictionary) {
    this.dict = dictionary;
    this.scoring = new ScoringEngine();
    this.books = new BookManager(this);
    this.newRun();
  }

  // --- Run / round lifecycle -----------------------------------------

  newRun() {
    this.level = 1;
    this.tickets = 0;
    this.deck = new Deck(CFG.STARTING_DECK); // fresh pool; purchases don't persist
    this.books.clear();
    this.consumables = [];
    this.lastBossId = null;
    this.stats = {
      wordsForged: 0, bestWord: '—', bestScore: 0,
      bossesBeaten: 0, ticketsEarnedTotal: 0,
    };
    this.startRound();
  }

  startRound() {
    this.clearBoss();
    this.deck.reset(); // every tile back in the bag, fresh shuffle
    this.rack = this.deck.draw(CFG.RACK_SIZE);
    this.stick = [];
    this.tray = [];
    this.plays = CFG.PLAYS_PER_ROUND;
    this.rerolls = CFG.REROLLS_PER_ROUND;
    this.roundScore = 0;
    this.roundLongest = 0;
    this.lastTicketsEarned = 0;
    if (this.isBossLevel) this.applyBoss(); // boss bends economy first...
    this.books.onRoundStart();              // ...then roundStart Books apply
    this.state = 'playing'; // 'playing' | 'roundWon' | 'gameOver'
  }

  nextLevel() {
    this.level++;
    this.startRound();
  }

  // Score target scales forever: base × growth^(level-1).
  get target() {
    return Math.round(CFG.TARGET_BASE * Math.pow(CFG.TARGET_GROWTH, this.level - 1));
  }

  get isBossLevel() {
    return this.level % CFG.BOSS_EVERY === 0;
  }

  // The shop opens after clearing every SHOP_EVERYth level.
  get shopDue() {
    return this.level % CFG.SHOP_EVERY === 0;
  }

  // --- Boss modifiers ---------------------------------------------------

  applyBoss() {
    const pool = BOSSES.filter((b) => b.id !== this.lastBossId); // no repeats back-to-back
    this.boss = pool[Math.floor(Math.random() * pool.length)];
    this.lastBossId = this.boss.id;
    // Priority 100: boss rules land AFTER every Book, so caps actually cap.
    this.bossUnregs = [];
    if (this.boss.letterHook) {
      this.bossUnregs.push(this.scoring.register('onLetterScored', this.boss.letterHook, 100));
    }
    if (this.boss.wordHook) {
      this.bossUnregs.push(this.scoring.register('onWordForged', this.boss.wordHook, 100));
    }
    this.plays = Math.max(1, this.plays + (this.boss.playsDelta || 0));
    this.rerolls = Math.max(0, this.rerolls + (this.boss.rerollsDelta || 0));
  }

  clearBoss() {
    (this.bossUnregs || []).forEach((un) => un());
    this.bossUnregs = [];
    this.boss = null;
  }

  // --- Composing (rack ↔ stick) ---------------------------------------

  stickWord() {
    return this.stick.map((t) => t.letter).join('');
  }

  // 'empty' | 'valid' | 'invalid' — drives the readout and the Forge button.
  stickStatus() {
    if (this.stick.length === 0) return 'empty';
    const w = this.stickWord();
    if (!this.dict.isValidWord(w)) return 'invalid';
    if (this.boss && this.boss.validWord && !this.boss.validWord(w)) return 'invalid';
    return 'valid';
  }

  // Live score breakdown for the readout; null unless the word is valid.
  // Not committed: Books with outside-the-ctx effects (tickets) stay quiet.
  previewScore() {
    return this.stickStatus() === 'valid' ? this.scoring.score(this.stick) : null;
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

  // Draw the hand back up to full; rack + stick + tray together total RACK_SIZE.
  refill() {
    const need = CFG.RACK_SIZE - this.rack.length - this.stick.length - this.tray.length;
    if (need > 0) this.rack.push(...this.deck.draw(need));
  }

  // --- Reroll tray -------------------------------------------------------

  // Stage a rack tile for reroll. Needs a charge available and tray space.
  moveToTray(tileId) {
    if (this.rerolls <= 0 || this.tray.length >= CFG.TRAY_SLOTS) return false;
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
    this.rack.push(...this.deck.draw(returned.length));
    this.deck.toBag(returned);
    this.rerolls--;
    return true;
  }

  // Hellbox Purge consumable: destroy the tray's tiles permanently
  // (no reroll charge spent), then draw the hand back to full.
  purgeTray() {
    if (this.tray.length === 0) return false;
    if (this.deck.all.length - this.tray.length < CFG.MIN_DECK_SIZE) return false;
    this.deck.destroy(this.tray.splice(0));
    this.refill();
    return true;
  }

  // --- Consumables ---------------------------------------------------------

  addConsumable(def) {
    if (this.consumables.length >= CFG.CONSUMABLE_SLOTS) return false;
    this.consumables.push(def);
    return true;
  }

  // Returns false (and keeps the item) if the effect couldn't apply.
  useConsumable(index) {
    const item = this.consumables[index];
    if (!item) return false;
    if (item.use(this) === false) return false;
    this.consumables.splice(index, 1);
    return true;
  }

  // --- Actions ---------------------------------------------------------

  // Forge the composed word. Caller must have checked validity.
  // Returns { result, outcome } where outcome is 'continue' | 'won' | 'lost'.
  forge() {
    const result = this.scoring.score(this.stick.slice(), { commit: true });

    this.plays--;
    this.roundScore += result.total;
    this.roundLongest = Math.max(this.roundLongest, result.word.length);

    this.stats.wordsForged++;
    if (result.total > this.stats.bestScore) {
      this.stats.bestScore = result.total;
      this.stats.bestWord = result.word;
    }

    // Played slugs go to the hellbox — except one-use variants (Paper), which
    // are destroyed for good. Then the hand draws back up to full.
    const played = this.stick.splice(0);
    const oneUse = played.filter((t) => VARIANTS[t.variant] && VARIANTS[t.variant].oneUse);
    this.deck.toDiscard(played.filter((t) => !oneUse.includes(t)));
    if (oneUse.length) this.deck.destroy(oneUse);
    this.refill();

    let outcome = 'continue';
    if (this.roundScore >= this.target) {
      // Round ends the moment the target is hit; leftover plays are unused.
      outcome = 'won';
      this.state = 'roundWon';
      if (this.isBossLevel) this.stats.bossesBeaten++;
      this.lastTicketsEarned = this.roundLongest * CFG.TICKETS_PER_LETTER;
      this.tickets += this.lastTicketsEarned;
      this.stats.ticketsEarnedTotal += this.lastTicketsEarned;
    } else if (this.plays === 0) {
      outcome = 'lost';
      this.state = 'gameOver';
    }
    return { result, outcome };
  }
}
