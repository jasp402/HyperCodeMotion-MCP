import test from "node:test";
import assert from "node:assert/strict";
import { applyPatch } from "../src/patch.js";

const base = () => ({
  cuadrado: { layers: [{ props: { fontSize: 100 } }], docs: { s1: "<h1 style=\"font-size:100px\">Hola</h1>" } },
  vertical: { layers: [{ props: { fontSize: 110 } }], docs: { s1: "<h1 style=\"font-size:110px\">Hola</h1>" } },
  horizontal: { layers: [{ props: { fontSize: 125 } }], docs: { s1: "<h1 style=\"font-size:125px\">Hola</h1>" } }
});

test("replace, add, remove and edit, per variant or on all three", () => {
  const src = base();
  const { docs, errors } = applyPatch(src, [
    { op: "replace", path: "/layers/0/props/fontSize", value: 90, variants: ["vertical"] },
    { op: "add", path: "/layers/-", value: { props: { fontSize: 10 } } },
    { op: "remove", path: "/docs/s1", variants: ["horizontal"] },
    { op: "edit", path: "/docs/s1", find: ">Hola<", replace: ">Hey<", variants: ["cuadrado", "vertical"] }
  ]);
  assert.deepEqual(errors, []);
  assert.equal(docs.vertical.layers[0].props.fontSize, 90); assert.equal(docs.cuadrado.layers[0].props.fontSize, 100);
  assert.equal(docs.horizontal.layers.length, 2); assert.equal(docs.horizontal.docs.s1, undefined);
  assert.match(docs.cuadrado.docs.s1, />Hey</);
  assert.equal(src.cuadrado.layers.length, 1, "the input is not changed");
});

test("bad operations are reported, not guessed", () => {
  const e = p => applyPatch(base(), p).errors.map(x => x.code);
  assert.deepEqual(e([{ op: "replace", path: "/layers/5/props/fontSize", value: 1 }]), ["PATCH_PATH"]);
  assert.deepEqual(e([{ op: "edit", path: "/docs/s1", find: "zzz", replace: "" }]), ["EDIT_NOT_FOUND"]);
  assert.deepEqual(e([{ op: "edit", path: "/layers/0/props/fontSize", find: "1", replace: "2" }]), ["PATCH_PATH"]);
  assert.deepEqual(e([{ op: "move", path: "/a" }]), ["INVALID_OP"]);
  assert.deepEqual(e([{ op: "replace", path: "/x", value: 1, variants: ["otro"] }]), ["INVALID_OP"]);
  assert.deepEqual(e([]), ["MISSING"]);
});
