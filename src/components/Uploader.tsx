import { useRef, useState } from "react";
import { ImagePlus, UploadCloud } from "lucide-react";
import type { Frame } from "@/types";
import { uid } from "@/types";

interface UploaderProps {
  onAdd: (frames: Frame[]) => void;
}

export default function Uploader({ onAdd }: UploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    Promise.all(
      imageFiles.map(
        (file) =>
          new Promise<Frame>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const src = reader.result as string;
              const img = new Image();
              img.onload = () => {
                resolve({
                  id: uid(),
                  name: file.name,
                  src,
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                  durationMs: 1500,
                  caption: "",
                  transition: imageFiles.indexOf(file) === 0 ? "none" : "crossfade",
                });
              };
              img.onerror = () =>
                resolve({
                  id: uid(),
                  name: file.name,
                  src,
                  width: 1280,
                  height: 720,
                  durationMs: 1500,
                  caption: "",
                  transition: "crossfade",
                });
              img.src = src;
            };
            reader.readAsDataURL(file);
          }),
      ),
    ).then(onAdd);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`relative rounded-2xl border-2 border-dashed transition p-6 text-center ${
        dragging ? "border-sky-400 bg-sky-400/10" : "border-white/15 bg-white/5 hover:border-white/25"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="flex flex-col items-center gap-3">
        <div className="p-3 rounded-full bg-sky-500/15 text-sky-400">
          <UploadCloud size={28} />
        </div>
        <div>
          <p className="font-semibold text-slate-100">Drop your ChatGPT-generated images here</p>
          <p className="text-sm text-slate-400 mt-1">
            Drag to reorder them into the right sequence below.
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-medium transition"
        >
          <ImagePlus size={18} />
          Browse images
        </button>
      </div>
    </div>
  );
}
