/**
 * The user's images, videos and audio for a project, packed inside its .hcmotion (version 2).
 * Two ways in, both read by create_hcmotion's `media`:
 *  - {id, url}: a public https link the server downloads.
 *  - {id, upload}: a file sent to an upload session (start_media_upload): by the caller's shell
 *    (curl, in parts that fit a function's request body) or by the user on the drop page.
 * Sessions live in the private Blob store under media/<upload>/ and die after 24 h like the files.
 */
import { randomBytes, timingSafeEqual } from "node:crypto";
import { store, PUBLIC_URL, TTL_MS } from "./files.js";
import { MAX_FILE_BYTES } from "./hcmotion.js";

export const PART_BYTES = 3_000_000;
export const MAX_ONE = 150 * 1024 * 1024;
const MAX_PARTS = Math.ceil(MAX_ONE / PART_BYTES);
const MAX_FILES = 40;
const ID = /^[A-Za-z0-9][\w.-]{0,63}$/;
const ALLOWED = /^(image\/(png|jpeg|webp|gif|avif|svg\+xml)|video\/(mp4|webm|quicktime)|audio\/(mpeg|mp4|wav|x-wav|ogg|webm|aac)|font\/(ttf|otf|woff2?))$/;

export const validMediaId = id => typeof id === "string" && ID.test(id);
const newUpload = (now = Date.now()) => `u${now.toString(36)}-${randomBytes(6).toString("hex")}`;
const validUpload = u => typeof u === "string" && /^u[0-9a-z]{6,12}-[0-9a-f]{12}$/.test(u);
const ageOf = u => Date.now() - parseInt(u.slice(1).split("-")[0], 36);
const sameKey = (a, b) => typeof a === "string" && typeof b === "string" && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const metaPath = u => `media/${u}/meta.json`;
const partPath = (u, id, n) => `media/${u}/${id}/${n}`;
const getJson = async p => { const b = await (await store()).get(p); return b ? JSON.parse(Buffer.from(b).toString()) : null; };
const putJson = async (p, v) => (await store()).put(p, new TextEncoder().encode(JSON.stringify(v)));

/** What the first bytes say the file is (the type a client claims is not trusted). */
export function sniff(b) {
  const s = (o, n) => Buffer.from(b.subarray(o, o + n)).toString("latin1");
  if (b[0] === 0x89 && s(1, 3) === "PNG") return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (s(0, 4) === "RIFF" && s(8, 4) === "WEBP") return "image/webp";
  if (s(0, 4) === "RIFF" && s(8, 4) === "WAVE") return "audio/wav";
  if (s(0, 3) === "GIF") return "image/gif";
  if (s(4, 4) === "ftyp") { const brand = s(8, 4); return /avif|avis/.test(brand) ? "image/avif" : /^qt/.test(brand) ? "video/quicktime" : /M4A /.test(brand) ? "audio/mp4" : "video/mp4"; }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "video/webm";
  if (s(0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  if (s(0, 4) === "OggS") return "audio/ogg";
  if (s(0, 4) === "wOF2") return "font/woff2";
  if (s(0, 4) === "wOFF") return "font/woff";
  if (s(0, 4) === "OTTO") return "font/otf";
  if (b[0] === 0 && b[1] === 1 && b[2] === 0 && b[3] === 0) return "font/ttf";
  if (/^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(s(0, 256))) return "image/svg+xml";
  return null;
}

/** start_media_upload: an upload session for these ids. */
export async function startUpload(files, { now = Date.now() } = {}) {
  if (!Array.isArray(files) || !files.length || files.length > MAX_FILES) return { error: `files must list 1 to ${MAX_FILES} files: [{id, name?}].` };
  const ids = files.map(f => f?.id);
  const bad = ids.find(id => !validMediaId(id));
  if (bad !== undefined) return { error: `Invalid id ${JSON.stringify(bad)}: use letters, digits, dot, dash or underscore (max 64).` };
  if (new Set(ids).size !== ids.length) return { error: "Each file needs a different id." };
  const upload = newUpload(now), key = randomBytes(16).toString("hex");
  await putJson(metaPath(upload), { key, created: now, files: files.map(f => ({ id: f.id, name: typeof f.name === "string" ? f.name.slice(0, 120) : "" })), done: {} });
  const base = `${PUBLIC_URL}/api/media?upload=${upload}&key=${key}`;
  return {
    upload, page: `${PUBLIC_URL}/m/${upload}/${key}`, partBytes: PART_BYTES, maxFileBytes: MAX_ONE,
    part: `${base}&op=part&file=<id>&part=<n>`, done: `${base}&op=done&file=<id>&parts=<count>`, status: `${base}&op=status`,
    script: `send() { id="$1"; f="$2"; rm -rf .hcm_parts; mkdir .hcm_parts; split -b ${PART_BYTES} -d -a 3 "$f" .hcm_parts/p; n=0; for p in .hcm_parts/p*; do curl -sf -H "content-type: application/octet-stream" --data-binary @"$p" "${base}&op=part&file=$id&part=$n" >/dev/null || return 1; n=$((n+1)); done; curl -sf -X POST "${base}&op=done&file=$id&parts=$n"; rm -rf .hcm_parts; }; send <id> <path>   # once per file`,
    expiresAt: new Date(now + TTL_MS).toISOString(),
  };
}

async function session(upload, key) {
  if (!validUpload(upload) || ageOf(upload) > TTL_MS) return null;
  const m = await getJson(metaPath(upload));
  return m && sameKey(m.key, key) ? m : null;
}

export async function putPart(upload, key, id, part, bytes) {
  const m = await session(upload, key);
  if (!m) return { ok: false, error: "No upload session with that key (they last 24 h): call start_media_upload again." };
  if (!m.files.some(f => f.id === id)) return { ok: false, error: `This session has no file ${JSON.stringify(id)}.` };
  const n = Number(part);
  if (!Number.isInteger(n) || n < 0 || n >= MAX_PARTS) return { ok: false, error: `part must be 0 to ${MAX_PARTS - 1}.` };
  if (!bytes?.length || bytes.length > PART_BYTES) return { ok: false, error: `Each part must have 1 to ${PART_BYTES} bytes.` };
  if (n === 0 && !sniff(bytes)) return { ok: false, error: "That is not an image, video, audio or font file this editor opens (png, jpeg, webp, gif, avif, svg, mp4, webm, mov, mp3, m4a, wav, ogg, ttf, otf, woff)." };
  await (await store()).put(partPath(upload, id, n), bytes);
  return { ok: true };
}

export async function finishFile(upload, key, id, parts) {
  const m = await session(upload, key);
  if (!m) return { ok: false, error: "No upload session with that key (they last 24 h): call start_media_upload again." };
  if (!m.files.some(f => f.id === id)) return { ok: false, error: `This session has no file ${JSON.stringify(id)}.` };
  const count = Number(parts);
  if (!Number.isInteger(count) || count < 1 || count > MAX_PARTS) return { ok: false, error: `parts must be 1 to ${MAX_PARTS}.` };
  const s = await store();
  const first = await s.get(partPath(upload, id, 0));
  if (!first) return { ok: false, error: "Part 0 is missing: send it again, then call done again." };
  for (let i = 1; i < count; i++) if (!(await s.get(partPath(upload, id, i)))) return { ok: false, error: `Part ${i} is missing: send it again, then call done again.` };
  m.done[id] = { parts: count, mime: sniff(first) };
  await putJson(metaPath(upload), m);
  const left = m.files.filter(f => !m.done[f.id]).map(f => f.id);
  return { ok: true, received: id, waiting: left };
}

export async function uploadStatus(upload, key) {
  const m = await session(upload, key);
  if (!m) return null;
  return { files: m.files.map(f => ({ id: f.id, name: f.name, received: !!m.done[f.id] })) };
}

/** Downloads a public https file (images, video, audio, fonts only), capped. */
async function fromUrl(url, room, fetcher = fetch) {
  let u;
  try { u = new URL(url); } catch { return { error: "is not a valid URL" }; }
  if (u.protocol !== "https:") return { error: "must be an https:// link" };
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[?::1\]?$)/i.test(u.hostname) || /\.(local|internal)$/i.test(u.hostname)) return { error: "must be a public link" };
  const r = await fetcher(u, { redirect: "follow", signal: AbortSignal.timeout(25000) }).catch(e => ({ ok: false, status: 0, e }));
  if (!r.ok) return { error: `could not be downloaded (HTTP ${r.status || "error"}); if the site blocks servers, send it with start_media_upload` };
  const len = Number(r.headers.get("content-length") || 0);
  if (len > Math.min(MAX_ONE, room)) return { error: `is ${(len / 1048576).toFixed(0)} MB, too large` };
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.length > Math.min(MAX_ONE, room)) return { error: "is too large" };
  const mime = sniff(bytes);
  if (!mime) return { error: "is not an image, video, audio or font file this editor opens" };
  return { mime, bytes };
}

/**
 * create_hcmotion's `media`: [{id, url} | {id, upload}] → [{id, mime, bytes}] plus errors per item.
 * The total stays under the 200 MB of a .hcmotion.
 */
export async function collectMedia(list, uploads = {}, { fetcher } = {}) {
  const files = [], errors = [];
  if (list === undefined) return { files, errors };
  if (!Array.isArray(list) || list.length > MAX_FILES) return { files, errors: [{ path: "$media", code: "MEDIA_SHAPE", message: `media must be an array of up to ${MAX_FILES} items: {id, url} or {id, upload}.` }] };
  let total = 0;
  const seen = new Set();
  for (const [i, item] of list.entries()) {
    const path = `$media[${i}]`;
    const id = item?.id;
    if (!validMediaId(id)) { errors.push({ path: path + ".id", code: "MEDIA_ID", message: "id: letters, digits, dot, dash or underscore (max 64); layers use it as props.asset." }); continue; }
    if (seen.has(id)) { errors.push({ path: path + ".id", code: "MEDIA_ID", message: `id ${id} is listed twice.` }); continue; }
    seen.add(id);
    const room = MAX_FILE_BYTES - 4 * 1024 * 1024 - total;
    let got;
    if (typeof item.url === "string") got = await fromUrl(item.url, room, fetcher);
    else if (typeof item.upload === "string") {
      const m = validUpload(item.upload) && ageOf(item.upload) <= TTL_MS ? await getJson(metaPath(item.upload)) : null;
      const done = m?.done?.[id];
      if (!m) got = { error: "names an upload session that does not exist or expired" };
      else if (!done) got = { error: `has not been received yet in upload ${item.upload} (send it, then call done)` };
      else {
        const s = await store();
        const chunks = [];
        let size = 0;
        for (let n = 0; n < done.parts; n++) { const c = await s.get(partPath(item.upload, id, n)); if (!c) { got = { error: `lost part ${n}` }; break; } chunks.push(c); size += c.length; }
        if (!got) {
          if (size > room) got = { error: "is too large" };
          else { const bytes = new Uint8Array(size); let o = 0; for (const c of chunks) { bytes.set(c, o); o += c.length; } got = { mime: done.mime || sniff(bytes), bytes }; }
        }
      }
    } else got = { error: "needs url (public https link) or upload (from start_media_upload)" };
    if (got.error) { errors.push({ path, code: "MEDIA_UNAVAILABLE", message: `${id} ${got.error}.` }); continue; }
    if (!ALLOWED.test(got.mime)) { errors.push({ path, code: "MEDIA_TYPE", message: `${id} is ${got.mime}, which Studio does not open.` }); continue; }
    total += got.bytes.length;
    files.push({ id, mime: got.mime, bytes: got.bytes });
  }
  return { files, errors };
}

/** Cron: deletes upload sessions older than 24 h. */
export async function sweepMedia(now = Date.now()) {
  const s = await store();
  let cursor, n = 0;
  do {
    const page = await s.list(cursor, "media/");
    const old = page.blobs.map(b => b.pathname).filter(p => { const u = p.split("/")[1]; return !validUpload(u) || now - parseInt(u.slice(1).split("-")[0], 36) > TTL_MS; });
    if (old.length) { await s.del(old); n += old.length; }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return n;
}
