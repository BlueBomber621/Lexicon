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
    this.game.decayRerollCost(); // a fresh shop relaxes the reroll price
    // The Coupon Book grants one free purchase per Foundry visit.
    this.game.freePurchase = this.game.books.owns('coupon-book');
    this.stock();
  }

  stock() {
    this.books = this.pickBooks(CFG.SHOP_BOOK_OFFERS);
    this.bags = this.pickBags(CFG.SHOP_BAG_OFFERS);
    this.consumables = this.pickConsumables(CFG.SHOP_CONSUMABLE_OFFERS);
    this.penPack = true; // one pen pack per shop visit
  }

  // Rarity-weighted draw of UNLOCKED Books the player doesn't own, no
  // duplicates. Each offer may roll a sticker (see STICKERS in content.js);
  // offers are { def, sticker } where sticker may be null.
  pickBooks(n) {
    const pool = BOOKS.filter((b) =>
      !this.game.books.owns(b.id) && this.game.unlocks.isUnlocked(b));
    const out = [];
    while (out.length < n && pool.length > 0) {
      const weighted = [];
      for (const b of pool) {
        for (let i = 0; i < CFG.RARITY_WEIGHTS[b.rarity]; i++) weighted.push(b);
      }
      const pick = weighted[Math.floor(Math.random() * weighted.length)];
      out.push({ def: pick, sticker: this.rollSticker() });
      pool.splice(pool.indexOf(pick), 1);
    }
    return out;
  }

  rollSticker() {
    if (Math.random() >= CFG.STICKER_CHANCE) return null;
    // Donated (slot-free) Books pile onto the shelf without taking a slot, so
    // once you already hold DONATED_SOFTCAP of them the sticker turns rare —
    // keeps the shelf from ballooning to twenty books.
    const donated = this.game.books.shelf.filter((b) => {
      const s = this.game.books.stickerOf(b);
      return s && s.noSlot;
    }).length;
    const weighted = [];
    for (const [id, w] of Object.entries(CFG.STICKER_WEIGHTS)) {
      const weight = (id === 'donated' && donated >= CFG.DONATED_SOFTCAP) ? 1 : w;
      for (let i = 0; i < weight; i++) weighted.push(id);
    }
    return STICKERS[weighted[Math.floor(Math.random() * weighted.length)]];
  }

  // A Book offer's price after its sticker (Discount Sticker).
  bookCost(offer) {
    return Math.max(1, offer.def.cost + (offer.sticker ? (offer.sticker.costDelta || 0) : 0));
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

  // Distinct weighted consumable offers — the pricey slips (Sticker, The
  // Typewriter) surface far less often than the workaday ones.
  pickConsumables(n) {
    const pool = CONSUMABLES.slice();
    const out = [];
    while (out.length < n && pool.length > 0) {
      const weighted = [];
      for (const c of pool) for (let i = 0; i < (c.weight || 1); i++) weighted.push(c);
      const pick = weighted[Math.floor(Math.random() * weighted.length)];
      out.push(pick);
      pool.splice(pool.indexOf(pick), 1);
    }
    return out;
  }

  canAfford(cost) {
    return this.game.freePurchase || this.game.tickets >= cost;
  }

  // Deduct a purchase's cost — unless the Coupon Book's free buy is available,
  // which this consumes instead.
  spend(cost) {
    if (this.game.freePurchase) {
      this.game.freePurchase = false;
      this.game.note('Coupon Book — one free purchase!');
      return;
    }
    this.game.tickets -= cost;
  }

  // --- Transactions: each returns false with a reason left to the UI ------

  buyBook(index) {
    const offer = this.books[index];
    if (!offer) return false;
    const cost = this.bookCost(offer);
    const donated = offer.sticker && offer.sticker.noSlot;
    if (!this.canAfford(cost)) return false;
    if (this.game.books.isFull && !donated) return false;
    // Discount Stickers don't survive the sale; every other kind sticks.
    const keep = offer.sticker && !offer.sticker.removedOnBuy ? offer.sticker.id : null;
    if (!this.game.books.add(offer.def, keep)) return false;
    this.spend(cost);
    this.books.splice(index, 1);
    this.game.progress('buy', { kind: 'book' });
    return true;
  }

  // --- Pen pack -----------------------------------------------------------
  // Pay, pull PEN_TILE_PULLS random tiles from the whole bag, offer
  // PEN_CHOICES random pens. The UI collects one pick of each and calls
  // finalizePen(tile, pen).
  buyPenPack() {
    if (!this.penPack || !this.canAfford(CFG.PEN_PACK_COST)) return false;
    this.spend(CFG.PEN_PACK_COST);
    this.penPack = false;
    this.game.progress('buy', { kind: 'pen' });
    const pool = this.game.deck.all.slice();
    const tiles = [];
    for (let i = 0; i < CFG.PEN_TILE_PULLS && pool.length; i++) {
      tiles.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    // Common pens weigh triple; the rare trio (Double-Tip, Highlighter,
    // Rough) shows up only occasionally. No duplicate offers.
    const weighted = [];
    for (const p of PENS) for (let i = 0; i < (p.rare ? 1 : 3); i++) weighted.push(p);
    const pens = [];
    while (pens.length < CFG.PEN_CHOICES) {
      const pick = weighted[Math.floor(Math.random() * weighted.length)];
      if (!pens.includes(pick)) pens.push(pick);
    }
    return { tiles, pens };
  }

  // Ink the chosen tile: alteration pens rewrite its alteration, variant
  // pens recast its material — replacing whatever was there before.
  finalizePen(tile, pen) {
    if (pen.alteration) tile.alteration = pen.alteration;
    if (pen.variant) tile.variant = pen.variant;
    this.game.runPensUsed = (this.game.runPensUsed || 0) + 1;
    this.game.progress('pen', { penId: pen.id, tile });
  }

  // Buy a bag: pay, then roll its `options` candidate tiles — letter from the
  // weighted pool, variant/alteration rolled independently per the bag's style
  // chances. Nothing joins the deck yet; the player picks CFG.BAG_PICKS of
  // them on the selection screen, then finalizeBag() commits the keepers.
  buyBag(index) {
    const bag = this.bags[index];
    if (!bag || !this.canAfford(bag.cost)) return false;
    this.spend(bag.cost);
    this.game.progress('buy', { kind: 'bag' });
    this.game.progress('bag', { bagId: bag.id }); // The Switch unlocks on Peculiars

    const candidates = Array.from({ length: bag.options }, () => {
      const letter = bag.pool[Math.floor(Math.random() * bag.pool.length)];
      const opts = {};
      // Rare styles (Fuzzy, Highlighted, Cardstock) are pen-only.
      if (Math.random() < bag.style.variant) opts.variant = Util.randomKey(VARIANTS, true);
      if (Math.random() < bag.style.alteration) opts.alteration = Util.randomKey(ALTERATIONS, true);
      return new Tile(letter, opts);
    });
    this.bags.splice(index, 1);
    return { bag, candidates };
  }

  // The keepers from the selection screen join the deck (next round's shuffle).
  // Marked as bought (The Sort Merchant pays on them); styled keepers feed
  // The Gilded Case's unlock counter.
  finalizeBag(tiles) {
    let styled = 0;
    for (const t of tiles) {
      t.bought = true;
      if (t.variant || t.alteration) styled++;
      this.game.deck.addTile(t);
    }
    this.game.newUnlocks.push(...this.game.unlocks.notify('bagcast', { styled }));
  }

  randomKey(map) { return Util.randomKey(map); } // kept for call-site brevity

  buyConsumable(index) {
    const def = this.consumables[index];
    if (!def || !this.canAfford(def.cost)) return false;
    if (!this.game.addConsumable(def)) return false; // slots full
    this.spend(def.cost);
    this.consumables.splice(index, 1);
    this.game.progress('buy', { kind: 'consumable' });
    return true;
  }

  sellBook(id) {
    const def = this.game.books.remove(id);
    if (!def) return false;
    // The Business Contract pays sales in points, not tickets: while it's
    // shelved a sale refunds nothing but grows the Contract instead.
    if (!this.game.books.owns('business-contract')) {
      this.game.tickets += this.game.books.sellValue(def);
    }
    this.game.books.dispatchGrow('sell', { def });
    return true;
  }

  restock() {
    // A reroll isn't a "purchase" — it can't ride the Coupon Book's free buy,
    // so it checks real tickets rather than canAfford().
    const cost = this.game.rerollCost;
    if (this.game.tickets < cost) return false;
    this.game.tickets -= cost;
    this.game.rerollCost += CFG.RESTOCK_STEP; // each reroll this shop costs more
    this.stock();
    return true;
  }
}
