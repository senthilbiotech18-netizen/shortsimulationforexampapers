import type { Frame, ProjectSettings } from "@/types";
import { TRANSITIONS } from "@/types";

/** Generate a self-contained HTML file with all images embedded as base64 data URIs.
 * Uses native <img> elements (not canvas) to preserve full original image quality —
 * no resampling, no blurring, no cropping. Images are shown with object-fit: contain
 * so every pixel of the original is visible. */
export function generateStandaloneHtml(frames: Frame[], settings: ProjectSettings): string {
  const frameData = frames.map((f) => ({
    src: f.src,
    caption: f.caption,
    transition: f.transition,
  }));

  const bg = settings.background;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<title>Interactive Simulation</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100%; height: 100%; overflow: hidden; }
  body {
    font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: ${bg};
    color: #f1f5f9;
    user-select: none;
    -webkit-user-select: none;
  }

  /* Image stage — fills the screen, images centered with no cropping */
  .stage {
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    display: flex; align-items: center; justify-content: center;
  }

  .slide {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    opacity: 0;
    transition: opacity 0.5s ease, transform 0.5s ease;
    pointer-events: none;
  }
  .slide.active { opacity: 1; z-index: 2; }

  .slide img {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    image-rendering: -webkit-optimize-contrast;
    image-rendering: crisp-edges;
    -ms-interpolation-mode: nearest-neighbor;
  }

  /* Slide transition variants */
  .slide.trans-fade { transition: opacity 0.5s ease; }
  .slide.trans-crossfade { transition: opacity 0.5s ease; }
  .slide.trans-slide { transition: opacity 0.5s ease, transform 0.5s ease; transform: translateX(100%); }
  .slide.trans-slide.active { transform: translateX(0); }
  .slide.trans-zoom { transition: opacity 0.5s ease, transform 0.5s ease; transform: scale(1.12); }
  .slide.trans-zoom.active { transform: scale(1); }

  /* Caption overlay */
  .caption {
    position: fixed; bottom: 130px; left: 50%;
    transform: translateX(-50%);
    max-width: 80%;
    text-align: center;
    z-index: 15;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.4s ease;
  }
  .caption.visible { opacity: 1; }
  .caption-inner {
    display: inline-block;
    background: rgba(0,0,0,0.6);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    color: #fff;
    font-size: clamp(16px, 2.2vw, 22px);
    font-weight: 600;
    padding: 12px 24px;
    border-radius: 12px;
    line-height: 1.4;
  }

  /* Top bar */
  .top-bar {
    position: fixed; top: 0; left: 0; right: 0;
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 24px;
    z-index: 20;
    pointer-events: none;
    background: linear-gradient(to bottom, rgba(0,0,0,0.35), transparent);
  }
  .badge {
    background: rgba(0,0,0,0.55); backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    color: #38bdf8; font-size: 14px; font-weight: 600;
    padding: 7px 16px; border-radius: 999px;
    border: 1px solid rgba(56,189,248,0.3);
    pointer-events: auto;
  }
  .title {
    color: rgba(255,255,255,0.7); font-size: 13px; font-weight: 500;
    text-shadow: 0 1px 4px rgba(0,0,0,0.6);
  }

  /* Bottom bar */
  .bottom-bar {
    position: fixed; bottom: 0; left: 0; right: 0;
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    padding: 20px 24px 24px;
    z-index: 20;
    background: linear-gradient(to top, rgba(0,0,0,0.45), transparent);
  }
  .dots { display: flex; gap: 7px; align-items: center; }
  .dot {
    width: 9px; height: 9px; border-radius: 999px;
    background: rgba(255,255,255,0.25); cursor: pointer;
    transition: all 0.3s; border: none;
  }
  .dot.active { width: 28px; background: #38bdf8; }
  .dot:hover { background: rgba(255,255,255,0.5); }

  .controls { display: flex; align-items: center; gap: 14px; }
  .btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 13px 28px; border-radius: 14px;
    font-size: 16px; font-weight: 600;
    border: none; cursor: pointer;
    transition: all 0.2s;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .btn-primary {
    background: #38bdf8; color: #fff;
    box-shadow: 0 4px 20px rgba(56,189,248,0.35);
  }
  .btn-primary:hover { background: #0ea5e9; }
  .btn-primary:disabled { opacity: 0.35; cursor: not-allowed; box-shadow: none; }
  .btn-ghost {
    background: rgba(255,255,255,0.12); color: #f1f5f9;
  }
  .btn-ghost:hover { background: rgba(255,255,255,0.2); }
  .btn-ghost:disabled { opacity: 0.35; cursor: not-allowed; }
  .btn-icon { padding: 13px; border-radius: 14px; }

  .hint {
    font-size: 12px; color: rgba(255,255,255,0.4);
    text-align: center;
  }
  .hint kbd {
    display: inline-block; padding: 2px 7px; border-radius: 5px;
    background: rgba(255,255,255,0.12); font-size: 11px;
    font-family: ui-monospace, monospace; margin: 0 2px;
  }

  .progress-bar {
    position: fixed; bottom: 0; left: 0; height: 4px;
    background: #38bdf8; transition: width 0.4s ease;
    z-index: 25;
  }

  .click-zone {
    position: fixed; top: 0; bottom: 0; width: 30%;
    z-index: 5; cursor: pointer;
  }
  .click-left { left: 0; }
  .click-right { right: 0; }

  /* Fullscreen zoom button */
  .fs-btn {
    pointer-events: auto;
    background: rgba(0,0,0,0.55); backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    color: #f1f5f9; border: 1px solid rgba(255,255,255,0.15);
    width: 40px; height: 40px; border-radius: 999px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all 0.2s;
  }
  .fs-btn:hover { background: rgba(56,189,248,0.3); border-color: rgba(56,189,248,0.5); }
  .fs-btn svg { width: 18px; height: 18px; }

  /* Fullscreen immersive mode — hide all UI, show only the image */
  body.zoomed .top-bar,
  body.zoomed .bottom-bar,
  body.zoomed .caption,
  body.zoomed .progress-bar,
  body.zoomed .click-zone { display: none; }
  body.zoomed .stage { z-index: 100; }
  body.zoomed .slide img {
    max-width: 100vw; max-height: 100vh;
  }

  @media (max-width: 600px) {
    .btn { padding: 11px 20px; font-size: 14px; }
    .top-bar { padding: 12px 16px; }
    .bottom-bar { padding: 14px 16px 18px; }
    .caption { bottom: 150px; }
  }
</style>
</head>
<body>

<div class="stage" id="stage">
  ${frameData.map((f, i) => `  <div class="slide${i === 0 ? " active" : ""} trans-${f.transition || "none"}" data-index="${i}">
    <img src="${f.src.replace(/"/g, "&quot;")}" alt="Step ${i + 1}" />
  </div>`).join("\n")}
</div>

<div class="click-zone click-left" id="clickLeft" title="Previous"></div>
<div class="click-zone click-right" id="clickRight" title="Next"></div>

<div class="top-bar">
  <div class="badge" id="badge">Step 1 of ${frames.length}</div>
  <div style="display:flex;align-items:center;gap:12px;pointer-events:auto;">
    <div class="title">Interactive Simulation</div>
    <button class="fs-btn" id="zoomBtn" title="Zoom to fullscreen">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
    </button>
  </div>
</div>

<div class="caption" id="caption">
  <div class="caption-inner" id="captionText"></div>
</div>

<div class="progress-bar" id="progress" style="width: 0%"></div>

<div class="bottom-bar">
  <div class="dots" id="dots"></div>
  <div class="controls">
    <button class="btn btn-ghost" id="prevBtn">&#8592; Previous</button>
    <button class="btn btn-ghost btn-icon" id="restartBtn" title="Restart">&#8634;</button>
    <button class="btn btn-primary" id="nextBtn">Next step &#8594;</button>
  </div>
  <p class="hint">Click <strong>Next step</strong>, tap the right side, or press <kbd>&#8594;</kbd> <kbd>Space</kbd> to advance</p>
</div>

<script>
const FRAMES = ${JSON.stringify(frameData).replace(/<\/script>/gi, "<\\/script>")};
const SHOW_PROGRESS = ${settings.showProgress};

let currentStep = 0;
const slides = document.querySelectorAll(".slide");
const captionEl = document.getElementById("caption");
const captionText = document.getElementById("captionText");

function updateUI() {
  document.getElementById("badge").textContent = "Step " + (currentStep + 1) + " of " + FRAMES.length;
  document.getElementById("progress").style.width = ((currentStep + 1) / FRAMES.length * 100) + "%";
  document.getElementById("prevBtn").disabled = currentStep === 0;
  document.getElementById("nextBtn").disabled = currentStep >= FRAMES.length - 1;
  document.querySelectorAll(".dot").forEach((d, i) => {
    d.classList.toggle("active", i === currentStep);
  });

  const cap = FRAMES[currentStep].caption;
  if (cap && cap.trim()) {
    captionText.textContent = cap;
    captionEl.classList.add("visible");
  } else {
    captionEl.classList.remove("visible");
  }
}

function goTo(index) {
  if (index < 0 || index >= FRAMES.length || index === currentStep) return;
  slides.forEach((s, i) => {
    if (i === index) s.classList.add("active");
    else s.classList.remove("active");
  });
  currentStep = index;
  updateUI();
}

function next() { if (currentStep < FRAMES.length - 1) goTo(currentStep + 1); }
function prev() { if (currentStep > 0) goTo(currentStep - 1); }
function restart() { goTo(0); }

// Init
updateUI();

document.getElementById("nextBtn").addEventListener("click", next);
document.getElementById("prevBtn").addEventListener("click", prev);
document.getElementById("restartBtn").addEventListener("click", restart);
document.getElementById("clickRight").addEventListener("click", next);
document.getElementById("clickLeft").addEventListener("click", prev);

const dotsEl = document.getElementById("dots");
FRAMES.forEach((_, i) => {
  const d = document.createElement("button");
  d.className = "dot" + (i === 0 ? " active" : "");
  d.setAttribute("aria-label", "Go to step " + (i + 1));
  d.addEventListener("click", () => goTo(i));
  dotsEl.appendChild(d);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") { e.preventDefault(); next(); }
  else if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
  else if (e.key === "f" || e.key === "F") { e.preventDefault(); toggleZoom(); }
  else if (e.key === "Escape" && document.fullscreenElement) { /* browser handles exit */ }
});

// Zoom to fullscreen — shows only the image, no UI overlays
function toggleZoom() {
  if (!document.fullscreenElement) {
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
    if (req) req.call(el);
  } else {
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen;
    if (exit) exit.call(document);
  }
}

document.getElementById("zoomBtn").addEventListener("click", toggleZoom);

document.addEventListener("fullscreenchange", () => {
  document.body.classList.toggle("zoomed", !!document.fullscreenElement);
});
document.addEventListener("webkitfullscreenchange", () => {
  document.body.classList.toggle("zoomed", !!document.fullscreenElement);
});
</script>
</body>
</html>`;
}
