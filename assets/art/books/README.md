# Book covers

The jokers. One cover per Book, drawn from `#icon-book-<id>`.

- `viewBox="0 0 48 60"` (portrait).
- Single-colour + `currentColor` — rarity tints it (common / uncommon / rare).
- File naming: `icon-book-<id>.svg`, where `<id>` is the Book's `id` in
  `js/content.js` (e.g. `icon-book-pica.svg`, `icon-book-first-edition.svg`).
- Special: `icon-book-unknown.svg` is the locked / undiscovered cover.

There are ~60 Books. `BOOKS` in `js/content.js` is the authoritative id list.
