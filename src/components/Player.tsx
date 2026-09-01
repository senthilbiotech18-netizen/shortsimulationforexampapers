import { useCallback, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Hand, Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import type { Frame, ProjectSettings } from "@/types";
import {
  drawFrame,
  frameBoundaries,
  loadImage,
  timeToFrame,
  formatTime,
  TRANSITION_MS,
} from "@/lib/render";

interface PlayerProps {
  frames: Frame[];
  settings: ProjectSettings;
  currentTime: number;
  setCurrentTime: (t: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  mode: "auto" | "step";
  stepIndex: number;
  setStepIndex: (i: number) => void;
}

export default function Player({
  frames,
  settings,
  currentTime,
  setCurrentTime,
  playing,
  setPlaying,
  mode,
  stepIndex,
  setStepIndex,
}: PlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);
  const timeRef = useRef(currentTime);
  const playingRef = useRef(playing);
  const modeRef = useRef(mode);
  const stepIndexRef = useRef(stepIndex);
  const stepAnimRef = useRef<number | null>(null);

  useEffect(() => { timeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { stepIndexRef.current = stepIndex; }, [stepIndex]);

  const totalDuration = frames.reduce((s, f) => s + f.durationMs, 0);
  const boundaries = frameBoundaries(frames);

  // Preload images
  useEffect(() => {
    let cancelled = false;
    const map = imagesRef.current;
    frames.forEach((f) => {
      if (!map.has(f.id)) {
        loadImage(f.src).then((img) => {
          if (!cancelled) map.set(f.id, img);
        }).catch(() => {});
      }
    });
    return () => { cancelled = true; };
  }, [frames]);

  const renderAt = useCallback(
    (timeMs: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = settings.width;
      canvas.height = settings.height;

      if (frames.length === 0) {
        ctx.fillStyle = settings.background;
        ctx.fillRect(0, 0, settings.width, settings.height);
        ctx.fillStyle = "#64748b";
        ctx.font = `500 ${Math.round(settings.height * 0.04)}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("Add frames to preview your simulation", settings.width / 2, settings.height / 2);
        return;
      }

      const { index, transitionT, prevIndex } = timeToFrame(timeMs, frames, boundaries);
      const curr = imagesRef.current.get(frames[index].id);
      const prev = index > 0 ? imagesRef.current.get(frames[prevIndex].id) : null;
      if (!curr) {
        ctx.fillStyle = settings.background;
        ctx.fillRect(0, 0, settings.width, settings.height);
        return;
      }
      const transition = index > 0 ? frames[index].transition : "none";
      drawFrame(
        { ctx, width: settings.width, height: settings.height },
        transitionT < 1 && transition !== "none" ? prev : null,
        curr,
        settings,
        transition,
        transitionT,
        frames[index].caption,
        { progress: totalDuration ? timeMs / totalDuration : 0, frameIndex: index, total: frames.length },
      );
    },
    [frames, settings, boundaries, totalDuration],
  );

  /** Render a specific frame index with an explicit transition progress (for step mode). */
  const renderStep = useCallback(
    (index: number, transT: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = settings.width;
      canvas.height = settings.height;

      if (frames.length === 0 || index < 0 || index >= frames.length) {
        ctx.fillStyle = settings.background;
        ctx.fillRect(0, 0, settings.width, settings.height);
        return;
      }

      const curr = imagesRef.current.get(frames[index].id);
      const prev = index > 0 ? imagesRef.current.get(frames[index - 1].id) : null;
      if (!curr) {
        ctx.fillStyle = settings.background;
        ctx.fillRect(0, 0, settings.width, settings.height);
        return;
      }
      const transition = index > 0 ? frames[index].transition : "none";
      const progress = frames.length ? (index + (transT < 1 ? transT : 1)) / frames.length : 0;
      drawFrame(
        { ctx, width: settings.width, height: settings.height },
        transT < 1 && transition !== "none" ? prev : null,
        curr,
        settings,
        transition,
        transT,
        frames[index].caption,
        { progress, frameIndex: index, total: frames.length },
      );
    },
    [frames, settings],
  );

  // Render whenever time/frames/settings change while paused (auto mode)
  useEffect(() => {
    if (modeRef.current === "auto" && !playingRef.current) renderAt(currentTime);
  }, [currentTime, renderAt, playing]);

  // Render the current step when step mode is idle (no animation)
  useEffect(() => {
    if (modeRef.current === "step" && stepAnimRef.current === null) {
      renderStep(stepIndex, 1);
    }
  }, [stepIndex, mode, renderStep, frames, settings]);

  // Playback loop (auto mode)
  useEffect(() => {
    if (mode !== "auto" || !playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTickRef.current = 0;
      return;
    }
    if (frames.length === 0) {
      setPlaying(false);
      return;
    }
    lastTickRef.current = performance.now();

    const tick = (now: number) => {
      const dt = lastTickRef.current ? now - lastTickRef.current : 0;
      lastTickRef.current = now;
      let t = timeRef.current + dt;
      if (t >= totalDuration) {
        t = totalDuration;
        renderAt(t);
        setCurrentTime(t);
        setPlaying(false);
        return;
      }
      timeRef.current = t;
      renderAt(t);
      setCurrentTime(t);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, mode, frames, totalDuration, renderAt, setCurrentTime, setPlaying]);

  const animateStepTransition = useCallback(
    (toIndex: number) => {
      if (frames.length === 0) return;
      if (stepAnimRef.current) cancelAnimationFrame(stepAnimRef.current);

      const fromIndex = stepIndexRef.current;
      const trans = toIndex > 0 ? frames[toIndex].transition : "none";
      const dur = trans === "none" ? 200 : TRANSITION_MS;
      const start = performance.now();

      const tick = (now: number) => {
        const elapsed = now - start;
        const t = Math.min(1, elapsed / dur);
        renderStep(toIndex, t);
        if (t < 1) {
          stepAnimRef.current = requestAnimationFrame(tick);
        } else {
          stepAnimRef.current = null;
          setStepIndex(toIndex);
        }
      };
      stepAnimRef.current = requestAnimationFrame(tick);
    },
    [frames, renderStep, setStepIndex],
  );

  const stepForward = useCallback(() => {
    if (frames.length === 0) return;
    if (stepAnimRef.current) return; // mid-animation, ignore
    const next = Math.min(frames.length - 1, stepIndexRef.current + 1);
    if (next !== stepIndexRef.current) animateStepTransition(next);
  }, [frames.length, animateStepTransition]);

  const stepBackward = useCallback(() => {
    if (frames.length === 0) return;
    if (stepAnimRef.current) cancelAnimationFrame(stepAnimRef.current);
    stepAnimRef.current = null;
    const prev = Math.max(0, stepIndexRef.current - 1);
    setStepIndex(prev);
    renderStep(prev, 1);
  }, [frames.length, renderStep, setStepIndex]);

  // Keyboard navigation in step mode
  useEffect(() => {
    if (mode !== "step") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        stepForward();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepBackward();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, stepForward, stepBackward]);

  // Cleanup step animation on unmount / mode switch
  useEffect(() => {
    if (mode !== "step" && stepAnimRef.current) {
      cancelAnimationFrame(stepAnimRef.current);
      stepAnimRef.current = null;
    }
  }, [mode]);

  const togglePlay = () => {
    if (frames.length === 0) return;
    if (mode === "step") return;
    if (currentTime >= totalDuration - 1) {
      setCurrentTime(0);
      timeRef.current = 0;
    }
    setPlaying(!playing);
  };

  const skipFrame = (dir: -1 | 1) => {
    setPlaying(false);
    const { index } = timeToFrame(currentTime, frames, boundaries);
    let next = index + dir;
    if (next < 0) next = 0;
    if (next >= frames.length) next = frames.length - 1;
    setCurrentTime(boundaries[next]);
    timeRef.current = boundaries[next];
  };

  const restart = () => {
    if (mode === "step") {
      if (stepAnimRef.current) cancelAnimationFrame(stepAnimRef.current);
      stepAnimRef.current = null;
      setStepIndex(0);
      renderStep(0, 1);
    } else {
      setPlaying(false);
      setCurrentTime(0);
      timeRef.current = 0;
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (mode === "step") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const t = Math.max(0, Math.min(totalDuration, ratio * totalDuration));
    setPlaying(false);
    setCurrentTime(t);
    timeRef.current = t;
  };

  const isLastStep = stepIndex >= frames.length - 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative rounded-2xl overflow-hidden bg-black ring-1 ring-white/10 shadow-2xl">
        <canvas
          ref={canvasRef}
          className="block w-full h-auto"
          style={{ aspectRatio: `${settings.width} / ${settings.height}` }}
        />
        {mode === "step" && frames.length > 0 && (
          <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/60 backdrop-blur text-xs font-medium text-sky-300 ring-1 ring-sky-400/30">
            <Hand size={13} />
            Step {stepIndex + 1} of {frames.length}
          </div>
        )}
      </div>

      {mode === "auto" ? (
        <>
          {/* Transport */}
          <div className="flex items-center gap-2">
            <button
              onClick={restart}
              disabled={frames.length === 0}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 transition"
              title="Restart"
            >
              <RotateCcw size={18} />
            </button>
            <button
              onClick={() => skipFrame(-1)}
              disabled={frames.length === 0}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 transition"
              title="Previous frame"
            >
              <SkipBack size={18} />
            </button>
            <button
              onClick={togglePlay}
              disabled={frames.length === 0}
              className="p-3 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 transition text-white"
              title={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button
              onClick={() => skipFrame(1)}
              disabled={frames.length === 0}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 transition"
              title="Next frame"
            >
              <SkipForward size={18} />
            </button>
            <div className="ml-2 text-sm tabular-nums text-slate-400">
              {formatTime(currentTime)} / {formatTime(totalDuration)}
            </div>
          </div>

          {/* Scrubber */}
          <div onClick={seek} className="group relative h-3 rounded-full bg-white/10 cursor-pointer">
            <div
              className="absolute top-0 left-0 h-full rounded-full bg-sky-500"
              style={{ width: `${totalDuration ? (currentTime / totalDuration) * 100 : 0}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 transition"
              style={{ left: `${totalDuration ? (currentTime / totalDuration) * 100 : 0}%` }}
            />
          </div>

          {/* Frame ticks */}
          <div className="flex gap-0.5 h-1.5">
            {frames.map((f, i) => (
              <div
                key={f.id}
                className="flex-1 rounded-full bg-white/15"
                style={{ flexGrow: f.durationMs }}
                title={`Frame ${i + 1} • ${f.transition} • ${f.durationMs}ms`}
              />
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Transitions use the first {TRANSITION_MS}ms of each frame.
          </p>
        </>
      ) : (
        <>
          {/* Step mode controls */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={stepBackward}
              disabled={frames.length === 0 || stepIndex === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 transition text-sm font-medium"
            >
              <ChevronLeft size={18} />
              Previous
            </button>
            <button
              onClick={restart}
              disabled={frames.length === 0}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-40 transition"
              title="Back to start"
            >
              <RotateCcw size={18} />
            </button>
            <button
              onClick={stepForward}
              disabled={frames.length === 0 || isLastStep}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 transition text-white text-sm font-semibold"
            >
              Next step
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Step dots */}
          <div className="flex gap-1.5 justify-center">
            {frames.map((f, i) => (
              <button
                key={f.id}
                onClick={() => {
                  if (i === stepIndex) return;
                  if (i < stepIndex) {
                    setStepIndex(i);
                    renderStep(i, 1);
                  } else {
                    animateStepTransition(i);
                  }
                }}
                className={`h-2 rounded-full transition-all ${
                  i === stepIndex ? "w-6 bg-sky-400" : "w-2 bg-white/20 hover:bg-white/40"
                }`}
                title={`Step ${i + 1}`}
              />
            ))}
          </div>
          <p className="text-xs text-slate-500 text-center">
            Click <span className="text-slate-300 font-medium">Next step</span> or press
            <kbd className="mx-1 px-1.5 py-0.5 rounded bg-white/10 text-slate-300 text-[10px]">→</kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-slate-300 text-[10px]">Space</kbd>
            to advance the simulation.
          </p>
        </>
      )}
    </div>
  );
}
