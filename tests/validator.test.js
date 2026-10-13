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
  assert.equal(validateComposition({ add: [] }).errors[0].code, "MISSING_CONTENT");
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
