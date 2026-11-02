import test from "node:test";
import assert from "node:assert/strict";
import { getTemplate, fillTemplate } from "../src/templates.js";

const tpl = { version: 1, name: "NODD (horizontal)", width: 1920, height: 1080, fps: 30, duration: 22, brief: "Promo editorial", docs: { a: "<div></div>" },
  layers: [{ id: "a", type: "html", start: 0, end: 3 }], scenes: [{ name: "Gancho", start: 0, end: 3.2, transition: { type: "cut" } }], audio: { music: [] } };
const fake = (seen) => async (url) => { seen.push(url); return url.endsWith("/mix-promo-editorial-cuadrado.json") || url.endsWith("/mix-promo-editorial-vertical.json") ? { ok: true, json: async () => tpl } : { ok: false }; };

test("get_template returns the design in the requested format", async () => {
  const seen = [];
  const r = await getTemplate({ template: "mix-promo-editorial", format: "4:3" }, fake(seen));
  assert.equal(r.found, true);
  assert.equal(r.name, "NODD");
  assert.deepEqual([r.composition.width, r.composition.height], [1440, 1080]);
  assert.equal(r.composition.audio, undefined);
  assert.equal(r.composition.docs.a, "<div></div>");
  assert.deepEqual(r.scenes, [{ name: "Gancho", start: 0, end: 3.2, transition: "cut" }]);
  assert.match(seen[0], /\/plantillas\/mix-promo-editorial-cuadrado\.json$/);
});
test("get_template uses the vertical variant for 9:16", async () => {
  const seen = [];
  const r = await getTemplate({ template: "MIX-promo-editorial", format: "9:16" }, fake(seen));
  assert.equal(r.found, true);
  assert.deepEqual([r.composition.width, r.composition.height], [1080, 1920]);
  assert.match(seen[0], /-vertical\.json$/);
});
test("get_template rejects unknown ids, bad ids and bad formats without fetching paths", async () => {
  const seen = [];
  assert.equal((await getTemplate({ template: "nope" }, fake(seen))).found, false);
  assert.equal((await getTemplate({ template: "../secret" }, fake(seen))).found, false);
  assert.equal((await getTemplate({ template: "nodd", format: "2:1" }, fake(seen))).found, false);
  assert.equal(seen.length, 1);
});

// plantilla con huecos (trends): la foto y los clips de ejemplo no viajan al modelo; fill_template solo cambia textos
const big = "data:video/webm;base64," + "A".repeat(20000);
const trend = { version: 1, name: "Trend · Portfolio de editor", width: 1920, height: 1080, fps: 30, duration: 15, background: "#000", params: {},
  assets: { FOTO: "data:image/webp;base64," + "B".repeat(9000), V1: big, ICON: "data:image/png;base64,AAAA" },
  layers: [
    { id: "l1", type: "rect", name: "Fondo", start: 0, end: 15, props: {} },
    { id: "l2", type: "text", name: "Hueco · Nombre", start: 0, end: 6, props: { text: "LI WON" } },
    { id: "l3", type: "image", name: "Hueco · Tu foto (sin fondo)", start: 0, end: 6, props: { asset: "FOTO" } },
    { id: "l4", type: "video", name: "Hueco · Clip 1 (vertical)", start: 6, end: 11, props: { asset: "V1" } },
  ],
  audio: { bpm: 100, tracks: [], sfx: [] } };
const trendFetch = async (url) => (url.endsWith("/trend-portfolio-editor-vertical.json") ? { ok: true, json: async () => trend } : { ok: false });

test("get_template lists the slots and leaves the heavy demo files out", async () => {
  const r = await getTemplate({ template: "trend-portfolio-editor", format: "9:16" }, trendFetch);
  assert.equal(r.found, true);
  assert.deepEqual(r.slots.map((s) => [s.id, s.type]), [["l2", "text"], ["l3", "image"], ["l4", "video"]]);
  assert.equal(r.slots[0].text, "LI WON");
  assert.match(r.fill, /fill_template/);
  assert.deepEqual(r.assetsOmitted, ["FOTO", "V1"]);
  assert.equal(r.composition.assets.V1, "data:video/webm;base64,omitted");
  assert.equal(r.composition.assets.ICON, "data:image/png;base64,AAAA");
  assert.ok(JSON.stringify(r).length < 5000);
});
test("fill_template changes only text slots and keeps the files", async () => {
  const r = await fillTemplate({ template: "trend-portfolio-editor", format: "9:16", texts: { l2: "ANA PÉREZ" } }, trendFetch);
  assert.equal(r.error, undefined);
  assert.equal(r.composition.layers[1].props.text, "ANA PÉREZ");
  assert.equal(r.composition.assets.V1, big);
  assert.deepEqual(r.composition.audio, trend.audio);
  assert.deepEqual([r.composition.width, r.composition.height], [1080, 1920]);
  assert.equal(trend.layers[1].props.text, "LI WON");
});
test("fill_template rejects unknown ids, media slots and templates without slots", async () => {
  assert.match((await fillTemplate({ template: "trend-portfolio-editor", format: "9:16", texts: { l1: "x" } }, trendFetch)).error, /not a slot/);
  assert.match((await fillTemplate({ template: "trend-portfolio-editor", format: "9:16", texts: { l4: "x" } }, trendFetch)).error, /replaces it in the Studio/);
  assert.match((await fillTemplate({ template: "trend-portfolio-editor", format: "9:16", texts: { l2: "" } }, trendFetch)).error, /non-empty/);
  assert.match((await fillTemplate({ template: "mix-promo-editorial", format: "9:16", texts: {} }, fake([]))).error, /no slots/);
});
