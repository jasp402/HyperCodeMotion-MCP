import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { reservedDeclarations, checkReservedNames, CODE_RESERVED, COMPONENT_RESERVED, HELPER_NAMES, CODE_SCOPE_NAMES, COMPONENT_SCOPE_NAMES } from "../src/reserved.js";
import { validateJson, getCapabilities } from "../src/contract.js";
import { motionRecipe, RECIPE_NAMES, recipeFragment } from "../src/recipes.js";
import handler from "../api/mcp.js";
import { setStore } from "../src/files.js";

const names = (code, reserved) => reservedDeclarations(code, reserved).map(d => d.name);
const comp = (code, extra = {}) => ({ version: 1, name: "T", width: 1080, height: 1920, fps: 30, duration: 6, background: "#111", params: {}, layers: [{ id: "wave", type: "code", start: 0, end: 6, props: { x: 540, y: 960, w: 1080, h: 1920 }, code }], ...extra });

test("flags top-level declarations of reserved names", () => {
  assert.deepEqual(names("const S=[[0,2.8],[3.7,5.4]]; for(const [s,e] of S){}"), ["S"]);
  assert.deepEqual(names("let t=0;"), ["t"]);
  assert.deepEqual(names("var w=1, h=2"), ["w", "h"]);
  assert.deepEqual(names("function range(){ return 1 }"), ["range"]);
  assert.deepEqual(names("async function wave(){}\nclass H {}"), ["wave", "H"]);
  assert.deepEqual(names("const {w}=x;"), ["w"]);
  assert.deepEqual(names("const {a:h, b:{c:p}, ...ease}=y; const [q,,amp=3,...rest]=z;"), ["h", "p", "ease", "amp"]);
  assert.deepEqual(names("for (const S of list) {}"), ["S"]);
  assert.deepEqual(names("for (let t=0;t<3;t++) {}"), ["t"]);
  assert.deepEqual(names("for (const k in o) {}\ntry{}catch(amp){}"), ["amp"]);
  assert.deepEqual(names("const a=1,\n  hit=2, ok=3"), ["hit"]);
  assert.deepEqual(names("const ctx2=ctx, ctx=1"), ["ctx"]);
});

test("does not flag valid names, other scopes, or look-alikes", () => {
  assert.deepEqual(names("const SEG=[[0,2.8],[3.7,5.4]]; for (const [s,e] of SEG) { ctx.fillRect(s,e,1,1) }"), []);
  assert.deepEqual(names("obj.S=1; obj.const=2; this.t=3; foo.range(2)"), []);
  assert.deepEqual(names("const o={S:1,t:2,w}; foo({S:1,h:2})"), []);
  assert.deepEqual(names("const x='const S=1'; const y=\"let t=2\"; const z=`var w=${t} function range(){}`;"), []);
  assert.deepEqual(names("// const S=1\n/* let t=2\n var w=3 */ const ok=1;"), []);
  assert.deepEqual(names("const r=/const S=1/g, d=a/b/c; let q=1"), []);
  assert.deepEqual(names("const f=(t)=>t*2; arr.map(w=>w); function g(h){ const S=1; }"), []);
  assert.deepEqual(names("for (const i of [1,2]) { const S=i; let t=1 }"), []);
  assert.deepEqual(names("if (a) { var w=1 }"), []);
  assert.deepEqual(names("const f=function range(){}; const a=1\nS=2, t=3"), []);
  assert.deepEqual(names("const letter=1, constant=2, S2=3, tt=4, t_=5, $S=6"), []);
  assert.deepEqual(names(""), []);
  assert.deepEqual(names(undefined), []);
});

test("the Studio scope differs for components: c is theirs, color/amount/amp/beat/hit/audio are not", () => {
  assert.deepEqual(names("const c=1; const amp=2;", COMPONENT_RESERVED), ["c"]);
  assert.deepEqual(names("const c=1; const amp=2;", CODE_RESERVED), ["amp"]);
});

test("validate_json warns (never errors) with layer id, name, rename and the reserved list", () => {
  const r = validateJson(comp("const S=[[0,2.8]]; const range=3; for (const [s,e] of S) {}"));
  assert.equal(r.valid, true);
  const w = r.warnings.filter(x => x.code === "RESERVED_NAME_DECLARED");
  assert.equal(w.length, 1);
  assert.equal(w[0].path, "$.layers[0].code");
  assert.match(w[0].message, /layer "wave"/);
  assert.match(w[0].message, /"S" \(e\.g\. SEG\)/);
  assert.match(w[0].message, /"range" \(e\.g\. ranges\)/);
  for (const n of ["ctx", "S", "H", "audio", "lerp", "range"]) assert.ok(w[0].message.includes(n));
  assert.ok(r.checklist, "still a valid composition");
});

test("clean code and non-code layers produce no warning", () => {
  const r = validateJson(comp("const SEG=[[0,2.8]]; for (const [s,e] of SEG) {}"));
  assert.equal(r.warnings.some(x => x.code === "RESERVED_NAME_DECLARED"), false);
  const text = comp("x", { layers: [{ id: "a", type: "text", start: 0, end: 6, props: { text: "const S=1" }, code: "const S=1" }] });
  assert.equal(validateJson(text).warnings.some(x => x.code === "RESERVED_NAME_DECLARED"), false);
});

test("components and improvement patches are checked; the list is sent once", () => {
  const c = comp("const S=1", { layers: [{ id: "a", type: "code", start: 0, end: 6, props: {}, code: "let t=1" }, { id: "b", type: "code", start: 0, end: 6, props: {}, code: "const w=1" }], components: { dot: { w: 10, h: 10, draw: "const c=1;" } } });
  const w = validateJson(c).warnings.filter(x => x.code === "RESERVED_NAME_DECLARED");
  assert.deepEqual(w.map(x => x.path), ["$.layers[0].code", "$.layers[1].code", "$.components.dot.draw"]);
  assert.match(w[0].message, /Reserved in code layers/);
  assert.doesNotMatch(w[1].message, /Reserved in/);
  assert.match(w[1].message, /Same rule as above/);
  const imp = checkReservedNames({ add: [{ id: "n", type: "code", start: 0, end: 2, props: {}, code: "const H=1" }] });
  assert.equal(imp[0].path, "$.add[0].code");
});

test("create_hcmotion returns the warning and still creates the file", async () => {
  const files = new Map();
  setStore({ put: async (p, b) => { files.set(p, b); }, get: async p => files.get(p) ?? null, list: async () => ({ blobs: [], hasMore: false }), del: async () => {} });
  let raw; const res = { statusCode: 200, setHeader() {}, end(x) { raw = x; } };
  await handler({ method: "POST", headers: {}, body: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "create_hcmotion", arguments: { json: comp("const S=1") } } } }, res);
  const out = JSON.parse(raw).result.structuredContent;
  assert.equal(out.created, true);
  assert.deepEqual(out.errors, []);
  assert.ok(out.warnings.some(x => x.code === "RESERVED_NAME_DECLARED"));
  assert.equal(files.size, 1);
});

test("get_capabilities documents the reserved names", () => {
  const c = getCapabilities();
  assert.match(c.reservedCodeNames.rule, /SEG/);
  for (const n of ["S", "H", "ctx", "t", "audio", "range", "lerp"]) assert.ok(c.reservedCodeNames.codeLayer.includes(n));
  assert.ok(c.reservedCodeNames.component.includes("c"));
  assert.match(c.start, /reservedCodeNames/);
});

test("no bundled recipe or look declares a reserved name", () => {
  let checked = 0;
  for (const name of RECIPE_NAMES) {
    let f; try { f = recipeFragment(name); } catch { continue; }
    if (!f?.layers) continue;
    checked++;
    assert.deepEqual(checkReservedNames(f), [], name);
  }
  assert.ok(checked >= 10);
  assert.match(motionRecipe("code-texture").text, /Never declare these names/);
});

// The lists are copied from the Studio repo. When a checkout is next to this one (or HCM_STUDIO_DIR), compare them.
const studio = process.env.HCM_STUDIO_DIR || resolve(dirname(fileURLToPath(import.meta.url)), "../../HyperCodeMotion");
const core = join(studio, "packages/core/src");
test("reserved names match the Studio engine (needs a Studio checkout)", { skip: !existsSync(join(core, "render.ts")) && "no Studio checkout (set HCM_STUDIO_DIR)" }, () => {
  const math = readFileSync(join(core, "math.ts"), "utf8");
  const block = /export const HELPERS = \{([\s\S]*?)\n\};/.exec(math)[1];
  const helpers = block.split("\n").map(l => /^\s{2}(\w+)\s*[:,]/.exec(l)?.[1]).filter(Boolean);
  assert.deepEqual(HELPER_NAMES, helpers);
  const render = readFileSync(join(core, "render.ts"), "utf8");
  const code = /compileUserCode<CodeFn>\(`const \{\$\{HELPER_NAMES\}\}=H;const \{([^}]*)\}=S;`/.exec(render)[1].split(",");
  const component = /compileUserCode<CompFn>\(`const \{\$\{HELPER_NAMES\}\}=H;const \{([^}]*)\}=S;`/.exec(render)[1].split(",");
  assert.deepEqual(CODE_SCOPE_NAMES, code);
  assert.deepEqual(COMPONENT_SCOPE_NAMES, component);
});
