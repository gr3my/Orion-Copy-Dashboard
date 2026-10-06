// Shared API shapes for Orion Drift-compatible backends.
// Field names are intentionally generic so Orion Copy Server and
// AUnrealFeatures-style services can both map onto them.

export type HealthState = "online" | "offline" | "degraded" | "unknown";

export type OverviewSummary = {
  playersOnline: number;
  activeMatches: number;
  activeServers: number;
  unhealthyServers: number;
  totalCapacity: number;
  buildVersion: string | null;
  backendReachable: boolean;
  backendLatencyMs: number | null;
};

export type PlayerSummary = {
  playerId: string;
  displayName: string;
  online: boolean;
  currentServer: string | null;
  createdAt: string | null;
  lastSeen: string | null;
  roles: string[];
  moderationState: string | null;
};

export type GameServer = {
  serverId: string;
  label: string;
  region: string;
  gamePort: number | null;
  status: string;
  healthy: boolean;
  playerCount: number;
  capacity: number;
  buildVersion: string | null;
  uptimeSeconds: number | null;
  registeredAt: string | null;
  lastHeartbeat: string | null;
};

export type StationLobby = {
  stationId: string;
  name: string;
  online: boolean;
  playerCount: number;
  serverCount: number;
  region: string | null;
  updatedAt: string | null;
};

export type MatchSession = {
  sessionId: string;
  serverId: string | null;
  playerCount: number;
  maxPlayers: number;
  mode: string | null;
  region: string | null;
  state: string;
  createdAt: string | null;
};

export type AllocatorState = {
  totalCapacity: number;
  allocated: number;
  available: number;
  queueDepth: number;
  spinningUp: number;
  regionLimits: { region: string; limit: number; used: number }[];
  supported: boolean;
};

export type ModerationRecord = {
  id: string;
  playerId: string;
  playerName: string;
  action: "ban" | "kick" | "mute" | "warn";
  reason: string;
  operator: string;
  createdAt: string;
  expiresAt: string | null;
  active: boolean;
};

export type Announcement = {
  id: string;
  title: string;
  body: string;
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OperatorInfo = {
  keyId: string;
  label: string;
  permissions: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revoked: boolean;
};

export type AuditEntry = {
  id: string;
  ts: string;
  actor: string;
  action: string;
  target: string | null;
  status: number;
  origin?: string;
};

export type LogEntry = {
  id: string;
  ts: string;
  level: "debug" | "info" | "warn" | "error";
  component: string;
  message: string;
};

export type MetricPoint = { t: string; value: number };

export type MetricSeries = {
  key: string;
  label: string;
  points: MetricPoint[];
};

export type PublicStatus = {
  enabled: boolean;
  reachable: boolean;
  playersOnline: number;
  activeServers: number;
  healthyServers: number;
  activeMatches: number;
  buildVersion: string | null;
  capacityUsed: number;
  capacityTotal: number;
  maintenance: boolean;
  announcements: { id: string; title: string; body: string }[];
  updatedAt: string;
};

export type EndpointSupport = {
  key: string;
  label: string;
  method: string;
  path: string;
  supported: boolean;
};

export const PERMISSIONS = [
  "overview.read",
  "players.read",
  "players.moderate",
  "servers.read",
  "servers.control",
  "matches.read",
  "allocator.read",
  "allocator.write",
  "announcements.read",
  "announcements.write",
  "config.read",
  "config.write",
  "operators.read",
  "operators.write",
  "apikeys.read",
  "apikeys.write",
  "logs.read",
  "audit.read",
  "system.read",
  "system.control",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
