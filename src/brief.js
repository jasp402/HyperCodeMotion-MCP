// Recreation brief returned by get_recreation_brief: how a gallery template is recreated from a public
// motion video, the same rules the HyperCodeMotion team used for its own gallery batches.
export const FORMATS = [
  { variant: "cuadrado", width: 1080, height: 1080, note: "responsive: the Studio also shows it at 1080×1440 (3:4) and 1440×1080 (4:3)" },
  { variant: "vertical", width: 1080, height: 1920 },
  { variant: "horizontal", width: 1920, height: 1080 }
];
export const GROUPS = ["ui", "editorial", "data", "organic", "ugc"];

export const BRIEF = `Recreate the reference video as a HyperCodeMotion gallery template. The user only gave a link: do all of this yourself, then send the result with propose_template. Do not show compositions or code to the user.

1. Analyse the reference: read the prompt that made the video (included below when the page publishes it) and the page itself. List its moments with timings, exact on-screen texts, palette (hex), typefaces (pick close Google Fonts), techniques and transitions.
2. Rebrand: keep the design, structure, rhythm and palette, but the product, signature or hero becomes HyperCodeMotion (an AI-assisted motion editor: Claude generates the animation as data and you edit it directly instead of regenerating it). Slogan "Your ideas, in motion."; other lines: "Edit, don't regenerate.", "Motion as data.", "app.hypercodemotion.com". Write the word HyperCodeMotion in HTML; "Hyper" may use a gradient from #9b5cf6 to #ff7a45 when the background allows. Keep on-screen text in the original's language. Never invent figures about HyperCodeMotion, never keep a real third-party brand or logo.
3. Build three compositions with the same design, 30 fps, at most 45 s (shorten repetitive moments if the original is longer): cuadrado 1080×1080 (responsive: place pieces relative to the centre so it also works at 1080×1440 and 1440×1080), vertical 1080×1920 and horizontal 1920×1080. The original's own ratio must look closest to the original; recompose the other two, do not just centre them. Nothing outside the margins, nothing overlapping, text readable.
4. Use HTML scenes (docs + html layers with data-hcm pieces) by default and native layers where geometry must be edited; follow get_capabilities for layer properties and effects. Engine limits: backdrop-filter does not work; HTML pieces are rasterized at 2×, so avoid camera zoom above 2 on them; code layers do not load fonts; blend only works inside props; fixed layers ignore the camera; colors interpolate between keyframes, gradients do not.
5. Check each composition with validate_json and fix every error.
6. Write the gallery card in Spanish: name (≤ 40 characters), description (one line, ≤ 160), 3 short chips, group (one of ${GROUPS.join(", ")}) and the moments as [name, start, end] in seconds, covering the whole duration.
7. Call propose_template with the source url, the three compositions and the card. If it answers accepted: false, fix what its errors say and call it again. When accepted, give the user the tracking code: the template appears in the Studio gallery marked «Community» once its preview videos are rendered, and get_proposal_status tells how it is going.`;
