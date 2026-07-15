// dictionary.js — loads the packed ENABLE1 word list and answers
// "is this a word?" in O(1). The list ships as gzip+base64 (see
// tools/build-dictionary.mjs) and is decompressed here at load time
// via the browser's native DecompressionStream API.

class Dictionary {

  constructor() {
    this.words = null; // Set<string> of uppercase words, populated by load()
  }

  // Decode base64 → bytes → gunzip stream → text → Set.
  // Load-bearing: if this fails the game cannot run, so no try/catch here —
  // the boot layer decides how to surface the failure.
  async load(b64) {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const stream = new Blob([bytes]).stream()
      .pipeThrough(new DecompressionStream('gzip'));
    const text = await new Response(stream).text();
    this.words = new Set(text.split('\n'));
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
}
