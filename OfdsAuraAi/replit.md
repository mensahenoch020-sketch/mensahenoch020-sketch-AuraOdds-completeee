# AuraOdds — AI-Powered Football Predictions

## Overview
A complete football prediction platform with an Express.js backend and React + Vite frontend, using Supabase as the database, Gemini AI for predictions, and live odds from the Odds API.

## Architecture
- **Backend**: `api/index.js` — Express.js REST API on port 3000
- **Frontend**: `client/` — React + Vite app on port 5000 (dev mode)
- **Database**: Supabase PostgreSQL (92,900+ historical match records)
- **Build Output**: `dist/` — served by Express in production

## Key Features
1. **Today's Picks** — Auto-predicts all today's fixtures using H2H + form data + Gemini AI
2. **Fixtures Calendar** — 7-day calendar with match counts, search, and instant predictions
3. **Accumulator Builder** — Multi-leg acca builder with payout calculator and AI analysis
4. **Statistics** — Win rate, ROI, P/L charts, league/market performance breakdown

## Running the App
- Dev: `npm run dev` — runs Express (port 3000) + Vite (port 5000) concurrently
- Build: `npm run build` — builds React to `dist/`
- Production: `node api/index.js` — serves built React from `dist/`

## API Routes
| Route | Method | Description |
|-------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/fixtures` | GET | 7-day fixtures with odds (cached 30min) |
| `/api/fixtures/today` | GET | Today's fixtures only |
| `/api/predict` | POST | AI prediction for a single match |
| `/api/accumulator` | POST | Multi-match accumulator analysis |
| `/api/picks/today` | GET | Today's saved predictions |
| `/api/picks/all` | GET | All historical predictions |

## External APIs
- **Supabase**: Match history, predictions storage, fixture cache
- **Football-Data.org**: Live fixture data (TIMED/SCHEDULED status)
- **Odds API**: Live bookmaker odds
- **Gemini 2.0 Flash**: Primary AI (2 keys with fallback)
- **Groq/Llama**: Fallback AI when Gemini fails

## Prediction Logic
1. Query H2H history (last 20 meetings) from Supabase
2. Query recent form for both teams (last 10 matches each)
3. Calculate home/away win% and avg goals
4. Pick best market based on statistical thresholds
5. Fetch live odds from Odds API
6. Calculate Kelly Criterion stake % (capped at 5%)
7. Call Gemini AI for 3-bullet analysis
8. Save to `picks` table in Supabase

## Supabase Tables
- `matches` — 92,900 rows of historical match data
- `picks` — AI prediction history
- `fixtures_cache` — Cached fixture data (30min TTL)

## Design
- Dark background: `#0a0a0a`
- Gold accent: `#f0b429`
- Font: Inter
- Mobile-first responsive

## Deployment
Vercel-ready with `vercel.json` configured:
- Express backend via `@vercel/node`
- React frontend via `@vercel/static-build`
