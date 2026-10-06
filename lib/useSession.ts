// Session hook shared by all operator pages.

"use client";

import { useCallback, useEffect, useState } from "react";
import { client, type SessionInfo } from "./client-api";

const SIGNED_OUT: SessionInfo = { loggedIn: false, label: null, master: false, permissions: [], warning: null };

let cache: SessionInfo | null | undefined = undefined;
let inflight: Promise<SessionInfo | null> | null = null;

export function hasPerm(s: SessionInfo | null, perm: string): boolean {
  if (!s?.loggedIn) return false;
  if (s.master) return true;
  return s.permissions.includes("*") || s.permissions.includes(perm);
}

function storeResult(s: SessionInfo | null): SessionInfo {
  const next = s ?? SIGNED_OUT;
  cache = next;
  return next;
}

export function useSession() {
  // Seed from the module cache so remounts never flash a loading state;
  // the effect below only fetches when nothing is cached yet.
  const [session, setSession] = useState<SessionInfo | null>(() => cache ?? null);
  const [loading, setLoading] = useState(() => cache === undefined);

  const refresh = useCallback(async () => {
    setLoading(true);
    inflight = client.session().catch(() => null);
    const s = await inflight;
    inflight = null;
    const next = storeResult(s);
    setSession(next);
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    if (cache !== undefined) return;
    // Mount-time probe only; all state updates happen in async callbacks.
    // Manual refreshes go through refresh() (event handlers), not this effect.
    const probe = inflight ?? client.session().catch(() => null);
    inflight = probe;
    probe.then(
      (s) => {
        setSession(storeResult(s));
        setLoading(false);
      },
      () => {
        setSession(storeResult(null));
        setLoading(false);
      }
    );
  }, []);

  const s = session ?? null;
  const can = useCallback((p: string) => hasPerm(s, p), [s]);

  return { session: s, loading, loggedIn: !!s?.loggedIn, isMaster: !!s?.master, can, refresh };
}

export function invalidateSession() {
  cache = undefined;
  inflight = null;
}
