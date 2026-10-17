import { expired, pathOf, store, validId } from "../src/files.js";

/** GET /d/<id>/<name>.hcmotion: serves a generated project while its link is alive (24 h). */
export default async function handler(req, res) {
 res.setHeader("Access-Control-Allow-Origin", "*");
 res.setHeader("Cache-Control", "no-store");
 const url = new URL(req.url || "/", "http://x");
 const id = req.query?.id ?? url.searchParams.get("id");
 const name = String(req.query?.name ?? url.searchParams.get("name") ?? "proyecto.hcmotion").replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "proyecto.hcmotion";
 const gone = msg => { res.statusCode = 410; res.setHeader("Content-Type", "text/plain; charset=utf-8"); res.end(msg); };
 if (req.method !== "GET" && req.method !== "HEAD") { res.statusCode = 405; return res.end(); }
 if (!validId(id)) { res.statusCode = 404; return res.end("Not found"); }
 if (expired(id)) return gone("This download link expired (links last 24 hours). Ask Claude to generate the project again.");
 const bytes = await (await store()).get(pathOf(id)).catch(e => { if (e?.name !== "BlobNotFoundError") console.error("hcmotion download failed:", e?.message || e); return null; });
 if (!bytes) return gone("This download link is no longer available. Ask Claude to generate the project again.");
 res.statusCode = 200;
 res.setHeader("Content-Type", "application/octet-stream");
 res.setHeader("Content-Disposition", `attachment; filename="${name.endsWith(".hcmotion") ? name : name + ".hcmotion"}"`);
 res.setHeader("Content-Length", String(bytes.length));
 res.end(req.method === "HEAD" ? undefined : Buffer.from(bytes));
}
