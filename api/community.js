import { verifyActions } from "../src/oidc.js";
import { finishCompare, finishRef, finishRender, finishUpload, moderatorOf, putCompare, putMedia, putRef, putUpload, readCompare, readIndex, readMedia, readRecord, readTemplateWithStatus, readUpload, retire } from "../src/community.js";

const MAX = 4 * 1024 * 1024;
const json = (res, status, payload, cache = "no-store") => { res.statusCode = status; res.setHeader("Content-Type", "application/json"); res.setHeader("Cache-Control", cache); res.end(JSON.stringify(payload)); };
const bearer = (req, secret) => !!secret && req.headers?.authorization === `Bearer ${secret}`;
/** The Studio repo's render workflow: its GitHub OIDC token (or, while it is still set, COMMUNITY_RENDER_SECRET). */
const renderJob = async req => bearer(req, process.env.COMMUNITY_RENDER_SECRET) || !!(await verifyActions(String(req.headers?.authorization || "").replace(/^Bearer /, "")));
/** A moderator code as the bearer token (TEMPLATE_ADMIN_CODES or COMMUNITY_ADMIN_SECRET). */
const moderator = req => !!moderatorOf(String(req.headers?.authorization || "").replace(/^Bearer /, ""));
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
 *   GET  /api/community?op=compare&id=&file=  latest comparison, sheet.jpg or comparacion.mp4 (a moderator code)
 *   GET  /api/community?op=record&id=         what the publishing job commits: card, source, notes, slug (the render workflow: GitHub OIDC)
 *   GET  /api/community?op=part&id=&part=      a part of an original the caller sent (the render workflow: GitHub OIDC)
 *   POST /api/community?op=upload&id=&key=&part=   the caller's Claude sends one part of the original (key from the brief)
 *   POST /api/community?op=upload-done&id=&key=&parts=   all parts sent: starts the reference job
 *   POST /api/community?op=ref&id=&file=     reference job uploads one frame sheet (the render workflow: GitHub OIDC)
 *   POST /api/community?op=ref-done          {id, ok, reason, duration, width, height, sheets} (the render workflow: GitHub OIDC)
 *   POST /api/community?op=compare&id=&file= compare job uploads sheet.jpg or comparacion.mp4 (the render workflow: GitHub OIDC)
 *   POST /api/community?op=compared          {id, round, ok, reason, times} (the render workflow: GitHub OIDC)
 *   POST /api/community?op=media&id=&file=   render job uploads one preview file (the render workflow: GitHub OIDC)
 *   POST /api/community?op=finish    {id, ok, reason, commit} render or publishing job is done (the render workflow: GitHub OIDC)
 *   POST /api/community?op=retire    {id, reason} a moderator takes a Community one out of the gallery (a moderator code)
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const url = new URL(req.url || "/", "http://x");
  const q = k => req.query?.[k] ?? url.searchParams.get(k);
  const op = q("op"), id = q("id"), file = q("file");
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method === "GET" || req.method === "HEAD") {
    if (op === "part") {
      if (!(await renderJob(req))) return json(res, 401, { error: "Unauthorized" });
      const bytes = await readUpload(String(id), q("part"));
      if (!bytes) { res.statusCode = 404; return res.end("Not found."); }
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Cache-Control", "no-store");
      return res.end(Buffer.from(bytes));
    }
    if (op === "record") {
      if (!(await renderJob(req))) return json(res, 401, { error: "Unauthorized" });
      const r = await readRecord(String(id));
      return r ? json(res, 200, r) : json(res, 404, { error: "No template being published with that id." });
    }
    if (op === "compare") {
      if (!moderator(req)) return json(res, 401, { error: "Unauthorized" });
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
  if (op === "upload") {
    const bytes = Buffer.isBuffer(data) ? data : null;
    const r = await putUpload(String(id), q("key"), q("part"), bytes);
    return json(res, r.ok ? 200 : 400, r);
  }
  if (op === "upload-done") {
    const r = await finishUpload(String(id), q("key"), q("parts"));
    return json(res, r.ok ? 200 : 400, r);
  }
  const uploads = { media: putMedia, ref: putRef, compare: putCompare };
  if (uploads[op]) {
    if (!(await renderJob(req))) return json(res, 401, { error: "Unauthorized" });
    const bytes = Buffer.isBuffer(data) ? data : null;
    if (!bytes?.length) return json(res, 400, { error: "Send the file as the request body." });
    const r = await uploads[op](String(id), String(file), bytes);
    return json(res, r.ok ? 200 : 400, r);
  }
  if (Buffer.isBuffer(data)) { try { data = JSON.parse(data.toString() || "{}"); } catch { return json(res, 400, { error: "Body must be JSON." }); } }
  if (op === "finish") {
    if (!(await renderJob(req))) return json(res, 401, { error: "Unauthorized" });
    const r = await finishRender(String(data.id), { ok: data.ok === true, reason: data.reason, commit: data.commit, pr: data.pr });
    return json(res, r.ok ? 200 : 400, r);
  }
  if (op === "ref-done" || op === "compared") {
    if (!(await renderJob(req))) return json(res, 401, { error: "Unauthorized" });
    const r = op === "ref-done"
      ? await finishRef(String(data.id), { ok: data.ok === true, reason: data.reason, duration: data.duration, width: data.width, height: data.height, sheets: data.sheets, video: data.video })
      : await finishCompare(String(data.id), { round: data.round, ok: data.ok === true, reason: data.reason, times: data.times });
    return json(res, r.ok ? 200 : 400, r);
  }
  if (op === "retire") {
    if (!moderator(req)) return json(res, 401, { error: "Unauthorized" });
    const r = await retire(String(data.id), data.reason);
    return json(res, r.ok ? 200 : 400, r);
  }
  return json(res, 400, { error: "Unknown op." });
}
