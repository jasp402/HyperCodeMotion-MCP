import test from "node:test";
import assert from "node:assert/strict";
import { validateComposition } from "../src/validator.js";
import { getCapabilities } from "../src/contract.js";

const base = (layers, assets) => ({
  version: 1, name: "T", width: 1080, height: 1920, fps: 30, duration: 4,
  background: "#111", params: {}, layers, ...(assets ? { assets } : {}),
});
const runtime = (props) => ({ id: "m", name: "Motor", type: "runtime", start: 0, end: 4, props });
const codes = (list) => list.map((item) => item.code);

test("a lottie runtime whose asset exists is accepted and warns that seek is not a render", () => {
  const result = validateComposition(base(
    [runtime({ engine: "lottie", asset: "logo" })],
    { logo: "{}" },
  ));
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.fullyValidated, false);
  assert.ok(codes(result.warnings).includes("RUNTIME_SEEK"));
});

test("a bad engine and a missing asset are rejected", () => {
  const bad = validateComposition(base([runtime({ engine: "waapi", asset: "logo" })], { logo: "{}" }));
  assert.ok(codes(bad.errors).includes("RUNTIME_ENGINE"));
  const missing = validateComposition(base([runtime({ engine: "three", asset: "nope" })], { logo: "{}" }));
  assert.ok(codes(missing.errors).includes("RUNTIME_ASSET_MISSING"));
  assert.equal(missing.valid, false);
  const unchecked = validateComposition(base([runtime({ asset: "logo" })]));
  assert.equal(unchecked.valid, true, JSON.stringify(unchecked.errors));
  assert.ok(codes(unchecked.warnings).includes("RUNTIME_ASSET_UNCHECKED"));
  assert.ok(codes(unchecked.warnings).includes("RUNTIME_SEEK"));
});

test("html text driven by an expression warns that it is sampled per frame", () => {
  const result = validateComposition(base([{
    id: "h", name: "H", type: "html", start: 0, end: 4,
    props: { doc: "s1", part: "h1", text: { expr: "Math.round(t)" } },
  }]));
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(codes(result.warnings).includes("HTML_TEXT_SAMPLED"));
});

test("capabilities publish the runtime layer and the html shadow pads", () => {
  const caps = getCapabilities();
  for (const key of ["engine", "asset", "node", "clip", "text", "color"]) {
    assert.ok(caps.layerProperties.runtime.includes(key), key);
  }
  assert.ok(caps.layerProperties.html.includes("padL"));
  assert.ok(caps.layerProperties.html.includes("glass"));
  assert.ok(caps.layerProperties.html.includes("br"));
});
