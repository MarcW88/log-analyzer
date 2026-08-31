"use client";

import { useRef, useState } from "react";
import { Upload, FileArchive, X, Loader2 } from "lucide-react";
import clsx from "clsx";

interface FileUploaderProps {
  onAnalyzed: (data: unknown) => void;
}

export default function FileUploader({ onAnalyzed }: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const arr = Array.from(incoming).filter(
      (f) =>
        f.name.endsWith(".log") ||
        f.name.endsWith(".gz") ||
        f.name.endsWith(".txt")
    );
    setFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...arr.filter((f) => !names.has(f.name))];
    });
  }

  async function handleAnalyze() {
    if (!files.length) return;
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      for (const f of files) fd.append("files", f);
      const res = await fetch("/api/parse-logs", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Server error");
      }
      const data = await res.json();
      onAnalyzed(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Log Analyzer</h1>
          <p className="text-slate-400 text-sm">
            Upload Apache access logs (.log) or Vercel log drain files (.gz / NDJSON)
          </p>
        </div>

        {/* Drop zone */}
        <div
          className={clsx(
            "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors",
            dragging
              ? "border-blue-400 bg-blue-900/20"
              : "border-slate-600 hover:border-slate-400 bg-slate-800/50"
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <Upload className="mx-auto text-slate-400 mb-4" size={40} />
          <p className="text-slate-300 text-base mb-1">Drop log files here or click to browse</p>
          <p className="text-slate-500 text-xs">.log · .gz · .txt — multiple files supported</p>
          <input
            ref={inputRef}
            type="file"
            accept=".log,.gz,.txt"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((f) => (
              <div
                key={f.name}
                className="flex items-center justify-between bg-slate-700 rounded-lg px-4 py-2"
              >
                <div className="flex items-center gap-2">
                  <FileArchive size={16} className="text-blue-400" />
                  <span className="text-slate-200 text-sm truncate max-w-xs">{f.name}</span>
                  <span className="text-slate-500 text-xs">
                    {(f.size / 1024).toFixed(1)} KB
                  </span>
                </div>
                <button
                  onClick={() => setFiles((prev) => prev.filter((x) => x.name !== f.name))}
                  className="text-slate-500 hover:text-red-400 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={!files.length || loading}
          className={clsx(
            "mt-6 w-full py-3 rounded-xl font-semibold text-white transition-all",
            files.length && !loading
              ? "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/30"
              : "bg-slate-700 text-slate-500 cursor-not-allowed"
          )}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin" />
              Analyzing…
            </span>
          ) : (
            `Analyze ${files.length > 0 ? files.length + " file" + (files.length > 1 ? "s" : "") : ""}`
          )}
        </button>
      </div>
    </div>
  );
}
