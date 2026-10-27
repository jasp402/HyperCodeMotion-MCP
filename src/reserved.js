/**
 * Names the Studio engine already gives to the code of a "code" layer and of a project component.
 * Studio runs that code in a function with the parameters ctx, S, H and the destructured names
 *   const {<helpers>}=H;  const {t,lt,dur,w,h,p,color,amount,amp,beat,hit,audio}=S;   (components: {t,lt,dur,w,h,p,c})
 * Studio now runs the code in an inner scope, so redeclaring one of them no longer fails. It still hides the
 * original for the rest of the code (own `const S=[...]` and then `S.t` breaks), so we warn and ask for another name.
 *
 * SOURCE OF TRUTH: packages/core/src/math.ts (HELPERS) and packages/core/src/render.ts (compileCode, compileComponent)
 * in the Studio repo. The MCP does not import that package, so the lists are copied here ONCE.
 * tests/reserved.test.js compares them with a Studio checkout when one is next to this repo (or HCM_STUDIO_DIR) and fails on drift.
 */
export const HELPER_NAMES = ["sin","cos","tan","asin","acos","atan","atan2","abs","sqrt","pow","exp","log","floor","ceil","round","min","max","sign","hypot","PI","TAU","clamp","lerp","range","smooth","fract","rand","noise","wave","pingpong","mix","hsl","ease"];
const ENGINE = ["ctx", "S", "H"];
export const CODE_SCOPE_NAMES = ["t","lt","dur","w","h","p","color","amount","amp","beat","hit","audio"];
export const COMPONENT_SCOPE_NAMES = ["t","lt","dur","w","h","p","c"];
export const CODE_RESERVED = [...ENGINE, ...CODE_SCOPE_NAMES, ...HELPER_NAMES];
export const COMPONENT_RESERVED = [...ENGINE, ...COMPONENT_SCOPE_NAMES, ...HELPER_NAMES];

/** One rule for get_capabilities, the skill and the warnings. The name lists travel next to it, once. */
export const RESERVED_RULE = "Inside layer.code and components[x].draw never declare (const, let, var, function, class) a name the engine already provides; pick another (S -> SEG, range -> ranges). Example: const SEG=[[0,2.8],[3.7,5.4]]; for (const [s,e] of SEG) { /* ... */ }";

const RENAME = { S: "SEG", H: "HH", ctx: "cv", t: "tick", lt: "local", dur: "len", w: "bw", h: "bh", p: "pt", c: "cc", color: "col", amount: "amt", amp: "level", beat: "pulse", hit: "knock", audio: "snd", range: "ranges", wave: "wav", noise: "nz", mix: "blended", ease: "easing", rand: "rnd", hsl: "hslColor" };
export const suggestRename = (name) => RENAME[name] ?? `my${name[0].toUpperCase()}${name.slice(1)}`;

// ---------- tokenizer: just enough JavaScript to find declarations, not a parser ----------
const ID_START = /[A-Za-z_$\u00A0-\uFFFF]/, ID_PART = /[A-Za-z0-9_$\u00A0-\uFFFF]/;
const KEYWORDS_BEFORE_REGEX = new Set(["return", "typeof", "instanceof", "in", "of", "new", "delete", "void", "throw", "case", "do", "else", "yield", "await"]);

/** Tokens {type: "id"|"num"|"str"|"punct", v, line, depth}. Strings, templates, comments and regexes become one opaque token or vanish. depth = open braces. */
export function tokenize(src) {
  const toks = [];
  let i = 0, line = 1, depth = 0;
  const n = src.length;
  const push = (type, v) => toks.push({ type, v, line, depth });
  const regexAllowed = () => {
    const last = toks[toks.length - 1];
    if (!last) return true;
    if (last.type === "num" || last.type === "str") return false;
    if (last.type === "id") return KEYWORDS_BEFORE_REGEX.has(last.v);
    return !(last.v === ")" || last.v === "]" || last.v === "}");
  };
  function skipString(q) { // returns index after the closing quote
    let j = i + 1;
    while (j < n && src[j] !== q) { if (src[j] === "\\") j++; if (src[j] === "\n") line++; j++; }
    return j + 1;
  }
  function skipTemplate(j) { // j: index after the opening backtick; handles ${ ... } with nesting
    while (j < n && src[j] !== "`") {
      if (src[j] === "\\") { j += 2; continue; }
      if (src[j] === "\n") line++;
      if (src[j] === "$" && src[j + 1] === "{") {
        let d = 1; j += 2;
        while (j < n && d > 0) {
          const ch = src[j];
          if (ch === "{") d++;
          else if (ch === "}") d--;
          else if (ch === "`") { j = skipTemplate(j + 1) - 1; }
          else if (ch === "'" || ch === '"') { const save = i; i = j; j = skipString(ch) - 1; i = save; }
          else if (ch === "\n") line++;
          j++;
        }
        continue;
      }
      j++;
    }
    return j + 1;
  }
  while (i < n) {
    const ch = src[i];
    if (ch === "\n") { line++; i++; continue; }
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; continue; }
    if (ch === "/" && src[i + 1] === "*") { const e = src.indexOf("*/", i + 2); const end = e < 0 ? n : e + 2; for (let k = i; k < end; k++) if (src[k] === "\n") line++; i = end; continue; }
    if (ch === "'" || ch === '"') { i = skipString(ch); push("str", ""); continue; }
    if (ch === "`") { i = skipTemplate(i + 1); push("str", ""); continue; }
    if (ch === "/" && regexAllowed()) {
      let j = i + 1, cls = false;
      while (j < n && src[j] !== "\n" && (cls || src[j] !== "/")) { if (src[j] === "\\") j++; else if (src[j] === "[") cls = true; else if (src[j] === "]") cls = false; j++; }
      i = j + 1; while (i < n && ID_PART.test(src[i])) i++;
      push("str", ""); continue;
    }
    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      let j = i + 1; while (j < n && /[0-9A-Za-z_.]/.test(src[j])) { if ((src[j] === "e" || src[j] === "E") && /[+-]/.test(src[j + 1] ?? "")) j++; j++; }
      i = j; push("num", ""); continue;
    }
    if (ID_START.test(ch)) {
      let j = i + 1; while (j < n && ID_PART.test(src[j])) j++;
      push("id", src.slice(i, j)); i = j; continue;
    }
    if (ch === "{") { push("punct", "{"); depth++; i++; continue; }
    if (ch === "}") { depth = Math.max(0, depth - 1); push("punct", "}"); i++; continue; }
    if (ch === "." && src[i + 1] === "." && src[i + 2] === ".") { push("punct", "..."); i += 3; continue; }
    if (ch === "=" && src[i + 1] === ">") { push("punct", "=>"); i += 2; continue; }
    push("punct", ch); i++;
  }
  return toks;
}

const CONTINUES = new Set(["in", "of", "instanceof"]);
const endsValue = (t) => t.type === "num" || t.type === "str" || (t.type === "id" && !KEYWORDS_BEFORE_REGEX.has(t.v)) || t.v === ")" || t.v === "]" || t.v === "}";
const OPEN = { "(": ")", "[": "]", "{": "}" };
const isId = (t) => t && t.type === "id";

/** Index after the expression starting at i: stops, at nesting 0, before one of `stops` or a closing bracket. */
function skipExpr(toks, i, stops) {
  let d = 0;
  for (; i < toks.length; i++) {
    const t = toks[i], prev = toks[i - 1];
    // automatic semicolon: a value that ends a line followed by a value that starts the next one is a new statement
    if (d === 0 && prev && t.line > prev.line && endsValue(prev) && (t.type === "num" || t.type === "str" || (t.type === "id" && !CONTINUES.has(t.v)))) return i;
    if (t.type === "punct") {
      if (t.v in OPEN) d++;
      else if (t.v === ")" || t.v === "]" || t.v === "}") { if (d === 0) return i; d--; }
      else if (d === 0 && stops.includes(t.v)) return i;
    } else if (d === 0 && t.type === "id" && stops.includes(t.v)) return i;
  }
  return i;
}

/** Binding pattern at i (identifier, {…} or […]); pushes the bound names into out and returns the index after it. */
function pattern(toks, i, out) {
  const t = toks[i];
  if (!t) return i;
  if (isId(t)) { out.push({ name: t.v, line: t.line }); return i + 1; }
  if (t.v === "[") {
    i++;
    while (i < toks.length && toks[i].v !== "]") {
      if (toks[i].v === ",") { i++; continue; }
      if (toks[i].v === "...") i++;
      const before = i;
      i = pattern(toks, i, out);
      if (toks[i]?.v === "=") i = skipExpr(toks, i + 1, [","]);
      if (i === before) i++;
    }
    return i + 1;
  }
  if (t.v === "{") {
    i++;
    while (i < toks.length && toks[i].v !== "}") {
      if (toks[i].v === ",") { i++; continue; }
      if (toks[i].v === "...") { i = pattern(toks, i + 1, out); continue; }
      if (toks[i].v === "[") { i = skipExpr(toks, i + 1, []) + 1; } // computed key
      else i++;                                                      // key (id, string or number)
      if (toks[i]?.v === ":") { i = pattern(toks, i + 1, out); }
      else if (isId(toks[i - 1])) out.push({ name: toks[i - 1].v, line: toks[i - 1].line }); // shorthand {w}
      if (toks[i]?.v === "=") i = skipExpr(toks, i + 1, [","]);
    }
    return i + 1;
  }
  return i + 1;
}

/**
 * Names declared at the top level of `src` (outside any {...}): const/let/var (with destructuring, also in
 * for headers), function and class declarations, and catch parameters. Parameters of own functions are left alone:
 * they are local to that function and harmless. Strings, comments, `obj.S` and `{S:1}` keys never match.
 * It is a lexer plus a few rules: it can miss odd code, it does not flag valid code on purpose.
 */
export function topLevelDeclarations(src) {
  const toks = tokenize(String(src ?? ""));
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.depth !== 0 || t.type !== "id") continue;
    const prev = toks[i - 1];
    if (prev && prev.v === "." && prev.type === "punct") continue; // obj.const
    if (t.v === "const" || t.v === "let" || t.v === "var") {
      if (t.v === "let" && !(isId(toks[i + 1]) || toks[i + 1]?.v === "[" || toks[i + 1]?.v === "{")) continue;
      let j = i + 1;
      for (;;) {
        const before = j;
        j = pattern(toks, j, out);
        if (toks[j]?.v === "=") j = skipExpr(toks, j + 1, [",", ";", "of", "in"]);
        if (toks[j]?.v === ",") { j++; continue; }
        if (j === before) j++;
        break;
      }
    } else if (t.v === "function" || t.v === "class") {
      const stmt = !prev || prev.line < t.line || prev.v === ";" || prev.v === "}" || (prev.v === "async" && t.v === "function");
      if (!stmt) continue;
      let j = i + 1;
      if (toks[j]?.v === "*") j++;
      if (isId(toks[j]) && toks[j].v !== "extends") out.push({ name: toks[j].v, line: toks[j].line });
    } else if (t.v === "catch" && toks[i + 1]?.v === "(") {
      pattern(toks, i + 2, out);
    }
  }
  return out;
}

/** Declared names of `src` that the engine already provides. [{name, line}] without repeats. */
export function reservedDeclarations(src, reserved = CODE_RESERVED) {
  const set = new Set(reserved), seen = new Set(), out = [];
  for (const d of topLevelDeclarations(src)) if (set.has(d.name) && !seen.has(d.name)) { seen.add(d.name); out.push(d); }
  return out;
}

/** The JSON paths and code strings of one composition (or improvement patch) that run as code. */
function* codeSources(input) {
  const layer = function* (l, path) {
    if (l && typeof l === "object" && l.type === "code" && typeof l.code === "string")
      yield { path: `${path}.code`, owner: `layer "${l.id ?? path}"`, code: l.code, reserved: CODE_RESERVED };
  };
  if (Array.isArray(input?.layers)) for (const [i, l] of input.layers.entries()) yield* layer(l, `$.layers[${i}]`);
  if (Array.isArray(input?.add)) for (const [i, l] of input.add.entries()) yield* layer(l, `$.add[${i}]`);
  if (Array.isArray(input?.change)) for (const [i, c] of input.change.entries()) if (c && typeof c.code === "string") yield { path: `$.change[${i}].code`, owner: `layer "${c.id ?? i}"`, code: c.code, reserved: CODE_RESERVED };
  const comps = input?.components;
  if (comps && typeof comps === "object" && !Array.isArray(comps))
    for (const [name, def] of Object.entries(comps)) if (def && typeof def.draw === "string") yield { path: `$.components.${name}.draw`, owner: `component "${name}"`, code: def.draw, reserved: COMPONENT_RESERVED };
}

/**
 * Non-blocking warnings (code RESERVED_NAME_DECLARED), one per layer or component, naming every reserved name it declares
 * and a rename. Only the first carries the full list of reserved names, to keep the answer short.
 */
export function checkReservedNames(input) {
  const out = [];
  for (const { path, owner, code, reserved } of codeSources(input)) {
    const found = reservedDeclarations(code, reserved);
    if (!found.length) continue;
    const names = found.map(f => `"${f.name}" (e.g. ${suggestRename(f.name)})`).join(", ");
    const list = reserved === COMPONENT_RESERVED ? COMPONENT_RESERVED : CODE_RESERVED;
    const tail = out.length ? "Same rule as above." : `${RESERVED_RULE}. Reserved in ${reserved === COMPONENT_RESERVED ? "components" : "code layers"}: ${list.join(", ")}.`;
    out.push({ path, code: "RESERVED_NAME_DECLARED", message: `The code of ${owner} declares ${names}: the engine already provides ${found.length > 1 ? "those names" : "that name"} (S is the object with t, w, h, amp...; the others are time, size, params and helpers). Studio tolerates it, but the original is hidden for the rest of the code. Rename ${found.length > 1 ? "them" : "it"} and keep every use consistent. ${tail}` });
  }
  return out;
}
