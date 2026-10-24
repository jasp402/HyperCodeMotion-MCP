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
      "props": {"text": "HyperCodeMotion", "x": 540, "y": 960, "size": 90, "color": "#E8F27A"},
      "fx": {"in": {"id": "rise", "dur": 0.5, "amount": 1}}
    }
  ]
}
```

This is an illustrative sample for this 1080×1920 canvas, not evidence of a successful real render. Do not copy its pixel size onto another ratio.

## Type size follows the screen

Decide `width` and `height` before any type size. `get_capabilities` returns the rule and the numbers in `screen` (the same figures Studio calls PANTALLA). The starting sizes in `screen` (title, support, label) are a starting point, neither a minimum nor a maximum: a bigger, disruptive headline is fine when it still fits the safe area. Fit the words inside that safe area: lower the size or wrap lines when they do not fit. `line-height` is at least 1, so the box wraps the glyphs instead of cropping them. The canvas crops whatever still falls outside the frame. `validate_json` rejects measurable text that does not fit, text that crosses the canvas, and `line-height` below 1. It warns when text sits in the margin. It still does not render the picture (`fullyValidated` stays false).

## Layers and timing

Supported layer types from the current contract snapshot: `text`, `rect`, `ellipse`, `polygon`, `particles`, `image`, `video`, `code`, `camera`, `svg`, `ui`, `cursor`, `html`, `runtime`, `component`. Query `get_capabilities` for properties per type. Layer order determines draw order (earliest at back). Use stable, unique IDs. `start` and `end` denote visible interval in composition seconds, `[start,end)`. `parent` refers to another layer ID; `clip` can mask children where supported; `fixed` remains screen-fixed through camera or scene transitions.

A property value may be fixed (number/string), `{"kf":[{"t":0,"v":0},{"t":1,"v":100,"ease":"easeOutCubic"}]}`, or `{"expr":"..."}`. Keyframe timestamps are global composition seconds. Spring targets may be specified by `spring` where supported by Studio; check actual accepted names.

Do not redraw an existing Lottie, glTF or GSAP file as rects or HTML pieces. Emit one `runtime` layer: `engine` is `lottie`, `three` or `gsap`; `asset` is the id of the original file inside `assets`; `text`, `color`, `node` and `clip` are optional patches. The original bytes stay in `assets`. Sound stays in the audio channels. A script that only advances on its own will not scrub. `validate_json` does not render it. HTML text that changes on every frame for a long time is a native `text` layer.

Optional composition structures include `scenes` (sequential periods and transitions), `docs` (HTML templates), `assets`, `audio`, `camera`, `params`, `plan`, `markers` and `components`. Do not fabricate structures: inspect Studio code for advanced fields.

## The user's own files (photos, cut-outs, logo, videos)

When the request lists the user's files by id (Studio's «Tus materiales», e.g. `"video-1" · «playa.mp4» · video · 1920×1080 · 12.4 s`), those files already live in the user's Studio and are filled in by id when the project opens. Nothing is uploaded to the MCP.

- Image (photo, cut-out or logo): an `image` layer with `"asset": "<id>"` and its own proportion, or `<img src="asset:<id>">` inside an HTML scene.
- Video: a `video` layer. `props.from` is the second of the file where the clip starts; the clip lasts `end - start`. Keep `from + (end - start)` within the file's duration. Videos play without sound (sound lives in Studio's audio channels). For full frame use the canvas `w`/`h`: the video is cropped to cover, never stretched.

```json
{"id":"clip1","name":"Clip · playa","type":"video","start":2,"end":5.5,"props":{"asset":"video-1","from":6.4,"x":540,"y":960,"w":1080,"h":1920}}
```

- Do not add these ids to `assets` and never use a URL for them. Use only ids the user listed; an unknown id opens as an empty slot.
- Videos usually arrive as a sheet of frames with their seconds (`materiales-para-claude.png`): pick each clip's `from` from it.

## Editing an existing project

Start from the user's composition and return all of it with the changes applied. Keep untouched layers, IDs, docs, assets and audio byte-for-byte; change only what was asked. Keep `start`/`end` and keyframe times inside `duration`. Deliver it through `create_hcmotion` like a new project.

## Combining projects

To concatenate scenes: remap every layer ID and referenced `parent`; offset layer start/end, keyframes, scene times, plan marks and sound timings; merge documents/assets/components without key collisions; ensure consistent canvas/fps/scale; define transitions and continuity. To overlay: preserve one timeline and layer order, namespace IDs, check collisions, and retain original audio and user assets. Validate the merged whole. Do not claim exact compatibility from structural validation only.
