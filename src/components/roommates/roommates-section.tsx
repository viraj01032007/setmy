"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  X, Heart, RotateCcw, SlidersHorizontal, Flame, Inbox, MessageCircle, LayoutGrid, Crown, Clock, Check, Sparkles, Info, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AutocompleteInput } from "@/components/shared/autocomplete-input";
import { allIndianCities } from "@/lib/cities";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { RoommateProfile } from "@/lib/types";
import {
  FREE_CHAT_LIMIT, LIFESTYLE_TAGS, compatibility, fetchDeck, fetchMatches, fetchQuota, fetchRequests, loadPrefs,
  planById, respondToRequest, savePrefs, swipe, undoSwipe,
  type Match, type MatchRequest, type MyPreferences, type PlanId, type Quota, type SwipeDirection, type SwipeProfile,
} from "@/lib/matching";
import { SwipeCard, ProfileVisual, type SwipeCardHandle } from "./swipe-card";
import { MatchPopup } from "./match-popup";
import { MatchChat } from "./match-chat";
import { RoommatePlansModal } from "./roommate-plans-modal";

export type RoommateTab = "discover" | "requests" | "matches" | "browse";

interface Props {
  roommates: RoommateProfile[];
  isLoggedIn: boolean;
  onRequireAuth: (action: string) => void;
  browse: ReactNode; // the classic grid/list view
  userName?: string | null;
  userPic?: string | null;
  initialTab?: RoommateTab;
  onNotificationCount?: (n: number) => void;
}

export function RoommatesSection({ roommates, isLoggedIn, onRequireAuth, browse, userName, userPic, initialTab = "discover", onNotificationCount }: Props) {
  const { toast } = useToast();
  const [tab, setTab] = useState<RoommateTab>(initialTab);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [deck, setDeck] = useState<SwipeProfile[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [prefs, setPrefs] = useState<MyPreferences>(loadPrefs);
  const [received, setReceived] = useState<MatchRequest[]>([]);
  const [sent, setSent] = useState<MatchRequest[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [newMatch, setNewMatch] = useState<Match | null>(null);
  const [plansReason, setPlansReason] = useState<"limit" | "chat" | "manual" | null>(null);
  const [lastSwiped, setLastSwiped] = useState<SwipeProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const topCard = useRef<SwipeCardHandle>(null);

  // ---------------------------------------------------------------- data
  const refreshSocial = useCallback(async () => {
    try {
      const [{ received, sent }, m] = await Promise.all([fetchRequests(), fetchMatches()]);
      setReceived(received);
      setSent(sent);
      setMatches(m);
      onNotificationCount?.(received.length + m.reduce((n, x) => n + (x.unread ?? 0), 0));
    } catch {
      /* logged out or offline — tabs just stay empty */
    }
  }, [onNotificationCount]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setLoadError(false);
      if (!isLoggedIn) {
        setLoading(false);
        return;
      }
      try {
        const [d, q] = await Promise.all([fetchDeck(), fetchQuota()]);
        if (!alive) return;
        setDeck(d);
        setQuota(q);
        await refreshSocial();
      } catch (err: any) {
        if (!alive) return;
        if (err?.response?.status === 401) onRequireAuth("find roommates");
        else setLoadError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, roommates]);

  // ---------------------------------------------------------------- derived
  const visibleDeck = useMemo(() => {
    return deck
      .filter((p) => prefs.gender === "any" || !p.gender || p.gender === prefs.gender)
      .filter((p) => !prefs.city || p.city?.toLowerCase().includes(prefs.city.toLowerCase()) || p.locality?.toLowerCase().includes(prefs.city.toLowerCase()))
      .map((p) => ({ profile: p, score: compatibility(p, prefs) }))
      .sort((a, b) => b.score - a.score);
  }, [deck, prefs]);

  const outOfSwipes = !!quota && quota.limit !== null && quota.used >= quota.limit;
  const plan = planById(quota?.plan ?? "free");

  const lockedChatIds = useMemo(() => {
    if ((quota?.plan ?? "free") !== "free") return new Set<string>();
    const oldestFirst = [...matches].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
    return new Set(oldestFirst.slice(FREE_CHAT_LIMIT).map((m) => m.id));
  }, [matches, quota?.plan]);

  // ---------------------------------------------------------------- actions
  const guard = () => {
    if (!isLoggedIn) {
      onRequireAuth("find roommates");
      return false;
    }
    if (outOfSwipes) {
      setPlansReason("limit");
      return false;
    }
    return true;
  };

  const handleSwiped = async (profile: SwipeProfile, dir: SwipeDirection) => {
    setDeck((d) => d.filter((p) => p.id !== profile.id));
    setBusy(true);
    try {
      const res = await swipe(profile, dir);
      setQuota(res.quota);
      if (res.status === "limit_reached") {
        setDeck((d) => [profile, ...d]); // put the card back
        setPlansReason("limit");
        return;
      }
      setLastSwiped(profile);
      if (res.status === "matched" && res.match) {
        setNewMatch(res.match);
        refreshSocial();
      } else if (res.status === "requested") {
        toast({ title: `Request sent to ${profile.name} 💌`, description: "You'll be able to chat as soon as they accept." });
        refreshSocial();
      }
    } catch {
      setDeck((d) => [profile, ...d]);
      toast({ title: "Swipe didn't go through", description: "Check your connection and try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const pressButton = (dir: SwipeDirection) => {
    if (!guard() || busy || !visibleDeck.length) return;
    topCard.current?.flyOut(dir);
  };

  const handleUndo = async () => {
    if (!lastSwiped) return;
    if (plan.id !== "premium") {
      setPlansReason("manual");
      toast({ title: "Undo is a Premium feature", description: "Upgrade to bring back the last profile." });
      return;
    }
    const q = await undoSwipe(lastSwiped.id);
    setQuota(q);
    setDeck((d) => [lastSwiped, ...d]);
    setLastSwiped(null);
    refreshSocial();
  };

  // keyboard: ← skip, → like
  useEffect(() => {
    if (tab !== "discover") return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowLeft") pressButton("left");
      if (e.key === "ArrowRight") pressButton("right");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const respond = async (req: MatchRequest, accept: boolean) => {
    if (!isLoggedIn) return onRequireAuth("respond to requests");
    try {
      const match = await respondToRequest(req.id, accept);
      setReceived((r) => r.filter((x) => x.id !== req.id));
      if (accept && match) setNewMatch(match);
      else toast({ title: "Request declined", description: `${req.profile.name} won't be notified.` });
      refreshSocial();
    } catch {
      toast({ title: "Something went wrong", description: "Please try again.", variant: "destructive" });
    }
  };

  const updatePrefs = (p: Partial<MyPreferences>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...p };
      savePrefs(next);
      return next;
    });
  };

  const openChat = (m: Match) => {
    setNewMatch(null);
    if (lockedChatIds.has(m.id)) {
      setPlansReason("chat");
      return;
    }
    setTab("matches");
    setActiveChat(m.id);
  };

  // ---------------------------------------------------------------- render
  const tabs: { id: RoommateTab; label: string; icon: ReactNode; count?: number }[] = [
    { id: "discover", label: "Discover", icon: <Flame className="h-4 w-4" /> },
    { id: "requests", label: "Requests", icon: <Inbox className="h-4 w-4" />, count: received.length },
    { id: "matches", label: "Chats", icon: <MessageCircle className="h-4 w-4" />, count: matches.reduce((n, m) => n + (m.unread ?? 0), 0) },
    { id: "browse", label: "Browse all", icon: <LayoutGrid className="h-4 w-4" /> },
  ];

  const prefsPanel = (
    <PreferencesPanel prefs={prefs} onChange={updatePrefs} />
  );

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-10">
      {/* Title */}
      <div className="mb-4 sm:mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="hidden sm:block text-sm font-semibold uppercase tracking-wider text-orange-500">Roommate Match</p>
          <h1 className="sm:mt-1 text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900">Find your flatmate</h1>
          <p className="mt-2 hidden sm:block text-muted-foreground">Swipe right if you'd share a home. When they say yes too, you can chat.</p>
        </div>
        {quota && (
          <button
            onClick={() => setPlansReason("manual")}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border bg-card px-3 sm:px-4 py-2 text-sm font-semibold shadow-sm hover:shadow-md transition-shadow"
          >
            <Crown className={cn("h-4 w-4", plan.id === "free" ? "text-muted-foreground" : "text-orange-500")} />
            <span className="hidden sm:inline">{plan.name} plan</span>
            {plan.id === "free" && <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[11px] text-white">Upgrade</span>}
          </button>
        )}
      </div>


      {/* Tabs */}
      <div className="mb-4 sm:mb-6 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all",
              tab === t.id ? "bg-slate-900 text-white shadow-md" : "bg-card text-slate-600 hover:bg-white hover:text-slate-900 border",
            )}
          >
            {t.icon}
            {t.label}
            {!!t.count && (
              <span className={cn("rounded-full px-1.5 text-[11px] font-bold", tab === t.id ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-700")}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------ Discover */}
      {tab === "discover" && (
        <div className="grid gap-8 lg:grid-cols-[300px_1fr_260px]">
          {/* Preferences — desktop */}
          <aside className="hidden lg:block">
            <div className="sticky top-28 rounded-3xl border bg-card p-5 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 font-bold">
                <SlidersHorizontal className="h-4 w-4" /> Your preferences
              </h3>
              {prefsPanel}
            </div>
          </aside>

          {/* Deck */}
          <div className="flex flex-col items-center">
            <div className="mb-3 flex w-full max-w-[400px] items-center justify-between lg:hidden">
              <SwipeMeter quota={quota} compact />
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-full">
                    <SlidersHorizontal className="mr-1.5 h-4 w-4" /> Filters
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
                  <SheetHeader>
                    <SheetTitle>Your preferences</SheetTitle>
                  </SheetHeader>
                  <div className="p-4">{prefsPanel}</div>
                </SheetContent>
              </Sheet>
            </div>

            <div className="relative h-[62svh] min-h-[420px] max-h-[540px] w-full max-w-[400px] lg:h-[540px]">
              {loading ? (
                <div className="absolute inset-0 animate-pulse rounded-[28px] bg-gradient-to-br from-slate-200 to-slate-100" />
              ) : !isLoggedIn ? (
                <EmptyCard
                  icon={<Heart className="h-8 w-8" />}
                  title="Sign in to start matching"
                  text="Create your roommate profile and start swiping in under a minute."
                  action={<Button className="rounded-full px-6" onClick={() => onRequireAuth("find roommates")}>Sign in</Button>}
                />
              ) : loadError ? (
                <EmptyCard
                  icon={<RotateCcw className="h-8 w-8" />}
                  title="Couldn't load profiles"
                  text="Our server didn't respond. It may be waking up — try again in a few seconds."
                  action={<Button className="rounded-full px-6" onClick={() => window.location.reload()}>Try again</Button>}
                />
              ) : visibleDeck.length === 0 ? (
                <EmptyCard
                  icon={<Sparkles className="h-8 w-8" />}
                  title="You've seen everyone here"
                  text={prefs.city || prefs.gender !== "any" ? "Try widening your city or gender filter to see more people." : "New people join every day — check back soon, or post your own roommate listing so others can find you."}
                  action={
                    prefs.city || prefs.gender !== "any" ? (
                      <Button variant="outline" className="rounded-full" onClick={() => updatePrefs({ city: "", gender: "any" })}>Clear filters</Button>
                    ) : (
                      <Button variant="outline" className="rounded-full" onClick={() => setTab("browse")}>Browse all profiles</Button>
                    )
                  }
                />
              ) : (
                <>
                  {visibleDeck.slice(0, 3).reverse().map(({ profile, score }, idx, arr) => {
                    const depth = arr.length - 1 - idx;
                    return (
                      <SwipeCard
                        key={profile.id}
                        ref={depth === 0 ? topCard : undefined}
                        profile={profile}
                        score={score}
                        isTop={depth === 0}
                        depth={depth}
                        disabled={outOfSwipes || busy || !isLoggedIn}
                        onSwiped={(dir) => handleSwiped(profile, dir)}
                      />
                    );
                  })}
                  {outOfSwipes && <OutOfSwipes quota={quota!} onUpgrade={() => setPlansReason("limit")} />}
                </>
              )}
            </div>

            {/* Action buttons */}
            <div className="mt-5 flex items-center gap-4 sm:gap-5">
              <RoundButton label="Undo" size="sm" onClick={handleUndo} disabled={!lastSwiped} className="text-amber-500">
                <RotateCcw className="h-5 w-5" />
              </RoundButton>
              <RoundButton label="Skip" size="lg" onClick={() => pressButton("left")} disabled={!visibleDeck.length || busy} className="text-rose-500 hover:bg-rose-50">
                <X className="h-8 w-8" strokeWidth={3} />
              </RoundButton>
              <RoundButton label="Interested" size="lg" onClick={() => pressButton("right")} disabled={!visibleDeck.length || busy} className="text-emerald-500 hover:bg-emerald-50">
                <Heart className="h-8 w-8 fill-current" />
              </RoundButton>
              <RoundButton label="Upgrade" size="sm" onClick={() => setPlansReason("manual")} className="text-sky-500">
                <Crown className="h-5 w-5" />
              </RoundButton>
            </div>
            <p className="mt-3 hidden text-xs text-muted-foreground sm:block">Tip: use ← and → keys to swipe</p>
          </div>

          {/* Side stats — desktop */}
          <aside className="hidden lg:block space-y-4">
            <div className="rounded-3xl border bg-card p-5 shadow-sm">
              <SwipeMeter quota={quota} />
            </div>
            <button onClick={() => setTab("requests")} className="flex w-full items-center justify-between rounded-3xl border bg-card p-5 text-left shadow-sm hover:shadow-md transition-shadow">
              <div>
                <p className="text-sm text-muted-foreground">Requests for you</p>
                <p className="text-2xl font-extrabold">{received.length}</p>
              </div>
              <Inbox className="h-8 w-8 text-primary" />
            </button>
            <button onClick={() => setTab("matches")} className="flex w-full items-center justify-between rounded-3xl border bg-card p-5 text-left shadow-sm hover:shadow-md transition-shadow">
              <div>
                <p className="text-sm text-muted-foreground">Matches</p>
                <p className="text-2xl font-extrabold">{matches.length}</p>
              </div>
              <MessageCircle className="h-8 w-8 text-orange-500" />
            </button>
            <div className="rounded-3xl bg-gradient-to-br from-blue-700 to-indigo-600 p-5 text-white">
              <p className="font-bold">How it works</p>
              <ol className="mt-3 space-y-2 text-sm text-blue-100">
                <li>1. Swipe right on people you like</li>
                <li>2. They get your request</li>
                <li>3. If they accept, chat unlocks</li>
                <li>4. Visit flats together 🏠</li>
              </ol>
            </div>
          </aside>
        </div>
      )}

      {/* ------------------------------------------------ Requests */}
      {tab === "requests" && (
        <div className="grid gap-8 lg:grid-cols-2">
          <section>
            <h2 className="mb-4 text-lg font-bold">Wants to be your roommate <span className="text-muted-foreground font-normal">({received.length})</span></h2>
            {received.length === 0 ? (
              <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">No new requests. Complete your profile to get noticed!</p>
            ) : (
              <div className="space-y-3">
                {received.map((r) => (
                  <RequestRow key={r.id} req={r} score={compatibility(r.profile, prefs)}>
                    <Button size="icon" variant="outline" className="h-11 w-11 rounded-full text-rose-500" onClick={() => respond(r, false)} aria-label={`Decline ${r.profile.name}`}>
                      <X className="h-5 w-5" />
                    </Button>
                    <Button className="h-11 rounded-full bg-emerald-500 px-5 font-semibold hover:bg-emerald-600" onClick={() => respond(r, true)}>
                      <Check className="mr-1.5 h-4 w-4" /> Accept
                    </Button>
                  </RequestRow>
                ))}
              </div>
            )}
          </section>
          <section>
            <h2 className="mb-4 text-lg font-bold">Sent by you <span className="text-muted-foreground font-normal">({sent.length})</span></h2>
            {sent.length === 0 ? (
              <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-muted-foreground">Swipe right on someone to send a request.</p>
            ) : (
              <div className="space-y-3">
                {sent.map((r) => (
                  <RequestRow key={r.id} req={r} score={compatibility(r.profile, prefs)}>
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
                      r.status === "accepted" ? "bg-emerald-100 text-emerald-700" : r.status === "declined" ? "bg-slate-100 text-slate-500" : "bg-amber-100 text-amber-700",
                    )}>
                      {r.status === "pending" ? <><Send className="h-3 w-3" /> Sent</> : r.status === "accepted" ? "Accepted" : "Not interested"}
                    </span>
                  </RequestRow>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ------------------------------------------------ Chats */}
      {tab === "matches" && (
        <MatchChat
          matches={matches}
          activeId={activeChat}
          onSelect={setActiveChat}
          lockedIds={lockedChatIds}
          onLockedClick={() => setPlansReason("chat")}
          onActivity={refreshSocial}
          onStartSwiping={() => setTab("discover")}
        />
      )}

      {/* ------------------------------------------------ Browse */}
      {tab === "browse" && <div className="-mx-4 sm:-mx-6 lg:-mx-8">{browse}</div>}

      <MatchPopup match={newMatch} myName={userName} myPic={userPic} onChat={openChat} onClose={() => setNewMatch(null)} />
      <RoommatePlansModal
        isOpen={plansReason !== null}
        reason={plansReason ?? "manual"}
        onClose={() => setPlansReason(null)}
        currentPlan={(quota?.plan ?? "free") as PlanId}
        onActivated={(q) => setQuota(q)}
      />
    </div>
  );
}

// ------------------------------------------------------------------ small pieces

function RoundButton({ children, label, onClick, disabled, size, className }: { children: ReactNode; label: string; onClick: () => void; disabled?: boolean; size: "sm" | "lg"; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/5 transition-all duration-200 hover:scale-110 active:scale-95 disabled:opacity-40 disabled:hover:scale-100",
        size === "lg" ? "h-16 w-16 sm:h-[72px] sm:w-[72px]" : "h-12 w-12",
        className,
      )}
    >
      {children}
    </button>
  );
}

function SwipeMeter({ quota, compact }: { quota: Quota | null; compact?: boolean }) {
  if (!quota) return null;
  if (quota.limit === null) {
    return (
      <div className={cn("flex items-center gap-2 font-semibold", compact ? "text-sm" : "")}>
        <Crown className="h-4 w-4 text-orange-500" /> Unlimited swipes
      </div>
    );
  }
  const left = Math.max(0, quota.limit - quota.used);
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-semibold shadow-sm border">
        <Flame className="h-4 w-4 text-orange-500" /> {left} swipes left
      </span>
    );
  }
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="text-sm text-muted-foreground">Swipes left today</p>
        <p className="text-2xl font-extrabold">
          {left}
          <span className="text-sm font-medium text-muted-foreground">/{quota.limit}</span>
        </p>
      </div>
      <Progress value={(left / quota.limit) * 100} className="mt-3 h-2" />
      <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="h-3 w-3" /> Resets {formatDistanceToNow(new Date(quota.resetsAt), { addSuffix: true })}
      </p>
    </div>
  );
}

function OutOfSwipes({ quota, onUpgrade }: { quota: Quota; onUpgrade: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-[28px] bg-slate-950/80 p-8 text-center text-white backdrop-blur-sm">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500">
        <Clock className="h-8 w-8" />
      </div>
      <h3 className="mt-5 text-2xl font-extrabold">That's all for today</h3>
      <p className="mt-2 text-white/80">
        You've used all {quota.limit} swipes. New swipes in {formatDistanceToNow(new Date(quota.resetsAt))}.
      </p>
      <Button className="mt-6 h-12 rounded-full bg-orange-500 px-8 font-bold hover:bg-orange-600" onClick={onUpgrade}>
        <Crown className="mr-2 h-4 w-4" /> Get more swipes
      </Button>
    </div>
  );
}

function EmptyCard({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center rounded-[28px] border-2 border-dashed bg-card p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div>
      <h3 className="mt-4 text-xl font-bold">{title}</h3>
      <p className="mt-2 text-muted-foreground">{text}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

function RequestRow({ req, score, children }: { req: MatchRequest; score: number; children: ReactNode }) {
  const p = req.profile;
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-card p-3 pr-4 shadow-sm">
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl">
        <ProfileVisual profile={p} initialsClass="text-xl" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">
          {p.name}{p.age ? `, ${p.age}` : ""}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {p.occupation ? `${p.occupation} · ` : ""}{p.locality} · ₹{p.budget.toLocaleString("en-IN")}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          <span className="font-semibold text-orange-600">{score}% match</span> · {formatDistanceToNow(new Date(req.createdAt), { addSuffix: true })}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function PreferencesPanel({ prefs, onChange }: { prefs: MyPreferences; onChange: (p: Partial<MyPreferences>) => void }) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>City</Label>
        <AutocompleteInput placeholder="Any city" value={prefs.city} onChange={(v) => onChange({ city: v })} suggestions={allIndianCities} />
      </div>
      <div className="space-y-2">
        <Label>Max budget: ₹{prefs.maxBudget.toLocaleString("en-IN")}</Label>
        <Slider min={3000} max={60000} step={1000} value={[prefs.maxBudget]} onValueChange={([v]) => onChange({ maxBudget: v })} />
      </div>
      <div className="space-y-2">
        <Label>Show me</Label>
        <Select value={prefs.gender} onValueChange={(v) => onChange({ gender: v as MyPreferences["gender"] })}>
          <SelectTrigger className="rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Everyone</SelectItem>
            <SelectItem value="Female">Women</SelectItem>
            <SelectItem value="Male">Men</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>My lifestyle</Label>
        <p className="text-xs text-muted-foreground">Used to calculate your match %</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {LIFESTYLE_TAGS.map((t) => {
            const on = prefs.tags.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => onChange({ tags: on ? prefs.tags.filter((x) => x !== t) : [...prefs.tags, t] })}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  on ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/50",
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
