---
name: hypercodemotion
description: Turn briefs, images, reference videos, scripts, assets and existing projects into professional, editable HyperCodeMotion JSON. Guides art direction, scene architecture, motion, asset integration, MCP checks and Studio handoff.
---

# HyperCodeMotion — Creative Composition Skill

Use this Skill when asked to create, improve, extend, combine, or troubleshoot editable HyperCodeMotion motion graphics. The goal is **excellent visual direction AND importable data**, not merely syntactically valid JSON.

## Workflow (follow in order)

1. **Brief and inputs** — Identify purpose, audience, distribution format, duration, fps, language, brand, CTA (only when requested), narration and exact data. Analyze user-provided reference images/video, scripts, logos, visual assets and any existing JSON. Distinguish factual content from creative decisions. Ask only for information that blocks progress.
2. **Art direction** — Define visual concept, typography hierarchy, spacing grid, palette, contrast, material, rhythm, transition vocabulary and continuity. Reuse the actual reference's visual intent; do not invent a brand or factual measurements.
3. **Storyboard and scenes** — Create sequential beats with one communicative objective each. Decide which objects persist and transform between beats versus which appear only within one scene. Allocate time to reading and transitions; storyboard timing must fit total duration.
4. **Composition plan** — Choose native editable layers for shapes/text/particles, HTML documents + individually addressed `data-hcm` parts for editorial/UI layouts, and supported media references for images. Plan layer IDs, order, parent/clip relationships, assets, text, effects, keyframes, audio and scene boundaries.
5. **JSON generation** — Produce **one complete, standalone composition** with `layers`, or an `elements` design only when specifically requested. For an existing project using “Mejorar con IA”, produce an improvement patch using `add/change/remove/sfx` and preserve unchanged data. Never confuse the patch with a standalone composition.
6. **MCP validation** — When HyperCodeMotion MCP is connected, call `get_capabilities` before selecting layer/effect fields; call `validate_json` after generation, with the original composition as context for patches. Correct errors, inspect warnings and validate again. **Do not claim validation if no call occurred.**
7. **Studio handoff** — Return the format required by the target Studio workflow and concise notes only when permitted by the output requirements. Test actual import/render in Studio when possible. Never claim a perfect render from MCP results alone.

## Always load relevant references

- [Composition and JSON contract](references/composition.md): full vs design vs patch, layers, timing, scenes and merging.
- [Art direction](references/visual-design.md): design systems, images and fidelity to references.
- [Motion direction](references/motion-design.md): animation, pacing, continuity, keyframes.
- [HTML scenes and assets](references/html-scenes.md): docs, data-hcm, image assets and safe references.
- [MCP validation and QA](references/validation.md): tools, repair loop, truthful confidence.

Load only the applicable reference files instead of pasting all reference contents into the model context every time.

## Creative acceptance criteria

- Clear narrative and design hierarchy; readable at target size.
- Deliberate transitions; motion supports meaning rather than decorating every element.
- Consistent colors, type, spacing and asset treatment across scenes.
- No overlaps, cropped labels, flicker, unintentional empty frames or jumps in continuity (visually verify in Studio; do not assert without rendering).
- Exact textual and numerical facts respected; no placeholder assets masquerading as real images.
- Compositions remain editable: descriptive layer names/IDs, coherent layers, keyframes and asset references.
- Layer effects and properties selected from actual Studio capabilities, not guessed APIs.

## Non-negotiable truthfulness

`validate_json` currently performs **structural preflight** against a source-pinned capability snapshot, returns `fullyValidated: false`, and **cannot verify appearance or guarantee Studio import/rendering**. Images in a prompt are references; they are not automatically embedded in JSON. Never invent asset IDs, live external image URLs, render results, tool calls, or successful tests.

## Output contract

Default for **Importar desde prompt**: a single JSON object with `version: 1`, positive dimensions/fps/duration, `background`, `params`, and a nonempty `layers` array. Return one ```json``` block if requested by Studio. For **Mejorar con IA**, use the operation envelope, not `layers` at root. For oversized outputs, offer a downloadable JSON file if the host supports it. Do not put commentary inside JSON.

Before output: confirm requested duration, meaningful visibility of every scene, valid source asset references and correct top-level mode. If validation could not be completed, report that outside the JSON only if the target output format permits.
