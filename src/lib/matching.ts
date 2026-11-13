/**
 * SetMyStay — Roommate Match (Tinder-style swipe)
 * ------------------------------------------------------------------
 * 1. Users swipe LEFT (skip) or RIGHT (interested) on approved roommate listings.
 * 2. A RIGHT swipe sends a request to that person. If they had already liked you → instant match.
 * 3. The other person accepts or declines under "Requests".
 * 4. On accept → match → chat unlocks and phone numbers become visible.
 * 5. Daily swipes are limited by plan (Free / Basic / Premium), enforced by the server.
 *
 * Everything goes through the Django API (backend/matching). No sample data.
 */
import api from "./api";
import type { RoommateProfile } from "./types";  // toSwipeProfile() converts listing cards

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

const nextMidnight = () => {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.toISOString();
};

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

// ------------------------------------------------------------------ helpers

const listOf = (data: any) => (data?.results ?? data ?? []) as any[];

// ------------------------------------------------------------------ public API

/** Users must be signed in: the server knows who is swiping. */
export const isSignedIn = () => typeof window !== "undefined" && !!localStorage.getItem("access_token");

export async function fetchDeck(): Promise<SwipeProfile[]> {
  const { data } = await api.get("/roommates/deck/");
  return listOf(data).map(adaptApiProfile);
}

export async function fetchQuota(): Promise<Quota> {
  const { data } = await api.get("/roommates/quota/");
  return adaptApiQuota(data);
}

export async function swipe(profile: SwipeProfile, direction: SwipeDirection): Promise<SwipeResult> {
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

/** Premium only: bring back the last profile you swiped. */
export async function undoSwipe(profileId: string): Promise<Quota> {
  const { data } = await api.post("/roommates/swipe/undo/", { target_id: profileId });
  return adaptApiQuota(data.quota ?? data);
}

export async function fetchRequests(): Promise<{ received: MatchRequest[]; sent: MatchRequest[] }> {
  const [rec, sent] = await Promise.all([
    api.get("/roommates/requests/", { params: { box: "received" } }),
    api.get("/roommates/requests/", { params: { box: "sent" } }),
  ]);
  return { received: listOf(rec.data).map(adaptApiRequest), sent: listOf(sent.data).map(adaptApiRequest) };
}

export async function respondToRequest(requestId: string, accept: boolean): Promise<Match | null> {
  const { data } = await api.post(`/roommates/requests/${requestId}/${accept ? "accept" : "decline"}/`);
  return data.match ? adaptApiMatch(data.match) : null;
}

export async function fetchMatches(): Promise<Match[]> {
  const { data } = await api.get("/roommates/matches/");
  return listOf(data).map(adaptApiMatch);
}

export async function fetchMessages(matchId: string): Promise<ChatMessage[]> {
  const { data } = await api.get(`/roommates/matches/${matchId}/messages/`);
  return listOf(data).map((m: any) => adaptApiMessage(m, matchId));
}

export async function sendMessage(matchId: string, text: string): Promise<ChatMessage> {
  const { data } = await api.post(`/roommates/matches/${matchId}/messages/`, { text });
  return adaptApiMessage(data, matchId);
}

/** Called after Razorpay succeeds. The server verifies the signature and amount before upgrading. */
export async function activatePlan(
  plan: PlanId,
  payment: { razorpay_payment_id?: string; razorpay_order_id?: string; razorpay_signature?: string },
): Promise<Quota> {
  const { data } = await api.post("/roommates/plan/activate/", { plan, ...payment });
  return adaptApiQuota(data.quota ?? data);
}

/** Badge count for the header / bottom nav (0 when signed out). */
export async function fetchNotificationCount(): Promise<number> {
  if (!isSignedIn()) return 0;
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
