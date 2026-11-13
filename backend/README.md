# SetMyStay — backend (Django REST)

Lives in the `backend/` folder of the main repo. The website (React) is in the repo root.

## Run locally
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # fill in values
python manage.py migrate
python manage.py runserver  # http://localhost:8000/api/
```
Then in the repo root set `VITE_API_URL=http://localhost:8000/api` in `.env` and run `npm run dev`.

## Deploy on Render
- **Root directory:** `backend`
- **Build command:** `./build.sh`
- **Start command:** `gunicorn setmystay_backend.wsgi:application`
- Add the variables from `.env.example` under Environment.
- `build.sh` runs `migrate` automatically. New migrations in this version:
  - `management 0002` – admin-panel login + site settings tables
  - `management 0003` – locks any superuser still using the old public password `Admin@12345`
  - `matching 0001` – roommate swipe / requests / matches / chat

## Panels
| Panel | URL | Sign-in |
|---|---|---|
| Admin | `/admin/login` on the website | Password → PIN → security answer, checked by `POST /api/auth/admin-login/` (hashes only, rate-limited) |
| Staff | `/staff/login` on the website | Staff accounts the admin creates under Admin → Staff (`POST /api/auth/staff-login/`) |
| Django admin | `<backend>/admin/` | Set `DJANGO_SUPERUSER_PASSWORD` on Render to enable |

Change the admin password, PIN or question from Admin → Security Settings.
If you ever get locked out, open the Django admin → Management → Admin panel credentials and delete the row;
it is re-created with the original values on the next login attempt.

## Listing review flow
1. Owner submits a listing → saved as **PENDING** (hidden from the public).
2. Staff **and** admin panels poll `GET /api/properties/review_summary/` every 20 s → chime + toast + tab badge when a new request arrives.
3. Staff/admin verifies (site visit etc.) and presses **Approve** → status **APPROVED** → it appears on the home page and listing pages immediately.

## Security changes in this version
- Approve/reject/delete, staff management, coupons, ads and purchase history now require staff/admin login (they were open to anyone).
- Admin panel secrets are no longer in the website's JavaScript; owners' identity documents are hidden from the public API.
- Payments are only recorded after the Razorpay signature is verified.
- `requirements.txt` re-saved as UTF-8 (it was UTF-16, which breaks `pip install -r` on Render).
