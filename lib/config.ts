// Centralized runtime configuration. Everything here is server-side only:
// the dashboard proxies all backend calls through Next.js route handlers, so
// the internal backend URL is never bundled into browser JavaScript.

export function serverConfig() {
  return {
    apiUrl: (process.env.ORION_API_URL || "http://127.0.0.1:8080").replace(/\/$/, ""),
    sessionSecret: process.env.ORION_DASHBOARD_SESSION_SECRET || "",
    adminKey: process.env.ORION_DASHBOARD_ADMIN_KEY || "",
    dashboardName: process.env.ORION_DASHBOARD_NAME || "Orion Copy Dashboard",
    publicStatusEnabled: (process.env.ORION_PUBLIC_STATUS_ENABLED ?? "true") !== "false",
    defaultRegion: process.env.ORION_DEFAULT_SERVER_REGION || "local",
    mock: (process.env.ORION_MOCK ?? "false") === "true",
  };
}
