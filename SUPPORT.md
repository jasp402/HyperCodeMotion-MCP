# HyperCodeMotion MCP — Support

This support page applies only to the **HyperCodeMotion MCP integration**, not to the Studio editor.

## Official resources
- **MCP server endpoint:** https://mcp.hypercodemotion.com/mcp
- **Source, releases, and documentation:** https://github.com/jasp402/HyperCodeMotion-MCP
- **Support email:** [jasp402@gmail.com](mailto:jasp402@gmail.com) (also [hypercodemotion@gmail.com](mailto:hypercodemotion@gmail.com))
- **Bug reports:** https://github.com/jasp402/HyperCodeMotion-MCP/issues
- **Privacy Policy:** [PRIVACY.md](PRIVACY.md)
- **Terms of Service:** [TERMS.md](TERMS.md)

## Available tools
- `get_capabilities` — read the supported layer/property/preset snapshot
- `create_hcmotion` — validate a finished composition and return `open` and `download` links to its `.hcmotion` file (valid 24 hours)
- `validate_json` — preliminary structural checks for compositions, designs, and improvement patches

## Common problems
- **Claude says the connector is not connected:** add `https://mcp.hypercodemotion.com/mcp` as a custom connector (Settings → Connectors → Add custom connector) and turn it on in the chat.
- **The link says it expired (410):** links last 24 hours. Ask Claude to call `create_hcmotion` again, or open the project you saved from Studio.
- **`created: false`:** the response lists each problem with its JSON path. Claude can fix them and call the tool again.
- **Opening the endpoint in a browser shows "POST required":** expected; it is an MCP endpoint, not a web page.

**Important:** a passing validation does not guarantee rendering compatibility. The current MCP returns `fullyValidated: false`.

## Before reporting a problem
1. Identify the tool and the approximate time the problem occurred.
2. Include the MCP response or error, removing secrets and personal data.
3. State whether the issue occurred when connecting an AI client, listing tools, validating JSON, creating a `.hcmotion` file, or opening a link.
4. If necessary, provide a **minimal, sanitized** example that reproduces the problem.

## Requesting help
Open a [GitHub Issue](https://github.com/jasp402/HyperCodeMotion-MCP/issues/new). Issues are public: **do not post passwords, access tokens, confidential JSON, customer information, or private personal details**. For privacy-related or private inquiries, email [jasp402@gmail.com](mailto:jasp402@gmail.com) (also [hypercodemotion@gmail.com](mailto:hypercodemotion@gmail.com)).

## Expectations
Support is community-maintained. No guaranteed response or resolution time is offered. For service downtime, also check the [GitHub Actions history](https://github.com/jasp402/HyperCodeMotion-MCP/actions).
