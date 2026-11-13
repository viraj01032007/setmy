"use client";

import { useEffect, useRef, useState } from "react";
import { getReviewSummary, type ReviewSummary } from "@/lib/api";
import { toast } from "@/hooks/use-toast";

/**
 * Shared by the Staff and Admin panels.
 * Polls the server every `intervalMs` and, when a NEW listing request arrives:
 *   - shows a toast,
 *   - plays a short chime,
 *   - puts the pending count in the browser tab title,
 *   - calls `onNewRequest` so the panel can reload its tables.
 */
export function useReviewAlerts(enabled: boolean, onNewRequest?: () => void, intervalMs = 20000) {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const lastSeen = useRef<number | null>(null);
  const first = useRef(true);
  const cb = useRef(onNewRequest);
  cb.current = onNewRequest;

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const baseTitle = document.title.replace(/^\(\d+\)\s*/, "");

    const tick = async () => {
      try {
        const s = await getReviewSummary();
        if (!alive) return;
        setSummary(s);
        document.title = s.pending_count > 0 ? `(${s.pending_count}) ${baseTitle}` : baseTitle;

        const latest = s.latest_pending_id;
        if (!first.current && latest && latest !== lastSeen.current && (lastSeen.current === null || latest > lastSeen.current)) {
          toast({
            title: "New listing request",
            description: `"${s.latest_pending_title}" is waiting for review. ${s.pending_count} pending in total.`,
          });
          chime();
          cb.current?.();
        }
        if (latest) lastSeen.current = Math.max(lastSeen.current ?? 0, latest);
        first.current = false;
      } catch {
        /* offline or signed out — the panel handles that */
      }
    };

    tick();
    const id = window.setInterval(tick, intervalMs);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.title = baseTitle;
    };
  }, [enabled, intervalMs]);

  return summary;
}

function chime() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.42);
  } catch {
    /* sound is optional */
  }
}
