import contract from "./studio-contract.json" with { type: "json" };
import { validateComposition } from "./validator.js";
import { screenRule } from "./frame.js";

/** The user's own files («Tus materiales» in Studio): referenced by id, never uploaded here. */
const USER_MATERIALS = "Files the user listed by id in their request (photos, cut-outs, a logo, videos) stay in Studio and are filled in by id when the project opens. Reference them with props.asset = <id>: an image as an \"image\" layer (or <img src=\"asset:<id>\"> in an HTML scene), a video as a \"video\" layer whose props.from is the second of the file where the shown clip starts; the clip lasts end - start and plays without sound. Do not put them in \"assets\" or as URLs, and use only ids the user gave.";

export function getCapabilities() {
  return { contractVersion: "studio-snapshot-1", source: contract.source,
    sourceSchemaSha: contract.sourceSchemaSha, sourcePresetsSha: contract.sourcePresetsSha,
    formats: ["composition", "design", "improvement"],
    layerProperties: contract.types, presetSlots: contract.presets,
    userMaterials: USER_MATERIALS,
    screen: screenRule(),
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
