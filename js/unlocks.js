// unlocks.js — permanent Book unlocks, persisted across runs.
// Watches play events, keeps lifetime counters, and flips Books from
// locked to available when their content.js `unlock` condition passes.
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
      wordsForged: 0,    // lifetime counters, across every run
      rerollsUsed: 0,
      purgedTiles: 0,
      ticketsEarned: 0,
      bossesBeaten: 0,
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

  // A Book with no unlock clause is always available.
  isUnlocked(book) {
    return !book.unlock || this.profile.unlocked.includes(book.id);
  }

  get unlockedCount() {
    return BOOKS.filter((b) => this.isUnlocked(b)).length;
  }

  // Feed a play event in: lifetime counters update, then every still-locked
  // Book listening for this event gets its test run. Returns the Books that
  // just unlocked so the UI can announce them.
  notify(event, data = {}) {
    const p = this.profile;
    if (event === 'forge') p.wordsForged++;
    if (event === 'reroll') p.rerollsUsed++;
    if (event === 'purge') p.purgedTiles += data.n || 0;
    if (event === 'roundWin') {
      p.ticketsEarned += data.tickets || 0;
      if (data.wasBoss) p.bossesBeaten++;
    }

    const fresh = [];
    for (const book of BOOKS) {
      if (!book.unlock || p.unlocked.includes(book.id)) continue;
      if (book.unlock.event !== event) continue;
      if (book.unlock.test && !book.unlock.test(data, p, this.game)) continue;
      p.unlocked.push(book.id);
      fresh.push(book);
    }
    this.save();
    return fresh;
  }
}
