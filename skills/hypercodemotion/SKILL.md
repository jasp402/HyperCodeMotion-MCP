---
name: hypercodemotion
description: Turn briefs, images, reference videos, scripts, assets and existing projects into professional, editable HyperCodeMotion JSON. Guides art direction, scene architecture, motion, asset integration, MCP checks and Studio handoff.
---

# HyperCodeMotion — Creative Composition Skill

Use this Skill when asked to create, improve, extend, combine, or troubleshoot editable HyperCodeMotion motion graphics. The goal is **excellent visual direction AND importable data**, not merely syntactically valid JSON.

## Workflow (follow in order)

1. **Brief and inputs** — Identify purpose, audience, distribution format, duration, fps, language, brand, CTA (only when requested), narration and exact data. Analyze user-provided reference images/video, scripts, logos, visual assets and any existing JSON. Distinguish factual content from creative decisions. Ask only for information that blocks progress.
2. **Art direction** — Define visual concept, typography hierarchy, spacing grid, palette, contrast, material, rhythm, transition vocabulary and continuity. Reuse the actual reference's visual intent; do not invent a brand or factual measurements. When the request names a Studio gallery template (an id such as `mix-promo-editorial`), call `get_template` with that id and the video's format, and follow its design: palette, fonts, frame, scene system and motion; replace all its texts.
3. **Storyboard and scenes** — Create sequential beats with one communicative objective each. Decide which objects persist and transform between beats versus which appear only within one scene. Allocate time to reading and transitions; storyboard timing must fit total duration.
4. **Composition plan** — Default to **HTML scenes**: one HTML document per scene in `docs`, each visible piece marked `data-hcm` and animated by its own `html` layer (see [html-scenes](references/html-scenes.md) and [the example](examples/html-scene-launch.json)). Use native layers (`text`, `rect`, `particles`…) when a piece must be edited as geometry or needs per-property keyframes. Plan layer IDs, order, scene boundaries, assets, effects and audio.
5. **JSON generation** — Produce **one complete, standalone composition** with `layers` at the root. To change an existing project, return the whole updated composition (keep unchanged layers, IDs and assets as they were), not a patch: a `.hcmotion` file can only carry a full composition.
6. **MCP validation** — The HyperCodeMotion MCP (`https://mcp.hypercodemotion.com/mcp`) is required. Call `get_capabilities` before selecting layer/effect fields; `validate_json` is optional for drafts. **Do not claim validation if no call occurred.**
7. **Studio handoff** — Call `create_hcmotion` with the finished JSON. If `created` is false, fix every error and call it again. Give the user the two links it returns: `open` (opens the project in Studio) and `download` (the `.hcmotion` file, to keep or load later with «Cargar proyecto»), and say both expire in 24 hours. **Never paste the composition JSON for the user to copy:** Studio only opens `.hcmotion` files. If the MCP is not connected, stop and ask the user to connect it instead of returning JSON. Never claim a perfect render from MCP results alone.

## Turning a public video into a gallery template

When the user shares the link of a video from prompt-motion.com or oneshotted.io and wants it in the Studio gallery, open that page yourself and call `get_recreation_brief` with the link and what the page shows (the address of its .mp4 video, its prompt, title and author); call it again while its reference frames are being prepared, and follow its brief, working from the reference frames of the original: recreate it in the three formats in this conversation, check each with `validate_json`, then call `propose_template`. Look at the comparison `get_proposal_status` returns (original and recreation side by side), fix what differs and send it again with the same code; call `publish_template` only when it truly looks like the original. The user only gives the link; do not show them compositions. Give them the tracking code. If the brief says the video already exists, give that status instead of recreating it.

## Always load relevant references

- [Composition and JSON contract](references/composition.md): root format, layers, timing, scenes, editing and merging.
- [Art direction](references/visual-design.md): design systems, images and fidelity to references.
- [Motion direction](references/motion-design.md): animation, pacing, continuity, keyframes.
- [HTML scenes and assets](references/html-scenes.md): docs, data-hcm, image assets and safe references.
- [MCP validation and QA](references/validation.md): tools, repair loop, truthful confidence.

Load only the applicable reference files instead of pasting all reference contents into the model context every time.

## Creative acceptance criteria

- Clear narrative and design hierarchy; readable at target size.
- Deliberate transitions; motion supports meaning rather than decorating every element.
- Consistent colors, type, spacing and asset treatment across scenes.
- No overlaps, cropped labels, flicker, unintentional empty frames or jumps in continuity (visually verify in Studio; do not assert without rendering). Type size yields to the canvas: see [composition.md](references/composition.md).
- Headlines read as separate words: keep letter-spacing at or above `-0.03em` for big type (tighter makes «Escribe menos» look like one word).
- Exact textual and numerical facts respected; no placeholder assets masquerading as real images.
- Compositions remain editable: descriptive layer names/IDs, coherent layers, keyframes and asset references.
- Layer effects and properties selected from actual Studio capabilities, not guessed APIs.

## Non-negotiable truthfulness

`validate_json` performs **structural preflight** against a source-pinned capability snapshot and rejects measurable text that cannot fit the canvas (`get_capabilities` field `screen`), text that crosses the canvas, and `line-height` below 1. It returns `fullyValidated: false` and **cannot verify appearance or guarantee Studio import/rendering**. Images in a prompt are references; they are not automatically embedded in JSON. The exception is files the user lists by id (photos, cut-outs, a logo, videos kept in their Studio): reference those ids in `image` and `video` layers as [the contract](references/composition.md) describes. Never invent other asset IDs, live external image URLs, render results, tool calls, or successful tests.

## Output contract

Default: a single composition object with `version: 1`, positive dimensions/fps/duration, `background`, `params`, and a nonempty `layers` array, delivered **only through `create_hcmotion`** as `.hcmotion` links. Do not put commentary inside JSON.

Before output: confirm requested duration, meaningful visibility of every scene, valid asset references and `layers` at the root. If validation could not be completed, say so in your message.
