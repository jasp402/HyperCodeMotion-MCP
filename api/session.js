import { openSession, pollSession } from "../src/sessions.js";

/**
 * Studio side of the return channel.
 *   POST /api/session {code, keyHash, tool}  opens a waiting session
 *   GET  /api/session?code=…&key=…           waiting | delivered (+ download) | expired | not_found
 * No cookies: the secret key is the credential, so a wildcard origin is safe.
 */
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Cache-Control", "no-store");
  const send = (status, body) => { res.statusCode = status; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.end(JSON.stringify(body)); };
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  try {
    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
      const r = await openSession(body || {});
      return send(r.ok ? 200 : r.error === "CODE_TAKEN" ? 409 : 400, r);
    }
    if (req.method === "GET") {
      const url = new URL(req.url || "/", "http://x");
      const q = k => req.query?.[k] ?? url.searchParams.get(k);
      const r = await pollSession(q("code"), q("key"));
      return send(r.status === "not_found" ? 404 : 200, r);
    }
    res.setHeader("Allow", "GET, POST, OPTIONS");
    return send(405, { error: "Use POST to open a session or GET to poll it." });
  } catch (e) {
    console.error("session failed:", e?.message || e);
    return send(500, { error: "SESSION_FAILED" });
  }
}
