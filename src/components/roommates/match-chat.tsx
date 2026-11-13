"use client";

import { useEffect, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ArrowLeft, Send, Phone, ShieldAlert, MessageCircle, Lock, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { fetchMessages, sendMessage, demoAutoReply, type ChatMessage, type Match } from "@/lib/matching";
import { ProfileVisual } from "./swipe-card";

interface Props {
  matches: Match[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  demoMode: boolean;
  lockedIds: Set<string>; // matches beyond the Free plan chat limit
  onLockedClick: () => void;
  onActivity: () => void; // refresh list after sending
  onStartSwiping: () => void;
}

export function MatchChat({ matches, activeId, onSelect, demoMode, lockedIds, onLockedClick, onActivity, onStartSwiping }: Props) {
  const active = matches.find((m) => m.id === activeId) ?? null;

  if (matches.length === 0) {
    return (
      <div className="mx-auto max-w-md rounded-3xl border border-dashed bg-card p-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MessageCircle className="h-8 w-8" />
        </div>
        <h3 className="mt-4 text-xl font-bold">No matches yet</h3>
        <p className="mt-2 text-muted-foreground">Swipe right on people you like. When they accept, you can chat here.</p>
        <Button className="mt-6 rounded-full px-6" onClick={onStartSwiping}>Start swiping</Button>
      </div>
    );
  }

  return (
    <div className="grid h-[70vh] min-h-[480px] overflow-hidden rounded-3xl border bg-card shadow-sm md:grid-cols-[320px_1fr]">
      {/* Conversation list */}
      <div className={cn("flex flex-col border-r", active && "hidden md:flex")}>
        <div className="border-b px-5 py-4">
          <h3 className="font-bold">Matches</h3>
          <p className="text-xs text-muted-foreground">{matches.length} {matches.length === 1 ? "person" : "people"}</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {matches.map((m) => {
            const locked = lockedIds.has(m.id);
            return (
              <button
                key={m.id}
                onClick={() => (locked ? onLockedClick() : onSelect(m.id))}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60",
                  m.id === activeId && "bg-primary/5",
                )}
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-2xl">
                  <ProfileVisual profile={m.profile} initialsClass="text-lg" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{m.profile.name}</span>
                    {m.lastMessageAt && (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(m.lastMessageAt), { addSuffix: false })}
                      </span>
                    )}
                  </div>
                  <p className="flex items-center gap-1 truncate text-sm text-muted-foreground">
                    {locked && <Lock className="h-3 w-3 shrink-0" />}
                    {locked ? "Upgrade to chat" : m.lastMessage ?? "Say hi 👋"}
                  </p>
                </div>
                {!!m.unread && !locked && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 text-[11px] font-bold text-white">{m.unread}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Thread */}
      <div className={cn("flex min-h-0 flex-col", !active && "hidden md:flex")}>
        {active ? (
          <Thread key={active.id} match={active} demoMode={demoMode} onBack={() => onSelect(null)} onActivity={onActivity} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <MessageCircle className="h-10 w-10" />
            <p className="mt-3">Pick a match to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Thread({ match, demoMode, onBack, onActivity }: { match: Match; demoMode: boolean; onBack: () => void; onActivity: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    let alive = true;
    const load = () => fetchMessages(match.id).then((m) => alive && setMessages(m)).catch(() => {});
    load();
    // Simple polling in API mode. Swap for WebSockets / Django Channels later for instant delivery.
    const t = demoMode ? undefined : window.setInterval(load, 5000);
    return () => {
      alive = false;
      if (t) window.clearInterval(t);
    };
  }, [match.id, demoMode]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText("");
    try {
      const msg = await sendMessage(match.id, value);
      setMessages((prev) => [...prev, msg]);
      onActivity();
      if (demoMode) {
        setTyping(true);
        window.setTimeout(() => {
          const reply = demoAutoReply(match.id);
          setTyping(false);
          if (reply) setMessages((prev) => [...prev, reply]);
          onActivity();
        }, 1400);
      }
    } catch {
      setText(value);
      toast({ title: "Message not sent", description: "Please try again.", variant: "destructive" });
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-10 w-10 overflow-hidden rounded-xl">
          <ProfileVisual profile={match.profile} initialsClass="text-base" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{match.profile.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {match.profile.locality} · Budget ₹{match.profile.budget.toLocaleString("en-IN")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => {
            if (match.profile.phone) setShowPhone((v) => !v);
            else toast({ title: "Number not shared yet", description: `Ask ${match.profile.name} for their number in chat.` });
          }}
        >
          <Phone className="mr-1.5 h-4 w-4" />
          {showPhone && match.profile.phone ? match.profile.phone : "Contact"}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More options">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onSelect={() => toast({ title: "Reported", description: "Thanks — our team will review this profile within 24 hours." })}
            >
              <ShieldAlert className="mr-2 h-4 w-4" /> Report profile
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto bg-muted/30 px-4 py-5">
        <div className="mx-auto mb-4 w-fit rounded-full bg-card px-4 py-1.5 text-xs text-muted-foreground shadow-sm">
          You matched {formatDistanceToNow(new Date(match.createdAt), { addSuffix: true })} · Never pay a deposit before visiting
        </div>
        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[78%] rounded-2xl px-4 py-2 text-sm shadow-sm",
                m.from === "me" ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-card",
              )}
            >
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-2xl rounded-bl-md bg-card px-4 py-3 shadow-sm">
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.3s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.15s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/60" />
            </div>
          </div>
        )}
        <div ref={bottom} />
      </div>

      <form onSubmit={send} className="flex items-center gap-2 border-t p-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${match.profile.name}…`}
          className="h-11 rounded-full bg-muted/50 px-5"
          maxLength={1000}
        />
        <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-full bg-orange-500 hover:bg-orange-600" disabled={!text.trim()}>
          <Send className="h-4 w-4" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </>
  );
}
