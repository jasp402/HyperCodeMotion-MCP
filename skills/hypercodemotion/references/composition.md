# HyperCodeMotion composition contract

**Source:** HyperCodeMotion Studio `packages/core/src/types.ts` and `prompt.ts`. Confirm revisions against MCP `get_capabilities` and repository source; this reference is descriptive, not an exhaustive runtime schema.

## Root format

The only deliverable is a **complete composition** with a `layers` array at the root, sent to MCP `create_hcmotion`, which validates it and returns `.hcmotion` links. Studio opens `.hcmotion` files only; it has no box to paste JSON.

Studio's core also knows design specs (root `elements`) and improvement patches (`add/change/remove/sfx`), but neither can be packed into a `.hcmotion` file. Don't produce them. To edit an existing project, return the full updated composition.

### Minimal complete composition

```json
{
  "version": 1,
  "name": "Editorial title",
  "width": 1080,
  "height": 1920,
  "fps": 30,
  "duration": 6,
  "background": "#101018",
  "params": {"accent": "#E8F27A"},
  "layers": [
    {
      "id": "title",
      "name": "Hero title",
      "type": "text",
      "start": 0.2,
      "end": 5.8,
      "props": {"text": "HyperCodeMotion", "x": 540, "y": 960, "size": 96, "color": "#E8F27A"},
      "fx": {"in": {"id": "rise", "dur": 0.5, "amount": 1}}
    }
  ]
}
```

This is an illustrative sample, not evidence of a successful real render.

## Layers and timing

Supported layer types from the current contract snapshot: `text`, `rect`, `ellipse`, `polygon`, `particles`, `image`, `code`, `camera`, `svg`, `ui`, `cursor`, `html`, `component`. Query `get_capabilities` for properties per type. Layer order determines draw order (earliest at back). Use stable, unique IDs. `start` and `end` denote visible interval in composition seconds, `[start,end)`. `parent` refers to another layer ID; `clip` can mask children where supported; `fixed` remains screen-fixed through camera or scene transitions.

A property value may be fixed (number/string), `{"kf":[{"t":0,"v":0},{"t":1,"v":100,"ease":"easeOutCubic"}]}`, or `{"expr":"..."}`. Keyframe timestamps are global composition seconds. Spring targets may be specified by `spring` where supported by Studio; check actual accepted names.

Optional composition structures include `scenes` (sequential periods and transitions), `docs` (HTML templates), `assets`, `audio`, `camera`, `params`, `plan`, `markers` and `components`. Do not fabricate structures: inspect Studio code for advanced fields.

## Editing an existing project

Start from the user's composition and return all of it with the changes applied. Keep untouched layers, IDs, docs, assets and audio byte-for-byte; change only what was asked. Keep `start`/`end` and keyframe times inside `duration`. Deliver it through `create_hcmotion` like a new project.

## Combining projects

To concatenate scenes: remap every layer ID and referenced `parent`; offset layer start/end, keyframes, scene times, plan marks and sound timings; merge documents/assets/components without key collisions; ensure consistent canvas/fps/scale; define transitions and continuity. To overlay: preserve one timeline and layer order, namespace IDs, check collisions, and retain original audio and user assets. Validate the merged whole. Do not claim exact compatibility from structural validation only.
