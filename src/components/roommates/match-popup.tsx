"use client";

import { useMemo } from "react";
import { MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Match } from "@/lib/matching";
import { ProfileVisual } from "./swipe-card";

interface Props {
  match: Match | null;
  myName?: string | null;
  myPic?: string | null;
  onChat: (m: Match) => void;
  onClose: () => void;
}

const COLORS = ["#f97316", "#3b82f6", "#22c55e", "#eab308", "#ec4899", "#a855f7"];

export function MatchPopup({ match, myName, myPic, onChat, onClose }: Props) {
  const confetti = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2.2 + Math.random() * 1.6,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 6,
        rotate: Math.random() * 360,
      })),
    [match?.id],
  );

  if (!match) return null;
  const myInitial = (myName || "You").charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in duration-300" role="dialog" aria-modal="true" aria-label="It's a match">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {confetti.map((c, i) => (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: `${c.left}%`,
              width: c.size,
              height: c.size * 0.45,
              background: c.color,
              animationDelay: `${c.delay}s`,
              animationDuration: `${c.duration}s`,
              transform: `rotate(${c.rotate}deg)`,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-sm text-center text-white animate-match-pop">
        <button onClick={onClose} className="absolute -top-2 right-0 rounded-full p-2 text-white/70 hover:text-white" aria-label="Close">
          <X className="h-6 w-6" />
        </button>
        <h2 className="text-5xl font-extrabold text-white">It's a match</h2>
        <p className="mt-3 text-white/80">You and {match.profile.name} are both interested. Chat now and plan a visit.</p>

        <div className="mt-8 flex items-center justify-center">
          <div className="h-28 w-28 -rotate-6 overflow-hidden rounded-3xl border-4 border-white shadow-2xl">
            {myPic ? (
              <img src={myPic} alt="You" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary text-4xl font-black">{myInitial}</div>
            )}
          </div>
          <div className="-ml-4 h-28 w-28 rotate-6 overflow-hidden rounded-3xl border-4 border-white shadow-2xl">
            <ProfileVisual profile={match.profile} initialsClass="text-4xl" />
          </div>
        </div>

        <div className="mt-10 space-y-3">
          <Button size="lg" className="h-12 w-full rounded-full bg-gradient-to-r from-[#53b2fe] to-[#065af3] text-base font-bold text-white" onClick={() => onChat(match)}>
            <MessageCircle className="mr-2 h-5 w-5" /> Send a message
          </Button>
          <Button size="lg" variant="ghost" className="h-12 w-full rounded-full text-white hover:bg-white/10 hover:text-white" onClick={onClose}>
            Keep swiping
          </Button>
        </div>
      </div>
    </div>
  );
}
