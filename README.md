# Strategic Ops Labs
### Kemmons Wilson Hospitality Partners — Internal Portfolio Platform

A full-stack asset and portfolio management platform built for strategic operations. Includes Portfolio Overview, Asset Tracker, Financial Performance, Property KPIs, Acquisition Pipeline, Competitive Intel, Report Builder, and Data Import.

---

## Stack

| Layer | Technology | Cost |
|-------|-----------|------|
| Frontend | React + Vite | Free |
| Routing | React Router v6 | Free |
| Charts | Recharts | Free |
| Database | Supabase (Postgres) | Free tier |
| Auth | Supabase Auth | Free tier |
| Hosting | Vercel | Free tier |
| Version control | GitHub | Free |

---

## Deploy in 30 Minutes

### Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project** — name it `strategic-ops-labs`
3. Choose a region close to you (e.g. US East)
4. Set a strong database password and save it somewhere safe
5. Wait ~2 minutes for the project to spin up

### Step 2 — Set up the database

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New Query**
3. Open the file `supabase/schema.sql` from this project
4. Copy the entire contents and paste into the SQL editor
5. Click **Run** — this creates all tables, policies, and seed data
6. You should see "Success. No rows returned."

### Step 3 — Get your API keys

1. In Supabase, go to **Settings → API**
2. Copy your **Project URL** (looks like `https://abcxyz.supabase.co`)
3. Copy your **anon / public** key (the long `eyJ...` string)

### Step 4 — Create a GitHub repo

1. Go to [github.com](https://github.com) and create a new repository
2. Name it `strategic-ops-labs` (private recommended)
3. Don't initialize with README (you already have one)

### Step 5 — Push this code to GitHub

Open your terminal, navigate to this project folder, and run:

```bash
git init
git add .
git commit -m "Initial commit — Strategic Ops Labs"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/strategic-ops-labs.git
git push -u origin main
```

### Step 6 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New → Project**
3. Import your `strategic-ops-labs` repository
4. Vercel will auto-detect it as a Vite project
5. Before clicking Deploy, click **Environment Variables** and add:
   - `VITE_SUPABASE_URL` → your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` → your Supabase anon key
6. Click **Deploy**
7. In ~60 seconds you'll have a live URL like `strategic-ops-labs.vercel.app`

### Step 7 — Create your user account

1. In Supabase, go to **Authentication → Users**
2. Click **Add User → Create New User**
3. Enter your email and a password
4. Repeat for any colleagues who need access
5. Go to your Vercel URL and sign in

---

## Local Development

```bash
# Install dependencies
npm install

# Copy env file and fill in your Supabase credentials
cp .env.example .env

# Start dev server
npm run dev
```

App runs at `http://localhost:5173`

---

## Project Structure

```
sol/
├── src/
│   ├── lib/
│   │   ├── supabase.js          # Supabase client
│   │   └── AuthContext.jsx      # Auth provider + useAuth hook
│   ├── hooks/
│   │   └── useData.js           # useAssets, useFinancials, useDeals, usePortfolioSummary
│   ├── components/
│   │   └── Layout.jsx           # App shell — topbar + sidebar nav
│   ├── pages/
│   │   ├── Login.jsx            # Auth gate
│   │   ├── Overview.jsx         # Portfolio dashboard
│   │   ├── Assets.jsx           # Asset tracker + add/edit modal
│   │   ├── Financial.jsx        # P&L and RevPAR charts
│   │   ├── KPIs.jsx             # Property-level KPI drill-down
│   │   ├── Pipeline.jsx         # Acquisition pipeline (Kanban + detail)
│   │   ├── Intel.jsx            # Competitive benchmarking
│   │   ├── Reports.jsx          # Report builder + preview
│   │   └── Upload.jsx           # CSV/Excel import + PMS config
│   ├── App.jsx                  # Router + protected routes
│   ├── main.jsx                 # Entry point
│   └── index.css                # Global styles (KW hunter green theme)
├── supabase/
│   └── schema.sql               # Full DB schema + RLS policies + seed data
├── public/
│   └── favicon.svg
├── index.html
├── vite.config.js
├── vercel.json                  # SPA routing config
├── .env.example
└── package.json
```

---

## Adding Real Data

### Option A — CSV Import
1. Go to **Data Import** in the sidebar
2. Download the CSV template for assets or financials
3. Fill it in with your real property data
4. Upload and import

### Option B — Manual Entry
- **Assets**: Asset Tracker → "+ Add Asset" button
- **Deals**: Acquisition Pipeline → "+ Add Deal" button

### Option C — Supabase Table Editor
For bulk data entry, use the Supabase dashboard Table Editor directly.

### Option D — PMS Integration (future)
The Upload page has placeholder buttons for Opera, Maestro, RMS Cloud, and Mews. To connect a real PMS, you'll need to build a backend function (Supabase Edge Functions) that polls the PMS API and writes to your `financials` table.

---

## Custom Domain (Optional)

1. In Vercel, go to your project → **Settings → Domains**
2. Add your domain (e.g. `ops.kemmonswilson.com`)
3. Follow Vercel's DNS instructions to point it

---

## Inviting Team Members

1. Supabase → **Authentication → Users → Add User**
2. Enter their email and a temporary password
3. They log in at your Vercel URL
4. (Optional) Set up Supabase email invites for a more polished flow

---

## Next Features to Build

- [ ] Export reports to PDF
- [ ] Email scheduled reports to investors
- [ ] Budget vs actual upload and tracking
- [ ] Deal document storage (PSAs, LOIs)
- [ ] Live STR data integration (CoStar/STR API)
- [ ] Mobile-responsive layout
- [ ] Role-based access (read-only vs admin)

---

Built with React, Supabase, and Recharts.
Designed for Kemmons Wilson Hospitality Partners Strategic Operations.
