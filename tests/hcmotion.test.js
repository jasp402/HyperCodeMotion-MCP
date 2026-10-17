import test from "node:test";
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import handler from "../api/mcp.js";
import download from "../api/d.js";
import cleanup from "../api/cleanup.js";
import { encodeHcmotion, checkComposition } from "../src/hcmotion.js";
import { setStore, sweep, newId, pathOf, TTL_MS } from "../src/files.js";

const files = new Map();
setStore({
  put: async (p, b) => { files.set(p, b); },
  get: async p => files.get(p) ?? null,
  list: async () => ({ blobs: [...files.keys()].map(pathname => ({ pathname })), hasMore: false }),
  del: async ps => { for (const p of ps) files.delete(p); }
});
const comp = () => ({ version: 1, name: "Pisco Sour", width: 1080, height: 1920, fps: 30, duration: 6, background: "#111", params: {},
  layers: [{ id: "t", name: "Title", type: "text", start: 0, end: 6, props: { text: "Hola" } }] });
async function call(name, args) {
  let raw; const res = { statusCode: 200, setHeader() {}, end(x) { raw = x; } };
  await handler({ method: "POST", headers: {}, body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } } }, res);
  return JSON.parse(raw).result;
}
async function get(id, name) {
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(x) { this.body = x; } };
  await download({ method: "GET", url: "/api/d", query: { id, name } }, res);
  return res;
}

test("file layout: HCM header, sizes, SHA-256 and gzip JSON", async () => {
  const b = await encodeHcmotion(comp());
  assert.equal(Buffer.from(b.subarray(0, 3)).toString(), "HCM");
  const v = new DataView(b.buffer);
  assert.equal(v.getUint8(3), 1);
  assert.equal(v.getUint32(12, true), b.length - 48);
  const data = b.subarray(48);
  assert.deepEqual(Buffer.from(b.subarray(16, 48)), createHash("sha256").update(data).digest());
  const json = gunzipSync(data);
  assert.equal(v.getUint32(8, true), json.length);
  assert.deepEqual(JSON.parse(json), comp());
});

test("create_hcmotion stores the file and returns working links", async () => {
  const r = await call("create_hcmotion", { json: comp() });
  const out = r.structuredContent;
  assert.equal(r.isError, false);
  assert.equal(out.created, true);
  assert.match(out.download, /^https:\/\/mcp\.hypercodemotion\.com\/d\/[0-9a-z]+-[\w-]{8}$/);
  const [, id] = out.download.match(/\/d\/([^/]+)$/);
  assert.equal(out.open, `https://app.hypercodemotion.com/?p=${id}`);
  const res = await get(id);
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-disposition"], /pisco-sour\.hcmotion/);
  assert.equal(Buffer.from(res.body).subarray(0, 3).toString(), "HCM");
});

test("create_hcmotion refuses broken compositions with errors to fix", async () => {
  const bad = { ...comp(), width: 0, layers: [{ id: "x", type: "rocket", start: 0, end: 1, props: {} }] };
  const out = (await call("create_hcmotion", { json: bad })).structuredContent;
  assert.equal(out.created, false);
  assert.ok(out.errors.length);
  assert.equal((await call("create_hcmotion", { json: "{nope" })).structuredContent.errors[0].code, "INVALID_JSON");
  assert.equal((await call("create_hcmotion", { json: { add: [] } })).structuredContent.created, false);
  assert.deepEqual(checkComposition(comp()), []);
});

test("links die after 24 h and the cron sweeps old files", async () => {
  const old = newId(Date.now() - TTL_MS - 1000);
  files.set(pathOf(old), new Uint8Array([1]));
  assert.equal((await get(old)).statusCode, 410);
  assert.equal((await get("../../etc")).statusCode, 404);
  const before = files.size;
  assert.equal(await sweep(), 1);
  assert.equal(files.size, before - 1);
  const res = { setHeader() {}, end() {} };
  await cleanup({ headers: {} }, res);
  assert.equal(res.statusCode, 401);
});

test("links made before ids were shortened still download", async () => {
  const id = `${Date.now().toString(36)}-AAAAAAAAAAAAAAAA`;
  files.set(pathOf(id), await encodeHcmotion(comp()));
  const res = await get(id, "pisco-sour.hcmotion");
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-disposition"], /pisco-sour\.hcmotion/);
});
