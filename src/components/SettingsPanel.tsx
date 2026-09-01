import { Gauge, Layers, Monitor, Palette, Settings2, Sparkles } from "lucide-react";
import type { FrameFit, ProjectSettings } from "@/types";
import { ASPECT_PRESETS, BG_PRESETS, TRANSITIONS } from "@/types";
import type { TransitionType } from "@/types";

interface SettingsPanelProps {
  settings: ProjectSettings;
  onChange: (patch: Partial<ProjectSettings>) => void;
  onApplyTransitionAll: (t: TransitionType) => void;
  onApplyDurationAll: (ms: number) => void;
  frameCount: number;
}

export default function SettingsPanel({
  settings,
  onChange,
  onApplyTransitionAll,
  onApplyDurationAll,
  frameCount,
}: SettingsPanelProps) {
  return (
    <div className="space-y-5">
    <div>
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
        <Monitor size={13} /> Canvas size
      </label>
      <div className="grid grid-cols-2 gap-2">
        {ASPECT_PRESETS.map((p) => {
          const active = settings.width === p.width && settings.height === p.height;
          return (
            <button
              key={p.label}
              onClick={() => onChange({ width: p.width, height: p.height })}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                active ? "bg-sky-500 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2 mt-2">
        <label className="flex-1 text-xs text-slate-400">
          W
          <input
            type="number"
            min={120}
            value={settings.width}
            onChange={(e) => onChange({ width: Math.max(120, Number(e.target.value) || 120) })}
            className="w-full mt-1 bg-white/5 rounded-md px-2 py-1.5 text-slate-200 outline-none focus:ring-1 focus:ring-sky-400"
          />
        </label>
        <label className="flex-1 text-xs text-slate-400">
          H
          <input
            type="number"
            min={120}
            value={settings.height}
            onChange={(e) => onChange({ height: Math.max(120, Number(e.target.value) || 120) })}
            className="w-full mt-1 bg-white/5 rounded-md px-2 py-1.5 text-slate-200 outline-none focus:ring-1 focus:ring-sky-400"
          />
        </label>
      </div>
    </div>

    <div>
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
        <Gauge size={13} /> Frame rate
      </label>
      <div className="flex gap-2">
        {[24, 30, 60].map((fps) => (
          <button
            key={fps}
            onClick={() => onChange({ fps })}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
              settings.fps === fps ? "bg-sky-500 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {fps} fps
          </button>
        ))}
      </div>
    </div>

    <div>
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
        <Layers size={13} /> Image fit
      </label>
      <div className="flex gap-2">
        {(["contain", "cover"] as FrameFit[]).map((fit) => (
          <button
            key={fit}
            onClick={() => onChange({ fit })}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium capitalize transition ${
              settings.fit === fit ? "bg-sky-500 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
          >
            {fit}
          </button>
        ))}
      </div>
    </div>

    <div>
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
        <Palette size={13} /> Background
      </label>
      <div className="flex gap-2 flex-wrap">
        {BG_PRESETS.map((c) => (
          <button
            key={c}
            onClick={() => onChange({ background: c })}
            className={`w-9 h-9 rounded-lg ring-2 transition ${
              settings.background === c ? "ring-sky-400" : "ring-white/10 hover:ring-white/30"
            }`}
            style={{ background: c }}
          />
        ))}
        <input
          type="color"
          value={settings.background}
          onChange={(e) => onChange({ background: e.target.value })}
          className="w-9 h-9 rounded-lg bg-transparent border border-white/10 cursor-pointer"
        />
      </div>
    </div>

    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
        <Settings2 size={13} /> Overlays
      </label>
      <Toggle label="Progress bar" checked={settings.showProgress} onChange={(v) => onChange({ showProgress: v })} />
      <Toggle label="Frame counter" checked={settings.showFrameCounter} onChange={(v) => onChange({ showFrameCounter: v })} />
    </div>

    {frameCount > 0 && (
      <div className="pt-3 border-t border-white/10 space-y-3">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
          <Sparkles size={13} /> Apply to all frames
        </label>
        <select
          onChange={(e) => onApplyTransitionAll(e.target.value as TransitionType)}
          defaultValue=""
          className="w-full text-sm bg-white/5 rounded-lg px-3 py-2 text-slate-200 outline-none focus:ring-1 focus:ring-sky-400"
        >
          <option value="" disabled className="bg-slate-900">Set transition for all…</option>
          {TRANSITIONS.map((t) => (
            <option key={t.value} value={t.value} className="bg-slate-900">{t.label}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="number"
            min={200}
            max={20000}
            step={100}
            placeholder="Duration (ms)"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = Number((e.target as HTMLInputElement).value);
                if (v >= 200) onApplyDurationAll(v);
              }
            }}
            className="flex-1 text-sm bg-white/5 rounded-lg px-3 py-2 text-slate-200 placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-sky-400"
          />
          <button
            onClick={(e) => {
              const input = (e.currentTarget.previousSibling as HTMLInputElement);
              const v = Number(input.value);
              if (v >= 200) onApplyDurationAll(v);
            }}
            className="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-slate-300 transition"
          >
            Apply
          </button>
        </div>
      </div>
    )}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between w-full text-sm text-slate-300"
    >
      <span>{label}</span>
      <span className={`relative w-10 h-6 rounded-full transition ${checked ? "bg-sky-500" : "bg-white/10"}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition ${checked ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
