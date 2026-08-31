"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import FileUploader from "@/components/FileUploader";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  const [data, setData] = useState<unknown>(null);
  const [section, setSection] = useState("global");

  if (!data) {
    return <FileUploader onAnalyzed={setData} />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar activeSection={section} onSelect={setSection} />
      <Dashboard
        data={data as Parameters<typeof Dashboard>[0]["data"]}
        section={section}
        onReset={() => setData(null)}
      />
    </div>
  );
}
