import { useEffect, useState } from "react";
import { Clock, Download, FileCode, History, Loader2, Trash2, Upload } from "lucide-react";
import type { Frame, ProjectSettings } from "@/types";
import {
  listSimulations,
  deleteSimulation,
  type SavedSimulation,
} from "@/lib/history";
import { generateStandaloneHtml } from "@/lib/exportHtml";

interface HistoryPanelProps {
  refreshKey: number;
  onLoad: (frames: Frame[], settings: ProjectSettings) => void;
}

export default function HistoryPanel({ refreshKey, onLoad }: HistoryPanelProps) {
  const [items, setItems] = useState<SavedSimulation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listSimulations()
      .then((sims) => { if (!cancelled) setItems(sims); })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const handleDelete = async (id: string) => {
    await deleteSimulation(id);
    setItems((prev) => prev.filter((s) => s.id !== id));
  };

  const downloadHtml = (sim: SavedSimulation) => {
    const html = generateStandaloneHtml(sim.frames, sim.settings);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sim.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-500">
        <Loader2 size={18} className="animate-spin mr-2" /> Loading history…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <History size={28} className="mx-auto mb-2 opacity-40" />
        <p className="text-sm">No saved simulations yet.</p>
        <p className="text-xs mt-1">Every video or HTML you export is automatically saved here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((sim) => (
        <div
          key={sim.id}
          className="group rounded-xl bg-white/5 ring-1 ring-white/10 p-3 hover:ring-white/20 transition"
        >
          <div className="flex gap-3">
            <div className="shrink-0 w-24 h-16 rounded-lg overflow-hidden bg-black/40">
              <img src={sim.thumbnail} alt={sim.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm text-slate-200 truncate">{sim.name}</p>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                <Clock size={11} />
                {new Date(sim.createdAt).toLocaleString(undefined, {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300">
                  {sim.frames.length} frames
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-300 capitalize">
                  {sim.exportType}
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-1.5 mt-3 opacity-0 group-hover:opacity-100 transition">
            <button
              onClick={() => onLoad(sim.frames, sim.settings)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-xs font-medium transition"
            >
              <Upload size={13} /> Open
            </button>
            <button
              onClick={() => downloadHtml(sim)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-medium transition"
            >
              <FileCode size={13} /> HTML
            </button>
            <button
              onClick={() => handleDelete(sim.id)}
              className="inline-flex items-center justify-center px-2 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium transition"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
