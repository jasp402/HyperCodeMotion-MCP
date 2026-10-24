# Motion direction

Use motion to communicate narrative hierarchy, causality and change. Set duration and pacing from the actual script or brief, not from an arbitrary 6-second default.

## Time plan

Build a scene/beat table with start, end, focal layer, action, transition and audio cue. Reserve readable holds for important captions. Enter elements progressively when it makes the hierarchy clearer. Use overlapping movement intentionally, not randomly.

## Effects from Studio

The source-pinned contract currently lists:
- Entrance/exit: `fade`, `rise`, `slide`, `pop`, `wipe`, `zoom`, `drop`, `blur`, `swap`, `spin`, `type`, `letters`, `words`, `draw`
- Loop: `float`, `pulse`, `rotate`, `sway`, `shake`, `heartbeat`, `blink`, `breathe`
- Style: `glow`, `shadow`, `lift`, `outline`, `neon`

**Not all presets work on all types or slots.** `get_capabilities` lists the slots of each preset (`presetSlots`).

### How to write `fx`

A layer has at most one effect per slot: `"fx": {"in": FxRef, "out": FxRef, "loop": FxRef, "style": FxRef}`. Every slot uses the same shape, from Studio `presets.ts`:

- `id`: the preset name.
- `dur`: seconds. For `in` it is the entrance length from the layer's `start`; for `out` the exit length ending at the layer's `end`; for `loop` the period of one cycle. Ignored by `style`.
- `amount`: intensity, `1` is normal. Use about `0.3`–`0.6` for a subtle loop, up to `1.5` for an emphatic entrance.

```json
"fx": {
  "in":    {"id": "rise",    "dur": 0.6, "amount": 1},
  "out":   {"id": "fade",    "dur": 0.4, "amount": 1},
  "loop":  {"id": "breathe", "dur": 3,   "amount": 0.4},
  "style": {"id": "glow",    "dur": 0,   "amount": 0.8}
}
```

An `out` preset is the same movement as its entrance, played backwards. Type limits from `presets.ts`: `wipe` only on `image`, `video` and `html`; `type`, `letters` and `words` only on `text`; `draw` only on `rect`, `ellipse`, `polygon` and `svg`; `outline` and `neon` only on `text`, `rect`, `ellipse` and `polygon`. On another type Studio ignores the effect.

## Keyframes

Use global-second `kf` for physical changes and exact timing. Each keyframe's `ease` is the curve **towards the next** keyframe (the last keyframe's `ease` is unused). Valid names, from Studio `easing.ts`:

- `linear`, `hold` (jumps at the next keyframe; use it for text that changes)
- `easeInQuad`, `easeOutQuad`, `easeInOutQuad`, `easeInCubic`, `easeOutCubic`, `easeInOutCubic`, `easeInQuart`, `easeOutQuart`, `easeInOutQuart`, `easeInExpo`, `easeOutExpo`, `easeInOutExpo`, `easeInSine`, `easeOutSine`, `easeInOutSine`
- `easeInBack`, `easeOutBack`, `easeInOutBack`, `easeOutElastic`, `easeInOutElastic`, `easeInBounce`, `easeOutBounce`
- `spring`, `springSnappy`, `springBouncy`, `springSmooth`, `springHeavy`, or `spring(damping,stiffness,mass)`
- `cubic-bezier(x1,y1,x2,y2)`, as in CSS.

No validator checks these names: an unknown one silently becomes `easeInOutCubic`, so copy them exactly. Preserve property continuity across cuts; use eased changes for entering/leaving and restrained loops for ambient details. For a morphing object, keep stable layer identities and animate its attributes rather than repeatedly hiding/redrawing copies.

## Sound and rhythm

Map music beats and SFX to actual on-screen events. Do not claim that music or a sample is available unless supplied or supported by Studio. A composition carries sound in its `audio` structure. Confirm its schema in Studio before authoring complex audio.

## Render QA

Inspect actual time samples, especially around scene boundaries and after exits. Look for empty intervals, collisions, jarring scale shifts, oscillation overload and illegible animated type. Validation MCP cannot perform this visual inspection.
