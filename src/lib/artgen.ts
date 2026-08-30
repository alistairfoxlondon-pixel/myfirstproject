/* Deterministic cover-image renderer.
   Draws a real, seeded geometric composition onto a <canvas> — no network,
   no fake provider. The provider interface (renderImage) is what a
   server-side image model (DALL·E, Flux…) would implement in production. */
import { hashStr, rng } from "./ai";

export type ArtStyle = "editorial" | "band" | "arc" | "grid";

export interface ImageSpec { prompt: string; seed: number; style: ArtStyle; }

/* Restrained tints that sit inside the monochrome system */
const TINTS = [
  [24, 24, 27], [63, 98, 18], [29, 78, 216], [159, 18, 57],
  [126, 34, 206], [180, 83, 9], [15, 118, 110], [67, 56, 202],
];

function mix(a: number[], b: number[], t: number) {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}
const rgb = (c: number[], alpha = 1) => `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;

export function renderImage(canvas: HTMLCanvasElement, spec: ImageSpec, w = 1200, h = 630) {
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const r = rng(hashStr(spec.prompt + "::" + spec.seed + "::" + spec.style));
  const dark = r() > 0.5;
  const base = dark ? [24, 24, 27] : [250, 250, 250];
  const ink = dark ? [244, 244, 245] : [24, 24, 27];
  const tint = TINTS[Math.floor(r() * TINTS.length)];

  /* backdrop */
  ctx.fillStyle = rgb(base);
  ctx.fillRect(0, 0, w, h);

  if (spec.style === "band") {
    const n = 4 + Math.floor(r() * 3);
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((r() - 0.5) * 0.7);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const bh = h / n * (0.5 + r() * 0.9);
      ctx.fillStyle = rgb(mix(base, i % 3 === 0 ? tint : ink, 0.12 + t * 0.5), 0.85);
      ctx.fillRect(-w, -h / 2 + i * (h / n) + (r() - 0.5) * 40, w * 2, bh);
    }
    ctx.restore();
    ctx.fillStyle = rgb(tint, 0.9);
    const cw = w * (0.16 + r() * 0.12);
    ctx.fillRect(w * (0.1 + r() * 0.6), h * (0.15 + r() * 0.4), cw, cw);
  } else if (spec.style === "arc") {
    const cx = w * (0.25 + r() * 0.5), cy = h * (0.3 + r() * 0.4);
    const rings = 5 + Math.floor(r() * 4);
    for (let i = rings; i > 0; i--) {
      const rad = (Math.min(w, h) * 0.52 * i) / rings;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fillStyle = rgb(i % 4 === 1 ? tint : mix(base, ink, (i / rings) * 0.55), 0.9);
      ctx.fill();
    }
    ctx.fillStyle = rgb(base, 0.95);
    ctx.fillRect(0, h * (0.68 + r() * 0.14), w, h);
  } else if (spec.style === "grid") {
    const cols = 6, rows = 4;
    const cw = w / cols, ch = h / rows;
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      const v = r();
      if (v < 0.16) {
        ctx.fillStyle = rgb(tint, 0.85);
        ctx.fillRect(x * cw + 6, y * ch + 6, cw - 12, ch - 12);
      } else if (v < 0.42) {
        ctx.beginPath();
        ctx.arc(x * cw + cw / 2, y * ch + ch / 2, Math.min(cw, ch) / 2 - 8, 0, Math.PI * 2);
        ctx.fillStyle = rgb(mix(base, ink, 0.25 + v), 0.7);
        ctx.fill();
      } else if (v < 0.6) {
        ctx.fillStyle = rgb(mix(base, ink, 0.14 + v * 0.3), 0.8);
        ctx.fillRect(x * cw + 10, y * ch + 10, cw - 20, ch - 20);
      }
    }
  } else {
    /* editorial: big shapes + type block */
    ctx.fillStyle = rgb(mix(base, ink, 0.08));
    ctx.fillRect(0, 0, w * (0.42 + r() * 0.2), h);
    ctx.fillStyle = rgb(tint, 0.92);
    const s = h * (0.24 + r() * 0.16);
    ctx.beginPath();
    ctx.arc(w * (0.6 + r() * 0.2), h * (0.3 + r() * 0.3), s / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgb(ink, 0.85);
    ctx.fillRect(w * 0.08, h * 0.62, w * 0.3, h * 0.055);
    ctx.fillRect(w * 0.08, h * 0.72, w * 0.2, h * 0.035);
    ctx.strokeStyle = rgb(ink, 0.35);
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(w * 0.55 + i * 26, h * 0.78);
      ctx.lineTo(w * 0.55 + i * 26 + 90, h * 0.78);
      ctx.stroke();
    }
  }

  /* grain */
  const grain = Math.floor((w * h) / 900);
  for (let i = 0; i < grain; i++) {
    ctx.fillStyle = rgb(ink, r() * 0.06);
    ctx.fillRect(r() * w, r() * h, 1.4, 1.4);
  }
  /* frame */
  ctx.strokeStyle = rgb(ink, 0.25);
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, w - 28, h - 28);
}

export function imageDataUrl(spec: ImageSpec, w = 1200, h = 630): string {
  const c = document.createElement("canvas");
  renderImage(c, spec, w, h);
  return c.toDataURL("image/png");
}

/* Deterministic alt-text from the prompt — honest, descriptive, no stuffing */
export function suggestAltText(prompt: string): string {
  const words = prompt.toLowerCase().replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(w => w.length > 3).slice(0, 6);
  const core = words.length ? words.join(" ") : "generated cover";
  return `Abstract cover illustration for ${core}`;
}
