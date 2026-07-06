import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zippy — EVE Online wormhole route planner",
  description:
    "Fast, wormhole-aware shortest-path routing for EVE Online. An open-source, web-based reimagining of Short Circuit.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
