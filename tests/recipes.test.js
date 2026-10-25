import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/mcp.js";
import { RECIPE_NAMES, recipeFragment, recipeText, motionRecipe, lookFragment } from "../src/recipes.js";
import { LOOKS } from "../src/looks.js";
import { validateJson, CHECKLIST } from "../src/contract.js";
import { checkComposition } from "../src/hcmotion.js";

const wrap = (name) => {
  const c = { version: 1, name: "r-" + name.replace(/\W/g, "-"), width: 1080, height: 1920, fps: 30, duration: 6, background: "#000000", params: {}, ...recipeFragment(name) };
  if (!c.layers) c.layers = [{ id: "t", type: "text", start: 0, end: 6, props: { text: "Hi", x: 540, y: 960, size: 120, color: "#ffffff" } }];
  return c;
};
const call = async (name, args = {}) => {
  let body;
  await handler({ method: "POST", headers: {}, body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } } }, { setHeader() {}, end(x) { body = x; }, statusCode: 200 });
  return JSON.parse(body).result;
};

test("there are 7 topic recipes, the looks table and one recipe per look", () => {
  assert.equal(LOOKS.length, 13);
  for (const n of ["riso", "choreography", "audio", "camera", "code-texture", "ui-mockup", "scene-bg", "looks"]) assert.ok(RECIPE_NAMES.includes(n), n);
  for (const l of LOOKS) assert.ok(RECIPE_NAMES.includes("look:" + l.id), l.id);
  assert.equal(RECIPE_NAMES.length, 8 + 13);
});

test("every recipe passes validateJson with no errors and no warning but the contract notice", () => {
  for (const name of RECIPE_NAMES) {
    if (name === "looks") continue; // a table, not a composition
    const c = wrap(name);
    const r = validateJson(c);
    assert.equal(r.valid, true, name + " " + JSON.stringify(r.errors));
    const bad = r.warnings.filter((w) => w.code !== "CONTRACT_NOT_CHECKED");
    assert.deepEqual(bad, [], name + " " + JSON.stringify(bad));
    assert.deepEqual(checkComposition(c), [], name);
  }
});

test("the text a recipe shows contains its validated JSON, byte for byte", () => {
  for (const name of RECIPE_NAMES) {
    if (name === "looks") continue;
    const text = recipeText(name);
    for (const l of recipeFragment(name).layers ?? []) assert.ok(text.includes(JSON.stringify(l)), name + " " + l.id);
  }
});

test("recipe sizes stay on demand: topic recipes under ~800 tokens, looks table under ~1600", () => {
  // 1 token ≈ 3.2 characters for JSON/HTML (cl100k measured on these recipes); generous bounds
  for (const name of RECIPE_NAMES) {
    const chars = recipeText(name).length;
    assert.ok(chars < (name === "looks" ? 5200 : name === "riso" ? 4400 : 3200), name + " " + chars);
  }
});

test("the looks table lists all 13 looks with colours and fonts", () => {
  const t = recipeText("looks");
  for (const l of LOOKS) assert.ok(t.includes(l.id + " |") && t.includes(l.colors.accent), l.id);
});

test("a look recipe states palette, motion and a rule, and uses only its own colours", () => {
  for (const l of LOOKS) {
    const t = recipeText("look:" + l.id);
    assert.ok(t.includes("colours:") && t.includes("motion:") && t.includes("rule:"), l.id);
    const allowed = new Set([...Object.values(l.colors), "#000000", "#00000000", "#141B33", "#26304F" /* saas card, fixed in Studio lookSample */, l.shape.stroke?.color].filter(Boolean).map((x) => x.toLowerCase()));
    const used = JSON.stringify(lookFragment(l).layers.map((x) => x.props)).match(/#[0-9a-fA-F]{6,8}\b/g) ?? [];
    for (const u of used) assert.ok(allowed.has(u.toLowerCase()), l.id + " uses " + u);
  }
});

test("the audio recipe normalizes to the schema the Studio keeps (known synths, sounds)", () => {
  const a = recipeFragment("audio").audio;
  const SYNTHS = ["drums", "tb303", "bass", "saw", "square", "sine", "pluck", "prophet", "fm"];
  for (const t of a.tracks) assert.ok(SYNTHS.includes(t.synth), t.synth);
  const SOUNDS = "kick snare clap hat openhat tom click tick typing pop glitch confirm error open close switch drop whoosh swish air swipe riser impact thump braam boing chime piano strings marimba".split(" ");
  for (const s of a.sfx) { assert.ok(SOUNDS.includes(s.sound), s.sound); assert.ok(s.t < 6); }
});

test("riso grain is a fixed layer drawn last; scene backgrounds are full-canvas rects per scene", () => {
  const riso = recipeFragment("riso").layers;
  assert.equal(riso.at(-1).fixed, true);
  assert.ok(riso.filter((l) => l.props.blend === "multiply").length >= 3);
  const sb = recipeFragment("scene-bg");
  for (const s of sb.scenes) {
    const bg = sb.layers.find((l) => l.type === "rect" && l.start === s.start && l.end === s.end);
    assert.ok(bg && bg.props.w === 1080 && bg.props.h === 1920 && !bg.fixed, s.id);
  }
});

test("the ui-mockup recipe covers the 11 ui kinds and keeps ui children free of w/h", () => {
  const t = recipeText("ui-mockup");
  for (const k of ["label", "spinner", "check", "island", "player", "slider", "toggle", "tabs", "chart", "palette", "toast"]) assert.ok(t.includes(k), k);
  for (const l of recipeFragment("ui-mockup").layers.filter((x) => x.type === "ui")) { assert.equal(l.parent, "forma"); assert.equal(l.props.w, undefined); assert.equal(l.props.h, undefined); }
});

test("get_motion_recipe: index without name, recipe with name, index plus a note for an unknown name", async () => {
  const idx = await call("get_motion_recipe");
  assert.equal(idx.isError, false);
  assert.ok(idx.content[0].text.includes("riso") && idx.content[0].text.includes("look:<id>"));
  const one = await call("get_motion_recipe", { name: "riso" });
  assert.ok(one.content[0].text.includes('"blend":"multiply"'));
  assert.equal((await call("get_motion_recipe", { name: " LOOK:Cartel " })).isError, false);
  const none = await call("get_motion_recipe", { name: "nope" });
  assert.equal(none.isError, true);
  assert.ok(none.content[0].text.startsWith('No recipe called "nope"') && none.content[0].text.includes("riso"));
  assert.equal(motionRecipe("").found, true);
});

test("tools/list: get_motion_recipe has a short description and an optional name", async () => {
  let body;
  await handler({ method: "POST", headers: {}, body: { jsonrpc: "2.0", id: 1, method: "tools/list" } }, { setHeader() {}, end(x) { body = x; }, statusCode: 200 });
  const t = JSON.parse(body).result.tools.find((x) => x.name === "get_motion_recipe");
  assert.ok(t.description.length < 260);
  assert.equal(t.annotations.readOnlyHint, true);
  assert.deepEqual(t.inputSchema.required, undefined);
  assert.equal(t.outputSchema, undefined);
});

test("validate_json adds the checklist only to valid compositions, never next to errors", () => {
  const ok = validateJson(wrap("camera"));
  assert.deepEqual(ok.checklist, CHECKLIST);
  assert.ok(CHECKLIST.length <= 10);
  const bad = validateJson({ ...wrap("camera"), layers: [{ id: "x", type: "text", start: 0, end: 4, props: { text: "A very long headline that cannot fit", x: 540, y: 960, size: 200 } }] });
  assert.equal(bad.valid, false);
  assert.equal(bad.checklist, undefined);
});

test("create_hcmotion returns the checklist once the file is created, and none when it is not", async () => {
  const bad = await call("create_hcmotion", { json: { version: 1 } });
  assert.equal(JSON.parse(bad.content[0].text).checklist, undefined);
});
