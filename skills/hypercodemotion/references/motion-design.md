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

## Scene transitions

Studio plays a transition when one scene hands over to the next. Declare `scenes` at the composition root (consecutive, never overlapping) and put a `transition` on every scene after the first:

```json
"scenes": [
  {"id": "s1", "name": "Problem", "start": 0, "end": 2},
  {"id": "s2", "name": "Idea",    "start": 2, "end": 4, "transition": {"type": "push", "dur": 0.6, "dir": "right", "ease": "easeInOutCubic"}},
  {"id": "s3", "name": "Result",  "start": 4, "end": 6, "transition": {"type": "zoom", "dur": 0.5}}
]
```

Full working file: [scene-transitions.json](../examples/scene-transitions.json). From Studio `types.ts` and `render.ts`:

- `type`: `fade` (cross-dissolve), `slide` (new scene slides over the old one), `push` (new scene pushes the old one out), `wipe` (reveal edge), `clockWipe` (clockwise sweep from 12 o'clock), `iris` (circle opens from the centre), `zoom` (old scene grows and fades, new one settles in from 85%), `flip` (card flip: old scene squashes to a line, the new one opens), `blur` (cross-dissolve through a blur). An unknown `type` is a hard cut.
- `dur`: seconds, above 0 (typically 0.4–0.8, never longer than the scene). Studio ignores the transition when `dur` is 0 or missing.
- `dir`: `left`, `right`, `up` or `down` = the side the new scene enters **from**; used by `slide`, `push`, `wipe` and `flip` (flip uses only the axis). Default `right`. Leave it out for `fade`, `clockWipe`, `iris`, `zoom` and `blur`. An invalid value does not fall back to the default: `slide` stops moving and `wipe` runs top-down.
- `ease`: any name from the list above; default `easeInOutCubic`.
- It is an **entry** transition played at the new scene's `start`, so it belongs to the scene that arrives. It is ignored on the first scene. The outgoing scene stays frozen on its last frame during the transition: finish its motion before the cut.
- Layers that belong to no scene (fixed layers under or over everything) are drawn outside the transition. Without them the scenes are composited opaque over `background`, so give each scene its own background layer or palette change.

Choose by meaning: `push` and `slide` for sequence or progress, `zoom` and `iris` to enter a detail, `fade` and `blur` for a calm change of topic, `wipe` for a reveal, `flip` for before and after. Vary them across the video, but keep one family so the edit feels designed. The MCP `validate_json` warns about the mistakes above (`TRANSITION_*` and `SCENE*` codes) but does not render: it cannot tell you the transition looks good.

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
