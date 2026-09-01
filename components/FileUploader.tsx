"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, FolderOpen, FileArchive, X, Loader2, FolderInput } from "lucide-react";
import clsx from "clsx";
import { aggregateResults } from "@/lib/aggregateResults";

interface FileUploaderProps {
  onAnalyzed: (data: unknown) => void;
}

const BATCH_SIZE = 3;
const ALLOWED_EXT = [".gz", ".log", ".txt"];

function isAllowed(name: string) {
  return ALLOWED_EXT.some((ext) => name.toLowerCase().endsWith(ext));
}

// Recursively collect all files from a FileSystemEntry
async function collectFromEntry(entry: FileSystemEntry): Promise<File[]> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      (entry as FileSystemFileEntry).file(
        (f) => (isAllowed(f.name) ? resolve([f]) : resolve([])),
        () => resolve([])
      );
    });
  }

  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const all: File[] = [];

    // readEntries must be called repeatedly until it returns []
    const readBatch = (): Promise<FileSystemEntry[]> =>
      new Promise((res, rej) => reader.readEntries(res, rej));

    let batch: FileSystemEntry[];
    do {
      batch = await readBatch();
      for (const child of batch) {
        const childFiles = await collectFromEntry(child);
        all.push(...childFiles);
      }
    } while (batch.length > 0);

    return all;
  }

  return [];
}

export default function FileUploader({ onAnalyzed }: FileUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // ── Add files from a flat FileList (file picker or simple drop) ──
  function addFlatFiles(incoming: FileList | null) {
    if (!incoming) return;
    const arr = Array.from(incoming).filter((f) => isAllowed(f.name));
    setFiles((prev) => {
      const keys = new Set(prev.map((f) => `${f.name}-${f.size}`));
      return [...prev, ...arr.filter((f) => !keys.has(`${f.name}-${f.size}`))];
    });
  }

  // ── Add files recursively from folder drag-and-drop ──
  const addFromDataTransfer = useCallback(async (dt: DataTransfer) => {
    setScanning(true);
    setError(null);
    try {
      const collected: File[] = [];
      const items = Array.from(dt.items);

      for (const item of items) {
        const entry = item.webkitGetAsEntry?.();
        if (entry) {
          const files = await collectFromEntry(entry);
          collected.push(...files);
        } else if (item.kind === "file") {
          const f = item.getAsFile();
          if (f && isAllowed(f.name)) collected.push(f);
        }
      }

      setFiles((prev) => {
        const keys = new Set(prev.map((f) => `${f.name}-${f.size}`));
        return [...prev, ...collected.filter((f) => !keys.has(`${f.name}-${f.size}`))];
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error scanning folder");
    } finally {
      setScanning(false);
    }
  }, []);

  // ── Upload in batches, aggregate client-side ──
  async function handleAnalyze() {
    if (!files.length) return;
    setLoading(true);
    setError(null);
    setProgress({ done: 0, total: files.length });

    try {
      const batches: File[][] = [];
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        batches.push(files.slice(i, i + BATCH_SIZE));
      }

      const results = [];
      let done = 0;

      for (const batch of batches) {
        const fd = new FormData();
        for (const f of batch) fd.append("files", f);

        const res = await fetch("/api/parse-logs", { method: "POST", body: fd });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        results.push(await res.json());
        done += batch.length;
        setProgress({ done, total: files.length });
      }

      const aggregated = aggregateResults(results);

      // Save full aggregated result to Supabase (fire-and-forget, non-blocking)
      fetch("/api/save-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(aggregated),
      }).catch(() => {});

      onAnalyzed(aggregated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const batchCount = Math.ceil(files.length / BATCH_SIZE);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="w-full max-w-2xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Log Analyzer</h1>
          <p className="text-slate-400 text-sm">
            Glisse un dossier entier ou des fichiers individuels (.gz · .log · .txt)
          </p>
        </div>

        {/* Drop zone */}
        <div
          className={clsx(
            "border-2 border-dashed rounded-2xl p-10 text-center transition-colors relative",
            dragging
              ? "border-blue-400 bg-blue-900/20 scale-[1.01]"
              : "border-slate-600 hover:border-slate-500 bg-slate-800/50"
          )}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFromDataTransfer(e.dataTransfer);
          }}
        >
          {scanning ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 size={32} className="text-blue-400 animate-spin" />
              <p className="text-slate-300 text-sm">Scan du dossier en cours…</p>
            </div>
          ) : (
            <>
              <Upload className="mx-auto text-slate-400 mb-4" size={36} />
              <p className="text-slate-200 font-medium mb-1">
                Glisse un dossier ou des fichiers ici
              </p>
              <p className="text-slate-500 text-xs mb-6">
                Les sous-dossiers sont parcourus récursivement — tous les .gz sont collectés
              </p>

              {/* Two buttons: files or folder */}
              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm rounded-lg transition-colors"
                >
                  <FileArchive size={15} />
                  Fichiers
                </button>
                <button
                  type="button"
                  onClick={() => folderInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
                >
                  <FolderOpen size={15} />
                  Dossier
                </button>
              </div>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".log,.gz,.txt"
            multiple
            className="hidden"
            onChange={(e) => addFlatFiles(e.target.files)}
          />
          {/* webkitdirectory allows picking an entire folder */}
          <input
            ref={folderInputRef}
            type="file"
            // @ts-expect-error – non-standard but supported in all modern browsers
            webkitdirectory=""
            multiple
            className="hidden"
            onChange={(e) => addFlatFiles(e.target.files)}
          />
        </div>

        {/* File summary */}
        {files.length > 0 && (
          <div className="mt-4 bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <FolderInput size={15} className="text-blue-400" />
                <span className="text-slate-200 text-sm font-medium">
                  {files.length} fichier{files.length > 1 ? "s" : ""} sélectionné{files.length > 1 ? "s" : ""}
                </span>
                <span className="text-slate-500 text-xs">
                  · {(totalSize / 1024 / 1024).toFixed(1)} MB
                  {batchCount > 1 && ` · ${batchCount} lots`}
                </span>
              </div>
              <button
                onClick={() => setFiles([])}
                className="text-slate-500 hover:text-red-400 text-xs transition-colors flex items-center gap-1"
              >
                <X size={13} /> Tout effacer
              </button>
            </div>

            {/* Show first 8 files */}
            <div className="divide-y divide-slate-700/50 max-h-48 overflow-y-auto">
              {files.slice(0, 8).map((f) => (
                <div key={`${f.name}-${f.size}`} className="flex items-center justify-between px-4 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileArchive size={13} className="text-slate-500 shrink-0" />
                    <span className="text-slate-300 text-xs truncate">{f.name}</span>
                    <span className="text-slate-600 text-xs shrink-0">{(f.size / 1024).toFixed(0)}KB</span>
                  </div>
                  <button
                    onClick={() => setFiles((prev) => prev.filter((x) => `${x.name}-${x.size}` !== `${f.name}-${f.size}`))}
                    className="text-slate-600 hover:text-red-400 ml-2 shrink-0 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              {files.length > 8 && (
                <div className="px-4 py-2 text-slate-500 text-xs">
                  + {files.length - 8} autres fichiers…
                </div>
              )}
            </div>
          </div>
        )}

        {/* Progress bar */}
        {progress && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>Lot {Math.ceil(progress.done / BATCH_SIZE)} / {batchCount}</span>
              <span>{progress.done} / {progress.total} fichiers</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-300"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={!files.length || loading || scanning}
          className={clsx(
            "mt-5 w-full py-3 rounded-xl font-semibold text-white transition-all",
            files.length && !loading && !scanning
              ? "bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/30"
              : "bg-slate-700 text-slate-500 cursor-not-allowed"
          )}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 size={18} className="animate-spin" />
              {progress
                ? `Analyse… ${progress.done}/${progress.total} fichiers`
                : "Préparation…"}
            </span>
          ) : (
            `Analyser ${files.length > 0 ? files.length + " fichier" + (files.length > 1 ? "s" : "") : ""}`
          )}
        </button>
      </div>
    </div>
  );
}
