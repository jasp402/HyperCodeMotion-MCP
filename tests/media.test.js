import test from "node:test";
import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import handler from "../api/mcp.js";
import media from "../api/media.js";
import download from "../api/d.js";
import { encodeHcmotion, jsonPart, TooLarge } from "../src/hcmotion.js";
import { setStore } from "../src/files.js";
import { collectMedia, sniff, PART_BYTES } from "../src/media.js";
import { validateJson, getCapabilities } from "../src/contract.js";
import { checkScenes } from "../src/transitions.js";

const files = new Map();
setStore({
  put: async (p, b) => { files.set(p, typeof b === "string" ? new TextEncoder().encode(b) : b); },
  get: async p => files.get(p) ?? null,
  list: async (_c, prefix = "files/") => ({ blobs: [...files.keys()].filter(k => k.startsWith(prefix)).map(pathname => ({ pathname })), hasMore: false }),
  del: async ps => { for (const p of ps) files.delete(p); }
});
const png = n => { const b = new Uint8Array(n); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); for (let i = 8; i < n; i++) b[i] = (i * 31) & 255; return b; };
const comp = () => ({ version: 1, name: "Goku", width: 1080, height: 1920, fps: 30, duration: 4, background: "#000", params: {},
  layers: [{ id: "img", name: "Foto", type: "image", start: 0, end: 4, props: { asset: "goku-1", x: 540, y: 960, w: 1080, h: 1920 } }] });
async function call(name, args) {
  let raw; const res = { statusCode: 200, setHeader() {}, end(x) { raw = x; } };
  await handler({ method: "POST", headers: {}, body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } } }, res);
  return JSON.parse(raw).result.structuredContent;
}
async function hit(method, query, body) {
  const res = { statusCode: 200, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(x) { this.body = x; }, write(x) { (this.chunks ??= []).push(x); return true; } };
  await media({ method, url: "/api/media", query, body }, res);
  return { status: res.statusCode, body: res.headers["Content-Type"]?.includes("json") ? JSON.parse(res.body) : res.body };
}

test("v2 layout: JSON, then the files as raw bytes; assets left out of the JSON", async () => {
  const b = await encodeHcmotion(comp(), [{ id: "goku-1", mime: "image/png", bytes: png(5000) }]);
  assert.equal(b[3], 2);
  const json = JSON.parse(gunzipSync(jsonPart(b)));
  assert.equal(json.assets, undefined);
  assert.equal(json.name, "Goku");
  assert.ok(b.length > 5000 && b.length < 7000, "no base64");
  await assert.rejects(encodeHcmotion(comp(), [{ id: "goku-1", mime: "image/png", bytes: png(5000) }], { max: 3000 }), TooLarge);
  assert.equal((await encodeHcmotion(comp()))[3], 1, "no files: still version 1");
});

test("media by public url: downloaded, sniffed and refused when it is not media", async () => {
  const fetcher = async u => String(u).includes("ok") ? new Response(png(900)) : new Response("<html>", { headers: { "content-type": "text/html" } });
  const got = await collectMedia([{ id: "goku-1", url: "https://cdn.example.com/ok.png" }, { id: "x", url: "https://example.com/page" }, { id: "y", url: "http://example.com/a.png" }, { id: "z", url: "https://localhost/a.png" }], {}, { fetcher });
  assert.deepEqual(got.files.map(f => [f.id, f.mime, f.bytes.length]), [["goku-1", "image/png", 900]]);
  assert.deepEqual(got.errors.map(e => e.path), ["$media[1]", "$media[2]", "$media[3]"]);
});

test("upload session: parts by curl or the drop page, then create_hcmotion packs it", async () => {
  const up = await call("start_media_upload", { files: [{ id: "goku-1", name: "goku.png" }] });
  assert.match(up.page, /\/m\/u[0-9a-z]+-[0-9a-f]+\/[0-9a-f]{32}$/);
  assert.match(up.script, /split -b 3000000/);
  const key = up.page.split("/").pop();
  const q = (op, extra = {}) => ({ upload: up.upload, key, op, ...extra });
  assert.equal((await hit("GET", { upload: up.upload, key })).status, 200, "drop page");
  assert.equal((await hit("POST", q("part", { file: "goku-1", part: "0" }), Buffer.from("not an image"))).status, 400);
  const img = png(PART_BYTES + 1000);
  assert.equal((await hit("POST", q("part", { file: "goku-1", part: "0" }), Buffer.from(img.subarray(0, PART_BYTES)))).status, 200);
  const early = await call("create_hcmotion", { json: comp(), media: [{ id: "goku-1", upload: up.upload }] });
  assert.equal(early.created, false, "not finished yet");
  assert.equal((await hit("POST", q("part", { file: "goku-1", part: "1" }), Buffer.from(img.subarray(PART_BYTES)))).status, 200);
  const done = await hit("POST", q("done", { file: "goku-1", parts: "2" }));
  assert.deepEqual(done.body, { ok: true, received: "goku-1", waiting: [] });
  assert.equal((await hit("POST", { ...q("part", { file: "goku-1", part: "0" }), key: "0".repeat(32) }, Buffer.from(img.subarray(0, 10)))).status, 400, "wrong key");
  const out = await call("create_hcmotion", { json: comp(), media: [{ id: "goku-1", upload: up.upload }] });
  assert.equal(out.created, true);
  assert.deepEqual(out.media, [{ id: "goku-1", type: "image/png", bytes: img.length }]);
  // the download serves the whole file, in pieces when it is large
  const id = out.download.split("/").pop();
  const res = { headers: {}, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, write(x) { (this.chunks ??= []).push(x); return true; }, end(x) { this.body = x; } };
  await download({ method: "GET", url: "/api/d", query: { id } }, res);
  assert.equal(res.headers["content-disposition"], 'attachment; filename="goku.hcmotion"');
  assert.equal(Number(res.headers["content-length"]), out.bytes);
});

test("create_hcmotion warns about packed media no layer uses", async () => {
  const out = await call("create_hcmotion", { json: comp(), media: [{ id: "spare", url: "https://bad host" }] });
  assert.equal(out.created, false);
  assert.equal(out.errors[0].code, "MEDIA_UNAVAILABLE");
});

test("sniff knows the formats Studio opens", () => {
  assert.equal(sniff(png(20)), "image/png");
  assert.equal(sniff(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(sniff(new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d])), "video/mp4");
  assert.equal(sniff(new TextEncoder().encode("hello")), null);
});

test("rotated text is measured as the turned box", () => {
  const c = comp();
  c.layers = [{ id: "w", name: "Word", type: "text", start: 0, end: 4, props: { text: "SON GOKU", size: 150, x: 150, y: 960, rotation: 90 } }];
  const v = validateJson(c);
  assert.ok(!v.errors.some(e => e.code === "TEXT_OUTSIDE_CANVAS" || e.code === "TEXT_DOES_NOT_FIT"), JSON.stringify(v.errors));
  c.layers[0].props.rotation = 0;
  assert.ok(validateJson(c).errors.some(e => e.code === "TEXT_OUTSIDE_CANVAS"), "unturned it does cross the canvas");
});

test("glass transition and post are part of the contract", () => {
  const c = { ...comp(), scenes: [{ id: "a", start: 0, end: 2 }, { id: "b", start: 2, end: 4, transition: { type: "glass", dur: 0.4 } }] };
  assert.deepEqual(checkScenes(c), []);
  const cap = getCapabilities();
  assert.match(cap.transitions.shape.type, /glass/);
  assert.equal(cap.post.where, "composition.post");
  assert.match(cap.userMaterials, /create_hcmotion media/);
});
