# Slug art

The letter tiles ("slugs"). Unlike everything else, slugs are **pure CSS today**
— no SVG. Their look is gradients + borders in `css/style.css`:

- Base slug: `.tile` (cast-lead gradient).
- Materials (variants): `.tile.v-paper`, `.v-woodblock`, `.v-cornerstone`,
  `.v-ligature`, `.v-deckle`, `.v-cardstock`.
- Stylings (alterations): `.tile.a-red`, `.a-comic`, `.a-bold`, `.a-italic`,
  `.a-underline`, `.a-highlight`, `.a-fuzzy`.

Design bespoke faces or textures here if you want to move past CSS gradients —
a lead-grain surface, per-material textures, a foil pattern, etc. Suggested
naming: `slug-base.*`, `variant-<id>.*` (e.g. `variant-woodblock.png`),
`alteration-<id>.*`. Wire them in as a `background-image` on the matching class,
or as a `::before` texture layer under the letter.
