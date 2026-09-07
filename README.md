# Aquavia Dealer Intelligence

International B2B dealer prospecting for **Aquavia Spa / IBERSPA S.L.**

Enter a country (and optionally a city), and the application discovers, verifies, enriches,
scores and organises potential spa dealers in that market — spa and hot-tub retailers, pool
companies and builders, wellness, sauna and hammam businesses, premium outdoor-living
companies, hotel wellness suppliers, and dealers already representing competing spa brands.

```
COUNTRY: Morocco
CITY:    Casablanca
DEPTH:   Deep
```

---

## The data-quality contract

This is the rule the whole product is built around, and it is enforced in code rather than
merely documented:

> **A fact is stored only when a provider returned it or a retrieved page states it.
> Everything else is `UNKNOWN`. Nothing is guessed.**

Concretely:

| Rule | Where it is enforced |
|---|---|
| Booleans are three-valued (`YES` / `NO` / `UNKNOWN`), never defaulted | `prisma/schema.prisma`, `src/lib/enrich/extract.ts` |
| Every research finding keeps its source URL **and a verbatim quote** | `SourceRef` model, shown on each company profile |
| **Company founded year** and **years working in the spa industry** are separate fields; one is never derived from the other | `yearFounded` vs `spaSinceYear` / `yearsInSpaIndustry` |
| A bare 4-digit number is never read as a founding year — the text must explicitly frame it (`founded`, `since`, `fundada en`, `gegründet`…) | `FOUNDED_PATTERNS` |
| Emails are kept only when the address literally appears in the retrieved text; addresses are **never** pattern-guessed | `src/lib/enrich/decisionMakers.ts` |
| LinkedIn is never authenticated against or crawled behind its access controls; public profile URLs found in ordinary search results are stored as references only | `NEVER_CRAWL_DOMAINS` |
| Unknown signals score **zero**, never a midpoint, so a researched company always outranks an unresearched one on equal evidence | `src/lib/scoring/score.ts` |
| `dataCompleteness` reports what share of the score rests on verified data | shown next to every score |
| When Claude is enabled, any claim citing a URL that was not supplied to it is **discarded** | `src/lib/providers/anthropic.ts` |

A company discovered from Google Places alone scores low on purpose — Google can prove a
business exists and is well reviewed, but it cannot prove the business sells spas.

---

## Architecture

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15** (App Router, React 19, TypeScript strict) | One deployable unit for UI and API; deploys to Vercel from GitHub with no extra infrastructure |
| Database | **PostgreSQL** via **Prisma 6** | The same engine locally and in production — no SQLite-to-Postgres migration to do later |
| Styling | Tailwind CSS with a custom design system | Information-dense B2B interface, not a generic admin template |
| Map | Leaflet + OpenStreetMap tiles | No API key, no vendor lock-in |
| Exports | ExcelJS (XLSX), hand-rolled RFC 4180 CSV | Formula-injection safe |
| Tests | Vitest | Runs with no database and no network |

### Provider modules (swappable)

```
src/lib/providers/
  types.ts          shared ProviderOutcome envelope + timeout/error classification
  googlePlaces.ts   Google Places API (New) — discovery and verification
  tavily.ts         web research behind a WebResearchProvider interface
  anthropic.ts      OPTIONAL — a reader over already-retrieved text
```

Every provider returns `{ ok: true, data }` or `{ ok: false, error: { code, message, retryable } }`.
A missing key is a first-class `NOT_CONFIGURED` outcome, surfaced to the user — never a crash
and never silently faked data.

### The pipeline runs in bounded steps

`PENDING → DISCOVERING → ENRICHING → SCORING → COMPLETED`

`POST /api/runs/[id]/step` performs one small chunk of work and returns; the client polls until
`done`. All progress lives in Postgres, so a run fits inside serverless execution limits and
survives a cold start, a redeploy or a browser refresh.

---

## Getting started

### 1. Install

```bash
npm install
```

### 2. Configure

```bash
cp .env.example .env
```

Fill in `DATABASE_URL` and `DIRECT_URL` at minimum. **Never commit `.env`** — it is gitignored.

### 3. Create the schema

```bash
npm run db:deploy   # production: apply migrations
# or, in development:
npm run db:migrate
npm run db:seed     # seeds the known-competitor exclusion list only
```

`db:seed` deliberately creates **no companies**. Inventing prospects would violate the data
contract above; real companies only ever enter the database through a real search.

### 4. Run

```bash
npm run dev     # http://localhost:3000
```

---

## Environment variables

| Variable | Required | Without it |
|---|---|---|
| `DATABASE_URL` | **Yes** | The application cannot run. |
| `DIRECT_URL` | **Yes** | Needed by `prisma migrate`. If your host has no connection pooler, set it to the same value as `DATABASE_URL`. |
| `GOOGLE_PLACES_API_KEY` | **Yes, to discover** | Everything still loads, but no company can be found or verified. Settings reports `NOT CONFIGURED`. |
| `TAVILY_API_KEY` | No | Companies are discovered and scored from Google data only; every research-only field stays `UNKNOWN`. |
| `ANTHROPIC_API_KEY` | **No — optional** | Nothing is lost. The deterministic extractor reads the same text. |
| `AQUAVIA_HOME_COUNTRY` | No | Defaults to `ES`. |

Enable **Places API (New)** for your Google Cloud project — the legacy Places API will not work.

---

## Deploying to Vercel

1. Push this repository to GitHub and import it in Vercel.
2. Create a Postgres database (Neon, Supabase, or Vercel Postgres).
3. Set the environment variables above in **Project → Settings → Environment Variables**.
   On Neon/Supabase, `DATABASE_URL` is the **pooled** string and `DIRECT_URL` the **direct** one.
4. Deploy. `vercel.json` already runs `prisma generate && prisma migrate deploy && next build`.

Nothing depends on a local machine: no background workers, no cron, no local filesystem writes.

---

## Search terminology adapts to the market

A query for `spa dealer` returns almost nothing useful in Morocco, Poland or Japan. The planner
generates queries in the languages a local business actually advertises in, across 12 business
categories and ~35 languages.

Morocco resolves to French **and** Arabic:

```
fr | spa     | vente de spas Casablanca Morocco
ar | spa     | بيع جاكوزي Casablanca Morocco
fr | hotTub  | jacuzzi extérieur vente Casablanca Morocco
fr | pool    | entreprise de piscines Casablanca Morocco
-- | brand   | Wellis Casablanca Morocco
```

When a market has no local vocabulary, the run warns that English fallback terms are being used
and that recall will be lower — rather than quietly returning fewer results.

| Depth | Categories | Languages | Competitor brands | Queries (typical) |
|---|---|---|---|---|
| **Quick** | 5 | 1 + English | 4 | ~15 |
| **Deep** | 12 | 2 + English | all 9 | ~72 |

---

## Competitor dealer discovery

Discovery explicitly hunts for dealers of **Wellis, Jacuzzi, HotSpring, Caldera, Sundance,
Villeroy & Boch, Bullfrog, Master Spas** and **Passion Spas**, and detects 36 spa brands in
total during enrichment.

The list is a starting point, not a boundary: brand-shaped mentions that are *not* on the list
are captured separately in each company's research notes as "possible additional brands to
review", so new local brands surface instead of being discarded.

---

## The Aquavia Opportunity Score

Every prospect is scored 0–100 across 17 signals, each capped and individually explained:

already sells spas (20) · physical showroom (12) · competitor brands represented (14) ·
pool business (10) · wellness/sauna/hammam (8) · premium positioning (8) · Google rating (6) ·
review volume (6) · company age (6) · spa industry tenure (5) · website (5) ·
multiple locations (5) · hospitality channel (5) · decision maker identified (4) ·
social presence (4) · outdoor living (4) · geographic importance (2)

| Priority | Score | Meaning |
|---|---|---|
| **A** | 80–100 | HIGH PRIORITY |
| **B** | 60–79 | GOOD PROSPECT |
| **C** | 40–59 | SECONDARY |
| **D** | 0–39 | LOW PRIORITY |

The full breakdown is shown on every company profile, so any number can be challenged. Each
prospect also gets a **Why this company** narrative — assembled only from signals that actually
scored, and always ending with what is *still* unknown — and a **recommended next action**
(`VISIT`, `CALL`, `EMAIL`, `LINKEDIN`, `QUALIFY FIRST`, `LOW PRIORITY`).

---

## Features

- **Dashboard** — pipeline totals, priority split, top prospects, market coverage, follow-ups due
- **New Search** — country (required), city (optional), Quick/Deep, live progress and query log
- **Companies** — sortable, filterable, information-dense table
- **Company profile** — score breakdown, activities, brands, decision makers, sources with quotes, CRM
- **Contacts** — every decision maker found, filterable by role, with source URLs
- **Map** — Leaflet map distinguishing Priority A / B / C / existing dealer / excluded; click a point for details
- **Markets** — coverage per country, plus every market not yet prospected
- **Settings** — integration status, data-quality policy, brand watchlist, exclusion lists
- **CRM** — 10 statuses, sales notes, last contact, next follow-up
- **Exclusions** — existing dealers, active negotiations, do-not-contact, known competitors; applied to future searches *and* retroactively
- **Exports** — CSV, styled XLSX, and a Google My Maps-compatible CSV

Exports honour the current table filters, write `UNKNOWN` rather than blank cells, and neutralise
spreadsheet formula injection. The My Maps export reports any company skipped for missing
coordinates instead of dropping it silently.

---

## Commands

```bash
npm run dev         # development server
npm run build       # production build (runs prisma generate)
npm run lint        # ESLint
npm run test        # Vitest — no database or network needed
npm run typecheck   # tsc --noEmit
npm run db:migrate  # create + apply a migration (development)
npm run db:deploy   # apply migrations (production)
npm run db:seed     # seed the known-competitor exclusion list
npm run db:studio   # browse the database
```

---

## Security

- API keys are read from the environment only, never hardcoded and never sent to the browser.
  `/api/settings` reports **whether** a key is present, never its value.
- `.env` and all `.env*.local` files are gitignored; `.env.example` documents every variable.
- Exports are formula-injection safe.
- The application does not bypass any site's access controls, and only stores professional
  information that is already public.

---

## Legal & ethical scope

This tool performs **B2B prospecting on publicly available business information**. It does not
authenticate to, scrape behind, or otherwise circumvent access controls on any platform,
LinkedIn included. Decision-maker records hold professional contact details published on public
pages, each with the URL it came from. Before running outreach campaigns, confirm your process
against GDPR and the local marketing rules of each target market.
