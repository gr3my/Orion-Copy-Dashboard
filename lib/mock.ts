// Clean, original development fixtures. These contain no real player,
// server, or station data and are only used when ORION_MOCK=true.

import type {
  AllocatorState,
  Announcement,
  AuditEntry,
  GameServer,
  LogEntry,
  MatchSession,
  MetricSeries,
  ModerationRecord,
  OverviewSummary,
  PlayerSummary,
  PublicStatus,
  StationLobby,
} from "./types";

export const MOCK_BANNER = "Development mock data — not real infrastructure";

export function mockOverview(): OverviewSummary {
  return {
    playersOnline: 18,
    activeMatches: 3,
    activeServers: 2,
    unhealthyServers: 0,
    totalCapacity: 64,
    buildVersion: "dev-0.0.1",
    backendReachable: true,
    backendLatencyMs: 4,
  };
}

export function mockPlayers(): PlayerSummary[] {
  return [
    { playerId: "player_mock_01", displayName: "MockPlayer01", online: true, currentServer: "srv-mock-01", createdAt: "2026-01-04T12:00:00Z", lastSeen: "2026-10-05T11:58:00Z", roles: ["player"], moderationState: null },
    { playerId: "player_mock_02", displayName: "MockPlayer02", online: true, currentServer: "srv-mock-01", createdAt: "2026-02-11T09:30:00Z", lastSeen: "2026-10-05T11:55:00Z", roles: ["player"], moderationState: null },
    { playerId: "player_mock_03", displayName: "MockPlayer03", online: false, currentServer: null, createdAt: "2026-03-02T18:12:00Z", lastSeen: "2026-10-04T22:01:00Z", roles: ["player"], moderationState: "warned" },
  ];
}

export function mockServers(): GameServer[] {
  return [
    { serverId: "srv-mock-01", label: "Test Server 01", region: "local", gamePort: 7777, status: "online", healthy: true, playerCount: 12, capacity: 32, buildVersion: "dev-0.0.1", uptimeSeconds: 86400, registeredAt: "2026-10-01T08:00:00Z", lastHeartbeat: "2026-10-05T12:00:00Z" },
    { serverId: "srv-mock-02", label: "Test Server 02", region: "local", gamePort: 7778, status: "online", healthy: true, playerCount: 6, capacity: 32, buildVersion: "dev-0.0.1", uptimeSeconds: 43200, registeredAt: "2026-10-03T08:00:00Z", lastHeartbeat: "2026-10-05T12:00:00Z" },
  ];
}

export function mockStations(): StationLobby[] {
  return [
    { stationId: "stn-mock-01", name: "Example Lounge", online: true, playerCount: 12, serverCount: 1, region: "local", updatedAt: "2026-10-05T12:00:00Z" },
    { stationId: "stn-mock-02", name: "Example Arena", online: false, playerCount: 0, serverCount: 0, region: "local", updatedAt: "2026-10-04T20:00:00Z" },
  ];
}

export function mockMatches(): MatchSession[] {
  return [
    { sessionId: "match-mock-01", serverId: "srv-mock-01", playerCount: 8, maxPlayers: 12, mode: "social", region: "local", state: "active", createdAt: "2026-10-05T11:30:00Z" },
    { sessionId: "match-mock-02", serverId: "srv-mock-01", playerCount: 4, maxPlayers: 12, mode: "social", region: "local", state: "active", createdAt: "2026-10-05T11:45:00Z" },
    { sessionId: "match-mock-03", serverId: "srv-mock-02", playerCount: 6, maxPlayers: 16, mode: "event", region: "local", state: "active", createdAt: "2026-10-05T11:50:00Z" },
  ];
}

export function mockAllocator(): AllocatorState {
  return {
    totalCapacity: 64,
    allocated: 18,
    available: 46,
    queueDepth: 0,
    spinningUp: 0,
    regionLimits: [{ region: "local", limit: 64, used: 18 }],
    supported: true,
  };
}

export function mockModeration(): ModerationRecord[] {
  return [
    { id: "mod-mock-01", playerId: "player_mock_03", playerName: "MockPlayer03", action: "warn", reason: "Example warning for development UI", operator: "dev-operator", createdAt: "2026-10-04T22:05:00Z", expiresAt: null, active: true },
  ];
}

export function mockAnnouncements(): Announcement[] {
  return [
    { id: "ann-mock-01", title: "Welcome to the example dashboard", body: "Replace this with your own announcement once your backend is connected.", enabled: true, startsAt: null, endsAt: null, createdAt: "2026-10-01T08:00:00Z", updatedAt: "2026-10-01T08:00:00Z" },
  ];
}

export function mockAudit(): AuditEntry[] {
  return [
    { id: "audit-mock-01", ts: "2026-10-05T11:00:00Z", actor: "dev-operator", action: "session.login", target: null, status: 200 },
    { id: "audit-mock-02", ts: "2026-10-05T11:05:00Z", actor: "dev-operator", action: "servers.list", target: null, status: 200 },
  ];
}

export function mockLogs(): LogEntry[] {
  return [
    { id: "log-mock-01", ts: "2026-10-05T12:00:00Z", level: "info", component: "dashboard", message: "Example log line for development UI" },
    { id: "log-mock-02", ts: "2026-10-05T11:59:00Z", level: "warn", component: "proxy", message: "Example warning for development UI" },
  ];
}

export function mockMetrics(): MetricSeries[] {
  const points = (base: number): MetricSeries["points"] =>
    Array.from({ length: 24 }, (_, i) => ({
      t: new Date(Date.now() - (23 - i) * 3600_000).toISOString(),
      value: Math.max(0, Math.round(base + Math.sin(i / 3) * base * 0.3)),
    }));
  return [
    { key: "players_online", label: "Players online", points: points(14) },
    { key: "server_count", label: "Servers", points: points(2) },
    { key: "match_count", label: "Matches", points: points(3) },
    { key: "capacity_usage", label: "Capacity usage", points: points(20) },
  ];
}

export function mockPublicStatus(): PublicStatus {
  return {
    enabled: true,
    reachable: true,
    playersOnline: 18,
    activeServers: 2,
    healthyServers: 2,
    activeMatches: 3,
    buildVersion: "dev-0.0.1",
    capacityUsed: 18,
    capacityTotal: 64,
    maintenance: false,
    announcements: [{ id: "ann-mock-01", title: "Welcome to the example dashboard", body: "Replace this with your own announcement." }],
    updatedAt: new Date().toISOString(),
  };
}
