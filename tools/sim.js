// sim.js — headless balance simulator for LEXICON. DEV ONLY, not shipped.
//
// Loaded into the running page (which already has the dictionary + all classes)
// via:  fetch('/tools/sim.js').then(r=>r.text()).then(t=>(0,eval)(t))
// then run:  SIM.run(500)   ->  { winRate, deathHist, ... }
//
// It plays full runs with a "DECENT" auto-player: near-optimal word each hand
// (game.autoCompose, the real scoring engine — so Books/stickers/styles count),
// rerolls when behind pace, and a naive greedy shop (fills the shelf with
// affordable Books, grabs a bag when flush — no synergy/order optimisation,
// which is where the skill ceiling lives). Note difficulty, Standard case.

(function () {
  const G = window;

  // Skill profile. pool = the strong words the player narrows to; sample = how
  // many of those they actually spot and weigh (the skill dial). rerollTries =
  // how many times they'll reroll to fix a bad hand. "DECENT" = finds good
  // words but misses the optimum, rerolls a bit, considers its build.
  const DECENT = { pool: 40, sample: 8, rerollTries: 3 };

  // --- Fast word index (cached) -----------------------------------------
  // autoCompose rescans the whole dictionary building throwaway objects each
  // hand — far too slow for thousands of runs. We precompute, once, a compact
  // index of every playable-length word: a 26-bit letter-presence MASK, a flat
  // 26-count table, and a raw heuristic. Formability then prunes with a single
  // bitmask AND before the count check. Candidates are still real-scored
  // through the live engine, so Books/bosses/styles count exactly as in play.
  function buildIndex(dict) {
    if (G.__SIM_IDX && G.__SIM_IDX.size === dict.size) return G.__SIM_IDX;
    const maxLen = CFG.STICK_SLOTS; // the rack can't compose longer, plainly
    const words = [];
    for (let len = 2; len <= maxLen; len++) {
      for (const w of (dict.byLength.get(len) || [])) words.push(w);
    }
    const N = words.length;
    const masks = new Int32Array(N);
    const counts = new Uint8Array(N * 26);
    const heur = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      const w = words[i];
      let mask = 0, pts = 0;
      const base = i * 26;
      for (const ch of w) {
        const k = ch.charCodeAt(0) - 65;
        mask |= (1 << k);
        counts[base + k]++;
        pts += CFG.TILE_VALUES[ch] || 0;
      }
      masks[i] = mask;
      heur[i] = pts * (CFG.MULT_BASE + w.length);
    }
    return (G.__SIM_IDX = { size: dict.size, N, words, masks, counts, heur });
  }

  // The word the modelled player actually plays. `opts.pool` bounds the search
  // to the strongest-by-heuristic words (nobody plays junk); `opts.sample` is
  // how many of those the player actually spots and considers — the SKILL dial.
  // sample >= pool ≈ optimal ("skilled"); a small sample models a "decent"
  // player who finds some good words but misses the best. Real-scores only the
  // considered words, so Books/bosses/styles count. Leaves tiles on the stick.
  function fastCompose(g, idx, opts) {
    const pool = opts.pool, sample = opts.sample;
    g.clearStick();
    const rackVec = new Uint8Array(26);
    let rackMask = 0;
    for (const t of g.rack) {
      const k = t.letter.charCodeAt(0) - 65;
      if (k >= 0 && k < 26) { rackVec[k]++; rackMask |= (1 << k); }
    }
    const notRack = ~rackMask;
    const { N, words, masks, counts, heur } = idx;
    const formable = [];
    for (let i = 0; i < N; i++) {
      if (masks[i] & notRack) continue;       // needs a letter the rack lacks
      const base = i * 26;
      let ok = true;
      for (let k = 0; k < 26; k++) {
        if (counts[base + k] > rackVec[k]) { ok = false; break; }
      }
      if (ok) formable.push(i);
    }
    if (formable.length === 0) return null;
    formable.sort((a, b) => heur[b] - heur[a]);
    const cands = formable.slice(0, pool);
    // Which of the strong candidates the player actually considers this hand.
    let picks = cands;
    if (sample < cands.length) {
      picks = [];
      const used = new Set();
      while (picks.length < sample) {
        const j = Math.floor(Math.random() * cands.length);
        if (!used.has(j)) { used.add(j); picks.push(cands[j]); }
      }
    }
    let best = null;
    for (const i of picks) {
      const tiles = g.tilesSpelling(words[i]);
      if (!tiles) continue;
      g.stick = tiles;
      const legal = g.stickStatus() === 'valid'; // boss rules apply here
      g.stick = [];
      if (!legal) continue;
      const total = g.scoring.score(tiles).total;
      if (!best || total > best.total) best = { word: words[i], tiles, total };
    }
    if (!best) return null;
    for (const t of best.tiles) g.moveToStick(t.id);
    return best.word;
  }

  // Reroll up to a tray's worth of the lowest-value rack tiles, then fire.
  function rerollLeftovers(g) {
    if (g.rerolls <= 0) return false;
    const pool = g.rack.slice().sort((a, b) => a.value - b.value);
    let moved = 0;
    for (const t of pool) {
      if (g.tray.length >= CFG.TRAY_SLOTS) break;
      if (g.moveToTray(t.id)) moved++;
    }
    return moved > 0 ? g.fireReroll() : false;
  }

  // One round: play best words; reroll to improve when the hand can't keep pace.
  function playRound(g, idx, opts) {
    let safety = 0;
    while (g.plays > 0 && g.roundScore < g.target && safety++ < 60) {
      let word = fastCompose(g, idx, opts);
      let tries = 0;
      while (g.rerolls > 0 && tries++ < opts.rerollTries) {
        const pv = word ? g.previewScore() : null;
        const proj = pv ? pv.total : 0;
        const need = Math.ceil((g.target - g.roundScore) / Math.max(1, g.plays));
        if (word && proj >= need) break;      // on pace — play it
        if (!rerollLeftovers(g)) break;        // out of rerolls / nothing to swap
        word = fastCompose(g, idx, opts);
      }
      if (!word) break;                        // stuck: no legal word, no rerolls
      const { outcome } = g.forge();
      if (outcome !== 'continue') return outcome; // 'won' | 'lost' | 'wonGame'
    }
    return g.roundScore >= g.target ? 'won' : 'lost';
  }

  // A rough "is this Book worth it?" read a decent player might make WITHOUT
  // deep synergy math: rarer is usually stronger, reliable scorers and economy
  // beat niche effects, flexibility/scaling are nice, and there's a light nudge
  // toward pieces that echo what's already on the shelf. Not optimal — just
  // considered.
  function bookValue(g, def) {
    let v = ({ common: 1, uncommon: 2, rare: 3.2 })[def.rarity] || 1;
    const e = def.effect || {};
    if (e.points != null || e.mult != null || e.xMult != null) v += 1.5; // reliable scorer
    if (e.tickets != null || def.roundStart
      || def.trigger === 'roundWin' || def.trigger === 'reroll') v += 1.0; // economy
    if (def.substitute) v += 1.2;   // helps actually form words
    if (def.grow) v += 1.0;         // scales across the run
    if (g.books.shelf.some((b) => b.trigger === def.trigger)) v += 0.6; // light synergy
    if (def.grow && g.books.shelf.some((b) => b.grow)) v += 0.4;
    return v;
  }

  // Considered shop: buy the best-value affordable Books that fit (re-reading
  // after each buy as tickets drop), then improve the deck with one bag if
  // comfortably flush and the deck isn't already bloated.
  function shopPolicy(g, shop) {
    shop.open();
    let guard = 0;
    while (guard++ < 24) {
      const buys = shop.books
        .map((o, i) => ({ o, i, cost: shop.bookCost(o), val: bookValue(g, o.def) }))
        .filter((x) => shop.canAfford(x.cost)
          && (!g.books.isFull || (x.o.sticker && x.o.sticker.noSlot)))
        .sort((a, b) => (b.val - a.val) || (b.cost - a.cost));
      if (buys.length === 0 || !shop.buyBook(buys[0].i)) break;
    }
    if (shop.bags.length && g.tickets >= shop.bags[0].cost + 4 && g.deck.all.length < 120) {
      const res = shop.buyBag(0);
      if (res) {
        const picks = res.candidates.slice().sort((a, b) =>
          ((b.variant ? 2 : 0) + (b.alteration ? 2 : 0) + b.value)
          - ((a.variant ? 2 : 0) + (a.alteration ? 2 : 0) + a.value)
        ).slice(0, CFG.BAG_PICKS);
        shop.finalizeBag(picks);
      }
    }
  }

  // Play one full run on Note / Standard; return how it ended.
  function playRun(dict, idx, opts) {
    const g = new Game(dict);
    // Stationary + side-effect-free: full Book pool, no unlock/achievement
    // churn, no localStorage writes.
    g.unlocks.isUnlocked = () => true;
    g.unlocks.isDeckUnlocked = () => true;
    g.unlocks.notify = () => [];
    g.achievements.notify = () => [];
    g.saveRun = () => {};
    const shop = new Shop(g);
    g.newRun('standard', 0);

    let safety = 0;
    while (safety++ < 120) {
      const outcome = playRound(g, idx, opts);
      if (outcome === 'wonGame') return { win: true, level: g.level, books: g.books.shelf.length };
      if (outcome === 'lost') return { win: false, level: g.level, books: g.books.shelf.length };
      if (g.shopDue) shopPolicy(g, shop);
      g.nextLevel();
    }
    return { win: false, level: g.level, books: g.books.shelf.length, ranAway: true };
  }

  // Fold a raw level->deaths map into readable 6-level boss blocks.
  function blocks(deaths) {
    const bucket = {};
    for (const [lvl, c] of Object.entries(deaths)) {
      const b = Math.ceil(Number(lvl) / CFG.BOSS_EVERY);
      const key = `L${(b - 1) * 6 + 1}-${b * 6}`;
      bucket[key] = (bucket[key] || 0) + c;
    }
    return bucket;
  }

  G.SIM = {
    playRun,
    buildIndex,

    // Accumulate across calls — the tool caps a single call at ~30s, so a big
    // sample is built with reset() then repeated chunk() calls.
    _acc: null,
    DECENT,
    reset() { this._acc = { runs: 0, wins: 0, bookSum: 0, deaths: {} }; return 'reset'; },
    chunk(n = 40, opts = DECENT) {
      if (!this._acc) this.reset();
      const dict = window.LEX.game.dict;
      const idx = buildIndex(dict);
      const a = this._acc;
      const t0 = performance.now();
      for (let i = 0; i < n; i++) {
        const r = playRun(dict, idx, opts);
        a.runs++; a.bookSum += r.books || 0;
        if (r.win) a.wins++;
        else a.deaths[r.level] = (a.deaths[r.level] || 0) + 1;
      }
      return {
        runs: a.runs,
        wins: a.wins,
        winRate: +(100 * a.wins / a.runs).toFixed(1),
        avgBooks: +(a.bookSum / a.runs).toFixed(1),
        lastChunkSec: +((performance.now() - t0) / 1000).toFixed(1),
        deathsByBlock: blocks(a.deaths),
      };
    },

    // One-shot batch of n runs with a given skill profile (default DECENT).
    run(n = 200, opts = DECENT) {
      const dict = window.LEX.game.dict;
      const idx = buildIndex(dict);
      const t0 = performance.now();
      let wins = 0, bookSum = 0;
      const deathHist = {}; // level -> count of losses at that level
      for (let i = 0; i < n; i++) {
        const r = playRun(dict, idx, opts);
        bookSum += r.books || 0;
        if (r.win) wins++;
        else deathHist[r.level] = (deathHist[r.level] || 0) + 1;
      }
      const ms = performance.now() - t0;
      // Compact the death histogram into boss-section buckets for readability.
      const bucket = {};
      for (const [lvl, c] of Object.entries(deathHist)) {
        const b = Math.ceil(Number(lvl) / CFG.BOSS_EVERY); // which 6-level block
        bucket[`L${(b - 1) * 6 + 1}-${b * 6}`] = (bucket[`L${(b - 1) * 6 + 1}-${b * 6}`] || 0) + c;
      }
      return {
        runs: n,
        wins,
        winRate: +(100 * wins / n).toFixed(1),
        avgBooks: +(bookSum / n).toFixed(1),
        msPerRun: +(ms / n).toFixed(0),
        totalSec: +(ms / 1000).toFixed(1),
        deathsByBlock: bucket,
      };
    },
  };
  return 'SIM loaded';
})();
