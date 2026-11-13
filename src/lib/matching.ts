/**
 * SetMyStay — Roommate Matching (Tinder-style swipe)
 * ------------------------------------------------------------------
 * Flow:
 *   1. User swipes LEFT (skip) or RIGHT (interested) on roommate cards.
 *   2. A RIGHT swipe sends a "roommate request" to the other user.
 *      If the other user had already swiped right on you → instant match.
 *   3. The other user sees the request in "Requests" and can Accept / Decline.
 *   4. On Accept → both become a "match" → chat unlocks + phone number visible.
 *   5. Swipes per day are limited by the user's plan (Free / Basic / Premium).
 *
 * Two modes:
 *   - "api"  : talks to the Django backend (endpoints documented in BACKEND_MATCHING_API.md)
 *   - "demo" : everything stored in localStorage so the client can try the full
 *              flow before the backend is ready (sample profiles are clearly badged).
 *
 * Mode is chosen by VITE_MATCHING_MODE = "api" | "demo" | "auto" (default "auto").
 * In "auto" we ping GET /roommates/quota/ once — if it answers, we use the API.
 */
import api from "./api";
import type { RoommateProfile } from "./types";

// ------------------------------------------------------------------ types

export type PlanId = "free" | "basic" | "premium";

export interface RoommatePlan {
  id: PlanId;
  name: string;
  price: number; // ₹ per month
  dailySwipes: number | null; // null = unlimited
  features: string[];
  highlight?: boolean;
}

export interface SwipeProfile {
  id: string;
  userId: string;
  name: string;
  age?: number;
  gender?: string;
  occupation?: string;
  city: string;
  locality: string;
  budget: number;
  moveIn?: string;
  bio: string;
  tags: string[];
  images: string[];
  hasProperty?: boolean;
  phone?: string; // only revealed after a match
  isSample?: boolean;
  verified?: boolean;
}

export type SwipeDirection = "left" | "right";

export interface SwipeResult {
  status: "skipped" | "requested" | "matched" | "limit_reached";
  match?: Match;
  quota: Quota;
}

export interface MatchRequest {
  id: string;
  profile: SwipeProfile;
  createdAt: string;
  status: "pending" | "accepted" | "declined";
}

export interface Match {
  id: string;
  profile: SwipeProfile;
  createdAt: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unread?: number;
}

export interface ChatMessage {
  id: string;
  matchId: string;
  from: "me" | "them";
  text: string;
  at: string;
}

export interface Quota {
  plan: PlanId;
  planExpiresAt?: string | null;
  used: number;
  limit: number | null; // null = unlimited
  resetsAt: string; // ISO time of next midnight
}

export interface MyPreferences {
  city: string;
  maxBudget: number;
  gender: "any" | "Male" | "Female";
  tags: string[];
}

// ------------------------------------------------------------------ constants

export const ROOMMATE_PLANS: RoommatePlan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    dailySwipes: 15,
    features: ["15 swipes every day", "Accept incoming requests", "Chat with up to 3 matches"],
  },
  {
    id: "basic",
    name: "Basic",
    price: 99,
    dailySwipes: 60,
    highlight: true,
    features: ["60 swipes every day", "Unlimited chats", "See who liked you", "Priority in search"],
  },
  {
    id: "premium",
    name: "Premium",
    price: 249,
    dailySwipes: null,
    features: ["Unlimited swipes", "Unlimited chats", "See who liked you", "Profile boost + Verified badge", "Undo last swipe"],
  },
];

export const LIFESTYLE_TAGS = [
  "Non-Smoker",
  "Vegetarian",
  "Non-Vegetarian",
  "Early Riser",
  "Night Owl",
  "Work From Home",
  "Pet-Friendly",
  "Clean & Tidy",
  "Fitness",
  "Gamer",
  "Student",
  "Working Professional",
];

export const FREE_CHAT_LIMIT = 3;

export const planById = (id: PlanId) => ROOMMATE_PLANS.find((p) => p.id === id) ?? ROOMMATE_PLANS[0];

// ------------------------------------------------------------------ helpers

const todayKey = () => new Date().toISOString().slice(0, 10);
const nextMidnight = () => {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.toISOString();
};
const uid = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

const isBrowser = () => typeof window !== "undefined";

/** Turns an existing RoommateProfile (from the listings API) into a swipe card. */
export function toSwipeProfile(r: RoommateProfile): SwipeProfile {
  const images = (r.images || []).filter((src) => src && !src.includes("placehold.co"));
  return {
    id: r.id,
    userId: r.ownerId,
    name: r.ownerName,
    age: r.age,
    gender: r.gender && r.gender !== "Any" ? r.gender : undefined,
    city: r.city,
    locality: r.locality,
    budget: r.rent,
    bio: r.description,
    tags: Array.isArray(r.preferences) ? r.preferences : [],
    images,
    hasProperty: r.hasProperty,
    phone: r.contactPhonePrimary && r.contactPhonePrimary !== "Hidden" ? r.contactPhonePrimary : undefined,
    verified: r.status === "approved",
  };
}

/** 0–100 score: same city, budget overlap, shared lifestyle tags. */
export function compatibility(profile: SwipeProfile, prefs: MyPreferences): number {
  let score = 40;
  if (prefs.city) {
    if (profile.city?.toLowerCase().includes(prefs.city.toLowerCase())) score += 20;
  } else {
    score += 10;
  }
  if (profile.budget <= prefs.maxBudget) {
    // closer to the user's budget = more similar lifestyle spend
    score += 10 + Math.round((profile.budget / Math.max(prefs.maxBudget, 1)) * 8);
  } else if (profile.budget <= prefs.maxBudget * 1.2) score += 7;
  if (prefs.tags.length) {
    const shared = profile.tags.filter((t) => prefs.tags.includes(t)).length;
    score += Math.round((shared / prefs.tags.length) * 25);
  } else {
    // no lifestyle chosen yet → reward complete, detailed profiles
    score += Math.min(14, profile.tags.length * 3) + (profile.bio ? 3 : 0) + (profile.verified ? 4 : 0);
  }
  return Math.max(35, Math.min(99, score));
}

// ------------------------------------------------------------------ preferences (always local)

const PREFS_KEY = "setmystay_roommate_prefs";
export const defaultPrefs: MyPreferences = { city: "", maxBudget: 30000, gender: "any", tags: [] };

export function loadPrefs(): MyPreferences {
  if (!isBrowser()) return defaultPrefs;
  try {
    return { ...defaultPrefs, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
  } catch {
    return defaultPrefs;
  }
}
export function savePrefs(p: MyPreferences) {
  if (isBrowser()) localStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

// ------------------------------------------------------------------ mode detection

type Mode = "api" | "demo";
let resolvedMode: Mode | null = null;

export async function getMode(): Promise<Mode> {
  if (resolvedMode) return resolvedMode;
  const env = (import.meta.env.VITE_MATCHING_MODE as string | undefined)?.toLowerCase();
  if (env === "api" || env === "demo") {
    resolvedMode = env;
    return env;
  }
  try {
    await api.get("/roommates/quota/", { timeout: 4000 });
    resolvedMode = "api";
  } catch (err: any) {
    // 401 means the endpoint exists but the user is logged out → backend is there
    resolvedMode = err?.response?.status === 401 ? "api" : "demo";
  }
  return resolvedMode;
}

// ------------------------------------------------------------------ demo store (localStorage)

const DEMO_KEY = "setmystay_matching_demo_v1";

interface DemoState {
  plan: PlanId;
  planExpiresAt: string | null;
  swipesByDay: Record<string, number>;
  swiped: Record<string, SwipeDirection>;
  sent: MatchRequest[];
  received: MatchRequest[];
  matches: Match[];
  messages: Record<string, ChatMessage[]>;
  seeded: boolean;
}

const emptyDemo = (): DemoState => ({
  plan: "free",
  planExpiresAt: null,
  swipesByDay: {},
  swiped: {},
  sent: [],
  received: [],
  matches: [],
  messages: {},
  seeded: false,
});

function readDemo(): DemoState {
  if (!isBrowser()) return emptyDemo();
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    const state: DemoState = raw ? { ...emptyDemo(), ...JSON.parse(raw) } : emptyDemo();
    if (!state.seeded) {
      // Two sample people already sent you a request, so the "Requests" tab is never empty in a demo.
      state.received = SAMPLE_PROFILES.filter((p) => p.id === "sample_ananya" || p.id === "sample_karan").map((p, i) => ({
        id: uid("req"),
        profile: p,
        createdAt: new Date(Date.now() - (i + 1) * 3600_000).toISOString(),
        status: "pending" as const,
      }));
      state.seeded = true;
      writeDemo(state);
    }
    if (state.planExpiresAt && new Date(state.planExpiresAt) < new Date()) {
      state.plan = "free";
      state.planExpiresAt = null;
    }
    return state;
  } catch {
    return emptyDemo();
  }
}
function writeDemo(s: DemoState) {
  if (isBrowser()) localStorage.setItem(DEMO_KEY, JSON.stringify(s));
}

function demoQuota(s: DemoState): Quota {
  const plan = planById(s.plan);
  return {
    plan: s.plan,
    planExpiresAt: s.planExpiresAt,
    used: s.swipesByDay[todayKey()] || 0,
    limit: plan.dailySwipes,
    resetsAt: nextMidnight(),
  };
}

function createMatch(s: DemoState, profile: SwipeProfile): Match {
  const match: Match = {
    id: uid("match"),
    profile,
    createdAt: new Date().toISOString(),
    lastMessage: "You matched! Say hi 👋",
    lastMessageAt: new Date().toISOString(),
    unread: 0,
  };
  s.matches = [match, ...s.matches.filter((m) => m.profile.id !== profile.id)];
  s.messages[match.id] = [];
  return match;
}

const DEMO_REPLIES = [
  "Hey! Nice to match with you 😊",
  "Which area are you looking in exactly?",
  "My budget is flexible by a couple of thousand. When are you planning to move?",
  "Sounds good! Want to visit a few places together this weekend?",
  "Cool, I'll share a few listings I found on SetMyStay.",
];

// ------------------------------------------------------------------ public API

export async function fetchDeck(realRoommates: RoommateProfile[]): Promise<SwipeProfile[]> {
  const mode = await getMode();
  if (mode === "api") {
    const { data } = await api.get("/roommates/deck/");
    const raw = data.results ?? data;
    return raw.map(adaptApiProfile);
  }
  const s = readDemo();
  const handled = new Set([
    ...Object.keys(s.swiped),
    ...s.matches.map((m) => m.profile.id),
    ...s.received.map((r) => r.profile.id),
  ]);
  const real = realRoommates.map(toSwipeProfile);
  return [...real, ...SAMPLE_PROFILES].filter((p) => !handled.has(p.id));
}

export async function fetchQuota(): Promise<Quota> {
  const mode = await getMode();
  if (mode === "api") {
    const { data } = await api.get("/roommates/quota/");
    return adaptApiQuota(data);
  }
  return demoQuota(readDemo());
}

export async function swipe(profile: SwipeProfile, direction: SwipeDirection): Promise<SwipeResult> {
  const mode = await getMode();
  if (mode === "api") {
    try {
      const { data } = await api.post("/roommates/swipe/", { target_id: profile.id, direction });
      return {
        status: data.status,
        match: data.match ? adaptApiMatch(data.match) : undefined,
        quota: adaptApiQuota(data.quota),
      };
    } catch (err: any) {
      if (err?.response?.status === 429) {
        return { status: "limit_reached", quota: adaptApiQuota(err.response.data.quota ?? err.response.data) };
      }
      throw err;
    }
  }

  const s = readDemo();
  const q = demoQuota(s);
  if (q.limit !== null && q.used >= q.limit) return { status: "limit_reached", quota: q };

  s.swipesByDay[todayKey()] = q.used + 1;
  s.swiped[profile.id] = direction;

  let result: SwipeResult["status"] = "skipped";
  let match: Match | undefined;
  if (direction === "right") {
    if (profile.isSample && SAMPLE_LIKES_YOU.has(profile.id)) {
      match = createMatch(s, profile);
      result = "matched";
    } else {
      s.sent = [
        { id: uid("req"), profile, createdAt: new Date().toISOString(), status: "pending" },
        ...s.sent,
      ];
      result = "requested";
    }
  }
  writeDemo(s);
  return { status: result, match, quota: demoQuota(s) };
}

/** Premium "undo last swipe". Demo mode only removes the local record. */
export async function undoSwipe(profileId: string): Promise<Quota> {
  const mode = await getMode();
  if (mode === "api") {
    const { data } = await api.post("/roommates/swipe/undo/", { target_id: profileId });
    return adaptApiQuota(data.quota ?? data);
  }
  const s = readDemo();
  delete s.swiped[profileId];
  s.sent = s.sent.filter((r) => r.profile.id !== profileId);
  writeDemo(s);
  return demoQuota(s);
}

export async function fetchRequests(): Promise<{ received: MatchRequest[]; sent: MatchRequest[] }> {
  const mode = await getMode();
  if (mode === "api") {
    const [rec, sent] = await Promise.all([
      api.get("/roommates/requests/", { params: { box: "received" } }),
      api.get("/roommates/requests/", { params: { box: "sent" } }),
    ]);
    return {
      received: (rec.data.results ?? rec.data).map(adaptApiRequest),
      sent: (sent.data.results ?? sent.data).map(adaptApiRequest),
    };
  }
  const s = readDemo();
  return {
    received: s.received.filter((r) => r.status === "pending"),
    sent: s.sent,
  };
}

export async function respondToRequest(requestId: string, accept: boolean): Promise<Match | null> {
  const mode = await getMode();
  if (mode === "api") {
    const { data } = await api.post(`/roommates/requests/${requestId}/${accept ? "accept" : "decline"}/`);
    return data.match ? adaptApiMatch(data.match) : null;
  }
  const s = readDemo();
  const req = s.received.find((r) => r.id === requestId);
  if (!req) return null;
  req.status = accept ? "accepted" : "declined";
  s.swiped[req.profile.id] = accept ? "right" : "left";
  const match = accept ? createMatch(s, req.profile) : null;
  writeDemo(s);
  return match;
}

export async function fetchMatches(): Promise<Match[]> {
  const mode = await getMode();
  if (mode === "api") {
    const { data } = await api.get("/roommates/matches/");
    return (data.results ?? data).map(adaptApiMatch);
  }
  return readDemo().matches;
}

export async function fetchMessages(matchId: string): Promise<ChatMessage[]> {
  const mode = await getMode();
  if (mode === "api") {
    const { data } = await api.get(`/roommates/matches/${matchId}/messages/`);
    return (data.results ?? data).map((m: any) => adaptApiMessage(m, matchId));
  }
  const s = readDemo();
  const m = s.matches.find((x) => x.id === matchId);
  if (m && m.unread) {
    m.unread = 0;
    writeDemo(s);
  }
  return s.messages[matchId] ?? [];
}

export async function sendMessage(matchId: string, text: string): Promise<ChatMessage> {
  const mode = await getMode();
  if (mode === "api") {
    const { data } = await api.post(`/roommates/matches/${matchId}/messages/`, { text });
    return adaptApiMessage(data, matchId);
  }
  const s = readDemo();
  const msg: ChatMessage = { id: uid("msg"), matchId, from: "me", text, at: new Date().toISOString() };
  s.messages[matchId] = [...(s.messages[matchId] ?? []), msg];
  const m = s.matches.find((x) => x.id === matchId);
  if (m) {
    m.lastMessage = text;
    m.lastMessageAt = msg.at;
  }
  writeDemo(s);
  return msg;
}

/** Demo only: the other side "types" a reply a moment later so the chat feels alive. */
export function demoAutoReply(matchId: string): ChatMessage | null {
  const s = readDemo();
  const thread = s.messages[matchId] ?? [];
  const theirCount = thread.filter((m) => m.from === "them").length;
  const text = DEMO_REPLIES[theirCount % DEMO_REPLIES.length];
  const msg: ChatMessage = { id: uid("msg"), matchId, from: "them", text, at: new Date().toISOString() };
  s.messages[matchId] = [...thread, msg];
  const m = s.matches.find((x) => x.id === matchId);
  if (m) {
    m.lastMessage = text;
    m.lastMessageAt = msg.at;
  }
  writeDemo(s);
  return msg;
}

/**
 * Demo only: a sample person "accepts" your request a few seconds later,
 * so the client can see the request → accept → chat flow end to end.
 */
export function demoSimulateAccept(profileId: string): Match | null {
  const s = readDemo();
  const req = s.sent.find((r) => r.profile.id === profileId && r.status === "pending");
  if (!req || !req.profile.isSample) return null;
  req.status = "accepted";
  const match = createMatch(s, req.profile);
  writeDemo(s);
  return match;
}

export async function isDemoMode() {
  return (await getMode()) === "demo";
}

/**
 * Called after Razorpay payment succeeds. In API mode the backend must verify
 * the Razorpay signature before upgrading — never trust the browser.
 */
export async function activatePlan(
  plan: PlanId,
  payment: { razorpay_payment_id?: string; razorpay_order_id?: string; razorpay_signature?: string },
): Promise<Quota> {
  const mode = await getMode();
  if (mode === "api") {
    const { data } = await api.post("/roommates/plan/activate/", { plan, ...payment });
    return adaptApiQuota(data.quota ?? data);
  }
  const s = readDemo();
  s.plan = plan;
  const exp = new Date();
  exp.setMonth(exp.getMonth() + 1);
  s.planExpiresAt = exp.toISOString();
  writeDemo(s);
  return demoQuota(s);
}

/** Total badge count for the header / bottom nav. */
export async function fetchNotificationCount(): Promise<number> {
  try {
    const [{ received }, matches] = await Promise.all([fetchRequests(), fetchMatches()]);
    return received.length + matches.reduce((n, m) => n + (m.unread ?? 0), 0);
  } catch {
    return 0;
  }
}

// ------------------------------------------------------------------ API adapters (snake_case → camelCase)

function adaptApiProfile(d: any): SwipeProfile {
  return {
    id: String(d.id),
    userId: String(d.user_id ?? d.user ?? d.id),
    name: d.name ?? d.user_name ?? "User",
    age: d.age ?? undefined,
    gender: d.gender ?? undefined,
    occupation: d.occupation ?? undefined,
    city: d.city ?? d.location_preference ?? "",
    locality: d.locality ?? d.area ?? d.location_preference ?? "",
    budget: Number(d.budget ?? 0),
    moveIn: d.move_in_date ?? undefined,
    bio: d.bio ?? d.description ?? "",
    tags: d.tags ?? d.lifestyle_tags ?? [],
    images: d.photos ?? d.images ?? [],
    hasProperty: !!d.has_property,
    phone: d.phone ?? undefined,
    verified: !!d.verified,
  };
}
function adaptApiQuota(d: any): Quota {
  return {
    plan: (d?.plan ?? "free") as PlanId,
    planExpiresAt: d?.plan_expires_at ?? null,
    used: d?.used ?? 0,
    limit: d?.limit ?? null,
    resetsAt: d?.resets_at ?? nextMidnight(),
  };
}
function adaptApiMatch(d: any): Match {
  return {
    id: String(d.id),
    profile: adaptApiProfile(d.profile ?? d.other_user ?? {}),
    createdAt: d.created_at,
    lastMessage: d.last_message ?? undefined,
    lastMessageAt: d.last_message_at ?? undefined,
    unread: d.unread ?? 0,
  };
}
function adaptApiRequest(d: any): MatchRequest {
  return {
    id: String(d.id),
    profile: adaptApiProfile(d.profile ?? d.other_user ?? {}),
    createdAt: d.created_at,
    status: (d.status ?? "pending").toLowerCase(),
  };
}
function adaptApiMessage(d: any, matchId: string): ChatMessage {
  return {
    id: String(d.id),
    matchId,
    from: d.is_mine ? "me" : "them",
    text: d.text,
    at: d.created_at,
  };
}

// ------------------------------------------------------------------ sample profiles (demo mode only)
// Shown with a "Sample" badge so nobody mistakes them for real users.
// Remove or set VITE_MATCHING_MODE=api once the backend is live.

const SAMPLE_LIKES_YOU = new Set(["sample_riya", "sample_aditya", "sample_meera"]);

export const SAMPLE_PROFILES: SwipeProfile[] = [
  { id: "sample_riya", userId: "s1", name: "Riya", age: 23, gender: "Female", occupation: "UX Designer", city: "Navi Mumbai", locality: "Vashi", budget: 12000, moveIn: "Dec 2026", bio: "Designer at a startup in Vashi. Love plants, chai and quiet weekdays. Looking for a tidy flatmate.", tags: ["Vegetarian", "Non-Smoker", "Clean & Tidy", "Working Professional"], images: [], isSample: true, verified: true },
  { id: "sample_aditya", userId: "s2", name: "Aditya", age: 21, gender: "Male", occupation: "Engineering Student", city: "Navi Mumbai", locality: "Nerul", budget: 8000, moveIn: "Immediately", bio: "Final year B.E. near Nerul station. Into cricket and coding. Need a roommate who's chill about late study nights.", tags: ["Student", "Night Owl", "Gamer", "Non-Smoker"], images: [], isSample: true },
  { id: "sample_ananya", userId: "s3", name: "Ananya", age: 25, gender: "Female", occupation: "Data Analyst", city: "Mumbai", locality: "Andheri East", budget: 18000, moveIn: "Jan 2027", bio: "Hybrid job, 3 days in office. Gym in the morning, Netflix at night. Have a 2BHK, looking for one flatmate.", tags: ["Early Riser", "Fitness", "Working Professional", "Pet-Friendly"], images: [], isSample: true, hasProperty: true, verified: true },
  { id: "sample_karan", userId: "s4", name: "Karan", age: 24, gender: "Male", occupation: "Software Engineer", city: "Pune", locality: "Hinjewadi", budget: 14000, moveIn: "Dec 2026", bio: "Work from home most days, so I like a calm space. Weekend treks are a must!", tags: ["Work From Home", "Non-Smoker", "Fitness", "Non-Vegetarian"], images: [], isSample: true },
  { id: "sample_meera", userId: "s5", name: "Meera", age: 22, gender: "Female", occupation: "MBA Student", city: "Navi Mumbai", locality: "Kharghar", budget: 10000, moveIn: "Immediately", bio: "Studying near Kharghar. Early riser, cook basic food, and keep the place clean.", tags: ["Student", "Early Riser", "Vegetarian", "Clean & Tidy"], images: [], isSample: true },
  { id: "sample_rahul", userId: "s6", name: "Rahul", age: 27, gender: "Male", occupation: "Sales Manager", city: "Mumbai", locality: "Powai", budget: 20000, moveIn: "Feb 2027", bio: "Travel for work twice a month. Easy-going, love cooking on Sundays.", tags: ["Working Professional", "Non-Vegetarian", "Pet-Friendly"], images: [], isSample: true, hasProperty: true },
  { id: "sample_sneha", userId: "s7", name: "Sneha", age: 26, gender: "Female", occupation: "Doctor (Resident)", city: "Navi Mumbai", locality: "CBD Belapur", budget: 15000, moveIn: "Jan 2027", bio: "Long shifts at the hospital, so I need a peaceful, respectful flatmate.", tags: ["Non-Smoker", "Clean & Tidy", "Vegetarian"], images: [], isSample: true, verified: true },
  { id: "sample_arjun", userId: "s8", name: "Arjun", age: 23, gender: "Male", occupation: "Content Creator", city: "Bangalore", locality: "Koramangala", budget: 16000, moveIn: "Dec 2026", bio: "Shoot videos from home. Gamer, foodie and always up for café hopping.", tags: ["Work From Home", "Gamer", "Night Owl"], images: [], isSample: true },
];
