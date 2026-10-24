import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getCapabilities, validateJson } from "../src/contract.js";
import contract from "../src/studio-contract.json" with { type: "json" };
import { TRANSITION_TYPES } from "../src/transitions.js";

const base = JSON.parse(readFileSync("skills/hypercodemotion/examples/scene-transitions.json", "utf8"));
const withScenes = (scenes) => validateJson({ ...base, scenes });
const codes = (r) => r.warnings.map((w) => w.code);

test("get_capabilities lists the transition contract and the start guide", () => {
  const c = getCapabilities();
  assert.deepEqual(c.transitions.shape.type.split("|"), TRANSITION_TYPES);
  assert.match(c.transitions.shape.dir, /enters from/);
  assert.match(c.start, /canvas size/);
});
test("common properties are listed once and nothing is lost", () => {
  const c = getCapabilities();
  for (const [type, full] of Object.entries(contract.types)) {
    const own = c.layerProperties[type];
    assert.deepEqual([...new Set([...own, ...(own.length === full.length ? [] : c.commonProperties)])].sort(), [...full].sort(), type);
  }
  assert.deepEqual(c.layerProperties.camera, contract.types.camera);
  assert.equal(c.layerProperties.rect.includes("opacity"), false);
});
test("a composition with valid transitions raises no UNKNOWN_ or TRANSITION_ warning", () => {
  const r = validateJson(base);
  assert.equal(r.valid, true);
  assert.deepEqual(codes(r).filter((c) => /^UNKNOWN_|^TRANSITION_|^SCENE/.test(c)), []);
});
test("every documented transition type is accepted", () => {
  for (const type of TRANSITION_TYPES) {
    const scenes = structuredClone(base.scenes);
    scenes[1].transition = { type, dur: 0.5, dir: "left" };
    assert.deepEqual(codes(withScenes(scenes)).filter((c) => /^TRANSITION_/.test(c)), [], type);
  }
});
test("transition mistakes Studio would silently ignore are warned about", () => {
  const mk = (i, t) => { const s = structuredClone(base.scenes); s[i].transition = t; return codes(withScenes(s)); };
  assert.ok(mk(1, { type: "dissolve", dur: 0.5 }).includes("TRANSITION_UNKNOWN_TYPE"));
  assert.ok(mk(0, { type: "fade", dur: 0.5 }).includes("TRANSITION_ON_FIRST_SCENE"));
  assert.ok(mk(1, { type: "fade" }).includes("TRANSITION_NO_DURATION"));
  assert.ok(mk(1, { type: "fade", dur: 0 }).includes("TRANSITION_NO_DURATION"));
  assert.ok(mk(1, { type: "fade", dur: 9 }).includes("TRANSITION_LONGER_THAN_SCENE"));
  assert.ok(mk(1, { type: "slide", dur: 0.5, dir: "diagonal" }).includes("TRANSITION_BAD_DIR"));
  assert.ok(mk(1, "fade").includes("TRANSITION_SHAPE"));
});
test("overlapping or malformed scenes are warned about, warnings never invalidate", () => {
  const s = structuredClone(base.scenes); s[1].start = 1.5;
  const r = withScenes(s);
  assert.ok(codes(r).includes("SCENES_OVERLAP"));
  assert.equal(r.valid, true);
  assert.ok(codes(validateJson({ ...base, scenes: "none" })).includes("SCENES_NOT_ARRAY"));
});
