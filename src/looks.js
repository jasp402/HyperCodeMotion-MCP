// Looks: the 13 visual identities of the Studio (packages/core/src/looks.ts), as data.
// Values (colours, fonts, shape, motion) are copied from the Studio; the `gist` and `rules` text is a
// literal English translation of the Studio's Spanish. Source contract: jasp402/HyperCodeMotion@c75a0b3.
// `DECO` is the Studio's DECO_CODE for each `deco` (the code of a `code` layer); `circuit` is trimmed to its
// grid + node dots (the full one is 2 KB of traced pulses).

export const LOOKS = [
 {
  "id": "medianoche",
  "name": "Medianoche",
  "gist": "Cinematic dark, a single warm accent.",
  "colors": {
   "bg": "#07070C",
   "ink": "#F4F1EA",
   "muted": "#8C8A99",
   "accent": "#FF4D2E",
   "accent2": "#2A2838",
   "onAccent": "#07070C"
  },
  "fonts": {
   "display": "Bebas Neue",
   "displayWeight": 400,
   "upper": true,
   "tracking": 4,
   "body": "Inter",
   "bodyWeight": 500
  },
  "shape": {
   "radius": 8
  },
  "glow": true,
  "deco": "vignette",
  "motion": {
   "textIn": "rise",
   "in": "fade",
   "out": "fade",
   "loop": "breathe",
   "ease": "easeOutCubic",
   "dur": 0.8,
   "stagger": 0.25
  },
  "rules": "Lots of black, high contrast, accent on one or two pieces only. Reveals out of shadow, no bounces."
 },
 {
  "id": "explicativo",
  "name": "Explicativo tech",
  "gist": "Charcoal, kinetic type and one accent: explain an idea in 10-30 s.",
  "colors": {
   "bg": "#111318",
   "ink": "#FFFFFF",
   "muted": "#8B909C",
   "accent": "#F7931A",
   "accent2": "#1E2129",
   "onAccent": "#111318"
  },
  "fonts": {
   "display": "Sora",
   "displayWeight": 800,
   "tracking": -2,
   "body": "Sora",
   "bodyWeight": 300,
   "mono": "JetBrains Mono"
  },
  "shape": {
   "radius": 10
  },
  "glow": true,
  "deco": "circuit",
  "motion": {
   "textIn": "pop",
   "in": "slide",
   "out": "fade",
   "loop": "breathe",
   "ease": "easeOutBack",
   "dur": 0.35,
   "stagger": 0.12
  },
  "rules": "One idea per beat. Accent only on one key word, number or icon per scene. No extra effects, no motion without a reason."
 },
 {
  "id": "cartel",
  "name": "Cartel de bloques",
  "gist": "Solid colour fields and ultra-heavy type.",
  "colors": {
   "bg": "#FF4B1F",
   "ink": "#111111",
   "muted": "#3A1206",
   "accent": "#FFD400",
   "accent2": "#1E4BFF",
   "onAccent": "#111111"
  },
  "fonts": {
   "display": "Archivo Black",
   "displayWeight": 400,
   "upper": true,
   "tracking": -2,
   "sampleSize": 116,
   "body": "Archivo",
   "bodyWeight": 700
  },
  "shape": {
   "radius": 0
  },
  "glow": false,
  "deco": "none",
  "motion": {
   "textIn": "pop",
   "in": "slide",
   "out": "slide",
   "ease": "easeOutBack",
   "dur": 0.45,
   "stagger": 0.12
  },
  "rules": "Full colour planes slide in and cover the background; huge text, no gradients or shadows."
 },
 {
  "id": "suizo",
  "name": "Suizo",
  "gist": "Strict grid, one grotesque, red and black.",
  "colors": {
   "bg": "#F2F0EB",
   "ink": "#111111",
   "muted": "#6F6C66",
   "accent": "#E30613",
   "accent2": "#111111",
   "onAccent": "#FFFFFF"
  },
  "fonts": {
   "display": "Inter",
   "displayWeight": 800,
   "tracking": -1,
   "body": "Inter",
   "bodyWeight": 500
  },
  "shape": {
   "radius": 0
  },
  "glow": false,
  "deco": "grid",
  "motion": {
   "textIn": "slide",
   "in": "slide",
   "out": "slide",
   "ease": "easeOutExpo",
   "dur": 0.55,
   "stagger": 0.1
  },
  "rules": "Everything on a grid, left-aligned text, big numbers, zero ornament. Precise, linear moves."
 },
 {
  "id": "editorial",
  "name": "Editorial claro",
  "gist": "White, hairlines, magazine serif with a grotesque.",
  "colors": {
   "bg": "#FFFFFF",
   "ink": "#121212",
   "muted": "#6B6B6B",
   "accent": "#2F4BFF",
   "accent2": "#EEEBE4",
   "onAccent": "#FFFFFF"
  },
  "fonts": {
   "display": "Playfair Display",
   "displayWeight": 700,
   "body": "Inter",
   "bodyWeight": 400
  },
  "shape": {
   "radius": 2
  },
  "glow": false,
  "deco": "hairlines",
  "motion": {
   "textIn": "rise",
   "in": "fade",
   "out": "fade",
   "ease": "easeOutCubic",
   "dur": 0.9,
   "stagger": 0.2
  },
  "rules": "Lots of white space, thin rules, magazine hierarchy. Slow, soft entrances."
 },
 {
  "id": "papel",
  "name": "Papel y tinta",
  "gist": "Cream paper, black ink, serif and typewriter.",
  "colors": {
   "bg": "#F3EBDD",
   "ink": "#1B1A17",
   "muted": "#6E6355",
   "accent": "#D9472B",
   "accent2": "#E8B04A",
   "onAccent": "#F3EBDD"
  },
  "fonts": {
   "display": "DM Serif Display",
   "displayWeight": 400,
   "body": "IBM Plex Mono",
   "bodyWeight": 500
  },
  "shape": {
   "radius": 4
  },
  "glow": false,
  "deco": "grain",
  "motion": {
   "textIn": "words",
   "in": "rise",
   "out": "fade",
   "loop": "sway",
   "ease": "easeOutQuart",
   "dur": 0.7,
   "stagger": 0.18
  },
  "rules": "Printed, warm look; accents as stamps or underlines. No glow or neon."
 },
 {
  "id": "lujo",
  "name": "Lujo oscuro",
  "gist": "Black and gold, tall spaced serif, calm.",
  "colors": {
   "bg": "#0C0B09",
   "ink": "#E9DFC8",
   "muted": "#8F8572",
   "accent": "#C9A35B",
   "accent2": "#24211B",
   "onAccent": "#0C0B09"
  },
  "fonts": {
   "display": "Cormorant Garamond",
   "displayWeight": 600,
   "upper": true,
   "tracking": 14,
   "sampleSize": 96,
   "body": "Montserrat",
   "bodyWeight": 400
  },
  "shape": {
   "radius": 0,
   "stroke": {
    "color": "#C9A35B",
    "width": 2
   }
  },
  "glow": false,
  "deco": "frame",
  "motion": {
   "textIn": "blur",
   "in": "fade",
   "out": "fade",
   "ease": "easeInOutSine",
   "dur": 1.4,
   "stagger": 0.35
  },
  "rules": "Few elements, small spaced text, slow blur reveals. Nothing fast or saturated."
 },
 {
  "id": "brutalista",
  "name": "Brutalista",
  "gist": "Thick black borders, flat shadows, loud colour.",
  "colors": {
   "bg": "#F4F4F0",
   "ink": "#000000",
   "muted": "#333333",
   "accent": "#FFE500",
   "accent2": "#FF5BCB",
   "onAccent": "#000000"
  },
  "fonts": {
   "display": "Space Grotesk",
   "displayWeight": 700,
   "upper": true,
   "tracking": -1,
   "sampleSize": 136,
   "body": "Space Mono",
   "bodyWeight": 700
  },
  "shape": {
   "radius": 0,
   "stroke": {
    "color": "#000000",
    "width": 8
   },
   "hardShadow": 16
  },
  "glow": false,
  "deco": "dots",
  "motion": {
   "textIn": "drop",
   "in": "drop",
   "out": "slide",
   "ease": "easeOutQuart",
   "dur": 0.35,
   "stagger": 0.08
  },
  "rules": "Boxes with a thick black border and a flat offset shadow (no blur). Abrupt moves, like pressed buttons."
 },
 {
  "id": "pastel",
  "name": "Pastel juguetón",
  "gist": "Stacked pastels, round shapes, bounce.",
  "colors": {
   "bg": "#FFE9F0",
   "ink": "#3B2A4A",
   "muted": "#7E6A8C",
   "accent": "#7AD3B5",
   "accent2": "#FFC56B",
   "onAccent": "#3B2A4A"
  },
  "fonts": {
   "display": "Fredoka",
   "displayWeight": 700,
   "body": "Nunito",
   "bodyWeight": 700
  },
  "shape": {
   "radius": 999
  },
  "glow": false,
  "deco": "blobs",
  "motion": {
   "textIn": "pop",
   "in": "pop",
   "out": "zoom",
   "loop": "float",
   "ease": "easeOutElastic",
   "dur": 0.6,
   "stagger": 0.12
  },
  "rules": "Everything rounded and friendly, soft colours; elastic entrances and floating shapes."
 },
 {
  "id": "consola",
  "name": "Consola",
  "gist": "Terminal: monospace, phosphor green and amber.",
  "colors": {
   "bg": "#050805",
   "ink": "#39FF88",
   "muted": "#1E8B4E",
   "accent": "#FFB000",
   "accent2": "#0F2A18",
   "onAccent": "#050805"
  },
  "fonts": {
   "display": "JetBrains Mono",
   "displayWeight": 800,
   "sampleSize": 92,
   "body": "JetBrains Mono",
   "bodyWeight": 400
  },
  "shape": {
   "radius": 2
  },
  "glow": true,
  "deco": "scanlines",
  "motion": {
   "textIn": "type",
   "in": "fade",
   "out": "fade",
   "loop": "blink",
   "ease": "linear",
   "dur": 0.8,
   "stagger": 0.3
  },
  "rules": "Text typed character by character, blinking cursor, scanlines. All monospace."
 },
 {
  "id": "plano",
  "name": "Plano técnico",
  "gist": "Blueprint blue with a white grid and strokes that draw themselves.",
  "colors": {
   "bg": "#0F3D8C",
   "ink": "#EAF2FF",
   "muted": "#9DBBEA",
   "accent": "#FFFFFF",
   "accent2": "#6FA8FF",
   "onAccent": "#0F3D8C"
  },
  "fonts": {
   "display": "Space Grotesk",
   "displayWeight": 600,
   "upper": true,
   "tracking": 3,
   "sampleSize": 130,
   "body": "IBM Plex Mono",
   "bodyWeight": 400
  },
  "shape": {
   "radius": 0,
   "stroke": {
    "color": "#EAF2FF",
    "width": 3
   }
  },
  "glow": false,
  "deco": "fine-grid",
  "motion": {
   "textIn": "type",
   "in": "draw",
   "out": "fade",
   "ease": "easeInOutCubic",
   "dur": 0.9,
   "stagger": 0.2
  },
  "rules": "Outline-only shapes that draw (draw), technical labels and dimensions, grid background."
 },
 {
  "id": "saas",
  "name": "Datos / SaaS",
  "gist": "Interface cards, numbers and bars on night blue.",
  "colors": {
   "bg": "#0B1020",
   "ink": "#F5F7FF",
   "muted": "#8A93B5",
   "accent": "#5B8CFF",
   "accent2": "#22D3A6",
   "onAccent": "#FFFFFF"
  },
  "fonts": {
   "display": "Inter",
   "displayWeight": 700,
   "tracking": 0,
   "body": "Inter",
   "bodyWeight": 500
  },
  "shape": {
   "radius": 22
  },
  "glow": true,
  "deco": "dots",
  "motion": {
   "textIn": "rise",
   "in": "rise",
   "out": "fade",
   "loop": "pulse",
   "ease": "easeOutQuart",
   "dur": 0.6,
   "stagger": 0.12
  },
  "rules": "Rounded interface cards, big counting numbers, progress bars; blue and green accents."
 },
 {
  "id": "maximalista",
  "name": "Tipografía maximalista",
  "gist": "Giant overlapping text, saturated and fast.",
  "colors": {
   "bg": "#1A0033",
   "ink": "#FFFFFF",
   "muted": "#B79CFF",
   "accent": "#FF2BD6",
   "accent2": "#00F0FF",
   "onAccent": "#1A0033"
  },
  "fonts": {
   "display": "Anton",
   "displayWeight": 400,
   "upper": true,
   "tracking": 0,
   "body": "Inter",
   "bodyWeight": 800
  },
  "shape": {
   "radius": 0
  },
  "glow": true,
  "deco": "none",
  "motion": {
   "textIn": "letters",
   "in": "zoom",
   "out": "zoom",
   "loop": "shake",
   "ease": "easeOutBack",
   "dur": 0.4,
   "stagger": 0.06
  },
  "rules": "The text IS the design: huge words filling the frame, repeated and overlapped, fast cuts."
 }
];

export const DECO = {
  grain: `ctx.fillStyle = color; ctx.globalAlpha = 0.07 * amount;
for (let i = 0; i < 2600; i++) { const s = 1 + rand(i, 3) * 2.2; ctx.fillRect(rand(i, 1) * w, rand(i, 2) * h, s, s); }`,
  grid: `ctx.strokeStyle = color; ctx.globalAlpha = 0.14 * amount; ctx.lineWidth = 2; const g = w / 6;
for (let x = g; x < w; x += g) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
for (let y = g; y < h; y += g) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }`,
  "fine-grid": `ctx.strokeStyle = color; ctx.lineWidth = 1; const g = w / 24;
for (let x = 0, i = 0; x <= w; x += g, i++) { ctx.globalAlpha = (i % 4 ? 0.12 : 0.28) * amount; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
for (let y = 0, i = 0; y <= h; y += g, i++) { ctx.globalAlpha = (i % 4 ? 0.12 : 0.28) * amount; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }`,
  dots: `ctx.fillStyle = color; ctx.globalAlpha = 0.16 * amount; const g = w / 18;
for (let x = g / 2; x < w; x += g) for (let y = g / 2; y < h; y += g) { ctx.beginPath(); ctx.arc(x, y, 2.4, 0, TAU); ctx.fill(); }`,
  scanlines: `ctx.fillStyle = color; for (let y = 0; y < h; y += 6) { ctx.globalAlpha = (0.05 + 0.02 * sin(y * 0.05 + t * 8)) * amount; ctx.fillRect(0, y, w, 2); }
ctx.globalAlpha = 0.06 * amount; ctx.fillRect(0, ((t * 260) % (h + 200)) - 100, w, 60);`,
  frame: `ctx.strokeStyle = color; ctx.globalAlpha = 0.7 * amount; ctx.lineWidth = 2; const m = w * 0.05;
ctx.strokeRect(m, m, w - 2 * m, h - 2 * m); ctx.globalAlpha = 0.35 * amount; ctx.strokeRect(m + 14, m + 14, w - 2 * m - 28, h - 2 * m - 28);`,
  vignette: `const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0," + (0.7 * amount) + ")"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
ctx.fillStyle = color; for (let i = 0; i < 60; i++) { ctx.globalAlpha = 0.25 * amount * rand(i, 4); const y = (rand(i, 2) * h - t * (20 + rand(i, 5) * 40)) % h; ctx.fillRect(rand(i, 1) * w, y < 0 ? y + h : y, 3, 3); }`,
  blobs: `ctx.fillStyle = color; for (let i = 0; i < 5; i++) { ctx.globalAlpha = 0.18 * amount; const r = w * (0.12 + rand(i, 7) * 0.14);
ctx.beginPath(); ctx.arc(rand(i, 1) * w + sin(t * 0.8 + i) * 30, rand(i, 2) * h + cos(t * 0.6 + i * 2) * 30, r, 0, TAU); ctx.fill(); }`,
  hairlines: `ctx.strokeStyle = color; ctx.globalAlpha = 0.5 * amount; ctx.lineWidth = 2; const m = w * 0.07;
for (const k of [0.1, 0.9]) { ctx.beginPath(); ctx.moveTo(m, h * k); ctx.lineTo(m + (w - 2 * m) * clamp(t / 1.2, 0, 1), h * k); ctx.stroke(); }`,
  circuit: `const cols = 10, g = w / cols, rows = Math.ceil(h / g), pulse = 0.5 + 0.5 * sin((t * TAU) / 3);
ctx.lineWidth = 1.5; ctx.strokeStyle = "#FFFFFF"; ctx.globalAlpha = (0.05 + 0.03 * pulse) * amount;
ctx.beginPath(); for (let i = 0; i <= cols; i++) { ctx.moveTo(i * g, 0); ctx.lineTo(i * g, h); } for (let j = 0; j <= rows; j++) { ctx.moveTo(0, j * g); ctx.lineTo(w, j * g); } ctx.stroke();
ctx.fillStyle = "#FFFFFF"; for (let i = 0; i <= cols; i++) for (let j = 0; j <= rows; j++) { ctx.globalAlpha = (0.08 + 0.04 * sin(t * 2 + i * 0.7 + j * 0.4)) * amount; ctx.fillRect(i * g - 2, j * g - 2, 4, 4); }`,
};
