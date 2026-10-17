import { gunzipSync } from "node:zlib";
import { expired, pathOf, store, validId } from "../src/files.js";

/** File name from the project's own name (links no longer carry it). */
function nameOf(bytes) {
 try { return `${String(JSON.parse(gunzipSync(bytes.subarray(48))).name || "")}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "proyecto"; }
 catch { return "proyecto"; }
}

/** GET /d/<id> (or /d/<id>/<name>.hcmotion): serves a generated project while its link is alive (24 h). */
export default async function handler(req, res) {
 res.setHeader("Access-Control-Allow-Origin", "*");
 res.setHeader("Cache-Control", "no-store");
 const url = new URL(req.url || "/", "http://x");
 const id = req.query?.id ?? url.searchParams.get("id");
 const asked = req.query?.name ?? url.searchParams.get("name");
 const gone = msg => { res.statusCode = 410; res.setHeader("Content-Type", "text/plain; charset=utf-8"); res.end(msg); };
 if (req.method !== "GET" && req.method !== "HEAD") { res.statusCode = 405; res.setHeader("Allow", "GET, HEAD"); return res.end("Use GET to download this .hcmotion file."); }
 if (!validId(id)) { res.statusCode = 404; return res.end("This is not a valid .hcmotion download link."); }
 if (expired(id)) return gone("This download link expired (links last 24 hours). Ask Claude to generate the project again.");
 const bytes = await (await store()).get(pathOf(id)).catch(e => { if (e?.name !== "BlobNotFoundError") console.error("hcmotion download failed:", e?.message || e); return null; });
 if (!bytes) return gone("This download link is no longer available. Ask Claude to generate the project again.");
 const name = asked ? String(asked).replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "proyecto.hcmotion" : `${nameOf(bytes)}.hcmotion`;
 res.statusCode = 200;
 res.setHeader("Content-Type", "application/octet-stream");
 res.setHeader("Content-Disposition", `attachment; filename="${name.endsWith(".hcmotion") ? name : name + ".hcmotion"}"`);
 res.setHeader("Content-Length", String(bytes.length));
 res.end(req.method === "HEAD" ? undefined : Buffer.from(bytes));
}
