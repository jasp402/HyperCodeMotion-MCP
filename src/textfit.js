/**
 * Whether text can fit the canvas. Numbers only: no HTML is executed and nothing is drawn.
 * Native text uses the same width estimate as Studio's PANTALLA rule. HTML is read for
 * font-size, line-height and absolute boxes. Expressions, rotation and parented placement
 * are left unmeasured.
 */
import { frameOf, TEXT_WIDTH, TEXT_WIDTH_WIDE } from "./frame.js";

const obj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const finite = (x) => typeof x === "number" && Number.isFinite(x);
const issue = (path, code, message) => ({ path, code, message });

const DEFAULTS = { text: "HyperCodeMotion", size: 120, lineHeight: 1.1, x: 540, y: 960, align: "center", tracking: 0, scale: 1 };

/** @returns {{ values: number[], expr: boolean, missing: boolean }} */
function series(value) {
  if (finite(value)) return { values: [value], expr: false, missing: false };
  if (obj(value) && Array.isArray(value.kf)) {
    const values = value.kf.map((k) => k && k.v).filter(finite);
    return { values, expr: false, missing: values.length === 0 };
  }
  if (obj(value) && typeof value.expr === "string") return { values: [], expr: true, missing: false };
  return { values: [], expr: false, missing: true };
}

/**
 * The strings a text prop can show: a plain string, or every string value of its keyframes
 * (a counter or a text that changes over time). null when it is an expression (unmeasurable).
 * @returns {string[] | null}
 */
function textVariants(value) {
  if (typeof value === "string") return [value];
  if (obj(value) && Array.isArray(value.kf)) {
    const found = value.kf.map((k) => (k && (typeof k.v === "string" || finite(k.v)) ? String(k.v) : null)).filter((v) => v !== null);
    return found.length ? found : [DEFAULTS.text];
  }
  if (obj(value) && typeof value.expr === "string") return null;
  return [DEFAULTS.text];
}

function widestFactor(line) {
  const letters = [...line].filter((c) => c.toLowerCase() !== c.toUpperCase());
  const upper = letters.filter((c) => c === c.toUpperCase()).length;
  return letters.length > 0 && upper / letters.length >= 0.6 ? TEXT_WIDTH_WIDE : TEXT_WIDTH;
}

/** Estimated advance width of one line, in px. */
export function lineWidth(line, size, tracking = 0) {
  const chars = [...line].length;
  if (!chars || !(size > 0)) return 0;
  const raw = chars * size * widestFactor(line) + Math.max(0, chars - 1) * (finite(tracking) ? tracking : 0);
  return Math.max(size * 0.2 * chars, raw);
}

function blockSize(text, size, lineHeight, tracking) {
  const lines = String(text).split(/\n/);
  const used = lines.length ? lines : [""];
  const w = Math.max(0, ...used.map((line) => lineWidth(line, size, tracking)));
  const h = used.length * size * Math.max(lineHeight, 1);
  return { w, h, lines: used.length };
}

/**
 * @param {object} input composition or improvement patch
 * @param {object} [composition] existing project, for a patch
 */
export function textFitIssues(input, composition) {
  const errors = [];
  const warnings = [];
  const fail = (path, code, message) => errors.push(issue(path, code, message));
  const warn = (path, code, message) => warnings.push(issue(path, code, message));
  if (!obj(input)) return { errors, warnings };

  if (Array.isArray(input.layers)) {
    if (!(finite(input.width) && finite(input.height) && input.width > 0 && input.height > 0)) return { errors, warnings };
    input.layers.forEach((layer, i) => {
      if (obj(layer) && layer.type === "text") checkText(layer, `$.layers[${i}]`, input.width, input.height, fail, warn);
    });
    checkDocs(input.docs, input.width, input.height, fail, warn);
    overlapIssues(input, warn);
    return { errors, warnings };
  }

  const host = obj(composition) && finite(composition.width) && finite(composition.height) ? composition : null;
  const added = Array.isArray(input.add) ? input.add : [];
  const changed = Array.isArray(input.change) ? input.change : [];
  const touchesText = added.some((l) => obj(l) && l.type === "text") || changed.some((c) => obj(c) && obj(c.props) && TEXT_KEYS.some((k) => Object.hasOwn(c.props, k)));
  if (!touchesText) return { errors, warnings };
  if (!host) {
    warn("$", "TEXT_FIT_UNCHECKED", "Text fit needs the existing project's width and height. Pass it as composition.");
    return { errors, warnings };
  }
  const byId = new Map(Array.isArray(host.layers) ? host.layers.filter(obj).map((layer) => [layer.id, layer]) : []);
  added.forEach((layer, i) => {
    if (obj(layer) && layer.type === "text") checkText(layer, `$.add[${i}]`, host.width, host.height, fail, warn);
  });
  changed.forEach((change, i) => {
    if (!obj(change) || !obj(change.props) || !TEXT_KEYS.some((k) => Object.hasOwn(change.props, k))) return;
    const prev = byId.get(change.id);
    if (!obj(prev) || prev.type !== "text") return;
    const merged = { ...prev, props: { ...prev.props, ...change.props } };
    checkText(merged, `$.change[${i}]`, host.width, host.height, fail, warn);
  });
  return { errors, warnings };
}

const TEXT_KEYS = ["text", "size", "lineHeight", "x", "y", "align", "tracking", "scale", "scaleX", "scaleY"];

function checkText(layer, path, W, H, fail, warn) {
  if (!obj(layer.props)) return;
  const props = layer.props;
  const frame = frameOf(W, H);
  const sizeSeries = series(props.size);
  const lhSeries = series(props.lineHeight);
  if (sizeSeries.expr || lhSeries.expr) {
    warn(`${path}.props`, "TEXT_FIT_UNEVALUATED", "size or lineHeight is an expression, so fit was not measured.");
    return;
  }
  const size = sizeSeries.values.length ? Math.max(...sizeSeries.values) : DEFAULTS.size;
  const lineHeight = lhSeries.values.length ? Math.min(...lhSeries.values) : DEFAULTS.lineHeight;
  if (!(size > 0)) return;
  if (lineHeight < 1) {
    fail(`${path}.props.lineHeight`, "TEXT_LINE_HEIGHT", `lineHeight ${lineHeight} is below 1, so the box is shorter than the glyphs and crops them. Use at least 1.`);
  }
  // text may carry keyframes (a counter, swapped words): measure the biggest value it takes, not the default text
  const variants = textVariants(props.text);
  if (variants === null) {
    warn(`${path}.props`, "TEXT_FIT_UNEVALUATED", "text is an expression, so fit was not measured.");
    return;
  }
  const trackingSeries = series(props.tracking);
  const tracking = trackingSeries.values.length ? Math.max(...trackingSeries.values) : DEFAULTS.tracking;
  const scale = axis(props.scale, DEFAULTS.scale) * axis(props.scaleX, 1);
  const scaleY = axis(props.scale, DEFAULTS.scale) * axis(props.scaleY, 1);
  const blocks = variants.map((text) => blockSize(text, size, Math.max(lineHeight, 1), tracking));
  const boxW = Math.max(...blocks.map((b) => b.w)) * scale;
  const boxH = Math.max(...blocks.map((b) => b.h)) * scaleY;
  if (boxW > frame.safeW + 1 || boxH > frame.safeH + 1) {
    fail(`${path}.props`, "TEXT_DOES_NOT_FIT", `This text is about ${Math.ceil(boxW)}×${Math.ceil(boxH)} px. The ${frame.name} safe area is ${frame.safeW}×${frame.safeH} px (canvas ${W}×${H}; starting title ${frame.title} px, not a minimum). Lower size or wrap lines with \\n. The screen wins over a requested size.`);
  }
  // Placement is the layer's own x/y. A parent moves it; that offset is not measured.
  if (typeof layer.parent === "string") return;
  placeBox(path, props, boxW, boxH, W, H, frame, fail, warn);
}

function axis(value, fallback) {
  const s = series(value);
  if (s.expr || !s.values.length) return fallback;
  return Math.max(...s.values.map((v) => Math.abs(v)));
}

function placeBox(path, props, boxW, boxH, W, H, frame, fail, warn) {
  const xs = series(props.x);
  const ys = series(props.y);
  if (xs.expr || ys.expr) {
    warn(`${path}.props`, "TEXT_FIT_UNEVALUATED", "x or y is an expression, so placement was not measured.");
    return;
  }
  const align = props.align === "left" || props.align === "right" ? props.align : DEFAULTS.align;
  const xValues = xs.values.length ? xs.values : [DEFAULTS.x];
  const yValues = ys.values.length ? ys.values : [DEFAULTS.y];
  let outside = false;
  let margin = false;
  for (const x of xValues) {
    for (const y of yValues) {
      const left = align === "left" ? x : align === "right" ? x - boxW : x - boxW / 2;
      const top = y - boxH / 2;
      if (left < -1 || top < -1 || left + boxW > W + 1 || top + boxH > H + 1) outside = true;
      else if (left < frame.mx - 1 || top < frame.my - 1 || left + boxW > W - frame.mx + 1 || top + boxH > H - frame.mb + 1) margin = true;
    }
  }
  if (outside) fail(`${path}.props`, "TEXT_OUTSIDE_CANVAS", `This text crosses the ${W}×${H} canvas, so the screen crops it. Move it inside or lower the size.`);
  else if (margin) warn(`${path}.props`, "TEXT_OUTSIDE_SAFE", `This text sits outside the safe area (${frame.mx} px each side, ${frame.my} px top, ${frame.mb} px bottom). On a vertical screen the extra top and bottom are where the app icons go.`);
}

function checkDocs(docs, W, H, fail, warn) {
  if (!obj(docs)) return;
  const frame = frameOf(W, H);
  for (const [id, html] of Object.entries(docs)) {
    if (typeof html !== "string") continue;
    const path = `$.docs.${id}`;
    const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
    const bad = lineHeightsBelowOne(css + "\n" + inlineStyles(html));
    if (bad.length) {
      fail(path, "HTML_LINE_HEIGHT", `line-height ${bad.join(", ")} is below 1, so the piece box crops the glyphs. Use at least 1.`);
    }
    const rules = cssRules(css);
    for (const piece of pieces(html)) {
      const style = styleFor(piece, rules);
      const text = visibleText(piece.inner);
      if (!text) continue;
      const upper = style.upper || false;
      const lh = style.lineHeight == null ? 1.05 : Math.max(style.lineHeight, 1);
      const fixedW = style.width;
      const fixedH = style.height;
      const textPiece = fixedW == null;
      if (textPiece && !(style.fontSize > 0)) continue;
      const lines = text.split(/\n/);
      const estimatedW = style.fontSize > 0
        ? Math.max(...lines.map((line) => lineWidth(upper ? line.toUpperCase() : line, style.fontSize, 0)))
        : 0;
      const estimatedH = style.fontSize > 0 ? lines.length * style.fontSize * lh : 0;
      const boxW = fixedW ?? estimatedW;
      const boxH = fixedH ?? estimatedH;
      const where = `${path}["${piece.part}"]`;
      if (textPiece && (estimatedW > frame.safeW + 1 || estimatedH > frame.safeH + 1)) {
        fail(where, "HTML_DOES_NOT_FIT", `"${piece.part}" is about ${Math.ceil(estimatedW)}×${Math.ceil(estimatedH)} px. The ${frame.name} safe area is ${frame.safeW}×${frame.safeH} px (canvas ${W}×${H}; starting title ${frame.title} px, not a minimum). Lower font-size or wrap lines. Do not copy a pixel size from another ratio.`);
      }
      if (style.left == null || style.top == null || !(boxW > 0) || !(boxH > 0)) continue;
      const right = style.left + boxW;
      const bottom = style.top + boxH;
      if (style.left < -1 || style.top < -1 || right > W + 1 || bottom > H + 1) {
        fail(where, "HTML_OUTSIDE_CANVAS", `"${piece.part}" crosses the ${W}×${H} canvas, so the screen crops it.`);
      } else if (textPiece && (style.left < frame.mx - 1 || style.top < frame.my - 1 || right > W - frame.mx + 1 || bottom > H - frame.mb + 1)) {
        warn(where, "HTML_OUTSIDE_SAFE", `"${piece.part}" sits outside the safe area (${frame.mx} px each side, ${frame.my} px top, ${frame.mb} px bottom).`);
      }
    }
  }
}

function lineHeightsBelowOne(css) {
  const found = new Set();
  const unitless = /line-height\s*:\s*(\.\d+|\d+(?:\.\d+)?)(?!\s*(?:px|em|rem|pt|%))/gi;
  const slash = /(\d+(?:\.\d+)?)px\s*\/\s*(\.\d+|\d+(?:\.\d+)?)(?!\s*(?:px|em|rem|pt|%))/gi;
  const percent = /line-height\s*:\s*(\d+(?:\.\d+)?)%/gi;
  const slashPercent = /(\d+(?:\.\d+)?)px\s*\/\s*(\d+(?:\.\d+)?)%/gi;
  for (const re of [unitless]) {
    for (const m of css.matchAll(re)) {
      const n = Number(m[1]);
      if (n > 0 && n < 1) found.add(String(n));
    }
  }
  for (const m of css.matchAll(slash)) {
    const n = Number(m[2]);
    if (n > 0 && n < 1) found.add(String(n));
  }
  for (const m of css.matchAll(percent)) {
    const n = Number(m[1]);
    if (n > 0 && n < 100) found.add(`${n}%`);
  }
  for (const m of css.matchAll(slashPercent)) {
    const n = Number(m[2]);
    if (n > 0 && n < 100) found.add(`${n}%`);
  }
  return [...found];
}

function inlineStyles(html) {
  return [...html.matchAll(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/gi)].map((m) => m[2]).join("\n");
}

function cssRules(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  for (const m of clean.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    if (selector && !selector.startsWith("@")) rules.push({ selector, body: m[2] });
  }
  return rules;
}

function pieces(html) {
  const out = [];
  const re = /<([a-zA-Z][\w:-]*)\b([^>]*?\bdata-hcm\s*=\s*(["'])([^"']*)\3[^>]*)>([\s\S]*?)<\/\1>/g;
  for (const m of html.matchAll(re)) {
    const attrs = m[2];
    const className = attr(attrs, "class");
    out.push({
      tag: m[1].toLowerCase(),
      part: m[4],
      classes: className ? className.split(/\s+/).filter(Boolean) : [],
      inline: attr(attrs, "style") || "",
      inner: m[5],
    });
  }
  return out;
}

function attr(attrs, name) {
  const m = new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i").exec(attrs);
  return m ? m[2] : "";
}

function matches(selector, piece) {
  return selector.split(",").some((part) => {
    const last = part.trim().split(/\s+/).pop() || "";
    const classes = [...last.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
    if (classes.length) return classes.every((c) => piece.classes.includes(c));
    const tag = last.match(/^([a-zA-Z][\w:-]*)/);
    return Boolean(tag && tag[1].toLowerCase() === piece.tag);
  });
}

function styleFor(piece, rules) {
  const style = { fontSize: null, lineHeight: null, upper: false, left: null, top: null, width: null, height: null };
  const apply = (body) => {
    const fontSize = fontSizePx(body);
    if (fontSize != null) style.fontSize = fontSize;
    const lh = unitlessLineHeight(body);
    if (lh != null) style.lineHeight = lh;
    if (/text-transform\s*:\s*uppercase/i.test(body)) style.upper = true;
    const left = pxOf(body, "left");
    const top = pxOf(body, "top");
    if (left != null) style.left = left;
    if (top != null) style.top = top;
    if (/width\s*:\s*max-content/i.test(body)) style.width = null;
    else {
      const width = pxOf(body, "width");
      if (width != null) style.width = width;
    }
    const height = pxOf(body, "height");
    if (height != null) style.height = height;
    centerOf(body, style);
  };
  for (const rule of rules) if (matches(rule.selector, piece)) apply(rule.body);
  apply(piece.inline);
  return style;
}

/**
 * Where a piece centred with `left/top: <n>% | calc(50% ± Npx)` + `transform: translate(-50%,-50%)` sits, as a
 * share of the canvas plus a px offset. Used only for the overlap check; the fit checks above ignore it.
 */
function centerOf(body, style) {
  if (!/translate\(\s*-50%\s*,\s*-50%\s*\)/i.test(body) && style.centered !== true) return;
  const axis = (name) => {
    const m = new RegExp(`(?:^|[;{\\s])${name}\\s*:\\s*(?:calc\\(\\s*(\\d+(?:\\.\\d+)?)%\\s*(?:([+-])\\s*(\\d+(?:\\.\\d+)?)px)?\\s*\\)|(\\d+(?:\\.\\d+)?)%)`, "i").exec(body);
    if (!m) return null;
    if (m[4] !== undefined) return { share: Number(m[4]) / 100, px: 0 };
    return { share: Number(m[1]) / 100, px: m[3] ? (m[2] === "-" ? -1 : 1) * Number(m[3]) : 0 };
  };
  if (/translate\(\s*-50%\s*,\s*-50%\s*\)/i.test(body)) style.centered = true;
  const x = axis("left"), y = axis("top");
  if (x) { style.centerX = x.share; style.centerPx = x.px; }
  if (y) { style.centerY = y.share; style.centerPy = y.px; }
}

function fontSizePx(body) {
  const direct = /font-size\s*:\s*(\d+(?:\.\d+)?)px/i.exec(body);
  if (direct) return Number(direct[1]);
  const font = /(?:^|[;{])\s*font\s*:\s*([^;}]*)/i.exec(body);
  if (!font) return null;
  const px = /(\d+(?:\.\d+)?)px/i.exec(font[1]);
  return px ? Number(px[1]) : null;
}

function unitlessLineHeight(body) {
  const m = /line-height\s*:\s*(\.\d+|\d+(?:\.\d+)?)(?!\s*(?:px|em|rem|pt|%))/i.exec(body);
  return m ? Number(m[1]) : null;
}

function pxOf(body, name) {
  const m = new RegExp(`(?:^|[;{\\s])${name}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)px`, "i").exec(body);
  return m ? Number(m[1]) : null;
}

function visibleText(inner) {
  return inner
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

// ---------- overlap between text blocks ----------

const OVERLAP_MIN_SECONDS = 0.25;
const OVERLAP_MIN_SHARE = 0.3;

/** A number that never changes over time: a plain number, or a keyframe prop whose values are all equal. null when it moves or is an expression. */
function steady(value, fallback) {
  if (value === undefined) return fallback;
  const s = series(value);
  if (s.expr || s.missing) return null;
  return s.values.every((v) => v === s.values[0]) ? s.values[0] : null;
}

/** Blocks whose position, size and text are known and fixed: native text layers and html text pieces. */
function measurableBlocks(input) {
  const W = input.width;
  const H = input.height;
  const end = finite(input.duration) ? input.duration : Infinity;
  const blocks = [];
  const window = (layer) => [finite(layer.start) ? layer.start : 0, finite(layer.end) ? Math.min(layer.end, end) : end];
  input.layers.forEach((layer, i) => {
    if (!obj(layer) || layer.hidden === true || !obj(layer.props) || typeof layer.parent === "string") return;
    const props = layer.props;
    if (layer.type === "text") {
      if (typeof props.text !== "string" || !props.text.trim()) return;
      const x = steady(props.x, DEFAULTS.x), y = steady(props.y, DEFAULTS.y);
      const size = steady(props.size, DEFAULTS.size), lh = steady(props.lineHeight, DEFAULTS.lineHeight);
      const tracking = steady(props.tracking, 0), sc = steady(props.scale, 1), scx = steady(props.scaleX, 1), scy = steady(props.scaleY, 1);
      const opacity = steady(props.opacity, 1);
      // a rotated box is not axis-aligned: left alone
      if (steady(props.rotation, 0) !== 0) return;
      if ([x, y, size, lh, tracking, sc, scx, scy, opacity].some((v) => v === null) || !(size > 0) || opacity <= 0.05) return;
      if (finite(props.copies) && props.copies > 1) return;
      const b = blockSize(props.text, size, Math.max(lh, 1), tracking);
      const w = b.w * sc * scx, h = b.h * sc * scy;
      const align = props.align === "left" || props.align === "right" ? props.align : "center";
      const left = align === "left" ? x : align === "right" ? x - w : x - w / 2;
      const [from, to] = window(layer);
      blocks.push({ name: layer.id || `layer ${i}`, path: `$.layers[${i}]`, text: props.text, left, top: y - h / 2, w, h, from, to });
    }
  });
  const docs = obj(input.docs) ? input.docs : {};
  const parsed = new Map();
  const piecesOf = (id) => {
    if (!parsed.has(id)) {
      const html = typeof docs[id] === "string" ? docs[id] : "";
      const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
      const rules = cssRules(css);
      parsed.set(id, new Map(pieces(html).map((piece) => [piece.part, { piece, style: styleFor(piece, rules) }])));
    }
    return parsed.get(id);
  };
  input.layers.forEach((layer, i) => {
    if (!obj(layer) || layer.type !== "html" || layer.hidden === true || !obj(layer.props) || typeof layer.props.doc !== "string" || typeof layer.props.part !== "string") return;
    const found = piecesOf(layer.props.doc).get(layer.props.part);
    if (!found) return;
    const { piece, style } = found;
    const text = visibleText(piece.inner);
    if (!text || !(style.fontSize > 0) || style.width != null || style.height != null || style.centerX == null || style.centerY == null) return;
    const dx = steady(layer.props.dx, 0), dy = steady(layer.props.dy, 0);
    const opacity = steady(layer.props.opacity, 1);
    if (dx === null || dy === null || opacity === null || opacity <= 0.05 || (layer.props.text !== undefined)) return;
    const sc = steady(layer.props.scale, 1);
    if (sc === null || steady(layer.props.rotation, 0) !== 0) return;
    const lines = text.split(/\n/);
    const w = Math.max(...lines.map((line) => lineWidth(style.upper ? line.toUpperCase() : line, style.fontSize, 0))) * sc;
    const h = lines.length * style.fontSize * Math.max(style.lineHeight == null ? 1.05 : style.lineHeight, 1) * sc;
    const [from, to] = window(layer);
    const cx = style.centerX * W + style.centerPx + dx, cy = style.centerY * H + style.centerPy + dy;
    blocks.push({ name: `${layer.props.doc}/${layer.props.part}`, path: `$.layers[${i}]`, text, left: cx - w / 2, top: cy - h / 2, w, h, from, to });
  });
  return blocks;
}

/**
 * Warns when two text blocks that are on screen at the same time cover each other. Only blocks with a fixed
 * position and known text are compared (no keyframed x/y, no expressions, no parent), so it stays quiet on
 * moving type. A warning, never an error: layered or echoed type can be on purpose.
 */
export function overlapIssues(input, warn) {
  if (!Array.isArray(input.layers) || !(finite(input.width) && finite(input.height))) return;
  const blocks = measurableBlocks(input);
  const seen = new Set();
  for (let a = 0; a < blocks.length; a++) {
    for (let b = a + 1; b < blocks.length; b++) {
      const A = blocks[a], B = blocks[b];
      if (A.text.trim() === B.text.trim()) continue; // an echo, shadow or misregistered copy of the same words
      if (Math.min(A.to, B.to) - Math.max(A.from, B.from) < OVERLAP_MIN_SECONDS) continue;
      const iw = Math.min(A.left + A.w, B.left + B.w) - Math.max(A.left, B.left);
      const ih = Math.min(A.top + A.h, B.top + B.h) - Math.max(A.top, B.top);
      if (!(iw > 0 && ih > 0)) continue;
      const share = (iw * ih) / Math.min(A.w * A.h, B.w * B.h);
      if (share < OVERLAP_MIN_SHARE) continue;
      const key = `${A.path}|${B.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      warn(B.path, "TEXT_OVERLAP", `"${A.name}" and "${B.name}" are on screen together and their estimated boxes overlap by ${Math.round(share * 100)}% of the smaller one (~${Math.round(iw)}×${Math.round(ih)} px). Move one, shrink the type, or stagger them in time; ignore it only if the overlap is the design.`);
    }
  }
}
