/**
 * .hcmotion project file: the composition JSON gzip-compressed inside a small binary container.
 * Same layout as packages/core/src/hcmotion.ts in the Studio repo (keep both in sync):
 *
 *   0  "HCM"        magic (3 ASCII bytes)
 *   3  version      u8 (1)
 *   4  flags        u8 (bit 0: gzip)
 *   5  reserved     3 zero bytes
 *   8  JSON size    u32 LE (uncompressed)
 *  12  data size    u32 LE (bytes after the header)
 *  16  SHA-256      32 bytes, of the data
 *  48  data         UTF-8 JSON (gzip when flagged)
 */
const MAGIC = [0x48, 0x43, 0x4d];
const HEAD = 48;
const LAYER_TYPES = new Set(["text","rect","ellipse","polygon","particles","image","video","code","camera","svg","ui","cursor","html","component","runtime"]);
const isObj = x => !!x && typeof x === "object" && !Array.isArray(x);
const num = x => typeof x === "number" && Number.isFinite(x);

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

export async function encodeHcmotion(comp) {
  const json = new TextEncoder().encode(JSON.stringify(comp));
  const data = await gzip(json);
  const out = new Uint8Array(HEAD + data.length);
  const v = new DataView(out.buffer);
  out.set(MAGIC, 0);
  v.setUint8(3, 1);
  v.setUint8(4, 1);
  v.setUint32(8, json.length, true);
  v.setUint32(12, data.length, true);
  out.set(new Uint8Array(await crypto.subtle.digest("SHA-256", data)), 16);
  out.set(data, HEAD);
  return out;
}
