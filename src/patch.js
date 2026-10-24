// Revisiones baratas: en vez de reenviar las 3 composiciones, Claude manda solo los cambios.
// Cada operación: { op: "replace" | "add" | "remove" | "edit", path: "/layers/3/props/fontSize", value?, find?, replace?, variants? }
//   replace/add/remove: como JSON Patch (RFC 6902) sobre un puntero JSON (RFC 6901); "add" con "-" añade al final de un array
//   edit: cambia un trozo de un texto (p. ej. el CSS o el HTML de un doc): `find` debe aparecer exactamente una vez
//   variants: a qué composiciones se aplica (por defecto las tres)
export const VARIANTS = ["cuadrado", "vertical", "horizontal"];
export const MAX_OPS = 200;

const unescape = s => s.replace(/~1/g, "/").replace(/~0/g, "~");
const parse = path => {
  if (typeof path !== "string" || !path.startsWith("/")) return null;
  return path.slice(1).split("/").map(unescape);
};
const isIndex = (arr, k, allowEnd) => /^(0|[1-9]\d*)$/.test(k) && Number(k) < arr.length + (allowEnd ? 1 : 0);

/** Aplica `ops` a una copia de `docs` ({cuadrado, vertical, horizontal}). Devuelve { docs, errors }. */
export function applyPatch(docs, ops) {
  const errors = [];
  if (!Array.isArray(ops) || !ops.length) return { docs, errors: [{ path: "$.patch", code: "MISSING", message: "patch must be a non-empty array of operations." }] };
  if (ops.length > MAX_OPS) return { docs, errors: [{ path: "$.patch", code: "TOO_LARGE", message: `At most ${MAX_OPS} operations: send the full compositions instead.` }] };
  const out = structuredClone(docs);
  ops.forEach((o, i) => {
    const at = `$.patch[${i}]`;
    const fail = (code, message) => errors.push({ path: at, code, message });
    if (!o || typeof o !== "object") return fail("INVALID_OP", "Each operation is an object.");
    const variants = o.variants == null ? VARIANTS : Array.isArray(o.variants) ? o.variants : [o.variants];
    if (!variants.length || variants.some(v => !VARIANTS.includes(v))) return fail("INVALID_OP", `variants must be among ${VARIANTS.join(", ")}.`);
    if (!["replace", "add", "remove", "edit"].includes(o.op)) return fail("INVALID_OP", "op must be replace, add, remove or edit.");
    const keys = parse(o.path);
    if (!keys || !keys.length) return fail("PATCH_PATH", "path must be a JSON pointer inside the composition, such as /layers/2/props/fontSize.");
    if (o.op !== "remove" && o.op !== "edit" && !("value" in o)) return fail("INVALID_OP", `${o.op} needs a value.`);
    if (o.op === "edit" && (typeof o.find !== "string" || !o.find || typeof o.replace !== "string")) return fail("INVALID_OP", "edit needs find (non-empty) and replace strings.");
    for (const v of variants) {
      let parent = out[v];
      for (const k of keys.slice(0, -1)) {
        parent = Array.isArray(parent) ? (isIndex(parent, k) ? parent[Number(k)] : undefined) : parent && typeof parent === "object" ? parent[k] : undefined;
        if (parent == null || typeof parent !== "object") return fail("PATCH_PATH", `${o.path} does not exist in ${v}.`);
      }
      const last = keys.at(-1);
      const arr = Array.isArray(parent);
      const has = arr ? isIndex(parent, last) : Object.hasOwn(parent, last);
      if (o.op === "add") {
        if (arr) {
          if (last !== "-" && !isIndex(parent, last, true)) return fail("PATCH_PATH", `${o.path}: no such position in ${v}.`);
          parent.splice(last === "-" ? parent.length : Number(last), 0, structuredClone(o.value));
        } else parent[last] = structuredClone(o.value);
        continue;
      }
      if (!has) return fail("PATCH_PATH", `${o.path} does not exist in ${v}.`);
      if (o.op === "remove") { arr ? parent.splice(Number(last), 1) : delete parent[last]; continue; }
      if (o.op === "replace") { parent[arr ? Number(last) : last] = structuredClone(o.value); continue; }
      const cur = parent[arr ? Number(last) : last];
      if (typeof cur !== "string") return fail("PATCH_PATH", `${o.path} in ${v} is not text: edit only changes strings.`);
      const n = cur.split(o.find).length - 1;
      if (n !== 1) return fail("EDIT_NOT_FOUND", `find appears ${n} times in ${o.path} of ${v}; it must appear exactly once (widen it).`);
      parent[arr ? Number(last) : last] = cur.replace(o.find, () => o.replace);
    }
  });
  return { docs: out, errors };
}
