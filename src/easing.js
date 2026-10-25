/** Easing and spring names Studio understands (packages/core/src/easing.ts). Anything else is silently replaced there, so we warn. */
export const EASE_NAMES = ["linear","hold",
  ...["Quad","Cubic","Quart","Expo","Sine"].flatMap((n) => ["In","Out","InOut"].map((d) => `ease${d}${n}`)),
  "easeInBack","easeOutBack","easeInOutBack","easeOutElastic","easeInOutElastic","easeOutBounce","easeInBounce",
  "spring","springSnappy","springBouncy","springSmooth","springHeavy"];
/** Spring modes for keyframes ("spring": name): the UI springs, the Remotion ones, or spring(damping, stiffness, mass). */
export const UI_SPRING_NAMES = ["ui","snappy","smooth","soft","lead","trail"];
const REMOTION = ["spring","springSnappy","springBouncy","springSmooth","springHeavy"];

const squash = (s) => s.replace(/\s+/g, "");
const numbers = (inner) => inner.split(",").map((v) => v.replace(/^[a-z]+=/i, ""));
/** True when Studio would use `name` as written (named curve, spring(...) or cubic-bezier(...)). */
export function isKnownEase(name) {
  if (typeof name !== "string") return false;
  const s = squash(name);
  if (EASE_NAMES.includes(s)) return true;
  if (/^spring\([^)]*\)$/.test(s)) return true;
  return /^cubic-bezier\([^)]+\)$/.test(s);
}
/** Same for a keyframe `spring` mode. */
export function isKnownSpring(name) {
  if (name === true) return true;
  if (typeof name !== "string") return false;
  const s = squash(name);
  if (!s) return true;
  if (UI_SPRING_NAMES.includes(s) || REMOTION.includes(s)) return true;
  if (UI_SPRING_NAMES.includes(s.replace(/^spring/i, "").toLowerCase())) return true;
  return /^spring\([^)]*\)$/.test(s) && numbers(s.slice(7, -1)).every((v) => v === "" || Number.isFinite(Number(v)));
}

/** Warnings for easing/spring names Studio would silently replace (easeInOutCubic for a curve, "ui" for a spring mode). */
export function checkEases(input) {
  const out = [];
  const prop = (p, path) => {
    if (!p || typeof p !== "object" || Array.isArray(p)) return;
    if (Array.isArray(p.kf)) {
      p.kf.forEach((k, i) => {
        if (k && typeof k === "object" && k.ease !== undefined && !isKnownEase(k.ease))
          out.push({ path: `${path}.kf[${i}].ease`, code: "UNKNOWN_EASE", message: `Easing ${JSON.stringify(k.ease)} does not exist: Studio plays easeInOutCubic instead. Use a name from get_motion_recipe('choreography'), spring(damping,stiffness,mass) or cubic-bezier(a,b,c,d).` });
      });
      if (p.spring !== undefined && !isKnownSpring(p.spring))
        out.push({ path: `${path}.spring`, code: "UNKNOWN_EASE", message: `Spring ${JSON.stringify(p.spring)} does not exist: Studio plays "ui" instead. Use ui, snappy, smooth, soft, lead, trail, springSnappy…, or spring(damping,stiffness,mass).` });
    }
  };
  const layer = (l, path) => {
    if (!l || typeof l !== "object" || !l.props || typeof l.props !== "object") return;
    for (const [k, v] of Object.entries(l.props)) {
      if (k === "animEase") {
        if (typeof v === "string" && !isKnownEase(v)) out.push({ path: `${path}.props.animEase`, code: "UNKNOWN_EASE", message: `Easing ${JSON.stringify(v)} does not exist: Studio plays easeInOutCubic instead.` });
      } else prop(v, `${path}.props.${k}`);
    }
  };
  if (Array.isArray(input?.layers)) input.layers.forEach((l, i) => layer(l, `$.layers[${i}]`));
  if (Array.isArray(input?.add)) input.add.forEach((l, i) => layer(l, `$.add[${i}]`));
  return out;
}
