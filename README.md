# Calapp

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FItzAzizbek%2Fcalapp&env=OPENROUTER_API_KEY&envDescription=OpenRouter%20API%20key%20for%20meal%20analysis&envLink=https%3A%2F%2Fopenrouter.ai%2Fsettings%2Fkeys)

Log calories from a photo. Snap your plate, review the estimate, log it.

- **Photo → calories & macros** using GPT-4o via OpenRouter, broken down by item
- **Refine in plain words** ("no cheese", "it was a large bowl") to re-estimate
- **Edit anything**: items, amounts, kcal/macros, portion multiplier, meal type
- **Describe instead** when you don't have a photo
- **Daily ring + macro bars**, week strip with per-day progress
- **Onboarding** that builds a daily calorie target from your goal, body stats and activity (Mifflin–St Jeor); redo it anytime from Settings
- **Local-first**: meals, goals and profile live in localStorage, photos in IndexedDB. Export as JSON anytime
- Light/dark mode, mobile-first, drag & drop or paste images on desktop, installable

## Setup

```bash
npm install
cp .env.example .env.local   # then add your OPENROUTER_API_KEY
npm run dev
```

Open http://localhost:3000.

| Variable             | Default         | Notes                                                    |
| -------------------- | --------------- | -------------------------------------------------------- |
| `OPENROUTER_API_KEY` | —               | Required. Get one at https://openrouter.ai/settings/keys |
| `OPENROUTER_MODEL`   | `openai/gpt-4o` | Any vision model with structured outputs, e.g. `openai/gpt-4.1-nano` (cheaper, rougher) |

## How it works

- `src/lib/image.ts` downsizes photos in the browser (1568px for analysis, 720px thumbnail) and respects EXIF orientation.
- `src/app/api/analyze/route.ts` sends the image to OpenRouter's chat completions API with a strict JSON schema (generated from Zod, and re-validated with it) and returns per-item calories and macros. It only routes to providers that support structured outputs.
- `src/lib/db.ts` is a tiny localStorage database: `table()` stores one row per key (`calapp:entries:<id>`), `doc()` stores a single value (`calapp:goals`, `calapp:profile`). Writes are synchronous, sync across tabs, and surface a clear error when storage is full.
- `src/lib/photos.ts` keeps meal photos in IndexedDB (`calapp-photos`), keyed by entry id, so they don't count against localStorage's ~5 MB quota. They're mirrored in memory so the UI reads them synchronously.
- `src/lib/store.ts` joins the two into React hooks and runs one-time migrations (meals from the original IndexedDB store, inline photos out of localStorage rows).
- `src/lib/plan.ts` computes the onboarding calorie target.

Photos are sent to the API for analysis and are not stored on the server.
