import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { verifyActions, resetJwks, ISSUER, AUDIENCE } from "../src/oidc.js";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Date.now();
const claims = (extra = {}) => ({ iss: ISSUER, aud: AUDIENCE, exp: Math.floor(now / 1000) + 300, nbf: Math.floor(now / 1000) - 5, repository: "jasp402/HyperCodeMotion", workflow_ref: "jasp402/HyperCodeMotion/.github/workflows/community-render.yml@refs/heads/main", ...extra });
const token = (c, kid = "k1", key = privateKey) => { const h = b64({ alg: "RS256", kid, typ: "JWT" }), p = b64(c); return `${h}.${p}.${sign("RSA-SHA256", Buffer.from(`${h}.${p}`), key).toString("base64url")}`; };
let calls = 0;
const fetcher = async url => { calls++; assert.equal(url, `${ISSUER}/.well-known/jwks`); return { ok: true, json: async () => ({ keys: [jwk] }) }; };

test("a token of the render workflow is accepted", async () => {
  resetJwks(); calls = 0;
  const c = await verifyActions(token(claims()), { fetcher, now });
  assert.equal(c.repository, "jasp402/HyperCodeMotion");
  await verifyActions(token(claims()), { fetcher, now });
  assert.equal(calls, 1, "GitHub's keys are cached");
});
test("anything else is refused", async () => {
  resetJwks();
  const other = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey;
  const bad = [
    token(claims(), "k1", other),
    token(claims({ aud: "someone-else" })),
    token(claims({ iss: "https://evil.example" })),
    token(claims({ exp: Math.floor(now / 1000) - 1 })),
    token(claims({ repository: "evil/HyperCodeMotion" })),
    token(claims({ workflow_ref: "jasp402/HyperCodeMotion/.github/workflows/ci.yml@refs/heads/main" })),
    token(claims(), "unknown"),
    "not.a.token", "", undefined
  ];
  for (const t of bad) assert.equal(await verifyActions(t, { fetcher, now }), null);
});
