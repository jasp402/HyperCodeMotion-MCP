# Capability gap audit: what Studio can do vs. what the model is told

Scope: HyperCodeMotion Studio at `18a29cd` (read-only) against this repository at `747a15a` (plus this PR).
All token counts are **estimates** (tiktoken `cl100k_base`; Claude's tokenizer differs, usually a little higher).
Line numbers are Studio paths unless prefixed `mcp:`.

Hard constraint behind every recommendation: the connector must stay usable on **free claude.ai accounts**, so the fixed cost
(tool descriptions + skill front matter, paid in every conversation) must not grow, and new knowledge must be **small, on demand and tested**.

## 1. Short answer

- Studio has far more motion knowledge than the model ever sees. It lives in **code and in the Studio's own prompt builders**, not in anything the MCP or the skill serves.
- The **"hundred powerful skills" are not in either repository.** See [section 2](#2-the-hundred-skills-were-they-found).
- The model sees: a list of property **names** per layer type (`get_capabilities`), ~7 k tokens of prose (skill + 5 references), and two example files.
  It is not told what the names mean, which values are valid, or which combinations look good.
- The only way to see a *good* design is `get_template`, which returns a **whole composition: 6 k to 72 k tokens, median ≈ 24.8 k** (measured on the 39 vertical gallery files). Too expensive to use as a recipe on a free account.
- Fix in one line: a tiny always-loaded skill plus **on-demand, individually tested recipes** (200–600 tokens each) served by one parameterized tool, plus a short self-review checklist. Details in [section 4](#4-proposed-architecture).

## 2. The "hundred skills": were they found?

| Where I looked | Result |
| --- | --- |
| `HyperCodeMotion` (Studio) repository, every `SKILL.md` | **None** (`find . -name SKILL.md` outside `node_modules`). No `.claude/`, `.cursor/`, `.agents/` folders. |
| `HyperCodeMotion-MCP` repository | Exactly **one** skill: `skills/hypercodemotion` (SKILL.md + 5 references + 2 examples; 3 with this PR). |
| Mentions of HyperFrames in Studio | Only as *inspiration*: `packages/core/src/looks.ts:6`, `htmlprompt.ts:3`, `apps/studio/src/html/scene.ts:2`, `apps/studio/src/docs/guides.tsx:303`. No code or skill files imported from it. |
| Upstream HyperFrames (`heygen-com/hyperframes`, cloned to `/workspace/hf-src` for this audit) | **26** `SKILL.md` files (`hyperframes`, `hyperframes-cli`, `hyperframes-registry`, `remotion-to-hyperframes`, `slideshow`, `figma`, `media-use`, …). Third-party, not part of either repo, not 100. |
| Distilled knowledge | `looks.ts:6` says the 13 "looks" are *"inspired by public style catalogs (HyperFrames, bang-motion, motion-designer, myfskills, vertical-video-editing-skill, motion-graphic-skill), with own values and names"*. So the "skills" were turned into **data in Studio code** (13 looks, 11 UI kinds, springs, brief detectors), and the Studio's AI prompt carries them. The MCP never sees them. |

Conclusion: nothing "hundred-sized" exists to expose. What exists is ~4 k lines of Studio TypeScript outside the audio engine (`looks.ts` 605, `ui.ts` 678, `easing.ts` 203, `uimotion.ts` 99, `choreo.ts` 161, `rhythm.ts` 211, `design.ts` 344, `plan.ts` 281, `prompt.ts` 576, `htmlprompt.ts` 219, `schema.ts` 400; plus `audio.ts` 1,252) and 9 documented recipes (`apps/studio/src/docs/recipes.ts`, 129 lines) of which 5 ship a real AI result (`docs/results/{A1,A2b,A3,UI1,HTML2}.json`). That is the right raw material for recipes.

## 3. Gap table

"Told" = what `get_capabilities` + SKILL.md + references say today. Cost = estimated tokens of the proposed fix, paid only when the model asks for it.

| # | Studio capability (evidence) | What the model is told (evidence) | Effect on quality | Token-cheap fix |
| --- | --- | --- | --- | --- |
| G1 | **Scene transitions**: 9 types, `dir`, `ease` (`types.ts:67` (`SceneTransition`), `:154`, `render.ts:1733` `transitionAt`, `1876-1966` `drawTransition`) | Nothing. `composition.md:51` only says `scenes` exist ("sequential periods and transitions"). | Hard cuts everywhere. 36 of 39 gallery templates have `scenes`, only **1** (`workspace-saas`) has a `transition`, so the gallery does not teach it either. | **Done in this PR**: `transitions` in `get_capabilities` (≈ 130 tokens), a section in `motion-design.md`, a tested example, `TRANSITION_*` validator warnings. |
| G2 | **UI motion**: `ui` layer with 11 kinds (`ui.ts:20-32`), spring tables (`easing.ts:50`, `155`), camera `follow`, brief detector `uimotion.ts` | `get_capabilities` lists the `ui` property names (`kind,text,sub,icon,items,data,…`) but not the 11 `kind` values or what each does. No skill text mentions `ui` beyond the layer-type list (`composition.md:45`). | Model never builds toasts, islands, trackers, tab bars, charts, palettes. UI-style promos fall back to plain rects and text. | Recipe `ui-<kind>` (≈ 250 tokens each, from `docs/results/UI1.json`) + one line with the 11 kinds in the recipe index. |
| G3 | **13 looks** (`looks.ts:71-248`): palette, fonts, shape, deco, default motion, rules | Not exposed. The skill says "define palette, typography…" and leaves invention to the model. | Generic palettes and fonts; the "AI look". | `get_motion_recipe("look:<id>")` ≈ 150 tokens each (id list ≈ 40 tokens in the index). |
| G4 | **Camera** layer: `x,y,zoom,rotation,shake,follow,fill,maxZoom,lag` (`schema.ts:227`, `render.ts`) | Names only (`get_capabilities`). Meaning, units, `follow` target format: undocumented. 5 of 39 templates use it. | No push-ins, parallax or shake. | Recipe `camera-push-in`, `camera-follow` (≈ 200 tokens). |
| G5 | **Text animation**: `anim` (chars/words/lines), `stagger`, `animDur`, `animEase`, `fromY/X/Scale/Rotation/Opacity/Blur`, `reveal`, `copies` (text props in `mcp: src/studio-contract.json`) | Names only. Skill/refs never mention `anim`, `stagger` or `reveal`. `fx` presets `letters`, `words`, `type` are listed in `motion-design.md`. | Kinetic typography is not attempted; titles just fade or rise. Only 8 of 39 templates use native `text` layers and few set `anim` (38 use `html` layers). | Recipes `text-letters-rise`, `text-words-stagger`, `text-type` (≈ 200 each), tested with `validateJson`. |
| G6 | **Audio**: `audio` structure, Tidal/Sonic Pi/Tone.js engines, `sfx`, `plan`/`markers` (`audio.ts`, `rhythm.ts`, `plan.ts`) | `composition.md:51` names `audio`, `plan`, `markers` and says "confirm its schema in Studio before authoring complex audio". `get_template` **strips `audio`** (`mcp: src/templates.js:18`). 35 of 39 templates carry audio. | No music or SFX in any generated project; a silent video. | Recipe `audio-basic` (shape + 2 working examples, ≈ 300 tokens); stop stripping `audio` in `get_template` or offer `include:["audio"]`. |
| G7 | **Runtime engines** Lottie / glTF / GSAP (`runtime.ts`) | Covered: SKILL.md:53, `composition.md:49`, capabilities text. | OK. 0 of 39 templates use it, so it is not exercised. | None. |
| G8 | **HTML layers** (default path), `data-hcm` pieces, `withFrame` iframe queue (`apps/studio/src/html/scene.ts:293-323`) | Well covered: `html-scenes.md`. | Good, but heavy: 70–80 % of output tokens are HTML escaped inside JSON, and a heavy first paint (see section 5). | Keep; add a "weight budget" rule (inlined fonts per piece) to `html-scenes.md`. |
| G9 | **Easings** (`EASINGS` + springs, `easing.ts:66`; unknown name falls back to `easeInOutCubic`, `:119`, `:143`) | Covered in `motion-design.md`. Unknown names silently become `easeInOutCubic`; validator does not check (`mcp: validator.js:88` `CONTRACT_NOT_CHECKED`). | Silent typos. | Validator warning `UNKNOWN_EASE` from the Studio list (≈ 0 tokens at runtime). |
| G10 | **Particles, cursor, code, svg, component** layers | Names only; no semantics. | Rarely used. Cursor and code are the building blocks of product demos. | Recipes `cursor-click`, `code-typing` (≈ 200 each). |
| G11 | **Gallery** (39 templates × 3 formats) | `get_template` returns everything (6 k–72 k tokens). | Too expensive to use as a reference on free accounts; models do not call it unless the user names an id. | Derive **recipes** (fragments) from the templates at build time; keep `get_template` for "follow this template". |
| G12 | **Validator scope**: `scenes`, camera, audio, `kf` easing names are unchecked (`mcp: validator.js:46`, `:88`) | Skill says what is and is not validated (`validation.md`). | Mistakes surface only when someone opens Studio. | This PR adds scene/transition warnings. Next: `UNKNOWN_EASE`, camera/audio shape checks. |
| G13 | **Loading a `.hcmotion` does not normalize or clamp transitions** (`hcmotion.ts:52` `decodeHcmotion` → `checkComposition` `:89`). Only the AI-prompt import path does (`prompt.ts:366-378` `cleanTransition`: `dur` 0.05–5, default 0.5). | n/a | A file with `dur: 0` or a bad `dir` opens but plays a hard cut, a static slide, or a wipe running top-down. | Validator warnings (done). Suggest the same `cleanTransition` call in `decodeHcmotion` (Studio change, not made here). |
| G14 | **Connector-only users get no guidance.** claude.ai does not pass `initialize.instructions` to the model (community reports `anthropics/claude-ai-mcp#93`, `#1105`; not Anthropic docs, not reproduced here). | `initialize.instructions` (263 tokens) is used only by Claude Code. | No canvas-size question, no art direction. | **Done**: `start` field in the `get_capabilities` result (≈ 70 tokens). |
| G15 | **Fixed cost**: the 4 publishing tools are ≈ 1,727 of 2,487 tool-description tokens (≈ 70 %) and only moderators use them. | Every user pays them in every conversation. | Wastes a free account's budget. | Move them to a second connector (moderators), or collapse them into one `template_admin(op, …)` tool. Saves ≈ 1,000 tokens per conversation: the budget that pays for a recipe tool. |

## 4. Proposed architecture

Principle: **the skill is a router, the MCP is the library.** Nothing big is loaded unless asked for.

```
Always loaded                  On demand (model decides)                Gate
-------------                  -------------------------                ----
SKILL.md front matter (52 tok) SKILL.md body (≈ 2.0 k tok)              skill trigger
tool list (≈ 4.2 k tok)        get_capabilities (≈ 1.8 k tok)           before designing
                               get_motion_recipe(name) (150-600 tok)    per effect the plan needs
                               references/*.md (0.4-1.8 k tok each)     by topic
                               validate_json (+ review checklist)       before delivery
```

### 4.1 `get_motion_recipe(name)` (one tool, small tested fragments)

- Input `name`: one of an index returned in `get_capabilities.recipes` (about 40–60 ids, ≈ 60 tokens), or `"index"`.
- Output: a **JSON fragment** that drops into a composition (a `scenes` block, a layer, an `fx`, a camera `kf` track) plus 2–3 lines of "when to use / what to change", and `fits`: the canvas ratios it was tested on.
- Families (source in brackets):
  - `transition-*` (the 9 types, with the typical `dur`/`dir`), [`render.ts` `drawTransition`]
  - `text-reveal-*`, `kinetic-*` (letters, words, type, stagger), [`schema.ts` text props, gallery]
  - `camera-*` (push-in, follow, shake), [`schema.ts`, templates with `camera`]
  - `ui-*` (11 kinds), `device-mockup`, `chart-*`, [`ui.ts`, `docs/results/UI1.json`]
  - `look-*` (13 looks as ≈ 150-token palettes with fonts and default motion), [`looks.ts`]
  - `audio-*` (music bed + SFX), [`audio.ts`, templates]
  - `loop-*`, `bg-*` (grain, grid, vignette, blobs), [`looks.ts` `LookDeco`]
- **Tested**: a recipe file is generated from a gallery template or a `docs/results` file by a script, then `npm test` runs every recipe through `validateJson` (no `UNKNOWN_*` warning, no errors) and, where possible, through the Studio's own `decodeHcmotion` (as done for the transition example in this PR with `tsx`).
- Cost: index ≈ 60 tokens inside `get_capabilities`; each call 150–600 tokens; a typical 15-second promo needs 3–5 calls ≈ 1–2 k tokens, versus 24.8 k for one `get_template`.
- Fixed cost of the tool itself: ≈ 120–180 tokens in `tools/list`, offset by G15 (≈ −1,000).

### 4.2 Alternative: `search_motion_knowledge(query)`

Free text instead of an id. More flexible but costs a second round trip and returns less predictable size. Use it **only if** ids prove too hard to discover; a closed index is cheaper and testable.

### 4.3 Self-review step (quality checklist)

A 10-line checklist (≈ 120 tokens), returned inside the `validate_json` result when `valid: true` and shown once: *canvas size confirmed; every scene has a focal layer; transitions vary and sit on every scene after the first; no hold longer than 3 s without motion; text contrast and safe area; one persistent element across scenes; audio present or intentionally absent; loop or end frame decided.* The model answers it in one line before calling `create_hcmotion`. The skill keeps no copy of it, so there is no always-loaded cost.

### 4.4 Skill after the change (target ≤ 2 k tokens body)

SKILL.md keeps: canvas-size question, the workflow, and *"call `get_capabilities`, then `get_motion_recipe` for each effect in your plan, then `validate_json`"*. References shrink to what is not data (HTML-scene rules, visual design principles). Everything that is a list of names or JSON moves into recipes, where it is tested.

### 4.5 Token budget summary

| Item | Today | Proposed |
| --- | --- | --- |
| Fixed: tool descriptions | 4,100 (list JSON) | ≈ 3,300 (after moving moderator tools out, + recipe tool) |
| Fixed: skill front matter | 68 | 52 (done) |
| `get_capabilities` result | 1,992 | ≈ 1,830 (done) + 60 index |
| Skill body + refs on trigger | 6,138 | ≈ 3,500 |
| Per recipe call | n/a | 150–600 |
| Reference template (`get_template`) | 6 k–72 k, median 24.8 k | unchanged, only for "follow template X" |

## 5. Why S1's text did not render (item d)

Artifacts: `/workspace/hcm-skilltest/sc1.hcmotion.json` (S1) and `sc2.hcmotion.json` (S2); montages `s1_montage.png`, `s2_montage.png`.
Observation: in every S1 frame the **native shapes render** while **all `html` layers (bases and text) are absent**; S2, built the same way, rendered its HTML.

**Ruled out from code and artifacts** (confirmed by inspection):
- Part-name mismatch between `data-hcm` pieces and `html` layers: 24 of 24 match.
- Text colour or contrast against the background, shapes covering the text by z-order, transitions, `normalizeDoc` loose attributes, scripts, missing w/h.

**Hypotheses** (none decisively confirmed; both need a browser run that was not done):
- **H1 (most likely, unverified): the capture was taken before the pieces finished rasterizing.**
  Mechanism in code: HTML is laid out inside one hidden iframe through a **serial queue** (`apps/studio/src/html/scene.ts:293-323` `withFrame`); each piece is rasterized through SVG `foreignObject` with **fonts and stylesheets fetched and inlined into every piece's SVG**; S1 inlined **443,152 bytes of CSS vs 100,696 for S2 (4.4×)** across 24 pieces and 5 docs. `prepareAll` has `PREPARE_LIMIT = 30_000` (`apps/studio/src/html/init.ts:13`): playback unlocks after 30 s **even if pieces are pending**, and `drawHtmlPiece` (`render.ts:967`) draws nothing when the raster is not ready. A screenshot at that moment shows shapes only.
- **H2 (unverified): a raster or placement failure specific to S1's documents.** `pieceBox` (`scene.ts:381`, used at `:485`, `:585`) can return `null` and `htmlPlacement`/`applyPlacement` (`scene.ts:750`, `795`; `init.ts:87`) draw nothing when w or h ≤ 0; if `rasterize` returns `null` it would be retried every frame.
- **Minor difference:** S1 uses a `zoom` fx (amount 1.2); probably irrelevant.

How to settle it (needs the Studio running): open `sc1.hcmotion`, wait more than 30 s, read `globalThis.__hcmHtml` (`htmlKeysOf`, raster state per piece). If pieces are ready after the wait, H1; if some stay `null`, H2.
Cheap mitigation regardless: a weight rule in `html-scenes.md` (few font families, no per-piece `<link>` stylesheets) and a loading indicator in Studio.

## 6. Roadmap, in priority order

1. **Merge this PR**: install guide, ZIP build, transitions contract, `start` guide, `commonProperties` dedupe (≈ −160 tokens per `get_capabilities` call).
2. **Fix the fixed cost (G15)**: move or collapse the four publishing tools (≈ −1,000 tokens in every conversation). Prerequisite for 3.
3. **`get_motion_recipe` + 12 first recipes** (3 transitions, 3 text, 2 camera, 3 ui, 1 audio), generated from gallery/`docs/results`, each tested with `validateJson` and Studio `decodeHcmotion`.
4. **Review checklist** in the `validate_json` result (G12) and `UNKNOWN_EASE` warning (G9).
5. **Looks as recipes** (G3), then audio (G6): stop stripping `audio` in `get_template` or make it opt-in.
6. **Studio side** (not done here): call `cleanTransition` when decoding `.hcmotion` (G13); settle S1 H1/H2 and, if H1, add a "preparing pieces" state and lighter font inlining.
7. Shrink the skill body to the router described in 4.4 once recipes carry the data.

## 7. What was verified and what was not

Verified by running code in this PR: `npm test` (103 tests); the transition example passes `validateJson` with no `UNKNOWN_*`/`TRANSITION_*` warning and is accepted by the **live** `validate_json`; the encoded `.hcmotion` round-trips through the Studio's own `decodeHcmotion` + `checkComposition` (no errors) and `transitionAt` returns the expected scene, type and progress at t = 2.0, 2.3, 4.0, 4.25 (run with `tsx` from a scratch folder; Studio not modified); the skill ZIP passes Python `zipfile.testzip()`, `unzip -t` and an independent reader in `tests/skill-zip.test.js`; `npx skills add … -a claude-code -g -y` installs to `~/.claude/skills/hypercodemotion`.
Not verified: that the claude.ai Skills upload accepts the ZIP on a Free account (the Help Center says Free is supported; I did not upload); the Claude Desktop UI; Claude Code itself loading the skill; that claude.ai drops `instructions` and defers connector tools (third-party issue reports); how the new transitions *look* in Studio (code-level acceptance only, no browser); H1 and H2 above.

## 8. Implementation status (branch `feat/motion-recipes`)

Closed with one tool, no new connector or endpoint, and no change to the four publishing tools:

| Gap | What shipped | Where |
| --- | --- | --- |
| G2 UI motion | Recipe `ui-mockup`: the 11 `ui` kinds with their props, the `forma` morph pattern, swap timings, cursor | `src/recipes.js` |
| G3 13 looks | `looks` (one table) and `look:<id>` ×13: palette, fonts, shape, motion, rule and a working layer set ported from Studio `lookSample` | `src/looks.js`, `src/recipes.js` |
| G4 Camera | Recipe `camera`: x/y/zoom/shake keyframes, depth parallax, `follow`/`fill`/`lag`, fixed HUD | `src/recipes.js` |
| G5 Text animation | Recipe `choreography`: `anim` chars/words/lines, `stagger`, `animEase`, `copies` repeaters, `hold` text swaps | `src/recipes.js` |
| G6 Audio | Recipe `audio`: real schema (profile, density, tracks, sfx, sound and synth ids, Tidal grammar), checked with Studio `normalizeAudio` (no warnings). `get_template` still strips `audio` (not changed here) | `src/recipes.js` |
| G9 Easings | `UNKNOWN_EASE` for keyframe `ease`, keyframe `spring` and `animEase`; 0 hits over the 39 gallery templates | `src/easing.js` |
| G10 Code layers | Recipe `code-texture`: scope, helpers and three deco snippets. `cursor` appears in `ui-mockup`; `particles`, `svg`, `component` are still names only | `src/recipes.js` |
| G12 Validator | `TEXT_OVERLAP`, `UNKNOWN_EASE`, `TEXT_FIT_UNEVALUATED`, kf-text fit fix, review `checklist` on valid compositions. Camera and audio shape checks remain unchecked | `src/textfit.js`, `src/contract.js` |
| Riso / overprint | Recipe `riso`: multiply inks, misregistration, halftone, stripes, fixed grain layer | `src/recipes.js` |
| Per-scene background | Recipe `scene-bg`: full-canvas rect per scene vs a fixed first layer | `src/recipes.js` |

Measured (tiktoken `cl100k_base`, an estimate: Claude's tokenizer counts somewhat higher): fixed load (tool descriptions and schemas + `initialize.instructions` + SKILL.md header) 3706 → 3844 tokens (+138, ceiling +150). Everything else is on demand: index 239; recipes 540-1240 each (`riso` is the largest because it carries two HTML documents); `looks` 836; `look:<id>` 640-950; checklist 173 on each valid result.
