"use client";

import React, { useMemo, useState } from "react";
import type { Listing, RoommateProfile, Page, FilterState, Coupon } from "@/lib/types";
import {
  BedDouble, Building2, Users, PlusCircle, Search, MapPin, IndianRupee, ChevronDown, ShieldCheck, BadgePercent,
  Lock, Headphones, Copy, Check, ArrowRight, Heart, X,
} from "lucide-react";
import { PropertyCard } from "@/components/shared/property-card";
import { AutocompleteInput } from "@/components/shared/autocomplete-input";
import { allIndianCities } from "@/lib/cities";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

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

const img = (id: string, w = 800) => `https://images.unsplash.com/photo-${id}?w=${w}&q=70&auto=format&fit=crop`;
const PHOTOS = {
  pg: img("1555854877-bab0e564b8d5"),          // bunk beds
  room: img("1595526114035-0d45ed16cfbf"),     // bedroom
  flat: img("1502672260266-1c1ef2d93688"),     // living room with plants
  coliving: img("1536376072261-38c75010e6c9"), // shared open space
  flat2: img("1554995207-c18c203602cb"),
  flat3: img("1522708323590-d24dbb6b0267"),
  lounge: img("1493809842364-78817add7ffb"),
  bright: img("1560448204-e02f11c3d0e2"),
};

const TABS: { id: SearchTab | "list"; label: string; icon: React.ReactNode }[] = [
  { id: "pg", label: "PG / Hostel", icon: <BedDouble className="h-7 w-7" /> },
  { id: "rentals", label: "Flats", icon: <Building2 className="h-7 w-7" /> },
  { id: "roommates", label: "Roommates", icon: <Users className="h-7 w-7" /> },
  { id: "list", label: "List Property", icon: <PlusCircle className="h-7 w-7" /> },
];

// The radio row under the tabs (like MakeMyTrip's "One way / Round trip")
const OPTIONS: Record<SearchTab, { label: string; filters: Partial<FilterState> }[]> = {
  pg: [
    { label: "Any room", filters: { roomType: "any" } },
    { label: "Single room", filters: { roomType: "Single Room" } },
    { label: "Double sharing", filters: { roomType: "Double Sharing" } },
    { label: "Triple sharing", filters: { roomType: "Triple Sharing" } },
  ],
  rentals: [
    { label: "Any furnishing", filters: { furnishedStatus: "any" } },
    { label: "Furnished", filters: { furnishedStatus: "Furnished" } },
    { label: "Semi-furnished", filters: { furnishedStatus: "Semi-Furnished" } },
  ],
  roommates: [
    { label: "Anyone", filters: { gender: "any" } },
    { label: "Male", filters: { gender: "Male" } },
    { label: "Female", filters: { gender: "Female" } },
  ],
};

const BUDGETS = [
  { short: "Any", value: 100000 },
  { short: "₹8,000", value: 8000 },
  { short: "₹12,000", value: 12000 },
  { short: "₹20,000", value: 20000 },
  { short: "₹35,000", value: 35000 },
];

const QUICK: { label: string; page: Page; filters: Partial<FilterState> }[] = [
  { label: "PG with meals", page: "pg", filters: { amenities: ["Meals"] } },
  { label: "AC rooms", page: "pg", filters: { amenities: ["AC"] } },
  { label: "Wi-Fi included", page: "pg", filters: { amenities: ["WiFi"] } },
  { label: "Fully furnished flats", page: "rentals", filters: { furnishedStatus: "Furnished" } },
  { label: "Direct from owner", page: "rentals", filters: { brokerStatus: "Without Broker" } },
  { label: "Female flatmates", page: "roommates", filters: { gender: "Female" } },
];

const LOCALITIES = [
  { name: "Vashi", photo: PHOTOS.flat3 },
  { name: "Nerul", photo: PHOTOS.room },
  { name: "Kharghar", photo: PHOTOS.bright },
  { name: "CBD Belapur", photo: PHOTOS.flat2 },
  { name: "Seawoods", photo: PHOTOS.lounge },
  { name: "Airoli", photo: PHOTOS.flat },
];

const pageFor = (t: SearchTab): Page => (t === "roommates" ? "roommates" : t);
const small = (url: string, w: number) => url.replace("w=800", `w=${w}`);

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
  const [option, setOption] = useState(0);
  const [city, setCity] = useState("Navi Mumbai");
  const [locality, setLocality] = useState("");
  const [budget, setBudget] = useState(100000);
  const [copied, setCopied] = useState<string | null>(null);
  const { toast } = useToast();

  const go = (page: Page, filters: Partial<FilterState> = {}) => (onSearch ? onSearch(page, filters) : onNavigate(page));
  const runSearch = () => go(pageFor(tab), { city, locality, budget, ...OPTIONS[tab][option].filters });

  const counts = useMemo(() => {
    const byArea: Record<string, number> = {};
    for (const l of allListings) {
      const hit = LOCALITIES.find((a) => `${l.locality} ${l.partialAddress}`.toLowerCase().includes(a.name.toLowerCase()));
      if (hit) byArea[hit.name] = (byArea[hit.name] || 0) + 1;
    }
    const pgRents = allListings.filter((l) => l.propertyType === "PG" && l.rent > 0).map((l) => l.rent);
    const flatRents = allListings.filter((l) => l.propertyType === "Rental" && l.rent > 0).map((l) => l.rent);
    return {
      byArea,
      pgFrom: pgRents.length ? Math.min(...pgRents) : null,
      flatFrom: flatRents.length ? Math.min(...flatRents) : null,
    };
  }, [allListings]);

  const activeCoupons = coupons.filter((c) => c.isActive).slice(0, 2);

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopied(code);
    toast({ title: "Coupon copied", description: `Use ${code} at checkout.` });
    window.setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="pb-16">
      {/* ================================================================ HERO BAND + SEARCH */}
      <section className="relative">
        <div className="absolute inset-x-0 top-0 h-[300px] overflow-hidden bg-[#0a1a33] sm:h-[340px]">
          <img src={img("1560448204-e02f11c3d0e2", 1800)} alt="" className="h-full w-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a1a33]/60 to-[#0a1a33]" />
        </div>

        <div className="container relative mx-auto px-4 pt-8 sm:px-6 sm:pt-12 lg:px-8">
          <h1 className="text-center text-2xl font-extrabold text-white sm:text-4xl">Book verified PGs, flats &amp; flatmates</h1>
          <p className="mt-2 text-center text-sm text-blue-100 sm:text-base">Navi Mumbai · Mumbai · Thane · Pune · Bangalore</p>

          {/* Search card */}
          <div className="relative mx-auto mt-6 max-w-6xl rounded-2xl bg-white shadow-[0_8px_30px_rgba(0,0,0,0.15)]">
            <div className="mx-auto flex max-w-3xl justify-around gap-1 overflow-x-auto border-b px-2 pt-4 no-scrollbar sm:justify-center sm:gap-10">
              {TABS.map((t) => {
                const active = t.id === tab;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (t.id === "list") return onNavigate("list");
                      setTab(t.id);
                      setOption(0);
                    }}
                    className={cn(
                      "relative flex min-w-[72px] flex-col items-center gap-1 px-2 pb-3 text-xs font-semibold transition-colors sm:text-sm",
                      active ? "text-[#008cff]" : "text-slate-500 hover:text-[#008cff]",
                    )}
                  >
                    {t.icon}
                    {t.label}
                    {active && <span className="absolute inset-x-1 -bottom-px h-[3px] rounded-full bg-[#008cff]" />}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 px-5 pt-4 sm:px-8">
              {OPTIONS[tab].map((o, i) => (
                <label key={o.label} className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
                  <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border-2", i === option ? "border-[#008cff]" : "border-slate-400")}>
                    {i === option && <span className="h-2 w-2 rounded-full bg-[#008cff]" />}
                  </span>
                  <input type="radio" className="sr-only" checked={i === option} onChange={() => setOption(i)} name="search-option" />
                  {o.label}
                </label>
              ))}
            </div>

            <div className="grid gap-3 px-5 pb-12 pt-4 sm:px-8 md:grid-cols-[1.2fr_1.2fr_1fr] md:gap-0 md:pb-14">
              <Field label="City" icon={<MapPin className="h-3.5 w-3.5" />} className="md:rounded-l-xl">
                <AutocompleteInput
                  placeholder="Enter city"
                  value={city}
                  onChange={setCity}
                  suggestions={allIndianCities}
                  className="[&_input]:h-9 [&_input]:border-0 [&_input]:bg-transparent [&_input]:p-0 [&_input]:text-2xl [&_input]:font-extrabold [&_input]:text-slate-900 [&_input]:shadow-none [&_input]:focus-visible:ring-0"
                />
                <span className="text-xs text-slate-500">India</span>
              </Field>
              <Field label="Area / Locality">
                <input
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                  placeholder="Any area"
                  className="h-9 w-full bg-transparent text-2xl font-extrabold text-slate-900 outline-none placeholder:text-slate-300"
                />
                <span className="text-xs text-slate-500">e.g. Vashi, Nerul, Kharghar</span>
              </Field>
              <Field label="Budget" icon={<IndianRupee className="h-3.5 w-3.5" />} className="md:rounded-r-xl">
                <div className="relative">
                  <select
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="h-9 w-full cursor-pointer appearance-none bg-transparent pr-6 text-2xl font-extrabold text-slate-900 outline-none"
                    aria-label="Monthly budget"
                  >
                    {BUDGETS.map((b) => (
                      <option key={b.value} value={b.value}>{b.short}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-0 top-2 h-5 w-5 text-[#008cff]" />
                </div>
                <span className="text-xs text-slate-500">{budget === 100000 ? "per month, no limit" : "or less per month"}</span>
              </Field>
            </div>

            <div className="absolute inset-x-0 -bottom-7 flex justify-center">
              <button
                onClick={runSearch}
                className="flex h-14 items-center gap-2 rounded-full bg-gradient-to-r from-[#53b2fe] to-[#065af3] px-14 text-xl font-extrabold uppercase tracking-wide text-white shadow-lg shadow-blue-600/30 transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <Search className="h-5 w-5" strokeWidth={3} /> Search
              </button>
            </div>
          </div>

          <div className="mx-auto mt-12 flex max-w-6xl gap-2 overflow-x-auto pb-1 no-scrollbar sm:flex-wrap sm:justify-center">
            {QUICK.map((q) => (
              <button
                key={q.label}
                onClick={() => go(q.page, q.filters)}
                className="shrink-0 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-[#008cff] hover:text-[#008cff]"
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================ OFFERS */}
      <section className="container mx-auto mt-12 px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-7">
          <h2 className="mb-5 text-2xl font-extrabold text-slate-900 sm:text-3xl">Offers</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {activeCoupons.map((c, i) => (
              <OfferCard
                key={c.id}
                photo={[PHOTOS.room, PHOTOS.flat][i % 2]}
                tag="Unlock plans"
                title={`Flat ${c.discountPercentage}% off owner contact unlocks`}
                text="Get owner phone numbers and full addresses for less."
                action={
                  <button onClick={() => copyCode(c.code)} className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[#008cff] px-3 py-1 text-xs font-bold tracking-wide text-[#008cff]">
                    {copied === c.code ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {c.code}
                  </button>
                }
              />
            ))}
            <OfferCard
              photo={PHOTOS.lounge}
              tag="Roommate Match"
              title="15 free swipes every day"
              text="Find a flatmate in your area and budget. Chat once you both say yes."
              action={<button onClick={() => onNavigate("roommates")} className="text-sm font-extrabold text-[#008cff]">TRY NOW</button>}
            />
            {activeCoupons.length < 2 && (
              <OfferCard
                photo={PHOTOS.flat2}
                tag="For owners"
                title="List your PG or flat"
                text="Add photos and documents. It goes live after our team checks it."
                action={<button onClick={() => onNavigate("list")} className="text-sm font-extrabold text-[#008cff]">LIST NOW</button>}
              />
            )}
          </div>
        </div>
      </section>

      {/* ================================================================ STAY TYPES */}
      <section className="container mx-auto mt-10 px-4 sm:px-6 lg:px-8">
        <h2 className="mb-5 text-2xl font-extrabold text-slate-900 sm:text-3xl">Explore stays</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <PhotoTile photo={PHOTOS.pg} title="PG & Hostels" sub={counts.pgFrom ? `From ₹${counts.pgFrom.toLocaleString("en-IN")}/month` : "Meals & Wi-Fi included"} onClick={() => onNavigate("pg")} />
          <PhotoTile photo={PHOTOS.room} title="Single rooms" sub="Private room, shared home" onClick={() => go("pg", { roomType: "Single Room" })} />
          <PhotoTile photo={PHOTOS.flat} title="Flats for rent" sub={counts.flatFrom ? `From ₹${counts.flatFrom.toLocaleString("en-IN")}/month` : "1 to 4 BHK"} onClick={() => onNavigate("rentals")} />
          <PhotoTile photo={PHOTOS.coliving} title="Find flatmates" sub="Swipe, match & chat" onClick={() => onNavigate("roommates")} />
        </div>
      </section>

      {/* ================================================================ FEATURED */}
      {featuredProperties.length > 0 && (
        <section className="container mx-auto mt-12 px-4 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-end justify-between">
            <h2 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">Handpicked for you</h2>
            <button onClick={() => onNavigate("pg")} className="flex items-center gap-1 text-sm font-bold text-[#008cff]">
              VIEW ALL <ArrowRight className="h-4 w-4" />
            </button>
          </div>
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

      {/* ================================================================ LOCALITIES */}
      <section className="container mx-auto mt-12 px-4 sm:px-6 lg:px-8">
        <h2 className="mb-5 text-2xl font-extrabold text-slate-900 sm:text-3xl">Popular localities in Navi Mumbai</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {LOCALITIES.map((l) => (
            <button key={l.name} onClick={() => go("pg", { city: "Navi Mumbai", locality: l.name })} className="group text-left">
              <div className="aspect-square overflow-hidden rounded-2xl">
                <img src={small(l.photo, 400)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              </div>
              <p className="mt-2 font-bold text-slate-900">{l.name}</p>
              <p className="text-xs text-slate-500">{counts.byArea[l.name] ? `${counts.byArea[l.name]} listings` : "PGs & flats"}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ================================================================ ROOMMATE BANNER */}
      <section className="container mx-auto mt-12 px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#ff6d38] to-[#ff2d55] text-white">
          <div className="grid items-center md:grid-cols-[1.3fr_1fr]">
            <div className="p-7 sm:p-10">
              <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold">NEW ON SETMYSTAY</span>
              <h2 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">Roommate Match</h2>
              <p className="mt-2 max-w-md text-white/90">
                Swipe right on people you'd share a flat with. If they say yes too, chat opens and you can plan visits together.
              </p>
              <button onClick={() => onNavigate("roommates")} className="mt-6 rounded-full bg-white px-7 py-3 text-sm font-extrabold text-[#ff2d55] shadow-md transition-transform hover:scale-[1.03]">
                START SWIPING
              </button>
            </div>
            <div className="relative hidden h-full min-h-[260px] md:block">
              <img src={PHOTOS.coliving} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#ff2d55] to-transparent" />
              <div className="absolute bottom-6 right-8 flex gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-rose-500 shadow-lg"><X className="h-6 w-6" strokeWidth={3} /></span>
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-emerald-500 shadow-lg"><Heart className="h-6 w-6 fill-current" /></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================ WHY US */}
      <section className="container mx-auto mt-12 px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 rounded-2xl bg-white p-6 shadow-sm sm:grid-cols-2 sm:p-8 lg:grid-cols-4">
          <Why icon={<ShieldCheck className="h-7 w-7" />} title="Verified listings" text="Checked by our team with owner documents before going live." />
          <Why icon={<BadgePercent className="h-7 w-7" />} title="Zero-brokerage options" text="Filter for homes listed directly by owners." />
          <Why icon={<Lock className="h-7 w-7" />} title="Private until you match" text="Roommate numbers are shown only after both say yes." />
          <Why icon={<Headphones className="h-7 w-7" />} title="Help on WhatsApp" text="Questions about a listing? Message our team." />
        </div>
      </section>

      {/* ================================================================ OWNER BANNER */}
      <section className="container mx-auto mt-12 px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl bg-[#0a1a33] text-white">
          <img src={PHOTOS.flat3} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
          <div className="relative flex flex-col items-start gap-5 p-8 sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <div>
              <h2 className="text-2xl font-extrabold sm:text-3xl">Own a PG or flat?</h2>
              <p className="mt-1 text-blue-100">List it in a few minutes and get enquiries from tenants.</p>
            </div>
            <button onClick={() => onNavigate("list")} className="rounded-full bg-gradient-to-r from-[#53b2fe] to-[#065af3] px-8 py-3 font-extrabold uppercase tracking-wide shadow-lg">
              List property
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------ pieces

function Field({ label, icon, children, className }: { label: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block cursor-text rounded-xl border border-slate-200 px-4 py-3 transition-colors hover:bg-[#eaf5ff] focus-within:border-[#008cff] focus-within:bg-[#eaf5ff] md:rounded-none md:border-r-0 md:last:border-r", className)}>
      <span className="flex items-center gap-1 text-sm font-medium text-slate-500">{icon}{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function OfferCard({ photo, tag, title, text, action }: { photo: string; tag: string; title: string; text: string; action: React.ReactNode }) {
  return (
    <div className="flex gap-4 rounded-xl border border-slate-100 p-3 shadow-[0_2px_12px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)]">
      <img src={small(photo, 300)} alt="" loading="lazy" className="h-28 w-28 shrink-0 rounded-lg object-cover" />
      <div className="flex min-w-0 flex-col">
        <span className="text-xs font-semibold text-slate-500">{tag}</span>
        <p className="mt-0.5 font-extrabold leading-snug text-slate-900">{title}</p>
        <p className="mt-1 line-clamp-2 text-xs text-slate-500">{text}</p>
        <div className="mt-auto pt-2">{action}</div>
      </div>
    </div>
  );
}

function PhotoTile({ photo, title, sub, onClick }: { photo: string; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group relative aspect-[4/5] overflow-hidden rounded-2xl text-left sm:aspect-[4/3]">
      <img src={photo} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-4 text-white">
        <p className="text-lg font-extrabold">{title}</p>
        <p className="text-sm text-white/85">{sub}</p>
      </div>
    </button>
  );
}

function Why({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-4">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#eaf5ff] text-[#008cff]">{icon}</span>
      <div>
        <p className="font-bold text-slate-900">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{text}</p>
      </div>
    </div>
  );
}
