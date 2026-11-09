# System Design Explainer

An interactive site that explains how large systems — YouTube, Instagram, Uber, Amazon and 30 more —
are built. Each system walks through requirements, APIs, capacity estimates, the data model, an
architecture diagram you can switch between **AWS, Google Cloud, Azure and open-source tools**,
request-flow walkthroughs, bottlenecks, scaling and extensions. Component and concept pages explain
every building block and pattern, and link back to where they're used.

Built with Next.js (static export), React Flow + ELK for auto-laid-out diagrams, Tailwind CSS and Zod.

## Develop

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Build and preview

```bash
npm run build     # validates content, then writes the static site to ./out
npm run preview   # serves ./out at http://localhost:4173
```

## Test

```bash
npm run validate  # schema and cross-reference checks for all content
npm run lint
npm run test:e2e  # builds, then runs Playwright smoke tests (desktop + phone)
```

Playwright needs a browser: either `npx playwright install chromium`, or use one that's already
installed with `PLAYWRIGHT_CHANNEL=msedge` (or `chrome`).

## Deploy

`./out` is plain static files — upload it to any static host (GitHub Pages, Netlify, Vercel,
Cloudflare Pages, S3 + CloudFront). On Vercel the production domain is used automatically; elsewhere,
set `NEXT_PUBLIC_SITE_URL` to the public origin before building so social preview images get
absolute URLs:

```bash
NEXT_PUBLIC_SITE_URL=https://example.com npm run build
```

Preview images are written as extensionless `opengraph-image` files; if your host doesn't detect
their type, serve `**/opengraph-image` with `Content-Type: image/png`.

## Adding content

- `src/content/systems/*.ts` — one file per system (register it in `systems/index.ts`)
- `src/content/components.ts` — component kinds and their AWS / GCP / Azure / open-source options
- `src/content/concepts.ts` — concept explainers
- `src/types/schema.ts` — the schema every content file must satisfy

`npm run validate` (also run before every build) catches unknown component kinds, broken edges,
flows or concept links.

## Project layout

- `src/app/` – routes: `/`, `/systems/[slug]`, `/components/[id]`, `/concepts/[slug]`
- `src/components/` – diagram, system page, navigation and search UI
- `src/lib/` – layout (ELK), provider resolution, search, validation, OG images
- `e2e/` – Playwright smoke tests
- `docs/NOTES.md` – content notes distilled from the source PDFs
- `docs/IMPLEMENTATION_PLAN.md` – features, data model and milestones
- `docs/REDESIGN_PLAN.md` – plan for a more modern visual redesign
- `docs/IMPROVEMENTS_PLAN.md` – plan for deeper content: calculators, failure simulator, security, cost, interview prep, labs
- `docs/VISUAL_REFRESH_PLAN.md` – plan to make the UI more vibrant: colour identity, depth, imagery, motion
