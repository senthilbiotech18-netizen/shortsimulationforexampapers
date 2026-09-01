export type FrameFit = "contain" | "cover";

export type TransitionType = "none" | "fade" | "crossfade" | "slide" | "zoom";

export interface Frame {
  id: string;
  name: string;
  src: string;
  width: number;
  height: number;
  durationMs: number;
  caption: string;
  transition: TransitionType;
}

export interface ProjectSettings {
  width: number;
  height: number;
  fps: number;
  fit: FrameFit;
  background: string;
  showProgress: boolean;
  showFrameCounter: boolean;
}

export const TRANSITIONS: { value: TransitionType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade through black" },
  { value: "crossfade", label: "Crossfade" },
  { value: "slide", label: "Slide" },
  { value: "zoom", label: "Zoom" },
];

export const ASPECT_PRESETS: { label: string; width: number; height: number }[] = [
  { label: "16:9 Landscape", width: 1280, height: 720 },
  { label: "9:16 Portrait", width: 720, height: 1280 },
  { label: "1:1 Square", width: 900, height: 900 },
  { label: "4:3 Classic", width: 1024, height: 768 },
];

export const BG_PRESETS = [
  "#000000",
  "#0f172a",
  "#111827",
  "#1e293b",
  "#ffffff",
];

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
