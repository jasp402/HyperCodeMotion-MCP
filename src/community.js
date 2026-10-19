/**
 * Community templates: a user gives Claude the link of a public motion video, Claude recreates it in the
 * user's own conversation and sends the result here. Nothing waits for a person, but nothing is published
 * without being compared with the original:
 *   1. get_recreation_brief: the Studio repo's GitHub Action downloads the video and extracts reference
 *      frames, which Claude sees before building anything.
 *   2. propose_template: the same Action renders the recreation with the real Studio engine and builds a
 *      side-by-side sheet and comparacion.mp4 (original | recreation). Claude fixes what differs and sends
 *      it again with the same code, up to MAX_ROUNDS comparisons.
 *   3. publish_template: once Claude judges the comparison faithful, the gallery media are rendered and the
 *      template is published marked «Community». The owner can retire any of them afterwards.
 *
 * Blob layout (private store, served by api/community.js):
 *   community/refs/<id>/meta.json        reference of the source video (status, duration, size, frame times)
 *   community/refs/<id>/<sheet>.jpg      reference frame sheets (general, inicio)
 *   community/compare/<id>/<file>        latest comparison (sheet.jpg, comparacion.mp4)
 *   community/records/<id>.json          state of a template (status, code, source, card, comparison)
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
  "prompt-motion.com": { name: "Prompt Motion", path: /^\/([a-z0-9][a-z0-9_-]{2,80})\/?$/, prefix: "pm", video: /^https:\/\/media\.prompt-motion\.com\/[^\s"']+\.mp4$/ },
  "oneshotted.io": { name: "Oneshotted", path: /^\/v\/([a-z0-9][a-z0-9-]{2,120})\/?$/, prefix: "os", video: /^https:\/\/r2\.oneshotted\.io\/[^\s"']+\.mp4$/ }
};
export const MAX_PER_DAY = 5;
export const MAX_GLOBAL_PER_DAY = 100;
/** Comparisons a proposal may use before it has to be published or dropped. */
export const MAX_ROUNDS = 3;
const MAX_SUBMISSIONS = MAX_ROUNDS * 2;
const STALE_MS = 24 * 3600e3;      // a proposal left unpublished this long frees its video for someone else
const RETRY_MS = 15 * 60e3;        // a reference job that did not answer in this time is started again
const WAIT_MS = 40e3;              // tools wait this long for a running job before answering
export const REF_FILES = ["general.jpg", "inicio.jpg"];
export const COMPARE_FILES = ["sheet.jpg", "comparacion.mp4"];
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

const publicRecord = r => r && { template: r.id, code: r.code, status: r.status, reason: r.reason ?? null, name: r.card?.name ?? null, source: r.source.url, published: r.status === "published" };
const live = (r, now) => ["comparing", "review"].includes(r.status) && now - Date.parse(r.updated || r.created) < STALE_MS;
/** A record that keeps its video from being proposed again by someone else. */
const holds = (r, now) => r && r.status !== "failed" && (!["comparing", "review"].includes(r.status) || live(r, now));

const refPath = (id, f = "meta.json") => `community/refs/${id}/${f}`;
/** The source video's reference frames: extracted once per video by the render workflow. */
async function reference(src, video, { now, dispatch, wait }) {
  let meta = await getJson(refPath(src.id));
  const stuck = m => m && m.status !== "ready" && now - Date.parse(m.requested) > RETRY_MS;
  if (!meta || stuck(meta)) {
    if (!video || !SOURCES[src.host].video.test(video)) return { status: "failed", reason: "The video of this page could not be found." };
    meta = { status: "preparing", video, requested: iso(now) };
    await putJson(refPath(src.id), meta);
    if (!(await dispatch("reference", src.id, { video }).catch(() => false))) {
      meta = { ...meta, status: "failed", reason: "The video could not be sent to be read right now; try again later." };
      await putJson(refPath(src.id), meta);
    }
  }
  return waitFor(refPath(src.id), meta, m => m.status !== "preparing", wait);
}

/** get_recreation_brief */
export async function getRecreationBrief(args, { fetcher = fetch, dispatch = dispatchJob, now = Date.now(), wait = WAIT_MS } = {}) {
  const src = parseSource(args.url);
  if (src.error) return { ok: false, error: src.error };
  const existing = await getJson(`community/records/${src.id}.json`);
  if (holds(existing, now)) return { ok: true, alreadyExists: true, ...publicRecord(existing), message: "This video is already a Community template (or one is being made from it). Do not recreate it: give the user this status." };
  const page = await readSource(src, fetcher);
  const ref = await reference(src, page.video, { now, dispatch, wait });
  if (ref.status === "failed") return { ok: false, template: src.id, error: `${ref.reason || "The video could not be read."}${page.error ? ` (${page.error})` : ""} A template is only made when it can be compared with its original video, so this one cannot be recreated now.` };
  const out = {
    ok: true, alreadyExists: false, template: src.id,
    source: { site: src.site, page: src.page, id: src.slug, url: src.url, title: page.title, author: page.author, authorUrl: page.authorUrl, video: page.video },
    prompt: page.prompt, promptComplete: page.promptComplete,
    note: page.prompt ? (page.promptComplete ? "prompt is the full prompt published with the video." : "prompt is only the start of the original prompt: the reference frames are what to follow.") : "The page's prompt could not be read here: the reference frames are what to follow.",
    formats: FORMATS, groups: GROUPS, maxDuration: MAX_DURATION, brief: BRIEF
  };
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
export async function proposeTemplate(args, { caller, now = Date.now(), dispatch = dispatchJob, fetcher = fetch } = {}) {
  const src = parseSource(args.url);
  if (src.error) return { accepted: false, errors: [{ path: "$.url", code: "SOURCE_NOT_ACCEPTED", message: src.error }] };
  const fail = (code, message, path = "$") => ({ accepted: false, errors: [{ path, code, message }] });
  const existing = await getJson(`community/records/${src.id}.json`);
  const code = args.code == null ? "" : normCode(args.code);
  const revision = !!code && existing?.code === code;
  if (code && !revision) return fail("UNKNOWN_CODE", "No proposal of this video has that code. Leave code out for a first proposal.", "$.code");
  if (revision) {
    if (existing.status === "comparing") return fail("COMPARING", "Its comparison is still being rendered: call get_proposal_status with the code first.", "$.code");
    if (existing.status !== "review") return { ...fail("NOT_REVISABLE", `This proposal is ${existing.status}; it can no longer be changed.`, "$.code"), ...publicRecord(existing) };
    if (existing.compare.done >= MAX_ROUNDS || existing.compare.round >= MAX_SUBMISSIONS) return fail("ROUNDS_USED", `It already used its ${MAX_ROUNDS} comparisons: publish it with publish_template if it is faithful, or stop here.`, "$.code");
  } else if (holds(existing, now)) return { accepted: false, duplicate: true, ...publicRecord(existing), errors: [{ path: "$.url", code: "ALREADY_EXISTS", message: "This video is already a Community template (or one is being made from it); give the user this status." }] };
  const ref = await getJson(refPath(src.id));
  if (ref?.status !== "ready") return fail("REFERENCE_NOT_READY", "Call get_recreation_brief with this url first and build from its reference frames.", "$.url");

  const { errors, compositions } = checkCompositions(args.compositions);
  const duration = compositions.horizontal?.duration ?? compositions.cuadrado?.duration ?? MAX_DURATION;
  errors.push(...checkCard(args.card, duration));
  if (errors.length) return { accepted: false, errors };

  if (!revision) {
    const limitsPath = `community/limits/${day(now)}.json`;
    const limits = (await getJson(limitsPath)) || { total: 0, by: {} };
    const who = callerKey(caller);
    if ((limits.by[who] || 0) >= MAX_PER_DAY) return fail("DAILY_LIMIT", `At most ${MAX_PER_DAY} proposals a day from the same place. Try again tomorrow.`);
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
    source: revision ? existing.source : { site: src.site, page: src.page, id: src.slug, url: src.url, title: page.title ?? null, author: page.author ?? null, authorUrl: page.authorUrl ?? null },
    card, variant, reason: null,
    compare: { round: revision ? existing.compare.round + 1 : 1, done: revision ? existing.compare.done : 0, ok: null, reason: null, times: null }
  };
  for (const f of FORMATS) {
    const c = { ...compositions[f.variant], name: `${card.name} (${f.variant})`, community: { template: src.id, source: record.source.url } };
    await putJson(`community/templates/${src.id}/${f.variant}.json`, c);
  }
  if (!revision) await putJson(`community/codes/${record.code}.json`, { id: src.id });
  const sent = await dispatch("compare", src.id, { variant, round: record.compare.round, video: ref.video }).catch(() => false);
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
  const out = { found: true, ...publicRecord(r), studio: r.status === "published" ? "https://app.hypercodemotion.com (Explorar animaciones, card marked «Community»)" : null };
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

/** publish_template: the comparison is faithful, so the gallery media are rendered and it is published. */
export async function publishTemplate(args, { now = Date.now(), dispatch = dispatchJob } = {}) {
  const code = normCode(args.code), notes = typeof args.notes === "string" ? args.notes.trim() : "";
  if (!CODE.test(code)) return { accepted: false, error: "code must be the tracking code propose_template returned." };
  if (!notes || notes.length > 600) return { accepted: false, error: "notes is required: in up to 600 characters, what is consciously different from the original and why (or that nothing is)." };
  const ref = await getJson(`community/codes/${code}.json`);
  const path = ref && `community/records/${ref.id}.json`;
  const r = path && await getJson(path);
  if (!r || r.code !== code) return { accepted: false, error: "No proposal with that code." };
  if (r.status !== "review" || !r.compare?.ok) return { accepted: false, ...publicRecord(r), error: r.status === "comparing" ? "Its comparison is still being rendered: look at it with get_proposal_status first." : r.status === "review" ? "Its last comparison failed: fix it and send it again with propose_template first." : `This proposal is ${r.status}.` };
  Object.assign(r, { status: "rendering", notes, updated: iso(now) });
  await putJson(path, r);
  const sent = await dispatch("render", r.id).catch(() => false);
  return { accepted: true, ...publicRecord(r), message: sent ? "Its gallery videos are being rendered; then it appears in the Studio gallery marked «Community». get_proposal_status tells when." : "It appears in the Studio gallery marked «Community» as soon as its gallery videos are rendered." };
}

/** Starts a job of the Studio repo's community workflow (reference, compare or render). Needs GITHUB_DISPATCH_TOKEN. */
export async function dispatchJob(kind, id, extra = {}, fetcher = fetch) {
  const token = process.env.GITHUB_DISPATCH_TOKEN, repo = process.env.RENDER_REPO || "jasp402/HyperCodeMotion";
  if (!token) return false;
  const r = await fetcher(`https://api.github.com/repos/${repo}/dispatches`, {
    method: "POST", headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json", "user-agent": "hypercodemotion-mcp" },
    body: JSON.stringify({ event_type: "community-render", client_payload: { kind, id, mcp: PUBLIC_URL, ...extra } })
  });
  return r.status === 204;
}

const num = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
const times = (a, max) => Array.isArray(a) && a.length <= 40 && a.every(t => num(t, 0, max));

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
export async function finishRender(id, { ok, reason }, now = Date.now()) {
  const r = await getJson(`community/records/${id}.json`);
  if (!r) return { ok: false, error: "Unknown template." };
  if (r.status !== "rendering") return { ok: false, error: `Not rendering (${r.status}).` };
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
