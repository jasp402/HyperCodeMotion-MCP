# HyperCodeMotion MCP

Connect Claude to [HyperCodeMotion](https://hypercodemotion.com), an editor for data-driven motion graphics. Claude designs the animation; this connector checks it and turns it into a `.hcmotion` project you open in HyperCodeMotion Studio, where you change texts, colors, timing and order yourself instead of asking the AI to regenerate everything.

- **MCP endpoint:** `https://mcp.hypercodemotion.com/mcp` (remote, streamable HTTP)
- **Authentication:** none. The service has no accounts and reads no data from your Claude account.
- **Studio:** [app.hypercodemotion.com](https://app.hypercodemotion.com)

## Use it in Claude

1. In Claude, open **Settings → Connectors** and choose **Add custom connector**.
2. Name it `HyperCodeMotion` and paste `https://mcp.hypercodemotion.com/mcp`.
3. In a chat, turn the connector on from the tools menu.
4. Ask for an animation, or paste a prompt copied from HyperCodeMotion Studio («Crear con IA» → «Generar prompt»).
5. Claude replies with two links:
   - **Open**: opens the project directly in HyperCodeMotion Studio.
   - **Download**: the `.hcmotion` file, which you can also open from the Studio home screen («Cargar proyecto»).

Both links expire **24 hours** after they are created. Save the project from Studio (Archivo → Guardar proyecto) to keep it.

### Example prompts

- *“Create a 15-second vertical launch video for Nimbus, a note-taking app with AI, and give me the HyperCodeMotion project.”*
- *“Make a 10-second explainer with three steps for brewing pour-over coffee, 16:9, and package it for HyperCodeMotion.”*
- *“Which layer types and effects does HyperCodeMotion support?”*

## Install the skill (recommended)

The connector only checks and packages a project. The **HyperCodeMotion skill** is what makes Claude ask for the canvas size, plan scenes and transitions, and follow the design guidance (typography, HTML scenes, motion, validation). A skill is a separate install: connecting the connector does **not** add it, and the connector cannot install it for you. Install both.

Download: [`hypercodemotion-skill.zip`](https://github.com/jasp402/HyperCodeMotion-MCP/releases/download/skill-latest/hypercodemotion-skill.zip) (a rolling release, rebuilt from `main` by `.github/workflows/release-skill.yml`; its `SHA256SUMS` is next to it), or build it yourself from this repository (see [Build the ZIP](#build-the-zip)).

### claude.ai (web) and Claude Desktop

1. Turn on **Code execution and file creation** in **Settings → Capabilities** (skills need it; the setting is called *Create and edit files* in the newer layout).
2. Open **Customize → Skills**, click **+**, then **+ Create skill**, then **Upload a skill**.
3. Choose `hypercodemotion-skill.zip`. The skill appears in the list; make sure its toggle is on.
4. In a new chat, turn on the HyperCodeMotion connector as well and ask for a video. Claude should ask for the canvas size first (1080×1920, 1080×1080, 1080×1350, 1920×1080 or custom).

Requirements Anthropic documents for the ZIP: the skill folder is the ZIP root (`hypercodemotion/SKILL.md`, not loose files), the folder name equals the skill `name`, `description` is at most 200 characters. `npm run build:skill` checks all three.

Free accounts: Anthropic's Help Center (*Use skills in Claude* and *How to create custom skills*, read on 2026-10-24) states that skills are available on Free, Pro, Max, Team and Enterprise plans, and that on Free, Pro and Max you upload your own in Customize → Skills. On Team and Enterprise an owner can disable user-created skills. Other Anthropic pages have worded the plan list differently over time; if **Customize → Skills** is missing or greyed out, code execution is off (or your organization turned skills off), which is the case the Help Center describes. We have not tried an upload on a Free account ourselves. A skill uploaded on claude.ai does not appear in the API; each surface keeps its own skills.

Claude Desktop uses the same Claude account and the same **Customize → Skills** screen as claude.ai. Anthropic's article does not describe a Desktop-specific route and we did not click through the Desktop UI, so treat the steps above as the expected route there.

### Claude Code

Any of these puts the skill folder in `~/.claude/skills/hypercodemotion/SKILL.md`:

- **One command** (verified: installs to `~/.claude/skills/hypercodemotion`; needs Node 22.20 or newer):

  ```bash
  npx skills add jasp402/HyperCodeMotion-MCP --skill hypercodemotion -a claude-code -g -y
  ```

- **By hand** (clone or download this repository):

  ```bash
  mkdir -p ~/.claude/skills
  cp -r skills/hypercodemotion ~/.claude/skills/
  ```

  Use `.claude/skills/` inside a project to install it for that project only.

- **Through your account:** Claude Code v2.1.273 or newer syncs the skills you enabled on claude.ai when you sign in with that same account (not with an API key). Run `/skills` to see them under *claude.ai sync*.

Then add the connector: `claude mcp add --transport http hypercodemotion https://mcp.hypercodemotion.com/mcp`.

Restart the session and run `/skills` to confirm `hypercodemotion` is listed. We did not run Claude Code itself for this document: the install paths above were checked on disk and against Anthropic's documentation. We do not ship a Claude Code plugin or marketplace manifest.

### Build the ZIP

```bash
npm run build:skill        # writes dist/hypercodemotion-skill.zip (Node only, no zip binary needed)
```

The script packs `skills/hypercodemotion` with the folder as ZIP root, in a reproducible order, and fails if `SKILL.md` would be rejected (name not equal to the folder name, description over 200 characters). `npm test` rebuilds the archive and reads it back with an independent ZIP reader (every file, size and CRC-32).

### What you lose with the connector alone

With only the connector, Claude still validates and packages projects, but the guidance that lives in the skill is missing: no canvas-size question (it may pick a format for you), no art-direction, typography or HTML-scene guidance, no motion and transition vocabulary beyond what `get_capabilities` returns, and no checklist before delivery.

To keep that loss small, `get_capabilities` returns a short `start` guide (ask the canvas size, one scene per beat joined with transitions, deliver only the links) and the transition contract (`transitions`). Claude calls it before designing, and its result is text Claude always receives. We did **not** rely on the server `instructions` string returned by `initialize`: per community reports in [anthropics/claude-ai-mcp#93](https://github.com/anthropics/claude-ai-mcp/issues/93) claude.ai does not pass it to the model (Claude Code does), and in [#1105](https://github.com/anthropics/claude-ai-mcp/issues/1105) a reporter saw custom-connector tools reach the model as bare names until a tool search. These are third-party reports, not Anthropic documentation, and we have not reproduced them ourselves.

Bigger options, not implemented (each adds always-loaded tokens or needs a decision): a `get_guide(topic)` tool that returns the skill's reference pages on demand, an MCP *prompt* the user picks from the menu, or MCP *resources* for the references. See [docs/CAPABILITY-GAP-AUDIT.md](docs/CAPABILITY-GAP-AUDIT.md).

## Tools

| Tool | What it does | Annotations |
| --- | --- | --- |
| `get_capabilities` | Lists the formats, layer types, layer properties and effect presets that Studio supports, how to reference files the user keeps in Studio (photos, logo, video clips) by id, the screen rule that decides type size, a runtime layer that keeps an existing Lottie, glTF or GSAP file and seeks it, the scene transitions (`transitions`: types, `dur`, `dir`, `ease`), a short start guide (`start`), the names code layers and components must not redeclare (`reservedCodeNames`) and the Studio revision they come from. | read-only |
| `get_motion_recipe` | On demand: real, validated JSON/HTML/CSS patterns for looks the basics do not give. Without `name` it returns the index; with one, a recipe: `riso` (print, overprint, grain), `choreography` (keyframes, springs, easings), `audio`, `camera`, `code-texture`, `ui-mockup` (the 11 `ui` kinds), `scene-bg` (a background per scene), `looks` (the 13 looks in one table) and `look:<id>` (one look in full). Plain text result; it stores nothing. | read-only |
| `create_hcmotion` | Validates a finished composition and packages it as a `.hcmotion` file. Invalid input returns `created: false` with the errors to fix and stores nothing. Valid input returns `open` and `download` links (24 h). | write (creates a temporary file), not destructive |
| `get_template` | Returns the full design of a Studio gallery template by its id and format (brief, scenes, HTML scene documents and layers), to use as a design reference. | read-only |
| `validate_json` | Checks a composition, design or improvement patch and returns errors and warnings. Rejects measurable text that cannot fit the canvas and line-height below 1. Warns (`RESERVED_NAME_DECLARED`) when a code layer or component declares a name the engine already provides (`S`, `H`, `ctx`, `t`, `w`, `h`, helpers such as `range`). It does not prove a correct render. | read-only |
| `get_recreation_brief` | Takes the link of a public motion video (prompt-motion.com or oneshotted.io) and a moderator code (only moderators make gallery templates), plus the video file, prompt, title and author that Claude reads on that page (the source sites often refuse servers), and returns its source details, its published prompt when available, the brief to recreate it as a gallery template and reference frames of the original video (extracted once per video; the first call may answer that they are being prepared). prompt-motion.com refuses every server, so for its videos the brief returns a short script that Claude runs in its own code tool (or the same steps in a browser tool) to download the video and send it here in parts. | write (starts the frame extraction), not destructive |
| `propose_template` | Submits the recreation (three compositions and the gallery card), with the moderator code. Checks the source, the compositions and the card; when accepted, renders the composition in the original's format with the Studio engine and compares it with the original frame by frame. Send fixes with the same code (up to 3 comparisons). Returns a tracking code. | write, not destructive |
| `get_proposal_status` | Returns the status of a proposal by its tracking code: comparing, review (with the comparison sheet: original and recreation side by side), rendering, published (with its gallery id, branch and commit), failed (with the reason) or retired. | read-only |
| `publish_template` | Publishes a compared proposal as an official Studio template, with the moderator code and notes on what is consciously different from the original: the Studio workflow renders its gallery media and commits it to the Studio code (`TEMPLATE_BRANCH`). | write, not destructive |

The recreation itself happens in the user's own Claude conversation; the connector gives the brief and the reference frames, and returns the comparison with the original. It does **not** render video for users, generate images, audio or video with AI models, or access anything outside the request it receives.

## Data and privacy

- `get_capabilities`, `get_motion_recipe`, `get_template`, `validate_json` and `get_proposal_status` store nothing.
- `get_recreation_brief` stores reference frames of the public source video in the private store (never published), so the recreation can be compared with it.
- `propose_template` stores the proposal, its card and its source link (no personal data) until a moderator publishes it, which commits it to the Studio code. A salted hash of the moderator's name is kept for one day to limit proposals to 20 a day per moderator.
- `create_hcmotion` stores the generated file in a private Vercel Blob store. Anyone with the link can download it until it expires after 24 hours; a daily job deletes expired files (at most about 48 hours after creation).
- No accounts, cookies, tracking or AI training on your content.

## Gallery templates (setup)

A moderator sends Claude the link of a prompt-motion.com or oneshotted.io video and their moderator code; that is enough for Claude to recreate it, compare it and publish it. The Studio repository's `community-render` workflow extracts the reference frames, renders the comparisons (sheet and `comparacion.mp4`, readable by a moderator at `GET /api/community?op=compare&id=c-…&file=comparacion.mp4` with their code as bearer) and, on publication (`kind: official`), renders the gallery media, commits the template to `apps/studio/public` on its own branch `plantilla/<slug>` and opens a pull request against `TEMPLATE_BRANCH` (default `template`), so each template has its own preview to approve or discard: `plantillas/<slug>-<variant>.json`, `bienvenida/ejemplos/<slug>-<ratio>.{mp4,jpg}` and its card in the gallery. Environment variables in this Vercel project: `GITHUB_DISPATCH_TOKEN` (fine-grained token with *Contents: read and write* on `jasp402/HyperCodeMotion`, used only to start that workflow), no shared secret with the workflow: its callbacks carry GitHub's OIDC token (audience `hypercodemotion-mcp`, repository `RENDER_REPO`, default `jasp402/HyperCodeMotion`), checked here against GitHub's keys (`COMMUNITY_RENDER_SECRET` is still accepted while set), `TEMPLATE_ADMIN_CODES` or `COMMUNITY_ADMIN_SECRET` (moderator codes: one code, or `name:code, name:code`; codes shorter than 6 characters are ignored) and optionally `TEMPLATE_BRANCH`.

Full details: [Privacy Policy](PRIVACY.md) · [Terms of Service](TERMS.md) · [Support](SUPPORT.md)

## Support

Email [jasp402@gmail.com](mailto:jasp402@gmail.com) (also [hypercodemotion@gmail.com](mailto:hypercodemotion@gmail.com)) or open a [GitHub issue](https://github.com/jasp402/HyperCodeMotion-MCP/issues). Issues are public: never post passwords, tokens or confidential project content.

## For developers

### Protocol

The server speaks JSON-RPC 2.0 over HTTP POST (`initialize`, `ping`, `tools/list`, `tools/call`). A GET on the endpoint returns 405 with a short explanation, which is expected. Request bodies are limited to 4 MB.

### `.hcmotion` layout

| Offset | Size | Content |
| --- | --- | --- |
| 0 | 3 | `HCM` (ASCII) |
| 3 | 1 | format version (1) |
| 4 | 1 | flags (bit 0: gzip) |
| 5 | 3 | reserved (0) |
| 8 | 4 | JSON size, uncompressed (u32 LE) |
| 12 | 4 | data size (u32 LE) |
| 16 | 32 | SHA-256 of the data |
| 48 | n | composition JSON, gzip |

It is not encrypted: the SHA-256 only detects truncated or edited files. Studio implements the same layout in `packages/core/src/hcmotion.ts`.

Files are served at `https://mcp.hypercodemotion.com/d/<id>` and open in Studio at `https://app.hypercodemotion.com/?p=<id>`. After 24 hours the link returns 410.

### Deployment settings

- A **private Blob store** connected to the Vercel project. It authenticates through OIDC (`BLOB_STORE_ID` + the project's OIDC token); a `BLOB_READ_WRITE_TOKEN` also works.
- `CRON_SECRET` so only Vercel Cron can call `/api/cleanup`.
- Optional `PUBLIC_URL` / `STUDIO_URL` (default `https://mcp.hypercodemotion.com` / `https://app.hypercodemotion.com`).

### Testing

```bash
npm test          # unit and integration tests
npm run test:live # smoke test against production
npm run build:skill # builds dist/hypercodemotion-skill.zip
```

GitHub Actions runs both. Neither guarantees full Studio rendering compatibility.

### Motion recipes and self-review

`src/recipes.js` builds every recipe from a composition fragment (`layers`, `docs`, `scenes`, `audio`); the text a model reads is generated from that same fragment, and `tests/recipes.test.js` runs each one through `validateJson` and `checkComposition` (no error and no warning other than `CONTRACT_NOT_CHECKED`). `src/looks.js` holds the 13 looks and their deco code, copied from Studio `packages/core/src/looks.ts` (contract `c75a0b3`); refresh it when the Studio looks change. Nothing in a recipe is part of the fixed tool/instruction load: only its on-demand result.

`validate_json` (and `create_hcmotion` when it creates the file) returns a short `checklist` for compositions that are valid; it is never sent next to errors. New warnings: `TEXT_OVERLAP` (two different static texts on the same spot at the same time; echoes, rotated or animated blocks are exempt), `UNKNOWN_EASE` (keyframe `ease`, keyframe `spring` mode and `animEase` names Studio would silently replace) and `TEXT_FIT_UNEVALUATED` (text that is an expression). Keyframed `text` is now measured on every value instead of its default (the old `TEXT_DOES_NOT_FIT` false positive).

### Capabilities snapshot

The catalog is derived from Studio source files (`packages/core/src/schema.ts`, `packages/core/src/presets.ts`) and must be reviewed when Studio changes.

### HyperCodeMotion Creative Skill

The repository also contains the [HyperCodeMotion Agent Skill](skills/hypercodemotion/SKILL.md), which guides AI assistants from brief to art direction, scenes, editable JSON and the `.hcmotion` handoff. It is distributed separately from the connector and does not activate just because the connector is connected: see [Install the skill](#install-the-skill-recommended). `validate_json` also warns about reserved names declared in code layers (`RESERVED_NAME_DECLARED`: top-level `const`, `let`, `var`, `function`, `class`, `catch` or destructuring of `S`, `H`, `ctx`, the scope variables or a helper; Studio tolerates it, but the original name is hidden) and about scene and transition mistakes (`SCENE*` and `TRANSITION_*` codes: unknown type, first scene, missing `dur`, overlap).

## License

Source code: [Apache License 2.0](LICENSE). The hosted service is subject to the [Terms of Service](TERMS.md). HyperCodeMotion names and logos are not licensed by the software license.
