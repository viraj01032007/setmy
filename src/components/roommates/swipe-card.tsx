"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { MapPin, IndianRupee, Briefcase, CalendarDays, BadgeCheck, Home, Info, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SwipeDirection, SwipeProfile } from "@/lib/matching";

const SWIPE_THRESHOLD = 110; // px the card must travel before it counts as a swipe

/** Gradient avatar for people without a photo — looks intentional, not broken. */
const GRADIENTS = [
  "bg-[#1D4ED8]",
  "bg-[#16181D]",
  "bg-[#0F766E]",
  "bg-[#9A3412]",
  "bg-[#4338CA]",
  "bg-[#334155]",
];
export function gradientFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

export function ProfileVisual({ profile, className, initialsClass }: { profile: SwipeProfile; className?: string; initialsClass?: string }) {
  const [photo, setPhoto] = useState(0);
  if (profile.images.length > 0) {
    return (
      <div className={cn("relative h-full w-full", className)}>
        <img src={profile.images[photo]} alt={profile.name} draggable={false} className="h-full w-full object-cover select-none" />
        {profile.images.length > 1 && (
          <>
            <div className="absolute top-2 inset-x-3 flex gap-1">
              {profile.images.map((_, i) => (
                <span key={i} className={cn("h-1 flex-1 rounded-full", i === photo ? "bg-white" : "bg-white/40")} />
              ))}
            </div>
            <button
              type="button"
              aria-label="Previous photo"
              className="absolute inset-y-0 left-0 w-1/3"
              onClick={(e) => { e.stopPropagation(); setPhoto((p) => Math.max(0, p - 1)); }}
            />
            <button
              type="button"
              aria-label="Next photo"
              className="absolute inset-y-0 right-0 w-1/3"
              onClick={(e) => { e.stopPropagation(); setPhoto((p) => Math.min(profile.images.length - 1, p + 1)); }}
            />
          </>
        )}
      </div>
    );
  }
  const initials = profile.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={cn("relative h-full w-full flex items-center justify-center overflow-hidden", gradientFor(profile.id), className)}>
      <span className={cn("relative font-display font-extrabold text-white tracking-tight text-7xl", initialsClass)}>{initials}</span>
    </div>
  );
}

export interface SwipeCardHandle {
  /** Animate the card off-screen (used by the ❌ / 💚 buttons and arrow keys). */
  flyOut: (dir: SwipeDirection) => void;
}

interface SwipeCardProps {
  profile: SwipeProfile;
  score: number;
  isTop: boolean;
  depth: number; // 0 = top card
  onSwiped: (dir: SwipeDirection) => void;
  disabled?: boolean;
}

export const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(function SwipeCard(
  { profile, score, isTop, depth, onSwiped, disabled },
  ref,
) {
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<SwipeDirection | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  const finish = (dir: SwipeDirection) => {
    if (leaving) return;
    setLeaving(dir);
    const w = typeof window !== "undefined" ? window.innerWidth : 800;
    setDrag((d) => ({ x: (dir === "right" ? 1 : -1) * (w + 200), y: d.y + 60 }));
    window.setTimeout(() => onSwiped(dir), 280);
  };

  useImperativeHandle(ref, () => ({ flyOut: finish }));

  const onPointerDown = (e: React.PointerEvent) => {
    if (!isTop || disabled || leaving) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    start.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
    setDragging(true);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const x = e.clientX - start.current.x;
    const y = e.clientY - start.current.y;
    if (Math.abs(x) > 4 || Math.abs(y) > 4) moved.current = true;
    setDrag({ x, y });
  };
  const onPointerUp = () => {
    if (!start.current) return;
    start.current = null;
    setDragging(false);
    if (drag.x > SWIPE_THRESHOLD) finish("right");
    else if (drag.x < -SWIPE_THRESHOLD) finish("left");
    else setDrag({ x: 0, y: 0 });
  };

  const rotate = drag.x / 18;
  const likeOpacity = Math.min(1, Math.max(0, drag.x / SWIPE_THRESHOLD));
  const nopeOpacity = Math.min(1, Math.max(0, -drag.x / SWIPE_THRESHOLD));

  // cards behind the top one sit slightly lower & smaller
  const scale = 1 - depth * 0.05;
  const translateY = depth * 14;

  const style: React.CSSProperties = isTop
    ? {
        transform: `translate3d(${drag.x}px, ${drag.y * 0.4}px, 0) rotate(${rotate}deg)`,
        transition: dragging ? "none" : "transform 0.3s cubic-bezier(.2,.8,.2,1)",
        touchAction: "none",
      }
    : {
        transform: `translateY(${translateY}px) scale(${scale})`,
        transition: "transform 0.3s ease-out",
      };

  return (
    <div
      className={cn(
        "absolute inset-0 select-none rounded-[28px] overflow-hidden bg-card shadow-2xl ring-1 ring-black/5 will-change-transform",
        isTop ? "cursor-grab active:cursor-grabbing" : "pointer-events-none",
      )}
      style={{ ...style, zIndex: 10 - depth }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-hidden={!isTop}
    >
      <ProfileVisual profile={profile} />

      {/* LIKE / NOPE stamps */}
      <div
        className="absolute top-10 left-6 -rotate-12 rounded-xl border-4 border-emerald-400 px-4 py-1 text-3xl font-black tracking-wider text-emerald-400 bg-black/10"
        style={{ opacity: leaving === "right" ? 1 : likeOpacity }}
      >
        LIKE
      </div>
      <div
        className="absolute top-10 right-6 rotate-12 rounded-xl border-4 border-rose-500 px-4 py-1 text-3xl font-black tracking-wider text-rose-500 bg-black/10"
        style={{ opacity: leaving === "left" ? 1 : nopeOpacity }}
      >
        NOPE
      </div>

      {/* Top badges */}
      <div className="absolute top-4 inset-x-4 flex items-start justify-between pointer-events-none">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-slate-800 shadow">
          <Sparkles className="h-3.5 w-3.5 text-orange-500" /> {score}% match
        </span>
        {profile.isSample && (
          <span className="rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur">
            Sample
          </span>
        )}
      </div>

      {/* Info panel */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-24 pb-5 px-5 text-white">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-2xl sm:text-3xl font-extrabold leading-tight">
              <span className="truncate">{profile.name}{profile.age ? <span className="font-semibold text-white/85">, {profile.age}</span> : null}</span>
              {profile.verified && <BadgeCheck className="h-6 w-6 shrink-0 text-sky-400" aria-label="Verified" />}
            </h3>
            {profile.occupation && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-white/85">
                <Briefcase className="h-4 w-4" /> {profile.occupation}
              </p>
            )}
            <p className="mt-1 flex items-center gap-1.5 text-sm text-white/85">
              <MapPin className="h-4 w-4" /> {profile.locality}{profile.city && profile.city !== profile.locality ? `, ${profile.city}` : ""}
            </p>
          </div>
          {isTop && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setShowInfo((v) => !v); }}
              className="shrink-0 rounded-full bg-white/20 p-2 backdrop-blur hover:bg-white/30"
              aria-label="More about this person"
            >
              <Info className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-slate-900">
            <IndianRupee className="h-3.5 w-3.5" /> {profile.budget.toLocaleString("en-IN")}/mo
          </span>
          {profile.moveIn && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 backdrop-blur">
              <CalendarDays className="h-3.5 w-3.5" /> {profile.moveIn}
            </span>
          )}
          {profile.hasProperty && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-3 py-1">
              <Home className="h-3.5 w-3.5" /> Has a flat
            </span>
          )}
        </div>

        <div className={cn("grid transition-all duration-300", showInfo ? "grid-rows-[1fr] opacity-100 mt-3" : "grid-rows-[0fr] opacity-0")}>
          <div className="overflow-hidden">
            {profile.bio && <p className="text-sm leading-relaxed text-white/90">{profile.bio}</p>}
          </div>
        </div>

        {profile.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {profile.tags.slice(0, showInfo ? 10 : 3).map((t) => (
              <span key={t} className="rounded-full border border-white/40 px-2.5 py-0.5 text-[11px] font-medium text-white/90">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});
