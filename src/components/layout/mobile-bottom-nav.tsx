"use client";

import { Home, BedDouble, Building, Heart, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Page } from "@/lib/types";

interface Props {
  activePage: Page;
  onNavigate: (page: Page) => void;
  roommateBadge?: number;
}

const ITEMS: { page: Page; label: string; icon: typeof Home }[] = [
  { page: "home", label: "Home", icon: Home },
  { page: "pg", label: "PG", icon: BedDouble },
  { page: "roommates", label: "Match", icon: Heart },
  { page: "rentals", label: "Rentals", icon: Building },
  { page: "list", label: "List", icon: PlusCircle },
];

/** App-style bottom tab bar, phones only. */
export function MobileBottomNav({ activePage, onNavigate, roommateBadge = 0 }: Props) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Main"
    >
      <div className="grid grid-cols-5">
        {ITEMS.map(({ page, label, icon: Icon }) => {
          const active = activePage === page;
          const isMatch = page === "roommates";
          return (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className={cn("relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition-colors", active ? "text-primary" : "text-slate-500")}
              aria-current={active ? "page" : undefined}
            >
              {isMatch ? (
                <span className={cn("-mt-6 flex h-12 w-12 items-center justify-center rounded-full shadow-lg ring-4 ring-white", active ? "bg-[#065af3] text-white" : "bg-gradient-to-r from-[#53b2fe] to-[#065af3] text-white")}>
                  <Icon className="h-6 w-6 fill-current" />
                </span>
              ) : (
                <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
              )}
              {label}
              {isMatch && roommateBadge > 0 && (
                <span className="absolute right-[22%] top-[-18px] flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                  {roommateBadge > 9 ? "9+" : roommateBadge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
