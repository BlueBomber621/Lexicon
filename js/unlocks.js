// unlocks.js — permanent Book AND starting-case unlocks, persisted across
// runs. Watches play events, keeps lifetime counters, and flips entries
// from locked to available when their content.js `unlock` condition passes.
// Storage is localStorage — a patchwork layer: if it's unavailable
// (private mode, blocked), unlocks simply live for the session only.

class Unlocks {

  constructor(game) {
    this.game = game;
    this.profile = this.load();
  }

  static get DEFAULTS() {
    return {
      unlocked: [],      // ids of Books earned
      decksUnlocked: [], // ids of starting cases earned
      lastDeck: 'standard',
      lastDifficulty: 0, // index into CFG.DIFFICULTIES
      wordsForged: 0,    // lifetime counters, across every run
      longWords: 0,      // words of 7+ letters
      rerollsUsed: 0,
      purgedTiles: 0,    // tiles destroyed by any means
      styledCast: 0,     // variant/alteration slugs kept from bags
      ticketsEarned: 0,
      bossesBeaten: 0,
      runsPlayed: 0,     // runs in which at least one word was forged
      jesterPenUsed: 0,  // Jester's Pen inkings
      maxDiffBeaten: -1, // highest difficulty index whose boss you've beaten
      stickersSeen: [],  // every sticker kind you've ever owned
      itemsBought: 0,    // Foundry purchases (Business Contract / Coupon / Insurance)
      heavyLettersPlayed: 0, // slugs worth 8+ points played (The Bodkin)
    };
  }

  load() {
    try {
      const raw = localStorage.getItem(CFG.PROFILE_KEY);
      return raw ? Object.assign(Unlocks.DEFAULTS, JSON.parse(raw)) : Unlocks.DEFAULTS;
    } catch (e) {
      return Unlocks.DEFAULTS; // storage blocked — session-only profile
    }
  }

  save() {
    try {
      localStorage.setItem(CFG.PROFILE_KEY, JSON.stringify(this.profile));
    } catch (e) { /* storage blocked — nothing to do */ }
  }

  // Erase the whole file: every unlock and lifetime counter, on disk and in
  // memory. Guarded behind two confirmations in the UI.
  wipe() {
    try {
      localStorage.removeItem(CFG.PROFILE_KEY);
    } catch (e) { /* storage blocked — the in-memory reset below still applies */ }
    this.profile = Unlocks.DEFAULTS;
  }

  // Entries with no unlock clause are always available.
  isUnlocked(book) {
    return !book.unlock || this.profile.unlocked.includes(book.id);
  }

  isDeckUnlocked(deck) {
    return !deck.unlock || this.profile.decksUnlocked.includes(deck.id);
  }

  // Difficulties open in order: you must beat a boss on one to try the next.
  isDifficultyUnlocked(index) {
    return index <= this.profile.maxDiffBeaten + 1;
  }

  get unlockedCount() {
    return BOOKS.filter((b) => this.isUnlocked(b)).length;
  }

  // Feed a play event in: lifetime counters update, then every still-locked
  // Book and starting case listening for this event gets its test run.
  // Returns what just unlocked ({kind, ...def}) so the UI can announce it.
  // Events: 'forge' {word,total,repeat} | 'reroll' | 'destroy' {n,source}
  //       | 'roundWin' {wasBoss,bossId,tickets} | 'bagcast' {styled}
  notify(event, data = {}) {
    const p = this.profile;
    if (event === 'forge') {
      p.wordsForged++;
      if (data.word && data.word.length >= 7) p.longWords++;
      if (data.heavy) p.heavyLettersPlayed += data.heavy;
    }
    if (event === 'buy') p.itemsBought += 1;
    if (event === 'reroll') p.rerollsUsed++;
    if (event === 'destroy') p.purgedTiles += data.n || 0;
    if (event === 'bagcast') p.styledCast += data.styled || 0;
    if (event === 'runEnd') p.runsPlayed++;
    if (event === 'pen' && data.penId === 'pen-comic') p.jesterPenUsed++;
    if (event === 'sticker' && data.stickerId && !p.stickersSeen.includes(data.stickerId)) {
      p.stickersSeen.push(data.stickerId);
    }
    if (event === 'roundWin') {
      p.ticketsEarned += data.tickets || 0;
      if (data.wasBoss) {
        p.bossesBeaten++;
        // Beating a boss clears that difficulty, opening the next one up.
        const d = this.game.difficulty || 0;
        if (d > p.maxDiffBeaten) p.maxDiffBeaten = d;
      }
    }

    const fresh = [];
    const check = (defs, ownedList, kind) => {
      for (const def of defs) {
        if (!def.unlock || ownedList.includes(def.id)) continue;
        // event 'always' = live condition, checked on every notify.
        if (def.unlock.event !== event && def.unlock.event !== 'always') continue;
        if (def.unlock.test && !def.unlock.test(data, p, this.game)) continue;
        ownedList.push(def.id);
        fresh.push(Object.assign({ kind }, def));
      }
    };
    check(BOOKS, p.unlocked, 'book');
    check(DECKS, p.decksUnlocked, 'deck');
    this.save();
    return fresh;
  }
}
