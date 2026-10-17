# HyperCodeMotion MCP

**Open-source Model Context Protocol server** for [HyperCodeMotion](https://hypercodemotion.com).

- **MCP endpoint:** https://mcp.hypercodemotion.com/mcp
- **Current tools:** `get_capabilities`, `create_hcmotion`, `validate_json`
- **Formats recognized:** composition (`layers`), design (`elements`), improvement patch (`add`, `change`, `remove`, `sfx`)
- **Deployment:** GitHub main → Vercel; production smoke checks run in GitHub Actions

## What it does and does not do

The current service checks JSON structure and compares layer properties/effect IDs to a **source-pinned snapshot** of HyperCodeMotion Studio's supported features. Validation is preliminary and results explicitly indicate `fullyValidated: false`.

`create_hcmotion` is the required last step of every animation: it validates the composition and turns it into a `.hcmotion` project file, the only format HyperCodeMotion Studio opens. The file is kept for **24 hours** in a private Vercel Blob store and served at `https://mcp.hypercodemotion.com/d/<id>/<name>.hcmotion`; after that the link returns 410 and a daily cron deletes it.

The service does **not** keep projects beyond that window, modify Studio, export video, render animations, or guarantee that a passing JSON will work visually in Studio.

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

### Deployment settings

- A **private Blob store** connected to the Vercel project. It authenticates through OIDC (`BLOB_STORE_ID` + the project's OIDC token); a `BLOB_READ_WRITE_TOKEN` also works.
- `CRON_SECRET` so only Vercel Cron can call `/api/cleanup`.
- Optional `PUBLIC_URL` / `STUDIO_URL` (default `https://mcp.hypercodemotion.com` / `https://app.hypercodemotion.com`).

## Connect

Configure a compatible MCP client with the remote endpoint:

```text
https://mcp.hypercodemotion.com/mcp
```

The server responds to HTTP POST JSON-RPC messages; browsing to the URL with GET returns `{"error":"POST required"}`, which is expected.

## Available tools

| Name | What it provides |
| --- | --- |
| `get_capabilities` | Snapshot of supported layer types, properties, effect preset slots and source identifiers |
| `create_hcmotion` | Validates a full composition and returns `open` (opens it in Studio) and `download` links to the `.hcmotion` file, valid 24 hours. If `created` is false, `errors` says what to fix |
| `validate_json` | Structural check of a JSON object or JSON string, with warnings/errors; optionally supply the existing composition for improvement patches |

## Testing

```bash
npm test
npm run test:live
```

GitHub Actions runs unit tests and a separate production smoke test. Neither the unit tests nor the smoke test guarantee full Studio rendering compatibility.

## HyperCodeMotion Creative Skill

The repository also contains the [HyperCodeMotion Agent Skill](skills/hypercodemotion/SKILL.md). It guides AI assistants through **brief → visual references → art direction → scenes → editable JSON → MCP validation → Studio import**. Specialized references explain composition formats, motion, visual design, HTML scene assets and validation. A sample JSON and automated checks are included.

The Skill is available as repository files; publication to external Skill catalogs and installation in individual AI clients are separate future steps. It does not automatically activate merely because the MCP is connected.

## Privacy, Terms & Support

The following apply **only to this MCP service**, not HyperCodeMotion Studio:

- [Privacy Policy](PRIVACY.md)
- [Terms of Service](TERMS.md)
- [Support](SUPPORT.md)

Support: [GitHub Issues](https://github.com/jasp402/HyperCodeMotion-MCP/issues). Issues are public; never share sensitive project data or access tokens.

## Source and license

The catalog snapshot was derived from Studio source files including `packages/core/src/schema.ts` and `packages/core/src/presets.ts`. The MCP repository does not modify Studio. Snapshot updates must be reviewed when Studio changes.

Source code is available under [Apache License 2.0](LICENSE). The hosted MCP service is separately subject to the [Terms of Service](TERMS.md).

## Roadmap (not yet implemented)

- Verify full import/merge compatibility using the Studio rules, rather than structural checks alone.
- Improve validation and developer documentation.
- Implement authenticated project operations if the product requires them.
- Prepare for applicable public MCP/plugin directory review.
