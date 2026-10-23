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

## Tools

| Tool | What it does | Annotations |
| --- | --- | --- |
| `get_capabilities` | Lists the formats, layer types, layer properties and effect presets that Studio supports, how to reference files the user keeps in Studio (photos, logo, video clips) by id, the screen rule that decides type size, a runtime layer that keeps an existing Lottie, glTF or GSAP file and seeks it, and the Studio revision they come from. | read-only |
| `create_hcmotion` | Validates a finished composition and packages it as a `.hcmotion` file. Invalid input returns `created: false` with the errors to fix and stores nothing. Valid input returns `open` and `download` links (24 h). | write (creates a temporary file), not destructive |
| `get_template` | Returns the full design of a Studio gallery template by its id and format (brief, scenes, HTML scene documents and layers), to use as a design reference. | read-only |
| `validate_json` | Checks a composition, design or improvement patch and returns errors and warnings. Rejects measurable text that cannot fit the canvas and line-height below 1. It does not prove a correct render. | read-only |
| `get_recreation_brief` | Takes the link of a public motion video (prompt-motion.com or oneshotted.io) and a moderator code (only moderators make gallery templates), plus the video file, prompt, title and author that Claude reads on that page (the source sites often refuse servers), and returns its source details, its published prompt when available, the brief to recreate it as a gallery template and reference frames of the original video (extracted once per video; the first call may answer that they are being prepared). prompt-motion.com refuses every server, so for its videos the brief returns a short script that Claude runs in its own code tool (or the same steps in a browser tool) to download the video and send it here in parts. | write (starts the frame extraction), not destructive |
| `propose_template` | Submits the recreation (three compositions and the gallery card), with the moderator code. Checks the source, the compositions and the card; when accepted, renders the composition in the original's format with the Studio engine and compares it with the original frame by frame. Send fixes with the same code (up to 3 comparisons). Returns a tracking code. | write, not destructive |
| `get_proposal_status` | Returns the status of a proposal by its tracking code: comparing, review (with the comparison sheet: original and recreation side by side), rendering, published (with its gallery id, branch and commit), failed (with the reason) or retired. | read-only |
| `publish_template` | Publishes a compared proposal as an official Studio template, with the moderator code and notes on what is consciously different from the original: the Studio workflow renders its gallery media and commits it to the Studio code (`TEMPLATE_BRANCH`). | write, not destructive |

The recreation itself happens in the user's own Claude conversation; the connector gives the brief and the reference frames, and returns the comparison with the original. It does **not** render video for users, generate images, audio or video with AI models, or access anything outside the request it receives.

## Data and privacy

- `get_capabilities`, `get_template`, `validate_json` and `get_proposal_status` store nothing.
- `get_recreation_brief` stores reference frames of the public source video in the private store (never published), so the recreation can be compared with it.
- `propose_template` stores the proposal, its card and its source link (no personal data) until a moderator publishes it, which commits it to the Studio code. A salted hash of the moderator's name is kept for one day to limit proposals to 20 a day per moderator.
- `create_hcmotion` stores the generated file in a private Vercel Blob store. Anyone with the link can download it until it expires after 24 hours; a daily job deletes expired files (at most about 48 hours after creation).
- No accounts, cookies, tracking or AI training on your content.

## Gallery templates (setup)

A moderator sends Claude the link of a prompt-motion.com or oneshotted.io video and their moderator code; that is enough for Claude to recreate it, compare it and publish it. The Studio repository's `community-render` workflow extracts the reference frames, renders the comparisons (sheet and `comparacion.mp4`, readable by a moderator at `GET /api/community?op=compare&id=c-…&file=comparacion.mp4` with their code as bearer) and, on publication (`kind: official`), renders the gallery media and commits the template to `apps/studio/public` on `TEMPLATE_BRANCH` (default `template`): `plantillas/<slug>-<variant>.json`, `bienvenida/ejemplos/<slug>-<ratio>.{mp4,jpg}` and its card in the gallery. Environment variables in this Vercel project: `GITHUB_DISPATCH_TOKEN` (fine-grained token with *Contents: read and write* on `jasp402/HyperCodeMotion`, used only to start that workflow), `COMMUNITY_RENDER_SECRET` (shared with the workflow), `TEMPLATE_ADMIN_CODES` or `COMMUNITY_ADMIN_SECRET` (moderator codes: one code, or `name:code, name:code`; codes shorter than 6 characters are ignored) and optionally `TEMPLATE_BRANCH`.

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
```

GitHub Actions runs both. Neither guarantees full Studio rendering compatibility.

### Capabilities snapshot

The catalog is derived from Studio source files (`packages/core/src/schema.ts`, `packages/core/src/presets.ts`) and must be reviewed when Studio changes.

### HyperCodeMotion Creative Skill

The repository also contains the [HyperCodeMotion Agent Skill](skills/hypercodemotion/SKILL.md), which guides AI assistants from brief to art direction, scenes, editable JSON and the `.hcmotion` handoff. It is distributed separately from the connector and does not activate just because the connector is connected.

## License

Source code: [Apache License 2.0](LICENSE). The hosted service is subject to the [Terms of Service](TERMS.md). HyperCodeMotion names and logos are not licensed by the software license.
