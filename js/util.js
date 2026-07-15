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
