/**
 * Temporary .hcmotion downloads. Files live in a private Vercel Blob store under files/ and die
 * after TTL: the download route refuses older ones and the daily cron deletes them.
 */
import { randomBytes } from "node:crypto";

export const TTL_MS = 24 * 60 * 60 * 1000;
export const PUBLIC_URL = process.env.PUBLIC_URL || "https://mcp.hypercodemotion.com";
export const STUDIO_URL = process.env.STUDIO_URL || "https://app.hypercodemotion.com";

/** Id = creation time (base36) + random part: the route knows the age without a lookup. */
export const newId = (now = Date.now()) => `${now.toString(36)}-${randomBytes(12).toString("base64url")}`;
export const validId = id => typeof id === "string" && /^[0-9a-z]{6,12}-[A-Za-z0-9_-]{16}$/.test(id);
export const createdAt = id => parseInt(id.split("-")[0], 36);
export const expired = (id, now = Date.now()) => now - createdAt(id) > TTL_MS;
export const pathOf = id => `files/${id}.hcmotion`;

let blob = null;
/** @vercel/blob, loaded only when a file is stored or served (tests inject their own store). */
export async function store() {
  if (!blob) {
    const b = await import("@vercel/blob");
    blob = {
      put: (path, bytes) => b.put(path, Buffer.from(bytes), { access: "private", contentType: "application/octet-stream", addRandomSuffix: false }),
      get: async path => {
        const r = await b.get(path, { access: "private" });
        return r && r.statusCode === 200 ? new Uint8Array(await new Response(r.stream).arrayBuffer()) : null;
      },
      list: async cursor => b.list({ prefix: "files/", cursor, limit: 1000 }),
      del: paths => b.del(paths)
    };
  }
  return blob;
}
export const setStore = s => { blob = s; };

/** Stores the file and returns its links. */
export async function saveFile(bytes, now = Date.now()) {
  const id = newId(now);
  await (await store()).put(pathOf(id), bytes);
  const download = `${PUBLIC_URL}/d/${id}`;
  return { id, download, open: `${STUDIO_URL}/?abrir=${encodeURIComponent(download)}`, expiresAt: new Date(createdAt(id) + TTL_MS).toISOString() };
}

/** Deletes every expired file (cron). Returns how many were removed. */
export async function sweep(now = Date.now()) {
  const s = await store();
  let cursor, n = 0;
  do {
    const page = await s.list(cursor);
    const old = page.blobs.map(b => b.pathname).filter(p => {
      const id = p.slice(6, -9);
      return !validId(id) || expired(id, now);
    });
    if (old.length) { await s.del(old); n += old.length; }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return n;
}
