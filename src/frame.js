/**
 * The canvas decides type size. Same numbers as Studio packages/core/src/frame.ts
 * (the PANTALLA block). A requested size is a wish: if the text does not fit the
 * safe area, it is lowered or wrapped. What still leaves the canvas is cropped by
 * the format, not by its own box.
 */

const RATIOS = [
  [1, "1:1"],
  [9 / 16, "9:16"],
  [16 / 9, "16:9"],
  [4 / 5, "4:5"],
  [5 / 4, "5:4"],
  [3 / 4, "3:4"],
  [4 / 3, "4:3"],
  [2 / 3, "2:3"],
  [3 / 2, "3:2"],
  [9 / 19.5, "9:19.5"],
];

const SIDE_WIDE = 0.06;
const SIDE_TIGHT = 0.07;
const TOP_FLAT = 0.08;
const TOP_VERTICAL = 0.12;
const BOTTOM_FLAT = 0.08;
const BOTTOM_VERTICAL = 0.18;
const TITLE_CHARS = 14;
const TITLE_HEIGHT = 0.22;
const TITLE_SHORT = 0.16;
/** Width estimate for mixed-case text. Mostly-uppercase lines use TEXT_WIDTH_WIDE. */
export const TEXT_WIDTH = 0.62;
export const TEXT_WIDTH_WIDE = 0.7;

const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

/** Safe area and starting sizes for a canvas. Proportions travel with the short side. */
export function frameOf(width, height) {
  const W = Math.max(1, Math.round(width));
  const H = Math.max(1, Math.round(height));
  const ratio = W / H;
  let name = `${W}×${H}`;
  let best = Infinity;
  for (const [r, label] of RATIOS) {
    const d = Math.abs(Math.log(ratio / r));
    if (d < best) {
      best = d;
      name = label;
    }
  }
  if (best > Math.log(1.04)) name = `${W}×${H}`;

  const vertical = H > W * 1.05;
  const square = !vertical && W <= H * 1.05;
  const short = Math.min(W, H);
  const mx = clamp(Math.round(short * (vertical || square ? SIDE_TIGHT : SIDE_WIDE)), 16, Math.round(W * 0.2));
  const my = clamp(Math.round(H * (vertical ? TOP_VERTICAL : TOP_FLAT)), 16, Math.round(H * 0.22));
  const mb = clamp(Math.round(H * (vertical ? BOTTOM_VERTICAL : BOTTOM_FLAT)), 16, Math.round(H * 0.3));
  const safeW = Math.max(32, W - mx * 2);
  const safeH = Math.max(32, H - my - mb);
  const title = clamp(Math.round(Math.min(safeW / (TITLE_CHARS * TEXT_WIDTH), safeH * TITLE_HEIGHT)), 16, Math.round(short * TITLE_SHORT));
  const support = clamp(Math.round(title * 0.42), 13, title);
  const label = clamp(Math.round(title * 0.24), 11, support);
  return { name, mx, my, mb, safeW, safeH, title, support, label, vertical };
}

/** Spoken once, from get_capabilities.screen. Skills point here; they do not restate the formula. */
export function screenRule() {
  return `The canvas format decides type size and placement, before a requested size, a look, or the text "size" property. "size" is a wish. The idea decides the words; the composition's width and height decide whether that text fits or the canvas crops it.

Name the ratio by the closest of 1:1, 9:16, 16:9, 4:5, 5:4, 3:4, 4:3, 2:3, 3:2, 9:19.5, using |log(ratio / candidate)|. If that distance is greater than log(1.04), name it W×H. Vertical means height > width × 1.05. Square means not vertical and width <= height × 1.05.

Safe area, in canvas pixels. Side margin mx = clamp(round(min(W,H) × ${SIDE_TIGHT} when vertical or square, else × ${SIDE_WIDE}), 16, round(W × 0.2)). Top my = clamp(round(H × ${TOP_VERTICAL} when vertical, else × ${TOP_FLAT}), 16, round(H × 0.22)). Bottom mb = clamp(round(H × ${BOTTOM_VERTICAL} when vertical, else × ${BOTTOM_FLAT}), 16, round(H × 0.3)). Vertical formats use the larger top and bottom because app icons live there. Text lives in (W − 2×mx) by (H − my − mb), at least 32×32.

Starting sizes are not minimums. title = clamp(round(min(safeW / (${TITLE_CHARS} × ${TEXT_WIDTH}), safeH × ${TITLE_HEIGHT})), 16, round(min(W,H) × ${TITLE_SHORT})); support = clamp(round(title × 0.42), 13, title); label = clamp(round(title × 0.24), 11, support). Do not copy a pixel size from one ratio onto another.

Fit, in order. (1) Wrap lines so each fits the safe width. Width ≈ characters × size × ${TEXT_WIDTH} (× ${TEXT_WIDTH_WIDE} when the line is mostly uppercase). (2) Height ≈ lines × size × line-height, and it has to fit the safe height. (3) If it does not fit, lower the size or wrap more lines. line-height must be at least 1. Below that, the piece box is shorter than the glyphs and crops them. The box wraps the letters (width:max-content, or the measured width of a text layer).

validate_json rejects measurable native text and HTML pieces that cannot fit this safe area, text that crosses the canvas, and line-height below 1. It warns when text sits in the margin but still inside the canvas. It does not render, and it does not measure expressions, parented placement, rotation, shadows or filters. fullyValidated stays false: a pass is not proof of how the picture looks.`;
}
