/**
 * Style brief: the mandatory step before designing an original video (get_motion_recipe, name "style-brief",
 * and the head of the recipe index). Ideas adapted, not copied, from bangtutorial/bang-motion (MIT License,
 * Copyright (c) its authors): SKILL.md style brief, references/anti-ppt.md and references/opener-konsep.md.
 * Also the soft "looks like slides" check validate_json runs (warnings only, never errors).
 */
export const STYLE_BRIEF = `# style-brief. Mandatory before designing an original video (not for gallery recreations, which follow get_recreation_brief).
Talk to the user in their language (Spanish if they write in Spanish). Ask only for what you cannot deduce, in one message.

1. Brief: gather or deduce
- product or theme, the one message, the audience;
- format: 1:1 1080x1080, 9:16 1080x1920 or 16:9 1920x1080; duration in seconds;
- branding: palette of 3-5 hex colors and where each came from (logo, website, what the user said); one title font and one body font (Google Fonts); tone (premium, playful, technical…).
If the user has no brand, propose one (palette, fonts, tone) and ask them to approve it before going on.

2. Three concepts, then wait
Propose 3 concepts, each = a style direction + a structure, e.g. "editorial claro + afirmación → cómo → resultado", "UI en uso + problema → demo → CTA", "tipografía cinética + pregunta → giro → logo". One line each on why it fits this brief; mark one as recommended. Do not build or call create_hcmotion until the user picks one: a rejected full video costs far more tokens than three lines.

3. Not a slide deck (validate_json warns SLIDE_LIKE_* when it can tell)
- One continuous world: scenes change because the camera or the world moves, not as isolated title + fade sections.
- A persistent brand element (logo, shape, color field, product object) stays on screen across scenes.
- The camera moves toward what matters: a camera layer with zoom/x/y changes (see get_motion_recipe camera), not a static frame.
- Text lives inside the scene (on objects, surfaces, UI), one short line per beat, not a floating title + subtitle + bullets.
- Nothing inherited from a base template or a previous project: palette, fonts and motion come from this brief. A reference video gives rhythm and energy, not its skin.

Pass the approved brief to create_hcmotion (field brief) so Studio keeps it with the project.`;

const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
const num = (x) => typeof x === "number" && Number.isFinite(x);

/** Cheap, conservative heuristics; only on compositions with 3+ scenes. Never errors. */
export function checkSlides(comp) {
  const out = [];
  if (!isObj(comp) || !Array.isArray(comp.scenes) || comp.scenes.length < 3 || !Array.isArray(comp.layers) || !num(comp.duration)) return out;
  const layers = comp.layers.filter(isObj);
  const hasCamera = layers.some((l) => l.type === "camera");
  const types = comp.scenes.slice(1).map((s) => (isObj(s) && isObj(s.transition) ? s.transition.type : "cut"));
  const allFadeOrCut = types.every((t) => t === "fade" || t === "cut" || t === undefined);
  if (!hasCamera && allFadeOrCut)
    out.push({ path: "$.scenes", code: "SLIDE_LIKE_SCENES", message: "Every scene change is a fade or cut and there is no camera: it may read as slides. Consider camera moves toward the focus and varied transitions (get_motion_recipe style-brief). Keep it if deliberate." });
  return out;
}

/** Normalizes the optional create_hcmotion brief: an object (kept as is) or a string (as {text}). Returns undefined when absent or unusable. */
export function normalizeBrief(brief) {
  if (typeof brief === "string") return brief.trim() ? { text: brief.trim().slice(0, 4000) } : undefined;
  if (isObj(brief)) { const s = JSON.stringify(brief); return s.length <= 8000 ? brief : undefined; }
  return undefined;
}
