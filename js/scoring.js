// scoring.js — the single choke-point for ALL scoring in the game.
// Nothing else in the codebase computes score. Books and bosses register
// modifiers on the hooks below and never touch anything else.
//
// Hook contract (all mutate ctx in place):
//   onLetterScored(ctx, step)  — fires per tile, left→right, after the tile's
//                                base value (and any edition bonus) lands in
//                                step.pts. May adjust step.pts, ctx.mult, etc.
//   onWordForged(ctx)          — fires once after all letters, before the
//                                final total. May adjust ctx.points/ctx.mult.
//
// Hooks carry a priority: lower runs first. Books register at the default 0;
// bosses register at 100 so their caps and zeroes land after every Book.
//
// ctx shape: { tiles, word, points, mult, steps, total, commit }
//   commit is false for live previews — hooks with side effects outside the
//   ctx (granting tickets, etc.) must check it before touching game state.
// steps entries: { tile, index, pts, runningPoints } — the UI replays these
// for the scoring sweep, so whatever the hooks decide is exactly what animates.

class ScoringEngine {

  constructor() {
    this.hooks = {
      onLetterScored: [],
      onWordForged: [],
    };
  }

  // Attach a modifier. Returns an unregister function so selling a Book
  // (or clearing a boss) is a one-liner.
  register(hookName, fn, priority = 0) {
    const entry = { fn, priority };
    const list = this.hooks[hookName];
    list.push(entry);
    list.sort((a, b) => a.priority - b.priority);
    return () => {
      const i = list.indexOf(entry);
      if (i !== -1) list.splice(i, 1);
    };
  }

  // Score a composed word. Pure with respect to game state unless
  // commit is true (then ticket-granting hooks may fire).
  score(tiles, { commit = false } = {}) {
    const ctx = {
      tiles,
      word: tiles.map((t) => t.letter).join(''),
      points: 0,
      mult: CFG.MULT_BASE + tiles.length, // the length-driven mult
      steps: [],
      bonus: new Array(tiles.length).fill(0), // neighbour buffs (Ligature, etc.)
      total: 0,
      commit,
    };

    // Pre-pass: variant neighbour effects seed the bonus array before any
    // tile scores, so a Ligature can buff a slug that scores earlier than it.
    tiles.forEach((tile, i) => {
      const v = VARIANTS[tile.variant];
      if (v && v.neighbor) v.neighbor(i, ctx.bonus, tiles);
    });

    // Letters trigger left→right, each contributing its point value plus any
    // neighbour bonus, then its variant, its alteration, then Books.
    tiles.forEach((tile, index) => {
      const step = { tile, index, pts: tile.value + ctx.bonus[index], runningPoints: 0 };

      // Tile axes are core scoring, so they live here in the choke point.
      const v = VARIANTS[tile.variant];
      if (v && v.apply) v.apply(ctx, step, tiles);
      const a = ALTERATIONS[tile.alteration];
      if (a && a.apply) a.apply(ctx, step, tiles);

      for (const h of this.hooks.onLetterScored) h.fn(ctx, step);

      // Comic Sans: after all point changes, this tile's points become mult.
      if (a && a.redirectToMult) { ctx.mult += step.pts; step.pts = 0; }

      ctx.points += step.pts;
      step.runningPoints = ctx.points;
      ctx.steps.push(step);
    });

    for (const h of this.hooks.onWordForged) h.fn(ctx);

    ctx.mult = Math.max(0, ctx.mult);
    ctx.total = Math.round(Math.max(0, ctx.points) * ctx.mult);
    return ctx;
  }
}
