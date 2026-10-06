import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "../components/layout";

export const metadata: Metadata = {
  title: "Orion Copy Dashboard",
  description: "Operations and status dashboard for Orion Drift-compatible multiplayer infrastructure",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full min-h-screen" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
