import contract from "./studio-contract.json" with { type: "json" };
import { validateComposition } from "./validator.js";

export function getCapabilities() {
  return { contractVersion: "studio-snapshot-1", source: contract.source,
    sourceSchemaSha: contract.sourceSchemaSha, sourcePresetsSha: contract.sourcePresetsSha,
    formats: ["composition", "design", "improvement"],
    layerProperties: contract.types, presetSlots: contract.presets,
    fullyValidated: false };
}

export function validateJson(input, options = {}) {
  const report = validateComposition(input, options);
  const notices = [];
  const check = (layer, path) => {
    if (!layer || typeof layer !== "object" || Array.isArray(layer)) return;
    const props = contract.types[layer.type];
    if (!props) {
      notices.push({path:path+".type",code:"UNKNOWN_LAYER_TYPE",message:"Studio may discard this layer."});
      return;
    }
    if (layer.props && typeof layer.props === "object") for(const key of Object.keys(layer.props)) {
      if (!props.includes(key) && !(layer.type==="code" && key==="code"))
        notices.push({path:path+".props."+key,code:"UNKNOWN_PROPERTY",message:"Studio may discard this property."});
    }
    if (layer.fx && typeof layer.fx==="object") for(const [slot,fx] of Object.entries(layer.fx)) {
      const id = typeof fx==="string" ? fx : fx?.id;
      if (id && !(contract.presets[id]?.includes(slot) || (slot==="out" && contract.presets[id]?.includes("in"))))
        notices.push({path:path+".fx."+slot,code:"UNKNOWN_EFFECT",message:"Studio may discard this effect."});
    }
  };
  if (report.format === "composition") input.layers.forEach((v,i)=>check(v,"$.layers["+i+"]"));
  if (report.format === "improvement" && Array.isArray(input.add))
    input.add.forEach((v,i)=>check(v,"$.add["+i+"]"));
  return {...report,contractVersion:"studio-snapshot-1",warnings:[...report.warnings,...notices]};
}
