// dictionary.js — loads the packed ENABLE1 word list and answers
// "is this a word?" in O(1). The list ships as gzip+base64 (see
// tools/build-dictionary.mjs) and is decompressed here at load time
// via the browser's native DecompressionStream API.

class Dictionary {

  constructor() {
    this.words = null;    // Set<string> of uppercase words, populated by load()
    this.byLength = null; // Map<number, string[]> — used by substitution reads
  }

  // Decode base64 → bytes → gunzip stream → text → Set.
  // Load-bearing: if this fails the game cannot run, so no try/catch here —
  // the boot layer decides how to surface the failure.
  async load(b64) {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream()
      .pipeThrough(new DecompressionStream('gzip'));
    const text = await new Response(stream).text();
    const list = text.split('\n');
    this.words = new Set(list);
    // Group by length once: substitution lookups scan only same-length words,
    // which is bounded and fast — far better than expanding every possible
    // reading of a word (that explodes combinatorially with vowel swaps).
    this.byLength = new Map();
    for (const w of list) {
      if (!this.byLength.has(w.length)) this.byLength.set(w.length, []);
      this.byLength.get(w.length).push(w);
    }
  }

  get size() {
    return this.words ? this.words.size : 0;
  }

  // Case-insensitive membership test; length bounds are enforced here too
  // so callers have a single source of truth for "playable word".
  isValidWord(word) {
    const w = word.toUpperCase();
    return w.length >= CFG.MIN_WORD_LEN
      && w.length <= CFG.MAX_WORD_LEN
      && this.words.has(w);
  }

  // The one matcher behind substitution Books, wildcard sorts and
  // multi-letter sorts: `opts` is a per-POSITION list of acceptable letters.
  // Returns the dictionary word this composition reads as, or null. Scans
  // only same-length words and bails on the first mismatch, so it stays cheap
  // no matter how many positions are open.
  findReadingFromOptions(opts) {
    const list = this.byLength.get(opts.length) || [];
    outer:
    for (const dw of list) {
      for (let i = 0; i < opts.length; i++) {
        if (!opts[i].includes(dw[i])) continue outer;
      }
      return dw;
    }
    return null;
  }

  // Convenience wrapper for a plain letter string plus substitution map.
  findReading(word, subs) {
    const w = word.toUpperCase();
    return this.findReadingFromOptions([...w].map((c) => (subs[c] ? [c, ...subs[c]] : [c])));
  }
}
