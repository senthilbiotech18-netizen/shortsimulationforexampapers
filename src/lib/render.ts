import type { Frame, ProjectSettings, TransitionType } from "@/types";

export interface DrawContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

/** Draw an image into a rect using contain or cover fit. */
export function drawImageFitted(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cw: number,
  ch: number,
  fit: "contain" | "cover",
  bg: string,
  scale = 1,
  offsetX = 0,
  offsetY = 0,
) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, cw, ch);

  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;

  const scaleBase = fit === "cover" ? Math.max(cw / iw, ch / ih) : Math.min(cw / iw, ch / ih);
  const s = scaleBase * scale;
  const dw = iw * s;
  const dh = ih * s;
  const dx = (cw - dw) / 2 + offsetX;
  const dy = (ch - dh) / 2 + offsetY;

  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawCaption(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  caption: string,
) {
  if (!caption.trim()) return;
  const fontSize = Math.max(16, Math.round(ch * 0.045));
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";

  const padding = fontSize * 0.6;
  const maxWidth = cw * 0.86;
  const lines = wrapText(ctx, caption, maxWidth);
  const lineHeight = fontSize * 1.3;
  const blockHeight = lines.length * lineHeight + padding * 2;

  const baseY = ch - padding - 24;
  const boxTop = baseY - blockHeight + padding;

  // background pill
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, cw / 2 - maxWidth / 2 - padding, boxTop, maxWidth + padding * 2, blockHeight, 12);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  lines.forEach((line, i) => {
    ctx.fillText(line, cw / 2, baseY - i * lineHeight);
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, y + w, y, r);
  ctx.closePath();
}

function drawProgress(
  ctx: CanvasRenderingContext2D,
  cw: number,
  ch: number,
  progress: number,
) {
  const barH = 6;
  const w = cw * progress;
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(0, ch - barH, cw, barH);
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(0, ch - barH, w, barH);
}

function drawFrameCounter(
  ctx: CanvasRenderingContext2D,
  cw: number,
  index: number,
  total: number,
) {
  const fontSize = 16;
  ctx.font = `600 ${fontSize}px ui-monospace, monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, 12, 12, 96, 30, 8);
  ctx.fill();
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText(`${index + 1} / ${total}`, 22, 19);
}

/** Apply a transition between the previous frame and the current frame.
 * t goes 0 -> 1 across the transition window at the start of a frame. */
export function drawFrame(
  dc: DrawContext,
  prev: HTMLImageElement | null,
  curr: HTMLImageElement,
  settings: ProjectSettings,
  transition: TransitionType,
  t: number,
  caption: string,
  overlay: { progress: number; frameIndex: number; total: number },
) {
  const { ctx, width: cw, height: ch } = dc;
  ctx.save();
  ctx.clearRect(0, 0, cw, ch);

  if (transition === "none" || !prev || t >= 1) {
    drawImageFitted(ctx, curr, cw, ch, settings.fit, settings.background);
  } else if (transition === "fade") {
    drawImageFitted(ctx, prev, cw, ch, settings.fit, settings.background);
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = settings.background;
    ctx.fillRect(0, 0, cw, ch);
    ctx.globalAlpha = t;
    drawImageFitted(ctx, curr, cw, ch, settings.fit, settings.background);
    ctx.globalAlpha = 1;
  } else if (transition === "crossfade") {
    drawImageFitted(ctx, prev, cw, ch, settings.fit, settings.background);
    ctx.globalAlpha = t;
    drawImageFitted(ctx, curr, cw, ch, settings.fit, settings.background);
    ctx.globalAlpha = 1;
  } else if (transition === "slide") {
    const offset = (1 - t) * cw;
    drawImageFitted(ctx, prev, cw, ch, settings.fit, settings.background, 1, -offset, 0);
    drawImageFitted(ctx, curr, cw, ch, settings.fit, settings.background, 1, cw - offset, 0);
  } else if (transition === "zoom") {
    const scale = 1 + 0.12 * t;
    drawImageFitted(ctx, prev, cw, ch, settings.fit, settings.background, 1 - t * 0.04);
    ctx.globalAlpha = t;
    drawImageFitted(ctx, curr, cw, ch, settings.fit, settings.background, scale);
    ctx.globalAlpha = 1;
  }

  drawCaption(ctx, cw, ch, caption);
  if (settings.showProgress) drawProgress(ctx, cw, ch, overlay.progress);
  if (settings.showFrameCounter) drawFrameCounter(ctx, cw, overlay.frameIndex, overlay.total);

  ctx.restore();
}

/** Compute the absolute time of each frame boundary. */
export function frameBoundaries(frames: Frame[]): number[] {
  const bounds: number[] = [0];
  let acc = 0;
  for (const f of frames) {
    acc += f.durationMs;
    bounds.push(acc);
  }
  return bounds;
}

export const TRANSITION_MS = 500;

/** Given a time in ms, return {frameIndex, localT (within frame), transitionT}. */
export function timeToFrame(
  timeMs: number,
  frames: Frame[],
  boundaries: number[],
): { index: number; localT: number; transitionT: number; prevIndex: number } {
  const total = boundaries[boundaries.length - 1] || 0;
  const t = Math.max(0, Math.min(total, timeMs));
  let index = 0;
  for (let i = 0; i < frames.length; i++) {
    if (t >= boundaries[i] && t < boundaries[i + 1]) {
      index = i;
      break;
    }
    if (t >= boundaries[i + 1]) index = i;
  }
  const start = boundaries[index];
  const dur = frames[index]?.durationMs || 1;
  const localT = (t - start) / dur;

  // transition happens in the first TRANSITION_MS of the frame
  const transDur = Math.min(TRANSITION_MS, dur);
  const intoFrame = t - start;
  const transitionT = intoFrame < transDur ? intoFrame / transDur : 1;

  return { index, localT, transitionT, prevIndex: Math.max(0, index - 1) };
}

export function formatTime(ms: number): string {
  const totalSec = ms / 1000;
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  const cs = Math.floor((ms % 1000) / 10);
  return `${m}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}
