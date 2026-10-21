import test from "node:test";
import assert from "node:assert/strict";
import { frameOf, screenRule, TEXT_WIDTH } from "../src/frame.js";

const pack = (f) => [f.mx, f.my, f.mb, f.safeW, f.safeH, f.title];

test("16:9, 9:16 and 1:1 match Studio's safe area and starting sizes", () => {
  const wide = frameOf(1920, 1080);
  assert.equal(wide.name, "16:9");
  assert.deepEqual(pack(wide), [65, 86, 86, 1790, 908, 173]);
  const tall = frameOf(1080, 1920);
  assert.equal(tall.name, "9:16");
  assert.deepEqual(pack(tall), [76, 230, 346, 928, 1344, 107]);
  assert.ok(tall.my > tall.mx && tall.mb > tall.my);
  assert.ok(wide.title > tall.title);
  const square = frameOf(1080, 1080);
  assert.equal(square.name, "1:1");
  assert.deepEqual(pack(square), [76, 86, 86, 928, 908, 107]);
});

test("a near ratio keeps its name and an odd canvas does not borrow 16:9", () => {
  assert.equal(frameOf(1080, 1350).name, "4:5");
  assert.equal(frameOf(1000, 700).name, "1000×700");
  assert.ok(frameOf(640, 640).title < 90);
});

test("the screen rule is the one place the coefficients are spoken", () => {
  const text = screenRule();
  assert.match(text, /canvas format decides type size/);
  assert.match(text, new RegExp(String(TEXT_WIDTH)));
  assert.match(text, /line-height must be at least 1/);
  assert.match(text, /fullyValidated stays false/);
  assert.doesNotMatch(text, /1920×1080/);
});
