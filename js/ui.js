// ui.js — all DOM rendering and input. Reads game state, never computes
// rules itself. Owns two pieces of choreography: the scoring sweep (which
// replays the steps the ScoringEngine produced) and the reroll tray's
// auto-fire beat.

class UI {

  constructor(game) {
    this.game = game;
    this.shop = new Shop(game);
    this.busy = false; // true while the scoring sweep / tray auto-fire runs

    // Cache every element we touch once.
    const ids = [
      'stat-level', 'stat-target', 'stat-score', 'stat-plays', 'stat-rerolls',
      'stat-tickets', 'stat-bag', 'stat-discard', 'target-fill',
      'boss-panel', 'boss-name', 'boss-desc',
      'books-count', 'books-list', 'cons-list',
      'ro-word', 'ro-math', 'ro-points', 'ro-mult', 'ro-eq', 'ro-total',
      'stick', 'rack', 'tray', 'btn-forge', 'btn-reroll', 'btn-clear',
      'overlay', 'ov-title', 'ov-body', 'ov-btn',
      'shop', 'shop-card', 'toast', 'btn-mute',
      'btn-library', 'library', 'library-card',
    ];
    this.els = {};
    for (const id of ids) this.els[id] = document.getElementById(id);

    this.els['btn-forge'].addEventListener('click', () => this.onForge());
    this.els['btn-reroll'].addEventListener('click', () => this.onReroll());
    this.els['btn-clear'].addEventListener('click', () => this.onClear());
    this.els['ov-btn'].addEventListener('click', () => this.onOverlayButton());
    this.els['btn-mute'].addEventListener('click', () => this.onMute());
    this.els['btn-library'].addEventListener('click', () => this.toggleLibrary());
    this.els['library-card'].addEventListener('click', (e) => {
      if (e.target.closest('[data-act="close-library"]')) this.toggleLibrary();
    });
    // One delegated listener covers every shop button.
    this.els['shop-card'].addEventListener('click', (e) => this.onShopClick(e));
    this.els['cons-list'].addEventListener('click', (e) => this.onConsumableClick(e));
    document.addEventListener('keydown', (e) => this.onKey(e));
  }

  // --- Rendering -------------------------------------------------------

  render() {
    this.renderStats();
    this.renderStick();
    this.renderRack();
    this.renderTray();
    this.renderReadout();
    this.renderControls();
    this.renderShelf();
    this.announceUnlocks();
  }

  // Drain the game's unlock queue into toasts + a fanfare.
  announceUnlocks() {
    if (this.game.newUnlocks.length === 0) return;
    const names = this.game.newUnlocks.splice(0).map((b) => b.name).join(', ');
    Sfx.unlock();
    this.toast(`BOOK UNLOCKED — ${names}`);
    this.els['btn-library'].textContent =
      `LIBRARY ${this.game.unlocks.unlockedCount}/${BOOKS.length}`;
  }

  // A Book's cover art, at any size (DRY across shop, shelf, and library).
  bookArt(book, cls = '') {
    return `<span class="book-icon r-${book.rarity} ${cls}">` +
      `<svg viewBox="0 0 48 60"><use href="#icon-book-${book.id}"/></svg></span>`;
  }

  renderStats() {
    const g = this.game;
    this.els['stat-level'].textContent = g.level + (g.isBossLevel ? ' ✦' : '');
    this.els['stat-target'].textContent = Util.fmt(g.target);
    this.els['stat-score'].textContent = Util.fmt(g.roundScore);
    this.els['stat-tickets'].textContent = Util.fmt(g.tickets);
    this.els['stat-bag'].textContent = g.deck.bag.length;
    this.els['stat-discard'].textContent = g.deck.discard.length;
    this.els['stat-plays'].innerHTML = this.pips(g.plays, Math.max(g.plays, CFG.PLAYS_PER_ROUND));
    this.els['stat-rerolls'].innerHTML = this.pips(g.rerolls, Math.max(g.rerolls, CFG.REROLLS_PER_ROUND));
    this.els['target-fill'].style.width =
      Math.min(100, (g.roundScore / g.target) * 100) + '%';

    // Boss plaque only during a boss round.
    this.els['boss-panel'].classList.toggle('hidden', !g.boss);
    if (g.boss) {
      this.els['boss-name'].textContent = g.boss.name;
      this.els['boss-desc'].textContent = g.boss.desc;
    }
  }

  // "●●○" — remaining charges lit, spent ones dimmed.
  pips(remaining, max) {
    let out = '';
    for (let i = 0; i < max; i++) {
      out += i < remaining ? '●' : '<span class="spent-pip">●</span>';
    }
    return out;
  }

  // A slug element; shared by rack, stick, and tray rendering (DRY).
  // Carries both axes: variant (material) and alteration (styling) classes.
  tileEl(tile) {
    const el = document.createElement('div');
    const v = VARIANTS[tile.variant];
    const a = ALTERATIONS[tile.alteration];
    el.className = 'tile' + (v ? ' ' + v.cls : '') + (a ? ' ' + a.cls : '');
    el.dataset.tileId = tile.id;
    const tips = [];
    if (v) tips.push(`${v.name} — ${v.desc}`);
    if (a) tips.push(`${a.name} — ${a.desc}`);
    if (tips.length) el.title = tips.join('\n');
    el.innerHTML =
      `<span class="letter">${tile.letter}</span><span class="value">${tile.value}</span>`;
    return el;
  }

  // One-line summary of the tiles a bag produced, for the purchase toast.
  describeBag(tiles) {
    return 'Cast: ' + tiles.map((t) => {
      const marks = [VARIANTS[t.variant], ALTERATIONS[t.alteration]]
        .filter(Boolean).map((x) => x.name);
      return t.letter + (marks.length ? ` (${marks.join(' + ')})` : '');
    }).join(', ');
  }

  // Shared slot-strip renderer for the stick and the tray (DRY).
  renderSlots(container, tiles, slotCount, onTileClick) {
    container.innerHTML = '';
    for (let i = 0; i < slotCount; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      const tile = tiles[i];
      if (tile) {
        const el = this.tileEl(tile);
        el.addEventListener('click', () => onTileClick(tile));
        slot.appendChild(el);
      }
      container.appendChild(slot);
    }
  }

  renderStick() {
    this.renderSlots(this.els['stick'], this.game.stick, CFG.STICK_SLOTS,
      (tile) => this.onStickTileClick(tile));
  }

  renderTray() {
    this.renderSlots(this.els['tray'], this.game.tray, CFG.TRAY_SLOTS,
      (tile) => this.onTrayTileClick(tile));
  }

  renderRack() {
    const rackEl = this.els['rack'];
    rackEl.innerHTML = '';
    for (const tile of this.game.rack) {
      const el = this.tileEl(tile);
      el.addEventListener('click', (e) => this.onRackTileClick(tile, e));
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.onSendToTray(tile);
      });
      rackEl.appendChild(el);
    }
  }

  renderReadout() {
    const status = this.game.stickStatus();
    const wordEl = this.els['ro-word'];
    const mathEl = this.els['ro-math'];
    this.els['ro-eq'].classList.add('hidden'); // total only appears during the sweep

    if (status === 'empty') {
      wordEl.textContent = 'SET TYPE TO FORGE A WORD';
      wordEl.className = 'empty';
      mathEl.classList.add('hidden');
      return;
    }

    wordEl.textContent = this.game.stickWord();
    wordEl.className = status; // 'valid' | 'invalid'

    const preview = this.game.previewScore();
    if (preview) {
      this.els['ro-points'].textContent = Util.fmt(preview.points);
      this.els['ro-mult'].textContent = Util.fmt(preview.mult);
      mathEl.classList.remove('hidden');
    } else {
      mathEl.classList.add('hidden');
    }
  }

  renderControls() {
    const g = this.game;
    this.els['btn-forge'].disabled = this.busy || g.stickStatus() !== 'valid';
    this.els['btn-reroll'].textContent = `REROLL (${g.rerolls})`;
    this.els['btn-reroll'].disabled = this.busy || g.rerolls === 0 || g.tray.length === 0;
    this.els['btn-clear'].disabled = this.busy || g.stick.length === 0;
  }

  // Sidebar shelf panels: Books and consumables.
  renderShelf() {
    const g = this.game;
    this.els['books-count'].textContent = `${g.books.shelf.length}/${CFG.BOOK_SLOTS}`;
    this.els['books-list'].innerHTML = g.books.shelf.length === 0 ? '&mdash;'
      : g.books.shelf.map((b) =>
          `<div class="shelf-row" title="${b.desc}">` +
          `${this.bookArt(b, 'book-icon-sm')} ${b.name}</div>`
        ).join('');

    this.els['cons-list'].innerHTML = g.consumables.length === 0 ? '&mdash;'
      : g.consumables.map((c, i) =>
          `<div class="shelf-row" title="${c.desc}">${c.name}` +
          `<button class="btn btn-tiny" data-use="${i}">USE</button></div>`
        ).join('');

    this.els['btn-library'].textContent =
      `LIBRARY ${g.unlocks.unlockedCount}/${BOOKS.length}`;
  }

  toast(msg) {
    const el = this.els['toast'];
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  }

  // --- Input -----------------------------------------------------------

  onRackTileClick(tile, e) {
    if (this.busy) return;
    if (e && e.shiftKey) return this.onSendToTray(tile);
    if (this.game.moveToStick(tile.id)) Sfx.click();
    this.render();
  }

  onStickTileClick(tile) {
    if (this.busy) return;
    this.game.returnToRack(tile.id);
    Sfx.click();
    this.render();
  }

  onTrayTileClick(tile) {
    if (this.busy) return;
    this.game.trayToRack(tile.id);
    Sfx.click();
    this.render();
  }

  // Stage a tile for reroll; a full tray fires automatically after a beat.
  async onSendToTray(tile) {
    if (this.busy) return;
    if (this.game.rerolls === 0) return this.toast('No rerolls left this round');
    if (!this.game.moveToTray(tile.id)) return;
    Sfx.click();
    this.render();
    if (this.game.tray.length === CFG.TRAY_SLOTS) {
      this.busy = true;
      this.renderControls();
      await Util.sleep(CFG.ANIM.TRAY_FIRE); // let the 3rd slug visibly land
      this.busy = false;
      this.onReroll();
    }
  }

  onReroll() {
    if (this.busy) return;
    if (this.game.tray.length === 0) return this.toast('Right-click tiles into the tray first');
    if (this.game.fireReroll()) {
      Sfx.reroll();
      this.render();
    }
  }

  onClear() {
    if (this.busy) return;
    this.game.clearStick();
    this.render();
  }

  onMute() {
    Sfx.muted = !Sfx.muted;
    this.els['btn-mute'].textContent = Sfx.muted ? 'SOUND OFF' : 'SOUND ON';
    Sfx.click();
  }

  onConsumableClick(e) {
    const btn = e.target.closest('[data-use]');
    if (!btn || this.busy) return;
    const item = this.game.consumables[Number(btn.dataset.use)];
    if (this.game.useConsumable(Number(btn.dataset.use))) {
      Sfx.buy();
      this.toast(`${item.name} used`);
    } else {
      Sfx.invalid();
      // The one consumable that can refuse is the tray-based purge.
      this.toast(item && item.id === 'hellbox-purge'
        ? 'Purge needs tiles in the tray (and a deck above minimum size)'
        : 'Cannot use that now');
    }
    this.render();
  }

  onKey(e) {
    if (this.busy) return;

    // Library open: Escape (or Enter) closes it, everything else is ignored.
    if (!this.els['library'].classList.contains('hidden')) {
      if (e.key === 'Escape' || e.key === 'Enter') this.toggleLibrary();
      return;
    }
    // Overlay open: Enter advances.
    if (!this.els['overlay'].classList.contains('hidden')) {
      if (e.key === 'Enter') this.onOverlayButton();
      return;
    }
    if (!this.els['shop'].classList.contains('hidden')) return;

    if (e.key === 'Enter') {
      if (this.game.stickStatus() === 'invalid') Sfx.invalid();
      this.onForge();
    } else if (e.key === ' ') {
      e.preventDefault();
      this.onReroll();
    } else if (e.key === 'Backspace') {
      const last = this.game.stick[this.game.stick.length - 1];
      if (last) { this.game.returnToRack(last.id); Sfx.click(); this.render(); }
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      // Type to compose: first rack tile with that letter goes to the stick.
      const tile = this.game.rack.find((t) => t.letter === e.key.toUpperCase());
      if (tile) { this.game.moveToStick(tile.id); Sfx.click(); this.render(); }
    }
  }

  // --- Forge + scoring sweep ---------------------------------------------

  async onForge() {
    if (this.busy || this.game.stickStatus() !== 'valid') return;
    this.busy = true;
    this.renderControls();

    const { result, outcome } = this.game.forge();
    await this.playScoringSweep(result);

    this.busy = false;
    this.render();

    if (outcome === 'won') { Sfx.win(); this.showOverlay('won'); }
    else if (outcome === 'lost') { Sfx.lose(); this.showOverlay('lost'); }
  }

  // The signature moment: each slug flares copper left→right as points
  // climb, the mult flashes press-red, then the total counts up.
  async playScoringSweep(result) {
    const A = CFG.ANIM;
    const tileEls = [...this.els['stick'].querySelectorAll('.tile')];

    // Reset the readout so the points visibly climb from zero.
    this.els['ro-points'].textContent = '0';
    this.els['ro-mult'].textContent = Util.fmt(result.mult);
    this.els['ro-math'].classList.remove('hidden');

    for (let i = 0; i < result.steps.length; i++) {
      const el = tileEls[i];
      if (el) el.classList.add('flare', 'scored');
      Sfx.letter(i);
      this.els['ro-points'].textContent = Util.fmt(result.steps[i].runningPoints);
      await Util.sleep(A.LETTER_STEP);
    }

    // Mult flash (press-red), then the total multiplies out.
    const multEl = this.els['ro-mult'];
    multEl.classList.add('flare');
    Sfx.mult();
    await Util.sleep(A.MULT_HOLD);
    multEl.classList.remove('flare');

    this.els['ro-eq'].classList.remove('hidden');
    Sfx.total();
    await Util.countUp(this.els['ro-total'], 0, result.total, A.TOTAL_COUNT);
    this.renderStats(); // round score + progress bar catch up
    await Util.sleep(A.TOTAL_HOLD);

    // Spent slugs drop off to the hellbox.
    for (const el of tileEls) el.classList.add('spent');
    await Util.sleep(A.SPEND);
  }

  // --- Overlay (round end / game over) -------------------------------------

  showOverlay(kind) {
    const g = this.game;
    if (kind === 'won') {
      this.els['ov-title'].textContent = g.isBossLevel ? 'BOSS DEFEATED' : 'PRESS RUN COMPLETE';
      this.els['ov-body'].innerHTML =
        `Level ${g.level} cleared — <b>${Util.fmt(g.roundScore)}</b> / ${Util.fmt(g.target)}<br>` +
        `Longest word set: <b>${g.roundLongest}</b> letters<br>` +
        `<span class="big-tickets">+${g.lastTicketsEarned} TICKETS</span>`;
      this.els['ov-btn'].textContent = g.shopDue ? 'TO THE FOUNDRY' : 'NEXT LEVEL';
    } else {
      const s = g.stats;
      this.els['ov-title'].textContent = 'OUT OF PRINT';
      this.els['ov-body'].innerHTML =
        `The run ends at level <b>${g.level}</b>.<br>` +
        `Words forged: <b>${s.wordsForged}</b> · Bosses beaten: <b>${s.bossesBeaten}</b><br>` +
        `Best word: <b>${s.bestWord}</b> (${Util.fmt(s.bestScore)})<br>` +
        `Tickets earned: <b>${Util.fmt(s.ticketsEarnedTotal)}</b> · Deck size: <b>${g.deck.all.length}</b>`;
      this.els['ov-btn'].textContent = 'NEW RUN';
    }
    this.overlayKind = kind;
    this.els['overlay'].classList.remove('hidden');
  }

  onOverlayButton() {
    this.els['overlay'].classList.add('hidden');
    if (this.overlayKind === 'won') {
      if (this.game.shopDue) {
        this.shop.open();
        this.renderShop();
        this.els['shop'].classList.remove('hidden');
        return; // nextLevel happens when the shop closes
      }
      this.game.nextLevel();
    } else {
      this.game.newRun();
    }
    this.render();
  }

  // --- The Foundry (shop) ---------------------------------------------------

  renderShop() {
    const g = this.game;
    const s = this.shop;
    const tk = (n) => `${n} TK`;

    const bookCards = s.books.length === 0 ? '<p class="sold-out">Sold out.</p>'
      : s.books.map((b, i) => {
          const blocked = g.books.isFull ? 'SHELF FULL' : (!s.canAfford(b.cost) ? tk(b.cost) : null);
          return `<div class="shop-card shop-card-book">
            ${this.bookArt(b)}
            <h4>${b.name}</h4>
            <div class="rarity r-${b.rarity}">${b.rarity.toUpperCase()}</div>
            <div class="desc">${b.desc}</div>
            ${b.flavor ? `<div class="flavor">${b.flavor}</div>` : ''}
            <button class="btn btn-buy" data-act="book" data-i="${i}" ${blocked ? 'disabled' : ''}>
              ${blocked || 'BUY · ' + tk(b.cost)}</button>
          </div>`;
        }).join('');

    const bagCards = s.bags.length === 0 ? '<p class="sold-out">Sold out.</p>'
      : s.bags.map((b, i) => `<div class="shop-card shop-card-bag">
          <div class="bag-icon r-${b.rarity}"><svg viewBox="0 0 48 48"><use href="#${b.icon}"/></svg></div>
          <h4>${b.name}</h4>
          <div class="rarity r-${b.rarity}">${b.rarity.toUpperCase()} · ${b.count} TILES</div>
          <div class="desc">${b.desc}</div>
          <button class="btn btn-buy" data-act="bag" data-i="${i}"
            ${s.canAfford(b.cost) ? '' : 'disabled'}>BUY · ${tk(b.cost)}</button>
        </div>`).join('');

    const consCards = s.consumables.length === 0 ? '<p class="sold-out">Sold out.</p>'
      : s.consumables.map((c, i) => {
          const blocked = g.consumables.length >= CFG.CONSUMABLE_SLOTS ? 'POCKETS FULL'
            : (!s.canAfford(c.cost) ? tk(c.cost) : null);
          return `<div class="shop-card">
            <h4>${c.name}</h4>
            <div class="desc">${c.desc}</div>
            <button class="btn btn-buy" data-act="cons" data-i="${i}" ${blocked ? 'disabled' : ''}>
              ${blocked || 'BUY · ' + tk(c.cost)}</button>
          </div>`;
        }).join('');

    const shelfRows = g.books.shelf.length === 0 ? '<p class="sold-out">Your shelf is empty.</p>'
      : g.books.shelf.map((b) => `<div class="sell-row">
          <span>${this.bookArt(b, 'book-icon-sm')} <b>${b.name}</b> — ${b.desc}</span>
          <button class="btn btn-buy" data-act="sell" data-id="${b.id}">SELL · ${tk(g.books.sellValue(b))}</button>
        </div>`).join('');

    this.els['shop-card'].innerHTML = `
      <div class="shop-h">
        <h2>THE FOUNDRY</h2>
        <div class="shop-tickets">${Util.fmt(g.tickets)} TICKETS</div>
      </div>
      <div class="shop-section-title">BOOKS — persistent presses (${g.books.shelf.length}/${CFG.BOOK_SLOTS} shelved)</div>
      <div class="shop-row">${bookCards}</div>
      <div class="shop-section-title">TILE BAGS — random slugs join your deck next round</div>
      <div class="shop-row">${bagCards}</div>
      <div class="shop-section-title">SUNDRIES — single use (${g.consumables.length}/${CFG.CONSUMABLE_SLOTS} held)</div>
      <div class="shop-row">${consCards}</div>
      <div class="shop-section-title">YOUR SHELF — sell for half</div>
      ${shelfRows}
      <div class="shop-foot">
        <button class="btn btn-buy" data-act="restock" ${s.canAfford(CFG.RESTOCK_COST) ? '' : 'disabled'}>
          RESTOCK · ${tk(CFG.RESTOCK_COST)}</button>
        <button class="btn btn-primary" data-act="close">NEXT LEVEL &rarr;</button>
      </div>`;
  }

  // --- The Library (Book collection) ----------------------------------------

  toggleLibrary() {
    const lib = this.els['library'];
    if (lib.classList.contains('hidden')) {
      this.renderLibrary();
      lib.classList.remove('hidden');
    } else {
      lib.classList.add('hidden');
    }
    Sfx.click();
  }

  renderLibrary() {
    const g = this.game;
    const rarityOrder = { common: 0, uncommon: 1, rare: 2 };
    const sorted = BOOKS.slice().sort((a, b) =>
      rarityOrder[a.rarity] - rarityOrder[b.rarity] || a.name.localeCompare(b.name));

    const cards = sorted.map((b) => {
      const unlocked = g.unlocks.isUnlocked(b);
      const owned = g.books.owns(b.id);
      return `<div class="lib-card ${unlocked ? '' : 'locked'}">
        ${this.bookArt(b, 'book-icon-lg')}
        <div class="lib-name">${b.name}${owned ? ' <span class="lib-owned">&#9679; SHELVED</span>' : ''}</div>
        <div class="rarity r-${b.rarity}">${b.rarity.toUpperCase()}</div>
        <div class="desc">${unlocked ? b.desc : b.desc}</div>
        ${unlocked
          ? (b.flavor ? `<div class="flavor">${b.flavor}</div>` : '')
          : `<div class="lib-lock">&#128274; ${b.unlock.desc}</div>`}
      </div>`;
    }).join('');

    const p = g.unlocks.profile;
    this.els['library-card'].innerHTML = `
      <div class="shop-h">
        <h2>THE LIBRARY</h2>
        <div class="shop-tickets">${g.unlocks.unlockedCount}/${BOOKS.length} DISCOVERED</div>
      </div>
      <div class="lib-progress">Lifetime: ${p.wordsForged} words forged &middot;
        ${p.rerollsUsed} rerolls &middot; ${p.purgedTiles} tiles destroyed &middot;
        ${p.ticketsEarned} tickets &middot; ${p.bossesBeaten} bosses beaten</div>
      <div class="lib-grid">${cards}</div>
      <div class="shop-foot">
        <span></span>
        <button class="btn btn-primary" data-act="close-library">CLOSE</button>
      </div>`;
  }

  onShopClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const { act, i, id } = btn.dataset;
    let ok = true;

    if (act === 'book') ok = this.shop.buyBook(Number(i));
    else if (act === 'bag') {
      const got = this.shop.buyBag(Number(i));
      ok = !!got;
      if (got) this.toast(this.describeBag(got));
    }
    else if (act === 'cons') ok = this.shop.buyConsumable(Number(i));
    else if (act === 'sell') ok = this.shop.sellBook(id);
    else if (act === 'restock') ok = this.shop.restock();
    else if (act === 'close') {
      this.els['shop'].classList.add('hidden');
      this.game.nextLevel();
      this.render();
      return;
    }

    if (ok) Sfx.buy(); else Sfx.invalid();
    this.renderShop();
    this.renderStats();
    this.renderShelf();
  }
}
