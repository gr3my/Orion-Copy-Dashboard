// Shared data-loading hook for operator pages: tries the live backend via
// the same-origin proxy, and reports whether the endpoint is unsupported so
// pages can render an honest empty/unsupported state instead of fake data.

"use client";

import { useCallback, useEffect, useState } from "react";
import { client } from "./client-api";

export type LoadState<T> =
  | { status: "loading"; data: null }
  | { status: "ready"; data: T }
  | { status: "unavailable"; data: null; message: string };

const MISCONFIGURED: LoadState<never> = {
  status: "unavailable",
  data: null,
  message: "No backend endpoint is configured for this view yet.",
};

export function useOrion<T>(backendPath: string | null, allowed: boolean): LoadState<T> & { reload: () => void } {
  const [state, setState] = useState<LoadState<T>>({ status: "loading", data: null });
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => {
    setState({ status: "loading", data: null });
    setNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!allowed || !backendPath) return;
    let live = true;
    // State transitions happen only in async callbacks, never synchronously
    // in the effect body. Loading is the initial state; reload() re-arms it.
    client
      .orionGet<T>(backendPath)
      .then((data) => {
        if (live) setState({ status: "ready", data });
      })
      .catch((e: Error) => {
        if (live) setState({ status: "unavailable", data: null, message: e.message });
      });
    return () => {
      live = false;
    };
  }, [backendPath, allowed, nonce]);

  if (!allowed || !backendPath) {
    return { ...(MISCONFIGURED as LoadState<T>), reload };
  }
  return { ...state, reload } as LoadState<T> & { reload: () => void };
}
