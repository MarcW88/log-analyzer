"use client";

import { BarChart2, ChevronRight } from "lucide-react";
import clsx from "clsx";

interface SidebarProps {
  activeSection: string;
  onSelect: (s: string) => void;
}

const NAV_ITEMS = [
  { id: "global", label: "Global view" },
  { id: "bots", label: "Bot activity" },
  { id: "urls", label: "URL categories" },
  { id: "pages", label: "Crawled pages" },
  { id: "entries", label: "Log entries" },
];

export default function Sidebar({ activeSection, onSelect }: SidebarProps) {
  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-slate-900 text-slate-300 flex flex-col z-40">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-700">
        <BarChart2 className="text-blue-400" size={20} />
        <span className="font-semibold text-white text-sm tracking-wide">Log Analyzer</span>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        <p className="px-5 text-xs text-slate-500 uppercase tracking-widest mb-2">Navigation</p>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={clsx(
              "w-full flex items-center justify-between px-5 py-2.5 text-sm transition-colors",
              activeSection === item.id
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            )}
          >
            {item.label}
            {activeSection === item.id && <ChevronRight size={14} />}
          </button>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-slate-700 text-xs text-slate-500">
        Apache · Vercel · NDJSON
      </div>
    </aside>
  );
}
