/**
 * Waits until the production MCP endpoint serves the same tool metadata
 * (names, annotations, outputSchema) as the api/mcp.js in this checkout.
 * Smithery scans the live endpoint, so publishing before that is pointless.
 * The expected tools come from the source, so adding a tool needs no edit here.
 * Run: MCP_URL=https://mcp.hypercodemotion.com/mcp node scripts/verify-production-metadata.mjs
 */
import handler from "../api/mcp.js";
const url = process.env.MCP_URL || "https://mcp.hypercodemotion.com/mcp";
const attempts = Number(process.env.VERIFY_ATTEMPTS || 12);
const delayMs = Number(process.env.VERIFY_DELAY_MS || 15000);
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

async function localTools() {
  let body;
  const res = { setHeader() {}, end(x) { body = x; } };
  await handler({ method: "POST", headers: {}, body: { jsonrpc: "2.0", id: 1, method: "tools/list" } }, res);
  return JSON.parse(body).result.tools;
}

function problems(expected, live) {
  const out = [];
  const byName = new Map(live.map(t => [t.name, t]));
  for (const t of expected) {
    const p = byName.get(t.name);
    if (!p) { out.push(`tool "${t.name}" is missing in production`); continue; }
    if (!p.annotations) out.push(`tool "${t.name}" has no annotations in production`);
    else if (!same(p.annotations, t.annotations)) out.push(`tool "${t.name}" annotations differ from the repo`);
    if (t.outputSchema && !p.outputSchema) out.push(`tool "${t.name}" has no outputSchema in production`);
    else if (!same(p.outputSchema, t.outputSchema)) out.push(`tool "${t.name}" outputSchema differs from the repo`);
  }
  const known = new Set(expected.map(t => t.name));
  for (const t of live) if (!known.has(t.name)) out.push(`production has tool "${t.name}" that is not in the repo`);
  return out;
}

const expected = await localTools();
if (!expected.length) { console.error("The repo declares no tools; nothing to verify."); process.exit(1); }
let last = [];
for (let n = 1; n <= attempts; n++) {
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }), signal: AbortSignal.timeout(10000) });
    const x = await r.json();
    last = problems(expected, x.result?.tools ?? []);
    if (!last.length) { console.log(`Production serves the metadata of all ${expected.length} repo tools (attempt ${n}).`); process.exit(0); }
    console.log(`Not ready (attempt ${n}/${attempts}):\n  - ${last.join("\n  - ")}`);
  } catch (e) { last = [`request failed: ${e}`]; console.log(`Not ready (attempt ${n}/${attempts}): ${e}`); }
  if (n < attempts) await new Promise(resolve => setTimeout(resolve, delayMs));
}
console.error(`::error::Production metadata does not match the repo after ${attempts} attempts:\n- ${last.join("\n- ")}`);
process.exit(1);
