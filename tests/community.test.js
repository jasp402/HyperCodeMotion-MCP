import test from "node:test";
import assert from "node:assert/strict";
import { parseSource, readSource, getRecreationBrief, proposeTemplate, getProposalStatus, finishRender, putMedia, retire, readIndex, readTemplate, setStore, MAX_PER_DAY } from "../src/community.js";
import { getTemplate } from "../src/templates.js";
import handler from "../api/community.js";

const mem = () => { const m = new Map(); return { m, put: async (p, d) => { m.set(p, typeof d === "string" ? new TextEncoder().encode(d) : new Uint8Array(d)); }, get: async p => m.get(p) ?? null }; };
const comp = (w, h) => ({ version: 1, name: "x", width: w, height: h, fps: 30, duration: 10, background: "#000", params: {},
  layers: [{ id: "t", type: "text", start: 0, end: 10, props: { text: "HyperCodeMotion", x: w / 2, y: h / 2 } }] });
const compositions = () => ({ cuadrado: comp(1080, 1080), vertical: comp(1080, 1920), horizontal: comp(1920, 1080) });
const card = { name: "Cubo de fichas", description: "Un limitador de fichas explicado en canvas", chips: ["Datos", "Canvas", "Técnico"], group: "data", moments: [["Tráfico", 0, 4], ["Ráfaga", 4, 10]] };
const PM = `<title>Token bucket rate limiter · Prompt Motion</title><script>{"contentUrl":"https://media.prompt-motion.com/x/video.b1.mp4","creator":{"@type":"Person","name":"Parker Rex","url":"https://x.com/ParkerRex"}}</script><div id="entry-prompt" class="a">explain a token bucket &amp; more</div>`;
const page = async () => ({ ok: true, text: async () => PM });
const noDispatch = async () => true;

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
test("brief, proposal, render and publication", async () => {
  const s = mem(); setStore(s);
  const url = "https://prompt-motion.com/parkerrex-1a54fe";
  const b = await getRecreationBrief({ url }, page);
  assert.equal(b.ok, true); assert.equal(b.alreadyExists, false); assert.equal(b.template, "c-pm-parkerrex-1a54fe"); assert.match(b.brief, /propose_template/);
  const bad = await proposeTemplate({ url, compositions: { ...compositions(), vertical: comp(1080, 1080) }, card }, { caller: "1.1.1.1", dispatch: noDispatch, fetcher: page });
  assert.equal(bad.accepted, false); assert.ok(bad.errors.some(e => e.code === "WRONG_SIZE"));
  const unsigned = compositions(); unsigned.horizontal.layers[0].props.text = "Other";
  assert.ok((await proposeTemplate({ url, compositions: unsigned, card }, { caller: "1.1.1.1", dispatch: noDispatch, fetcher: page })).errors.some(e => e.code === "NO_SIGNATURE"));
  const r = await proposeTemplate({ url, compositions: compositions(), card }, { caller: "1.1.1.1", dispatch: noDispatch, fetcher: page });
  assert.equal(r.accepted, true); assert.equal(r.status, "rendering");
  assert.equal((await proposeTemplate({ url, compositions: compositions(), card }, { caller: "1.1.1.1", dispatch: noDispatch, fetcher: page })).duplicate, true);
  assert.equal((await getRecreationBrief({ url }, page)).alreadyExists, true);
  assert.equal((await getProposalStatus({ code: r.code })).status, "rendering");
  assert.deepEqual(await readIndex(), []);
  assert.equal((await readTemplate(r.template, "vertical")).width, 1080);
  assert.equal((await putMedia(r.template, "1-1.mp4", new Uint8Array([1, 2]))).ok, true);
  assert.equal((await putMedia(r.template, "../x", new Uint8Array([1]))).ok, false);
  await finishRender(r.template, { ok: true });
  const idx = await readIndex();
  assert.equal(idx.length, 1);
  assert.equal(idx[0].info.autor, "Parker Rex"); assert.equal(idx[0].info.fuente, "parkerrex-1a54fe");
  assert.match(idx[0].media, /\/c\/c-pm-parkerrex-1a54fe\/c-pm-parkerrex-1a54fe$/);
  const t = await getTemplate({ template: r.template, format: "9:16" });
  assert.equal(t.found, true); assert.equal(t.composition.community, undefined); assert.equal(t.name, "Cubo de fichas");
  await retire(r.template);
  assert.deepEqual(await readIndex(), []);
  assert.equal((await getProposalStatus({ code: r.code })).status, "retired");
  assert.equal(await readTemplate(r.template, "vertical"), null);
});
test("daily limit per caller", async () => {
  setStore(mem());
  const ids = Array.from({ length: MAX_PER_DAY + 1 }, (_, i) => `https://prompt-motion.com/autor-${i}abc`);
  const out = [];
  for (const url of ids) out.push(await proposeTemplate({ url, compositions: compositions(), card }, { caller: "2.2.2.2", dispatch: noDispatch, fetcher: page }));
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
