# MCP validation and Studio handoff

## Preflight loop

1. The HyperCodeMotion MCP is required. Call `get_capabilities` before designing layer properties and effects. If it is not connected, ask the user to connect it before generating.
2. Generate one complete composition with `layers` at the root.
3. Always call `validate_json` on the finished draft before `create_hcmotion`: it returns the self-review checklist. Apply it and fix the composition; quality matters more than saving tokens. `create_hcmotion` runs the same checks again.
4. Correct errors and investigate warnings. Validate again after corrections.
5. Call `create_hcmotion`. If `created` is false, fix the listed errors and call it again. Hand the user the `open` and `download` links (valid 24 hours), never the raw JSON.
6. Tell the user to open the `open` link and check the preview; you have not seen the render.

## What validation proves

Current MCP validation is a structural preflight plus a measurement of whether text can fit the canvas. Errors (which block `create_hcmotion`) cover the root format, timing, references and text fit. Unknown layer types, property names and effect presets are only **warnings** (`UNKNOWN_LAYER_TYPE`, `UNKNOWN_PROPERTY`, `UNKNOWN_EFFECT`): read every warning and fix them, because Studio may drop that layer, property or effect. Keyframe easing and spring names are checked (`UNKNOWN_EASE`: Studio would silently play `easeInOutCubic` or `ui`), and two different texts on the same spot at the same time warn `TEXT_OVERLAP`; effect `dur`/`amount` values and asset contents are not checked at all, which is what the `CONTRACT_NOT_CHECKED` warning says. A valid composition also returns a short `checklist`: review the video against it. It rejects measurable native text and HTML pieces that cannot fit the safe area, text that crosses the canvas, and `line-height` below 1. It warns when text sits in the margin. It reports `fullyValidated: false`. Therefore `valid: true` does not certify visual quality, rendering, animation smoothness, exact asset resolution, or acceptance of every feature by Studio. Expressions, parented placement, rotation, shadows and filters are not measured.

If the MCP is not connected, never claim it was used. If no preview has been inspected, never state that the result rendered successfully.

## Repair priorities

First fix top-level format and missing data, then timing and references, unsupported properties/effects, document/asset links, and finally visually inspect composition, continuity and typography. Preserve original project elements and audio unless changes are requested.

## Security

Do not share private prompts or user images in publicly committed examples. Do not execute embedded code or expressions as part of structural checks.
