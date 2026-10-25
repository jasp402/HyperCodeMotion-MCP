import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateComposition } from "../src/validator.js";
import { validateJson, getCapabilities } from "../src/contract.js";

const base = (over = {}) => ({
  version: 1, name: "T", width: 1080, height: 1920, fps: 30, duration: 4,
  background: "#111", params: {}, layers: [], ...over,
});
const text = (props) => ({ id: "t", name: "Title", type: "text", start: 0, end: 4, props });
const codes = (result) => result.errors.map((e) => e.code);

test("a short title at the starting size fits a vertical screen", () => {
  const result = validateComposition(base({ layers: [text({ text: "Hola", x: 540, y: 960, size: 107 })] }));
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.fullyValidated, false);
});

test("a long headline at 150 px does not fit 9:16", () => {
  const result = validateComposition(base({
    layers: [text({ text: "Your model is ready.", x: 540, y: 960, size: 150 })],
  }));
  assert.ok(codes(result).includes("TEXT_DOES_NOT_FIT"));
  assert.equal(result.valid, false);
});

test("lineHeight below 1 is rejected even when the words are short", () => {
  const result = validateComposition(base({
    layers: [text({ text: "Hola", x: 540, y: 960, size: 80, lineHeight: 0.95 })],
  }));
  assert.ok(codes(result).includes("TEXT_LINE_HEIGHT"));
});

test("text in the icon margin warns and text past the canvas fails", () => {
  const high = validateComposition(base({ layers: [text({ text: "Hola", x: 540, y: 80, size: 40 })] }));
  assert.equal(high.valid, true);
  assert.ok(high.warnings.some((w) => w.code === "TEXT_OUTSIDE_SAFE"));
  const gone = validateComposition(base({ layers: [text({ text: "Hola", x: 540, y: -200, size: 40 })] }));
  assert.ok(codes(gone).includes("TEXT_OUTSIDE_CANVAS"));
});

test("an expression size is not measured and is not executed", () => {
  const result = validateComposition(base({
    layers: [text({ text: "Hola", x: 540, y: 960, size: { expr: "process.exit(1)" } })],
  }));
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((w) => w.code === "TEXT_FIT_UNEVALUATED"));
});

test("HTML line-height below 1 and an oversized headline are rejected", () => {
  const doc = `<style>.h{position:absolute;left:80px;top:400px;font-size:280px;line-height:.95;width:max-content}</style><h1 class="h" data-hcm="h1">Your model is ready.</h1>`;
  const result = validateComposition(base({
    width: 1080, height: 1920, docs: { s1: doc },
    layers: [{ id: "h", name: "H", type: "html", start: 0, end: 4, props: { doc: "s1", part: "h1" } }],
  }));
  const found = codes(result);
  assert.ok(found.includes("HTML_LINE_HEIGHT"), found.join());
  assert.ok(found.includes("HTML_DOES_NOT_FIT"), found.join());
});

test("a headline that fits the 16:9 safe area passes", () => {
  const doc = `<style>.h{position:absolute;left:160px;top:384px;font-size:120px;font-weight:800;line-height:1.05;width:max-content}</style><h1 class="h" data-hcm="h1">Escribe menos.<br>Recuerda todo.</h1>`;
  const result = validateJson(base({
    width: 1920, height: 1080, docs: { s1: doc },
    layers: [{ id: "h", name: "H", type: "html", start: 0, end: 4, props: { doc: "s1", part: "h1" } }],
  }));
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("font shorthand line-height below 1 is rejected", () => {
  const doc = `<style>.k{position:absolute;left:160px;top:200px;font:500 24px/0.9 Inter;width:max-content}</style><div class="k" data-hcm="k1">Notas</div>`;
  const result = validateComposition(base({
    width: 1920, height: 1080, docs: { s1: doc },
    layers: [{ id: "k", name: "K", type: "html", start: 0, end: 4, props: { doc: "s1", part: "k1" } }],
  }));
  assert.ok(codes(result).includes("HTML_LINE_HEIGHT"));
});

test("the shipped HTML example fits its 16:9 screen", () => {
  const c = JSON.parse(readFileSync("skills/hypercodemotion/examples/html-scene-launch.json", "utf8"));
  const result = validateJson(c);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.warnings.some((w) => w.code.startsWith("HTML_")), false);
});

test("a patch that enlarges a title is rejected against the existing canvas", () => {
  const project = base({ layers: [text({ text: "Hola", x: 540, y: 960, size: 80 })] });
  const result = validateComposition({ change: [{ id: "t", props: { size: 400, text: "Your model is ready." } }] }, { composition: project });
  assert.ok(codes(result).includes("TEXT_DOES_NOT_FIT"));
});

test("get_capabilities carries the screen rule", () => {
  const screen = getCapabilities().screen;
  assert.match(screen, /canvas format decides type size/);
  assert.equal(getCapabilities().fullyValidated, false);
});

// ---- self-review: kf text, overlap, easing names ----
const kfText = (v) => ({ kf: v.map((s, i) => ({ t: i, v: s })) });

test("keyframed text is measured over every value, not its default", () => {
  const short = validateComposition(base({ layers: [text({ text: kfText(["3", "2", "1", "GO"]), x: 540, y: 960, size: 150 })] }));
  assert.equal(short.valid, true, JSON.stringify(short.errors));
  const long = validateComposition(base({ layers: [text({ text: kfText(["Hi", "Your model is ready."]), x: 540, y: 960, size: 150 })] }));
  assert.ok(codes(long).includes("TEXT_DOES_NOT_FIT"));
});

test("text that is an expression is reported as not measured, not as a fit error", () => {
  const r = validateComposition(base({ layers: [text({ text: { expr: "'N ' + Math.floor(t)" }, x: 540, y: 960, size: 150 })] }));
  assert.equal(r.valid, true);
  assert.ok(r.warnings.some((w) => w.code === "TEXT_FIT_UNEVALUATED"));
});

const named = (id, props, extra = {}) => ({ id, name: id, type: "text", start: 0, end: 4, props, ...extra });
const overlaps = (r) => r.warnings.filter((w) => w.code === "TEXT_OVERLAP");

test("two different texts on the same spot at the same time warn TEXT_OVERLAP", () => {
  const r = validateComposition(base({ layers: [named("a", { text: "Launch day", x: 540, y: 900, size: 100 }), named("b", { text: "Pisco Sour", x: 560, y: 920, size: 100 })] }));
  assert.equal(overlaps(r).length, 1);
});

test("no TEXT_OVERLAP for separate positions, separate times, echoes or rotated stamps", () => {
  const apart = validateComposition(base({ layers: [named("a", { text: "One", x: 540, y: 500, size: 100 }), named("b", { text: "Two", x: 540, y: 1100, size: 100 })] }));
  assert.equal(overlaps(apart).length, 0);
  const later = validateComposition(base({ layers: [named("a", { text: "One", x: 540, y: 900, size: 100 }, { end: 2 }), named("b", { text: "Two", x: 540, y: 900, size: 100 }, { start: 2 })] }));
  assert.equal(overlaps(later).length, 0);
  const echo = validateComposition(base({ layers: [named("a", { text: "Same", x: 540, y: 900, size: 100 }), named("b", { text: "Same", x: 548, y: 908, size: 100 })] }));
  assert.equal(overlaps(echo).length, 0);
  const stamp = validateComposition(base({ layers: [named("a", { text: "One", x: 540, y: 900, size: 100 }), named("b", { text: "Two", x: 540, y: 900, size: 100, rotation: -8 })] }));
  assert.equal(overlaps(stamp).length, 0);
});

test("html text pieces that sit on top of each other warn TEXT_OVERLAP", () => {
  const piece = (name, top, label) => `<div class="p" style="left:calc(50% + 0px);top:calc(50% + ${top}px);transform:translate(-50%,-50%);font-size:90px" data-hcm="${name}">${label}</div>`;
  const doc = (a, b) => `<!doctype html><html><head><style>.p{position:absolute;width:max-content;line-height:1}</style></head><body>${piece("a", a, "Hello world")}${piece("b", b, "Other words")}</body></html>`;
  const mk = (d) => base({ docs: { s: d }, layers: [{ id: "a", type: "html", start: 0, end: 4, props: { doc: "s", part: "a" } }, { id: "b", type: "html", start: 0, end: 4, props: { doc: "s", part: "b" } }] });
  assert.equal(overlaps(validateComposition(mk(doc(0, 10)))).length, 1);
  assert.equal(overlaps(validateComposition(mk(doc(-300, 300)))).length, 0);
});

test("UNKNOWN_EASE warns for invented keyframe easings, spring modes and animEase; real names pass", () => {
  const mk = (props) => base({ layers: [{ id: "r", type: "rect", start: 0, end: 4, props: { x: 540, y: 960, w: 100, h: 100, fill: "#fff", ...props } }] });
  const bad = validateJson(mk({ x: { kf: [{ t: 0, v: 0, ease: "easeOutSuperBounce" }, { t: 1, v: 9 }] }, y: { kf: [{ t: 0, v: 0 }, { t: 1, v: 9 }], spring: "wobbly" } }));
  assert.equal(bad.warnings.filter((w) => w.code === "UNKNOWN_EASE").length, 2);
  const good = validateJson(mk({ x: { kf: [{ t: 0, v: 0, ease: "easeOutExpo" }, { t: 1, v: 9, ease: "spring(27,380,1)" }, { t: 2, v: 3, ease: "cubic-bezier(.2,.8,.2,1)" }] }, y: { kf: [{ t: 0, v: 0 }, { t: 1, v: 9 }], spring: "snappy" } }));
  assert.equal(good.warnings.filter((w) => w.code === "UNKNOWN_EASE").length, 0);
  const anim = validateJson(base({ layers: [text({ text: "Hi", x: 540, y: 960, size: 100, animEase: "easeBouncy" })] }));
  assert.equal(anim.warnings.filter((w) => w.code === "UNKNOWN_EASE").length, 1);
});
