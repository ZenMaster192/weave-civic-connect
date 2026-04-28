# Weave — Civic Connect Platform

A tri-interface civic issue reporting and resolution platform that bridges the gap between citizens reporting problems, volunteers resolving them, and NGOs coordinating the effort at scale.

## Project Overview

Weave is a full-stack civic engagement application built around a decoupled, microservices-oriented architecture. It connects three primary stakeholder layers — **Citizens**, **Volunteers**, and **NGOs** — through a centralized algorithmic processing core. The platform features AI-powered issue triage, geo-based volunteer matching, a gamified XP system, and a real-time dispatch engine.

**Backend**: FastAPI + SQLAlchemy + JWT Auth + Pure-Python NLP  
**Frontend**: React + TypeScript (connect your own frontend to the REST API)

> Built and seeded for Bhubaneswar, Odisha — easily adaptable to any city.

---

## Architecture

Weave is divided into three primary interaction nodes that communicate through a shared data and algorithm core:

```
┌─────────────────────────────────────────────────────────────┐
│                        WEAVE CORE                           │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   CITIZEN    │  │  VOLUNTEER   │  │       NGO        │  │
│  │ Intake Layer │  │  Execution   │  │ Admin & Oversight│  │
│  │              │  │    Layer     │  │      Layer       │  │
│  │ • Report     │  │ • Browse     │  │ • Assign issues  │  │
│  │   issues     │  │   matched    │  │ • Manage members │  │
│  │ • Upvote     │  │   issues     │  │ • Track stats    │  │
│  │ • Review     │  │ • Accept     │  │ • Force dispatch │  │
│  │   resolved   │  │   dispatches │  │ • View dashboard │  │
│  │   work       │  │ • Earn XP    │  │                  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                    │            │
│         └─────────────────┼────────────────────┘            │
│                           ▼                                 │
│         ┌─────────────────────────────────┐                 │
│         │     Algorithmic Processing Core  │                 │
│         │  • AI Urgency Triage Engine      │                 │
│         │  • Geo Matching (Haversine)      │                 │
│         │  • Volunteer Churn Risk Model    │                 │
│         │  • XP & Impact Scoring           │                 │
│         │  • Dispatch Race Condition Model │                 │
│         └─────────────────────────────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

### Workflow & Implementation

**1. Citizen Intake**  
A citizen registers, verifies their email via OTP, and submits a civic issue (pothole, sewage overflow, broken streetlight, etc.) with geo-coordinates, a category, a description, and an optional photo. On submission, the AI Triage Engine immediately computes a `priority_score` for the issue. Citizens can upvote issues reported by others to signal community urgency, and submit a star-rating review once a volunteer resolves their issue.

**2. AI Triage Engine**  
Every issue is scored at creation and updated over time using a pure-Python NLP pipeline (zero ML dependencies):
- **Category base score** (25%) — pre-seeded civic urgency knowledge (e.g. Gas Leak = 0.95, Noise Pollution = 0.30)
- **NLP keyword scan** (40%) — urgency lexicon with weighted terms and bigrams (e.g. "fire" = 3.5, "broken" = 1.8), top-3 diminishing-returns aggregation
- **Age decay** (20%) — logarithmic growth so older unresolved issues become more urgent
- **Status signal** (15%) — open issues score full weight; resolved score zero

The engine outputs a normalized `[0.0, 1.0]` score and a human-readable label: `LOW → MEDIUM → HIGH → CRITICAL`.

**3. Volunteer Execution**  
Volunteers maintain a profile with skills, location, XP, and activity history. The geo-matching engine surfaces open issues within a configurable radius, ranked by skill match, proximity, experience, and impact score. Two resolution pathways exist:
- **Self-claim** — volunteer browses matched issues and claims one directly
- **Dispatch** — an NGO or citizen triggers the dispatch engine, which broadcasts the issue to the top-N scoring volunteers as time-limited `PENDING` requests (10-minute window). The first volunteer to accept wins; all others are auto-cancelled (race condition model). On resolving an issue, volunteers earn **30 XP** and log hours automatically.

**4. NGO Administrative Layer**  
NGOs operate as oversight coordinators. They can view all unassigned issues, assign issues to their own members, force-assign specific volunteers, invite independents to join, and monitor a dashboard with resolution rate metrics and member activity feeds. Volunteers can also apply to join an NGO; membership requires mutual approval.

**5. Volunteer CRM — Churn Risk Model**  
The platform tracks engagement velocity for each volunteer and computes a churn risk score using:
- **Recency** (50%) — days since last activity, saturating at 60 days
- **Frequency** (30%) — resolved tasks vs. account-age baseline
- **XP rate** (20%) — XP accumulation relative to expected pace

Churn labels: `HEALTHY → AT RISK → HIGH RISK`. XP tiers: `RECRUIT → BRONZE → SILVER → GOLD`.

---

## Getting Started

### Prerequisites
- Python 3.11+
- pip

### Setup

```sh
# Clone the repository
git clone https://github.com/your-org/weave.git
cd weave

# Install dependencies
pip install fastapi uvicorn sqlalchemy passlib pyjwt python-multipart jinja2

# Start the server
python main.py
```

The API will be available at `http://0.0.0.0:8000`  
Interactive docs at `http://localhost:8000/docs`

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `WEAVE_SECRET_KEY` | `CHANGE_ME...` | JWT signing key — **change in production** |
| `DATABASE_URL` | `postgresql://...` | Database connection string (Use Supabase port `6543`) |
| `EMAIL_ENABLED` | `false` | Set `true` to enable SMTP email |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server host |
| `SMTP_PORT` | `587` | SMTP port |
| `SMTP_USER` | `` | SMTP username / sender address |
| `SMTP_PASSWORD` | `` | SMTP app password |
| `VOLUNTEER_HOUR_VALUE_INR` | `150.0` | Economic value per volunteer hour |
| `AVG_HOURS_PER_RESOLVED_TASK` | `3.5` | Avg hours credited per resolved issue |
| `OTP_EXPIRE_MINUTES` | `10` | OTP validity window |
| `ALLOWED_ORIGINS` | `` | Comma-separated CORS origins (blank = allow localhost) |

> In development, OTPs are printed to the server console when `EMAIL_ENABLED=false`.

---

## API Reference

### Auth — `/api/auth`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/register` | Register new user, triggers OTP email |
| `POST` | `/verify-email` | Verify email with OTP code |
| `POST` | `/resend-otp` | Resend verification OTP |
| `POST` | `/login` | JSON login → JWT token |
| `POST` | `/token` | OAuth2 form login → JWT token |

### Users — `/api/users`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/me` | Get current user profile |
| `PATCH` | `/me` | Update profile (name, bio, skills, location) |
| `GET` | `/{user_id}` | Get any user's public profile |

### Issues — `/api/issues`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/` | Report a new civic issue (auto-triaged) |
| `GET` | `/` | List issues (filter by status, category, city, reporter, etc.) |
| `GET` | `/{id}` | Get single issue |
| `POST` | `/{id}/image` | Upload issue photo (reporter only) |
| `PATCH` | `/{id}/claim` | Volunteer self-claims an open issue |
| `PATCH` | `/{id}/resolve` | Mark issue resolved + upload proof photo |
| `POST` | `/{id}/upvote` | Upvote an issue (once per user) |
| `POST` | `/{id}/review` | Submit star rating + review after resolution |
| `GET` | `/{id}/review` | Get review for an issue |

### Dispatch — `/api/.../dispatch`

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/issues/{id}/dispatch` | Broadcast issue to top-N matched volunteers |
| `GET` | `/api/volunteer/dispatch/pending` | Volunteer fetches their pending dispatches |
| `POST` | `/api/volunteer/dispatch/{id}/accept` | Accept a dispatch (race condition model) |
| `GET` | `/api/volunteer/active-issue` | Get volunteer's currently active issue |

### Matching — `/api/match`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/issues` | Get geo + skill matched open issues for a volunteer |

### NGO — `/api/ngo`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/members` | List active volunteers |
| `GET` | `/members/activity` | Recent issues resolved by NGO members |
| `GET` | `/unassigned` | Unassigned open issues |
| `PATCH` | `/assign/{issue_id}` | Assign issue to this NGO |
| `POST` | `/issues/{id}/assign-member` | Force-assign issue to a specific volunteer |
| `GET` | `/discover-volunteers` | Browse independent volunteers by impact score |
| `POST` | `/membership/invite` | Invite a volunteer to join |
| `POST` | `/membership/apply` | Volunteer applies to join an NGO |
| `GET` | `/membership/requests` | View pending membership requests |
| `POST` | `/membership/{req_id}/approve` | Approve a membership request |
| `GET` | `/stats` | NGO dashboard statistics |

### System

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/leaderboard` | Top 10 volunteers by resolved count |
| `GET` | `/api/notifications` | Current user's notification feed |

---

## 📁 Project Structure

```
weave/
├── src/                     # React frontend source code (components, pages, hooks)
├── public/                  # Public static assets for the frontend
├── uploads/                 # Local storage for user-uploaded images and proof files
├── main.py                  # FastAPI backend app, ORM models, and AI triage engines
├── index.html               # Vite HTML entry point for the React application
├── components.json          # shadcn/ui component configuration
├── package.json             # Frontend dependencies and scripts
├── bun.lockb / package-lock # Frontend package lock files
├── requirements.txt         # Python backend dependencies (FastAPI, SQLAlchemy, psycopg2)
├── .env                     # Environment variables (Supabase URL, Secrets) - *Ignored in git*
└── README.md                # Project documentation
```

## Database Schema

### Users
- `id`, `uid`, `email`, `hashed_password`, `full_name`, `role`
- `is_active`, `is_email_verified`, `created_at`
- `skills`, `bio`, `total_resolved`
- `xp_points`, `last_activity_at`, `total_hours_contributed`
- `org_name`, `ngo_status`, `ngo_document_url`, `impact_score`
- `latitude`, `longitude`, `city`

### Issues
- `id`, `uid`, `title`, `description`, `category`, `status`
- `priority_score` — AI triage score `[0.0, 1.0]`
- `latitude`, `longitude`, `address`, `city`
- `image_url`, `proof_url`
- `reporter_id`, `resolver_id`, `assigned_ngo_id`
- `required_skills`, `created_at`, `updated_at`, `resolved_at`

### Supporting Tables
- **Upvotes** — unique citizen/volunteer endorsements per issue
- **DispatchRequests** — time-limited volunteer broadcast records
- **Reviews** — post-resolution star ratings from citizens
- **EmailOTPs** — hashed OTP records for email verification
- **NGOMembershipRequests** — bidirectional NGO ↔ volunteer membership flow
- **Notifications** — per-user notification feed

---

## 🌱 Seed Data

On first startup, the database is automatically seeded with realistic Bhubaneswar data:
- **2 citizens**, **8 volunteers** (with varied XP, skills, and engagement history), **1 approved NGO**
- **25–40 issues** spread across 8 city localities with realistic categories, statuses, and AI-computed priority scores
- Demo credentials: any seeded email with password `password123`

---

## 🔧 Roles & Permissions

| Action | Citizen | Volunteer | NGO |
|---|:---:|:---:|:---:|
| Report issue | ✅ | ✅ | — |
| Upvote issue | ✅ | ✅ | — |
| Review resolved issue | ✅ | — | — |
| Claim / accept dispatch | — | ✅ | — |
| Resolve issue | — | ✅ | ✅ |
| Trigger dispatch | ✅ | — | ✅ |
| Assign issues to NGO | — | — | ✅ |
| Force-assign to volunteer | — | — | ✅ |
| View NGO dashboard | — | — | ✅ |

---

## Known Issues & Notes

- **Database:** Supabase (PostgreSQL) is configured as the primary database. Ensure your `DATABASE_URL` connects via the Transaction Pooler (port `6543`) for optimal FastAPI concurrency.
- **Security:** `WEAVE_SECRET_KEY` must be changed in your `.env` file before any public deployment.
- **Storage:** File uploads are currently stored locally in the `/uploads` directory. For production, consider migrating this to Supabase Storage or an AWS S3 bucket.
- **AI Modules:** The volunteer churn risk and issue urgency algorithms are functioning internally but are not yet exposed as standalone API endpoints.
---

## Next Steps

- [ ] Expose `/api/ngo/crm` endpoint surfacing churn risk data per volunteer
- [ ] Add PostgreSQL support and migration tooling (Alembic)
- [ ] User authentication refresh tokens
- [ ] Push notifications for dispatch events
- [ ] Admin panel for platform-wide moderation
- [ ] Deploy to Railway / DigitalOcean / AWS with Docker
- [ ] Add more city seeds beyond Bhubaneswar
- [ ] Mobile app (React Native) consuming the same REST API

---

## License

MIT — free to use for personal, academic, or commercial purposes.

## Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change.

---

> *"Weave connects the people who see problems with the people who solve them."*
