// books.js — the Book shelf and the trigger/effect interpreter.
// A Book is one config entry in content.js; this class is the only code
// that reads those entries. Scoring effects are applied through hooks on
// the ScoringEngine choke point; economy effects are applied directly to
// the game at their moment (round start, reroll fired, round won).

class BookManager {

  constructor(game) {
    this.game = game;
    this.shelf = [];       // owned Book defs, in SHELF ORDER (hooks fire left→right)
    this.unregisters = []; // hook teardown fns, rebuilt by syncHooks()
    this.state = {};       // per-run scaling state, keyed by book id
    this.stickers = {};    // book id -> sticker id (see STICKERS in content.js)
  }

  stateOf(def) {
    return this.state[def.id];
  }

  stickerOf(def) {
    return STICKERS[this.stickers[def.id]] || null;
  }

  // Donated-sticker Books don't count toward the shelf limit.
  get slotsUsed() {
    return this.shelf.filter((b) => {
      const s = this.stickerOf(b);
      return !(s && s.noSlot);
    }).length;
  }

  get isFull() {
    return this.slotsUsed >= CFG.BOOK_SLOTS;
  }

  owns(id) {
    return this.shelf.some((b) => b.id === id);
  }

  add(def, stickerId = null) {
    if (this.owns(def.id)) return false;
    // A donated Book squeezes onto even a full shelf.
    const donated = stickerId && STICKERS[stickerId] && STICKERS[stickerId].noSlot;
    if (this.isFull && !donated) return false;
    this.shelf.push(def);
    this.state[def.id] = def.initState ? { ...def.initState } : {};
    if (stickerId) this.applySticker(def.id, stickerId);
    this.syncHooks();
    return true;
  }

  remove(id) {
    const i = this.shelf.findIndex((b) => b.id === id);
    if (i === -1) return null;
    const [def] = this.shelf.splice(i, 1);
    delete this.state[id]; // selling a scaling Book forfeits its growth
    delete this.stickers[id];
    this.syncHooks();
    return def;
  }

  // Drag-to-reorder on The Shelf: order IS the hook order, so this is a
  // real strategic act (additive mult before ×mult beats the reverse).
  reorder(fromIdx, toIdx) {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0
      || fromIdx >= this.shelf.length || toIdx >= this.shelf.length) return false;
    const [def] = this.shelf.splice(fromIdx, 1);
    this.shelf.splice(toIdx, 0, def);
    this.syncHooks();
    return true;
  }

  clear() {
    this.shelf = [];
    this.state = {};
    this.stickers = {};
    this.syncHooks();
  }

  // A rarity-weighted sticker id, optionally skipping some kinds.
  randomStickerId(skip = []) {
    const weighted = [];
    for (const [id, w] of Object.entries(CFG.STICKER_WEIGHTS)) {
      if (skip.includes(id)) continue;
      for (let i = 0; i < w; i++) weighted.push(id);
    }
    return weighted[Math.floor(Math.random() * weighted.length)];
  }

  // Land a random sticker on a random Book that hasn't got one. Discount is
  // excluded — it only ever affects a shop price, so it'd be a dud here.
  // Returns { book, sticker } or null when every Book is already stickered.
  stickRandom() {
    const bare = this.shelf.filter((b) => !this.stickers[b.id]);
    if (bare.length === 0) return null;
    const book = bare[Math.floor(Math.random() * bare.length)];
    const id = this.randomStickerId(['discount']);
    this.applySticker(book.id, id);
    return { book, sticker: STICKERS[id] };
  }

  // Every route a sticker can reach The Shelf by, so the lifetime record
  // (The Rulebook's unlock) sees all of them.
  applySticker(bookId, stickerId) {
    this.stickers[bookId] = stickerId;
    this.game.progress('sticker', { stickerId });
  }

  // Every letter substitution the shelf allows, merged into one map of
  // letter -> extra letters it may be read as (see Dictionary.findReading).
  substitutions() {
    const map = {};
    for (const book of this.shelf) {
      if (!book.substitute) continue;
      for (const [from, tos] of Object.entries(book.substitute)) {
        map[from] = [...new Set([...(map[from] || []), ...tos])];
      }
    }
    return map;
  }

  get hasSubstitutions() {
    return this.shelf.some((b) => b.substitute);
  }

  // Scaling Books grow at commit moments: the game reports the event and
  // every shelved Book with a matching grow handler mutates its state.
  // Events: 'forge' {word,total} | 'play' {tiles,word} | 'reroll'
  //       | 'destroy' {n,source,tiles} | 'retrigger' {n} | 'roundWin' {wasBoss}
  dispatchGrow(event, data = {}) {
    for (const book of this.shelf) {
      const handler = book.grow && book.grow[event];
      if (handler) handler(this.state[book.id], data, this.game);
    }
  }

  sellValue(def) {
    return Math.max(1, Math.floor(def.cost * CFG.SELL_FACTOR));
  }

  // Rebuild all scoring hooks from the shelf. Called on every add/remove/
  // reorder so hook order always matches shelf order (left→right, like
  // jokers). Every Book gets ONE word-phase hook: its own word effect
  // first (if it triggers), THEN its sticker — the sticker always fires on
  // the Book's turn, effect or not. Letter/pre-word Books additionally
  // register their phase hook. All applications self-emit events.
  syncHooks() {
    this.unregisters.forEach((un) => un());
    this.unregisters = [];
    for (const book of this.shelf) {
      // Silent per-letter setup (The Great Vowel Shift muting vowels) runs
      // before the tile's own machinery, so it can suppress it entirely.
      if (book.letterSetup) {
        this.unregisters.push(this.game.scoring.register(
          'onLetterSetup', (ctx, step) => book.letterSetup(ctx, step, this.game), 0, { source: 'book' }));
      }
      // Silent per-letter rules (The Censored Edition zeroing E) run AFTER the
      // slug's own material/alteration, on the same channel bosses use.
      if (book.letterRule) {
        this.unregisters.push(this.game.scoring.register(
          'onLetterRule', (ctx, step) => book.letterRule(ctx, step, this.game), 0, { source: 'book' }));
      }
      // Raw pre-scoring setup (The Journal's Comic Sans rule, The Scroll's
      // inking) — runs before any counting, outside the effect vocabulary.
      if (book.preScore) {
        this.unregisters.push(this.game.scoring.register(
          'onPreWord', (ctx) => book.preScore(ctx, this.game), 0, { source: 'book' }));
      }
      // The Prequel wears whatever its right-hand neighbour does, so it
      // listens on both scoring channels and defers at fire time.
      if (book.copiesNeighbor) {
        this.unregisters.push(this.game.scoring.register('onLetterScored', (ctx, step) => {
          const n = this.neighbourOf(book);
          if (n && n.trigger === 'letter') this.fireBook(n, ctx, step);
        }, 0, { source: 'book' }));
        this.unregisters.push(this.game.scoring.register('onWordForged', (ctx) => {
          const n = this.neighbourOf(book);
          if (n && n.trigger === 'word') this.fireBook(n, ctx, null);
        }, 0, { source: 'book' }));
      }
      if (book.trigger === 'preWord') {
        this.unregisters.push(this.game.scoring.register(
          'onPreWord', (ctx) => this.fireBook(book, ctx, null), 0, { source: 'book' }));
      } else if (book.trigger === 'letter') {
        this.unregisters.push(this.game.scoring.register(
          'onLetterScored', (ctx, step) => this.fireBook(book, ctx, step), 0, { source: 'book' }));
      }
      this.unregisters.push(this.game.scoring.register('onWordForged', (ctx) => {
        if (book.trigger === 'word') this.fireBook(book, ctx, null);
        this.fireSticker(book, ctx);
      }, 0, { source: 'book' }));
    }
  }

  // Apply a Book's effect (once, or twice with a COPY! event if Laminated).
  fireBook(book, ctx, step) {
    const sticker = this.stickerOf(book);
    const times = sticker && sticker.retrigger ? 2 : 1;
    for (let k = 0; k < times; k++) {
      if (k === 1) {
        ctx.events.push({ type: 'copy', target: 'book', b: this.shelf.indexOf(book),
          runP: ctx.points, runM: ctx.mult });
      }
      this.applyEffect(book, ctx, step);
    }
  }

  // The Book immediately to the right on The Shelf (The Prequel's target).
  neighbourOf(book) {
    return this.shelf[this.shelf.indexOf(book) + 1] || null;
  }

  // A sticker's scoring rider: its own count on the Book's turn. The
  // Rulebook makes every sticker fire twice.
  fireSticker(book, ctx) {
    const times = ctx.stickersTwice ? 2 : 1;
    for (let k = 0; k < times; k++) this.fireStickerOnce(book, ctx, k > 0);
  }

  fireStickerOnce(book, ctx, isCopy) {
    const sticker = this.stickerOf(book);
    if (!sticker || !sticker.effect) return;
    const b = this.shelf.indexOf(book);
    if (isCopy) {
      ctx.events.push({ type: 'copy', target: 'book', b, runP: ctx.points, runM: ctx.mult });
    }
    const e = sticker.effect;
    if (e.points) {
      ctx.points += e.points;
      ctx.events.push({ type: 'sticker', b, stickerId: sticker.id, amt: e.points,
        kind: 'pts', runP: ctx.points, runM: ctx.mult });
    }
    if (e.mult) {
      ctx.mult += e.mult;
      ctx.events.push({ type: 'sticker', b, stickerId: sticker.id, amt: e.mult,
        kind: 'mult', runP: ctx.points, runM: ctx.mult });
    }
    if (e.xMult) {
      // The Magazine bumps Bestseller Stickers from ×1.5 to ×2 while shelved.
      const x = (sticker.id === 'bestseller' && ctx.bestsellerBoost) ? 2 : e.xMult;
      ctx.mult *= x;
      ctx.events.push({ type: 'sticker', b, stickerId: sticker.id, x,
        kind: 'xMult', runP: ctx.points, runM: ctx.mult });
    }
  }

  // Shared economy applier — plays / rerolls / tickets straight to the game.
  // Values may be functions of (ctx, step, game, state); economy moments have
  // no scoring ctx, so they resolve as (null, null, game, state). A Laminated
  // economy Book pays out twice (the sticker retriggers its ability).
  applyEconomy(effect, state, book = null) {
    const applied = { plays: 0, rerolls: 0, tickets: 0 };
    if (!effect) return applied;
    const sticker = book ? this.stickerOf(book) : null;
    const times = sticker && sticker.retrigger ? 2 : 1;
    const val = (v) => (typeof v === 'function' ? v(null, null, this.game, state) : (v || 0));
    for (let k = 0; k < times; k++) {
      applied.plays += val(effect.plays);
      applied.rerolls += val(effect.rerolls);
      applied.tickets += val(effect.tickets);
    }
    this.game.plays += applied.plays;
    this.game.rerolls += applied.rerolls;
    this.game.tickets += applied.tickets;
    return applied;
  }

  // Round-start moment: roundStart-trigger Books fire their effect, and any
  // scoring Book with a `roundStart` rider (e.g. Incunabula's -1 play) pays it.
  onRoundStart() {
    // Snapshot: an action may remove Books mid-loop (The Obituary eats one).
    for (const book of this.shelf.slice()) {
      if (!this.owns(book.id)) continue; // already devoured this round
      this.applyEconomy(book.trigger === 'roundStart' ? book.effect : book.roundStart,
        this.state[book.id], book);
      if (book.onRoundStartAction) book.onRoundStartAction(this.game, this.state[book.id], book);
    }
  }

  // Reroll fired moment.
  onReroll() {
    for (const book of this.shelf) {
      if (book.trigger === 'reroll') this.applyEconomy(book.effect, this.state[book.id], book);
    }
  }

  // Level cleared: applies in shelf order (so The Book of Finance compounds
  // whatever earlier Books paid) and returns itemised lines for the win card.
  onRoundWin() {
    const lines = [];
    for (const book of this.shelf) {
      if (book.trigger !== 'roundWin') continue;
      const applied = this.applyEconomy(book.effect, this.state[book.id], book);
      if (applied.tickets) lines.push({ label: book.name, amount: applied.tickets });
    }
    return lines;
  }

  // The shared effect interpreter — the whole Book vocabulary lives here:
  // add points, add mult, multiply mult, grant tickets. Value functions and
  // `when` predicates receive (ctx, step, game, state, pos) so effects can
  // read live game state, their own scaling state, and their shelf position.
  // Contributions land in the ctx (never in the letter's own number — the
  // BOOK takes the credit) and every non-zero component emits an event.
  applyEffect(book, ctx, step) {
    const e = book.effect;
    if (!e) return; // passive Books (substitutions) have no scoring effect
    const state = this.state[book.id];
    const pos = this.shelf.indexOf(book);
    if (book.when && !book.when(ctx, step, this.game, state, pos)) return;
    const val = (v) => (typeof v === 'function' ? v(ctx, step, this.game, state, pos) : v);
    const emit = (extra) => ctx.events.push(Object.assign(
      { b: pos, i: step ? step.index : undefined, runP: ctx.points, runM: ctx.mult }, extra));

    if (e.points != null) {
      const amt = val(e.points);
      if (amt) { ctx.points += amt; emit({ type: 'bookPts', amt }); }
    }
    if (e.mult != null) {
      const amt = val(e.mult);
      if (amt) { ctx.mult += amt; emit({ type: 'bookMult', amt }); }
    }
    if (e.xMult != null) {
      const x = val(e.xMult);
      if (x && x !== 1) { ctx.mult *= x; emit({ type: 'bookXMult', x }); }
    }
    // Side effect outside the ctx — previews must not pay out.
    if (e.tickets != null) {
      const amt = val(e.tickets);
      if (amt) {
        if (ctx.commit) this.game.tickets += amt;
        emit({ type: 'ticket', target: 'book', amt });
      }
    }
  }
}
