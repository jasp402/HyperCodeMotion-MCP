/**
 * Scene transitions as Studio plays them (Studio: packages/core/src/types.ts SceneTransition,
 * render.ts transitionAt / drawTransition). An ENTRY transition on scene i > 0, played at scene.start.
 */
export const TRANSITION_TYPES = ["fade", "slide", "push", "wipe", "clockWipe", "iris", "zoom", "flip", "blur"];
export const TRANSITION_DIRS = ["left", "right", "up", "down"];

/** Compact contract shown by get_capabilities (kept short: it is paid for in every conversation that calls it). */
export const TRANSITIONS = {
  where: "composition.scenes[i].transition on every scene after the first; scenes {id,name,start,end} are consecutive and never overlap",
  shape: { type: TRANSITION_TYPES.join("|"), dur: "seconds > 0, typically 0.4-0.8, at most the scene length", dir: "left|right|up|down = side the new scene enters from (slide, push, wipe, flip; default right)", ease: "easing name, default easeInOutCubic" },
  rules: "Entry transition at scene.start; the outgoing scene is frozen at its last frame while it plays, so keep motion in it finished before the cut. Ignored on the first scene and when dur <= 0; an unknown type is a hard cut.",
};

const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
const num = (x) => typeof x === "number" && Number.isFinite(x);

/** Warnings for `scenes` (never errors: Studio opens the file either way, but plays a hard cut or ignores the transition). */
export function checkScenes(comp) {
  const out = [];
  const warn = (path, code, message) => out.push({ path, code, message });
  if (comp.scenes === undefined) return out;
  if (!Array.isArray(comp.scenes)) return [{ path: "$.scenes", code: "SCENES_NOT_ARRAY", message: "scenes must be an array of {id,name,start,end,transition?}." }];
  comp.scenes.forEach((s, i) => {
    const p = `$.scenes[${i}]`;
    if (!isObj(s)) return warn(p, "SCENE_NOT_OBJECT", "A scene must be an object {id,name,start,end,transition?}.");
    if (typeof s.id !== "string" || !s.id) warn(p + ".id", "SCENE_FIELDS", "A scene needs a string id.");
    if (!num(s.start) || !num(s.end) || s.end <= s.start) warn(p, "SCENE_FIELDS", "A scene needs numeric start < end (seconds).");
    const prev = comp.scenes[i - 1];
    if (isObj(prev) && num(prev.end) && num(s.start) && s.start < prev.end - 1e-3)
      warn(p + ".start", "SCENES_OVERLAP", "Scenes must be consecutive: this one starts before the previous one ends.");
    if (s.transition === undefined) return;
    const t = s.transition, tp = p + ".transition";
    if (!isObj(t)) return warn(tp, "TRANSITION_SHAPE", 'transition must be {"type":"fade","dur":0.5}.');
    if (!TRANSITION_TYPES.includes(t.type)) warn(tp + ".type", "TRANSITION_UNKNOWN_TYPE", `Studio plays a hard cut for this type. Use one of: ${TRANSITION_TYPES.join(", ")}.`);
    if (i === 0 || (num(s.start) && s.start <= 0)) warn(tp, "TRANSITION_ON_FIRST_SCENE", "Studio ignores the transition of the first scene (nothing to come from).");
    if (!num(t.dur) || t.dur <= 0) warn(tp + ".dur", "TRANSITION_NO_DURATION", "dur must be a number of seconds above 0 or Studio ignores the transition.");
    else if (num(s.start) && num(s.end) && t.dur > s.end - s.start + 1e-3) warn(tp + ".dur", "TRANSITION_LONGER_THAN_SCENE", "dur is longer than the scene: it would run into the next scene.");
    if (t.dir !== undefined && !TRANSITION_DIRS.includes(t.dir)) warn(tp + ".dir", "TRANSITION_BAD_DIR", `dir must be one of ${TRANSITION_DIRS.join(", ")}; slide, push, wipe and flip do not move correctly otherwise.`);
  });
  return out;
}
