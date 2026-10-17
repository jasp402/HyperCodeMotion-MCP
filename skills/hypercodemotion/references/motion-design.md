# Motion direction

Use motion to communicate narrative hierarchy, causality and change. Set duration and pacing from the actual script or brief, not from an arbitrary 6-second default.

## Time plan

Build a scene/beat table with start, end, focal layer, action, transition and audio cue. Reserve readable holds for important captions. Enter elements progressively when it makes the hierarchy clearer. Use overlapping movement intentionally, not randomly.

## Effects from Studio

The source-pinned contract currently lists:
- Entrance/exit: `fade`, `rise`, `slide`, `pop`, `wipe`, `zoom`, `drop`, `blur`, `swap`, `spin`, `type`, `letters`, `words`, `draw`
- Loop: `float`, `pulse`, `rotate`, `sway`, `shake`, `heartbeat`, `blink`, `breathe`
- Style: `glow`, `shadow`, `lift`, `outline`, `neon`

**Not all presets work on all types or slots.** Always query `get_capabilities` and, where necessary, verify restrictions in `presets.ts`. A typical non-destructive preset reference is `"fx":{"in":{"id":"rise","dur":0.5,"amount":1}}`.

## Keyframes

Use global-second `kf` for physical changes and exact timing. Preserve property continuity across cuts; use eased changes for entering/leaving and restrained loops for ambient details. For a morphing object, keep stable layer identities and animate its attributes rather than repeatedly hiding/redrawing copies.

## Sound and rhythm

Map music beats and SFX to actual on-screen events. Do not claim that music or a sample is available unless supplied or supported by Studio. A composition carries sound in its `audio` structure. Confirm its schema in Studio before authoring complex audio.

## Render QA

Inspect actual time samples, especially around scene boundaries and after exits. Look for empty intervals, collisions, jarring scale shifts, oscillation overload and illegible animated type. Validation MCP cannot perform this visual inspection.
