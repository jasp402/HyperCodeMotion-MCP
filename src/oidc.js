/**
 * The Studio repo's workflow proves who it is with GitHub's own OIDC token, so the render callbacks need no
 * shared secret: the job asks GitHub for a token with this audience, sends it as a bearer, and here it is
 * checked against GitHub's published keys (signature, issuer, audience, expiry, repository and workflow file).
 */
import { createPublicKey, verify } from "node:crypto";

export const ISSUER = "https://token.actions.githubusercontent.com";
export const AUDIENCE = "hypercodemotion-mcp";
const WORKFLOW = ".github/workflows/community-render.yml";
const repoOf = () => (process.env.RENDER_REPO || "jasp402/HyperCodeMotion").toLowerCase();

let cache = { at: 0, keys: [] };
async function jwks(fetcher, now, fresh) {
  if (fresh || !cache.keys.length || now - cache.at > 3600e3) {
    const r = await fetcher(`${ISSUER}/.well-known/jwks`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`jwks ${r.status}`);
    cache = { at: now, keys: (await r.json()).keys || [] };
  }
  return cache.keys;
}
export const resetJwks = () => { cache = { at: 0, keys: [] }; };

const part = s => JSON.parse(Buffer.from(s, "base64url").toString());

/** The token's claims when it is a valid token of the render workflow, else null. */
export async function verifyActions(token, { fetcher = fetch, now = Date.now() } = {}) {
  try {
    const [h, p, sig] = String(token || "").split(".");
    if (!h || !p || !sig) return null;
    const header = part(h), claims = part(p);
    if (header.alg !== "RS256" || typeof header.kid !== "string") return null;
    let jwk = (await jwks(fetcher, now)).find(k => k.kid === header.kid);
    if (!jwk) jwk = (await jwks(fetcher, now, true)).find(k => k.kid === header.kid);
    if (!jwk) return null;
    const ok = verify("RSA-SHA256", Buffer.from(`${h}.${p}`), createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(sig, "base64url"));
    if (!ok) return null;
    const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const t = now / 1000, repo = repoOf();
    if (claims.iss !== ISSUER || !aud.includes(AUDIENCE)) return null;
    if (!(claims.exp > t) || (claims.nbf && claims.nbf > t + 60)) return null;
    if (String(claims.repository || "").toLowerCase() !== repo) return null;
    if (!String(claims.workflow_ref || "").toLowerCase().startsWith(`${repo}/${WORKFLOW}@`)) return null;
    return claims;
  } catch {
    return null;
  }
}
