"use client";

import React, { useMemo, useState } from "react";
import type { Listing, RoommateProfile, Page, FilterState, Coupon } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Users, Home as HomeIcon, BedDouble, Search, MapPin, IndianRupee, ShieldCheck, BadgePercent, Lock, Headphones,
  Wifi, Snowflake, UtensilsCrossed, Sofa, UserCheck, Heart, X, ArrowRight, Building2, Copy, Sparkles, PlusCircle,
} from "lucide-react";
import { PropertyCard } from "@/components/shared/property-card";
import { AutocompleteInput } from "@/components/shared/autocomplete-input";
import { allIndianCities } from "@/lib/cities";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

type SearchTab = "pg" | "rentals" | "roommates";

interface HomeSectionProps {
  featuredProperties: Listing[];
  featuredRoommates: RoommateProfile[];
  allListings?: Listing[];
  coupons?: Coupon[];
  onViewDetails: (item: Listing | RoommateProfile, type: "listing" | "roommate") => void;
  onNavigate: (page: Page) => void;
  onSearch?: (page: Page, filters: Partial<FilterState>) => void;
  likedItemIds: Set<string>;
  onToggleLike: (itemId: string) => void;
  unlockedIds: Set<string>;
}

const SEARCH_TABS: { id: SearchTab; label: string; icon: React.ReactNode }[] = [
  { id: "pg", label: "PG / Co-living", icon: <BedDouble className="h-5 w-5" /> },
  { id: "rentals", label: "Rentals", icon: <HomeIcon className="h-5 w-5" /> },
  { id: "roommates", label: "Roommates", icon: <Users className="h-5 w-5" /> },
];

const BUDGETS = [
  { label: "Any budget", value: 100000 },
  { label: "Under ₹8,000", value: 8000 },
  { label: "Under ₹12,000", value: 12000 },
  { label: "Under ₹20,000", value: 20000 },
  { label: "Under ₹35,000", value: 35000 },
];

const QUICK_FILTERS: { label: string; icon: React.ReactNode; page: Page; filters: Partial<FilterState> }[] = [
  { label: "PG with meals", icon: <UtensilsCrossed className="h-4 w-4" />, page: "pg", filters: { amenities: ["Meals"] } },
  { label: "AC rooms", icon: <Snowflake className="h-4 w-4" />, page: "pg", filters: { amenities: ["AC"] } },
  { label: "With WiFi", icon: <Wifi className="h-4 w-4" />, page: "pg", filters: { amenities: ["WiFi"] } },
  { label: "Fully furnished", icon: <Sofa className="h-4 w-4" />, page: "rentals", filters: { furnishedStatus: "Furnished" } },
  { label: "Direct from owner", icon: <UserCheck className="h-4 w-4" />, page: "rentals", filters: { brokerStatus: "Without Broker" } },
  { label: "Female roommates", icon: <Users className="h-4 w-4" />, page: "roommates", filters: { gender: "Female" } },
];

const POPULAR_CITIES = [
  { name: "Navi Mumbai", tint: "from-sky-500 to-blue-700" },
  { name: "Mumbai", tint: "from-orange-400 to-rose-600" },
  { name: "Pune", tint: "from-emerald-400 to-teal-700" },
  { name: "Bangalore", tint: "from-violet-500 to-indigo-700" },
  { name: "Thane", tint: "from-amber-400 to-orange-600" },
  { name: "Hyderabad", tint: "from-pink-500 to-fuchsia-700" },
];

const TRUST = [
  { icon: <ShieldCheck className="h-6 w-6" />, title: "Verified listings", text: "Every property is checked by our team with owner documents before it goes live." },
  { icon: <BadgePercent className="h-6 w-6" />, title: "Zero-brokerage options", text: "Filter for direct-from-owner homes and skip the broker fee." },
  { icon: <Lock className="h-6 w-6" />, title: "Private until you match", text: "Roommate numbers stay hidden until both people say yes." },
  { icon: <Headphones className="h-6 w-6" />, title: "Real human support", text: "Stuck anywhere? Message us on WhatsApp and we'll help." },
];

const pageFor = (t: SearchTab): Page => (t === "roommates" ? "roommates" : t);

export function HomeSection({
  featuredProperties,
  allListings = [],
  coupons = [],
  onViewDetails,
  onNavigate,
  onSearch,
  likedItemIds,
  onToggleLike,
  unlockedIds,
}: HomeSectionProps) {
  const [tab, setTab] = useState<SearchTab>("pg");
  const [city, setCity] = useState("");
  const [locality, setLocality] = useState("");
  const [budget, setBudget] = useState(100000);
  const { toast } = useToast();

  const go = (page: Page, filters: Partial<FilterState> = {}) => {
    if (onSearch) onSearch(page, filters);
    else onNavigate(page);
  };

  const runSearch = () => go(pageFor(tab), { city, locality, budget });

  const cityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of allListings) {
      const c = POPULAR_CITIES.find((pc) => l.city?.toLowerCase().includes(pc.name.toLowerCase()));
      if (c) counts[c.name] = (counts[c.name] || 0) + 1;
    }
    return counts;
  }, [allListings]);

  const startingPrice = useMemo(() => {
    const pg = allListings.filter((l) => l.propertyType === "PG" && l.rent > 0).map((l) => l.rent);
    return pg.length ? Math.min(...pg) : null;
  }, [allListings]);

  const activeCoupons = coupons.filter((c) => c.isActive).slice(0, 3);

  return (
    <div className="pb-16">
      {/* ============================== HERO + SEARCH ============================== */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
        <div className="relative isolate overflow-hidden rounded-3xl min-h-[340px] sm:min-h-[400px] shadow-xl">
          <img
            src="https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=2400&auto=format&fit=crop"
            alt=""
            fetchPriority="high"
            className="absolute inset-0 -z-20 h-full w-full object-cover animate-skyline-pan"
          />
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 -z-10 h-full w-full object-cover opacity-80 animate-skyline-pan"
          >
            <source src="https://assets.mixkit.co/videos/preview/mixkit-aerial-view-of-city-buildings-on-a-sunny-day-41465-large.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/80 via-blue-950/65 to-slate-900/40" />

          <div className="relative px-6 pt-10 pb-28 sm:px-12 sm:pt-14 sm:pb-36 text-white">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs sm:text-sm font-medium backdrop-blur">
              <Sparkles className="h-4 w-4 text-orange-300" /> Zero brokerage options · Verified stays
            </span>
            <h1 className="mt-4 max-w-2xl text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Find your perfect <span className="bg-gradient-to-r from-sky-300 to-blue-400 bg-clip-text text-transparent">living space</span>
            </h1>
            <p className="mt-4 max-w-xl text-base sm:text-lg text-slate-200">
              PGs, rental homes and roommates — with transparent pricing and owners you can trust.
            </p>
          </div>
        </div>

        {/* Search widget — overlaps the hero like a booking app */}
        <div className="relative z-10 mx-auto -mt-20 sm:-mt-24 max-w-5xl px-0 sm:px-4">
          <div className="rounded-3xl bg-card shadow-2xl shadow-slate-900/10 ring-1 ring-black/5">
            <div className="flex gap-1 overflow-x-auto no-scrollbar border-b px-3 pt-3 sm:px-6">
              {SEARCH_TABS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "relative flex shrink-0 flex-col items-center gap-1 px-4 pb-3 pt-1 text-xs sm:text-sm font-semibold transition-colors",
                    tab === t.id ? "text-primary" : "text-slate-500 hover:text-slate-800",
                  )}
                >
                  <span className={cn("rounded-xl p-2 transition-colors", tab === t.id ? "bg-primary/10" : "bg-transparent")}>{t.icon}</span>
                  {t.label}
                  {tab === t.id && <span className="absolute inset-x-3 -bottom-px h-[3px] rounded-full bg-primary" />}
                </button>
              ))}
            </div>

            <div className="grid gap-3 p-4 pb-10 sm:grid-cols-3 sm:gap-0 sm:p-6 sm:pb-12">
              <FieldBox label="City" icon={<MapPin className="h-4 w-4" />} className="sm:rounded-l-2xl">
                <AutocompleteInput
                  placeholder="e.g. Navi Mumbai"
                  value={city}
                  onChange={setCity}
                  suggestions={allIndianCities}
                  className="[&_input]:h-8 [&_input]:border-0 [&_input]:bg-transparent [&_input]:p-0 [&_input]:text-lg [&_input]:font-bold [&_input]:shadow-none [&_input]:focus-visible:ring-0"
                />
              </FieldBox>
              <FieldBox label={tab === "roommates" ? "Preferred area" : "Area / Locality"} icon={<Building2 className="h-4 w-4" />}>
                <input
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  placeholder="e.g. Vashi, Nerul"
                  className="h-8 w-full bg-transparent text-lg font-bold outline-none placeholder:font-semibold placeholder:text-slate-400"
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                />
              </FieldBox>
              <FieldBox label="Budget per month" icon={<IndianRupee className="h-4 w-4" />} className="sm:rounded-r-2xl">
                <select
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="h-8 w-full cursor-pointer bg-transparent text-lg font-bold outline-none"
                >
                  {BUDGETS.map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
              </FieldBox>
            </div>
          </div>
          <div className="relative -mt-7 flex justify-center">
            <Button
              size="lg"
              onClick={runSearch}
              className="h-14 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-12 text-lg font-extrabold uppercase tracking-wide text-white shadow-xl shadow-orange-500/30 hover:from-orange-600 hover:to-amber-600"
            >
              <Search className="mr-2 h-5 w-5" strokeWidth={3} /> Search
            </Button>
          </div>
        </div>

        {/* Quick filters */}
        <div className="mx-auto mt-8 max-w-5xl">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 sm:flex-wrap sm:justify-center">
            {QUICK_FILTERS.map((q) => (
              <button
                key={q.label}
                onClick={() => go(q.page, q.filters)}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary hover:shadow-md"
              >
                <span className="text-primary">{q.icon}</span>
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ============================== CATEGORY TILES ============================== */}
      <section className="container mx-auto mt-14 px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          <CategoryTile
            title="PG & Co-living"
            text={startingPrice ? `Starting ₹${startingPrice.toLocaleString("en-IN")}/month` : "Meals, WiFi & housekeeping"}
            icon={<BedDouble className="h-7 w-7" />}
            tint="from-blue-600 to-indigo-700"
            onClick={() => onNavigate("pg")}
          />
          <CategoryTile
            title="Rental homes"
            text="1–4 BHK flats, verified owners"
            icon={<HomeIcon className="h-7 w-7" />}
            tint="from-emerald-500 to-teal-700"
            onClick={() => onNavigate("rentals")}
          />
          <CategoryTile
            title="Roommate Match"
            text="Swipe, match & chat — new!"
            icon={<Heart className="h-7 w-7" />}
            tint="from-orange-500 to-rose-600"
            onClick={() => onNavigate("roommates")}
            badge="NEW"
          />
        </div>
      </section>

      {/* ============================== OFFERS (live coupons) ============================== */}
      {activeCoupons.length > 0 && (
        <section className="container mx-auto mt-14 px-4 sm:px-6 lg:px-8">
          <SectionTitle title="Offers for you" subtitle="Apply these at checkout" />
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {activeCoupons.map((c, i) => (
              <div
                key={c.id}
                className={cn(
                  "relative min-w-[260px] flex-1 overflow-hidden rounded-2xl p-5 text-white shadow-md",
                  ["bg-gradient-to-br from-blue-600 to-indigo-700", "bg-gradient-to-br from-orange-500 to-rose-600", "bg-gradient-to-br from-emerald-500 to-teal-700"][i % 3],
                )}
              >
                <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
                <p className="text-sm font-medium text-white/80">Flat</p>
                <p className="text-3xl font-extrabold">{c.discountPercentage}% OFF</p>
                <p className="mt-1 text-sm text-white/85">on unlock plans & listings</p>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(c.code);
                    toast({ title: "Code copied", description: `${c.code} is ready to paste at checkout.` });
                  }}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-dashed border-white/60 bg-white/10 px-3 py-1.5 text-sm font-bold tracking-wider hover:bg-white/20"
                >
                  {c.code} <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============================== FEATURED ============================== */}
      {featuredProperties.length > 0 && (
        <section className="container mx-auto mt-14 px-4 sm:px-6 lg:px-8">
          <SectionTitle
            title="Handpicked for you"
            subtitle="Verified PGs and homes our users love"
            action={<Button variant="ghost" className="text-primary" onClick={() => onNavigate("pg")}>View all <ArrowRight className="ml-1 h-4 w-4" /></Button>}
          />
          <Carousel opts={{ align: "start" }} className="w-full">
            <CarouselContent>
              {featuredProperties.map((listing) => (
                <CarouselItem key={listing.id} className="basis-[85%] sm:basis-1/2 lg:basis-1/3">
                  <div className="h-full p-1">
                    <PropertyCard
                      listing={listing}
                      onViewDetails={(item) => onViewDetails(item, "listing")}
                      isLiked={likedItemIds.has(listing.id)}
                      onToggleLike={() => onToggleLike(listing.id)}
                      isUnlocked={unlockedIds.has(listing.id)}
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden sm:flex" />
            <CarouselNext className="hidden sm:flex" />
          </Carousel>
        </section>
      )}

      {/* ============================== ROOMMATE MATCH PROMO ============================== */}
      <section className="container mx-auto mt-16 px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-10 sm:px-12 sm:py-14 text-white">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-orange-500/30 blur-3xl" />
          <div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-blue-600/40 blur-3xl" />
          <div className="relative grid items-center gap-10 md:grid-cols-2">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-3 py-1 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5" /> New
              </span>
              <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold leading-tight">
                Swipe to find a roommate <br className="hidden sm:block" />you'll actually get along with
              </h2>
              <p className="mt-4 max-w-md text-slate-300">
                Swipe right on people who fit your budget, area and lifestyle. If they accept, chat unlocks — numbers stay private until then.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button size="lg" className="h-12 rounded-full bg-orange-500 px-7 font-bold hover:bg-orange-600" onClick={() => onNavigate("roommates")}>
                  Start swiping <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
              <div className="mt-8 grid grid-cols-3 gap-4 text-center text-sm">
                {[["1", "Swipe right"], ["2", "They accept"], ["3", "Chat & move in"]].map(([n, t]) => (
                  <div key={n} className="rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                    <p className="text-xl font-extrabold text-orange-400">{n}</p>
                    <p className="text-slate-300">{t}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Card stack illustration */}
            <div className="relative mx-auto h-[340px] w-[250px] sm:h-[380px] sm:w-[280px]">
              <div className="absolute inset-0 translate-x-6 rotate-6 rounded-[28px] bg-gradient-to-br from-emerald-400 to-teal-600 opacity-70" />
              <div className="absolute inset-0 -translate-x-6 -rotate-6 rounded-[28px] bg-gradient-to-br from-sky-400 to-indigo-600 opacity-80" />
              <div className="absolute inset-0 animate-float-slow overflow-hidden rounded-[28px] bg-gradient-to-br from-orange-400 via-rose-500 to-pink-500 shadow-2xl">
                <div className="flex h-[65%] items-center justify-center text-7xl font-black text-white/90">R</div>
                <div className="absolute left-5 top-6 -rotate-12 rounded-lg border-4 border-emerald-300 px-3 text-2xl font-black text-emerald-300">LIKE</div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-5 pt-16">
                  <p className="text-2xl font-extrabold">Riya, 23</p>
                  <p className="text-sm text-white/80">UX Designer · Vashi</p>
                  <p className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-900">₹12,000/mo · 92% match</p>
                </div>
              </div>
              <div className="absolute -bottom-7 left-1/2 flex -translate-x-1/2 gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-rose-500 shadow-xl"><X className="h-7 w-7" strokeWidth={3} /></span>
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-emerald-500 shadow-xl"><Heart className="h-7 w-7 fill-current" /></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================== POPULAR CITIES ============================== */}
      <section className="container mx-auto mt-16 px-4 sm:px-6 lg:px-8">
        <SectionTitle title="Popular cities" subtitle="Explore stays where people are moving" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {POPULAR_CITIES.map((c) => (
            <button
              key={c.name}
              onClick={() => go("pg", { city: c.name })}
              className={cn(
                "group relative h-28 overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-left text-white shadow-md transition-all hover:-translate-y-1 hover:shadow-xl",
                c.tint,
              )}
            >
              <Building2 className="absolute -bottom-3 -right-3 h-20 w-20 text-white/15 transition-transform group-hover:scale-110" />
              <p className="text-lg font-extrabold">{c.name}</p>
              <p className="text-xs text-white/85">{cityCounts[c.name] ? `${cityCounts[c.name]} listings` : "Explore stays"}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ============================== WHY US ============================== */}
      <section className="container mx-auto mt-16 px-4 sm:px-6 lg:px-8">
        <SectionTitle title="Why SetMyStay" subtitle="Simple, safe and transparent — from search to move-in" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((t) => (
            <div key={t.title} className="rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">{t.icon}</div>
              <h3 className="mt-4 font-bold text-slate-900">{t.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================== OWNER CTA ============================== */}
      <section className="container mx-auto mt-16 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-gradient-to-r from-blue-700 to-indigo-600 p-8 text-white sm:flex-row sm:items-center sm:p-10">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold">Own a PG or flat?</h2>
            <p className="mt-2 text-blue-100">List it in 5 minutes and get enquiries from verified tenants.</p>
          </div>
          <Button size="lg" className="h-12 rounded-full bg-white px-7 font-bold text-blue-700 hover:bg-blue-50" onClick={() => onNavigate("list")}>
            <PlusCircle className="mr-2 h-5 w-5" /> List your property
          </Button>
        </div>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ pieces

function FieldBox({ label, icon, children, className }: { label: string; icon: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label
      className={cn(
        "block cursor-text rounded-2xl border bg-slate-50/60 px-4 py-3 transition-colors focus-within:border-primary focus-within:bg-white sm:rounded-none sm:border-r-0 sm:last:border-r",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {icon} {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function CategoryTile({ title, text, icon, tint, onClick, badge }: { title: string; text: string; icon: React.ReactNode; tint: string; onClick: () => void; badge?: string }) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-4 rounded-2xl border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
    >
      <span className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-md", tint)}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-lg font-bold text-slate-900">
          {title}
          {badge && <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold text-white">{badge}</span>}
        </span>
        <span className="block truncate text-sm text-muted-foreground">{text}</span>
      </span>
      <ArrowRight className="h-5 w-5 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-primary" />
    </button>
  );
}

function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
