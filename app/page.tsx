"use client";

import { useState, useEffect } from "react";
import FileUploader from "@/components/FileUploader";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/get-analysis")
      .then((r) => r.json())
      .then((d) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Chargement de la dernière analyse…</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return <FileUploader onAnalyzed={setData} />;
  }

  return (
    <Dashboard
      data={data as Parameters<typeof Dashboard>[0]["data"]}
      onReset={() => setData(null)}
    />
  );
}
