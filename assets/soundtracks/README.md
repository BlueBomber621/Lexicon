# Soundtracks (music)

Looping background music. **For later** — there's no music channel yet.

Ideas that suit the escalation: a calm compose-room loop, a tenser boss-round
loop, and a Foundry (shop) loop. Seamless, loop-friendly `.ogg` / `.mp3`.

**Wiring:** add a music channel to `js/audio.js` — a looping `<audio>` element,
or a WebAudio buffer source with its own gain node. Start it after the first
user gesture (the AudioContext already unlocks on the first click), and swap
loops on boss rounds / shop open. Respect the existing `Sfx.muted` toggle, or
add a separate music mute.
