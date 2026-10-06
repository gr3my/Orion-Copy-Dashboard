import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto max-w-[760px] pt-14 pb-20">
      <p className="eyebrow mb-3">Orion Copy Dashboard</p>
      <h1 className="text-4xl font-medium tracking-tight">Operations dashboard for your own Orion-compatible backend</h1>
      <p className="text-[15px] mt-4 leading-relaxed" style={{ color: "var(--muted)" }}>
        Monitor servers, matches, stations, and capacity, and give operators scoped,
        auditable access. Point the dashboard at your backend with{" "}
        <code className="font-mono text-[13px]">ORION_API_URL</code> — no private
        infrastructure is bundled or required.
      </p>
      <div className="flex flex-wrap gap-2.5 mt-7">
        <Link href="/status" className="btn-light">View public status</Link>
        <Link href="/overview" className="btn-dark">Open operator panel</Link>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 mt-10">
        {[
          ["Public status", "Players online, server health, capacity, and announcements. Disable with ORION_PUBLIC_STATUS_ENABLED=false."],
          ["Scoped operators", "Least-privilege API keys with per-permission gating and one-time secret display."],
          ["Backend-agnostic", "One proxy allowlist in lib/orion-api.ts maps to Orion Copy Server or AUnrealFeatures endpoints."],
        ].map(([title, body]) => (
          <div key={title} className="card px-4 py-4">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-[13px] mt-1.5 leading-relaxed" style={{ color: "var(--muted)" }}>{body}</p>
          </div>
        ))}
      </div>
      <p className="text-[12px] mt-8" style={{ color: "var(--muted)" }}>
        Independent community project. Not affiliated with or endorsed by the makers of Orion Drift.
      </p>
    </div>
  );
}
