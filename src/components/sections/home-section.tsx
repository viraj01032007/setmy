"use client";

import React, { useMemo, useState } from "react";
import type { Listing, RoommateProfile, Page, FilterState, Coupon } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Copy, Check, ShieldCheck, FileCheck2, PhoneCall, MessageCircle } from "lucide-react";
import { PropertyCard } from "@/components/shared/property-card";
import { AutocompleteInput } from "@/components/shared/autocomplete-input";
import { allIndianCities } from "@/lib/cities";
import { whatsappLink } from "@/lib/contact";
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

const TABS: { id: SearchTab; label: string }[] = [
  { id: "pg", label: "PG room" },
  { id: "rentals", label: "Whole flat" },
  { id: "roommates", label: "Flatmate" },
];

const BUDGETS = [
  { label: "Any budget", value: 100000 },
  { label: "Up to ₹8,000", value: 8000 },
  { label: "Up to ₹12,000", value: 12000 },
  { label: "Up to ₹20,000", value: 20000 },
  { label: "Up to ₹35,000", value: 35000 },
];

// Navi Mumbai nodes people actually search for, plus nearby cities
const AREAS = ["Vashi", "Nerul", "Seawoods", "CBD Belapur", "Kharghar", "Sanpada", "Airoli", "Ghansoli", "Kopar Khairane", "Panvel"];
const CITIES = ["Mumbai", "Thane", "Pune", "Bangalore"];

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
  const [city, setCity] = useState("Navi Mumbai");
  const [locality, setLocality] = useState("");
  const [budget, setBudget] = useState(100000);
  const [copied, setCopied] = useState<string | null>(null);
  const { toast } = useToast();

  const go = (page: Page, filters: Partial<FilterState> = {}) => (onSearch ? onSearch(page, filters) : onNavigate(page));
  const runSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    go(pageFor(tab), { city, locality, budget });
  };

  const counts = useMemo(() => {
    const pg = allListings.filter((l) => l.propertyType === "PG");
    const flats = allListings.filter((l) => l.propertyType === "Rental");
    const byArea: Record<string, number> = {};
    for (const l of allListings) {
      const hit = AREAS.find((a) => `${l.locality} ${l.partialAddress}`.toLowerCase().includes(a.toLowerCase()));
      if (hit) byArea[hit] = (byArea[hit] || 0) + 1;
    }
    const cheapestPg = pg.length ? Math.min(...pg.map((l) => l.rent).filter((r) => r > 0)) : null;
    return { pg: pg.length, flats: flats.length, byArea, cheapestPg };
  }, [allListings]);

  const coupon = coupons.find((c) => c.isActive);
  // Real photo from the newest approved listing (no stock skyline)
  const heroListing = allListings.find((l) => l.images?.[0] && !l.images[0].includes("placehold.co"));

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    setCopied(code);
    toast({ title: "Code copied", description: `Paste ${code} at checkout.` });
    window.setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="bg-white text-ink">
      {/* ---------------------------------------------------------------- hero */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 sm:pt-16 sm:pb-20">
        <div className="grid items-start gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <h1 className="font-display text-[2.6rem] leading-[1.02] font-extrabold tracking-[-0.02em] sm:text-6xl lg:text-[4.25rem]">
              Rooms, flats and flatmates across Navi Mumbai.
            </h1>
            <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-slate-600">
              Every listing is checked by our team before it goes live, and you deal with the owner directly.
              Many places here come without a broker.
            </p>

            {/* The to-let board: the one loud thing on the page */}
            <form
              onSubmit={runSearch}
              className="relative mt-9 max-w-xl -rotate-[0.6deg] rounded-md border-[3px] border-ink bg-tolet p-5 shadow-[6px_6px_0_0_#16181D] sm:p-6"
            >
              {/* screw heads */}
              {["left-2 top-2", "right-2 top-2", "left-2 bottom-2", "right-2 bottom-2"].map((pos) => (
                <span key={pos} aria-hidden className={cn("absolute h-2 w-2 rounded-full bg-ink/70", pos)} />
              ))}
              <p className="font-display text-5xl font-extrabold leading-none tracking-tight sm:text-6xl">TO-LET</p>

              <div role="tablist" aria-label="What are you looking for" className="mt-4 flex flex-wrap gap-2">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === t.id}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "rounded-full border-2 border-ink px-4 py-1.5 text-sm font-semibold transition-colors",
                      tab === t.id ? "bg-ink text-tolet" : "bg-transparent hover:bg-ink/10",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold">City</span>
                  <AutocompleteInput
                    placeholder="Navi Mumbai"
                    value={city}
                    onChange={setCity}
                    suggestions={allIndianCities}
                    className="mt-1 [&_input]:h-11 [&_input]:rounded-md [&_input]:border-2 [&_input]:border-ink [&_input]:bg-white [&_input]:text-base"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold">Area</span>
                  <input
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    placeholder="Vashi, Nerul…"
                    className="mt-1 h-11 w-full rounded-md border-2 border-ink bg-white px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold">Monthly budget</span>
                  <select
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="mt-1 h-11 w-full rounded-md border-2 border-ink bg-white px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
                  >
                    {BUDGETS.map((b) => (
                      <option key={b.value} value={b.value}>{b.label}</option>
                    ))}
                  </select>
                </label>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="h-11 w-full rounded-md bg-ink px-5 text-base font-semibold text-white transition-transform active:translate-y-px"
                  >
                    {tab === "roommates" ? "Find flatmates" : tab === "rentals" ? "Show flats" : "Show rooms"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {heroListing ? (
            <figure className="hidden lg:block">
              <button onClick={() => onViewDetails(heroListing, "listing")} className="block w-full text-left">
                <img
                  src={heroListing.images[0]}
                  alt={heroListing.title}
                  fetchPriority="high"
                  className="aspect-[4/5] w-full rounded-lg object-cover"
                />
              </button>
              <figcaption className="mt-3 text-sm text-slate-600">
                Just listed: <span className="font-semibold text-ink">{heroListing.title}</span>, {heroListing.locality}.
                {" "}₹{heroListing.rent.toLocaleString("en-IN")} a month.
              </figcaption>
            </figure>
          ) : (
            <aside className="hidden rounded-lg bg-concrete p-10 lg:block">
              <p className="font-display text-3xl font-bold leading-tight">
                Have a spare room in Vashi, Nerul or Kharghar?
              </p>
              <p className="mt-4 text-slate-600">
                Students and young professionals are looking right now. Add your place with photos and documents, and
                our team will put it live once it's checked.
              </p>
              <Button onClick={() => onNavigate("list")} className="mt-6 h-11 rounded-md px-5 font-semibold">
                List your property
              </Button>
            </aside>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- what you need */}
      <section className="border-y border-slate-200 bg-concrete">
        <div className="container mx-auto grid divide-y divide-slate-300 px-4 sm:px-6 lg:px-8 md:grid-cols-3 md:divide-x md:divide-y-0">
          <NeedLink
            title="PG and co-living"
            detail={counts.cheapestPg ? `${counts.pg} ${counts.pg === 1 ? "place" : "places"}, from ₹${counts.cheapestPg.toLocaleString("en-IN")} a month` : "Meals, Wi-Fi and housekeeping included in many"}
            onClick={() => onNavigate("pg")}
          />
          <NeedLink
            title="Flats for rent"
            detail={counts.flats ? `${counts.flats} ${counts.flats === 1 ? "flat" : "flats"} listed by owners and agents` : "1 to 4 BHK, furnished and unfurnished"}
            onClick={() => onNavigate("rentals")}
          />
          <NeedLink
            title="Find a flatmate"
            detail="Say yes to people you'd live with. Chat once they say yes too."
            onClick={() => onNavigate("roommates")}
          />
        </div>
      </section>

      {/* ---------------------------------------------------------------- areas */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight">Search by area</h2>
            <p className="mt-2 max-w-sm text-slate-600">Most of our listings are in Navi Mumbai. Pick a node to see what's free there.</p>
          </div>
          <div>
            <ul className="grid grid-cols-2 gap-x-8 sm:grid-cols-3">
              {AREAS.map((a) => (
                <li key={a} className="border-b border-slate-200">
                  <button
                    onClick={() => go("pg", { city: "Navi Mumbai", locality: a })}
                    className="flex w-full items-baseline justify-between py-3 text-left text-lg font-medium hover:text-primary"
                  >
                    {a}
                    <span className="text-sm text-slate-400">{counts.byArea[a] ?? ""}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-slate-600">
              Also in{" "}
              {CITIES.map((c, i) => (
                <React.Fragment key={c}>
                  <button onClick={() => go("pg", { city: c })} className="font-semibold text-ink underline decoration-tolet decoration-[3px] underline-offset-4 hover:decoration-ink">
                    {c}
                  </button>
                  {i < CITIES.length - 2 ? ", " : i === CITIES.length - 2 ? " and " : "."}
                </React.Fragment>
              ))}
            </p>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- recently approved */}
      {featuredProperties.length > 0 && (
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 pb-14 sm:pb-16">
          <div className="mb-6 flex items-end justify-between gap-4">
            <h2 className="font-display text-3xl font-bold tracking-tight">Recently approved</h2>
            <button onClick={() => onNavigate("pg")} className="text-sm font-semibold text-primary hover:underline">See all listings</button>
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

      {/* ---------------------------------------------------------------- flatmates */}
      <section className="bg-ink text-white">
        <div className="container mx-auto grid gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2 lg:px-8">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Need a flatmate, not just a room?</h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-slate-300">
              Look through people who are searching in the same area and budget as you. Their number stays private
              until you both agree to talk.
            </p>
            <Button
              onClick={() => onNavigate("roommates")}
              className="mt-7 h-12 rounded-md bg-tolet px-6 text-base font-semibold text-ink hover:bg-tolet/90"
            >
              Try Roommate Match
            </Button>
          </div>
          <ol className="space-y-6 self-center">
            {[
              ["Swipe right on people you'd live with", "Left to skip. Your match score is based on area, budget and habits."],
              ["They get a request", "If they had already liked you, you match straight away."],
              ["Chat, then visit flats together", "Phone numbers show up once you've matched."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span className="font-display text-3xl font-extrabold text-tolet">{i + 1}</span>
                <div>
                  <p className="text-lg font-semibold">{t}</p>
                  <p className="text-slate-400">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------------------- how we check */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <h2 className="font-display text-3xl font-bold tracking-tight">How we check a listing</h2>
          <div className="grid gap-8 sm:grid-cols-2">
            <Fact icon={<FileCheck2 className="h-5 w-5" />} title="Documents first">
              Owners upload ID and an electricity bill or society NOC when they list, so we can check who the place belongs to.
            </Fact>
            <Fact icon={<ShieldCheck className="h-5 w-5" />} title="A person approves it">
              Someone from our team reviews every listing before it appears on the site. Nothing goes live automatically.
            </Fact>
            <Fact icon={<PhoneCall className="h-5 w-5" />} title="You talk to the owner">
              Unlock a listing to get the owner's number and full address. Rent and deposit go to the owner, not to us.
            </Fact>
            <Fact icon={<MessageCircle className="h-5 w-5" />} title="Stuck? Message us">
              We're on{" "}
              <a href={whatsappLink()} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-2">
                WhatsApp
              </a>{" "}
              for questions about any listing.
            </Fact>
          </div>
        </div>

        {coupon && (
          <div className="mt-14 flex flex-col gap-3 rounded-md border-2 border-dashed border-slate-300 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-slate-700">
              First time here? Use <span className="font-semibold text-ink">{coupon.code}</span> for {coupon.discountPercentage}% off any unlock plan.
            </p>
            <button
              onClick={() => copyCode(coupon.code)}
              className="inline-flex items-center gap-2 self-start rounded-md border-2 border-ink px-4 py-2 text-sm font-semibold hover:bg-concrete"
            >
              {copied === coupon.code ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied === coupon.code ? "Copied" : "Copy code"}
            </button>
          </div>
        )}
      </section>

      {/* ---------------------------------------------------------------- owners */}
      <section className="border-t border-slate-200">
        <div className="container mx-auto flex flex-col gap-5 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">Have a room or flat to rent out?</h2>
            <p className="mt-1 text-slate-600">List it with photos and documents. We'll review it and put it live.</p>
          </div>
          <Button onClick={() => onNavigate("list")} className="h-12 rounded-md px-6 text-base font-semibold">
            List your property
          </Button>
        </div>
      </section>
    </div>
  );
}

function NeedLink({ title, detail, onClick }: { title: string; detail: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group py-6 text-left md:px-8 md:first:pl-0 md:last:pr-0">
      <span className="font-display text-xl font-bold group-hover:text-primary">{title}</span>
      <span className="mt-1 block text-sm text-slate-600">{detail}</span>
    </button>
  );
}

function Fact({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="flex items-center gap-2 font-semibold">
        <span className="text-primary">{icon}</span>
        {title}
      </p>
      <p className="mt-2 leading-relaxed text-slate-600">{children}</p>
    </div>
  );
}
