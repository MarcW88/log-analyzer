"use client";

import { useState } from "react";
import FileUploader from "@/components/FileUploader";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const [data, setData] = useState<unknown>(null);

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
