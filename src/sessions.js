/**
 * Return channel MCP → Studio.
 *
 * The Studio opens a session before sending the user to Claude: it picks an unguessable code
 * (HCM-XXXX-XXXX-XXXX, ~60 bits) and a secret key (256 bits) that never leaves the browser; only
 * sha256(key) is stored here. Claude sees the code (it is in the prompt) and delivers the finished
 * .hcmotion with deliver_result (or create_hcmotion's `session`). Only the browser that holds the key
 * can collect the result, so knowing the code is not enough to read it. Sessions last 2 hours.
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { PUBLIC_URL, STUDIO_URL, createdAt, expired, store, validId } from "./files.js";

export const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const ALPHA = "[A-HJ-NP-Z2-9]";
const CODE = new RegExp(`^HCM-${ALPHA}{4}-${ALPHA}{4}-${ALPHA}{4}$`);
export const validCode = c => typeof c === "string" && CODE.test(c);
const validHash = h => typeof h === "string" && /^[0-9a-f]{64}$/.test(h);
export const hashKey = key => createHash("sha256").update(String(key)).digest("hex");
const pathOf = code => `sessions/${code}.json`;

async function read(code) {
  const bytes = await (await store()).get(pathOf(code)).catch(() => null);
  if (!bytes) return null;
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { return null; }
}
const write = async (code, s) => (await store()).put(pathOf(code), new TextEncoder().encode(JSON.stringify(s)));

/** Studio: opens a waiting session. Fails if the code is taken (the Studio then picks another). */
export async function openSession({ code, keyHash, tool } = {}, now = Date.now()) {
  if (!validCode(code)) return { ok: false, error: "BAD_CODE" };
  if (!validHash(keyHash)) return { ok: false, error: "BAD_KEY" };
  const old = await read(code);
  if (old && now < old.expiresAt) return { ok: false, error: "CODE_TAKEN" };
  const s = { keyHash, tool: typeof tool === "string" ? tool.slice(0, 64) : null, status: "waiting", createdAt: now, expiresAt: now + SESSION_TTL_MS };
  await write(code, s);
  return { ok: true, expiresAt: new Date(s.expiresAt).toISOString() };
}

/** The file id from a download link of this server (or the bare id). */
export function fileIdOf(download) {
  if (typeof download !== "string") return null;
  const s = download.trim();
  if (validId(s)) return s;
  const base = PUBLIC_URL.replace(/\/+$/, "");
  const m = s.startsWith(`${base}/d/`) ? s.slice(base.length + 3).split(/[/?#]/)[0] : null;
  return m && validId(m) ? m : null;
}

/** Claude: delivers a project made with create_hcmotion to the Studio waiting with this code. */
export async function deliverResult({ session_code, download } = {}, now = Date.now()) {
  if (!validCode(session_code)) return { delivered: false, error: "BAD_CODE", message: "session_code must look like HCM-XXXX-XXXX-XXXX, exactly as written in the user's request." };
  const id = fileIdOf(download);
  if (!id) return { delivered: false, error: "BAD_DOWNLOAD", message: `download must be the download link returned by create_hcmotion (${PUBLIC_URL}/d/…).` };
  if (expired(id, now)) return { delivered: false, error: "FILE_EXPIRED", message: "That project link expired. Call create_hcmotion again." };
  const s = await read(session_code);
  if (!s || now >= s.expiresAt) return { delivered: false, error: "NO_SESSION", message: "No Studio is waiting with that code (it may have expired after 2 hours). Give the user the open and download links instead." };
  await write(session_code, { ...s, status: "delivered", fileId: id, deliveredAt: now });
  return { delivered: true, message: "The project was sent to HyperCodeMotion Studio; it opens there by itself. Also give the user the open link in case the Studio tab was closed." };
}

/** Studio: polls with the secret key. Wrong key or unknown code look the same (not found). */
export async function pollSession(code, key, now = Date.now()) {
  if (!validCode(code) || typeof key !== "string" || key.length < 32) return { status: "not_found" };
  const s = await read(code);
  if (!s) return { status: "not_found" };
  const a = Buffer.from(hashKey(key), "hex"), b = Buffer.from(String(s.keyHash), "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { status: "not_found" };
  if (now >= s.expiresAt) return { status: "expired" };
  if (s.status !== "delivered" || !s.fileId) return { status: "waiting", expiresAt: new Date(s.expiresAt).toISOString() };
  return { status: "delivered", download: `${PUBLIC_URL}/d/${s.fileId}`, open: `${STUDIO_URL}/?p=${s.fileId}`, deliveredAt: new Date(s.deliveredAt).toISOString(), fileExpiresAt: new Date(createdAt(s.fileId) + 24 * 3600e3).toISOString() };
}

/** Cron: deletes expired sessions. */
export async function sweepSessions(now = Date.now()) {
  const s = await store();
  let cursor, n = 0;
  do {
    const page = await s.list(cursor, "sessions/");
    const old = [];
    for (const b of page.blobs) {
      if (!b.pathname.startsWith("sessions/")) continue;
      const v = await read(b.pathname.slice(9, -5));
      if (!v || now >= v.expiresAt) old.push(b.pathname);
    }
    if (old.length) { await s.del(old); n += old.length; }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return n;
}
