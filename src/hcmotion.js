/**
 * .hcmotion project file: the composition JSON gzip-compressed inside a small binary container.
 * Same layout as packages/core/src/hcmotion.ts in the Studio repo (keep both in sync):
 *
 *   0  "HCM"        magic (3 ASCII bytes)
 *   3  version      u8 (1 or 2)
 *   4  flags        u8 (bit 0: gzip)
 *   5  reserved     3 zero bytes
 *   8  JSON size    u32 LE (uncompressed)
 *  12  data size    u32 LE (bytes after the header)
 *  16  SHA-256      32 bytes, of the data
 *  48  data
 *
 * Version 1: data is the JSON (gzip when flagged).
 * Version 2: the JSON and, after it, the project's files (images, videos, audio) as raw bytes:
 *   u32 LE gzip-JSON size · gzip JSON · u32 LE file count ·
 *   per file: u16 LE + id (UTF-8) · u16 LE + MIME type · u32 LE + bytes
 * Studio puts each file back in assets[id] as a dataURL. Version 1 is written when there are no files.
 * A .hcmotion is never larger than 200 MB.
 */
export const MAX_FILE_BYTES = 200 * 1024 * 1024;
const MAGIC = [0x48, 0x43, 0x4d];
const HEAD = 48;
const LAYER_TYPES = new Set(["text","rect","ellipse","polygon","particles","image","video","code","camera","svg","ui","cursor","html","component","runtime"]);
const isObj = x => !!x && typeof x === "object" && !Array.isArray(x);
const num = x => typeof x === "number" && Number.isFinite(x);
const mb = n => `${(n / 1048576).toFixed(n < 10485760 ? 1 : 0)} MB`;

async function gzip(bytes) {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip")));
  return new Uint8Array(await out.arrayBuffer());
}

/** Studio's own open-time check (checkComposition in the Studio repo): what would stop it from opening. */
export function checkComposition(c) {
  const out = [];
  const add = (path, message) => out.push({ path, code: "STUDIO_REJECTS", message });
  if (!isObj(c)) return [{ path: "$", code: "STUDIO_REJECTS", message: "Not a HyperCodeMotion composition." }];
  if (c.version !== 1) add("$.version", "Must be 1.");
  for (const k of ["width", "height", "fps", "duration"]) if (!num(c[k]) || c[k] <= 0) add("$." + k, "Must be a number greater than 0.");
  if (num(c.width) && num(c.height) && (c.width > 8192 || c.height > 8192)) add("$.width", "Max 8192 px.");
  if (num(c.duration) && c.duration > 3600) add("$.duration", "Max 3600 s.");
  if (!Array.isArray(c.layers)) add("$.layers", "Missing layers array.");
  else c.layers.forEach((l, i) => {
    const p = `$.layers[${i}]`;
    if (!isObj(l)) return add(p, "Layer must be an object.");
    if (typeof l.id !== "string" || !l.id) add(p + ".id", "Missing id.");
    if (!LAYER_TYPES.has(l.type)) add(p + ".type", `Unknown layer type ${JSON.stringify(l.type)}.`);
    if (!num(l.start) || !num(l.end)) add(p, "Missing numeric start/end.");
    if (!isObj(l.props)) add(p + ".props", "Missing props object.");
  });
  for (const k of ["assets", "docs"]) if (c[k] !== undefined && (!isObj(c[k]) || Object.values(c[k]).some(v => typeof v !== "string"))) add("$." + k, "Must map ids to strings.");
  if (c.params !== undefined && !isObj(c.params)) add("$.params", "Must be an object.");
  return out;
}

const DATA_URL = /^data:([\w.+-]+\/[\w.+-]+)(?:;[\w=.+-]+)*;base64,/;
function fromDataUrl(s) {
  const m = typeof s === "string" && DATA_URL.exec(s);
  if (!m) return null;
  return { mime: m[1], bytes: new Uint8Array(Buffer.from(s.slice(m[0].length), "base64")) };
}

function container(version, jsonLen, data, hash) {
  const out = new Uint8Array(HEAD + data.length);
  const v = new DataView(out.buffer);
  out.set(MAGIC, 0);
  v.setUint8(3, version);
  v.setUint8(4, 1);
  v.setUint32(8, jsonLen, true);
  v.setUint32(12, data.length, true);
  out.set(hash, 16);
  out.set(data, HEAD);
  return out;
}

/** Error with a code the tools return as-is. */
export class TooLarge extends Error { constructor(m) { super(m); this.code = "FILE_TOO_LARGE"; } }

/**
 * Packs the composition. `files` ([{id, mime, bytes}]) and any dataURL in comp.assets travel as raw
 * bytes after the JSON (version 2). Throws TooLarge past `max` (200 MB).
 */
export async function encodeHcmotion(comp, files = [], { max = MAX_FILE_BYTES } = {}) {
  const all = [...files];
  const kept = {};
  for (const [id, v] of Object.entries(comp.assets ?? {})) {
    const f = fromDataUrl(v);
    if (f && !all.some(x => x.id === id)) all.push({ id, ...f });
    else if (!f) kept[id] = v;
  }
  const enc = new TextEncoder();
  const sha = async d => new Uint8Array(await crypto.subtle.digest("SHA-256", d));
  if (!all.length) {
    const json = enc.encode(JSON.stringify(comp));
    const data = await gzip(json);
    if (HEAD + data.length > max) throw new TooLarge(`The project would be ${mb(HEAD + data.length)}; a .hcmotion cannot exceed ${mb(max)}.`);
    return container(1, json.length, data, await sha(data));
  }
  const rest = { ...comp };
  if (Object.keys(kept).length) rest.assets = kept; else delete rest.assets;
  for (const f of all) delete rest.assets?.[f.id];
  const json = enc.encode(JSON.stringify(rest));
  const gz = await gzip(json);
  const metas = all.map(f => ({ id: enc.encode(f.id), mime: enc.encode(f.mime), f }));
  let size = 8 + gz.length;
  for (const m of metas) size += 8 + m.id.length + m.mime.length + m.f.bytes.length;
  if (HEAD + size > max) {
    const big = [...all].sort((a, b) => b.bytes.length - a.bytes.length).slice(0, 3).map(f => `${f.id} (${mb(f.bytes.length)})`).join(", ");
    throw new TooLarge(`With its files the project would be ${mb(HEAD + size)}; a .hcmotion cannot exceed ${mb(max)}. Largest: ${big}. Send smaller or compressed versions.`);
  }
  const data = new Uint8Array(size);
  const v = new DataView(data.buffer);
  let o = 0;
  v.setUint32(o, gz.length, true); data.set(gz, o += 4); o += gz.length;
  v.setUint32(o, metas.length, true); o += 4;
  for (const m of metas) {
    v.setUint16(o, m.id.length, true); data.set(m.id, o += 2); o += m.id.length;
    v.setUint16(o, m.mime.length, true); data.set(m.mime, o += 2); o += m.mime.length;
    v.setUint32(o, m.f.bytes.length, true); data.set(m.f.bytes, o += 4); o += m.f.bytes.length;
  }
  return container(2, json.length, data, await sha(data));
}

/** The gzip JSON of a .hcmotion (version 1 or 2), for reading its name. */
export function jsonPart(bytes) {
  const d = bytes.subarray(HEAD);
  if (bytes[3] < 2) return d;
  const len = new DataView(d.buffer, d.byteOffset, d.byteLength).getUint32(0, true);
  return d.subarray(4, 4 + len);
}
