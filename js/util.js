// util.js — tiny shared helpers used across the engine and UI.

const Util = {

  // Promise-based delay; the scoring sweep is an async chain of these.
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  // In-place Fisher-Yates shuffle; returns the same array for chaining.
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  // Thousands-separated number for score displays.
  fmt(n) {
    return n.toLocaleString('en-US');
  },

  // Round to 2 significant figures: keep the two leading digits, zero the rest
  // (1737 -> 1700, 12480 -> 12000, 640 -> 640). The score-goal rounding rule.
  sig2(n) {
    if (!isFinite(n) || n <= 0) return n > 0 ? n : 0;
    const mag = Math.pow(10, Math.floor(Math.log10(n)) - 1);
    return Math.round(n / mag) * mag;
  },

  // Does the slug at this step spell any letter from `set`? Multi-letter
  // sorts and resolved wildcards count, so Œ registers as containing an E.
  spellsAny(step, set) {
    return [...(step.spells || step.tile.letter)].some((c) => set.includes(c));
  },

  // Random key from an object map (variant/alteration rolls). Pass
  // excludeRare to skip pen-only styles (Fuzzy, Cardstock, ...).
  randomKey(map, excludeRare = false) {
    const keys = Object.keys(map).filter((k) => !excludeRare || !map[k].rare);
    return keys[Math.floor(Math.random() * keys.length)];
  },

  // Animates an element's text from one number to another over `ms`,
  // then resolves. Used for the total count-up in the scoring sweep.
  // setTimeout rather than requestAnimationFrame: rAF stops entirely in a
  // hidden tab, which would leave the scoring sweep (and the game) stuck.
  countUp(el, from, to, ms) {
    return new Promise((resolve) => {
      const start = performance.now();
      const tick = () => {
        const t = Math.min(1, (performance.now() - start) / ms);
        el.textContent = Util.fmt(Math.round(from + (to - from) * t));
        if (t < 1) setTimeout(tick, 16);
        else resolve();
      };
      tick();
    });
  },
};
