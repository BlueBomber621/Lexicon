# LEXICON — Assets

Home for **designed** art and audio. Right now the game ships with **zero
external asset files**: every icon is an inline SVG `<symbol>` in `index.html`,
and every sound is synthesised live in `js/audio.js`. This folder is the staging
ground for when you want to replace that placeholder art with hand-designed
pieces and add real sound.

Nothing in here is loaded by the game *yet* — dropping a file here changes
nothing until you wire it in (see each subfolder's README). That's deliberate:
**design here first, integrate when ready.**

## Layout

| Folder | Holds | Wires into |
| --- | --- | --- |
| `art/slugs/` | Tile faces & material textures | `css/style.css` (`.tile.*`) |
| `art/books/` | Book covers (the jokers) | `#icon-book-<id>` in `index.html` |
| `art/bosses/` | Boss seals | `#icon-boss-<id>` |
| `art/stickers/` | Corner sticker badges | `#icon-sticker-<id>` |
| `art/ui/` | Bags, slips, pens, difficulty stamps, cases | `#icon-*` |
| `sounds/` | One-shot SFX samples | `js/audio.js` |
| `soundtracks/` | Music loops | `js/audio.js` (new music channel) |

## How the art works today

Icons live as `<symbol>` elements inside the hidden `<svg>` sprite at the top of
`index.html`, drawn with `<use href="#icon-...">`. **The id is the contract** —
CSS and JS only ever reference the id, never a file. So the cleanest migration
keeps ids identical:

1. Design your replacement here (SVG preferred — it's what the sprite uses and
   it scales cleanly).
2. Optimise it (e.g. SVGO), strip its own `width`/`height`, and give it the
   matching `viewBox` (below).
3. Paste its guts into the existing `<symbol id="icon-...">` in `index.html`,
   replacing the placeholder paths. **No CSS or JS changes needed.**

### viewBox conventions

| Kind | viewBox | Notes |
| --- | --- | --- |
| Book covers | `0 0 48 60` | Portrait; tinted by rarity via `currentColor` |
| Bosses, bags, slips, pens, difficulty, cases | `0 0 48 48` | Square |
| Stickers | `0 0 20 20` | Tiny corner badge |

Art is **monochrome + `currentColor`**: covers are tinted by rarity
(`.book-icon.r-rare`, etc.) and seals inherit their context colour. Keep new art
single-colour and let CSS tint it — unless you deliberately want fixed colours
(then hard-code the fills).

`js/content.js` (`BOOKS`, `BOSSES`, `STICKERS`, `DECKS`, `BAGS`, `PENS`,
`CONSUMABLES`) is the **source of truth** for which `<id>`s exist.
