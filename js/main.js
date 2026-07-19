// main.js — boot: decompress the dictionary, wire up the game, reveal the UI.

(async function boot() {
  const loadingEl = document.getElementById('loading');
  const msgEl = document.getElementById('loading-msg');

  // Patchwork layer: a failed dictionary load can't be recovered, but we can
  // at least tell the player instead of hanging on the boot screen forever.
  const dict = new Dictionary();
  try {
    await dict.load(LEXICON_GZ_B64);
  } catch (err) {
    msgEl.textContent = 'THE TYPE CASE IS EMPTY — DICTIONARY FAILED TO LOAD';
    throw err; // keep the real error in the console
  }

  const game = new Game(dict);
  const ui = new UI(game);
  ui.render();
  window.LEX = { game, ui }; // console handle for debugging / balance tinkering

  msgEl.textContent = `${Util.fmt(dict.size)} WORDS SET`;
  await Util.sleep(400);
  loadingEl.classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  ui.openDeckPick(); // pick a starting case (or keep the freshly dealt run)
})();
