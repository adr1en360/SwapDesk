# SwapDesk Frontend

The frontend dashboard for **SwapDesk** — autonomous middleware between a e-commerce helpdesk and its commerce stack that resolves exchanges, returns, and refunds safely. It is an idempotent, policy-aware agent runtime.

Built as a Next.js app wired to the live SwapDesk agent backend — every
page reads real agent state over HTTP. It needs a running backend to
run it (local `uvicorn swapdesk.api:app` or the deployed API).

## Tech Stack

- **Next.js 16.4.0** (App Router, Turbopack, `cacheComponents` + `partialPrefetching` enabled)
- **React 19** with Server & Client Components
- **TypeScript** (strict), path alias `@/*` → `./src/*`
- **Tailwind CSS v4** (CSS-first theme tokens in `app/globals.css`)
- **lucide-react** icons
- **sonner** toasts
- Fonts via `next/font/google`: **Bricolage Grotesque** (display), **Plus Jakarta Sans** (body), **Geist Mono** (technical/mono)

## Getting Started

```bash
npm install      # install dependencies
npm run dev      # start the development server (http://localhost:3000)
```

Other scripts:

| Script          | Description                                    |
| --------------- | ---------------------------------------------- |
| `npm run build` | Production build (static + partial prerender)  |
| `npm run start` | Serve the production build                     |
| `npm run lint`  | ESLint (flat config)                           |

## Environment Variables

| Variable                 | Default                             | Purpose                                                                |
| ------------------------ | ----------------------------------- | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_SWAPDESK_API` | `https://swapdesk-7yvl.onrender.com` | Agent backend base URL (no trailing slash). Point at `http://127.0.0.1:8000` for a fully local stack. No secrets ever live in browser code. |
| `NEXT_PUBLIC_SITE_URL`   | `https://swapdesk.vercel.app`       | Canonical origin used for `metadataBase`, canonical URLs, sitemap, robots. Override when deploying. |

## Project Structure

```
app/
├── layout.tsx              # Root layout, global <head> metadata, fonts, SwapDeskProvider, Toaster
├── page.tsx                # Server entry → renders <MissionControl />
├── mission-control.tsx     # "Mission Control" home (client) — metrics + live queue
├── inbox/page.tsx          # Full ticket inbox (live agent cases)
├── inventory/              # Real stock from the backend (client; read-only)
│   ├── layout.tsx          #   metadata
│   └── page.tsx
├── database/layout.tsx     # Schema view (metadata)
├── integrations/           # Inbound webhook triggers (Zendesk, Shopify Inbox, Gorgias)
│   ├── layout.tsx          #   metadata
│   └── page.tsx
├── settings/layout.tsx     # Agent autonomy/guardrail settings (metadata)
├── simulate/page.tsx       # Customer Simulation — inject a ticket into the queue
├── ticket/[id]/page.tsx    # Ticket execution detail (Suspense split; see below)
├── robots.ts               # /robots.txt
├── sitemap.ts              # /sitemap.xml
├── opengraph-image.tsx     # Generated OG image (ImageResponse)
├── twitter-image.tsx       # Re-exports from opengraph-image
└── globals.css             # Theme tokens + utilities (panel, glass, pulse-dot, num, rise)

src/
├── components/
│   ├── AppShell.tsx                # Sidebar + top bar + mobile bottom nav, "New Ticket" button
│   └── CustomerSimulationWidget.tsx # Ticket submit form → POST /v1/agent/tickets
├── lib/
│   ├── api.ts                      # Typed client for the agent backend (docs/API_CONTRACT.md)
│   ├── use-case.ts                 # Case detail + timeline hook with polling + continue
│   ├── seo.ts                      # SITE_* constants + pageMetadata() helper
│   └── utils.ts                    # cn() (clsx + tailwind-merge)
└── store/
    └── swapdesk.tsx                # Live case list + backend health, backed by lib/api.ts
```

## User Flow

Everything is driven by the live agent backend — each action below is a
real API call (contract: `docs/API_CONTRACT.md`).

1. Click **New Ticket** (top bar) or open **Customer Simulation** (`/simulate`), type a complaint, and submit → `POST /v1/agent/tickets` returns `202` with a case id.
2. The case appears in **Mission Control** and the **Inbox**; both poll every 3s while any visible case is non-terminal.
3. Open the ticket to watch its execution timeline arrive as the worker commits actions (`reserve → return → label → arrange`).
4. If the agent needs more info, answer from the ticket page → `POST .../continue` queues a fresh run; terminal cases return their saved outcome with no new run.

## State Management

`src/store/swapdesk.tsx` exposes a `SwapDeskProvider` (mounted in `app/layout.tsx`) plus a `useSwapDesk()` hook. It holds the live case list,
result summary, backend health, and a `submit()` that posts tickets —
all backed by `src/lib/api.ts`:

```ts
const { cases, summary, total, loading, error, health, ready,
  refresh, reload, loadMore, hasMore, submit } = useSwapDesk();
```

- `cases` — agent cases, newest first, with `execution_status`
  (`queued | running | waiting_input | completed | failed`) and business
  `outcome` (`arranged | clarification | denial | escalation | null`).
- `submit({ message, order_id, order_item_id, size, ... })` — posts to
  `/v1/agent/tickets`, then refreshes the list.
- Polling is status-only (3s while any visible case is non-terminal);
  nothing here ever resubmits or retries a run.
- Per-case detail, timeline, and continuation live in
  `src/lib/use-case.ts` (`useCaseDetail`), used by `/ticket/[id]`.

## Routes

| Route                 | Page                    | Type            | Notes                              |
| --------------------- | ----------------------- | --------------- | ---------------------------------- |
| `/`                   | Mission Control         | server + client | backend metrics + live queue, filter       |
| `/inbox`              | Inbox                   | server + client | live agent cases                           |
| `/inventory`          | Inventory               | server layout + client page | real backend stock, read-only        |
| `/database`           | Database Schema         | server          |                                    |
| `/integrations`       | Integrations            | server layout + client page | webhook toggle + URL copy  |
| `/settings`           | Agent Settings          | server          |                                    |
| `/simulate`           | Customer Simulation     | server          | `CustomerSimulationWidget`         |
| `/ticket/[id]`        | Ticket Execution        | client          | Partial Prerender (Suspense)       |
| `/robots.txt`         | —                       | metadata route  | auto-generated                     |
| `/sitemap.xml`        | —                       | metadata route  | auto-generated                     |
| `/opengraph-image`    | —                       | image route     | generated 1200×630 PNG             |
| `/twitter-image`      | —                       | image route     | re-export of opengraph-image       |

> **Turbopack dynamic route note:** `/ticket/[id]` must pre-render its HTML shell at build time. Client hooks that need URL data (`useParams`, `usePathname`) therefore live behind `<Suspense>` and out of the static shell. See `app/ticket/[id]/page.tsx`.

## Design System

Theme tokens live in `app/globals.css` as CSS variables and Tailwind v4 `@theme` mappings:

- Colors: `--card: #111113`, `--border: #222225`, `--color-success` (green), `--color-primary`, `--color-warning`, `--color-danger`, `--color-hairline`
- Type: `font-display` (`--font-bricolage`), `font-sans` (`--font-jakarta`), `font-mono` (`--font-geist-mono`)
- Utilities: `panel` (card), `glass` (frosted nav), `pulse-dot`, `num` (tabular numerals), `rise` (entry animation)

> **Guideline:** keep server-rendered pages static where possible and move interactivity into client components. Do not introduce a visual redesign — extend the existing token system.

## SEO

Add full metadata to every segment:

- Root (`app/layout.tsx`): `metadataBase`, titles with `template: "%s · SwapDesk"`, description, keywords, `<viewport>` (themeColor), OpenGraph + Twitter cards, `robots`, `applicationName`, authors, category.
- Per page: use the `pageMetadata({ title, description, path })` helper from `src/lib/seo.ts` (marked `Export const metadata`).
- Images: `app/opengraph-image.tsx` generates a themed 1200×630 card with `ImageResponse`; `app/twitter-image.tsx` re-exports it.
- Crawling: `app/robots.ts` and `app/sitemap.ts` reflect the remaining routes.

Set the title without the site name suffix — the root template appends ` · SwapDesk`.

## Deploy

Deploy on Vercel (or any Node host running `npm run build && npm run start`):

```bash
npm run build
npm run start
```

Set `NEXT_PUBLIC_SITE_URL` to your production origin so canonical URLs, sitemap, and robots are correct.