// deck.js — the tile pool and its cycle: bag → rack → discard.
// The Deck owns the bag ("case") and discard ("hellbox"); the Game owns
// the rack, stick, and reroll tray. Tiles are stable objects with unique
// ids so the UI can track them across zones.

class Tile {
  // opts: { variant, alteration } — two independent axes, either may be null.
  // Both are scored inside the ScoringEngine choke point (see content.js).
  constructor(letter, { variant = null, alteration = null } = {}) {
    this.id = ++Tile.nextId;
    this.letter = letter; // the glyph on its face — may be a special sort
    this.value = SPECIAL_SLUGS[letter] ? SPECIAL_SLUGS[letter].value : CFG.TILE_VALUES[letter];
    this.variant = variant;       // null | key of VARIANTS
    this.alteration = alteration; // null | key of ALTERATIONS
  }
}
Tile.nextId = 0;

class Deck {

  // distribution: { letter: count } — see CFG.STARTING_DECK.
  constructor(distribution) {
    this.all = []; // the full owned pool; bag/discard/rack are views into it
    for (const [letter, count] of Object.entries(distribution)) {
      for (let i = 0; i < count; i++) this.all.push(new Tile(letter));
    }
    if (CFG.TEST_TILES) this._seedTestTiles();
    this.bag = [];
    this.discard = [];
    this.reset();
  }

  // Testing aid: inject a spread of every variant and alteration (plus some
  // combos) so all the tile art and effects show up in play immediately.
  // Controlled by CFG.TEST_TILES — turn it off for a real run.
  _seedTestTiles() {
    const LETTERS = 'RSTLNEAOICDPMGH';
    const pick = (s) => s[Math.floor(Math.random() * s.length)];
    const variants = Object.keys(VARIANTS);
    const alterations = Object.keys(ALTERATIONS);
    for (const variant of variants) {
      for (let i = 0; i < CFG.TEST_COPIES; i++) this.all.push(new Tile(pick(LETTERS), { variant }));
    }
    for (const alteration of alterations) {
      for (let i = 0; i < CFG.TEST_COPIES; i++) this.all.push(new Tile(pick(LETTERS), { alteration }));
    }
    // A few dual-axis combos to prove they stack.
    for (let i = 0; i < CFG.TEST_COPIES; i++) {
      this.all.push(new Tile(pick(LETTERS), { variant: pick(variants), alteration: pick(alterations) }));
    }
  }

  // End-of-round: every tile (including any held in the rack) returns to
  // the bag for a fresh shuffle. Callers must drop their rack references.
  reset() {
    this.bag = Util.shuffle(this.all.slice());
    this.discard = [];
  }

  // Draw up to n tiles. If the bag empties mid-draw, the discard is
  // reshuffled in and the draw continues — the core deck-builder loop.
  draw(n) {
    const drawn = [];
    while (drawn.length < n) {
      if (this.bag.length === 0) {
        if (this.discard.length === 0) break; // pool exhausted; caller copes
        this.bag = Util.shuffle(this.discard);
        this.discard = [];
      }
      drawn.push(this.bag.pop());
    }
    return drawn;
  }

  // Played tiles land here.
  toDiscard(tiles) {
    this.discard.push(...tiles);
  }

  // Rerolled tiles return straight to the bag (not the hellbox) and the
  // bag is reshuffled so they're buried, not sitting on top.
  toBag(tiles) {
    this.bag.push(...tiles);
    Util.shuffle(this.bag);
  }

  // Shop purchase: the tile joins the pool; it enters play at the next
  // round's reset() shuffle.
  addTile(tile) {
    this.all.push(tile);
  }

  // Hellbox Purge: permanently remove tiles from the pool.
  destroy(tiles) {
    for (const t of tiles) {
      const i = this.all.indexOf(t);
      if (i !== -1) this.all.splice(i, 1);
    }
  }
}
