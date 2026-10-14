# HyperCodeMotion MCP

**Open-source, read-only Model Context Protocol server** for [HyperCodeMotion](https://hypercodemotion.com).

- **MCP endpoint:** https://mcp.hypercodemotion.com/mcp
- **Current tools:** `get_capabilities`, `validate_json`
- **Formats recognized:** composition (`layers`), design (`elements`), improvement patch (`add`, `change`, `remove`, `sfx`)
- **Deployment:** GitHub main → Vercel; production smoke checks run in GitHub Actions

## What it does and does not do

The current service checks JSON structure and compares layer properties/effect IDs to a **source-pinned snapshot** of HyperCodeMotion Studio's supported features. Validation is preliminary and results explicitly indicate `fullyValidated: false`.

The current service **does not** create or persist projects, modify Studio, export video, render animations, or guarantee that a passing JSON will work visually in Studio. Proposed future tools are not yet available.

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
| `validate_json` | Structural check of a JSON object or JSON string, with warnings/errors; optionally supply the existing composition for improvement patches |

## Testing

```bash
npm test
npm run test:live
```

GitHub Actions runs unit tests and a separate production smoke test. Neither the unit tests nor the smoke test guarantee full Studio rendering compatibility.

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
