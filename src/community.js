/**
 * Community templates: a user gives Claude the link of a public motion video, Claude recreates it in the
 * user's own conversation and sends the result here. Nothing waits for a person: a proposal that passes
 * the automatic checks is stored, its preview videos are rendered by the Studio repo's GitHub Action and
 * it is published in the gallery marked «Community». The owner can retire any of them afterwards.
 *
 * Blob layout (private store, served by api/community.js):
 *   community/records/<id>.json          state of a template (status, code, source, card)
 *   community/codes/<code>.json          tracking code → template id
 *   community/templates/<id>/<variant>.json   the three compositions
 *   community/media/<id>/<id>-<ratio>.<mp4|jpg>   preview media uploaded by the render job
 *   community/index.json                 published templates, read by the gallery
 *   community/limits/<day>.json          proposals per caller per day
 */
import { createHash, randomBytes } from "node:crypto";
import { validateJson } from "./contract.js";
import { checkComposition } from "./hcmotion.js";
import { BRIEF, FORMATS, GROUPS } from "./brief.js";
import { PUBLIC_URL } from "./files.js";

export const SOURCES = {
  "prompt-motion.com": { name: "Prompt Motion", path: /^\/([a-z0-9][a-z0-9_-]{2,80})\/?$/, prefix: "pm" },
  "oneshotted.io": { name: "Oneshotted", path: /^\/v\/([a-z0-9][a-z0-9-]{2,120})\/?$/, prefix: "os" }
};
export const MAX_PER_DAY = 5;
export const MAX_GLOBAL_PER_DAY = 100;
const MAX_DURATION = 45;
const MAX_COMPOSITION_BYTES = 1.2 * 1024 * 1024;
const RATIOS = ["1-1", "3-4", "4-3", "9-16", "16-9"];
export const MEDIA_FILES = RATIOS.flatMap(r => [`${r}.mp4`, `${r}.jpg`]);

let blob = null;
/** @vercel/blob, loaded only when needed (tests inject their own store). */
export async function store() {
  if (!blob) {
    const b = await import("@vercel/blob");
    blob = {
      put: (path, data, type) => b.put(path, typeof data === "string" ? data : Buffer.from(data), { access: "private", contentType: type, addRandomSuffix: false, allowOverwrite: true }),
      get: async path => {
        const r = await b.get(path, { access: "private" }).catch(e => { if (e?.name === "BlobNotFoundError") return null; throw e; });
        return r && r.statusCode === 200 ? new Uint8Array(await new Response(r.stream).arrayBuffer()) : null;
      },
      list: async (prefix, cursor) => b.list({ prefix, cursor, limit: 1000 }),
      del: paths => b.del(paths)
    };
  }
  return blob;
}
export const setStore = s => { blob = s; };
const getJson = async path => { const b = await (await store()).get(path); return b ? JSON.parse(Buffer.from(b).toString()) : null; };
const putJson = async (path, value) => (await store()).put(path, JSON.stringify(value), "application/json");

/** The source page of a link, or why it is not accepted. */
export function parseSource(url) {
  let u;
  try { u = new URL(String(url ?? "").trim()); } catch { return { error: "url must be the full link of the video's page, such as https://prompt-motion.com/<id>." }; }
  const host = u.hostname.replace(/^www\./, "");
  const src = SOURCES[host];
  if (u.protocol !== "https:" || !src) return { error: `Only video pages from ${Object.keys(SOURCES).join(" and ")} are accepted.` };
  const m = u.pathname.toLowerCase().match(src.path);
  if (!m) return { error: `That is not a video page of ${host}. Send the link of the page that shows one video.` };
  const slug = m[1];
  const short = slug.length <= 50 ? slug : `${slug.slice(0, 43).replace(/-+$/, "")}-${createHash("sha256").update(slug).digest("hex").slice(0, 6)}`;
  return { host, slug, site: src.name, page: `https://${host}`, url: `https://${host}${src.prefix === "os" ? "/v/" : "/"}${slug}`, id: `c-${src.prefix}-${short}` };
}

const text = s => s.replace(/<[^>]+>/g, "").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();

/** Title, author, video and prompt read from the source page (best effort: missing fields stay null). */
export async function readSource(src, fetcher = fetch) {
  const out = { title: null, author: null, authorUrl: null, video: null, prompt: null, promptComplete: false };
  let html = "";
  try {
    const r = await fetcher(src.url, { signal: AbortSignal.timeout(8000), headers: { accept: "text/html" } });
    if (!r.ok) return { ...out, error: `The page answered ${r.status}.` };
    html = (await r.text()).slice(0, 3_000_000);
  } catch { return { ...out, error: "The page could not be read." }; }
  if (src.host === "prompt-motion.com") {
    const ld = html.match(/"creator":\{"@type":"Person","name":"([^"]*)","url":"([^"]*)"/);
    if (ld) { out.author = ld[1]; out.authorUrl = ld[2]; }
    out.title = (html.match(/<title>(.*?) · Prompt Motion<\/title>/) || [])[1] ?? null;
    out.video = (html.match(/"contentUrl":"(https:\/\/media\.prompt-motion\.com\/[^"]+\.mp4)"/) || [])[1] ?? null;
    const p = html.match(/<div id="entry-prompt"[^>]*>([\s\S]*?)<\/div>/);
    if (p) { out.prompt = text(p[1]); out.promptComplete = true; }
  } else {
    const data = html.match(/<script data-page="app" type="application\/json">([\s\S]*?)<\/script>/);
    try {
      const props = JSON.parse(data[1]).props;
      const l = props.listing || {};
      out.title = l.title ?? null;
      out.author = l.creatorName || l.creatorLabel || null;
      out.authorUrl = l.creatorHandle ? `https://x.com/${l.creatorHandle}` : null;
      out.video = l.videoUrl ?? null;
      const first = (props.prompts || [])[0];
      if (first?.teaser) out.prompt = first.teaser;
    } catch { /* page layout changed: Claude reads the page itself */ }
  }
  if (out.title) out.title = text(out.title);
  return out;
}

const publicRecord = r => r && { template: r.id, code: r.code, status: r.status, reason: r.reason ?? null, name: r.card?.name ?? null, source: r.source.url, published: r.status === "published" };

/** get_recreation_brief */
export async function getRecreationBrief(args, fetcher = fetch) {
  const src = parseSource(args.url);
  if (src.error) return { ok: false, error: src.error };
  const existing = await getJson(`community/records/${src.id}.json`);
  if (existing && existing.status !== "failed") return { ok: true, alreadyExists: true, ...publicRecord(existing), message: "This video is already a Community template (or being rendered). Do not recreate it: give the user this status." };
  const page = await readSource(src, fetcher);
  return {
    ok: true, alreadyExists: false, template: src.id,
    source: { site: src.site, page: src.page, id: src.slug, url: src.url, title: page.title, author: page.author, authorUrl: page.authorUrl, video: page.video },
    prompt: page.prompt, promptComplete: page.promptComplete,
    note: page.prompt ? (page.promptComplete ? "prompt is the full prompt published with the video." : "prompt is only the start of the original prompt; read the page for the rest.") : "The page's prompt could not be read here; open the page to read it.",
    formats: FORMATS, groups: GROUPS, maxDuration: MAX_DURATION, brief: BRIEF
  };
}

const day = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
const callerKey = caller => createHash("sha256").update(`${process.env.COMMUNITY_SALT || "hcm-community"}:${caller || "anon"}`).digest("hex").slice(0, 16);

/** Daily cron: the per-caller counters only matter for their own day. */
export async function sweepLimits(now = Date.now()) {
  const s = await store(), today = `community/limits/${day(now)}.json`;
  const page = await s.list("community/limits/");
  const old = page.blobs.map(b => b.pathname).filter(p => p !== today);
  if (old.length) await s.del(old);
  return old.length;
}

function checkCard(card, duration) {
  const errors = [], add = (path, message) => errors.push({ path, code: "INVALID_CARD", message });
  const str = (v, max) => typeof v === "string" && v.trim().length > 0 && v.trim().length <= max;
  if (!card || typeof card !== "object") return [{ path: "$.card", code: "INVALID_CARD", message: "card is required: name, description, chips, group, moments." }];
  if (!str(card.name, 40)) add("$.card.name", "1 to 40 characters.");
  if (!str(card.description, 160)) add("$.card.description", "One line, 1 to 160 characters.");
  if (!Array.isArray(card.chips) || card.chips.length < 1 || card.chips.length > 3 || !card.chips.every(c => str(c, 24))) add("$.card.chips", "1 to 3 short labels (≤ 24 characters).");
  if (!GROUPS.includes(card.group)) add("$.card.group", `One of ${GROUPS.join(", ")}.`);
  const m = card.moments;
  if (!Array.isArray(m) || m.length < 1 || m.length > 16 || !m.every(x => Array.isArray(x) && str(x[0], 30) && Number.isFinite(x[1]) && Number.isFinite(x[2]) && x[1] >= 0 && x[2] > x[1] && x[2] <= duration + 0.01)) add("$.card.moments", `1 to 16 moments as [name, start, end] in seconds within 0–${duration} s.`);
  return errors;
}

/** The three compositions: valid, in their format, short enough and carrying the HyperCodeMotion signature. */
function checkCompositions(compositions) {
  const errors = [];
  if (!compositions || typeof compositions !== "object") return { errors: [{ path: "$.compositions", code: "MISSING", message: "compositions must hold cuadrado, vertical and horizontal." }] };
  const out = {};
  for (const f of FORMATS) {
    const p = `$.compositions.${f.variant}`;
    let c = compositions[f.variant];
    if (typeof c === "string") { try { c = JSON.parse(c); } catch { errors.push({ path: p, code: "INVALID_JSON", message: "Does not parse." }); continue; } }
    if (!c || typeof c !== "object") { errors.push({ path: p, code: "MISSING", message: `The ${f.variant} composition (${f.width}×${f.height}) is missing.` }); continue; }
    const raw = JSON.stringify(c);
    if (raw.length > MAX_COMPOSITION_BYTES) { errors.push({ path: p, code: "TOO_LARGE", message: "Larger than 1.2 MB: simplify it." }); continue; }
    const report = validateJson(c);
    if (report.format !== "composition") { errors.push({ path: p, code: "NOT_A_COMPOSITION", message: "Needs a full composition (version, width, height, fps, duration, layers)." }); continue; }
    errors.push(...[...report.errors, ...checkComposition(c)].map(e => ({ ...e, path: p + e.path.slice(1) })));
    if (c.width !== f.width || c.height !== f.height) errors.push({ path: p, code: "WRONG_SIZE", message: `Must be ${f.width}×${f.height}.` });
    if (c.duration > MAX_DURATION) errors.push({ path: p + ".duration", code: "TOO_LONG", message: `At most ${MAX_DURATION} s.` });
    if (!/HyperCodeMotion/.test(raw)) errors.push({ path: p, code: "NO_SIGNATURE", message: "The hero or signature must be HyperCodeMotion (see the brief)." });
    out[f.variant] = c;
  }
  return { errors, compositions: out };
}

/** propose_template */
export async function proposeTemplate(args, { caller, now = Date.now(), dispatch = dispatchRender, fetcher = fetch } = {}) {
  const src = parseSource(args.url);
  if (src.error) return { accepted: false, errors: [{ path: "$.url", code: "SOURCE_NOT_ACCEPTED", message: src.error }] };
  const existing = await getJson(`community/records/${src.id}.json`);
  if (existing && existing.status !== "failed") return { accepted: false, duplicate: true, ...publicRecord(existing), errors: [{ path: "$.url", code: "ALREADY_EXISTS", message: "This video is already a Community template; give the user this code." }] };
  const { errors, compositions } = checkCompositions(args.compositions);
  const duration = compositions.horizontal?.duration ?? compositions.cuadrado?.duration ?? MAX_DURATION;
  errors.push(...checkCard(args.card, duration));
  if (errors.length) return { accepted: false, errors };

  const limitsPath = `community/limits/${day(now)}.json`;
  const limits = (await getJson(limitsPath)) || { total: 0, by: {} };
  const who = callerKey(caller);
  if ((limits.by[who] || 0) >= MAX_PER_DAY) return { accepted: false, errors: [{ path: "$", code: "DAILY_LIMIT", message: `At most ${MAX_PER_DAY} proposals a day from the same place. Try again tomorrow.` }] };
  if (limits.total >= MAX_GLOBAL_PER_DAY) return { accepted: false, errors: [{ path: "$", code: "DAILY_LIMIT", message: "The gallery took all the proposals it can render today. Try again tomorrow." }] };
  limits.total++; limits.by[who] = (limits.by[who] || 0) + 1;
  await putJson(limitsPath, limits);

  const card = { name: args.card.name.trim(), description: args.card.description.trim(), chips: args.card.chips.map(c => c.trim()), group: args.card.group, moments: args.card.moments.map(([n, a, b]) => [n.trim(), a, b]), duration };
  const page = await readSource(src, fetcher).catch(() => ({}));
  const record = {
    id: src.id, code: existing?.code ?? `${now.toString(36)}${randomBytes(4).toString("hex")}`, status: "rendering", created: new Date(now).toISOString(),
    source: { site: src.site, page: src.page, id: src.slug, url: src.url, title: page.title ?? null, author: page.author ?? null, authorUrl: page.authorUrl ?? null },
    card
  };
  for (const f of FORMATS) {
    const c = { ...compositions[f.variant], name: `${card.name} (${f.variant})`, community: { template: src.id, source: record.source.url } };
    await putJson(`community/templates/${src.id}/${f.variant}.json`, c);
  }
  await putJson(`community/codes/${record.code}.json`, { id: src.id });
  await putJson(`community/records/${src.id}.json`, record);
  const sent = await dispatch(src.id).catch(() => false);
  return { accepted: true, ...publicRecord(record), errors: [], message: sent ? "Accepted. Its preview videos are being rendered; then it appears in the Studio gallery marked «Community»." : "Accepted. It appears in the Studio gallery marked «Community» as soon as its preview videos are rendered." };
}

/** get_proposal_status */
export async function getProposalStatus(args) {
  const code = String(args.code ?? "").trim().toLowerCase();
  if (!/^[0-9a-z]{6,12}[0-9a-f]{8}$/.test(code)) return { found: false, error: "code must be the tracking code propose_template returned." };
  const ref = await getJson(`community/codes/${code}.json`);
  const r = ref && await getJson(`community/records/${ref.id}.json`);
  if (!r) return { found: false, error: "No proposal with that code." };
  return { found: true, ...publicRecord(r), studio: r.status === "published" ? "https://app.hypercodemotion.com (Explorar animaciones, card marked «Community»)" : null };
}

/** Asks the Studio repo's render workflow to make the preview videos. Needs GITHUB_DISPATCH_TOKEN. */
export async function dispatchRender(id, fetcher = fetch) {
  const token = process.env.GITHUB_DISPATCH_TOKEN, repo = process.env.RENDER_REPO || "jasp402/HyperCodeMotion";
  if (!token) return false;
  const r = await fetcher(`https://api.github.com/repos/${repo}/dispatches`, {
    method: "POST", headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json", "user-agent": "hypercodemotion-mcp" },
    body: JSON.stringify({ event_type: "community-render", client_payload: { id, mcp: PUBLIC_URL } })
  });
  return r.status === 204;
}

const entry = r => ({
  id: r.id, name: r.card.name, hint: `${r.card.description} · ${Math.round(r.card.duration * 10) / 10} s`, group: [r.card.group], chips: r.card.chips,
  duration: r.card.duration, moments: r.card.moments, media: `${PUBLIC_URL}/c/${r.id}/${r.id}`,
  info: { pagina: r.source.page, fuente: r.source.url.slice(r.source.page.length + 1), titulo: r.source.title, autor: r.source.author, autorUrl: r.source.authorUrl }, published: r.published
});

/** Render job: one preview file at a time. */
export async function putMedia(id, file, bytes) {
  if (!MEDIA_FILES.includes(file)) return { ok: false, error: `file must be one of ${MEDIA_FILES.join(", ")}.` };
  const r = await getJson(`community/records/${id}.json`);
  if (!r) return { ok: false, error: "Unknown template." };
  await (await store()).put(`community/media/${id}/${id}-${file}`, bytes, file.endsWith(".mp4") ? "video/mp4" : "image/jpeg");
  return { ok: true };
}

/** Render job finished (ok) or failed (reason): publish it or tell the user why not. */
export async function finishRender(id, { ok, reason }, now = Date.now()) {
  const r = await getJson(`community/records/${id}.json`);
  if (!r) return { ok: false, error: "Unknown template." };
  if (r.status === "retired") return { ok: false, error: "Retired." };
  if (ok) Object.assign(r, { status: "published", published: new Date(now).toISOString(), reason: null });
  else Object.assign(r, { status: "failed", reason: String(reason || "The preview could not be rendered.").slice(0, 300) });
  await putJson(`community/records/${id}.json`, r);
  await updateIndex(r);
  return { ok: true, status: r.status };
}

/** Owner: takes a template out of the gallery (its record stays, so the same video is not proposed again). */
export async function retire(id, reason = "Retired by HyperCodeMotion.") {
  const r = await getJson(`community/records/${id}.json`);
  if (!r) return { ok: false, error: "Unknown template." };
  Object.assign(r, { status: "retired", reason });
  await putJson(`community/records/${id}.json`, r);
  await updateIndex(r);
  return { ok: true, status: r.status };
}

async function updateIndex(r) {
  const list = ((await getJson("community/index.json")) || []).filter(e => e.id !== r.id);
  if (r.status === "published") list.push(entry(r));
  await putJson("community/index.json", list);
}
export const readIndex = async () => (await getJson("community/index.json")) || [];

/** A published template's composition (get_template and the Studio read it). */
export async function readTemplate(id, variant) {
  if (!/^c-[a-z0-9-]{3,62}$/.test(id) || !FORMATS.some(f => f.variant === variant)) return null;
  const r = await getJson(`community/records/${id}.json`);
  if (!r || (r.status !== "published" && r.status !== "rendering")) return null;
  return getJson(`community/templates/${id}/${variant}.json`);
}
export async function readMedia(id, file) {
  if (!/^c-[a-z0-9-]{3,62}$/.test(id) || !MEDIA_FILES.includes(file)) return null;
  return (await store()).get(`community/media/${id}/${id}-${file}`);
}
