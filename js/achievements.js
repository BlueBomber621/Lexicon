// achievements.js — a parallel, cosmetic progress layer to Unlocks. Watches
// the same play events, flips ACHIEVEMENTS (content.js) from unearned to
// earned when their `test` passes, and hands the freshly-earned ones back for
// the UI to pop up in the corner. Persisted to its own localStorage key so it
// never touches the unlock profile. Like the rest of the juice layer, storage
// is best-effort: if it's blocked, achievements just live for the session.
//
// A def is { id, icon, title, desc, event, test }:
//   event — which notify() event arms it ('forge' | 'roundWin' | 'reroll'
//           | 'destroy' | 'sticker' | 'runEnd' | 'always'). 'always' is
//           checked on every notify (for live conditions like tickets held).
//   test  — (data, game) => boolean. Runs AFTER Unlocks.notify has updated the
//           lifetime profile, so tests may read game.unlocks.profile counters.

class Achievements {

  constructor(game) {
    this.game = game;
    this.earned = new Set(this.load());
  }

  load() {
    try {
      const raw = localStorage.getItem(CFG.ACHIEVEMENTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return []; // storage blocked — session-only
    }
  }

  save() {
    try {
      localStorage.setItem(CFG.ACHIEVEMENTS_KEY, JSON.stringify([...this.earned]));
    } catch (e) { /* storage blocked — nothing to do */ }
  }

  has(id) {
    return this.earned.has(id);
  }

  get count() {
    return this.earned.size;
  }

  // Feed a play event in; return the achievement defs that were just earned.
  notify(event, data = {}) {
    const fresh = [];
    for (const a of ACHIEVEMENTS) {
      if (this.earned.has(a.id)) continue;
      if (a.event !== event && a.event !== 'always') continue;
      if (a.test && !a.test(data, this.game)) continue;
      this.earned.add(a.id);
      fresh.push(a);
    }
    if (fresh.length) this.save();
    return fresh;
  }
}
