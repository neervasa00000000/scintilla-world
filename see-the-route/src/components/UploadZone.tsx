"use client";

import { useCallback, useId, useRef, useState } from "react";

interface UploadZoneProps {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function UploadZone({ onFile, disabled }: UploadZoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const accept = useCallback(
    (file: File | undefined | null) => {
      if (!file || disabled) return;
      if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) {
        return;
      }
      onFile(file);
    },
    [disabled, onFile]
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      aria-label="Upload map or route screenshot"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        accept(e.dataTransfer.files?.[0]);
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`relative cursor-pointer rounded-2xl border border-dashed px-6 py-10 text-center transition outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
        dragOver
          ? "border-emerald-400/80 bg-emerald-400/5"
          : "border-white/15 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.05]"
      } ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => accept(e.target.files?.[0])}
      />
      <p className="text-sm font-medium tracking-wide text-zinc-200">
        Drop a map / route screenshot
      </p>
      <p className="mt-2 text-xs text-zinc-500">
        PNG or JPG · processed entirely in your browser · never uploaded
      </p>
      <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-zinc-600">
        Click or press Enter to browse
      </p>
    </div>
  );
}
