# EventHub — Docker setup

Five containers wired together with Docker Compose:

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  frontend    │───▶│   backend    │───▶│      db      │
│  nginx :5050 │    │ node  :3000  │    │ postgres :5432│
└──────────────┘    └──────┬───────┘    └──────────────┘
                           ├─▶ ai      (java :8080) — Groq / Anthropic
                           └─▶ payment (java :8081) — Razorpay
```

## Prerequisites

- **Docker Desktop** (Windows/Mac) or **Docker Engine + Compose v2** (Linux)
- The two Java services live at:
  - `C:\Users\softsuave\Downloads\Services-EventHub\ai-service-final`
  - `C:\Users\softsuave\Downloads\Services-EventHub\razorpay-payment-service-final`

  If yours are elsewhere, set `AI_CONTEXT` and `PAYMENT_CONTEXT` in `.env`.

## One-time setup

1. Copy the env template:
   ```powershell
   cp .env.example .env
   ```
2. Open `.env` and fill in:
   - `JWT_SECRET` (any long random string)
   - `GROQ_API_KEY` *or* `ANTHROPIC_API_KEY`
   - `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (test keys are free at https://dashboard.razorpay.com/app/keys)
   - Optional: `EMAIL_USER` / `EMAIL_PASSWORD` (leave blank for dev-mode OTPs)

## Run everything

```powershell
docker compose up -d --build
```

Wait ~60 seconds for the JARs to compile on first run. Subsequent starts are instant.

| Open in browser           | URL                              |
|---------------------------|----------------------------------|
| Frontend (main app)       | http://localhost:5050            |
| API directly              | http://localhost:3000/api-docs   |
| AI service health         | http://localhost:8080/api/ai/health |
| Payment service health    | http://localhost:8081/api/payment/health |

## Useful commands

```powershell
# Tail logs from all services (Ctrl+C to stop)
docker compose logs -f

# Logs for one service only
docker compose logs -f backend
docker compose logs -f ai

# Rebuild a single service after code changes
docker compose up -d --build backend

# Stop everything
docker compose down

# Stop AND wipe the database / uploads
docker compose down -v
```

## How requests flow

The frontend (nginx) proxies `/api/*` to the backend, so the browser always
talks to `http://localhost:5050` and there's **no CORS configuration needed**.
The backend in turn proxies `/api/ai/*` to the `ai` service and the booking
flow calls the `payment` service — both over the internal Docker network.

User-uploaded images (event covers, avatars) live on a named Docker volume
called `uploads`, so they survive container rebuilds.

## Production hardening (not done by default)

The compose file is dev-friendly out of the box. Before going to production:

- Replace `JWT_SECRET` with a long random secret stored in a secrets manager
- Restrict the database port (`5432:5432`) to internal-only (`expose: ["5432"]`)
- Add an HTTPS reverse proxy in front of nginx (Caddy / Traefik)
- Set `restart: always` and configure backups for the `db_data` volume
- Build the backend with `npm ci --omit=dev` (already done in the Dockerfile)
- Pin all images to specific SHA digests
