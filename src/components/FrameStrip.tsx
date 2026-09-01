import { useRef } from "react";
import { Clock, Copy, GripVertical, Trash2 } from "lucide-react";
import type { Frame, TransitionType } from "@/types";
import { TRANSITIONS } from "@/types";
import { formatTime } from "@/lib/render";

interface FrameStripProps {
  frames: Frame[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onUpdate: (id: string, patch: Partial<Frame>) => void;
  onJump: (id: string) => void;
}

export default function FrameStrip({
  frames,
  selectedId,
  onSelect,
  onReorder,
  onDelete,
  onDuplicate,
  onUpdate,
  onJump,
}: FrameStripProps) {
  const dragIndex = useRef<number | null>(null);
  const overIndex = useRef<number | null>(null);

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
      {frames.map((f, i) => (
        <div
          key={f.id}
          draggable
          onDragStart={() => {
            dragIndex.current = i;
          }}
          onDragOver={(e) => {
            e.preventDefault();
            overIndex.current = i;
          }}
          onDragEnd={() => {
            if (dragIndex.current !== null && overIndex.current !== null && dragIndex.current !== overIndex.current) {
              onReorder(dragIndex.current, overIndex.current);
            }
            dragIndex.current = null;
            overIndex.current = null;
          }}
          onClick={() => onSelect(f.id)}
          onDoubleClick={() => onJump(f.id)}
          className={`group relative shrink-0 w-40 rounded-xl border transition cursor-grab active:cursor-grabbing ${
            selectedId === f.id
              ? "border-sky-400 ring-2 ring-sky-400/40"
              : "border-white/10 hover:border-white/30"
          } bg-slate-900/60`}
        >
          <div className="flex items-center justify-between px-2 pt-2">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
              <GripVertical size={12} className="opacity-50" />
              {i + 1}
            </span>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
              <button
                onClick={(e) => { e.stopPropagation(); onDuplicate(f.id); }}
                className="p-1 rounded hover:bg-white/10 text-slate-400"
                title="Duplicate"
              >
                <Copy size={12} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(f.id); }}
                className="p-1 rounded hover:bg-rose-500/20 text-rose-400"
                title="Delete"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>

          <div className="mx-2 mt-1 mb-2 rounded-lg overflow-hidden bg-black/40 aspect-video">
            <img src={f.src} alt={f.name} className="w-full h-full object-contain" draggable={false} />
          </div>

          <div className="px-2 pb-2 space-y-1.5">
            <input
              type="text"
              value={f.caption}
              onChange={(e) => onUpdate(f.id, { caption: e.target.value })}
              onClick={(e) => e.stopPropagation()}
              placeholder="Caption…"
              className="w-full text-[11px] bg-white/5 rounded-md px-2 py-1.5 text-slate-200 placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-sky-400"
            />
            <div className="flex gap-1">
              <select
                value={f.transition}
                onChange={(e) => onUpdate(f.id, { transition: e.target.value as TransitionType })}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 text-[11px] bg-white/5 rounded-md px-1.5 py-1.5 text-slate-200 outline-none focus:ring-1 focus:ring-sky-400"
              >
                {TRANSITIONS.map((t) => (
                  <option key={t.value} value={t.value} className="bg-slate-900">
                    {t.label}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1 text-[11px] text-slate-400 bg-white/5 rounded-md px-1.5">
                <Clock size={11} />
                <input
                  type="number"
                  min={200}
                  max={20000}
                  step={100}
                  value={f.durationMs}
                  onChange={(e) => onUpdate(f.id, { durationMs: Math.max(200, Number(e.target.value) || 200) })}
                  onClick={(e) => e.stopPropagation()}
                  className="w-12 bg-transparent text-right outline-none text-slate-200"
                />
              </div>
            </div>
            <div className="text-[10px] text-slate-500 text-right">{formatTime(f.durationMs)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
