import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/mcp.js";
import session from "../api/session.js";
import { setStore, newId, pathOf, PUBLIC_URL } from "../src/files.js";
import { openSession, deliverResult, pollSession, hashKey, sweepSessions, fileIdOf, validCode, SESSION_TTL_MS } from "../src/sessions.js";

const files = new Map();
setStore({
  put: async (p, b) => { files.set(p, b); },
  get: async p => files.get(p) ?? null,
  list: async () => ({ blobs: [...files.keys()].map(pathname => ({ pathname })), hasMore: false }),
  del: async ps => { for (const p of ps) files.delete(p); }
});
const KEY = "k".repeat(16) + "0123456789abcdef0123456789abcdef";
const CODE = "HCM-AB2C-DE3F-GH4J";

test("validCode: needs three groups without 0, O, 1 or I", () => {
  assert.ok(validCode(CODE));
  assert.ok(!validCode("HCM-ABCD"));
  assert.ok(!validCode("HCM-AB0C-DE3F-GH4J"));
});

test("open → waiting → delivered, only with the key", async () => {
  files.clear();
  assert.equal((await openSession({ code: CODE, keyHash: hashKey(KEY), tool: "clonar-tiktok" })).ok, true);
  assert.equal((await openSession({ code: CODE, keyHash: hashKey(KEY) })).error, "CODE_TAKEN");
  assert.equal((await pollSession(CODE, KEY)).status, "waiting");
  assert.equal((await pollSession(CODE, KEY.replace("k", "x"))).status, "not_found");
  const id = newId();
  const d = await deliverResult({ session_code: CODE, download: `${PUBLIC_URL}/d/${id}` });
  assert.equal(d.delivered, true);
  const r = await pollSession(CODE, KEY);
  assert.equal(r.status, "delivered");
  assert.equal(r.download, `${PUBLIC_URL}/d/${id}`);
  assert.equal((await pollSession(CODE, "short")).status, "not_found");
});

test("deliver refuses unknown sessions, foreign links and expired sessions", async () => {
  files.clear();
  const id = newId();
  assert.equal((await deliverResult({ session_code: CODE, download: id })).error, "NO_SESSION");
  await openSession({ code: CODE, keyHash: hashKey(KEY) });
  assert.equal((await deliverResult({ session_code: CODE, download: "https://evil.example/d/" + id })).error, "BAD_DOWNLOAD");
  assert.equal(fileIdOf(`${PUBLIC_URL}/d/${id}/x.hcmotion`), id);
  const later = Date.now() + SESSION_TTL_MS + 1;
  assert.equal((await deliverResult({ session_code: CODE, download: id }, later)).error, "NO_SESSION");
  assert.equal((await pollSession(CODE, KEY, later)).status, "expired");
  assert.equal(await sweepSessions(later), 1);
});

test("create_hcmotion with session delivers to the Studio", async () => {
  files.clear();
  await openSession({ code: CODE, keyHash: hashKey(KEY) });
  let raw; const res = { statusCode: 200, setHeader() {}, end(x) { raw = x; } };
  const json = { version: 1, name: "S", width: 1080, height: 1920, fps: 30, duration: 2, background: "#111", params: {}, layers: [{ id: "t", name: "T", type: "text", start: 0, end: 2, props: { text: "Hola" } }] };
  await handler({ method: "POST", headers: {}, body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "create_hcmotion", arguments: { json, session: CODE } } } }, res);
  const out = JSON.parse(raw).result.structuredContent;
  assert.equal(out.created, true);
  assert.equal(out.delivery.delivered, true);
  const r = await pollSession(CODE, KEY);
  assert.equal(r.status, "delivered");
  assert.ok(files.has(pathOf(r.download.split("/d/")[1])));
});

test("HTTP: POST opens, GET polls, wrong key is 404", async () => {
  files.clear();
  const call = async req => { const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(x) { this.body = x; } }; await session(req, res); return { ...res, json: res.body ? JSON.parse(res.body) : null }; };
  assert.equal((await call({ method: "POST", body: { code: CODE, keyHash: hashKey(KEY) } })).statusCode, 200);
  assert.equal((await call({ method: "GET", url: `/api/session?code=${CODE}&key=${KEY}` })).json.status, "waiting");
  assert.equal((await call({ method: "GET", url: `/api/session?code=${CODE}&key=${"z".repeat(48)}` })).statusCode, 404);
  assert.equal((await call({ method: "OPTIONS" })).statusCode, 204);
});

test("deliver_error: the Studio sees failed with code and message; not after delivery", async () => {
  const { openSession, deliverError, pollSession, hashKey } = await import("../src/sessions.js");
  const code = "HCM-ERRR-TEST-2345", key = "k".repeat(40);
  await openSession({ code, keyHash: hashKey(key), tool: "clonar-tiktok" });
  assert.equal((await deliverError({ session_code: "bad", code: "CANNOT_VIEW" })).error, "BAD_CODE");
  assert.equal((await deliverError({ session_code: "HCM-NAAA-NAAA-2345", code: "CANNOT_VIEW" })).error, "NO_SESSION");
  const r = await deliverError({ session_code: code, code: "VIDEO_PRIVATE", message: "Es privado" });
  assert.equal(r.reported, true);
  assert.deepEqual(await pollSession(code, key), { status: "failed", code: "VIDEO_PRIVATE", message: "Es privado" });
  const r2 = await deliverError({ session_code: code, code: "weird" });
  assert.equal(r2.reported, true);
  assert.equal((await pollSession(code, key)).code, "OTHER");
});
