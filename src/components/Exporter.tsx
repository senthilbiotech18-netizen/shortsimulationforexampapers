import { useRef, useState } from "react";
import { Check, Download, FileCode, Film, Loader2, MonitorPlay } from "lucide-react";
import type { Frame, ProjectSettings } from "@/types";
import {
  drawFrame,
  frameBoundaries,
  loadImage,
  timeToFrame,
  TRANSITION_MS,
} from "@/lib/render";
import { generateStandaloneHtml } from "@/lib/exportHtml";

interface ExporterProps {
  frames: Frame[];
  settings: ProjectSettings;
  onVideoExported: (blob: Blob, url: string) => void;
  onExport: (type: "video" | "html") => void;
}

type VideoStatus = "idle" | "recording" | "encoding" | "done" | "error";

export default function Exporter({ frames, settings, onVideoExported, onExport }: ExporterProps) {
  const [videoStatus, setVideoStatus] = useState<VideoStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [htmlDone, setHtmlDone] = useState(false);
  const cancelRef = useRef(false);

  const totalDuration = frames.reduce((s, f) => s + f.durationMs, 0);
  const hasFrames = frames.length > 0;
  const videoBusy = videoStatus === "recording" || videoStatus === "encoding";

  const exportVideo = async () => {
    if (!hasFrames) return;
    setVideoStatus("recording");
    setError(null);
    setProgress(0);
    cancelRef.current = false;

    const canvas = document.createElement("canvas");
    canvas.width = settings.width;
    canvas.height = settings.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setVideoStatus("error");
      setError("Canvas not supported in this browser.");
      return;
    }

    const mimeCandidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
    let mimeType = "video/webm";
    for (const m of mimeCandidates) {
      if (MediaRecorder.isTypeSupported(m)) { mimeType = m; break; }
    }

    let stream: MediaStream;
    try { stream = canvas.captureStream(settings.fps); }
    catch {
      setVideoStatus("error");
      setError("Canvas capture is not supported in this browser.");
      return;
    }

    let recorder: MediaRecorder;
    try { recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 }); }
    catch {
      setVideoStatus("error");
      setError("Video recording is not supported in this browser.");
      return;
    }

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const imageMap = new Map<string, HTMLImageElement>();
    await Promise.all(
      frames.map(async (f) => {
        try { imageMap.set(f.id, await loadImage(f.src)); } catch { /* ignore */ }
      }),
    );

    const boundaries = frameBoundaries(frames);
    const frameInterval = 1000 / settings.fps;
    const totalFrames = Math.ceil(totalDuration / frameInterval);

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      onVideoExported(blob, url);
      onExport("video");
      setVideoStatus("done");
      setProgress(1);
    };

    recorder.start();
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const start = performance.now();

    for (let i = 0; i < totalFrames; i++) {
      if (cancelRef.current) break;
      const timeMs = Math.min(totalDuration, i * frameInterval);
      const { index, transitionT, prevIndex } = timeToFrame(timeMs, frames, boundaries);
      const curr = imageMap.get(frames[index].id);
      if (curr) {
        const transition = index > 0 ? frames[index].transition : "none";
        const prev = transitionT < 1 && transition !== "none" ? imageMap.get(frames[prevIndex].id) || null : null;
        drawFrame(
          { ctx, width: settings.width, height: settings.height },
          prev, curr, settings, transition, transitionT, frames[index].caption,
          { progress: timeMs / totalDuration, frameIndex: index, total: frames.length },
        );
      }
      setProgress(i / totalFrames);
      const target = start + (i + 1) * frameInterval;
      const wait = target - performance.now();
      if (wait > 0) await sleep(wait);
    }

    await sleep(200);
    setVideoStatus("encoding");
    recorder.stop();
  };

  const downloadHtml = () => {
    if (!hasFrames) return;
    const html = generateStandaloneHtml(frames, settings);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interactive-simulation-${Date.now()}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setHtmlDone(true);
    onExport("html");
    setTimeout(() => setHtmlDone(false), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Option 1: Video */}
      <div className="rounded-xl bg-white/5 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-sky-500/15 text-sky-400 shrink-0">
            <Film size={18} />
          </div>
          <div>
            <h4 className="font-semibold text-slate-100 text-sm">Option 1 — Video file</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              A self-playing WebM video that runs through every step automatically.
            </p>
          </div>
        </div>
        <button
          onClick={exportVideo}
          disabled={!hasFrames || videoBusy}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition"
        >
          {videoBusy ? <Loader2 size={16} className="animate-spin" /> : videoStatus === "done" ? <Check size={16} /> : <Film size={16} />}
          {videoStatus === "recording" ? "Recording…" : videoStatus === "encoding" ? "Encoding…" : videoStatus === "done" ? "Render again" : "Render video"}
        </button>
        {videoBusy && (
          <div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-sky-500 transition-all" style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[11px] text-slate-400">{videoStatus === "recording" ? "Capturing…" : "Finalizing…"}</span>
              <span className="text-[11px] text-slate-500 tabular-nums">{Math.round(progress * 100)}%</span>
            </div>
            <button onClick={() => { cancelRef.current = true; }} className="mt-1 text-[11px] text-rose-400 hover:underline">Cancel</button>
          </div>
        )}
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>

      {/* Option 2: Interactive HTML */}
      <div className="rounded-xl bg-white/5 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 shrink-0">
            <MonitorPlay size={18} />
          </div>
          <div>
            <h4 className="font-semibold text-slate-100 text-sm">Option 2 — Interactive simulation</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              A standalone HTML file with Next-step buttons. Open it in any browser or upload to AssessPrep — click through each step live.
            </p>
          </div>
        </div>
        <button
          onClick={downloadHtml}
          disabled={!hasFrames}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition"
        >
          {htmlDone ? <Check size={16} /> : <FileCode size={16} />}
          {htmlDone ? "Downloaded!" : "Download interactive HTML"}
        </button>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          All images are embedded inside the file — no internet needed. Works offline in any modern browser.
        </p>
      </div>
    </div>
  );
}

export function ExportResult({ url, onDownload }: { url: string; onDownload: () => void }) {
  return (
    <div className="space-y-3 pt-3 border-t border-white/10">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Video preview</p>
      <video src={url} controls className="w-full rounded-xl bg-black ring-1 ring-white/10" />
      <button
        onClick={onDownload}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium text-sm transition"
      >
        <Download size={16} />
        Download video
      </button>
    </div>
  );
}
