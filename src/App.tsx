import { useCallback, useMemo, useState } from "react";
import { Clapperboard, Eraser, Film, Github, Hand, History, Settings2, Zap } from "lucide-react";
import type { Frame, ProjectSettings, TransitionType } from "@/types";
import { uid } from "@/types";
import { frameBoundaries } from "@/lib/render";
import { saveSimulation, makeThumbnail, type SavedSimulation } from "@/lib/history";
import Player from "@/components/Player";
import Uploader from "@/components/Uploader";
import FrameStrip from "@/components/FrameStrip";
import SettingsPanel from "@/components/SettingsPanel";
import Exporter, { ExportResult } from "@/components/Exporter";
import HistoryPanel from "@/components/HistoryPanel";

const DEFAULT_SETTINGS: ProjectSettings = {
  width: 1280,
  height: 720,
  fps: 30,
  fit: "contain",
  background: "#0a0a0a",
  showProgress: true,
  showFrameCounter: false,
};

type Tab = "export" | "settings" | "history";
type PlayMode = "auto" | "step";

export default function App() {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [settings, setSettings] = useState<ProjectSettings>(DEFAULT_SETTINGS);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("export");
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<PlayMode>("auto");
  const [stepIndex, setStepIndex] = useState(0);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const boundaries = useMemo(() => frameBoundaries(frames), [frames]);
  const totalDuration = boundaries[boundaries.length - 1] || 0;

  const addFrames = useCallback((incoming: Frame[]) => {
    setFrames((prev) => [...prev, ...incoming]);
    setSelectedId(incoming[0]?.id ?? null);
  }, []);

  const updateFrame = useCallback((id: string, patch: Partial<Frame>) => {
    setFrames((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }, []);

  const deleteFrame = useCallback((id: string) => {
    setFrames((prev) => prev.filter((f) => f.id !== id));
    setSelectedId((s) => (s === id ? null : s));
  }, []);

  const duplicateFrame = useCallback((id: string) => {
    setFrames((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx === -1) return prev;
      const copy: Frame = { ...prev[idx], id: uid(), name: `${prev[idx].name} copy` };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }, []);

  const reorder = useCallback((from: number, to: number) => {
    setFrames((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const jumpToFrame = useCallback(
    (id: string) => {
      const idx = frames.findIndex((f) => f.id === id);
      if (idx === -1) return;
      setPlaying(false);
      setCurrentTime(boundaries[idx]);
    },
    [frames, boundaries],
  );

  const clearAll = () => {
    setPlaying(false);
    setFrames([]);
    setSelectedId(null);
    setCurrentTime(0);
    setStepIndex(0);
    if (exportUrl) URL.revokeObjectURL(exportUrl);
    setExportUrl(null);
  };

  const applyTransitionAll = (t: TransitionType) => {
    setFrames((prev) => prev.map((f, i) => ({ ...f, transition: i === 0 ? "none" : t })));
  };

  const applyDurationAll = (ms: number) => {
    setFrames((prev) => prev.map((f) => ({ ...f, durationMs: ms })));
  };

  const handleExported = (_blob: Blob, url: string) => {
    if (exportUrl) URL.revokeObjectURL(exportUrl);
    setExportUrl(url);
  };

  const download = () => {
    if (!exportUrl) return;
    const a = document.createElement("a");
    a.href = exportUrl;
    a.download = `simulation-${Date.now()}.webm`;
    a.click();
  };

  const handleExport = useCallback(
    async (type: "video" | "html") => {
      if (frames.length === 0) return;
      try {
        const thumbnail = await makeThumbnail(frames[0].src);
        const sim: SavedSimulation = {
          id: uid(),
          name: `Simulation ${new Date().toLocaleString(undefined, {
            month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
          })}`,
          createdAt: Date.now(),
          frames: frames.map((f) => ({ ...f })),
          settings: { ...settings },
          thumbnail,
          exportType: type,
        };
        await saveSimulation(sim);
        setHistoryRefresh((r) => r + 1);
      } catch {
        // storage may be full or unavailable; silently skip
      }
    },
    [frames, settings],
  );

  const loadFromHistory = (loadedFrames: Frame[], loadedSettings: ProjectSettings) => {
    setPlaying(false);
    setFrames(loadedFrames);
    setSettings(loadedSettings);
    setSelectedId(loadedFrames[0]?.id ?? null);
    setCurrentTime(0);
    setStepIndex(0);
    setMode("auto");
    setTab("export");
    if (exportUrl) URL.revokeObjectURL(exportUrl);
    setExportUrl(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-slate-950/80 border-b border-white/10">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-500 text-white shadow-lg shadow-sky-500/20">
              <Clapperboard size={22} />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">Sequence Studio</h1>
              <p className="text-xs text-slate-500 mt-0.5">Turn image sequences into simulation videos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {frames.length > 0 && (
              <button
                onClick={clearAll}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 transition"
              >
                <Eraser size={15} />
                Clear
              </button>
            )}
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition"
              aria-label="Source"
            >
              <Github size={18} />
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Left: preview + timeline */}
        <div className="space-y-5 min-w-0">
          {/* Mode toggle */}
          {frames.length > 0 && (
            <div className="flex gap-1 p-1 rounded-xl bg-white/5 w-fit">
              <button
                onClick={() => { setMode("auto"); setPlaying(false); }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                  mode === "auto" ? "bg-sky-500 text-white" : "text-slate-300 hover:bg-white/10"
                }`}
              >
                <Zap size={15} /> Auto-play
              </button>
              <button
                onClick={() => { setMode("step"); setPlaying(false); setStepIndex(0); }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition ${
                  mode === "step" ? "bg-sky-500 text-white" : "text-slate-300 hover:bg-white/10"
                }`}
              >
                <Hand size={15} /> Interactive
              </button>
            </div>
          )}

          <Player
            frames={frames}
            settings={settings}
            currentTime={currentTime}
            setCurrentTime={setCurrentTime}
            playing={playing}
            setPlaying={setPlaying}
            mode={mode}
            stepIndex={stepIndex}
            setStepIndex={setStepIndex}
          />

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-300">
                Frames <span className="text-slate-500 font-normal">({frames.length})</span>
              </h2>
              <p className="text-xs text-slate-500">Drag to reorder · double-click to jump</p>
            </div>
            {frames.length === 0 ? (
              <Uploader onAdd={addFrames} />
            ) : (
              <div className="space-y-3">
                <FrameStrip
                  frames={frames}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onReorder={reorder}
                  onDelete={deleteFrame}
                  onDuplicate={duplicateFrame}
                  onUpdate={updateFrame}
                  onJump={jumpToFrame}
                />
                <div className="flex justify-center">
                  <Uploader onAdd={addFrames} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: export / settings / history */}
        <aside className="space-y-4">
          <div className="flex gap-1 p-1 rounded-xl bg-white/5">
            <button
              onClick={() => setTab("export")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-sm font-medium transition ${
                tab === "export" ? "bg-sky-500 text-white" : "text-slate-300 hover:bg-white/10"
              }`}
            >
              <Film size={15} /> Export
            </button>
            <button
              onClick={() => setTab("settings")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-sm font-medium transition ${
                tab === "settings" ? "bg-sky-500 text-white" : "text-slate-300 hover:bg-white/10"
              }`}
            >
              <Settings2 size={15} /> Settings
            </button>
            <button
              onClick={() => setTab("history")}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-sm font-medium transition ${
                tab === "history" ? "bg-sky-500 text-white" : "text-slate-300 hover:bg-white/10"
              }`}
            >
              <History size={15} /> History
            </button>
          </div>

          <div className="rounded-2xl bg-slate-900/50 ring-1 ring-white/10 p-4">
            {tab === "export" ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-slate-100">Download your simulation</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    {frames.length === 0
                      ? "Add frames first, then choose your download format below."
                      : `${frames.length} frames • ${totalDuration ? (totalDuration / 1000).toFixed(1) : 0}s of footage`}
                  </p>
                </div>
                <Exporter
                  frames={frames}
                  settings={settings}
                  onVideoExported={handleExported}
                  onExport={handleExport}
                />
                {exportUrl && (
                  <div className="pt-3 border-t border-white/10">
                    <ExportResult url={exportUrl} onDownload={download} />
                  </div>
                )}
              </div>
            ) : tab === "settings" ? (
              <SettingsPanel
                settings={settings}
                onChange={(patch) => setSettings((s) => ({ ...s, ...patch }))}
                onApplyTransitionAll={applyTransitionAll}
                onApplyDurationAll={applyDurationAll}
                frameCount={frames.length}
              />
            ) : (
              <div className="space-y-3">
                <div>
                  <h3 className="font-semibold text-slate-100">Simulation history</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Every export is saved here on your device. Open one to edit it again, or download as interactive HTML.
                  </p>
                </div>
                <HistoryPanel refreshKey={historyRefresh} onLoad={loadFromHistory} />
              </div>
            )}
          </div>

          {/* Quick tips */}
          <div className="rounded-2xl bg-slate-900/50 ring-1 ring-white/10 p-4 text-sm text-slate-400 space-y-2">
            <p className="font-semibold text-slate-300">How it works</p>
            <ol className="list-decimal list-inside space-y-1 text-slate-400">
              <li>Generate your experimental steps as images in ChatGPT.</li>
              <li>Upload them here in sequence.</li>
              <li>Drag to reorder, add captions, pick transitions.</li>
              <li>Download a <span className="text-slate-300">video</span> or an <span className="text-slate-300">interactive HTML</span> you can upload to AssessPrep.</li>
              <li>Find every past export under the <span className="text-slate-300">History</span> tab.</li>
            </ol>
          </div>
        </aside>
      </main>

      <footer className="max-w-[1400px] mx-auto px-6 py-8 text-center text-xs text-slate-600">
        Everything runs locally in your browser — your images never leave your device.
      </footer>
    </div>
  );
}
