# Roommate Match — backend endpoints (Django)

The frontend for Tinder-style roommate matching is complete (`src/lib/matching.ts`, `src/components/roommates/*`).
These endpoints are now implemented in `backend/matching/`. Until the new backend is deployed, the site runs in **preview mode**: everything is stored in the browser and sample profiles are shown with a "Sample" badge.

As soon as `GET /api/roommates/quota/` responds (200 or 401), the frontend switches to the real API automatically.
You can force a mode with `VITE_MATCHING_MODE=api` or `VITE_MATCHING_MODE=demo` in `.env`.

All endpoints sit under `VITE_API_URL` (e.g. `/api`), use the existing JWT `Authorization: Bearer` header, and return JSON.

---

## Data model (suggested)

```python
class RoommateProfile(models.Model):      # one per user
    user = OneToOneField(User)
    name, age, gender, occupation, city, locality
    budget = PositiveIntegerField()
    move_in_date = CharField(blank=True)   # "Dec 2026" / "Immediately"
    bio = TextField(blank=True)
    lifestyle_tags = JSONField(default=list)   # ["Non-Smoker", "Vegetarian", ...]
    photos = JSONField(default=list)            # image URLs
    has_property = BooleanField(default=False)
    phone = CharField()                         # only returned to matched users
    verified = BooleanField(default=False)

class Swipe(models.Model):
    swiper = FK(User); target = FK(RoommateProfile)
    direction = CharField(choices=["left", "right"])
    created_at = DateTimeField(auto_now_add=True)
    class Meta: unique_together = ("swiper", "target")

class RoommateRequest(models.Model):
    from_user = FK(User); to_user = FK(User)
    status = CharField(choices=["PENDING", "ACCEPTED", "DECLINED"], default="PENDING")
    created_at = DateTimeField(auto_now_add=True)

class Match(models.Model):
    user_a = FK(User); user_b = FK(User)
    created_at = DateTimeField(auto_now_add=True)

class Message(models.Model):
    match = FK(Match); sender = FK(User); text = TextField(max_length=1000)
    created_at = DateTimeField(auto_now_add=True); read_at = DateTimeField(null=True)

# on the user / profile:
roommate_plan = CharField(choices=["free", "basic", "premium"], default="free")
roommate_plan_expires_at = DateTimeField(null=True)
```

Plan limits (must match `ROOMMATE_PLANS` in `src/lib/matching.ts`):

| Plan | Price | Swipes / day | Chats |
|---|---|---|---|
| free | ₹0 | 15 | 3 matches |
| basic | ₹99/month | 60 | unlimited |
| premium | ₹249/month | unlimited | unlimited, + undo |

**The daily limit must be enforced on the server.** Count today's `Swipe` rows for the user (local timezone Asia/Kolkata) before inserting.

---

## Profile object (used in every response)

```json
{
  "id": 12, "user_id": 40, "name": "Riya", "age": 23, "gender": "Female",
  "occupation": "UX Designer", "city": "Navi Mumbai", "locality": "Vashi",
  "budget": 12000, "move_in_date": "Dec 2026", "bio": "...",
  "tags": ["Vegetarian", "Non-Smoker"], "photos": ["https://..."],
  "has_property": false, "verified": true,
  "phone": "+91..."            // ONLY when the requesting user is matched with this person
}
```

## Quota object

```json
{ "plan": "free", "plan_expires_at": null, "used": 4, "limit": 15, "resets_at": "2026-11-14T00:00:00+05:30" }
```
`limit` is `null` for unlimited.

---

## Endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/roommates/quota/` | — | Quota |
| GET | `/roommates/deck/` | — | `[Profile]`: people not yet swiped, not self, not already matched, approved only. Sort by newest or by score. |
| POST | `/roommates/swipe/` | `{ "target_id": 12, "direction": "left" \| "right" }` | `{ "status": "skipped" \| "requested" \| "matched", "match": Match?, "quota": Quota }` |
| POST | `/roommates/swipe/undo/` | `{ "target_id": 12 }` | `{ "quota": Quota }`. Premium only (403 otherwise). Deletes the swipe and any pending request. |
| GET | `/roommates/requests/?box=received` | — | `[{ "id", "status", "created_at", "profile": Profile }]`: pending requests sent TO me |
| GET | `/roommates/requests/?box=sent` | — | same shape, requests I sent (any status) |
| POST | `/roommates/requests/{id}/accept/` | — | `{ "match": Match }` |
| POST | `/roommates/requests/{id}/decline/` | — | `{}` |
| GET | `/roommates/matches/` | — | `[Match]` |
| GET | `/roommates/matches/{id}/messages/` | — | `[{ "id", "text", "created_at", "is_mine": true }]`. Also marks messages read. |
| POST | `/roommates/matches/{id}/messages/` | `{ "text": "hi" }` | the created message |
| POST | `/roommates/plan/activate/` | `{ "plan", "razorpay_payment_id", "razorpay_order_id", "razorpay_signature" }` | `{ "quota": Quota }` |

Match object:
```json
{ "id": 5, "created_at": "...", "profile": Profile, "last_message": "hey", "last_message_at": "...", "unread": 2 }
```

### Swipe logic
1. If today's swipe count ≥ plan limit → **HTTP 429** with `{ "quota": Quota }` (the frontend shows the upgrade screen).
2. Save the `Swipe`.
3. `left` → `status: "skipped"`.
4. `right`:
   - if the target already swiped right on me (or has a pending request to me) → create `Match`, mark that request ACCEPTED → `status: "matched"`, include `match`.
   - else create a `RoommateRequest(from=me, to=target)` → `status: "requested"` (and send the target a notification or email).

### Accept logic
Only the receiver can accept. Set status ACCEPTED and create a `Match`. Phone numbers are revealed only between matched users.

### Free-plan chat limit
On the free plan, only the 3 oldest matches can be messaged. Return **403** on `POST messages` for the others. The UI already shows those as locked.

### Plan activation (security)
Verify the Razorpay signature server-side (`razorpay_client.utility.verify_payment_signature`) and check that the order amount equals the plan price (₹99 / ₹249) before setting `roommate_plan` and `roommate_plan_expires_at = now + 30 days`. Never trust the browser.

The frontend calls the existing `/payments/create-order/` with `plan_name: "Roommate Basic"` or `"Roommate Premium"`.

### Later upgrades
- Swap the 5-second message polling for Django Channels (WebSockets) for instant chat.
- Push notifications for new requests and matches.
- Report and block: add `POST /roommates/report/` (the UI button currently only shows a confirmation).
