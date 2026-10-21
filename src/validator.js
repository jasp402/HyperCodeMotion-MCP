/**
 * Structural validator for HyperCodeMotion JSON.
 * This is a conservative preflight, NOT the complete Studio contract validator.
 * It never evaluates code, expressions, SVG, HTML or user supplied scripts.
 * It does measure whether text can fit the canvas (see textfit.js). That is still not a render.
 */
import { textFitIssues } from "./textfit.js";
const obj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const finite = (x) => typeof x === "number" && Number.isFinite(x);
const issue = (path, code, message) => ({ path, code, message });

export function validateComposition(input, options = {}) {
  const errors = [];
  const warnings = [];
  const fail = (path, code, message) => errors.push(issue(path, code, message));
  const warn = (path, code, message) => warnings.push(issue(path, code, message));
  if (!obj(input)) {
    fail("$", "INVALID_ROOT", "Expected a JSON object.");
    return report();
  }
  const hasImprovement = ["add", "change", "remove", "sfx"].some(k => Object.hasOwn(input, k));
  const hasLayers = Array.isArray(input.layers);
  const hasElements = Array.isArray(input.elements);
  if (hasImprovement && !hasLayers && !hasElements) {
    return validateImprovement(input, options);
  }
  if (hasImprovement && (hasLayers || hasElements)) {
    fail("$", "AMBIGUOUS_FORMAT", "Do not mix improvement operations with compositions or designs.");
  }
  if (!hasLayers && !hasElements) {
    fail("$", "MISSING_CONTENT", 'Missing "layers" (composition) or "elements" (design).');
    return report();
  }
  if (hasLayers && hasElements) fail("$", "AMBIGUOUS_FORMAT", "Specify layers or elements, not both.");
  if (hasElements && !hasLayers) {
    if (input.elements.length === 0) fail("$.elements", "EMPTY_DESIGN", "The design has no elements.");
    input.elements.forEach((el, i) => {
      const p = `$.elements[${i}]`;
      if (!obj(el)) return fail(p, "INVALID_ELEMENT", "Element must be an object.");
      for (const key of ["x", "y", "w", "h"]) {
        if (!finite(el[key])) fail(`${p}.${key}`, "INVALID_NUMBER", "Expected finite number.");
      }
      if (finite(el.w) && el.w <= 0) fail(`${p}.w`, "INVALID_DIMENSION", "Width must be positive.");
      if (finite(el.h) && el.h <= 0) fail(`${p}.h`, "INVALID_DIMENSION", "Height must be positive.");
    });
    warn("$", "CONTRACT_NOT_CHECKED", "Studio property and design-type compatibility was not checked.");
    return report();
  }
  for (const key of ["width", "height", "duration", "fps"]) {
    if (!finite(input[key]) || input[key] <= 0) fail(`$.${key}`, "INVALID_NUMBER", "Expected a positive finite number.");
  }
  if (input.version !== 1) fail("$.version", "INVALID_VERSION", "Studio composition version must be 1.");
  if (typeof input.name !== "string" || !input.name.trim()) warn("$.name", "MISSING_NAME", "Studio may assign a default name.");
  if (typeof input.background !== "string") warn("$.background", "MISSING_BACKGROUND", "Studio may assign a default background.");
  if (!obj(input.params)) warn("$.params", "MISSING_PARAMS", "Studio may default params to {}.");
  if (input.layers.length === 0) fail("$.layers", "EMPTY_COMPOSITION", "No layers to render.");
  const ids = new Set();
  for (const [i, layer] of input.layers.entries()) {
    const p = `$.layers[${i}]`;
    if (!obj(layer)) { fail(p, "INVALID_LAYER", "Layer must be an object."); continue; }
    if (typeof layer.id !== "string" || !layer.id.trim()) fail(`${p}.id`, "INVALID_ID", "Provide a nonempty layer id.");
    else if (ids.has(layer.id)) fail(`${p}.id`, "DUPLICATE_ID", `Layer id "${layer.id}" is duplicated.`);
    else ids.add(layer.id);
    if (typeof layer.type !== "string" || !layer.type.trim()) fail(`${p}.type`, "INVALID_TYPE", "Layer type is required.");
    if (!obj(layer.props)) fail(`${p}.props`, "INVALID_PROPS", "Expected an object of properties.");
    if (!finite(layer.start) || !finite(layer.end) || layer.start < 0 || layer.end <= layer.start)
      fail(p, "INVALID_TIMING", "Expected 0 <= start < end.");
    if (finite(input.duration) && finite(layer.end) && layer.end > input.duration)
      fail(`${p}.end`, "OUTSIDE_DURATION", "Layer end exceeds composition duration.");
    if (layer.parent !== undefined && layer.parent !== null && typeof layer.parent !== "string")
      fail(`${p}.parent`, "INVALID_PARENT", "Parent must be a layer id or null.");
    if (layer.type === "video" && obj(layer.props)) checkVideo(layer, p, fail, warn, input.assets);
    if (layer.type === "runtime" && obj(layer.props)) checkRuntime(layer, p, fail, warn, input.assets);
    if (layer.type === "html" && obj(layer.props) && obj(layer.props.text) && typeof layer.props.text.expr === "string")
      warn(`${p}.props.text`, "HTML_TEXT_SAMPLED", "HTML text is sampled once per frame. Text that changes on every frame for a long time should be a text layer, which the engine paints directly.");
  }
  if (finite(input.width) && finite(input.height) && input.width > 0 && input.height > 0) {
    const fit = textFitIssues(input);
    for (const item of fit.errors) errors.push(item);
    for (const item of fit.warnings) warnings.push(item);
  }
  input.layers.forEach((layer, i) => {
    if (!obj(layer) || typeof layer.parent !== "string") return;
    const p = `$.layers[${i}].parent`;
    if (layer.parent === layer.id) fail(p, "SELF_PARENT", "A layer cannot parent itself.");
    else if (!ids.has(layer.parent)) fail(p, "UNKNOWN_PARENT", `Parent "${layer.parent}" does not exist.`);
  });
  warn("$", "CONTRACT_NOT_CHECKED", "Layer types, property names, FX presets, keyframes, assets and rendering were not checked against Studio.");
  return report();

  function report() {
    return {
      valid: errors.length === 0,
      format: obj(input) && Array.isArray(input.layers) ? "composition" : obj(input) && Array.isArray(input.elements) ? "design" : "unknown",
      fullyValidated: false,
      mode: "structural-preflight",
      errors,
      warnings,
    };
  }
}

/**
 * A video layer shows the user's own file (an id from their request; Studio fills it in on open):
 * props.from is the second of the file where its clip starts and the clip lasts end - start.
 */
/**
 * A runtime layer keeps an existing Lottie, glTF or GSAP file and seeks it.
 * The original bytes stay in assets. This check does not open or render the file.
 */
function checkRuntime(layer, p, fail, warn, assets) {
  const { engine, asset } = layer.props;
  if (engine !== undefined && engine !== "lottie" && engine !== "three" && engine !== "gsap")
    fail(`${p}.props.engine`, "RUNTIME_ENGINE", "props.engine must be lottie, three or gsap.");
  if (typeof asset !== "string" || !asset.trim())
    fail(`${p}.props.asset`, "RUNTIME_ASSET_MISSING", "A runtime layer needs props.asset: the id of the Lottie, glTF or HTML file.");
  else if (/^(https?:|data:|blob:)/i.test(asset))
    fail(`${p}.props.asset`, "RUNTIME_ASSET_NOT_ID", "props.asset is an id in assets, not a URL. The original file stays in assets.");
  else if (obj(assets)) {
    if (!Object.hasOwn(assets, asset))
      fail(`${p}.props.asset`, "RUNTIME_ASSET_MISSING", `assets has no "${asset}".`);
  } else
    warn(`${p}.props.asset`, "RUNTIME_ASSET_UNCHECKED", "assets was omitted, so the file was not checked.");
  warn(p, "RUNTIME_SEEK", "Studio seeks this file on the project clock. A script that only moves forward will not scrub. This check does not render it.");
}

function checkVideo(layer, p, fail, warn, assets) {
  const { asset, from } = layer.props;
  if (typeof asset !== "string" || !asset.trim())
    fail(`${p}.props.asset`, "VIDEO_NEEDS_ASSET", "A video layer needs props.asset: the id of a video the user listed.");
  else if (/^(https?:|data:|blob:)/i.test(asset))
    fail(`${p}.props.asset`, "VIDEO_ASSET_NOT_ID", "Use the id of the user's video, not a URL or data: Studio fills it in on open.");
  else if (obj(assets) && Object.hasOwn(assets, asset))
    warn(`${p}.props.asset`, "VIDEO_IN_ASSETS", "The user's videos stay in Studio: reference the id without adding it to assets.");
  if (from !== undefined && (!finite(from) || from < 0))
    fail(`${p}.props.from`, "INVALID_CLIP_START", "props.from must be a number of seconds, 0 or more.");
}

/**
 * Preflight for the Studio "Mejorar con IA" operations format.
 * Compatible with the envelope accepted by packages/core/src/improve.ts,
 * but actual acceptance is decided by applyImprovement(comp, patch).
 * No code or expressions are executed here.
 */
export function validateImprovement(input, { composition } = {}) {
  const errors = [];
  const warnings = [];
  const fail = (path, code, message) => errors.push(issue(path, code, message));
  const warn = (path, code, message) => warnings.push(issue(path, code, message));
  const report = () => ({
    valid: errors.length === 0,
    format: "improvement",
    fullyValidated: false,
    mode: "structural-preflight",
    errors,
    warnings,
  });
  if (!obj(input)) {
    fail("$", "INVALID_ROOT", "Expected a JSON object.");
    return report();
  }
  const keys = ["add", "change", "remove", "sfx"];
  if (!keys.some(k => Object.hasOwn(input, k))) {
    fail("$", "MISSING_OPERATIONS", "Expected at least one improvement operation.");
    return report();
  }
  for (const key of keys) {
    if (input[key] !== undefined && !Array.isArray(input[key])) {
      fail(`$.${key}`, "INVALID_OPERATIONS", `"${key}" must be an array.`);
    }
  }
  const add = Array.isArray(input.add) ? input.add : [];
  const change = Array.isArray(input.change) ? input.change : [];
  const remove = Array.isArray(input.remove) ? input.remove : [];
  const sfx = Array.isArray(input.sfx) ? input.sfx : [];
  if (!add.length && !change.length && !remove.length && !sfx.length)
    fail("$", "EMPTY_OPERATIONS", "No operations to apply.");
  const existingIds = obj(composition) && Array.isArray(composition.layers)
    ? new Set(composition.layers.filter(obj).map(l => l.id)) : null;
  const duration = obj(composition) && finite(composition.duration) ? composition.duration : null;
  const addedIds = new Set();
  add.forEach((l, i) => {
    const p = `$.add[${i}]`;
    if (!obj(l)) return fail(p, "INVALID_LAYER", "Added layer must be an object.");
    if (typeof l.id !== "string" || !l.id.trim()) warn(`${p}.id`, "GENERATED_ID", "Studio will generate an id.");
    else {
      if (addedIds.has(l.id)) warn(`${p}.id`, "DUPLICATE_ADDED_ID", "Duplicate added id may be normalized.");
      addedIds.add(l.id);
      if (existingIds?.has(l.id)) warn(`${p}.id`, "ID_COLLISION", "Studio will rename a colliding new layer.");
    }
    if (l.z !== undefined && l.z !== "fondo" && l.z !== "frente")
      warn(`${p}.z`, "UNKNOWN_Z", 'Only "fondo" and "frente" are meaningful.');
    if (typeof l.type !== "string" || !l.type) fail(`${p}.type`, "MISSING_TYPE", "New layers require a type.");
    if (l.type === "image" || l.type === "video") warn(`${p}.type`, "IGNORED_IMAGE", "Studio discards new image and video layers in improvements.");
    if (!obj(l.props)) fail(`${p}.props`, "INVALID_PROPS", "Expected layer props object.");
    if (!finite(l.start) || !finite(l.end) || l.start < 0 || l.start >= l.end)
      fail(p, "INVALID_TIMING", "Expected 0 <= start < end.");
    if (duration !== null && finite(l.end) && l.end > duration)
      warn(`${p}.end`, "CLAMPED_DURATION", "Studio clamps layers to the original project duration.");
  });
  change.forEach((c, i) => {
    const p = `$.change[${i}]`;
    if (!obj(c)) return fail(p, "INVALID_CHANGE", "Change must be an object.");
    if (typeof c.id !== "string" || !c.id) fail(`${p}.id`, "MISSING_ID", "Change requires an existing layer id.");
    else if (existingIds && !existingIds.has(c.id)) warn(`${p}.id`, "UNKNOWN_CHANGE", "Studio ignores changes to unknown layer ids.");
    if (c.props !== undefined && !obj(c.props)) fail(`${p}.props`, "INVALID_PROPS", "Expected props object.");
  });
  remove.forEach((id, i) => {
    const p = `$.remove[${i}]`;
    if (typeof id !== "string" || !id) fail(p, "INVALID_ID", "Removal must reference a layer id.");
    else if (existingIds && !existingIds.has(id)) warn(p, "UNKNOWN_REMOVE", "Studio ignores unknown layer ids.");
  });
  sfx.forEach((sound, i) => {
    const p = `$.sfx[${i}]`;
    if (!obj(sound)) return fail(p, "INVALID_SOUND", "SFX must be an object.");
    if (!finite(sound.t) || sound.t < 0) fail(`${p}.t`, "INVALID_TIME", "SFX time must be nonnegative.");
    if (typeof sound.sound !== "string" || !sound.sound) fail(`${p}.sound`, "MISSING_SOUND", "SFX requires a sound id.");
    if (duration !== null && finite(sound.t) && sound.t >= duration)
      warn(`${p}.t`, "OUTSIDE_DURATION", "SFX may be omitted outside project duration.");
  });
  if (!existingIds) warn("$", "PROJECT_CONTEXT_MISSING", "Changes, removals and timing need the existing project for full validation.");
  const fit = textFitIssues(input, composition);
  for (const item of fit.errors) errors.push(item);
  for (const item of fit.warnings) warnings.push(item);
  warn("$", "CONTRACT_NOT_CHECKED", "Call Studio applyImprovement for exact normalization, presets and rendered output.");
  return report();
}
