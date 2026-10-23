/**
 * Official gallery templates made from public motion videos. A HyperCodeMotion moderator gives Claude the
 * link of a video and their moderator code; Claude recreates it in the moderator's own conversation and sends
 * the result here. Only moderator codes are accepted, and nothing is published without being compared with
 * the original:
 *   1. get_recreation_brief: the Studio repo's GitHub Action downloads the video and extracts reference
 *      frames, which Claude sees before building anything.
 *   2. propose_template: the same Action renders the recreation with the real Studio engine and builds a
 *      side-by-side sheet and comparacion.mp4 (original | recreation). Claude fixes what differs and sends
 *      it again with the same code, up to MAX_ROUNDS comparisons.
 *   3. publish_template: once Claude judges the comparison faithful, the Studio repo's workflow renders the
 *      gallery media, commits the template to the Studio code (its own files only: plantillas/<slug>…,
 *      bienvenida/ejemplos/<slug>…) on a branch plantilla/<slug> and opens a pull request against
 *      TEMPLATE_BRANCH. Each template is its own PR with its own preview, so a moderator approves or
 *      discards it without touching the others.
 *
 * Blob layout (private store, served by api/community.js):
 *   community/refs/<id>/meta.json        reference of the source video (status, duration, size, frame times)
 *   community/refs/<id>/<sheet>.jpg      reference frame sheets (general, inicio)
 *   community/refs/<id>/video/<n>        the original in parts, when the caller's Claude had to send it
 *   community/compare/<id>/<file>        latest comparison (sheet.jpg, comparacion.mp4)
 *   community/records/<id>.json          state of a template (status, code, source, card, comparison)
 *   community/codes/<code>.json          tracking code → template id
 *   community/templates/<id>/<variant>.json   the three compositions
 *   community/media/<id>/<id>-<ratio>.<mp4|jpg>   preview media uploaded by the render job
 *   community/index.json                 Community templates published before official ones replaced them
 *   community/limits/<day>.json          proposals per moderator per day
 *
 * Moderator codes: TEMPLATE_ADMIN_CODES (or COMMUNITY_ADMIN_SECRET) holds one code or a list
 * "name:code, name:code"; the name is recorded with each template.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { validateJson } from "./contract.js";
import { checkComposition } from "./hcmotion.js";
import { BRIEF, FORMATS, GROUPS } from "./brief.js";
import { PUBLIC_URL, STUDIO_URL } from "./files.js";

export const SOURCES = {
  "prompt-motion.com": { name: "Prompt Motion", path: /^\/([a-z0-9][a-z0-9_-]{2,80})\/?$/, prefix: "pm", videoHost: "media.prompt-motion.com", video: /^https:\/\/media\.prompt-motion\.com\/[^\s"']+\.mp4$/,
    // its videos answer 403 to every server (Vercel, GitHub), so the caller's Claude downloads it and sends it here
    callerSends: true },
  "oneshotted.io": { name: "Oneshotted", path: /^\/v\/([a-z0-9][a-z0-9-]{2,120})\/?$/, prefix: "os", videoHost: "r2.oneshotted.io", video: /^https:\/\/r2\.oneshotted\.io\/[^\s"']+\.mp4$/ }
};
export const MAX_PER_DAY = 20;
export const MAX_GLOBAL_PER_DAY = 100;
/** Branch of the Studio repo that receives published templates. */
export const TEMPLATE_BRANCH = () => process.env.TEMPLATE_BRANCH || "template";
/** Comparisons a proposal may use before it has to be published or dropped. */
export const MAX_ROUNDS = 3;
const MAX_SUBMISSIONS = MAX_ROUNDS * 2;
const STALE_MS = 24 * 3600e3;      // a proposal left unpublished this long frees its video for someone else
const RETRY_MS = 15 * 60e3;        // a reference job that did not answer in this time is started again
const WAIT_MS = 40e3;              // tools wait this long for a running job before answering
const UPLOAD_MS = 60 * 60e3;       // an upload not finished in this time is started again with a new key
export const PART_BYTES = 3_000_000; // the original is sent in parts that fit a function's request body
export const MAX_PARTS = 20;
export const REF_FILES = ["general.jpg", "inicio.jpg"];
export const COMPARE_FILES = ["sheet.jpg", "comparacion.mp4"];
const MAX_DURATION = 45;
const MAX_COMPOSITION_BYTES = 1.2 * 1024 * 1024;
const RATIOS = ["1-1", "3-4", "4-3", "9-16", "16-9"];
export const MEDIA_FILES = RATIOS.flatMap(r => [`${r}.mp4`, `${r}.jpg`]);

const equalText = (a, b) => typeof a === "string" && typeof b === "string" && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
/** Moderators allowed to publish: one code, or a list "name:code" separated by commas, semicolons or lines. */
export function moderators(env = process.env.TEMPLATE_ADMIN_CODES || process.env.COMMUNITY_ADMIN_SECRET || "") {
  return String(env).split(/[,;\n]/).map(x => x.trim()).filter(Boolean)
    .map((x, i) => { const k = x.lastIndexOf(":"); return k > 0 ? { name: x.slice(0, k).trim(), code: x.slice(k + 1).trim() } : { name: i ? `moderador ${i + 1}` : "admin", code: x }; })
    .filter(m => m.name && m.code.length >= 6);
}
/** Name of the moderator a code belongs to, or null. */
export function moderatorOf(code) {
  const c = typeof code === "string" ? code.trim() : "";
  if (!c) return null;
  let who = null;
  for (const m of moderators()) if (equalText(m.code, c)) who = m.name;
  return who;
}
const NEEDS_CODE = "Only HyperCodeMotion moderators can turn a video into a gallery template. Ask the user for their moderator code (it is never shown back) and call again with url and adminCode.";

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
  if (!out.video) out.error = `The page gave no video (${html.length} bytes${/cf-chl|challenge-platform|Just a moment/.test(html) ? ", a bot check" : ""}).`;
  return out;
}

const iso = t => new Date(t).toISOString();
const sleep = ms => new Promise(r => setTimeout(r, ms));
/** Re-reads `path` until `done` holds or `wait` ms pass. */
async function waitFor(path, value, done, wait) {
  for (const end = Date.now() + wait; !done(value) && Date.now() < end;) { await sleep(Math.min(3000, wait)); value = await getJson(path); }
  return value;
}
const jpg = async path => { const b = await (await store()).get(path); return b ? Buffer.from(b).toString("base64") : null; };
/** The composition whose format is closest to the original's: the one that must look most like it. */
export const closestVariant = (w, h) => (w / h > 1.2 ? "horizontal" : w / h < 0.8 ? "vertical" : "cuadrado");

const publicRecord = r => r && { template: r.official?.slug ?? r.id, code: r.code, status: r.status, reason: r.reason ?? null, name: r.card?.name ?? null, source: r.source.url, published: r.status === "published", ...(r.official ? { official: { slug: r.official.slug, branch: r.official.branch, commit: r.official.commit ?? null, pr: r.official.pr ?? null } } : {}) };
const live = (r, now) => ["comparing", "review"].includes(r.status) && now - Date.parse(r.updated || r.created) < STALE_MS;
/** A record that keeps its video from being proposed again by someone else. */
const holds = (r, now) => r && r.status !== "failed" && (!["comparing", "review"].includes(r.status) || live(r, now));

const refPath = (id, f = "meta.json") => `community/refs/${id}/${f}`;
/** The source video's reference frames: extracted once per video by the render workflow. */
async function reference(src, info, { now, dispatch, wait }) {
  let meta = await getJson(refPath(src.id));
  // a job that could not be started is tried again at once; one that started gets RETRY_MS to answer
  const stuck = m => m && m.status !== "ready" && (m.status === "upload" ? now - Date.parse(m.requested) > UPLOAD_MS : m.notSent || now - Date.parse(m.requested) > RETRY_MS);
  if (!meta || stuck(meta)) {
    // a source that refuses servers gets its video from the moderator (upload page), so its address is optional
    if (!info.video && !SOURCES[src.host].callerSends) return { status: "missing" };
    meta = { status: "preparing", video: info.video || null, requested: iso(now), info: { title: info.title, author: info.author, authorUrl: info.authorUrl } };
    if (SOURCES[src.host].callerSends) {
      meta = { ...meta, status: "upload", key: randomBytes(16).toString("hex") };
      await putJson(refPath(src.id), meta);
      return meta;
    }
    await putJson(refPath(src.id), meta);
    if (!(await dispatch("reference", src.id, { video: info.video }).catch(() => false))) {
      meta = { ...meta, status: "failed", notSent: true, reason: "The video could not be sent to be read right now; try again later." };
      await putJson(refPath(src.id), meta);
    }
  }
  return waitFor(refPath(src.id), meta, m => m.status !== "preparing", wait);
}

const clip = (v, max) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
/** What the caller's Claude read on the source page itself. */
function fromCaller(args, src) {
  const video = clip(args.video, 500), authorUrl = clip(args.authorUrl, 300);
  return {
    video: video && SOURCES[src.host].video.test(video) ? video : null, badVideo: !!video && !SOURCES[src.host].video.test(video),
    prompt: clip(args.prompt, 20000), title: clip(args.title, 200), author: clip(args.author, 80), authorUrl: authorUrl && /^https:\/\/[^\s"'<>]+$/.test(authorUrl) ? authorUrl : null
  };
}

/** get_recreation_brief */
export async function getRecreationBrief(args, { fetcher = fetch, dispatch = dispatchJob, now = Date.now(), wait = WAIT_MS } = {}) {
  const src = parseSource(args.url);
  if (src.error) return { ok: false, error: src.error };
  if (!moderatorOf(args.adminCode)) return { ok: false, needsCode: true, error: NEEDS_CODE };
  const existing = await getJson(`community/records/${src.id}.json`);
  if (holds(existing, now)) return { ok: true, alreadyExists: true, ...publicRecord(existing), message: "This video is already a gallery template (or one is being made from it). Do not recreate it: give the user this status." };
  const given = fromCaller(args, src);
  if (given.badVideo) return { ok: false, template: src.id, error: `video must be the address of the page's own video file (an .mp4 on ${SOURCES[src.host].videoHost}).` };
  // the source sites often refuse this server (bot checks): what the caller read on the page fills the gaps
  const page = await readSource(src, fetcher);
  const info = { video: page.video || given.video, prompt: page.prompt || given.prompt, promptComplete: page.prompt ? page.promptComplete : null, title: page.title || given.title, author: page.author || given.author, authorUrl: page.authorUrl || given.authorUrl };
  const ref = await reference(src, info, { now, dispatch, wait });
  if (ref.status === "missing") return { ok: false, template: src.id, needsPage: true, error: `This server could not read the page${page.error ? ` (${page.error})` : ""}. Open the page yourself, then call get_recreation_brief again with the url and what the page shows: video (the address of its .mp4 file, on ${SOURCES[src.host].videoHost}), prompt, title and author.` };
  if (ref.status === "failed") return { ok: false, template: src.id, error: `${ref.reason || "The video could not be read."} A template is only made when it can be compared with its original video, so this one cannot be recreated now.` };
  const out = {
    ok: true, alreadyExists: false, template: src.id,
    source: { site: src.site, page: src.page, id: src.slug, url: src.url, title: info.title, author: info.author, authorUrl: info.authorUrl, video: info.video || ref.video },
    prompt: info.prompt, promptComplete: info.promptComplete,
    note: info.prompt ? (info.promptComplete ? "prompt is the full prompt published with the video." : "prompt may be only part of the original prompt: the reference frames are what to follow.") : "The page's prompt is not known here: read it on the page; the reference frames are what to follow.",
    formats: FORMATS, groups: GROUPS, maxDuration: MAX_DURATION, brief: BRIEF
  };
  if (ref.status === "upload") {
    const send = `${PUBLIC_URL}/api/community?id=${src.id}&key=${ref.key}`;
    const page = `${PUBLIC_URL}/subir/${src.id}/${ref.key}`;
    if (!ref.video) return {
      ...out, reference: { status: "upload" }, upload: { page },
      message: `${src.site} does not let servers (or most AI sandboxes) download its videos. Give the user this link and nothing else to do: ${page} . They download the video from the page (${src.url}: right-click the video → «Save video as…»), open the link and drop the file there; the page sends it. Wait until they say it is done, then call get_recreation_brief again with the same url and adminCode. Do not guess the video's address.`
    };
    return {
      ...out, reference: { status: "upload" },
      upload: { page, video: ref.video, partBytes: PART_BYTES, maxParts: MAX_PARTS, part: `${send}&op=upload&part=<n>`, done: `${send}&op=upload-done&parts=<count>`,
        script: `set -e; curl -sfL "${ref.video}" -o original.mp4; split -b ${PART_BYTES} -d -a 2 original.mp4 part.; n=0; for f in part.*; do curl -sf -H "content-type: application/octet-stream" --data-binary @"$f" "${send}&op=upload&part=$n" >/dev/null; n=$((n+1)); done; curl -sf -X POST "${send}&op=upload-done&parts=$n"` },
      message: `${src.site} does not let servers download its videos, so you send it: run upload.script in your code or shell tool (it downloads the video and sends it here in parts; it needs network access to ${SOURCES[src.host].videoHost} and ${new URL(PUBLIC_URL).host}). Then call get_recreation_brief again with the same url. If your shell cannot reach those hosts, use a browser tool instead: open upload.video in it and, on that page, fetch it (same origin) and POST each part of up to partBytes bytes to upload.part with no content-type, then POST upload.done. If you have neither, or they fail, give the user upload.page: they download the video from the page, open that link and drop the file there; then call get_recreation_brief again.`
    };
  }
  if (ref.status !== "ready") return { ...out, reference: { status: "preparing" }, message: "The original video is being downloaded and its reference frames extracted (usually one or two minutes). Read the prompt meanwhile, then call get_recreation_brief again with the same url. Do not build anything before you have seen the frames." };
  const sheets = [];
  for (const f of REF_FILES) { const b = ref.sheets?.[f.slice(0, -4)] && await jpg(refPath(src.id, f)); if (b) sheets.push({ name: f.slice(0, -4), times: ref.sheets[f.slice(0, -4)], data: b }); }
  return {
    ...out,
    reference: { status: "ready", duration: ref.duration, width: ref.width, height: ref.height, mainFormat: closestVariant(ref.width, ref.height),
      sheets: sheets.map(s => ({ name: s.name, times: s.times })),
      how: "The attached images are frames of the original video, in order, each labelled with its time in seconds: «general» covers the whole video, «inicio» its first seconds at 4 frames a second. Take layout, sizes, timings, colors and texts from them." },
    _images: sheets.map(s => s.data)
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

const normCode = c => String(c ?? "").trim().toLowerCase();
const CODE = /^[0-9a-z]{6,12}[0-9a-f]{8}$/;

/** propose_template: a first proposal, or a revision of one (same code) after its comparison. */
export async function proposeTemplate(args, { now = Date.now(), dispatch = dispatchJob, fetcher = fetch } = {}) {
  const src = parseSource(args.url);
  if (src.error) return { accepted: false, errors: [{ path: "$.url", code: "SOURCE_NOT_ACCEPTED", message: src.error }] };
  const fail = (code, message, path = "$") => ({ accepted: false, errors: [{ path, code, message }] });
  const by = moderatorOf(args.adminCode);
  if (!by) return fail("MODERATOR_CODE", NEEDS_CODE, "$.adminCode");
  const existing = await getJson(`community/records/${src.id}.json`);
  const code = args.code == null ? "" : normCode(args.code);
  const revision = !!code && existing?.code === code;
  if (code && !revision) return fail("UNKNOWN_CODE", "No proposal of this video has that code. Leave code out for a first proposal.", "$.code");
  if (revision) {
    if (existing.status === "comparing") return fail("COMPARING", "Its comparison is still being rendered: call get_proposal_status with the code first.", "$.code");
    if (existing.status !== "review") return { ...fail("NOT_REVISABLE", `This proposal is ${existing.status}; it can no longer be changed.`, "$.code"), ...publicRecord(existing) };
    if (existing.compare.done >= MAX_ROUNDS || existing.compare.round >= MAX_SUBMISSIONS) return fail("ROUNDS_USED", `It already used its ${MAX_ROUNDS} comparisons: publish it with publish_template if it is faithful, or stop here.`, "$.code");
  } else if (holds(existing, now)) return { accepted: false, duplicate: true, ...publicRecord(existing), errors: [{ path: "$.url", code: "ALREADY_EXISTS", message: "This video is already a gallery template (or one is being made from it); give the user this status." }] };
  const ref = await getJson(refPath(src.id));
  if (ref?.status !== "ready") return fail("REFERENCE_NOT_READY", "Call get_recreation_brief with this url first and build from its reference frames.", "$.url");

  const { errors, compositions } = checkCompositions(args.compositions);
  const duration = compositions.horizontal?.duration ?? compositions.cuadrado?.duration ?? MAX_DURATION;
  errors.push(...checkCard(args.card, duration));
  if (errors.length) return { accepted: false, errors };

  if (!revision) {
    const limitsPath = `community/limits/${day(now)}.json`;
    const limits = (await getJson(limitsPath)) || { total: 0, by: {} };
    const who = callerKey(by);
    if ((limits.by[who] || 0) >= MAX_PER_DAY) return fail("DAILY_LIMIT", `At most ${MAX_PER_DAY} proposals a day per moderator. Try again tomorrow.`);
    if (limits.total >= MAX_GLOBAL_PER_DAY) return fail("DAILY_LIMIT", "The gallery took all the proposals it can render today. Try again tomorrow.");
    limits.total++; limits.by[who] = (limits.by[who] || 0) + 1;
    await putJson(limitsPath, limits);
  }

  const card = { name: args.card.name.trim(), description: args.card.description.trim(), chips: args.card.chips.map(c => c.trim()), group: args.card.group, moments: args.card.moments.map(([n, a, b]) => [n.trim(), a, b]), duration };
  const page = revision ? null : await readSource(src, fetcher).catch(() => ({}));
  const variant = closestVariant(ref.width, ref.height);
  const record = {
    id: src.id, code: revision ? existing.code : `${now.toString(36)}${randomBytes(4).toString("hex")}`, status: "comparing",
    created: revision ? existing.created : iso(now), updated: iso(now),
    source: revision ? existing.source : { site: src.site, page: src.page, id: src.slug, url: src.url, title: page.title ?? ref.info?.title ?? null, author: page.author ?? ref.info?.author ?? null, authorUrl: page.authorUrl ?? ref.info?.authorUrl ?? null },
    card, variant, reason: null, by: revision ? existing.by ?? by : by,
    compare: { round: revision ? existing.compare.round + 1 : 1, done: revision ? existing.compare.done : 0, ok: null, reason: null, times: null }
  };
  for (const f of FORMATS) {
    const c = { ...compositions[f.variant], name: `${card.name} (${f.variant})`, community: { template: src.id, source: record.source.url } };
    await putJson(`community/templates/${src.id}/${f.variant}.json`, c);
  }
  if (!revision) await putJson(`community/codes/${record.code}.json`, { id: src.id });
  const sent = await dispatch("compare", src.id, { variant, round: record.compare.round, video: ref.video, ...(ref.uploaded ? { upload: ref.uploaded } : {}) }).catch(() => false);
  if (!sent) Object.assign(record, { status: "review", compare: { ...record.compare, ok: false, reason: "The comparison could not be started right now: send it again later with the same code." } });
  await putJson(`community/records/${src.id}.json`, record);
  return {
    accepted: true, ...publicRecord(record), round: record.compare.round, errors: [],
    message: sent ? `Accepted for comparison: the ${variant} composition (the original's format) is being rendered with the Studio engine and compared with the original, frame by frame. Call get_proposal_status with the code until its status is review (each call waits up to about 40 s).` : record.compare.reason
  };
}

/** get_proposal_status: while a comparison renders it waits a little; in review it returns the comparison sheet. */
export async function getProposalStatus(args, { wait = WAIT_MS } = {}) {
  const code = normCode(args.code);
  if (!CODE.test(code)) return { found: false, error: "code must be the tracking code propose_template returned." };
  const ref = await getJson(`community/codes/${code}.json`);
  const path = ref && `community/records/${ref.id}.json`;
  let r = path && await getJson(path);
  if (!r || r.code !== code) return { found: false, error: "No proposal with that code." };
  r = await waitFor(path, r, x => x.status !== "comparing", wait);
  const out = { found: true, ...publicRecord(r), studio: r.status === "published" ? (r.official ? (r.official.pr ? `Pull request ${r.official.pr}: its preview shows the template in the gallery (Explorar animaciones: «${r.card?.name}»); merging it adds it to ${r.official.branch}.` : `Committed to ${r.official.branch}.`) : `${STUDIO_URL} (Explorar animaciones, card marked «Community»)`) : null };
  if (r.status === "comparing") return { ...out, message: "Its comparison is still being rendered: call get_proposal_status again." };
  if (r.status !== "review") return out;
  const left = Math.max(0, Math.min(MAX_ROUNDS - r.compare.done, MAX_SUBMISSIONS - r.compare.round));
  const compare = { round: r.compare.round, ok: r.compare.ok, reason: r.compare.reason, variant: r.variant, times: r.compare.times, revisionsLeft: left };
  if (!r.compare.ok) return { ...out, compare, message: `The comparison failed: ${r.compare.reason} Fix it and send the three compositions again with propose_template and this code.` };
  const sheet = await jpg(`community/compare/${r.id}/sheet.jpg`);
  return {
    ...out, compare: { ...compare, how: "In the attached sheet each pair is one moment: left the original, right your recreation rendered by the Studio engine (times given as [original, recreation] in seconds; the recreation's time is scaled to its duration)." },
    message: `Compare every pair: layout, sizes, positions, timing, colors, typefaces and texts. If something differs, fix it in all three compositions and call propose_template again with this code (${left} left). When it truly looks like the original, call publish_template with this code and notes on what is consciously different and why.`,
    _images: sheet ? [sheet] : []
  };
}

/** Gallery id of an official template, from its card name: "Cubo de fichas" → "cubo-de-fichas". */
export const slugOf = name => String(name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "") || "plantilla";
/** A slug no Studio template uses yet (official templates are files of the Studio: plantillas/<slug>-<variant>.json). */
export async function freeSlug(name, sourceSlug, fetcher = fetch, id = null) {
  const base = slugOf(name);
  // a slug held by another template's open pull request counts as taken too
  const held = async slug => { const c = await getJson(`community/slugs/${slug}.json`); return !!c && c.id !== id; };
  const taken = async slug => { if (await held(slug)) return true; try { const r = await fetcher(`${STUDIO_URL}/plantillas/${slug}-vertical.json`, { method: "HEAD", signal: AbortSignal.timeout(8000) }); return r.ok && !/text\/html/.test(r.headers?.get?.("content-type") || ""); } catch { return false; } };
  for (const slug of [base, `${base}-${String(sourceSlug).replace(/[^a-z0-9]/g, "").slice(-6)}`]) if (!(await taken(slug))) return slug;
  return `${base}-${randomBytes(3).toString("hex")}`;
}

/** publish_template: the comparison is faithful, so the Studio workflow renders its media and commits it to the Studio code. */
export async function publishTemplate(args, { now = Date.now(), dispatch = dispatchJob, fetcher = fetch } = {}) {
  const code = normCode(args.code), notes = typeof args.notes === "string" ? args.notes.trim() : "";
  const by = moderatorOf(args.adminCode);
  if (!by) return { accepted: false, error: NEEDS_CODE };
  if (!CODE.test(code)) return { accepted: false, error: "code must be the tracking code propose_template returned." };
  if (!notes || notes.length > 600) return { accepted: false, error: "notes is required: in up to 600 characters, what is consciously different from the original and why (or that nothing is)." };
  const ref = await getJson(`community/codes/${code}.json`);
  const path = ref && `community/records/${ref.id}.json`;
  const r = path && await getJson(path);
  if (!r || r.code !== code) return { accepted: false, error: "No proposal with that code." };
  if (r.status !== "review" || !r.compare?.ok) return { accepted: false, ...publicRecord(r), error: r.status === "comparing" ? "Its comparison is still being rendered: look at it with get_proposal_status first." : r.status === "review" ? "Its last comparison failed: fix it and send it again with propose_template first." : `This proposal is ${r.status}.` };
  const slug = r.official?.slug ?? await freeSlug(r.card.name, r.source.id, fetcher, r.id);
  await putJson(`community/slugs/${slug}.json`, { id: r.id });
  const branch = TEMPLATE_BRANCH();
  Object.assign(r, { status: "rendering", notes, updated: iso(now), official: { slug, branch, by } });
  await putJson(path, r);
  const sent = await dispatch("official", r.id, { slug, branch }).catch(() => false);
  if (!sent) {
    Object.assign(r, { status: "review", official: undefined, updated: iso(now) });
    await putJson(path, r);
    return { accepted: false, ...publicRecord(r), error: "The publishing job could not be started right now; call publish_template again later with the same code." };
  }
  return { accepted: true, ...publicRecord(r), message: `Publishing as the official template «${r.card.name}» (${slug}): its gallery videos are rendered (a few minutes) and a pull request is opened against ${branch} with its own preview. Call get_proposal_status with the code until it is published: it gives the pull request link, where the moderator approves or discards it.` };
}

/** Starts a job of the Studio repo's community workflow (reference, compare or render). Needs GITHUB_DISPATCH_TOKEN. */
export async function dispatchJob(kind, id, extra = {}, fetcher = fetch) {
  const token = process.env.GITHUB_DISPATCH_TOKEN, repo = process.env.RENDER_REPO || "jasp402/HyperCodeMotion";
  if (!token) return false;
  const r = await fetcher(`https://api.github.com/repos/${repo}/dispatches`, {
    method: "POST", headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json", "user-agent": "hypercodemotion-mcp" },
    body: JSON.stringify({ event_type: "community-render", client_payload: { kind, id, mcp: PUBLIC_URL, ...extra } })
  });
  // GitHub answers 204, or 200 with the run's details
  return r.ok;
}

const num = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
const times = (a, max) => Array.isArray(a) && a.length <= 40 && a.every(t => num(t, 0, max));

const sameKey = (a, b) => typeof a === "string" && typeof b === "string" && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
/** The caller's Claude sends the original, one part at a time. */
export async function putUpload(id, key, part, bytes) {
  const m = await getJson(refPath(id));
  if (m?.status !== "upload" || !sameKey(m.key, key)) return { ok: false, error: "No upload is waiting with that key: call get_recreation_brief again." };
  const n = Number(part);
  if (!Number.isInteger(n) || n < 0 || n >= MAX_PARTS) return { ok: false, error: `part must be 0 to ${MAX_PARTS - 1}.` };
  if (!bytes?.length || bytes.length > PART_BYTES) return { ok: false, error: `Each part must have 1 to ${PART_BYTES} bytes.` };
  if (n === 0 && Buffer.from(bytes.subarray(4, 8)).toString() !== "ftyp") return { ok: false, error: "That is not an .mp4 file." };
  await (await store()).put(refPath(id, `video/${n}`), bytes, "application/octet-stream");
  return { ok: true };
}
/** All parts sent: the reference job reads them back from here. */
export async function finishUpload(id, key, parts, { now = Date.now(), dispatch = dispatchJob } = {}) {
  const m = await getJson(refPath(id));
  if (m?.status !== "upload" || !sameKey(m.key, key)) return { ok: false, error: "No upload is waiting with that key: call get_recreation_brief again." };
  const count = Number(parts);
  if (!Number.isInteger(count) || count < 1 || count > MAX_PARTS) return { ok: false, error: `parts must be 1 to ${MAX_PARTS}.` };
  for (let i = 0; i < count; i++) if (!(await (await store()).get(refPath(id, `video/${i}`)))) return { ok: false, error: `Part ${i} is missing: send it again, then call this again.` };
  let next = { ...m, status: "preparing", key: null, uploaded: count, requested: iso(now) };
  await putJson(refPath(id), next);
  if (!(await dispatch("reference", id, { video: m.video, upload: count }).catch(() => false))) {
    next = { ...next, status: "failed", notSent: true, reason: "The video could not be sent to be read right now; try again later." };
    await putJson(refPath(id), next);
  }
  return { ok: next.status === "preparing", status: next.status, message: "Received. Call get_recreation_brief again with the same url to see the reference frames." };
}
/** Reference and compare jobs: a part of an original the caller sent. */
export async function readUpload(id, part) {
  if (!/^c-[a-z0-9-]{3,62}$/.test(id) || !/^\d{1,2}$/.test(String(part))) return null;
  return (await store()).get(refPath(id, `video/${Number(part)}`));
}

/** Reference job: one frame sheet at a time. */
export async function putRef(id, file, bytes) {
  if (!REF_FILES.includes(file)) return { ok: false, error: `file must be one of ${REF_FILES.join(", ")}.` };
  const m = await getJson(refPath(id));
  if (m?.status !== "preparing") return { ok: false, error: "No reference is being prepared." };
  await (await store()).put(refPath(id, file), bytes, "image/jpeg");
  return { ok: true };
}
/** Reference job finished: the video's size, duration and the times of each sheet's frames. */
export async function finishRef(id, { ok, reason, duration, width, height, sheets }) {
  const m = await getJson(refPath(id));
  if (m?.status !== "preparing") return { ok: false, error: "No reference is being prepared." };
  if (ok && !(num(duration, 0.5, 600) && num(width, 16, 8192) && num(height, 16, 8192) && sheets && times(sheets.general, duration) && (sheets.inicio == null || times(sheets.inicio, duration)))) return { ok: false, error: "duration, width, height and sheets.general are required." };
  const next = ok ? { ...m, status: "ready", duration, width, height, sheets: { general: sheets.general, ...(sheets.inicio ? { inicio: sheets.inicio } : {}) }, reason: null }
    : { ...m, status: "failed", reason: String(reason || "The video could not be read.").slice(0, 300) };
  await putJson(refPath(id), next);
  return { ok: true, status: next.status };
}

/** Compare job: the sheet and comparacion.mp4 of the round being compared. */
export async function putCompare(id, file, bytes) {
  if (!COMPARE_FILES.includes(file)) return { ok: false, error: `file must be one of ${COMPARE_FILES.join(", ")}.` };
  const r = await getJson(`community/records/${id}.json`);
  if (r?.status !== "comparing") return { ok: false, error: "Not being compared." };
  await (await store()).put(`community/compare/${id}/${file}`, bytes, file.endsWith(".mp4") ? "video/mp4" : "image/jpeg");
  return { ok: true };
}
/** Compare job finished: Claude reviews the result. A job of an older round is ignored. */
export async function finishCompare(id, { round, ok, reason, times: pairs }, now = Date.now()) {
  const r = await getJson(`community/records/${id}.json`);
  if (r?.status !== "comparing") return { ok: false, error: "Not being compared." };
  if (round !== r.compare.round) return { ok: false, error: "That round was replaced by a newer one." };
  const valid = Array.isArray(pairs) && pairs.length <= 40 && pairs.every(p => Array.isArray(p) && p.length === 2 && p.every(t => num(t, 0, 600)));
  if (ok && !valid) return { ok: false, error: "times must be the [original, recreation] pairs of the sheet." };
  r.status = "review"; r.updated = iso(now);
  r.compare = ok ? { ...r.compare, ok: true, reason: null, times: pairs, done: r.compare.done + 1 } : { ...r.compare, ok: false, reason: String(reason || "The recreation could not be rendered.").slice(0, 300), times: null };
  await putJson(`community/records/${id}.json`, r);
  return { ok: true, status: r.status };
}
/** Owner: the latest comparison of a template. */
export async function readCompare(id, file) {
  if (!/^c-[a-z0-9-]{3,62}$/.test(id) || !COMPARE_FILES.includes(file)) return null;
  return (await store()).get(`community/compare/${id}/${file}`);
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
export async function finishRender(id, { ok, reason, commit, pr }, now = Date.now()) {
  const r = await getJson(`community/records/${id}.json`);
  if (!r) return { ok: false, error: "Unknown template." };
  if (r.status !== "rendering") return { ok: false, error: `Not rendering (${r.status}).` };
  if (ok) Object.assign(r, { status: "published", published: new Date(now).toISOString(), reason: null });
  else Object.assign(r, { status: r.official ? "review" : "failed", reason: String(reason || "The preview could not be rendered.").slice(0, 300) });
  if (r.official && ok && typeof commit === "string" && /^[0-9a-f]{7,40}$/.test(commit)) r.official.commit = commit;
  if (r.official && ok && typeof pr === "string" && /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+$/.test(pr)) r.official.pr = pr;
  await putJson(`community/records/${id}.json`, r);
  // official templates live in the Studio code; the Community index only keeps the ones published before
  if (!r.official) await updateIndex(r);
  return { ok: true, status: r.status };
}

/** The publishing job: what it writes into the Studio code (card, source, notes, slug). */
export async function readRecord(id) {
  if (!/^c-[a-z0-9-]{3,62}$/.test(id)) return null;
  const r = await getJson(`community/records/${id}.json`);
  return r && r.official ? { id: r.id, card: r.card, source: r.source, notes: r.notes ?? "", official: r.official } : null;
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

/** A template's composition and status (get_template, the Studio and the render jobs read it). */
export async function readTemplateWithStatus(id, variant) {
  if (!/^c-[a-z0-9-]{3,62}$/.test(id) || !FORMATS.some(f => f.variant === variant)) return null;
  const r = await getJson(`community/records/${id}.json`);
  if (!r || !["comparing", "review", "rendering", "published"].includes(r.status)) return null;
  const composition = await getJson(`community/templates/${id}/${variant}.json`);
  return composition && { composition, status: r.status };
}
export const readTemplate = async (id, variant) => (await readTemplateWithStatus(id, variant))?.composition ?? null;
export async function readMedia(id, file) {
  if (!/^c-[a-z0-9-]{3,62}$/.test(id) || !MEDIA_FILES.includes(file)) return null;
  return (await store()).get(`community/media/${id}/${id}-${file}`);
}
