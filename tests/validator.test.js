import test from "node:test";
import assert from "node:assert/strict";
import { validateComposition } from "../src/validator.js";

const example = () => ({
  version: 1, name: "Demo", width: 1080, height: 1920, fps: 30, duration: 6,
  background: "#000000", params: {}, layers: [
    { id: "title", name: "Title", type: "text", start: 0, end: 6,
      props: { text: "Hello", x: 540, y: 960 } }
  ]
});
test("accepts a structurally sound Studio composition, without claiming full validation", () => {
  const result = validateComposition(example());
  assert.equal(result.valid, true);
  assert.equal(result.fullyValidated, false);
});
test("rejects non-HyperCodeMotion JSON", () => {
  assert.equal(validateComposition({ unrelated: true }).errors[0].code, "MISSING_CONTENT");
});
test("rejects duplicate ids and missing parents", () => {
  const c = example();
  c.layers.push({ ...c.layers[0], parent: "not-there" });
  const result = validateComposition(c);
  assert.ok(result.errors.some(x => x.code === "DUPLICATE_ID"));
  assert.ok(result.errors.some(x => x.code === "UNKNOWN_PARENT"));
});
test("rejects empty designs and bad element dimensions", () => {
  assert.equal(validateComposition({ elements: [] }).valid, false);
  const result = validateComposition({ elements: [{ x: 1, y: 2, w: -1, h: 5 }] });
  assert.ok(result.errors.some(x => x.code === "INVALID_DIMENSION"));
});
test("rejects invalid layer timing", () => {
  const c = example(); c.layers[0].end = 12;
  assert.ok(validateComposition(c).errors.some(x => x.code === "OUTSIDE_DURATION"));
});
test("does not execute expressions or supplied code", () => {
  const c = example(); c.layers[0].props.x = { expr: "throw new Error('oops')" };
  assert.equal(validateComposition(c).valid, true);
  assert.equal(validateComposition(c).fullyValidated, false);
});

test("recognizes real Studio improvement envelope with add/change/remove/sfx", () => {
  const patch = {
    add: [
      { id: "accent", name: "Accent", type: "svg", z: "frente", start: 0.5, end: 2,
        props: { icon: "martini", x: 540, y: 300 },
        fx: { in: { id: "draw", dur: 0.5 } } }
    ],
    change: [], remove: [], sfx: [{ t: 0.6, sound: "whoosh", gain: 0.4 }]
  };
  const result = validateComposition(patch, { composition: example() });
  assert.equal(result.valid, true);
  assert.equal(result.format, "improvement");
  assert.equal(result.fullyValidated, false);
});
test("rejects malformed improvement operation arrays", () => {
  const result = validateComposition({ add: {}, change: [], remove: [], sfx: [] });
  assert.ok(result.errors.some(x => x.code === "INVALID_OPERATIONS"));
});
test("distinguishes empty improvements from unrelated JSON", () => {
  assert.equal(validateComposition({ add: [] }).errors[0].code, "EMPTY_OPERATIONS");
});
test("checks existing project references when context is supplied", () => {
  const result = validateComposition({ change: [{ id: "missing", props: { x: 1 } }] }, { composition: example() });
  assert.ok(result.warnings.some(x => x.code === "UNKNOWN_CHANGE"));
});
test("accepts fondo/frente and warns on project-duration clamping", () => {
  const result = validateComposition({ add: [
    { id: "bg", type: "rect", z: "fondo", start: 0, end: 8, props: { fill: "#111" } }
  ] }, { composition: example() });
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some(x => x.code === "CLAMPED_DURATION"));
  assert.ok(!result.warnings.some(x => x.code === "UNKNOWN_Z"));
});
test("rejects conflicting top-level formats", () => {
  const result = validateComposition({ ...example(), add: [] });
  assert.ok(result.errors.some(x => x.code === "AMBIGUOUS_FORMAT"));
});

test("video layers reference the user's file by id and a clip start", async () => {
  const { validateJson, getCapabilities } = await import("../src/contract.js");
  const { checkComposition } = await import("../src/hcmotion.js");
  const base = { version: 1, name: "V", width: 1080, height: 1920, fps: 30, duration: 8, background: "#000", params: {} };
  const clip = (props) => ({ ...base, layers: [{ id: "c", name: "Clip", type: "video", start: 1, end: 4, props }] });
  const ok = validateJson(clip({ asset: "video-1", from: 3.2, w: 1080, h: 1920 }));
  assert.equal(ok.valid, true, JSON.stringify(ok.errors));
  assert.ok(!ok.warnings.some((w) => w.code === "UNKNOWN_LAYER_TYPE" || w.code === "UNKNOWN_PROPERTY"));
  assert.deepEqual(checkComposition(clip({ asset: "video-1" })), []);
  const codes = (r) => r.errors.map((e) => e.code);
  assert.deepEqual(codes(validateJson(clip({ from: 1 }))), ["VIDEO_NEEDS_ASSET"]);
  assert.deepEqual(codes(validateJson(clip({ asset: "https://x.test/a.mp4" }))), ["VIDEO_ASSET_NOT_ID"]);
  assert.deepEqual(codes(validateJson(clip({ asset: "video-1", from: -2 }))), ["INVALID_CLIP_START"]);
  const inAssets = validateJson({ ...clip({ asset: "video-1" }), assets: { "video-1": "data:video/mp4;base64,AAAA" } });
  assert.ok(inAssets.warnings.some((w) => w.code === "VIDEO_IN_ASSETS"));
  assert.match(getCapabilities().userMaterials, /props\.from/);
  assert.ok(getCapabilities().layerProperties.video.includes("from"));
});
