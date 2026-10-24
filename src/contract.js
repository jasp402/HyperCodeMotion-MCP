import contract from "./studio-contract.json" with { type: "json" };
import { validateComposition } from "./validator.js";
import { screenRule } from "./frame.js";
import { TRANSITIONS, checkScenes } from "./transitions.js";

/** The user's own files («Tus materiales» in Studio): referenced by id, never uploaded here. */
const USER_MATERIALS = "Files the user listed by id in their request (photos, cut-outs, a logo, videos) stay in Studio and are filled in by id when the project opens. Reference them with props.asset = <id>: an image as an \"image\" layer (or <img src=\"asset:<id>\"> in an HTML scene), a video as a \"video\" layer whose props.from is the second of the file where the shown clip starts; the clip lasts end - start and plays without sound. Do not put them in \"assets\" or as URLs, and use only ids the user gave.";

/** Where the connector-only user (no Skill installed) gets the essentials: claude.ai does not show `initialize.instructions`, but it does show tool results. */
const START = "Before designing, ask the user once for the canvas size unless they gave it: 9:16 1080x1920, 1:1 1080x1080, 4:5 1080x1350, 16:9 1920x1080 (or custom). Build one scene per beat in scenes[] and join them with transitions. Deliver only the open and download links from create_hcmotion, never the JSON.";

/** Properties every drawable layer type shares. Listed once instead of once per type (13 copies of 15 names). */
const COMMON = ["x","y","scale","scaleX","scaleY","rotation","opacity","depth","rotateX","rotateY","perspective","glow","glowColor","blur","blend"];
const hasCommon = (props) => COMMON.every((k) => props.includes(k));
const ownProperties = () => Object.fromEntries(Object.entries(contract.types).map(([type, props]) => [type, hasCommon(props) ? props.filter((k) => !COMMON.includes(k)) : props]));

export function getCapabilities() {
  return { contractVersion: "studio-snapshot-1", source: contract.source,
    sourceSchemaSha: contract.sourceSchemaSha, sourcePresetsSha: contract.sourcePresetsSha,
    formats: ["composition", "design", "improvement"],
    commonProperties: COMMON,
    layerProperties: ownProperties(), layerPropertiesNote: "Each type also accepts every commonProperties name, except camera and cursor, whose lists are complete.",
    presetSlots: contract.presets,
    start: START,
    transitions: TRANSITIONS,
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
  if (report.format === "composition") notices.push(...checkScenes(input));
  if (report.format === "improvement" && Array.isArray(input.add))
    input.add.forEach((v,i)=>check(v,"$.add["+i+"]"));
  return {...report,contractVersion:"studio-snapshot-1",warnings:[...report.warnings,...notices]};
}
