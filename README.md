# HyperCodeMotion MCP

Public Model Context Protocol (MCP) integration for [HyperCodeMotion](https://hypercodemotion.com).

**Status:** Initial architecture / implementation pending. No public MCP endpoint or JSON validation service is available yet.

## Goal

Provide an open, independently deployed MCP server so compatible AI clients can discover HyperCodeMotion capabilities, create editable motion projects, and validate compositions **against the same rules used by HyperCodeMotion Studio**.

## Planned tools

| Tool | Purpose |
| --- | --- |
| `get_capabilities` | Read supported layer types, properties, FX presets and schema version |
| `validate_composition` | Preflight composition (`layers`), design (`elements`), or improvement (`add/change/remove/sfx`) JSON; return errors and warnings |
| `create_project` | Create a new editable project (later stage) |
| `apply_ops` | Modify layers, keyframes and scenes through patches (later stage) |
| `get_project` | Get an existing project summary (later stage) |

The current implementation is **structural preflight only**, not an MCP endpoint or a guarantee of Studio acceptance. `validateComposition(input, { composition? })` returns `format`, `valid`, `fullyValidated: false`, `errors`, and `warnings`. Pass the original project to check improvement references and duration. Full validation must call the exact Studio normalization/merge path before returning `fullyValidated: true`.

## Source of truth

The Studio source currently defines:
- `packages/core/src/types.ts` — composition and layer types.
- `packages/core/src/schema.ts` — layer property schema.
- `packages/core/src/prompt.ts` — `importAny()` normalization (accepts `layers` compositions and `elements` designs).
- `packages/core/src/improve.ts` — `applyImprovement()` for `add`, `change`, `remove`, `sfx` against an existing composition.

The MCP **must not duplicate or improvise** a separately maintained validation schema. The integration will use a **version-pinned, independently distributable contract/validator package**, or a generated schema artifact plus shared validation logic, subject to checking how the existing private core can be packaged safely. A normalized output is not automatically proof that the input was valid; strict validation must flag coercions, discarded fields and broken references.

## Security and deployment principles

- Separate GitHub repository and Vercel project from Studio.
- Proposed endpoint: `https://mcp.hypercodemotion.com/mcp` (**not yet deployed**).
- Read-only validation can be public, with input size and rate limits. Mutating operations require authentication and authorization.
- Never load or execute arbitrary user-provided JS from `code`, `component`, `html` or expressions as part of JSON structural validation.
- Fail closed if the correct contract version is unavailable.
- No API keys, tokens or private source code committed to this repository.

## Roadmap

1. Verify and formalize the Studio contract/validator sharing boundary.
2. Implement strict validation and tests with valid/invalid Studio fixtures.
3. Expose MCP tools via Streamable HTTP.
4. Deploy independently to Vercel; configure DNS and access protection.
5. Publish client setup instructions and register in MCP directories.

## License

Apache-2.0. See [LICENSE](LICENSE).
