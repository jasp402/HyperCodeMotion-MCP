/**
 * Motion recipes: short, real patterns the model asks for on demand (tool get_motion_recipe).
 *
 * Every recipe is a composition FRAGMENT ({layers, docs?, scenes?, audio?}). The text the model reads is built
 * from that same fragment, and tests/recipes.test.js runs each fragment through validateJson, so what is shown
 * is what is validated. Sources: gallery templates and the Studio (packages/core/src: render.ts, audio.ts,
 * ui.ts, looks.ts, schema.ts), contract jasp402/HyperCodeMotion@c75a0b3. No field here is invented: each one is
 * in studio-contract.json or in the Studio code it came from.
 */
import { LOOKS, DECO } from "./looks.js";
import { EASE_NAMES, UI_SPRING_NAMES } from "./easing.js";

const FONT_LINK = (family) => `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${family}&amp;display=swap">`;
const doc = (head, css, body) => `<!doctype html><html><head><meta charset="utf-8">${head}<style>html,body{width:100%;height:100%;margin:0;background:transparent;overflow:hidden}body{position:relative}${css}</style></head><body>${body}</body></html>`;

// ---------- riso ----------
const RISO_DOC = doc(
  FONT_LINK("Montserrat:wght@900"),
  `body{font-family:Montserrat,sans-serif;font-weight:900}.p{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:max-content;line-height:1}` +
    `.circ{top:calc(50% - 60px);width:700px;height:700px;border-radius:50%;background:#F0559A}` +
    `.dots{left:calc(50% + 90px);top:calc(50% + 10px);width:520px;height:520px;border-radius:50%;background:radial-gradient(circle,#1F6FB0 4px,transparent 4.5px) 0 0/18px 18px}` +
    `.title{top:calc(50% - 60px);font-size:210px;color:#1F6FB0;letter-spacing:-.03em;text-shadow:-8px 8px 0 rgba(240,85,154,.85)}` +
    `.bar{top:calc(50% + 400px);width:640px;height:46px;background:repeating-linear-gradient(-55deg,rgba(240,85,154,.85) 0 7px,transparent 7px 26px)}`,
  `<div class="p circ" data-hcm="circ"></div><div class="p dots" data-hcm="dots"></div><div class="p title" data-hcm="title">PRINT</div><div class="p bar" data-hcm="bar"></div>`,
);
const GRAIN_DOC =
  `<!doctype html><html><head><meta charset="utf-8"><style>html,body{width:100%;height:100%;margin:0;background:transparent;overflow:hidden}body{position:relative}` +
  `.g{position:absolute;left:-24px;top:-24px;width:calc(100% + 48px);height:calc(100% + 48px);background-size:360px 360px}</style></head><body><div class="g" data-hcm="g"></div>` +
  `<script>(()=>{const N=360,c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d'),d=x.createImageData(N,N),a=d.data;for(let i=0;i<a.length;i+=4){const r=Math.random();if(r<.28){const l=r<.2?250:40;a[i]=a[i+1]=a[i+2]=l;a[i+3]=r<.2?80+Math.random()*130:25+Math.random()*55}}x.putImageData(d,0,0);document.querySelector('.g').style.backgroundImage='url('+c.toDataURL()+')'})()</script></body></html>`;

const riso = {
  summary: "Risograph / overprint: paper, multiply inks, misregistration, halftone, stripes, film grain.",
  notes: [
    "Paper = composition.background #ECE6DA. Inks = html pieces with props.blend \"multiply\" (overlaps mix like ink): pink #F0559A, blue #1F6FB0, yellow #F2D21A, red #E8481F, green #1F7A3A; one heavy sans (Montserrat 900).",
    "Misregistration: text-shadow:-8px 8px 0 rgba(pink,.85), or a duplicate piece moved by dx/dy.",
    "Halftone: radial-gradient dots. Stripes: repeating-linear-gradient(-55deg, ink 0 7px, transparent 7px 26px).",
    "Grain: canvas-noise doc in a fixed:true layer LAST; dx/dy expressions jump it 12x/s.",
    "Pieces: .p{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}, moved with calc(50% ± Npx). Audio: profile minimal, bpm 110.",
  ],
  fragment: {
    background: "#ECE6DA",
    duration: 4,
    docs: { riso: RISO_DOC, grain: GRAIN_DOC },
    layers: [
      { id: "circ", type: "html", start: 0, end: 4, props: { doc: "riso", part: "circ" }, fx: { in: { id: "pop", dur: 0.55 } } },
      { id: "dots", type: "html", start: 0.3, end: 4, props: { doc: "riso", part: "dots", blend: "multiply" }, fx: { in: { id: "wipe", dur: 0.5 } } },
      { id: "title", type: "html", start: 0.6, end: 4, props: { doc: "riso", part: "title", blend: "multiply" }, fx: { in: { id: "rise", dur: 0.45, amount: 0.8 } } },
      { id: "bar", type: "html", start: 1.2, end: 4, props: { doc: "riso", part: "bar", blend: "multiply" }, fx: { in: { id: "wipe", dur: 0.45 } } },
      { id: "grain", type: "html", start: 0, end: 4, fixed: true, props: { doc: "grain", part: "g", dx: { expr: "((Math.floor(t*12)*7919)%17)-8" }, dy: { expr: "((Math.floor(t*12)*104729)%15)-7" } } },
    ],
  },
};

// ---------- choreography ----------
const choreography = {
  summary: "Keyframes, springs, easings, text swaps and staggers: how to make motion feel designed.",
  notes: [
    `Keyframes: {"kf":[{"t":s,"v":n,"ease":name}]}; a keyframe's ease shapes the segment that LEAVES it. Names: linear, hold, ease{In,Out,InOut}{Quad,Cubic,Quart,Expo,Sine}, ease{In,Out,InOut}Back, easeOutElastic, easeOutBounce, springSnappy/Smooth/Bouncy/Heavy, spring(d,s,m), cubic-bezier(a,b,c,d). An unknown name silently becomes easeInOutCubic.`,
    `Spring mode: {"kf":[...],"spring":"ui"}: each keyframe is the instant the TARGET changes and the value settles in ~0.3 s. Modes: ${UI_SPRING_NAMES.join(", ")}. Use for cards, cameras, UI; easeOut* for entrances; hold for swaps.`,
    "Text: anim none|chars|words|lines + stagger, animDur, animEase, fromY/X/Scale/Rotation/Opacity/Blur. Repeated copies: copies, rx, ry, rRotation, rScale, rOpacity, rDelay.",
    "Rhythm: mix fast (0.25 s) and slow (0.8 s) moves, overlap entrances ~30%, one hero move per scene.",
  ],
  fragment: {
    layers: [
      { id: "card", type: "rect", start: 0, end: 6, props: { x: 540, y: 900, w: { kf: [{ t: 0.2, v: 120 }, { t: 1, v: 860 }], spring: "ui" }, h: { kf: [{ t: 0.2, v: 120 }, { t: 1, v: 520 }], spring: "snappy" }, radius: 48, fill: "#1B2236" } },
      { id: "title", type: "text", start: 0.8, end: 6, props: { text: "Ship it", size: 150, weight: 800, color: "#FFFFFF", x: 540, y: 820, anim: "chars", stagger: 0.05, animDur: 0.5, animEase: "easeOutBack", fromY: 80, fromOpacity: 0 } },
      { id: "count", type: "text", start: 1.6, end: 6, props: { text: { kf: [{ t: 1.6, v: "3", ease: "hold" }, { t: 2.2, v: "2", ease: "hold" }, { t: 2.8, v: "1", ease: "hold" }, { t: 3.4, v: "GO" }] }, size: 120, weight: 800, color: "#FF4D2E", x: 540, y: 1010, scale: { kf: [{ t: 1.6, v: 1.4, ease: "easeOutExpo" }, { t: 2, v: 1 }] } } },
      { id: "bars", type: "rect", start: 2, end: 6, props: { x: 540, y: 1150, w: 600, h: 14, radius: 7, fill: "#5B8CFF", copies: 3, ry: 34, rDelay: 0.12, trimEnd: { kf: [{ t: 2, v: 0, ease: "easeOutQuart" }, { t: 3, v: 1 }] } } },
    ],
  },
};

// ---------- audio ----------
const audio = {
  summary: "Sound: automatic profile + beat-timed sfx + optional Tidal-pattern tracks.",
  notes: [
    "audio.auto true (default) lets the Studio place sounds from the motion using profile: tech | minimal | emotivo | cine | jugueton | corporativo (unknown ones warn), density: sutil | normal | marcado. bpm 20-300, volume and autoGain 0-1.",
    "sfx[] = {id?, t, sound, gain?, pan?, note?|midi?, units?, dur?}. sound: click tick typing pop glitch confirm error open close switch drop whoosh swish air swipe riser impact thump braam boing chime piano strings marimba, drums kick snare clap hat openhat tom. t must be < duration (else dropped). riser: t is when the rise ENDS. Put sfx on cuts, hits and reveals, 0.05 s before the visual.",
    "tracks[] = {id?, synth, pattern, gain?, start?, end?, cutoff?, pan?, slow?, fx:{reverb,echo,distortion}}. synth: drums tb303 bass saw square sine pluck prophet fm. pattern is Tidal: a b c steps, ~ rest, [a b] sub-steps, [a,b] chord, <a b> alternates per cycle, a*2 repeat, a@3 weight, a? sometimes. drums use bd sd hh cp oh. A bad synth or pattern drops that track (silently in the file).",
  ],
  fragment: {
    audio: {
      bpm: 104,
      volume: 0.8,
      auto: true,
      autoGain: 0.5,
      profile: "cine",
      density: "normal",
      tracks: [
        { id: "kick", synth: "drums", pattern: "bd ~ ~ bd ~ ~ bd ~", gain: 0.7 },
        { id: "bass", synth: "tb303", pattern: "<c2 eb2>", gain: 0.5, cutoff: 900, fx: { reverb: 0.1 } },
        { id: "pad", synth: "prophet", pattern: "[c3,eb3,g3] ~", gain: 0.35, start: 2, fx: { reverb: 0.5 } },
      ],
      sfx: [
        { id: "in", t: 0.9, sound: "whoosh" },
        { id: "hit", t: 1, sound: "impact", gain: 0.9 },
        { id: "rise", t: 4.5, sound: "riser" },
        { id: "end", t: 5, sound: "chime", note: "c5" },
      ],
    },
  },
};

// ---------- camera ----------
const camera = {
  summary: "Camera moves: pan/zoom, parallax by depth, shake, follow a layer, fixed HUD.",
  notes: [
    "A camera layer (not drawn) moves every non-fixed layer. props: x,y = point looked at (default 540,960), zoom (1 = none), rotation, shake (px), follow = layer id, fill 0.05-1, maxZoom (3), lag soft|smooth|ui. It wins over composition.camera.",
    "Parallax: layer depth (0 static, 1 normal, >1 nearer). fixed:true layers (HUD, grain) ignore the camera. Animate x/y in spring \"smooth\", zoom with an ease; keep zoom 0.8-1.6 or edges show.",
    "Auto-framing: {\"type\":\"camera\",\"props\":{\"follow\":\"card\",\"fill\":0.6,\"lag\":\"smooth\"}} follows the layer with id card.",
  ],
  fragment: {
    background: "#0B1020",
    layers: [
      { id: "far", type: "rect", start: 0, end: 6, props: { x: 540, y: 960, w: 2000, h: 2400, fill: "#141B33", depth: 0.3 } },
      { id: "card", type: "rect", start: 0, end: 6, props: { x: 540, y: 960, w: 760, h: 420, radius: 40, fill: "#5B8CFF" } },
      { id: "label", type: "text", start: 0, end: 6, props: { text: "Zoom in", x: 540, y: 960, size: 100, weight: 800, color: "#FFFFFF", depth: 1.15 } },
      { id: "hud", type: "text", start: 0, end: 6, fixed: true, props: { text: "REC", x: 220, y: 280, size: 44, weight: 700, color: "#FF4D2E" } },
      { id: "cam", type: "camera", start: 0, end: 6, props: { x: { kf: [{ t: 0.5, v: 540 }, { t: 1.5, v: 600 }, { t: 4, v: 540 }], spring: "smooth" }, y: { kf: [{ t: 0.5, v: 960 }, { t: 1.5, v: 880 }, { t: 4, v: 960 }], spring: "smooth" }, zoom: { kf: [{ t: 0.5, v: 1, ease: "easeInOutCubic" }, { t: 1.5, v: 1.25, ease: "easeInOutCubic" }, { t: 3.5, v: 1 }] }, shake: { kf: [{ t: 3.9, v: 0 }, { t: 4, v: 16 }, { t: 4.4, v: 0 }] } } },
    ],
  },
};

// ---------- code texture ----------
const codeTexture = {
  summary: "Code layers: procedural texture and animated backgrounds (grain, scanlines, blobs...).",
  notes: [
    "layer.code runs every frame on a canvas of props w x h centred at x,y (local 0,0 = top-left). Scope: ctx, t, lt (layer time), dur, w, h, p, color, amount (0-1), amp, beat, hit, audio, and helpers sin cos abs sqrt pow floor min max PI TAU clamp lerp smooth fract rand(i,k) noise wave pingpong mix hsl ease. Never declare these names yourself (const S, let t, function range...): use SEG, ranges, pts; the same goes for ctx, S, H.",
    "Stay deterministic (rand(i,k), noise, t; never Math.random). First = background; last with blend \"screen\"/\"multiply\" = texture over the art. A few hundred shapes at most.",
  ],
  fragment: {
    background: "#07070C",
    layers: [
      { id: "blobs", type: "code", start: 0, end: 6, props: { x: 540, y: 960, w: 1080, h: 1920, color: "#FF4D2E", amount: 1 }, code: DECO.blobs },
      { id: "grain", type: "code", start: 0, end: 6, props: { x: 540, y: 960, w: 1080, h: 1920, color: "#FFFFFF", amount: 1 }, code: DECO.grain },
      { id: "scan", type: "code", start: 0, end: 6, props: { x: 540, y: 960, w: 1080, h: 1920, color: "#FFFFFF", amount: 1 }, code: DECO.scanlines },
    ],
  },
};

// ---------- ui mockup ----------
const uiMockup = {
  summary: "UI mockups: one morphing shape plus the 11 ui kinds, springs and swap transitions.",
  notes: [
    "A ui layer draws only its content, no background: always put a rect behind it. ONE rect \"forma\" lasts the whole video; states change its w, h, radius, fill with spring kf (ui | snappy | smooth | soft; never easeOutBack/elastic). Each state is a child ui layer: parent \"forma\", x 0, y 0, NO w/h. Swap: outgoing ends 0.12 s after the change with fx.out swap 0.12; incoming starts 0.03 s after with fx.in swap 0.22.",
    "ui props by kind | label: text, icon (Lucide), size, weight | spinner | check | island: text, sub, icon, on | player: text, sub, total (s), on 0-1, value 0-1 | slider: value 0-1 (>1 stretches) | toggle: on 0-1 | tabs: items \"A|B|C\", index | chart: data \"12,18,15\", items \"A|B\", text, sub, prefix, hover (-1 hides) | palette: text, typed (linear kf), items, index, enter 0-1 | toast: text, sub, icon.",
    "Colours: color, accent (active fill), knob. Font Geist. on/index/value/hover also take spring kf. Cursor layer last: x/y spring smooth, down 0/1 snappy; click 0.3 s before each change.",
  ],
  fragment: {
    background: "#0B0B0F",
    layers: [
      { id: "forma", type: "rect", start: 0, end: 6, props: { x: 540, y: 960, w: { kf: [{ t: 0, v: 420 }, { t: 1.2, v: 112 }, { t: 2.6, v: 760 }], spring: "ui" }, h: { kf: [{ t: 0, v: 120 }, { t: 1.2, v: 112 }, { t: 2.6, v: 460 }], spring: "snappy" }, radius: { kf: [{ t: 0, v: 60 }, { t: 2.6, v: 40 }], spring: "smooth" }, fill: { kf: [{ t: 0, v: "#FFFFFF" }, { t: 1.2, v: "#1B1B22" }], spring: "smooth" } } },
      { id: "go", type: "ui", parent: "forma", start: 0, end: 1.32, props: { kind: "label", text: "Get started", size: 34, weight: 600, color: "#0B0B0F", x: 0, y: 0 }, fx: { out: { id: "swap", dur: 0.12, amount: 1 } } },
      { id: "wait", type: "ui", parent: "forma", start: 1.23, end: 2.72, props: { kind: "spinner", color: "#FFFFFF", x: 0, y: 0 }, fx: { in: { id: "swap", dur: 0.22, amount: 1 }, out: { id: "swap", dur: 0.12, amount: 1 } } },
      { id: "stats", type: "ui", parent: "forma", start: 2.63, end: 6, props: { kind: "chart", text: "Revenue", sub: "30.2", prefix: "$", data: "12,18,15,24,21,30", items: "Mon|Tue|Wed|Thu|Fri|Sat", hover: -1, color: "#FFFFFF", accent: "#5B8CFF", x: 0, y: 0 }, fx: { in: { id: "swap", dur: 0.22, amount: 1 } } },
    ],
  },
};

// ---------- scene background ----------
const sceneBg = {
  summary: "A different background per scene that moves with the transition.",
  notes: [
    "Scene content is drawn over composition.background. With no fixed layer underneath, a full-canvas NON-fixed rect per scene (start/end = the scene's bounds) is its own background and moves with the transition. composition.background alone = one colour for all.",
    "A backdrop that must not move: a fixed:true layer FIRST (fixed layers before the first non-fixed one sit under everything; after it, over everything: grain, logo). Both ignore camera and transitions.",
    "scenes[i].transition {type fade|slide|push|wipe|clockWipe|iris|zoom|flip|blur, dur, dir left|right|up|down} on every scene after the first.",
  ],
  fragment: {
    background: "#07070C",
    scenes: [
      { id: "s1", name: "Hook", start: 0, end: 2 },
      { id: "s2", name: "Idea", start: 2, end: 4, transition: { type: "slide", dur: 0.5, dir: "left" } },
      { id: "s3", name: "Close", start: 4, end: 6, transition: { type: "wipe", dur: 0.5, dir: "up" } },
    ],
    layers: [
      { id: "bg1", type: "rect", start: 0, end: 2, props: { x: 540, y: 960, w: 1080, h: 1920, fill: "#07070C" } },
      { id: "t1", type: "text", start: 0.2, end: 2, props: { text: "Hook", x: 540, y: 960, size: 200, weight: 800, color: "#F4F1EA" }, fx: { in: { id: "rise", dur: 0.5 } } },
      { id: "bg2", type: "rect", start: 2, end: 4, props: { x: 540, y: 960, w: 1080, h: 1920, fill: "#FF4D2E" } },
      { id: "t2", type: "text", start: 2.2, end: 4, props: { text: "Idea", x: 540, y: 960, size: 200, weight: 800, color: "#07070C" }, fx: { in: { id: "pop", dur: 0.4 } } },
      { id: "bg3", type: "rect", start: 4, end: 6, props: { x: 540, y: 960, w: 1080, h: 1920, fill: "#F4F1EA" } },
      { id: "t3", type: "text", start: 4.2, end: 6, props: { text: "Close", x: 540, y: 960, size: 200, weight: 800, color: "#07070C" }, fx: { in: { id: "rise", dur: 0.5 } } },
    ],
  },
};

// ---------- autoedit ----------
// AutoEdit (Studio «Anima lo que tienes → Video» with a person talking): the user's video travels by id ("V1"),
// with its words timed; Claude does the professional finish. Same plan Studio builds without AI (welcome/ae.ts).
const autoedit = {
  summary: "Talking-head finish: captions with one emphasised keyword, punch-in zooms, motion screens, sound effects, all by reference to the user's video.",
  notes: [
    "Order of a pro edit: colour grade, zoom, captions, motion screens, sound. Screen ideas: get_motion_recipe('autoedit-screens').",
    "The user's video is NOT in the JSON: a \"video\" layer FIRST, props.asset = the id given (V1), start 0, end = duration, covering the canvas. Studio fills the file and its voice; never add the voice or put the video in assets.",
    "Zoom = \"scale\" keys on V1, cut-style: jump to 1.12 or 1.2 when the keyword is said (two keys 0.01 s apart), back to 1 when the next caption starts. Alternate levels, max one every ~2.5 s, none under a screen.",
    "Captions: EVERY spoken word at its second, lower third (y 70% in 9:16, 76% in 16:9), never over the face (see the frames sheet), max 3 lines. Reading order: words before the keyword small (50-60 px, white, glow), the keyword ALONE on its line big (110-180 px, max 86% width), words after it small below. Small lines anim \"words\", stagger = word gap; keyword enters at its second (scale 0.6 or 1.8 -> 1, 0.3 s easeOutBack). A caption lasts until the next (min 0.8 s). Names «Sub C1»...",
    "Emphasis, ONE style per video: accent colour | accent box | accent underline | white outline | karaoke (fromOpacity 0.35). One keyword per caption; numbers always.",
    "Screens every 4-6 s on the strongest phrase, 1.3-2.6 s, covering the video (paper #F3F1EC + ink #111214 with the accent darkened, ink + accent, or the accent). Slide in 0.22 s, hard cut out. Phrase small, keyword or number huge (max 78% width), an HTML/SVG illustration of what is said, editorial details (index 01 / 04, hairlines, barcode, side labels). Names «Pantalla S1»...",
    "Story first: the hook (first 3 s) and its numbers go huge; a changed number = old one struck out, new one big; irony keeps quotes («felices»); the topic becomes a visual (blackout = video darkens and flickers). Proposed keywords/screens are only a start.",
    "User photos/videos (ids) = B-roll in screens under a 0.42 black veil, white text. An image you cannot draw: rect «Falta imagen: <what>».",
    "audio.sfx (library ids): whoosh 0.7 before each screen, pop 0.35 on zooms, impact on a big number, riser (t = end) before the peak. Max one per 1.5 s.",
  ],
  fragment: {
    background: "#000000",
    duration: 4,
    audio: { bpm: 120, volume: 0.8, auto: false, autoGain: 0.7, profile: "minimal", density: "normal", tracks: [], sfx: [{ id: "s1", t: 0.4, sound: "pop", gain: 0.35 }, { id: "s2", t: 2.12, sound: "whoosh", gain: 0.7 }] },
    layers: [
      { id: "v1", type: "video", name: "Tu video", start: 0, end: 4, props: { asset: "V1", x: 540, y: 960, w: 1080, h: 1920, scale: { kf: [{ t: 0, v: 1 }, { t: 0.39, v: 1 }, { t: 0.4, v: 1.12 }, { t: 1.99, v: 1.12 }, { t: 2, v: 1 }] } } },
      { id: "c1", type: "text", name: "Sub C1", start: 0, end: 2.2, props: { text: "If you want to", x: 540, y: 1290, size: 58, weight: 700, font: "Inter", color: "#FFFFFF", align: "center", glow: 34, glowColor: "rgba(0,0,0,.6)", anim: "words", stagger: 0.12, animDur: 0.18, animEase: "easeOutCubic", fromY: 20, fromOpacity: 0 } },
      { id: "c1box", type: "rect", name: "Sub C1 · caja", start: 0.4, end: 2.2, props: { x: 540, y: 1400, w: 720, h: 150, radius: 0, fill: "#FF6A3D", scaleX: { kf: [{ t: 0.4, v: 0, ease: "easeOutExpo" }, { t: 0.65, v: 1 }] } } },
      { id: "c1key", type: "text", name: "Sub C1 · clave", start: 0.4, end: 2.2, props: { text: "EARN MORE", x: 540, y: 1400, size: 130, weight: 400, font: "Archivo Black", color: "#111214", align: "center", anim: "words", stagger: 0, animDur: 0.3, animEase: "easeOutBack", fromScale: 0.6, fromOpacity: 0 } },
      { id: "s1bg", type: "rect", name: "Pantalla S1", start: 2.2, end: 4, props: { x: { kf: [{ t: 2.2, v: 1620, ease: "easeOutCubic" }, { t: 2.42, v: 540 }] }, y: 960, w: 1080, h: 1920, fill: "#F3F1EC" } },
      { id: "s1t", type: "text", name: "Pantalla S1 · frase", start: 2.35, end: 4, props: { text: "how much money", x: 540, y: 880, size: 46, weight: 500, font: "Inter", color: "#111214", opacity: 0.75, align: "center" } },
      { id: "s1k", type: "text", name: "Pantalla S1 · clave", start: 2.5, end: 4, props: { text: "COMPANY", x: 540, y: 1000, size: 180, weight: 400, font: "Archivo Black", color: "#8A4A1F", align: "center", anim: "chars", stagger: 0.03, animDur: 0.35, animEase: "easeOutBack", fromY: 70, fromBlur: 8, fromOpacity: 0 } },
    ],
  },
};

// ---------- autoedit screens ----------
// Patterns seen in professional before/after talking-head edits (owner's references, 2026-11-02).
const autoeditScreens = {
  summary: "What a talking-head edit puts on screen beyond captions: steps, lists, stat cards, logos, face in a circle, text behind the person.",
  notes: [
    "Steps (\"3 ways\", \"first\", \"number two\"): an accent circle with the number beside the caption, then a frosted card (rect fill rgba(255,255,255,.14), radius 28, backdrop blur) whose text types in word by word.",
    "Spoken list (\"shooting, editing, talking to clients\"): a dark card over a gradient of the video's main colour; one row per item (icon + label) appearing when it is said; the face shrinks into a circle at the top (V1 scale ~0.3, a circle mask or an ellipse frame).",
    "Money or metrics: a UI stat card (label, big value, green when up, red when down) that counts to the value; for \"leads\" or \"clients\" a row of avatar circles.",
    "Tools or brands: their logos as rounded app-icon stickers popping around the keyword (draw them in SVG, never pretend a real logo you cannot draw: use the name in a pill).",
    "Keyword icons: 1-3 glossy 3D-style icons (emoji or SVG) pop around the big keyword with a glow in the accent.",
    "Full-screen idea cards: a solid brand colour with a mixed-font line (sans + script for one word), split screens with B-roll photos and a huge title, or huge text BEHIND the person (needs a cut-out of the user: only with a recorte material).",
    "Grid of B-roll: photos appear one by one in a 2x2 grid on a soft gradient, each with a label (SCRIPTING, FILMING, EDITING).",
    "Close with a call to action: a button-shaped card (\"Click the button below\") with 2-3 small steps under it.",
    "Captions in these edits: heavy uppercase with a yellow or orange keyword and a dark outline, or lowercase tight-leading white with one word much bigger. Change the caption position only for a reason.",
  ],
  fragment: {
    background: "#000000",
    duration: 3,
    layers: [
      { id: "n1", type: "ellipse", name: "Paso 1", start: 0, end: 3, props: { x: 170, y: 1180, w: 120, h: 120, fill: "#FF8A1F", scale: { kf: [{ t: 0, v: 0, ease: "easeOutBack" }, { t: 0.35, v: 1 }] } } },
      { id: "n1t", type: "text", name: "Paso 1 · número", start: 0, end: 3, props: { text: "1", x: 170, y: 1180, size: 70, weight: 400, font: "Archivo Black", color: "#111214" } },
      { id: "card", type: "rect", name: "Paso 1 · tarjeta", start: 0.2, end: 3, props: { x: 600, y: 1180, w: 680, h: 200, radius: 28, fill: "rgba(255,255,255,.14)" } },
      { id: "cardt", type: "text", name: "Paso 1 · texto", start: 0.3, end: 3, props: { text: "Learn the shortcuts", x: 600, y: 1180, size: 48, weight: 700, font: "Inter", color: "#FFFFFF", anim: "words", stagger: 0.15, animDur: 0.2, fromOpacity: 0 } },
    ],
  },
};

// ---------- looks ----------
/** Title size caps so "Big idea" fits the 928 px safe width of a 1080 canvas (checked by tests/recipes.test.js). */
const TITLE_MAX = { medianoche: 130, maximalista: 130 };
const fxRef = (id, dur) => ({ id, dur });
const fmt = (n) => (Math.round(n * 100) / 100).toString();

/** The Studio's lookSample (looks.ts) as a 1080x1920 fragment: same pieces, centred vertically. */
export function lookFragment(look) {
  const C = look.colors, F = look.fonts, m = look.motion;
  const D = 6, SH = 380; // lookSample is 1080 square; shift its content down to sit in the middle of 1920
  const Y = (y) => y + SH;
  const T = (s) => (F.upper ? s.toUpperCase() : s);
  const left = look.id === "suizo";
  const X = left ? 120 : 540;
  const align = left ? "left" : "center";
  const step = (i) => fmt(0.15 + i * Math.max(0.12, m.stagger));
  const inFx = m.in === "draw" ? "fade" : m.in;
  const layers = [];
  const decoColor = look.deco === "blobs" ? C.accent2 : look.deco === "frame" || look.deco === "circuit" ? C.accent : C.ink;
  if (look.deco !== "none") layers.push({ id: "look-deco", type: "code", start: 0, end: D, props: { x: 540, y: 960, w: 1080, h: 1920, color: decoColor, amount: 1 }, code: DECO[look.deco] });
  const shape = (id, type, start, props, fx) => layers.push({ id, type, start: Number(start), end: D, props, fx });
  if (look.id === "cartel") shape("block", "rect", 0, { x: 842, y: Y(540), w: 540, h: 1296, fill: C.accent2, rotation: 8 }, { in: fxRef("slide", 0.5) });
  if (look.id === "suizo") shape("mark", "rect", 0.05, { x: 150, y: Y(200), w: 60, h: 60, fill: C.accent }, { in: fxRef("pop", 0.35) });
  if (look.id === "saas") {
    shape("card", "rect", 0.05, { x: 540, y: Y(540), w: 842, h: 778, radius: 36, fill: "#141B33", stroke: "#26304F", strokeWidth: 2 }, { in: fxRef("rise", 0.6) });
    shape("bar", "rect", 0.6, { x: 540, y: Y(820), w: 648, h: 14, radius: 7, fill: C.accent2, trimEnd: { kf: [{ t: 0.6, v: 0, ease: "easeOutQuart" }, { t: 1.6, v: 0.8 }] } }, undefined);
  }
  if (look.id === "plano") shape("circle", "ellipse", 0.1, { x: 864, y: Y(238), w: 180, h: 180, fill: "#00000000", stroke: C.ink, strokeWidth: 3 }, { in: fxRef("draw", 1.2) });
  if (look.id === "pastel") shape("blob", "ellipse", 0.05, { x: 238, y: Y(216), w: 200, h: 200, fill: C.accent2 }, { in: fxRef("pop", 0.6), loop: fxRef("float", 2.4) });
  if (look.id === "maximalista") shape("echo", "text", 0, { text: "WOW", x: 540, y: Y(540), size: 340, font: F.display, weight: F.displayWeight, color: C.accent, opacity: 0.22, copies: 3, ry: 130, rOpacity: 0.6 }, { in: fxRef("zoom", 0.4) });
  const text = (id, start, props, fx) => layers.push({ id, type: "text", start: Number(start), end: D, props, fx });
  text("kicker", step(0), { text: T("New · 2026"), x: X, y: Y(300), size: 34, font: F.body, weight: F.bodyWeight, color: look.id === "consola" ? C.accent : C.muted, tracking: 6, align }, { in: fxRef(inFx, fmt(m.dur * 0.8) * 1) });
  text(
    "title",
    step(1),
    { text: T(look.id === "consola" ? "> big idea_" : "Big idea"), x: X, y: Y(470), size: Math.min(F.sampleSize ?? (F.upper ? 170 : 150), TITLE_MAX[look.id] ?? 999), font: F.display, weight: F.displayWeight, color: C.ink, tracking: F.tracking ?? 0, align, ...(look.glow ? { glow: 26, glowColor: C.accent } : {}) },
    { in: fxRef(m.textIn, m.dur), ...(look.id === "maximalista" && m.loop ? { loop: { id: m.loop, dur: 0.8, amount: 0.3 } } : {}) },
  );
  text("sub", step(2), { text: "How this style moves", x: X, y: Y(600), size: 44, font: F.body, weight: F.bodyWeight, color: C.muted, align }, { in: fxRef(inFx, m.dur) });
  const bw = 420, bh = 120, bx = left ? 330 : 540, by = Y(790);
  const r = Math.min(look.shape.radius, bh / 2);
  const bIn = fxRef(m.in === "draw" ? "pop" : m.textIn === "type" ? "fade" : m.in, fmt(m.dur * 0.8) * 1);
  if (look.shape.hardShadow) shape("shadow", "rect", step(3), { x: bx + look.shape.hardShadow, y: by + look.shape.hardShadow, w: bw, h: bh, radius: r, fill: "#000000" }, { in: bIn });
  shape(
    "button",
    "rect",
    step(3),
    { x: bx, y: by, w: bw, h: bh, radius: r, fill: look.id === "plano" ? "#00000000" : C.accent, ...(look.shape.stroke ? { stroke: look.shape.stroke.color, strokeWidth: look.shape.stroke.width } : {}), ...(look.glow && look.id !== "consola" ? { glow: 30, glowColor: C.accent } : {}) },
    { in: bIn, ...(m.loop && ["pulse", "float", "breathe"].includes(m.loop) ? { loop: fxRef(m.loop === "breathe" ? "pulse" : m.loop, 1.4) } : {}) },
  );
  text("button-label", fmt(Number(step(3)) + 0.08), { text: T("Start"), x: bx, y: by, size: 46, font: F.body, weight: Math.max(600, F.bodyWeight), color: look.id === "plano" ? C.ink : C.onAccent, tracking: F.upper ? 4 : 0 }, { in: bIn });
  return { background: C.bg, duration: D, layers: layers.map((l) => (l.fx === undefined ? (({ fx, ...rest }) => rest)(l) : l)) };
}


const lookLine = (l) => {
  const F = l.fonts, m = l.motion;
  return `${l.id} | ${l.gist} | bg ${l.colors.bg} ink ${l.colors.ink} accent ${l.colors.accent} | ${F.display} ${F.displayWeight}${F.upper ? " UPPER" : ""} + ${F.body} | ${m.textIn}/${m.in}/${m.out}${m.loop ? "/" + m.loop : ""} ${m.ease} | ${l.deco}`;
};

const looks = {
  summary: "13 complete visual identities (palette, fonts, shape, texture, motion). Pick one, then ask look:<id>.",
  notes: [
    "id | mood | colours | fonts (title + body) | motion titles/in/out/loop + ease | texture. Ask get_motion_recipe('look:<id>') for the exact palette, rules and a working 1080x1920 layer set (deco code layer, title, button...) to copy and adapt.",
    "Every look uses ONLY its own colours and fonts: do not mix looks. Fonts are loaded by name from Google Fonts.",
  ],
  table: LOOKS.map(lookLine),
};

// ---------- assembly ----------
const jsonBlock = (o) => "```json\n" + o + "\n```";
const layersJson = (layers) => "[\n" + layers.map((l) => "  " + JSON.stringify(l)).join(",\n") + "\n]";

function fragmentText(f) {
  const out = [];
  const head = {};
  for (const k of ["background", "duration", "scenes", "audio", "camera"]) if (f[k] !== undefined) head[k] = f[k];
  if (Object.keys(head).length) out.push(jsonBlock(JSON.stringify(head)));
  if (f.layers) out.push(jsonBlock('"layers": ' + layersJson(f.layers)));
  if (f.docs) for (const [id, html] of Object.entries(f.docs)) out.push(`docs.${id}:\n` + "```html\n" + html + "\n```");
  return out.join("\n");
}

const STATIC = { autoedit, "autoedit-screens": autoeditScreens, riso, choreography, audio, camera, "code-texture": codeTexture, "ui-mockup": uiMockup, "scene-bg": sceneBg };

function lookRecipe(look) {
  const C = look.colors, F = look.fonts, m = look.motion, s = look.shape;
  const lines = [
    `# look:${look.id}. ${look.gist}`,
    `colours: bg ${C.bg}, ink ${C.ink}, muted ${C.muted}, accent ${C.accent}, accent2 ${C.accent2}, onAccent ${C.onAccent}. Use no others.`,
    `type: titles ${F.display} ${F.displayWeight}${F.upper ? " UPPERCASE" : ""}${F.tracking ? `, tracking ${F.tracking}` : ""}; body ${F.body} ${F.bodyWeight}${F.mono ? `; labels/data ${F.mono}` : ""}.`,
    `shape: radius ${s.radius >= 999 ? "pill (999)" : s.radius}${s.stroke ? `, border ${s.stroke.color} ${s.stroke.width}px` : ""}${s.hardShadow ? `, flat shadow = a black rect identical to the shape, offset ${s.hardShadow}px right/down, under it` : ""}; ${look.glow ? "glow allowed, in the accent colour, sparingly" : "no glow, no neon, no soft shadows"}; texture: ${look.deco}.`,
    `motion: titles fx.in ${m.textIn}, other layers ${m.in}, exits ${m.out}${m.loop ? `, one loop ${m.loop}` : ""}; ease ${m.ease}, entrance ${m.dur} s, stagger ${m.stagger} s between elements.`,
    `rule: ${look.rules}`,
    "Working layers (adapt text, add scenes; keep this palette, fonts and motion):",
  ];
  return lines.join("\n") + "\n" + fragmentText(lookFragment(look));
}

export const RECIPE_NAMES = [...Object.keys(STATIC), "looks", ...LOOKS.map((l) => `look:${l.id}`)];

/** The composition fragment behind a recipe (for tests, and for the server to validate on boot if it wants). */
export function recipeFragment(name) {
  if (STATIC[name]) return STATIC[name].fragment;
  const m = /^look:(.+)$/.exec(name);
  const look = m && LOOKS.find((l) => l.id === m[1]);
  return look ? lookFragment(look) : null;
}

export function recipeIndex() {
  const rows = Object.entries(STATIC).map(([k, v]) => `${k}: ${v.summary}`);
  rows.push(`looks: ${looks.summary}`);
  return `Motion recipes. Call get_motion_recipe with name=:\n${rows.join("\n")}\nlook:<id> (${LOOKS.map((l) => l.id).join(", ")}): one look in full.`;
}

/** Text of a recipe, or null when the name is unknown. */
export function recipeText(name) {
  if (STATIC[name]) {
    const r = STATIC[name];
    return `# ${name}. ${r.summary}\n${r.notes.map((n) => "- " + n).join("\n")}\n${fragmentText(r.fragment)}`;
  }
  if (name === "looks") return `# looks. ${looks.summary}\n${looks.notes.map((n) => "- " + n).join("\n")}\n${looks.table.join("\n")}`;
  const m = /^look:(.+)$/.exec(name);
  const look = m && LOOKS.find((l) => l.id === m[1]);
  return look ? lookRecipe(look) : null;
}

/** What get_motion_recipe answers: the index without a name; the recipe; or the index plus a note for an unknown name. */
export function motionRecipe(name) {
  if (name === undefined || name === null || name === "") return { found: true, text: recipeIndex() };
  const key = String(name).trim().toLowerCase();
  const text = recipeText(key);
  if (text) return { found: true, text };
  return { found: false, text: `No recipe called "${name}".\n${recipeIndex()}` };
}
