import { finishCompare, finishRef, finishRender, putCompare, putMedia, putRef, readCompare, readIndex, readMedia, readTemplateWithStatus, retire } from "../src/community.js";

const MAX = 4 * 1024 * 1024;
const json = (res, status, payload, cache = "no-store") => { res.statusCode = status; res.setHeader("Content-Type", "application/json"); res.setHeader("Cache-Control", cache); res.end(JSON.stringify(payload)); };
const bearer = (req, secret) => !!secret && req.headers?.authorization === `Bearer ${secret}`;
async function body(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (Buffer.isBuffer(req.body)) return req.body;
  const chunks = []; let len = 0;
  for await (const part of req) { len += part.length; if (len > MAX) throw new Error("too large"); chunks.push(part); }
  return Buffer.concat(chunks);
}

/**
 * Community templates.
 *   GET  /community                  published templates (the Studio gallery reads it)
 *   GET  /c/<id>/<variant>.json      a template's composition (cuadrado, vertical, horizontal)
 *   GET  /c/<id>/<id>-<ratio>.<ext>  its preview media
 *   GET  /api/community?op=compare&id=&file=  latest comparison, sheet.jpg or comparacion.mp4 (COMMUNITY_ADMIN_SECRET)
 *   POST /api/community?op=ref&id=&file=     reference job uploads one frame sheet (COMMUNITY_RENDER_SECRET)
 *   POST /api/community?op=ref-done          {id, ok, reason, duration, width, height, sheets} (COMMUNITY_RENDER_SECRET)
 *   POST /api/community?op=compare&id=&file= compare job uploads sheet.jpg or comparacion.mp4 (COMMUNITY_RENDER_SECRET)
 *   POST /api/community?op=compared          {id, round, ok, reason, times} (COMMUNITY_RENDER_SECRET)
 *   POST /api/community?op=media&id=&file=   render job uploads one preview file (COMMUNITY_RENDER_SECRET)
 *   POST /api/community?op=finish    {id, ok, reason} render job is done (COMMUNITY_RENDER_SECRET)
 *   POST /api/community?op=retire    {id, reason} owner takes one out of the gallery (COMMUNITY_ADMIN_SECRET)
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const url = new URL(req.url || "/", "http://x");
  const q = k => req.query?.[k] ?? url.searchParams.get(k);
  const op = q("op"), id = q("id"), file = q("file");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method === "GET" || req.method === "HEAD") {
    if (op === "compare") {
      if (!bearer(req, process.env.COMMUNITY_ADMIN_SECRET)) return json(res, 401, { error: "Unauthorized" });
      const bytes = await readCompare(String(id), String(file));
      if (!bytes) { res.statusCode = 404; return res.end("Not found."); }
      res.statusCode = 200;
      res.setHeader("Content-Type", file.endsWith(".mp4") ? "video/mp4" : "image/jpeg");
      res.setHeader("Cache-Control", "no-store");
      return res.end(Buffer.from(bytes));
    }
    if (!id) return json(res, 200, await readIndex(), "public, max-age=60");
    if (/^(cuadrado|vertical|horizontal)\.json$/.test(file || "")) {
      // until it is published a revision can replace it, so only a published one is cached
      const t = await readTemplateWithStatus(id, file.slice(0, -5));
      return t ? json(res, 200, t.composition, t.status === "published" ? "public, max-age=300" : "no-store") : json(res, 404, { error: "No such Community template." });
    }
    const bytes = file?.startsWith(`${id}-`) ? await readMedia(id, file.slice(id.length + 1)) : null;
    if (!bytes) { res.statusCode = 404; return res.end("Not found."); }
    res.statusCode = 200;
    res.setHeader("Content-Type", file.endsWith(".mp4") ? "video/mp4" : "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Content-Length", String(bytes.length));
    return res.end(req.method === "HEAD" ? undefined : Buffer.from(bytes));
  }
  if (req.method !== "POST") return json(res, 405, { error: "Use GET or POST." });
  let data;
  try { data = await body(req); } catch { return json(res, 413, { error: "Larger than 4 MB." }); }
  const uploads = { media: putMedia, ref: putRef, compare: putCompare };
  if (uploads[op]) {
    if (!bearer(req, process.env.COMMUNITY_RENDER_SECRET)) return json(res, 401, { error: "Unauthorized" });
    const bytes = Buffer.isBuffer(data) ? data : null;
    if (!bytes?.length) return json(res, 400, { error: "Send the file as the request body." });
    const r = await uploads[op](String(id), String(file), bytes);
    return json(res, r.ok ? 200 : 400, r);
  }
  if (Buffer.isBuffer(data)) { try { data = JSON.parse(data.toString() || "{}"); } catch { return json(res, 400, { error: "Body must be JSON." }); } }
  if (op === "finish") {
    if (!bearer(req, process.env.COMMUNITY_RENDER_SECRET)) return json(res, 401, { error: "Unauthorized" });
    const r = await finishRender(String(data.id), { ok: data.ok === true, reason: data.reason });
    return json(res, r.ok ? 200 : 400, r);
  }
  if (op === "ref-done" || op === "compared") {
    if (!bearer(req, process.env.COMMUNITY_RENDER_SECRET)) return json(res, 401, { error: "Unauthorized" });
    const r = op === "ref-done"
      ? await finishRef(String(data.id), { ok: data.ok === true, reason: data.reason, duration: data.duration, width: data.width, height: data.height, sheets: data.sheets })
      : await finishCompare(String(data.id), { round: data.round, ok: data.ok === true, reason: data.reason, times: data.times });
    return json(res, r.ok ? 200 : 400, r);
  }
  if (op === "retire") {
    if (!bearer(req, process.env.COMMUNITY_ADMIN_SECRET)) return json(res, 401, { error: "Unauthorized" });
    const r = await retire(String(data.id), data.reason);
    return json(res, r.ok ? 200 : 400, r);
  }
  return json(res, 400, { error: "Unknown op." });
}
