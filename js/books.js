// books.js — the Book shelf and the trigger/effect interpreter.
// A Book is one config entry in content.js; this class is the only code
// that reads those entries. Scoring effects are applied through hooks on
// the ScoringEngine choke point; round-start effects are applied directly
// to the game when a round begins.

class BookManager {

  constructor(game) {
    this.game = game;
    this.shelf = [];       // owned Book defs, in acquisition order
    this.unregisters = []; // hook teardown fns, rebuilt by syncHooks()
  }

  get isFull() {
    return this.shelf.length >= CFG.BOOK_SLOTS;
  }

  owns(id) {
    return this.shelf.some((b) => b.id === id);
  }

  add(def) {
    if (this.isFull || this.owns(def.id)) return false;
    this.shelf.push(def);
    this.syncHooks();
    return true;
  }

  remove(id) {
    const i = this.shelf.findIndex((b) => b.id === id);
    if (i === -1) return null;
    const [def] = this.shelf.splice(i, 1);
    this.syncHooks();
    return def;
  }

  clear() {
    this.shelf = [];
    this.syncHooks();
  }

  sellValue(def) {
    return Math.max(1, Math.floor(def.cost * CFG.SELL_FACTOR));
  }

  // Rebuild all scoring hooks from the shelf. Called on every add/remove
  // so hook order always matches shelf order (left→right, like jokers).
  syncHooks() {
    this.unregisters.forEach((un) => un());
    this.unregisters = [];
    for (const book of this.shelf) {
      if (book.trigger === 'letter') {
        this.unregisters.push(this.game.scoring.register(
          'onLetterScored', (ctx, step) => this.applyEffect(book, ctx, step)));
      } else if (book.trigger === 'word') {
        this.unregisters.push(this.game.scoring.register(
          'onWordForged', (ctx) => this.applyEffect(book, ctx, null)));
      }
      // roundStart Books have no scoring hook; see onRoundStart().
    }
  }

  // Round-economy effects (+plays, +rerolls, +tickets at round start).
  onRoundStart() {
    for (const book of this.shelf) {
      if (book.trigger !== 'roundStart') continue;
      const e = book.effect;
      if (e.plays) this.game.plays += e.plays;
      if (e.rerolls) this.game.rerolls += e.rerolls;
      if (e.tickets) this.game.tickets += e.tickets;
    }
  }

  // The shared effect interpreter — the whole Book vocabulary lives here:
  // add points, add mult, multiply mult, grant tickets.
  applyEffect(book, ctx, step) {
    if (book.when && !book.when(ctx, step)) return;
    const val = (v) => (typeof v === 'function' ? v(ctx, step) : v);
    const e = book.effect;

    if (e.points != null) {
      if (step) step.pts += val(e.points); // letter trigger: boosts this slug
      else ctx.points += val(e.points);    // word trigger: boosts the pool
    }
    if (e.mult != null) ctx.mult += val(e.mult);
    if (e.xMult != null) ctx.mult *= val(e.xMult);
    // Side effect outside the ctx — previews must not pay out.
    if (e.tickets != null && ctx.commit) this.game.tickets += val(e.tickets);
  }
}
