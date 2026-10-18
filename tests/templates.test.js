import test from "node:test";
import assert from "node:assert/strict";
import { getTemplate } from "../src/templates.js";

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
