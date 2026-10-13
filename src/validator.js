/**
 * Structural validator for HyperCodeMotion JSON.
 * This is a conservative preflight, NOT the complete Studio contract validator.
 * It never evaluates code, expressions, SVG, HTML or user supplied scripts.
 */
const obj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const finite = (x) => typeof x === "number" && Number.isFinite(x);
const issue = (path, code, message) => ({ path, code, message });

export function validateComposition(input) {
  const errors = [];
  const warnings = [];
  const fail = (path, code, message) => errors.push(issue(path, code, message));
  const warn = (path, code, message) => warnings.push(issue(path, code, message));
  if (!obj(input)) {
    fail("$", "INVALID_ROOT", "Expected a JSON object.");
    return report();
  }
  const hasLayers = Array.isArray(input.layers);
  const hasElements = Array.isArray(input.elements);
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
      fullyValidated: false,
      mode: "structural-preflight",
      errors,
      warnings,
    };
  }
}
