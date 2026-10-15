"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveFeed } from "@/server/orders";

let audioCtx: AudioContext | null = null;

/** Two-tone chime via Web Audio (no sound file needed). Must be unlocked by a tap first. */
export function chime() {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const t = audioCtx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = audioCtx!.createOscillator();
      const gain = audioCtx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.35, t + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.35);
      osc.connect(gain).connect(audioCtx!.destination);
      osc.start(t + i * 0.18);
      osc.stop(t + i * 0.18 + 0.4);
    });
  } catch {
    /* audio not available */
  }
}

export function useSoundPref(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the saved preference once on mount
    setOn(localStorage.getItem("menupage:sound") === "1");
  }, []);
  const set = useCallback((v: boolean) => {
    setOn(v);
    localStorage.setItem("menupage:sound", v ? "1" : "0");
    if (v) chime();
  }, []);
  return [on, set];
}

/**
 * Polls the live feed (orders + table requests). Every 4s while the tab is
 * visible, every 20s in the background. Calls `onNew` when new orders or
 * requests arrive (not on the first load).
 */
export function useLiveFeed(restaurantId: string, initial: LiveFeed, onNew?: (kind: "order" | "request", count: number) => void) {
  const [feed, setFeed] = useState(initial);
  const [online, setOnline] = useState(true);
  const seen = useRef({ orders: new Set(initial.orders.map((o) => o.id)), requests: new Set(initial.requests.map((r) => r.id)) });
  const onNewRef = useRef(onNew);
  useEffect(() => {
    onNewRef.current = onNew;
  }, [onNew]);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/r/${restaurantId}/live`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as LiveFeed;
      const newOrders = next.orders.filter((o) => !seen.current.orders.has(o.id));
      const newReqs = next.requests.filter((r) => !seen.current.requests.has(r.id));
      newOrders.forEach((o) => seen.current.orders.add(o.id));
      newReqs.forEach((r) => seen.current.requests.add(r.id));
      if (newOrders.length) onNewRef.current?.("order", newOrders.length);
      if (newReqs.length) onNewRef.current?.("request", newReqs.length);
      setFeed(next);
      setOnline(true);
    } catch {
      setOnline(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const loop = async () => {
      await refresh();
      if (stopped) return;
      timer = setTimeout(loop, document.visibilityState === "visible" ? 4000 : 20000);
    };
    timer = setTimeout(loop, 4000);
    const onVis = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        void loop();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);

  /** Optimistic local update after an action. */
  const patchOrder = useCallback((id: string, patch: Partial<LiveFeed["orders"][number]>) => {
    setFeed((f) => ({ ...f, orders: f.orders.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
  }, []);
  const dropRequest = useCallback((id: string) => {
    setFeed((f) => ({ ...f, requests: f.requests.filter((r) => r.id !== id) }));
  }, []);

  return { feed, online, refresh, patchOrder, dropRequest };
}

export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
