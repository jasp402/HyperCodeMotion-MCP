# HyperCodeMotion MCP — Privacy Policy

**Effective date:** October 17, 2026 (first version: October 13, 2026)  
**Scope:** The public HyperCodeMotion MCP service at [mcp.hypercodemotion.com](https://mcp.hypercodemotion.com/mcp), not HyperCodeMotion Studio.

## 1. Service and operator
HyperCodeMotion MCP is a public Model Context Protocol (MCP) service maintained through the [HyperCodeMotion-MCP GitHub repository](https://github.com/jasp402/HyperCodeMotion-MCP). Privacy inquiries may be submitted through [GitHub Issues](https://github.com/jasp402/HyperCodeMotion-MCP/issues). Do not include secrets or personal data in public issues.

## Summary
- **What we collect:** only what your AI client sends to a tool (animation JSON) and standard request metadata handled by our host.
- **What we store:** nothing for `get_capabilities` and `validate_json`; for `create_hcmotion`, the generated `.hcmotion` file, for at most about 48 hours.
- **Who we share it with:** our hosting provider (Vercel) only. No sale, advertising, tracking cookies, or AI training.
- **Accounts:** none. The service never reads your Claude account, chat history, memory, or files.
- **Contact:** [GitHub Issues](https://github.com/jasp402/HyperCodeMotion-MCP/issues).

## 2. Information processed
When your MCP client calls the service, it may send JSON compositions, designs, improvement patches, and optional existing-project context. The service receives only the arguments of the tool being called; it does not request or receive your conversation, chat history, memory, or files. The service processes those inputs to return compatibility information, errors, warnings, and supported capabilities. **Submitted JSON may include text or other personal information you choose to include.** Avoid sending sensitive information.

Like other web services, network and infrastructure providers may process technical request data, such as IP addresses, timestamps, request URLs, browser/client identifiers, HTTP status codes, and request IDs.

## 3. Storage and retention
`get_capabilities` and `validate_json` do not persist submitted JSON: they process the request and return results during the same request.

`create_hcmotion` stores the generated `.hcmotion` file (the submitted composition, compressed) in a private Vercel Blob store so it can be downloaded. Anyone with the link can download it while it is valid. Links expire **24 hours** after creation, and a daily job deletes expired files, so a file may remain stored for up to about 48 hours before deletion. The service creates no user accounts.

The service runs on Vercel. Vercel may generate and retain infrastructure, security, deployment, and runtime logs under its own platform policies and the account configuration. We do **not** claim that Vercel stores no request metadata or that infrastructure logs have zero retention. Exact infrastructure retention can vary with plan, product, and configuration. Please consult [Vercel's Privacy Policy](https://vercel.com/legal/privacy-policy) and [Vercel's documentation](https://vercel.com/docs/observability).

The MCP application does not intentionally log full submitted JSON bodies in its current request handler. Future changes to storage or logging practices will require an update to this policy.

**Effective changes, October 17, 2026:** added temporary file storage for `create_hcmotion`.

## 4. Use of information
Inputs are used to respond to the requested MCP tools, diagnose operational issues where supported by infrastructure logs, and protect the service from abuse.

The current application does not intentionally use submitted JSON to train an AI model. Your chosen AI client/provider may separately process information that you share with it under its own terms and privacy policy.

## 5. Sharing and providers
Requests are processed through the infrastructure provider Vercel. Information supplied to third-party AI assistants is also subject to the assistant provider's policies. We do not intentionally sell submitted project content or share it with advertisers.

## 6. Security
The service is served over HTTPS. Download links use unguessable identifiers, but anyone holding a link can download the file until it expires; public use does not guarantee confidentiality or complete security. Avoid including credentials, confidential customer material, or other sensitive content in submissions.

## 7. Your choices and requests
You can stop using the MCP at any time. Since the service has no accounts, there is no account-level deletion feature; generated files are deleted automatically after they expire. For inquiries about identifiable information that may appear in infrastructure records, open a [privacy inquiry](https://github.com/jasp402/HyperCodeMotion-MCP/issues), without posting sensitive information publicly; request an appropriate private follow-up channel.

## 8. International use
Processing may occur in locations used by Vercel and your selected AI client. Legal rights depend on your jurisdiction. We will review applicable access, correction, or deletion requests where we can identify and control relevant data.

## 9. Changes
We may update this policy as the service changes. Revisions will be published in this repository with their effective date.

## 10. Contact
[HyperCodeMotion-MCP — GitHub Issues](https://github.com/jasp402/HyperCodeMotion-MCP/issues).
