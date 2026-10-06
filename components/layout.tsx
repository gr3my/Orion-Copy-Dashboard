"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity, Bell, Cpu, FileText, Gauge, KeyRound, Layers, LogOut,
  MonitorPlay, ScrollText, Server, Settings, ShieldCheck, Users, Orbit as OrbitIcon,
} from "lucide-react";
import { client } from "../lib/client-api";
import { invalidateSession, useSession } from "../lib/useSession";

export const NAV = [
  { href: "/overview", label: "Overview", icon: Gauge, perm: "overview.read" },
  { href: "/players", label: "Players", icon: Users, perm: "players.read" },
  { href: "/servers", label: "Servers", icon: Server, perm: "servers.read" },
  { href: "/stations", label: "Stations", icon: Layers, perm: "overview.read" },
  { href: "/matches", label: "Matches", icon: MonitorPlay, perm: "matches.read" },
  { href: "/allocator", label: "Allocator", icon: Cpu, perm: "allocator.read" },
  { href: "/moderation", label: "Moderation", icon: ShieldCheck, perm: "players.moderate" },
  { href: "/announcements", label: "Announcements", icon: Bell, perm: "announcements.read" },
  { href: "/configuration", label: "Configuration", icon: Settings, perm: "config.read" },
  { href: "/operators", label: "Operators", icon: KeyRound, perm: "operators.read" },
  { href: "/api-keys", label: "API Keys", icon: KeyRound, perm: "apikeys.read" },
  { href: "/metrics", label: "Metrics", icon: Activity, perm: "overview.read" },
  { href: "/logs", label: "Logs", icon: FileText, perm: "logs.read" },
  { href: "/audit", label: "Audit Log", icon: ScrollText, perm: "audit.read" },
  { href: "/system", label: "System", icon: OrbitIcon, perm: "system.read" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { session, loggedIn, can } = useSession();

  async function logout() {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
    invalidateSession();
    router.replace("/login");
  }

  const visible = NAV.filter((n) => can(n.perm));

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 hidden md:flex flex-col" style={{ background: "#1a1d23", borderRight: "1px solid var(--line)" }}>
        <Link href={loggedIn ? "/overview" : "/"} className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: "1px solid var(--line)" }}>
          <span className="h-8 w-8 rounded-md flex items-center justify-center font-bold text-sm" style={{ background: "#2a3342", color: "var(--link)" }}>OC</span>
          <span className="min-w-0">
            <span className="block text-[13px] font-bold tracking-wide truncate">ORION COPY</span>
            <span className="block text-[11px]" style={{ color: "var(--muted)" }}>Server Dashboard</span>
          </span>
        </Link>
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 flex flex-col gap-0.5">
          <Link
            href="/status"
            className="px-3 py-2 rounded-md text-[13px]"
            style={{
              color: path === "/status" ? "var(--text)" : "var(--muted)",
              background: path === "/status" ? "rgba(255,255,255,0.06)" : "transparent",
            }}
          >
            Public status
          </Link>
          <div className="px-3 pt-2 pb-1 text-[10px] font-semibold tracking-[0.18em]" style={{ color: "var(--muted)" }}>
            OPERATOR
          </div>
          {visible.length === 0 && (
            <p className="px-3 py-2 text-[13px]" style={{ color: "var(--muted)" }}>
              {loggedIn ? "No pages assigned to this key." : "Sign in to see operator pages."}
            </p>
          )}
          {visible.map(({ href, label, icon: Icon }) => {
            const active = path === href || path.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px]"
                style={{
                  color: active ? "var(--text)" : "var(--muted)",
                  background: active ? "rgba(124,199,255,0.10)" : "transparent",
                  fontWeight: active ? 500 : 400,
                }}
              >
                <Icon size={15} className="shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="px-4 py-3 text-[12px]" style={{ borderTop: "1px solid var(--line)", color: "var(--muted)" }}>
          {loggedIn ? (
            <div className="flex items-center gap-2">
              <span className="truncate flex-1">{session?.label}</span>
              <button onClick={logout} className="inline-flex items-center gap-1 hover:text-white" aria-label="Sign out">
                <LogOut size={13} /> Sign out
              </button>
            </div>
          ) : (
            <Link href="/login" className="hover:text-white">Operator sign in</Link>
          )}
        </div>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden flex items-center gap-2 px-4 py-3 overflow-x-auto" style={{ background: "#1a1d23", borderBottom: "1px solid var(--line)" }}>
          <Link href="/overview" className="font-bold text-[13px] shrink-0">ORION COPY</Link>
          {visible.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="px-2.5 py-1 rounded text-[12px] whitespace-nowrap"
              style={{ color: path.startsWith(href) ? "var(--text)" : "var(--muted)", background: path.startsWith(href) ? "rgba(255,255,255,0.07)" : "transparent" }}
            >
              {label}
            </Link>
          ))}
        </header>
        <main className="flex-1 p-5 md:p-8 w-full max-w-[1200px] mx-auto">
          {session?.warning && (
            <div className="card mb-4 px-4 py-2.5 text-[13px]" style={{ color: "var(--yellow)" }} role="alert">
              {session.warning}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
