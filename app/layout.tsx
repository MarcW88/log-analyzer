import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Log Analyzer",
  description: "SEO Log Analysis Tool – Apache & Vercel logs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
