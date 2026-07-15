// shop.js — the Foundry. Generates offers (Books, tiles, consumables),
// handles buy/sell/restock. Pure logic; rendering lives in ui.js.

class Shop {

  constructor(game) {
    this.game = game;
    this.books = [];
    this.bags = [];
    this.consumables = [];
    this.lastBagGot = null; // tiles from the most recent bag, for the UI toast
  }

  open() {
    this.stock();
  }

  stock() {
    this.books = this.pickBooks(CFG.SHOP_BOOK_OFFERS);
    this.bags = this.pickBags(CFG.SHOP_BAG_OFFERS);
    this.consumables = this.pickConsumables(CFG.SHOP_CONSUMABLE_OFFERS);
  }

  // Rarity-weighted draw of Books the player doesn't own, no duplicates.
  pickBooks(n) {
    const pool = BOOKS.filter((b) => !this.game.books.owns(b.id));
    const out = [];
    while (out.length < n && pool.length > 0) {
      const weighted = [];
      for (const b of pool) {
        for (let i = 0; i < CFG.RARITY_WEIGHTS[b.rarity]; i++) weighted.push(b);
      }
      const pick = weighted[Math.floor(Math.random() * weighted.length)];
      out.push(pick);
      pool.splice(pool.indexOf(pick), 1);
    }
    return out;
  }

  // Distinct random tile-bag offers, rarity-weighted like Books.
  pickBags(n) {
    const pool = BAGS.slice();
    const out = [];
    while (out.length < n && pool.length > 0) {
      const weighted = [];
      for (const b of pool) {
        for (let i = 0; i < CFG.RARITY_WEIGHTS[b.rarity]; i++) weighted.push(b);
      }
      const pick = weighted[Math.floor(Math.random() * weighted.length)];
      out.push(pick);
      pool.splice(pool.indexOf(pick), 1);
    }
    return out;
  }

  // Distinct random consumable offers.
  pickConsumables(n) {
    return Util.shuffle(CONSUMABLES.slice()).slice(0, n);
  }

  canAfford(cost) {
    return this.game.tickets >= cost;
  }

  // --- Transactions: each returns false with a reason left to the UI ------

  buyBook(index) {
    const def = this.books[index];
    if (!def || !this.canAfford(def.cost) || this.game.books.isFull) return false;
    this.game.tickets -= def.cost;
    this.game.books.add(def);
    this.books.splice(index, 1);
    return true;
  }

  // Buy a bag: draw `count` letters from its weighted pool, cast each as a
  // Tile (styled bags roll a variant and/or alteration), add them to the deck.
  // Returns the granted tiles (also stashed for the UI toast), or false.
  buyBag(index) {
    const bag = this.bags[index];
    if (!bag || !this.canAfford(bag.cost)) return false;
    this.game.tickets -= bag.cost;

    const got = [];
    for (let k = 0; k < bag.count; k++) {
      const letter = bag.pool[Math.floor(Math.random() * bag.pool.length)];
      const opts = {};
      if (bag.styled) {
        if (Math.random() < CFG.SORTS_VARIANT_CHANCE) opts.variant = this.randomKey(VARIANTS);
        if (Math.random() < CFG.SORTS_ALTER_CHANCE) opts.alteration = this.randomKey(ALTERATIONS);
      }
      const tile = new Tile(letter, opts);
      this.game.deck.addTile(tile);
      got.push(tile);
    }
    this.lastBagGot = got;
    this.bags.splice(index, 1);
    return got;
  }

  randomKey(map) {
    const keys = Object.keys(map);
    return keys[Math.floor(Math.random() * keys.length)];
  }

  buyConsumable(index) {
    const def = this.consumables[index];
    if (!def || !this.canAfford(def.cost)) return false;
    if (!this.game.addConsumable(def)) return false; // slots full
    this.game.tickets -= def.cost;
    this.consumables.splice(index, 1);
    return true;
  }

  sellBook(id) {
    const def = this.game.books.remove(id);
    if (!def) return false;
    this.game.tickets += this.game.books.sellValue(def);
    return true;
  }

  restock() {
    if (!this.canAfford(CFG.RESTOCK_COST)) return false;
    this.game.tickets -= CFG.RESTOCK_COST;
    this.stock();
    return true;
  }
}
