// scoring.js — the single choke-point for ALL scoring in the game.
// Nothing else in the codebase computes score. Books and bosses register
// modifiers on the hooks below and never touch anything else.
//
// The engine emits an ordered EVENT SCRIPT (ctx.events) that the UI replays
// as the counting animation. The canonical order:
//   0. pre-word Books (trigger 'preWord'), left→right           [none yet]
//   1. letters, left→right. For each letter:
//        a. its own points (base + neighbour bonus + variant + alteration,
//           after boss letter-rules) — skipped in the count if 0
//        b. its own mult contribution (variant/alteration) — skipped if 0,
//           then any tile ×mult (Highlighted)
//        c. its ticket payout (Cardstock)
//        d. every letter-trigger Book that fires on it, in shelf order —
//           the BOOK announces the bonus, not the letter
//        e. a retrigger (Fuzzy) repeats a-d after a COPY! event
//   2. Books left→right: the Book's word effect (if it triggers), then its
//      sticker (which always fires on the Book's turn, effect or not).
//      Lamination retriggers the Book's ability with a COPY! event.
//   3. Boss word rules (registered at priority 100) land last; if they
//      change anything a 'boss' event is emitted.
//
// Hook channels:
//   onPreWord(ctx)            — pre-letter Books
//   onLetterRule(ctx, step)   — SILENT rules that bend a letter's own value
//                               (bosses); run before the letter's events
//   onLetterScored(ctx, step) — letter-trigger Books; they self-emit events
//   onWordForged(ctx)         — per-Book word phase + boss caps
//
// ctx: { tiles, word, points, mult, events, commit, game, total }
// Events carry runP/runM — the running totals AFTER the event applies —
// so the readout can count along.

class ScoringEngine {

  constructor() {
    this.hooks = {
      onPreWord: [],
      onLetterSetup: [],  // runs FIRST on each letter; may mute it entirely
      onLetterRule: [],
      onLetterScored: [],
      onWordForged: [],
    };
  }

  // Attach a modifier. meta.source ('book' | 'boss') lets the engine know
  // who to blame in the event script. Returns an unregister function.
  register(hookName, fn, priority = 0, meta = {}) {
    const entry = { fn, priority, meta };
    const list = this.hooks[hookName];
    list.push(entry);
    list.sort((a, b) => a.priority - b.priority);
    return () => {
      const i = list.indexOf(entry);
      if (i !== -1) list.splice(i, 1);
    };
  }

  // Score a composed word. Pure with respect to game state unless commit
  // is true (then ticket-granting effects may fire; game must be passed).
  // `word` is the RESOLVED spelling (wildcards and multi-letter sorts already
  // worked out) and `spells[i]` is what slug i spelled. Mult follows the
  // resolved word's length, so multi-letter sorts genuinely lengthen a word.
  score(tiles, { commit = false, game = null, word = null, spells = null } = {}) {
    const resolved = word || tiles.map((t) => t.letter).join('');
    const ctx = {
      tiles,
      word: resolved,
      spells: spells || tiles.map((t) => t.letter),
      points: 0,
      mult: CFG.MULT_BASE + resolved.length, // the length-driven mult
      events: [],
      commit,
      game,
      total: 0,
    };

    // Neighbour pre-pass: variant effects that buff adjacent tiles seed the
    // bonus array before any tile scores.
    const bonus = new Array(tiles.length).fill(0);
    tiles.forEach((tile, i) => {
      const v = VARIANTS[tile.variant];
      if (v && v.neighbor) v.neighbor(i, bonus, tiles);
    });

    // PHASE 0: pre-word Books.
    for (const h of this.hooks.onPreWord) h.fn(ctx);

    // PHASE 1: letters, left→right (with retriggers).
    tiles.forEach((tile, index) => {
      const step = this.letterPass(ctx, tile, index, bonus);
      const a = ALTERATIONS[tile.alteration];
      // Fuzzy prints twice — as does anything a Book has marked for
      // retriggering (The Colouring Book's red letters). Muted slugs sit out.
      const bookRetrigger = ctx.retriggerAlterations
        && ctx.retriggerAlterations.includes(tile.alteration);
      if ((a && a.retrigger || bookRetrigger) && !step.mute) {
        ctx.events.push({ type: 'copy', target: 'tile', i: index,
          runP: ctx.points, runM: ctx.mult });
        this.letterPass(ctx, tile, index, bonus);
      }
    });

    // PHASE 2 + 3: word phase. Book hooks self-emit; boss changes get a
    // 'boss' event so the UI can flash the plaque.
    for (const h of this.hooks.onWordForged) {
      const p0 = ctx.points, m0 = ctx.mult;
      h.fn(ctx);
      if (h.meta.source === 'boss' && (ctx.points !== p0 || ctx.mult !== m0)) {
        ctx.events.push({ type: 'boss', runP: ctx.points, runM: ctx.mult });
      }
    }

    ctx.mult = Math.max(0, ctx.mult);
    ctx.total = Math.round(Math.max(0, ctx.points) * ctx.mult);
    return ctx;
  }

  // One full scoring pass for a single letter (steps a-d above).
  // Returns the step so the caller can see whether it was muted.
  letterPass(ctx, tile, index, bonus) {
    // step.spells is what this slug actually spelled (a wildcard's resolved
    // letter, a sort's expansion) — letter-trigger Books test against it.
    const step = { tile, index, pts: tile.value + bonus[index], mute: false,
      spells: ctx.spells[index] || tile.letter };
    const m0 = ctx.mult;

    // Setup hooks may mute the letter outright (The Great Vowel Shift):
    // no points, and its material and alteration do nothing at all.
    for (const h of this.hooks.onLetterSetup) h.fn(ctx, step);
    const v = step.mute ? null : VARIANTS[tile.variant];
    const a = step.mute ? null : ALTERATIONS[tile.alteration];
    if (step.mute) step.pts = 0;

    // The tile's own machinery: variant, then alteration.
    if (v && v.apply) v.apply(ctx, step, ctx.tiles);
    if (a && a.apply) a.apply(ctx, step, ctx.tiles);

    // Boss letter-rules bend the tile's own value, silently (The Vowel
    // Void's zeroes, The Assessor's tax, cursed slots...).
    for (const h of this.hooks.onLetterRule) h.fn(ctx, step);

    // Comic Sans: the tile's points become mult instead — unless The Journal
    // is shelved, which lets the slug keep its points as well.
    if (a && a.redirectToMult) {
      ctx.mult += step.pts;
      if (!ctx.keepComicPoints) step.pts = 0;
    }

    // Sequence the tile's own counts: points first, then mult, then ×mult.
    const multDelta = ctx.mult - m0;
    ctx.mult = m0; // rewind; re-apply in event order
    ctx.points += step.pts;
    if (step.pts !== 0) {
      ctx.events.push({ type: 'tilePts', i: index, amt: step.pts,
        runP: ctx.points, runM: ctx.mult });
    }
    if (multDelta !== 0) {
      ctx.mult += multDelta;
      ctx.events.push({ type: 'tileMult', i: index, amt: multDelta,
        runP: ctx.points, runM: ctx.mult });
    }
    if (a && a.xMult) { // Highlighted
      ctx.mult *= a.xMult;
      ctx.events.push({ type: 'tileXMult', i: index, x: a.xMult,
        runP: ctx.points, runM: ctx.mult });
    }

    // Cardstock: the slug clips a ticket every time it scores.
    if (v && v.ticket) {
      if (ctx.commit && ctx.game) ctx.game.tickets += v.ticket;
      ctx.events.push({ type: 'ticket', target: 'tile', i: index, amt: v.ticket,
        runP: ctx.points, runM: ctx.mult });
    }

    // Letter-trigger Books fire on this letter, in shelf order — the Book
    // takes the credit (and emits its own events).
    for (const h of this.hooks.onLetterScored) h.fn(ctx, step);
    return step;
  }
}
