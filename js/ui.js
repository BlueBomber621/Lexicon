// ui.js — all DOM rendering and input. Reads game state, never computes
// rules itself. Owns two pieces of choreography: the scoring sweep (which
// replays the steps the ScoringEngine produced) and the reroll tray's
// auto-fire beat.

class UI {

  constructor(game) {
    this.game = game;
    this.shop = new Shop(game);
    this.busy = false; // true while the scoring sweep / tray auto-fire runs
    this.placed = new Map(); // tileId -> last zone key, for the settle-in animation
    this.pendingBag = null;  // { bag, candidates } awaiting picks
    this.pickerChoice = new Set();

    // Cache every element we touch once.
    const ids = [
      'table',
      'stat-level', 'stat-target', 'stat-score', 'stat-plays', 'stat-rerolls',
      'stat-tickets', 'stat-bag', 'stat-discard', 'target-fill', 'stat-difficulty',
      'boss-panel', 'boss-name', 'boss-desc', 'boss-seal',
      'shelf', 'shelf-count', 'cons-list',
      'penpick', 'penpick-card',
      'ro-word', 'ro-math', 'ro-points', 'ro-mult', 'ro-eq', 'ro-total',
      'stick', 'rack', 'tray', 'btn-forge', 'btn-reroll', 'btn-shuffle', 'btn-clear',
      'overlay', 'ov-title', 'ov-body', 'ov-btn',
      'shop', 'shop-card', 'toast', 'achievements', 'btn-mute',
      'btn-library', 'library', 'library-card',
      'btn-bagcheck', 'bagcheck', 'bagcheck-card',
      'picker', 'picker-card',
      'deckpick', 'deckpick-card',
      'hovertip', 'btn-reset', 'reset', 'reset-card', 'hint',
    ];
    this.els = {};
    for (const id of ids) this.els[id] = document.getElementById(id);

    // Honour the OS "reduce motion" setting: the FX layer (sparks, rings,
    // table shake) goes quiet, while the legible pulses/pops stay.
    this.reduceMotion = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.els['btn-forge'].addEventListener('click', () => this.onForge());
    this.els['btn-reroll'].addEventListener('click', () => this.onReroll());
    this.els['btn-shuffle'].addEventListener('click', () => this.onShuffle());
    this.els['btn-clear'].addEventListener('click', () => this.onClear());
    this.els['ov-btn'].addEventListener('click', () => this.onOverlayButton());
    this.els['btn-mute'].addEventListener('click', () => this.onMute());
    this.els['btn-library'].addEventListener('click', () => this.toggleLibrary());
    this.els['library-card'].addEventListener('click', (e) => {
      if (e.target.closest('[data-act="close-library"]')) this.toggleLibrary();
    });
    this.els['btn-bagcheck'].addEventListener('click', () => this.toggleBagCheck());
    this.els['bagcheck-card'].addEventListener('click', (e) => {
      if (e.target.closest('[data-act="close-bagcheck"]')) this.toggleBagCheck();
    });
    this.els['picker-card'].addEventListener('click', (e) => this.onPickerClick(e));
    this.els['deckpick-card'].addEventListener('click', (e) => this.onDeckPickClick(e));
    this.els['penpick-card'].addEventListener('click', (e) => this.onPenPickClick(e));
    // One delegated listener covers every shop button.
    this.els['shop-card'].addEventListener('click', (e) => this.onShopClick(e));
    this.els['cons-list'].addEventListener('click', (e) => this.onConsumableClick(e));
    this.els['btn-reset'].addEventListener('click', () => this.openReset());
    this.els['reset-card'].addEventListener('click', (e) => this.onResetClick(e));
    document.addEventListener('keydown', (e) => this.onKey(e));
    // Tooltips: hover where a mouse exists, long-press everywhere (hybrid
    // laptops get both), and a tap on empty space dismisses.
    this.tipAnchor = null;
    if (window.matchMedia('(hover: hover)').matches) {
      document.addEventListener('mouseover', (e) => this.onHover(e));
      document.addEventListener('mouseout', (e) => { if (!e.relatedTarget) this.hideTip(); });
    }
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('.tile, .shelf-book')) this.hideTip();
    });
    this.syncHint();
    window.addEventListener('resize', () => this.syncHint());
  }

  // --- Rendering -------------------------------------------------------

  render() {
    this.hideTip(); // any anchor may have been rebuilt; drop the stale tip
    this.renderStats();
    this.renderStick();
    this.renderRack();
    this.renderTray();
    this.renderReadout();
    this.renderControls();
    this.renderShelf();
    this.announceUnlocks();
  }

  // Drain the game's unlock queue into toasts + a fanfare. Plain notes
  // (a sticker landing, etc.) queue up the same way.
  announceUnlocks() {
    this.drainAchievements();
    if (this.game.pendingNotes.length > 0) {
      this.toast(this.game.pendingNotes.splice(0).join('  ·  '));
    }
    if (this.game.newUnlocks.length === 0) return;
    const fresh = this.game.newUnlocks.splice(0);
    const label = (e) => `${e.kind === 'deck' ? 'CASE' : 'BOOK'} UNLOCKED — ${e.name}`;
    Sfx.unlock();
    this.toast(fresh.map(label).join('  ·  '));
    this.els['btn-library'].textContent =
      `LIBRARY ${this.game.unlocks.unlockedCount}/${BOOKS.length}`;
  }

  // Pop up any achievements earned since the last drain (called from the
  // announce path on every render, plus after shop actions that don't render).
  drainAchievements() {
    if (!this.game.newAchievements || this.game.newAchievements.length === 0) return;
    const fresh = this.game.newAchievements.splice(0);
    Sfx.unlock();
    for (const a of fresh) this.showAchievement(a);
  }

  // One corner pop-up — icon, title, task — that fades and removes itself.
  showAchievement(a) {
    const layer = this.els['achievements'];
    if (!layer) return;
    const pop = document.createElement('div');
    pop.className = 'ach-pop';
    pop.innerHTML =
      `<span class="ach-icon"><svg viewBox="0 0 48 48"><use href="#${a.icon}"/></svg></span>` +
      `<div class="ach-text">` +
        `<div class="ach-eyebrow">ACHIEVEMENT UNLOCKED</div>` +
        `<div class="ach-title">${a.title}</div>` +
        `<div class="ach-desc">${a.desc}</div>` +
      `</div>`;
    layer.appendChild(pop);
    setTimeout(() => pop.remove(), 4700); // outlives the ach-life animation
  }

  // A Book's cover art, at any size, with an optional corner sticker
  // (DRY across shop, shelf, and library).
  bookArt(book, cls = '', sticker = null) {
    const stickerHtml = sticker
      ? `<svg class="sticker" viewBox="0 0 20 20"><use href="#icon-sticker-${sticker.id}"/></svg>`
      : '';
    return `<span class="book-icon r-${book.rarity} ${cls}">` +
      `<svg viewBox="0 0 48 60"><use href="#icon-book-${book.id}"/></svg>${stickerHtml}</span>`;
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

    // Difficulty stamp next to the level number.
    const diff = CFG.DIFFICULTIES[g.difficulty || 0];
    this.els['stat-difficulty'].innerHTML =
      `<svg viewBox="0 0 48 48"><use href="#${diff.icon}"/></svg>`;
    this.els['stat-difficulty'].title = `${diff.name} — targets grow ×${diff.mult} as fast`;

    // Boss plaque only during a boss round; seal art from the sprite.
    this.els['boss-panel'].classList.toggle('hidden', !g.boss);
    if (g.boss) {
      this.els['boss-name'].textContent = g.boss.name;
      this.els['boss-desc'].textContent = g.boss.desc;
      this.els['boss-seal'].innerHTML =
        `<svg viewBox="0 0 48 48"><use href="#${g.boss.icon}"/></svg>`;
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

  // A slug element; shared by rack, stick, tray, and picker rendering (DRY).
  // Carries both axes: variant (material) and alteration (styling) classes,
  // plus per-tile float timing (id-seeded so each slug drifts differently).
  tileEl(tile) {
    const el = document.createElement('div');
    const v = VARIANTS[tile.variant];
    const a = ALTERATIONS[tile.alteration];
    el.className = 'tile' + (v ? ' ' + v.cls : '') + (a ? ' ' + a.cls : '')
      + (SPECIAL_SLUGS[tile.letter] ? ' t-special' : '');
    el.dataset.tileId = tile.id; // also the hover-tooltip anchor
    el.style.setProperty('--float-dur', (2.6 + (tile.id % 7) * 0.3).toFixed(2) + 's');
    el.style.setProperty('--float-delay', (-((tile.id % 11) / 11) * 3).toFixed(2) + 's');
    // The Foreman's demanded tile is marked (the hover tip explains it).
    if (this.game.bossState && this.game.bossState.mustId === tile.id) el.classList.add('must-play');
    // data-l feeds the Fuzzy alteration's double-print ::after.
    el.innerHTML =
      `<span class="letter" data-l="${tile.letter}">${tile.letter}</span>` +
      `<span class="value">${tile.value}</span>`;
    return el;
  }

  // --- Hover tooltips (slugs & Books) -----------------------------------------

  // Rich hover content for a slug: name, value, and every extra effect on it.
  tileTip(tile) {
    const v = VARIANTS[tile.variant];
    const a = ALTERATIONS[tile.alteration];
    const sp = SPECIAL_SLUGS[tile.letter];
    let html = `<div class="tip-name">${tile.letter}</div>`
      + `<div class="tip-sub">${sp ? sp.name : 'Cast slug'} &middot; worth ${tile.value} point${tile.value === 1 ? '' : 's'}</div>`;
    if (sp) html += `<div class="tip-line tip-special">${sp.tip}</div>`;
    if (v) html += `<div class="tip-line"><b>${v.name}</b> — ${v.desc}</div>`;
    if (a) html += `<div class="tip-line"><b>${a.name}</b> — ${a.desc}</div>`;
    if (this.game.bossState && this.game.bossState.mustId === tile.id) {
      html += `<div class="tip-line tip-warn">The Foreman demands this slug — it must be played and can't be rerolled.</div>`;
    }
    return html;
  }

  // Rich hover content for a Book: name, rarity, effect, live scaling, sticker.
  bookTip(book) {
    const status = book.status ? book.status(this.game.books.stateOf(book), this.game) : null;
    const sticker = this.game.books.stickerOf(book);
    let html = `<div class="tip-name">${book.name}</div>`
      + `<div class="tip-sub r-${book.rarity}">${book.rarity.toUpperCase()}</div>`
      + `<div class="tip-line">${book.desc}</div>`;
    if (status) html += `<div class="tip-line tip-status">Currently: <b>${status}</b></div>`;
    if (sticker) html += `<div class="tip-line"><b>${sticker.name}</b> — ${sticker.desc}</div>`;
    if (book.flavor) html += `<div class="tip-flavor">${book.flavor}</div>`;
    return html;
  }

  // Show the tooltip anchored above `el`, clamped to stay fully on screen.
  showTip(el, html) {
    const tip = this.els['hovertip'];
    tip.innerHTML = html;
    tip.classList.remove('hidden');
    const r = el.getBoundingClientRect();
    const m = 8;
    let left = r.left + r.width / 2 - tip.offsetWidth / 2;
    left = Math.max(m, Math.min(left, window.innerWidth - tip.offsetWidth - m));
    let top = r.top - tip.offsetHeight - 10;      // prefer above
    if (top < m) top = r.bottom + 10;             // flip below if cramped
    top = Math.max(m, Math.min(top, window.innerHeight - tip.offsetHeight - m));
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  hideTip() {
    this.els['hovertip'].classList.add('hidden');
    this.tipAnchor = null;
  }

  // Show the gesture hint on touch-ish setups (coarse pointer, or simply a
  // narrow screen where the touch layout is what you're looking at).
  syncHint() {
    const touchy = window.matchMedia('(pointer: coarse)').matches || window.innerWidth <= 860;
    this.els['hint'].innerHTML = touchy
      ? 'Tap or drag slugs to compose &middot; drag a slug onto the tray to reroll &middot; hold for details &middot; drag Books to reorder'
      : 'Click / type = compose &middot; drag slugs to arrange &middot; right-click or shift-click = reroll tray &middot; Space = reroll &middot; Enter = forge';
  }

  // A gesture (long-press, swipe) already handled this touch — swallow the
  // click the browser fires afterwards. Returns true when it did so.
  takeClick() {
    if (!this.suppressClick) return false;
    this.suppressClick = false;
    return true;
  }

  // One delegated handler: swap the tip only when the hovered anchor changes,
  // so moving within an element (or over its children) never flickers.
  onHover(e) {
    const anchor = e.target.closest('.tile[data-tile-id], .shelf-book[data-book-idx]');
    if (anchor === this.tipAnchor) return;
    this.tipAnchor = anchor;
    if (!anchor) return this.hideTip();
    if (anchor.classList.contains('shelf-book')) {
      const book = this.game.books.shelf[Number(anchor.dataset.bookIdx)];
      if (book) this.showTip(anchor, this.bookTip(book)); else this.hideTip();
    } else {
      const tile = this.findTile(Number(anchor.dataset.tileId));
      if (tile) this.showTip(anchor, this.tileTip(tile)); else this.hideTip();
    }
  }

  // Locate a tile across every zone by id (for the hover lookup).
  findTile(id) {
    const g = this.game;
    return [...g.rack, ...g.stick, ...g.tray].find((t) => t.id === id)
      || (this.pendingBag && this.pendingBag.candidates.find((t) => t.id === id))
      || (this.pendingPen && this.pendingPen.tiles.find((t) => t.id === id));
  }

  // Wrap a slug for placement: the wrapper owns the hand-curve offset, the
  // hover lift, and the one-time elastic settle when a tile changes zones —
  // while the inner .tile keeps its idle float. zoneKey identifies the spot;
  // when it differs from last render, the tile visibly eases into place.
  wrapTile(tile, zoneKey) {
    const wrap = document.createElement('div');
    wrap.className = 'tile-wrap';
    wrap.appendChild(this.tileEl(tile));
    if (this.placed.get(tile.id) !== zoneKey) {
      wrap.classList.add('settle');
      this.placed.set(tile.id, zoneKey);
    }
    return wrap;
  }

  // A sundry's torn-slip art (shared base + its own emblem).
  slipArt(item, cls = '') {
    return `<span class="slip-icon ${cls}">` +
      `<svg viewBox="0 0 48 48"><use href="#${item.icon || 'icon-slip-ink'}"/></svg></span>`;
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
  // cursedSpots marks The Gatekeeper's slots so the player can route around them.
  renderSlots(container, tiles, slotCount, zone, onTileClick, cursedSpots) {
    container.innerHTML = '';
    for (let i = 0; i < slotCount; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot';
      if (cursedSpots && cursedSpots.includes(i)) slot.classList.add('cursed');
      const tile = tiles[i];
      if (tile) {
        const wrap = this.wrapTile(tile, `${zone}#${i}`);
        const el = wrap.firstChild;
        el.addEventListener('pointerdown', (ev) => this.onTilePointerDown(ev, tile, el, zone));
        el.addEventListener('click', () => { if (!this.takeClick()) onTileClick(tile); });
        slot.appendChild(wrap);
      }
      container.appendChild(slot);
    }
  }

  renderStick() {
    const g = this.game;
    const cursed = g.bossState && g.bossState.spots ? g.bossState.spots : null;
    this.renderSlots(this.els['stick'], g.stick, CFG.STICK_SLOTS, 'stick',
      (tile) => this.onStickTileClick(tile), cursed);
  }

  renderTray() {
    this.renderSlots(this.els['tray'], this.game.tray, CFG.TRAY_SLOTS, 'tray',
      (tile) => this.onTrayTileClick(tile));
  }

  renderRack() {
    const rackEl = this.els['rack'];
    rackEl.innerHTML = '';
    const n = this.game.rack.length;
    this.game.rack.forEach((tile, i) => {
      const wrap = this.wrapTile(tile, `rack#${i}`);
      // Hand-cup curve: centre slugs sit a touch lower, edges lift.
      const x = n > 1 ? (i / (n - 1)) * 2 - 1 : 0;
      wrap.style.marginTop = (7 * (1 - x * x)).toFixed(1) + 'px';
      const el = wrap.firstChild;
      el.addEventListener('pointerdown', (ev) => this.onTilePointerDown(ev, tile, el, 'rack'));
      el.addEventListener('click', (e) => { if (!this.takeClick()) this.onRackTileClick(tile, e); });
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.onSendToTray(tile);
      });
      rackEl.appendChild(wrap);
    });
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
      this.clearWordFx();
      return;
    }

    // When a substitution Book made the word legal, say what it reads as.
    const reading = status === 'valid' && this.game.reading;
    wordEl.innerHTML = this.game.stickWord()
      + (reading ? `<span class="ro-reading">reads as ${reading}</span>` : '');
    wordEl.className = status; // 'valid' | 'invalid'

    const preview = this.game.previewScore();
    if (preview) {
      this.els['ro-points'].textContent = Util.fmt(preview.points);
      this.els['ro-mult'].textContent = Util.fmt(preview.mult);
      mathEl.classList.remove('hidden');
    } else {
      mathEl.classList.add('hidden');
    }

    // Valid words get the length colour scale + drifting mini-letter particles;
    // anything else resets both.
    if (status === 'valid' && preview) {
      const color = this.applyWordColor(preview.word.length);
      this.ensureWordParticles(preview.word, color);
    } else {
      this.clearWordFx();
    }
  }

  // Colour the composed word by its length and return the particle colour.
  // Scale: mid-blue (<=3) -> light-blue (4-5) -> light-blue→magenta gradient
  // (6-8) -> magenta→pink gradient (9-11). Gradients clip to the glyphs.
  applyWordColor(len) {
    const el = this.els['ro-word'];
    const MIDBLUE = '#3f7fd0', LIGHTBLUE = '#7cc4ff', MAGENTA = '#d24be0', PINK = '#ff8fce';
    let fill, glow, particle;
    if (len <= 3) { fill = MIDBLUE; glow = MIDBLUE; particle = MIDBLUE; }
    else if (len <= 5) { fill = LIGHTBLUE; glow = LIGHTBLUE; particle = LIGHTBLUE; }
    else if (len <= 8) { fill = `linear-gradient(95deg, ${LIGHTBLUE}, ${MAGENTA})`; glow = MAGENTA; particle = MAGENTA; }
    else { fill = `linear-gradient(95deg, ${MAGENTA}, ${PINK})`; glow = PINK; particle = PINK; }

    if (fill.startsWith('linear')) {
      el.style.backgroundImage = fill;
      el.style.color = 'transparent';
    } else {
      el.style.backgroundImage = 'none';
      el.style.color = fill;
    }
    el.style.textShadow = `0 0 20px ${glow}73`; // 0x73 ≈ 45% alpha
    return particle;
  }

  // Undo applyWordColor's inline styling and stop the particle emitter.
  clearWordFx() {
    const el = this.els['ro-word'];
    el.style.backgroundImage = '';
    el.style.color = '';
    el.style.textShadow = '';
    this.stopWordParticles();
  }

  // Keep the mini-letter emitter running for the current word (starting it if
  // needed); it spawns more particles for longer words.
  ensureWordParticles(word, color) {
    if (this.reduceMotion) return;
    if (!this._wp) this._wp = {};
    this._wp.word = word;
    this._wp.color = color;
    if (this._wp.timer) return;
    this._wp.timer = setInterval(() => this.emitWordParticles(), 165);
    this.emitWordParticles(); // one right away so it feels responsive
  }

  stopWordParticles() {
    if (this._wp && this._wp.timer) {
      clearInterval(this._wp.timer);
      this._wp.timer = null;
    }
  }

  // Shed a few tiny copies of the word's own letters from the readout — count
  // scales with word length ("more letters to emit").
  emitWordParticles() {
    const wp = this._wp;
    const el = this.els['ro-word'];
    if (!wp || !wp.word || !el) return;
    const r = el.getBoundingClientRect();
    if (r.width < 2) return; // laid out yet?
    const len = wp.word.length;
    const n = Math.max(1, Math.min(6, Math.round(len / 2)));
    const frag = document.createDocumentFragment();
    for (let k = 0; k < n; k++) {
      const p = document.createElement('span');
      p.className = 'wordfx';
      p.textContent = wp.word[Math.floor(Math.random() * len)];
      p.style.left = `${r.left + Math.random() * r.width}px`;
      p.style.top = `${r.top + r.height * 0.5}px`;
      p.style.color = wp.color;
      p.style.setProperty('--dx', `${(Math.random() * 90 - 45).toFixed(0)}px`);
      p.style.setProperty('--dy', `${(-24 - Math.random() * 54).toFixed(0)}px`);
      p.style.setProperty('--rot', `${(Math.random() * 44 - 22).toFixed(0)}deg`);
      p.style.fontSize = `${(10 + Math.random() * 9).toFixed(0)}px`;
      frag.appendChild(p);
      setTimeout(() => p.remove(), 1500);
    }
    document.body.appendChild(frag);
  }

  renderControls() {
    const g = this.game;
    this.els['btn-forge'].disabled = this.busy || g.stickStatus() !== 'valid';
    this.els['btn-reroll'].textContent = `REROLL (${g.rerolls})`;
    this.els['btn-reroll'].disabled = this.busy || g.rerolls === 0 || g.tray.length === 0;
    this.els['btn-shuffle'].disabled = this.busy || g.rack.length === 0;
    this.els['btn-clear'].disabled = this.busy || g.stick.length === 0;
  }

  // The Shelf: a horizontal row of Book covers in firing order. Books bob
  // gently and drag to reorder (HTML5 DnD: the reorder lands on drop).
  renderShelf() {
    const g = this.game;
    this.els['shelf-count'].textContent = `${g.books.slotsUsed}/${CFG.BOOK_SLOTS}`;
    const shelfEl = this.els['shelf'];
    shelfEl.innerHTML = '';

    const slotCount = Math.max(CFG.BOOK_SLOTS, g.books.shelf.length);
    for (let i = 0; i < slotCount; i++) {
      const book = g.books.shelf[i];
      const slot = document.createElement('div');
      slot.className = 'shelf-slot';
      if (book) {
        const sticker = g.books.stickerOf(book);
        const status = book.status ? book.status(g.books.stateOf(book), g) : null;
        const el = document.createElement('div');
        el.className = 'shelf-book';
        el.dataset.bookIdx = i; // hover-tooltip anchor + drag identity
        el.style.setProperty('--float-dur', (3 + (i % 4) * 0.4) + 's');
        el.style.setProperty('--float-delay', (-(i * 0.7)) + 's');
        el.innerHTML = this.bookArt(book, '', sticker)
          + `<span class="shelf-book-name">${book.name}</span>`
          + (status ? `<span class="book-status">${status}</span>` : '');
        // Pointer-based drag: one code path for mouse AND touch (HTML5 drag
        // events never fire on touch screens).
        el.addEventListener('pointerdown', (e) => this.onShelfPointerDown(e, i, el));
        // Long-press a Book for its details (a hold, not a drag).
        el.addEventListener('pointerdown', () => {
          const t = setTimeout(() => this.showTip(el, this.bookTip(book)), 420);
          const done = () => {
            clearTimeout(t);
            el.removeEventListener('pointerup', done);
            el.removeEventListener('pointermove', done);
            el.removeEventListener('pointercancel', done);
          };
          el.addEventListener('pointerup', done);
          el.addEventListener('pointermove', done);
          el.addEventListener('pointercancel', done);
        });
        slot.appendChild(el);
      }
      shelfEl.appendChild(slot);
    }

    this.els['cons-list'].innerHTML = g.consumables.length === 0 ? '&mdash;'
      : g.consumables.map((c, i) =>
          `<div class="shelf-row" title="${c.name} — ${c.desc}">` +
          `${this.slipArt(c, 'slip-icon-sm')} ${c.name}` +
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

  // --- Touch & pointer gestures ------------------------------------------
  // Everything here is pointer-based so a mouse and a finger take the same
  // path. Gestures: drag a Book sideways to reorder The Shelf; long-press
  // any slug or Book for its details; swipe a rack slug downward (toward
  // the tray) to stage it for reroll.

  onShelfPointerDown(e, index, el) {
    if (this.busy) return;
    const start = { x: e.clientX, y: e.clientY };
    let dragging = false;
    el.setPointerCapture(e.pointerId);

    const move = (ev) => {
      if (!dragging && Math.abs(ev.clientX - start.x) + Math.abs(ev.clientY - start.y) > 8) {
        dragging = true;
        el.classList.add('touch-drag');
        this.hideTip();
      }
      if (!dragging) return;
      ev.preventDefault();
      // Highlight whichever Book is under the pointer.
      const over = this.bookElementAt(ev.clientX, ev.clientY);
      for (const b of this.els['shelf'].querySelectorAll('.shelf-book')) {
        b.classList.toggle('drag-over', b === over && b !== el);
      }
    };

    const up = (ev) => {
      el.releasePointerCapture(ev.pointerId);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('touch-drag');
      if (!dragging) return; // a plain tap on a Book does nothing
      const over = this.bookElementAt(ev.clientX, ev.clientY);
      if (over && over !== el) {
        const to = Number(over.dataset.bookIdx);
        if (this.game.books.reorder(index, to)) {
          Sfx.click();
          this.render(); // order changed: shelf AND the live preview
          return;
        }
      }
      this.renderShelf(); // clear any drag-over highlight
    };

    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  // The Book under a screen point (pointer capture hides the real target).
  bookElementAt(x, y) {
    const hit = document.elementFromPoint(x, y);
    return hit ? hit.closest('.shelf-book') : null;
  }

  // Slugs are drag & drop. A press that stays put and holds shows the tooltip;
  // a press that moves picks the slug up (a ghost follows the pointer) and, on
  // release, drops it into whatever zone is under the pointer — the stick (at
  // that slot, to compose or reorder), the tray (to stage a rack slug for
  // reroll), or back to the rack. A press that neither holds nor drags is a
  // plain tap: the quick shortcut move for its zone. One pointer path covers
  // mouse and touch alike.
  onTilePointerDown(e, tile, el, zone) {
    if (this.busy) return;
    if (e.button != null && e.button > 0) return; // right/middle: contextmenu handles the tray
    const start = { x: e.clientX, y: e.clientY };
    let dragging = false, acted = false, ghost = null;
    try { el.setPointerCapture(e.pointerId); } catch (e2) { /* capture unsupported */ }

    const holdTimer = setTimeout(() => {
      if (dragging) return;
      acted = true;
      this.showTip(el, this.tileTip(tile));
      Sfx.click();
    }, 420);

    const move = (ev) => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (!dragging && Math.abs(dx) + Math.abs(dy) > 7) {
        dragging = true;
        acted = true;
        clearTimeout(holdTimer);
        this.hideTip();
        ghost = this._makeGhost(el, ev);
        el.classList.add('dragging-src');
      }
      if (!dragging) return;
      ev.preventDefault();
      this._moveGhost(ghost, ev);
      this._highlightDrop(ev.clientX, ev.clientY);
    };

    const up = (ev) => {
      clearTimeout(holdTimer);
      try { el.releasePointerCapture(ev.pointerId); } catch (e2) { /* already gone */ }
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('dragging-src');
      this._clearDropHighlight();
      if (ghost) { ghost.remove(); ghost = null; }
      if (ev.type === 'pointercancel') return; // aborted — leave everything put
      if (dragging) this._dropTile(tile, zone, ev.clientX, ev.clientY);
      else if (!acted) this._tapTile(tile, zone, ev); // a plain tap: quick move
      this.suppressClick = true; // we handled it via pointer events; swallow the click
    };

    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  // The quick shortcut a plain tap performs, per zone.
  _tapTile(tile, zone, ev) {
    if (zone === 'rack') {
      if (ev && ev.shiftKey) return this.onSendToTray(tile); // shift-tap stages for reroll
      if (this.game.moveToStick(tile.id)) { Sfx.click(); this.saveRun(); }
    } else if (zone === 'stick') {
      this.game.returnToRack(tile.id); Sfx.click(); this.saveRun();
    } else if (zone === 'tray') {
      this.game.trayToRack(tile.id); Sfx.click(); this.saveRun();
    }
    this.render();
  }

  // --- Drag & drop plumbing (body-level ghost + drop hit-testing) ---------
  _makeGhost(el, ev) {
    const r = el.getBoundingClientRect();
    const g = el.cloneNode(true);
    g.classList.add('tile-ghost');
    g.style.width = `${r.width}px`;
    g.style.height = `${r.height}px`;
    g.style.left = `${ev.clientX}px`;
    g.style.top = `${ev.clientY}px`;
    document.body.appendChild(g);
    return g;
  }

  _moveGhost(g, ev) {
    if (!g) return;
    g.style.left = `${ev.clientX}px`;
    g.style.top = `${ev.clientY}px`;
  }

  // The zone (and stick/rack insertion index) under a screen point.
  _dropInfoAt(x, y) {
    const hit = document.elementFromPoint(x, y);
    if (!hit) return null;
    if (hit.closest('#stick')) {
      const slot = hit.closest('.slot');
      const idx = slot ? [...this.els['stick'].children].indexOf(slot) : this.game.stick.length;
      return { zone: 'stick', index: idx < 0 ? this.game.stick.length : idx };
    }
    if (hit.closest('#tray')) return { zone: 'tray' };
    if (hit.closest('#rack')) {
      const wrap = hit.closest('.tile-wrap');
      const idx = wrap ? [...this.els['rack'].children].indexOf(wrap) : this.game.rack.length;
      return { zone: 'rack', index: idx < 0 ? this.game.rack.length : idx };
    }
    return null;
  }

  _highlightDrop(x, y) {
    this._clearDropHighlight();
    const info = this._dropInfoAt(x, y);
    if (info && this.els[info.zone]) this.els[info.zone].classList.add('drop-zone');
  }

  _clearDropHighlight() {
    for (const z of ['stick', 'tray', 'rack']) this.els[z].classList.remove('drop-zone');
  }

  // Resolve a drop: compose/reorder on the stick, stage on the tray, or rack.
  _dropTile(tile, fromZone, x, y) {
    const info = this._dropInfoAt(x, y);
    if (!info) { this.render(); return; } // dropped nowhere useful — snaps back
    if (info.zone === 'tray') {
      if (fromZone === 'rack') return this.onSendToTray(tile); // charges + auto-fire + render
      this.game.moveTileToRack(tile.id); // a stick/tray slug can't stage; send it home
    } else if (info.zone === 'stick') {
      this.game.placeInStick(tile.id, info.index);
    } else if (info.zone === 'rack') {
      this.game.moveTileToRack(tile.id, info.index);
    }
    Sfx.click();
    this.saveRun();
    this.render();
  }

  // Shuffle the rack order for a fresh look at the hand.
  onShuffle() {
    if (this.busy || this.game.rack.length === 0) return;
    this.game.shuffleRack();
    Sfx.reroll();
    this.saveRun();
    this.render();
  }

  // Autosave the run (thin funnel so every action site reads the same).
  saveRun() {
    this.game.saveRun();
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
    if (this.game.bossState && this.game.bossState.mustId === tile.id) {
      return this.toast('The Foreman demands that tile — it cannot be rerolled');
    }
    if (!this.game.moveToTray(tile.id)) return;
    Sfx.click();
    this.saveRun();
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
      this.saveRun();
      this.render();
    }
  }

  onClear() {
    if (this.busy) return;
    this.game.clearStick();
    this.saveRun();
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
    const result = this.game.useConsumable(Number(btn.dataset.use));
    if (result) {
      Sfx.buy();
      // Slips may report what they actually did.
      this.toast(typeof result === 'string' ? result : `${item.name} used`);
    } else {
      Sfx.invalid();
      this.toast(this.slipRefusal(item));
    }
    this.saveRun();
    this.render();
  }

  // Why a slip wouldn't apply — each failure mode has its own reason.
  slipRefusal(item) {
    if (!item) return 'Cannot use that now';
    switch (item.id) {
      case 'hellbox-purge': return 'Purge needs slugs in the tray (and a deck above minimum size)';
      case 'vowel-slip': return 'The Vowel Slip needs an A or an E in your reroll tray';
      case 'sticker-slip': return 'Every Book on your shelf already wears a sticker';
      case 'typewriter': return 'The Typewriter cannot spell anything from this hand';
      default: return 'Cannot use that now';
    }
  }

  onKey(e) {
    if (this.busy) return;

    // Reset confirmation open: Escape backs out, nothing else gets through.
    if (!this.els['reset'].classList.contains('hidden')) {
      if (e.key === 'Escape') this.closeReset();
      return;
    }
    // Picker / pen pack open: paid for — picks must be made by mouse.
    if (!this.els['picker'].classList.contains('hidden')) return;
    if (!this.els['penpick'].classList.contains('hidden')) return;
    // Deck pick open: Escape backs out only if a run is live to return to.
    if (!this.els['deckpick'].classList.contains('hidden')) {
      if (e.key === 'Escape' && this.game.state === 'playing') {
        this.els['deckpick'].classList.add('hidden');
      }
      return;
    }
    // Bag check / Library open: Escape (or Enter) closes, rest ignored.
    if (!this.els['bagcheck'].classList.contains('hidden')) {
      if (e.key === 'Escape' || e.key === 'Enter') this.toggleBagCheck();
      return;
    }
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
      if (last) { this.game.returnToRack(last.id); Sfx.click(); this.saveRun(); this.render(); }
    } else if (/^[a-zA-Z]$/.test(e.key)) {
      // Type to compose: first rack tile with that letter goes to the stick.
      const tile = this.game.rack.find((t) => t.letter === e.key.toUpperCase());
      if (tile) { this.game.moveToStick(tile.id); Sfx.click(); this.saveRun(); this.render(); }
    }
  }

  // --- Forge + scoring sweep ---------------------------------------------

  async onForge() {
    if (this.busy || this.game.stickStatus() !== 'valid') return;
    this.busy = true;
    this.stopWordParticles(); // the word's about to be spent; stop shedding letters
    this.renderControls();

    const { result, outcome } = this.game.forge();
    await this.playScoringSweep(result);

    this.busy = false;
    this.render();
    this.saveRun(); // snapshot post-forge (or clear the save if the run just ended)

    if (outcome === 'won') { Sfx.win(); this.showOverlay('won'); }
    else if (outcome === 'lost') { Sfx.lose(); this.showOverlay('lost'); }
  }

  // The signature moment, rebuilt on the engine's event script: every count
  // (a letter's points, its mult, a Book's bonus, a sticker, a COPY!) gets
  // its own pulse + floating number, in the exact canonical order. The sweep
  // accelerates as it runs (SPEED_RAMP per event, capped at SPEED_CAP).
  async playScoringSweep(result) {
    const A = CFG.ANIM;
    const tileEls = [...this.els['stick'].querySelectorAll('.tile')];
    const bookEls = [...this.els['shelf'].querySelectorAll('.shelf-book')];

    // Readout counts along from zero points / base mult.
    this.els['ro-points'].textContent = '0';
    this.els['ro-mult'].textContent = Util.fmt(CFG.MULT_BASE + result.tiles.length);
    this.els['ro-math'].classList.remove('hidden');

    let idx = 0;
    for (const ev of result.events) {
      const speed = Math.min(A.SPEED_CAP, 1 + idx * A.SPEED_RAMP);
      idx++;

      // Who flashes: the slug, the Book, or the boss plaque.
      let el = null;
      if (ev.type === 'boss') el = this.els['boss-panel'];
      else if (ev.b != null && !ev.type.startsWith('tile') && ev.target !== 'tile') el = bookEls[ev.b];
      else if (ev.i != null) el = tileEls[ev.i];

      // What it says, and in what colour.
      let text = null, cls = 'pop-pts';
      switch (ev.type) {
        case 'tilePts': text = `+${ev.amt}`; cls = 'pop-pts'; Sfx.letter(ev.i); break;
        case 'tileMult': text = `+${ev.amt} MULT`; cls = 'pop-mult'; Sfx.mult(); break;
        case 'tileXMult': text = `×${ev.x} MULT`; cls = 'pop-mult'; Sfx.mult(); break;
        case 'bookPts': text = `+${ev.amt}`; cls = 'pop-pts'; Sfx.letter(ev.b || 0); break;
        case 'bookMult': text = `+${ev.amt} MULT`; cls = 'pop-mult'; Sfx.mult(); break;
        case 'bookXMult': text = `×${ev.x} MULT`; cls = 'pop-mult'; Sfx.mult(); break;
        case 'sticker':
          text = ev.kind === 'pts' ? `+${ev.amt}`
            : ev.kind === 'mult' ? `+${ev.amt} MULT` : `×${ev.x} MULT`;
          cls = 'pop-sticker'; Sfx.buy(); break;
        case 'ticket': text = `+${ev.amt} TKT`; cls = 'pop-ticket'; Sfx.buy(); break;
        case 'copy': text = 'COPY!'; cls = 'pop-copy'; Sfx.copy(); break;
        case 'boss': text = '!'; cls = 'pop-mult'; Sfx.invalid(); break;
      }

      if (el) {
        this.pulse(el, ev.type === 'copy');
        if (text) this.popNumber(el, text, cls, this.popScale(ev));
        this.eventFx(el, ev); // sparks / rings on the impactful counts
      }
      if (ev.i != null && tileEls[ev.i]) tileEls[ev.i].classList.add('scored');
      if (ev.runP != null) this.els['ro-points'].textContent = Util.fmt(ev.runP);
      if (ev.runM != null) this.els['ro-mult'].textContent = Util.fmt(Math.round(ev.runM * 100) / 100);
      await Util.sleep(A.EVENT_STEP / speed);
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
    // The total lands: kick the table (harder the closer it is to the target)
    // and burst copper from the number itself.
    this.shake(Math.min(1, result.total / Math.max(1, this.game.target)));
    this.burst(this.els['ro-total'], '#eda85f', 16, 72);
    this.renderStats(); // round score + progress bar catch up
    await Util.sleep(A.TOTAL_HOLD);

    // Spent slugs drop off to the hellbox.
    for (const el of tileEls) el.classList.add('spent');
    await Util.sleep(A.SPEND);
  }

  // A quick dilate-and-settle flash on whatever just triggered.
  pulse(el, isCopy = false) {
    el.classList.remove('trigger-pulse', 'copy-pulse');
    void el.offsetWidth; // restart the animation
    el.classList.add(isCopy ? 'copy-pulse' : 'trigger-pulse');
  }

  // A floating number that rises out of the source element and fades. Bigger
  // counts pop bigger (scale) with a little horizontal jitter so a long sweep
  // never stacks identical numbers in one column.
  popNumber(el, text, cls, scale = 1) {
    const r = el.getBoundingClientRect();
    const pop = document.createElement('span');
    pop.className = `score-pop ${cls}`;
    pop.textContent = text;
    pop.style.left = `${r.left + r.width / 2 + (Math.random() * 14 - 7)}px`;
    pop.style.top = `${r.top - 6}px`;
    if (scale !== 1) pop.style.fontSize = `${(15 * scale).toFixed(1)}px`;
    document.body.appendChild(pop);
    setTimeout(() => pop.remove(), 800);
  }

  // How much to enlarge a count's floating number, by how big the count is.
  popScale(ev) {
    if (ev.type === 'tilePts' || ev.type === 'bookPts') return Math.min(1.5, 1 + (ev.amt || 0) / 60);
    if (ev.amt) return Math.min(1.6, 1 + ev.amt / 12);   // additive mult
    if (ev.x) return Math.min(1.7, 0.9 + ev.x * 0.35);   // ×mult
    return 1;
  }

  // The "amp up" layer: spark bursts and shockwave rings on the impactful
  // counts, colour-matched to what fired. All body-level (see burst/shockwave),
  // so a slug's overflow:hidden never clips them, and all skipped when
  // reduceMotion is set.
  eventFx(el, ev) {
    const PTS = '#eda85f', MULT = '#c04a32', GOLD = '#d4a017', COPY = '#e8d532';
    switch (ev.type) {
      case 'tilePts':
      case 'bookPts':
        if ((ev.amt || 0) >= CFG.ANIM.FX.BIG_PTS) this.burst(el, PTS, 6);
        break;
      case 'tileMult':
      case 'bookMult':
        this.burst(el, MULT, 8);
        break;
      case 'tileXMult':
      case 'bookXMult':
        this.burst(el, MULT, 12);
        this.shockwave(el, MULT);
        break;
      case 'sticker':
        this.burst(el, GOLD, 8);
        if (ev.kind === 'xMult') this.shockwave(el, GOLD);
        break;
      case 'ticket':
        this.burst(el, GOLD, 6);
        break;
      case 'copy':
        this.burst(el, COPY, 12);
        this.shockwave(el, COPY);
        break;
      case 'boss':
        this.burst(el, MULT, 14);
        this.shockwave(el, MULT);
        this.shake(0.4);
        break;
    }
  }

  // A burst of spark particles flung outward from an element's centre.
  burst(el, color, count = CFG.ANIM.FX.SPARKS, spread = CFG.ANIM.FX.SPARK_DIST) {
    if (this.reduceMotion || !el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const frag = document.createDocumentFragment();
    for (let k = 0; k < count; k++) {
      const s = document.createElement('span');
      s.className = 'fx-spark';
      const ang = (Math.PI * 2 * k) / count + Math.random() * 0.7;
      const dist = spread * (0.55 + Math.random() * 0.7);
      s.style.left = `${cx}px`;
      s.style.top = `${cy}px`;
      s.style.color = color;      // box-shadow glow uses currentColor
      s.style.background = color;
      s.style.setProperty('--dx', `${(Math.cos(ang) * dist).toFixed(1)}px`);
      s.style.setProperty('--dy', `${(Math.sin(ang) * dist).toFixed(1)}px`);
      s.style.setProperty('--sz', `${(3 + Math.random() * 3).toFixed(1)}px`);
      frag.appendChild(s);
      setTimeout(() => s.remove(), 720);
    }
    document.body.appendChild(frag);
  }

  // A shockwave ring that expands and fades from an element's centre.
  shockwave(el, color) {
    if (this.reduceMotion || !el) return;
    const r = el.getBoundingClientRect();
    const ring = document.createElement('span');
    ring.className = 'fx-ring';
    ring.style.left = `${r.left + r.width / 2}px`;
    ring.style.top = `${r.top + r.height / 2}px`;
    ring.style.borderColor = color;
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 640);
  }

  // Kick the table; intensity 0..1 scales the throw (capped by CFG).
  shake(intensity) {
    if (this.reduceMotion) return;
    const t = this.els['table'];
    if (!t) return;
    const px = Math.max(3, Math.min(CFG.ANIM.FX.SHAKE_MAX, 3 + intensity * CFG.ANIM.FX.SHAKE_MAX));
    t.style.setProperty('--shake', `${px.toFixed(1)}px`);
    t.classList.remove('shaking');
    void t.offsetWidth; // restart the animation
    t.classList.add('shaking');
    setTimeout(() => t.classList.remove('shaking'), 440);
  }

  // --- Overlay (round end / game over) -------------------------------------

  showOverlay(kind) {
    const g = this.game;
    if (kind === 'won') {
      this.els['ov-title'].textContent = g.isBossLevel ? 'BOSS DEFEATED' : 'PRESS RUN COMPLETE';
      // Itemised ticket payout: longest word, unused plays, then each Book.
      const payoutRows = g.lastPayout
        .map((p) => `<div class="pay-row"><span>${p.label}</span><b>+${p.amount}</b></div>`)
        .join('');
      this.els['ov-body'].innerHTML =
        `Level ${g.level} cleared — <b>${Util.fmt(g.roundScore)}</b> / ${Util.fmt(g.target)}<br>` +
        `<div class="pay-list">${payoutRows}</div>` +
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
      this.render();
      this.game.saveRun();
    } else {
      this.openDeckPick(); // NEW RUN goes through the case selection
    }
  }

  // --- The Foundry (shop) ---------------------------------------------------

  renderShop() {
    const g = this.game;
    const s = this.shop;
    const tk = (n) => `${n} TK`;

    const bookCards = s.books.length === 0 ? '<p class="sold-out">Sold out.</p>'
      : s.books.map((offer, i) => {
          const b = offer.def;
          const cost = s.bookCost(offer);
          const donated = offer.sticker && offer.sticker.noSlot;
          const blocked = (g.books.isFull && !donated) ? 'SHELF FULL'
            : (!s.canAfford(cost) ? tk(cost) : null);
          return `<div class="shop-card shop-card-book">
            ${this.bookArt(b, '', offer.sticker)}
            <h4>${b.name}</h4>
            <div class="rarity r-${b.rarity}">${b.rarity.toUpperCase()}</div>
            <div class="desc">${b.desc}</div>
            ${offer.sticker ? `<div class="sticker-line">${offer.sticker.name} — ${offer.sticker.desc}</div>` : ''}
            ${b.flavor ? `<div class="flavor">${b.flavor}</div>` : ''}
            <button class="btn btn-buy" data-act="book" data-i="${i}" ${blocked ? 'disabled' : ''}>
              ${blocked || 'BUY · ' + tk(cost)}</button>
          </div>`;
        }).join('');

    const penCard = s.penPack
      ? `<div class="shop-card shop-card-bag">
          <span class="pen-icon" style="color: var(--copper)"><svg viewBox="0 0 48 48"><use href="#icon-pen"/></svg></span>
          <h4>Pen Pack</h4>
          <div class="desc">Pull ${CFG.PEN_TILE_PULLS} slugs from your bag, choose 1 of ${CFG.PEN_CHOICES} pens, and ink one slug — rewriting its style.</div>
          <button class="btn btn-buy" data-act="penpack" ${s.canAfford(CFG.PEN_PACK_COST) ? '' : 'disabled'}>
            BUY · ${tk(CFG.PEN_PACK_COST)}</button>
        </div>`
      : '';

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
          return `<div class="shop-card shop-card-slip ${c.rare ? 'slip-rare' : ''}">
            ${this.slipArt(c)}
            <h4>${c.name}${c.rare ? ' <span class="rarity r-rare">RARE</span>' : ''}</h4>
            <div class="desc">${c.desc}</div>
            <button class="btn btn-buy" data-act="cons" data-i="${i}" ${blocked ? 'disabled' : ''}>
              ${blocked || 'BUY · ' + tk(c.cost)}</button>
          </div>`;
        }).join('');

    const shelfRows = g.books.shelf.length === 0 ? '<p class="sold-out">Your shelf is empty.</p>'
      : g.books.shelf.map((b) => `<div class="sell-row">
          <span>${this.bookArt(b, 'book-icon-sm', g.books.stickerOf(b))} <b>${b.name}</b> — ${b.desc}</span>
          <button class="btn btn-buy" data-act="sell" data-id="${b.id}">SELL · ${tk(g.books.sellValue(b))}</button>
        </div>`).join('');

    this.els['shop-card'].innerHTML = `
      <div class="shop-h">
        <h2>THE FOUNDRY</h2>
        <div class="shop-tickets">${Util.fmt(g.tickets)} TICKETS</div>
      </div>
      <div class="shop-section-title">BOOKS — persistent presses (${g.books.shelf.length}/${CFG.BOOK_SLOTS} shelved)</div>
      <div class="shop-row">${bookCards}</div>
      <div class="shop-section-title">TILE BAGS &amp; INK — slugs join your deck next round</div>
      <div class="shop-row">${bagCards}${penCard}</div>
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

  // --- Bag selection (pick 3 of the rolled candidates) -----------------------

  openPicker(res) {
    this.pendingBag = res;
    this.pickerChoice.clear();
    this.renderPicker();
    this.els['picker'].classList.remove('hidden');
  }

  renderPicker() {
    const { bag, candidates } = this.pendingBag;
    const picks = bag.picks || CFG.BAG_PICKS;
    const tilesHtml = candidates.map((t, i) => {
      const el = this.tileEl(t);
      el.classList.add('picker-tile');
      return `<div class="pick-slot ${this.pickerChoice.has(i) ? 'selected' : ''}" data-pick="${i}">
        ${el.outerHTML}</div>`;
    }).join('');

    this.els['picker-card'].innerHTML = `
      <div class="shop-h">
        <h2><svg class="picker-bag-icon" viewBox="0 0 48 48"><use href="#${bag.icon}"/></svg> ${bag.name.toUpperCase()}</h2>
        <div class="shop-tickets">KEEP ${picks}</div>
      </div>
      <p class="picker-hint">The sack spills open — keep up to ${picks} slugs, or none at all.</p>
      <div class="picker-tiles">${tilesHtml}</div>
      <div class="shop-foot">
        <span class="picker-count">${this.pickerChoice.size}/${picks} chosen</span>
        <button class="btn btn-primary" data-act="confirm-picks">
          ${this.pickerChoice.size === 0 ? 'SKIP THE LOT' : `CAST ${this.pickerChoice.size}`}</button>
      </div>`;
  }

  onPickerClick(e) {
    const slot = e.target.closest('[data-pick]');
    if (slot) {
      const i = Number(slot.dataset.pick);
      const cap = this.pendingBag.bag.picks || CFG.BAG_PICKS;
      if (this.pickerChoice.has(i)) this.pickerChoice.delete(i);
      else if (this.pickerChoice.size < cap) this.pickerChoice.add(i);
      Sfx.click();
      this.renderPicker();
      return;
    }
    if (e.target.closest('[data-act="confirm-picks"]')) {
      const kept = [...this.pickerChoice].map((i) => this.pendingBag.candidates[i]);
      this.shop.finalizeBag(kept);
      this.els['picker'].classList.add('hidden');
      this.pendingBag = null;
      Sfx.buy();
      this.toast(kept.length ? this.describeBag(kept) : 'The sack goes back on the shelf, unspent.');
      this.renderShop();
      this.renderStats();
      this.game.saveRun();
    }
  }

  // --- Pen pack (choose 1 pen + 1 pulled slug) --------------------------------

  openPenPick(res) {
    this.pendingPen = res; // { tiles, pens }
    this.penChoice = null;   // pen index
    this.penTileChoice = null; // tile index
    this.renderPenPick();
    this.els['penpick'].classList.remove('hidden');
  }

  renderPenPick() {
    const { tiles, pens } = this.pendingPen;
    const penCards = pens.map((p, i) => {
      const effectDesc = p.alteration
        ? `${ALTERATIONS[p.alteration].name} — ${ALTERATIONS[p.alteration].desc}`
        : `${VARIANTS[p.variant].name} — ${VARIANTS[p.variant].desc}`;
      return `<div class="pen-card ${this.penChoice === i ? 'selected' : ''}" data-pen="${i}">
        <span class="pen-icon" style="color:${p.ink}"><svg viewBox="0 0 48 48"><use href="#${p.icon || 'icon-pen'}"/></svg></span>
        <div class="pen-name">${p.name}${p.rare ? ' <span class="rarity r-rare">RARE</span>' : ''}</div>
        <div class="desc">${effectDesc}<br><i>${p.alteration ? 'Rewrites the slug\'s text alteration.' : 'Recasts the slug\'s material.'}</i></div>
      </div>`;
    }).join('');

    const tileCards = tiles.map((t, i) => {
      const el = this.tileEl(t);
      el.classList.add('picker-tile');
      return `<div class="pick-slot ${this.penTileChoice === i ? 'selected' : ''}" data-pentile="${i}">
        ${el.outerHTML}</div>`;
    }).join('');

    const ready = this.penChoice != null && this.penTileChoice != null;
    this.els['penpick-card'].innerHTML = `
      <div class="shop-h">
        <h2>THE PEN PACK</h2>
        <div class="shop-tickets">1 PEN &middot; 1 SLUG</div>
      </div>
      <div class="shop-section-title">CHOOSE YOUR PEN</div>
      <div class="shop-row">${penCards}</div>
      <div class="shop-section-title">CHOOSE A SLUG FROM THE ${tiles.length} PULLED</div>
      <div class="picker-tiles">${tileCards}</div>
      <div class="shop-foot">
        <span class="picker-count">${ready ? 'Ready to ink.' : 'Pick one of each.'}</span>
        <button class="btn btn-primary" data-act="confirm-pen" ${ready ? '' : 'disabled'}>INK IT</button>
      </div>`;
  }

  onPenPickClick(e) {
    const pen = e.target.closest('[data-pen]');
    if (pen) { this.penChoice = Number(pen.dataset.pen); Sfx.click(); this.renderPenPick(); return; }
    const tile = e.target.closest('[data-pentile]');
    if (tile) { this.penTileChoice = Number(tile.dataset.pentile); Sfx.click(); this.renderPenPick(); return; }
    if (e.target.closest('[data-act="confirm-pen"]')) {
      const chosenPen = this.pendingPen.pens[this.penChoice];
      const chosenTile = this.pendingPen.tiles[this.penTileChoice];
      this.shop.finalizePen(chosenTile, chosenPen);
      this.els['penpick'].classList.add('hidden');
      this.pendingPen = null;
      Sfx.buy();
      this.toast(`${chosenPen.name} inked ${chosenTile.letter}`);
      this.renderShop();
      this.renderStats();
      this.game.saveRun();
    }
  }

  // --- Reset file (two confirmations before anything is erased) ---------------

  openReset() {
    this.resetStep = 1;
    this.renderReset();
    this.els['reset'].classList.remove('hidden');
    Sfx.click();
  }

  closeReset() {
    this.els['reset'].classList.add('hidden');
    this.resetStep = 0;
    Sfx.click();
  }

  renderReset() {
    const p = this.game.unlocks.profile;
    const body = this.resetStep === 1
      ? `<div class="shop-section-title">STEP 1 OF 2</div>
         <p class="reset-lead">This erases your <b>entire file</b> — every Book and starting
         case you've unlocked, and all lifetime progress.</p>
         <div class="reset-stats">
           <div><b>${this.game.unlocks.unlockedCount}/${BOOKS.length}</b> Books discovered</div>
           <div><b>${p.decksUnlocked.length}/${DECKS.length}</b> cases earned</div>
           <div><b>${Util.fmt(p.wordsForged)}</b> words forged &middot;
             <b>${Util.fmt(p.ticketsEarned)}</b> tickets earned &middot;
             <b>${p.bossesBeaten}</b> bosses beaten</div>
         </div>
         <p class="reset-lead">Your current run ends too.</p>
         <div class="shop-foot">
           <button class="btn" data-act="reset-cancel">KEEP MY FILE</button>
           <button class="btn btn-danger-solid" data-act="reset-next">CONTINUE &rarr;</button>
         </div>`
      : `<div class="shop-section-title red">STEP 2 OF 2 — LAST CHANCE</div>
         <p class="reset-lead reset-final">Melt the whole case down?<br>
         <b>This cannot be undone.</b></p>
         <div class="shop-foot">
           <button class="btn" data-act="reset-cancel">NO, KEEP IT</button>
           <button class="btn btn-danger-solid" data-act="reset-confirm">ERASE EVERYTHING</button>
         </div>`;

    this.els['reset-card'].innerHTML = `
      <div class="shop-h"><h2>RESET FILE</h2></div>
      ${body}`;
  }

  onResetClick(e) {
    if (e.target.closest('[data-act="reset-cancel"]')) return this.closeReset();
    if (e.target.closest('[data-act="reset-next"]')) {
      this.resetStep = 2;
      Sfx.invalid();
      return this.renderReset();
    }
    if (e.target.closest('[data-act="reset-confirm"]')) {
      this.game.unlocks.wipe();
      this.els['reset'].classList.add('hidden');
      this.resetStep = 0;
      this.placed.clear();
      this.game.newRun('standard', 0);
      this.game.clearSave(); // a wiped file has no run to continue
      Sfx.lose();
      this.toast('File erased — a fresh case, a fresh start.');
      this.render();
      this.openDeckPick();
    }
  }

  // --- Starting-case selection -------------------------------------------------

  openDeckPick() {
    // Never open on a difficulty that's since been locked (fresh file, etc.).
    const want = this.game.unlocks.profile.lastDifficulty || 0;
    this.diffChoice = this.game.unlocks.isDifficultyUnlocked(want) ? want : 0;
    this.renderDeckPick();
    this.els['deckpick'].classList.remove('hidden');
  }

  renderDeckPick() {
    const g = this.game;
    // Difficulty row: paper sizes, Note up to Imperial.
    const diffs = CFG.DIFFICULTIES.map((d, i) => {
      const open = g.unlocks.isDifficultyUnlocked(i);
      const prev = i > 0 ? CFG.DIFFICULTIES[i - 1].name : '';
      // Deliberately NOT `disabled` — a click should explain the lock rather
      // than be silently swallowed. onDeckPickClick refuses the selection.
      return `<button class="diff-btn ${this.diffChoice === i ? 'selected' : ''} ${open ? '' : 'locked'}"
        data-diff="${i}"
        title="${open ? `Targets grow ×${d.mult} as fast`
          : `Locked — beat a boss on ${prev} first`}">
        <svg viewBox="0 0 48 48"><use href="#${open ? d.icon : 'icon-diff-locked'}"/></svg>
        <span>${open ? d.name.toUpperCase() : '&#128274;'}</span>
      </button>`;
    }).join('');

    const cards = DECKS.map((d) => {
      const unlocked = g.unlocks.isDeckUnlocked(d);
      const current = g.deckDef && g.deckDef.id === d.id;
      return `<div class="lib-card deck-card ${unlocked ? '' : 'locked'}">
        <span class="deck-icon ${unlocked ? '' : 'deck-locked'}">
          <svg viewBox="0 0 48 48"><use href="#${d.icon}"/></svg></span>
        <div class="lib-name">${d.name}</div>
        <div class="desc">${d.desc}</div>
        ${unlocked
          ? `<button class="btn btn-buy" data-deck="${d.id}">${current ? 'DEAL AGAIN' : 'SELECT'}</button>`
          : `<div class="lib-lock">&#128274; ${d.unlock.desc}</div>`}
      </div>`;
    }).join('');

    // Mid-run picks restart the run; only offer a way back if one is live.
    const canCancel = g.state === 'playing';
    // A saved run offers a way straight back in, above the fresh-start cases.
    const save = Game.loadSave();
    const savedDeck = save && DECKS.find((d) => d.id === save.deckId);
    const continueRow = save ? `
      <div class="continue-row">
        <div>
          <div class="continue-title">Run in progress &middot; Level ${save.level}</div>
          <div class="continue-sub">${savedDeck ? savedDeck.name : 'A case'} &middot;
            ${CFG.DIFFICULTIES[save.difficulty || 0].name}</div>
        </div>
        <button class="btn btn-primary" data-act="continue-run">CONTINUE RUN</button>
      </div>` : '';

    this.els['deckpick-card'].innerHTML = `
      <div class="shop-h">
        <h2>CHOOSE YOUR CASE</h2>
        <div class="shop-tickets">${DECKS.filter((d) => g.unlocks.isDeckUnlocked(d)).length}/${DECKS.length} EARNED</div>
      </div>
      ${continueRow}
      <p class="picker-hint">Every case starts a fresh run${save ? ', replacing the one above' : ''}.</p>
      <div class="shop-section-title">PAPER SIZE — difficulty</div>
      <div class="diff-row">${diffs}</div>
      <div class="shop-section-title">THE CASE — starting deck</div>
      <div class="lib-grid">${cards}</div>
      <div class="shop-foot">
        <span></span>
        ${canCancel ? '<button class="btn" data-act="cancel-deck">KEEP CURRENT RUN</button>' : ''}
      </div>`;
  }

  onDeckPickClick(e) {
    if (e.target.closest('[data-act="continue-run"]')) return this.resumeRun();
    const diff = e.target.closest('[data-diff]');
    if (diff) {
      const i = Number(diff.dataset.diff);
      if (!this.game.unlocks.isDifficultyUnlocked(i)) {
        Sfx.invalid();
        return this.toast(`Beat a boss on ${CFG.DIFFICULTIES[i - 1].name} to unlock ${CFG.DIFFICULTIES[i].name}`);
      }
      this.diffChoice = i;
      Sfx.click();
      this.renderDeckPick();
      return;
    }
    const pick = e.target.closest('[data-deck]');
    if (pick) {
      const id = pick.dataset.deck;
      this.game.unlocks.profile.lastDeck = id;
      this.game.unlocks.profile.lastDifficulty = this.diffChoice;
      this.game.unlocks.save();
      this.placed.clear(); // fresh run: every tile settles anew
      this.game.newRun(id, this.diffChoice);
      this.els['deckpick'].classList.add('hidden');
      Sfx.buy();
      this.toast(`${DECKS.find((d) => d.id === id).name} · ${CFG.DIFFICULTIES[this.diffChoice].name} — new run`);
      this.render();
      this.game.saveRun(); // the new run becomes the resumable save
      return;
    }
    if (e.target.closest('[data-act="cancel-deck"]')) {
      this.els['deckpick'].classList.add('hidden');
      Sfx.click();
    }
  }

  // Continue Run: rebuild the saved run and drop back into it (re-showing the
  // win card if the save landed between a clear and the next level).
  resumeRun() {
    const data = Game.loadSave();
    if (!data) return this.toast('No saved run to continue');
    this.game.resume(data);
    this.placed.clear(); // every tile settles fresh on resume
    this.els['deckpick'].classList.add('hidden');
    Sfx.buy();
    this.render();
    if (this.game.state === 'roundWon') this.showOverlay('won');
    this.toast(`Resumed — level ${this.game.level}`);
  }

  // --- Bag check (deck composition) -------------------------------------------

  toggleBagCheck() {
    const el = this.els['bagcheck'];
    if (el.classList.contains('hidden')) {
      this.renderBagCheck();
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
    Sfx.click();
  }

  renderBagCheck() {
    const g = this.game;
    const counts = {};
    for (const t of g.deck.all) counts[t.letter] = (counts[t.letter] || 0) + 1;
    const cells = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((L) => `
      <div class="bc-cell ${counts[L] ? '' : 'bc-none'}">
        <span class="bc-letter">${L}</span><span class="bc-count">${counts[L] || 0}</span>
      </div>`).join('');

    const specials = g.deck.all.filter((t) => t.variant || t.alteration);
    const specialRows = specials.length === 0
      ? '<p class="sold-out">No variant or alteration slugs yet.</p>'
      : specials.map((t) => {
          const marks = [VARIANTS[t.variant], ALTERATIONS[t.alteration]]
            .filter(Boolean).map((x) => x.name).join(' + ');
          return `<span class="bc-special"><b>${t.letter}</b> ${marks}</span>`;
        }).join(' ');

    const inHand = g.rack.length + g.stick.length + g.tray.length;
    this.els['bagcheck-card'].innerHTML = `
      <div class="shop-h">
        <h2>BAG CHECK</h2>
        <div class="shop-tickets">${g.deck.all.length} SLUGS</div>
      </div>
      <div class="lib-progress">Case ${g.deck.bag.length} &middot; Hellbox ${g.deck.discard.length}
        &middot; In hand ${inHand}</div>
      <div class="bc-grid">${cells}</div>
      <div class="shop-section-title">SPECIAL SLUGS</div>
      <div class="bc-specials">${specialRows}</div>
      <div class="shop-foot">
        <span></span>
        <button class="btn btn-primary" data-act="close-bagcheck">CLOSE</button>
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
      // Undiscovered Books keep their secret — only the goal is shown.
      if (!unlocked) {
        return `<div class="lib-card locked">
          <span class="book-icon r-${b.rarity} book-icon-lg">
            <svg viewBox="0 0 48 60"><use href="#icon-book-unknown"/></svg></span>
          <div class="lib-name lib-unknown">???</div>
          <div class="rarity r-${b.rarity}">${b.rarity.toUpperCase()}</div>
          <div class="lib-lock">&#128274; ${b.unlock.desc}</div>
        </div>`;
      }
      return `<div class="lib-card">
        ${this.bookArt(b, 'book-icon-lg')}
        <div class="lib-name">${b.name}${owned ? ' <span class="lib-owned">&#9679; SHELVED</span>' : ''}</div>
        <div class="rarity r-${b.rarity}">${b.rarity.toUpperCase()}</div>
        <div class="desc">${b.desc}</div>
        ${b.flavor ? `<div class="flavor">${b.flavor}</div>` : ''}
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
      const res = this.shop.buyBag(Number(i));
      ok = !!res;
      if (res) this.openPicker(res);
    }
    else if (act === 'penpack') {
      const res = this.shop.buyPenPack();
      ok = !!res;
      if (res) this.openPenPick(res);
    }
    else if (act === 'cons') ok = this.shop.buyConsumable(Number(i));
    else if (act === 'sell') ok = this.shop.sellBook(id);
    else if (act === 'restock') ok = this.shop.restock();
    else if (act === 'close') {
      this.els['shop'].classList.add('hidden');
      this.game.nextLevel();
      this.render();
      this.game.saveRun(); // shop closed → next round is the new checkpoint
      return;
    }

    if (ok) Sfx.buy(); else Sfx.invalid();
    this.renderShop();
    this.renderStats();
    this.renderShelf();
    this.drainAchievements(); // a shop sticker can earn one; shop skips render()
    this.game.saveRun();      // persist purchases as they happen
  }
}
