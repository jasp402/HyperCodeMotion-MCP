import test from "node:test";
import assert from "node:assert/strict";
import { parseSource, readSource, getRecreationBrief, proposeTemplate, getProposalStatus, publishTemplate, finishRender, finishRef, finishCompare, putRef, putCompare, putMedia, putUpload, finishUpload, readUpload, retire, readIndex, readTemplate, readRecord, setStore, moderators, moderatorOf, slugOf, MAX_PER_DAY, MAX_ROUNDS } from "../src/community.js";
import { getTemplate } from "../src/templates.js";
import handler from "../api/community.js";

process.env.TEMPLATE_ADMIN_CODES = "jesus:codigo-jesus-1, ana:codigo-ana-22";
const A = { adminCode: "codigo-jesus-1" };
const mem = () => { const m = new Map(); return { m, put: async (p, d) => { m.set(p, typeof d === "string" ? new TextEncoder().encode(d) : new Uint8Array(d)); }, get: async p => m.get(p) ?? null }; };
const comp = (w, h) => ({ version: 1, name: "x", width: w, height: h, fps: 30, duration: 10, background: "#000", params: {},
  layers: [{ id: "t", type: "text", start: 0, end: 10, props: { text: "HyperCodeMotion", x: w / 2, y: h / 2, size: 72 } }] });
const compositions = () => ({ cuadrado: comp(1080, 1080), vertical: comp(1080, 1920), horizontal: comp(1920, 1080) });
const card = { name: "Cubo de fichas", description: "Un limitador de fichas explicado en canvas", chips: ["Datos", "Canvas", "Técnico"], group: "data", moments: [["Tráfico", 0, 4], ["Ráfaga", 4, 10]] };
const PM = `<title>Token bucket rate limiter · Prompt Motion</title><script>{"contentUrl":"https://media.prompt-motion.com/x/video.b1.mp4","creator":{"@type":"Person","name":"Parker Rex","url":"https://x.com/ParkerRex"}}</script><div id="entry-prompt" class="a">explain a token bucket &amp; more</div>`;
const page = async () => ({ ok: true, text: async () => PM });
const jobs = [];
const noDispatch = async (kind, id, extra) => { jobs.push({ kind, id, ...extra }); return true; };
const studio = async (u, o) => (o?.method === "HEAD" ? { ok: false, status: 404, headers: new Map() } : page());
const opts = { dispatch: noDispatch, fetcher: studio, wait: 0 };
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]);
/** What the reference job does: frames of a 1920×1080, 20 s original. */
async function referenceReady(id) {
  assert.equal((await putRef(id, "general.jpg", JPG)).ok, true);
  assert.equal((await putRef(id, "../x.jpg", JPG)).ok, false);
  assert.equal((await finishRef(id, { ok: true, duration: 20, width: 1920, height: 1080, sheets: { general: [1, 5, 10, 15, 19] } })).ok, true);
}
const MP4 = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 1, 2, 3]);
/** What the caller's Claude does with upload.script: sends the original, then asks again. */
async function brief(args, o) {
  const b = await getRecreationBrief(args, o);
  if (b.reference?.status !== "upload") return b;
  const key = new URL(b.upload.done.replace("<count>", "1")).searchParams.get("key");
  assert.equal((await putUpload(b.template, key, 0, MP4)).ok, true);
  assert.equal((await finishUpload(b.template, key, 1, o)).ok, true);
  return getRecreationBrief(args, o);
}
async function compared(id, round, ok = true) {
  if (ok) assert.equal((await putCompare(id, "sheet.jpg", JPG)).ok, true);
  return finishCompare(id, { round, ok, reason: ok ? null : "pageerror: boom", times: ok ? [[1, 0.5], [10, 5]] : null });
}

test("only video pages of the accepted sites are sources", () => {
  assert.equal(parseSource("https://prompt-motion.com/parkerrex-1a54fe").id, "c-pm-parkerrex-1a54fe");
  assert.equal(parseSource("https://www.oneshotted.io/v/one-shape-a-seamless-ui-morph-loop/").id, "c-os-one-shape-a-seamless-ui-morph-loop");
  assert.ok(parseSource("https://oneshotted.io/v/" + "a".repeat(90)).id.length <= 64);
  assert.ok(parseSource("http://prompt-motion.com/parkerrex-1a54fe").error);
  assert.ok(parseSource("https://evil.com/parkerrex-1a54fe").error);
  assert.ok(parseSource("https://prompt-motion.com/a/b").error);
  assert.ok(parseSource("not a url").error);
});
test("the source page gives title, author, video and the full prompt", async () => {
  const r = await readSource(parseSource("https://prompt-motion.com/parkerrex-1a54fe"), page);
  assert.deepEqual([r.title, r.author, r.authorUrl, r.video, r.prompt, r.promptComplete], ["Token bucket rate limiter", "Parker Rex", "https://x.com/ParkerRex", "https://media.prompt-motion.com/x/video.b1.mp4", "explain a token bucket & more", true]);
});
test("reference, comparison rounds, publication", async () => {
  const s = mem(); setStore(s); jobs.length = 0;
  const url = "https://prompt-motion.com/parkerrex-1a54fe", id = "c-pm-parkerrex-1a54fe";
  const first = await brief({ ...A, url }, opts);
  assert.equal(first.ok, true); assert.equal(first.reference.status, "preparing"); assert.match(first.brief, /publish_template/);
  assert.deepEqual(jobs.map(j => [j.kind, j.video]), [["reference", "https://media.prompt-motion.com/x/video.b1.mp4"]]);
  await brief({ ...A, url }, opts);
  assert.equal(jobs.length, 1, "the reference is extracted once");
  const early = await proposeTemplate({ ...A, url, compositions: compositions(), card }, { ...opts });
  assert.equal(early.errors[0].code, "REFERENCE_NOT_READY");
  await referenceReady(id);
  const b = await brief({ ...A, url }, opts);
  assert.equal(b.reference.status, "ready"); assert.equal(b.reference.mainFormat, "horizontal"); assert.equal(b._images.length, 1);

  const bad = await proposeTemplate({ ...A, url, compositions: { ...compositions(), vertical: comp(1080, 1080) }, card }, { ...opts });
  assert.equal(bad.accepted, false); assert.ok(bad.errors.some(e => e.code === "WRONG_SIZE"));
  const unsigned = compositions(); unsigned.horizontal.layers[0].props.text = "Other";
  assert.ok((await proposeTemplate({ ...A, url, compositions: unsigned, card }, { ...opts })).errors.some(e => e.code === "NO_SIGNATURE"));
  const r = await proposeTemplate({ ...A, url, compositions: compositions(), card }, { ...opts });
  assert.equal(r.accepted, true); assert.equal(r.status, "comparing"); assert.equal(r.round, 1);
  assert.deepEqual(jobs.at(-1), { kind: "compare", id, variant: "horizontal", round: 1, video: "https://media.prompt-motion.com/x/video.b1.mp4", upload: 1 });
  assert.equal((await proposeTemplate({ ...A, url, compositions: compositions(), card }, { ...opts })).duplicate, true);
  assert.equal((await brief({ ...A, url }, opts)).alreadyExists, true);
  assert.equal((await proposeTemplate({ ...A, url, code: r.code, compositions: compositions(), card }, opts)).errors[0].code, "COMPARING");
  assert.equal((await publishTemplate({ ...A, code: r.code, notes: "Nada" }, opts)).accepted, false, "nothing is published before its comparison");
  assert.equal((await readTemplate(id, "horizontal")).width, 1920, "the compare job reads it");

  // round 1 fails to render, round 2 renders: only rendered comparisons count
  await compared(id, 1, false);
  const failed = await getProposalStatus({ code: r.code }, { wait: 0 });
  assert.equal(failed.status, "review"); assert.equal(failed.compare.ok, false); assert.match(failed.message, /pageerror/);
  assert.equal((await publishTemplate({ ...A, code: r.code, notes: "Nada" }, opts)).accepted, false);
  const r2 = await proposeTemplate({ ...A, url, code: r.code, compositions: compositions(), card }, opts);
  assert.equal(r2.accepted, true); assert.equal(r2.round, 2); assert.equal(r2.code, r.code);
  assert.equal((await finishCompare(id, { round: 1, ok: true, times: [[1, 1]] })).ok, false, "an older round is ignored");
  await compared(id, 2);
  const st = await getProposalStatus({ code: r.code }, { wait: 0 });
  assert.equal(st.status, "review"); assert.equal(st.compare.ok, true); assert.equal(st._images.length, 1); assert.equal(st.compare.revisionsLeft, MAX_ROUNDS - 1);
  assert.deepEqual(await readIndex(), []);

  assert.equal((await publishTemplate({ ...A, code: r.code }, opts)).accepted, false, "notes are required");
  assert.equal((await publishTemplate({ code: r.code, notes: "Nada" }, opts)).accepted, false, "a moderator code is required");
  assert.equal((await publishTemplate({ adminCode: "otro-codigo", code: r.code, notes: "Nada" }, opts)).accepted, false);
  const p = await publishTemplate({ adminCode: "codigo-ana-22", code: r.code, notes: "Fondo sin grano: el motor no lo hace." }, opts);
  assert.equal(p.accepted, true); assert.equal(p.status, "rendering");
  assert.deepEqual(jobs.at(-1), { kind: "official", id, slug: "cubo-de-fichas", branch: "template" });
  assert.deepEqual(p.official, { slug: "cubo-de-fichas", branch: "template", commit: null, pr: null });
  const rec = await readRecord(id);
  assert.equal(rec.card.name, "Cubo de fichas"); assert.equal(rec.source.author, "Parker Rex"); assert.equal(rec.official.by, "ana"); assert.equal(rec.notes, "Fondo sin grano: el motor no lo hace.");
  assert.equal((await finishRender(id, { ok: true, commit: "abc1234", pr: "https://github.com/jasp402/HyperCodeMotion/pull/41" })).status, "published");
  assert.deepEqual(await readIndex(), [], "official templates do not go to the Community index");
  const done = await getProposalStatus({ code: r.code }, { wait: 0 });
  assert.equal(done.published, true); assert.equal(done.template, "cubo-de-fichas"); assert.equal(done.official.commit, "abc1234"); assert.equal(done.official.pr, "https://github.com/jasp402/HyperCodeMotion/pull/41"); assert.match(done.studio, /pull\/41/);
  assert.equal((await proposeTemplate({ ...A, url, code: r.code, compositions: compositions(), card }, opts)).errors[0].code, "NOT_REVISABLE");
  assert.equal((await brief({ ...A, url }, opts)).alreadyExists, true, "a published video is not recreated again");
});
test("moderator codes", async () => {
  assert.deepEqual(moderators("jesus:abc123, ana:def456; solo-codigo-1"), [{ name: "jesus", code: "abc123" }, { name: "ana", code: "def456" }, { name: "moderador 3", code: "solo-codigo-1" }]);
  assert.deepEqual(moderators("corto"), [], "codes shorter than 6 characters are ignored");
  assert.equal(moderatorOf("codigo-ana-22"), "ana"); assert.equal(moderatorOf("codigo-ana-2"), null); assert.equal(moderatorOf(""), null); assert.equal(moderatorOf(undefined), null);
  setStore(mem()); jobs.length = 0;
  const url = "https://prompt-motion.com/parkerrex-1a54fe";
  const b = await getRecreationBrief({ url }, opts);
  assert.equal(b.ok, false); assert.equal(b.needsCode, true); assert.equal(jobs.length, 0, "nothing starts without a code");
  assert.equal((await proposeTemplate({ url, compositions: compositions(), card }, opts)).errors[0].code, "MODERATOR_CODE");
  assert.equal(slugOf("Reel de producto — Ñandú"), "reel-de-producto-nandu");
  // a slug the Studio already has gets the source's id
  setStore(mem()); jobs.length = 0;
  await brief({ ...A, url }, opts); await referenceReady("c-pm-parkerrex-1a54fe");
  const r = await proposeTemplate({ ...A, url, compositions: compositions(), card }, opts);
  await compared("c-pm-parkerrex-1a54fe", 1);
  const taken = async (u, o) => (o?.method === "HEAD" ? { ok: /cubo-de-fichas-vertical/.test(u), status: 200, headers: new Map([["content-type", "application/json"]]) } : page());
  const p = await publishTemplate({ ...A, code: r.code, notes: "Nada" }, { ...opts, fetcher: taken });
  assert.equal(p.official.slug, "cubo-de-fichas-1a54fe");
  // a slug held by another template's open pull request is not reused
  setStore(mem()); jobs.length = 0;
  for (const [u, cid] of [["https://prompt-motion.com/parkerrex-1a54fe", "c-pm-parkerrex-1a54fe"], ["https://prompt-motion.com/otro-777777", "c-pm-otro-777777"]]) {
    await brief({ ...A, url: u }, opts); await referenceReady(cid);
    const rr = await proposeTemplate({ ...A, url: u, compositions: compositions(), card }, opts);
    await compared(cid, 1);
    const free = async (x, o) => (o?.method === "HEAD" ? { ok: false, status: 404, headers: new Map() } : page());
    jobs.push((await publishTemplate({ ...A, code: rr.code, notes: "Nada" }, { ...opts, fetcher: free })).official.slug);
  }
  assert.deepEqual(jobs.filter(j => typeof j === "string"), ["cubo-de-fichas", "cubo-de-fichas-777777"]);
  // a job that cannot start leaves it in review, to publish again
  setStore(mem());
  await brief({ ...A, url }, opts); await referenceReady("c-pm-parkerrex-1a54fe");
  const r2 = await proposeTemplate({ ...A, url, compositions: compositions(), card }, opts);
  await compared("c-pm-parkerrex-1a54fe", 1);
  const off = await publishTemplate({ ...A, code: r2.code, notes: "Nada" }, { ...opts, dispatch: async () => false });
  assert.equal(off.accepted, false); assert.equal(off.status, "review");
  await publishTemplate({ ...A, code: r2.code, notes: "Nada" }, opts);
  assert.equal((await finishRender("c-pm-parkerrex-1a54fe", { ok: false, reason: "build roto" })).status, "review", "a failed publication can be published again");
});
test("comparisons are limited and an abandoned proposal frees its video", async () => {
  setStore(mem()); jobs.length = 0;
  const url = "https://prompt-motion.com/parkerrex-1a54fe", id = "c-pm-parkerrex-1a54fe", now = Date.now();
  await brief({ ...A, url }, opts); await referenceReady(id);
  const r = await proposeTemplate({ ...A, url, compositions: compositions(), card }, { ...opts, now });
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    await compared(id, round);
    if (round < MAX_ROUNDS) assert.equal((await proposeTemplate({ ...A, url, code: r.code, compositions: compositions(), card }, opts)).accepted, true);
  }
  assert.equal((await proposeTemplate({ ...A, url, code: r.code, compositions: compositions(), card }, opts)).errors[0].code, "ROUNDS_USED");
  const later = now + 25 * 3600e3;
  const other = await proposeTemplate({ ...A, url, compositions: compositions(), card }, { ...opts, now: later });
  assert.equal(other.accepted, true); assert.notEqual(other.code, r.code);
});
test("a page that refuses this server: the moderator drops the video on the upload page", async () => {
  setStore(mem()); jobs.length = 0;
  const blocked = async () => ({ ok: false, status: 403, text: async () => "" });
  const url = "https://prompt-motion.com/parkerrex-1a54fe", id = "c-pm-parkerrex-1a54fe";
  const o = { ...opts, fetcher: blocked };
  assert.match((await getRecreationBrief({ ...A, url, video: "https://evil.com/x.mp4" }, o)).error, /media\.prompt-motion\.com/);
  // no video address: an upload page instead of guessing it
  const first = await getRecreationBrief({ ...A, url, prompt: "a ball and rings", title: "Rings", author: "Kent", authorUrl: "javascript:alert(1)" }, o);
  assert.equal(first.ok, true); assert.equal(first.reference.status, "upload"); assert.equal(first.upload.script, undefined);
  assert.match(first.upload.page, /\/subir\/c-pm-parkerrex-1a54fe\/[0-9a-f]{32}$/); assert.match(first.message, /Save video as/);
  assert.equal(first.prompt, "a ball and rings"); assert.equal(first.source.authorUrl, null); assert.equal(jobs.length, 0);
  const key = first.upload.page.split("/").pop();
  assert.equal((await putUpload(id, key, 0, MP4)).ok, true);
  assert.equal((await finishUpload(id, key, 1, o)).ok, true);
  assert.deepEqual(jobs.at(-1), { kind: "reference", id, video: null, upload: 1 });
  await referenceReady(id);
  assert.equal((await getRecreationBrief({ ...A, url }, o)).reference.status, "ready", "once extracted, the video is not needed again");
  const r = await proposeTemplate({ ...A, url, compositions: compositions(), card }, { ...o });
  assert.deepEqual([jobs.at(-1).kind, jobs.at(-1).video, jobs.at(-1).upload], ["compare", null, 1]);
  await compared(id, 1);
  await publishTemplate({ ...A, code: r.code, notes: "Nada" }, { ...o, fetcher: studio });
  assert.equal((await readRecord(id)).source.author, "Kent");
  // a source the server can download still needs its address
  const os = await getRecreationBrief({ ...A, url: "https://oneshotted.io/v/one-shape-loop" }, o);
  assert.equal(os.ok, false); assert.equal(os.needsPage, true);
});
test("a job that cannot read the video fails the brief", async () => {
  setStore(mem());
  const id = "c-pm-parkerrex-1a54fe";
  await brief({ ...A, url: "https://prompt-motion.com/parkerrex-1a54fe" }, opts);
  await finishRef(id, { ok: false, reason: "el video respondió 403" });
  const b = await brief({ ...A, url: "https://prompt-motion.com/parkerrex-1a54fe" }, opts);
  assert.equal(b.ok, false); assert.match(b.error, /403.*compared/);
});
test("daily limit per caller", async () => {
  setStore(mem());
  const ids = Array.from({ length: MAX_PER_DAY + 1 }, (_, i) => `https://prompt-motion.com/autor-${i}abc`);
  const out = [];
  for (const url of ids) {
    const id = parseSource(url).id;
    await brief({ ...A, url }, opts); await referenceReady(id);
    out.push(await proposeTemplate({ ...A, url, compositions: compositions(), card }, { ...opts }));
  }
  assert.equal(out.filter(o => o.accepted).length, MAX_PER_DAY);
  assert.equal(out.at(-1).errors[0].code, "DAILY_LIMIT");
});
test("render callbacks need the render secret", async () => {
  setStore(mem());
  process.env.COMMUNITY_RENDER_SECRET = "s3cret";
  const call = async (headers, query) => { const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(v) { this.body = v; } }; await handler({ method: "POST", headers, query, body: { id: "c-pm-x", ok: true } }, res); return res.statusCode; };
  assert.equal(await call({}, { op: "finish" }), 401);
  assert.equal(await call({ authorization: "Bearer s3cret" }, { op: "finish" }), 400);
});
test("prompt-motion's video is sent by the caller's Claude in parts", async () => {
  setStore(mem()); jobs.length = 0;
  const url = "https://prompt-motion.com/parkerrex-1a54fe", id = "c-pm-parkerrex-1a54fe";
  const b = await getRecreationBrief({ ...A, url }, opts);
  assert.equal(b.ok, true); assert.equal(b.reference.status, "upload"); assert.equal(jobs.length, 0);
  assert.match(b.upload.script, /curl -sfL "https:\/\/media\.prompt-motion\.com\/x\/video\.b1\.mp4"/);
  const key = new URL(b.upload.done).searchParams.get("key");
  assert.equal((await getRecreationBrief({ ...A, url }, opts)).upload.done, b.upload.done, "the same upload until it ends");
  assert.equal((await putUpload(id, "wrong".padEnd(32, "0"), 0, MP4)).ok, false);
  assert.equal((await putUpload(id, key, 0, JPG)).ok, false, "only an .mp4");
  assert.equal((await putUpload(id, key, 1, new Uint8Array(3_000_001))).ok, false);
  assert.equal((await putUpload(id, key, 0, MP4)).ok, true);
  assert.equal((await finishUpload(id, key, 2, opts)).ok, false, "a missing part");
  assert.equal((await putUpload(id, key, 1, new Uint8Array([9, 9]))).ok, true);
  const done = await finishUpload(id, key, 2, opts);
  assert.equal(done.ok, true); assert.deepEqual(jobs.at(-1), { kind: "reference", id, video: "https://media.prompt-motion.com/x/video.b1.mp4", upload: 2 });
  assert.equal((await putUpload(id, key, 0, MP4)).ok, false, "the key ends with the upload");
  assert.deepEqual([...(await readUpload(id, 1))], [9, 9]);
  assert.equal(await readUpload("../x", 1), null);
  assert.equal((await getRecreationBrief({ ...A, url }, opts)).reference.status, "preparing");
  process.env.COMMUNITY_RENDER_SECRET = "s3cret";
  const get = async headers => { const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(v) { this.body = v; } }; await handler({ method: "GET", headers, query: { op: "part", id, part: "0" } }, res); return res.statusCode; };
  assert.equal(await get({}), 401);
  assert.equal(await get({ authorization: "Bearer s3cret" }), 200);
  const os = await getRecreationBrief({ ...A, url: "https://oneshotted.io/v/one-shape-loop", video: "https://r2.oneshotted.io/a/b.mp4" }, { ...opts, fetcher: async () => ({ ok: false, status: 403, text: async () => "" }) });
  assert.equal(os.reference.status, "preparing", "other sources are still downloaded by the job");
});
test("the upload page only opens with a valid id and key", async () => {
  const { default: page } = await import("../api/subir.js");
  const call = q => { const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(v) { this.body = v; } }; page({ method: "GET", query: q, url: "/" }, res); return res; };
  assert.equal(call({ id: "c-pm-x1a", key: "z" }).statusCode, 404);
  const ok = call({ id: "c-pm-parkerrex-1a54fe", key: "a".repeat(32) });
  assert.equal(ok.statusCode, 200); assert.match(ok.body, /op=upload&part=/); assert.match(ok.body, /c-pm-parkerrex-1a54fe/);
});
