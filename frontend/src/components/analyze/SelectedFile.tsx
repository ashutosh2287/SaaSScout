"use client";

import { formatFileSize } from "@/lib/validateFile";

export type SelectedFileInfo = {
  name: string;
  size: number;
  type: string;
};

function fileIcon(type: string) {
  if (type.toLowerCase().endsWith(".xlsx")) return "XLSX";
  if (type.toLowerCase().endsWith(".csv")) return "CSV";
  return "FILE";
}

export function SelectedFile({
  file,
  onRemove,
}: {
  file: SelectedFileInfo;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50/50 px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-700 text-xs font-bold text-white"
        >
          {fileIcon(file.name)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-900">✓ {file.name}</p>
          <p className="text-xs text-zinc-500">
            {fileIcon(file.name)} • {formatFileSize(file.size)}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition-colors hover:bg-white hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      >
        Remove
      </button>
    </div>
  );
}