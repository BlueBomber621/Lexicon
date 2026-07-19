# Sounds (SFX)

One-shot sound effects. **For later** — today every SFX is synthesised live in
`js/audio.js` (WebAudio oscillators, no files), so this folder stays empty until
you want sampled sound.

Suggested drop-ins, named after the `Sfx` methods they'd replace/layer:
`click`, `letter`, `mult`, `total`, `copy`, `reroll`, `buy`, `win`, `unlock`,
`lose`, `invalid`. Keep them short and normalised; `.ogg` or `.mp3`/`.m4a` for
reach.

**Wiring:** add a small sample loader/player to `js/audio.js` and have each
`Sfx.*` method play its buffer instead of (or on top of) the synth. Preserve the
`muted` flag and the fail-silent `_play` wrapper so audio never breaks play.
