# Visual Refresh Plan — "More vibrant"

The layout redesign (REDESIGN_PLAN.md, v2) fixed structure: top nav, split workspace, landing page.
What's left is **mood**: nearly every surface is the same white / near-black card with a grey border
and a single indigo accent, so all 36 systems, 27 concepts and 36 components look alike. This plan
adds colour identity, depth, imagery and motion — without hurting readability or accessibility.

---

## 1. Goals and guardrails

**Goals**
1. Every area has a recognisable colour identity (category, concept family, diagram tier).
2. Pages have visual rhythm — not one long column of identical card grids.
3. The diagram, the product's core, is the most colourful, alive element on screen.
4. Interactions give satisfying feedback.

**Guardrails**
- Colour lives in **tints, edges, icons and backgrounds**; body text stays neutral (WCAG AA ≥ 4.5:1 in
  both themes, checked with axe in CI).
- Colour is never the only signal — always paired with a label or icon.
- Max palette: brand accent + 5 category hues + 5 concept-family hues (shared hues allowed).
- All motion respects `prefers-reduced-motion`.
- No new runtime dependencies for colour/gradients; motion via CSS first, JS only where needed.

---

## 2. Colour system

### 2.1 Brand
| Token | Light | Dark | Use |
|---|---|---|---|
| `--accent` | `#4F46E5` | `#818CF8` | Links, focus, primary buttons |
| `--accent-2` | `#7C3AED` | `#A78BFA` | Gradient partner |
| `--accent-3` | `#0891B2` | `#22D3EE` | Gradient partner |
| `--gradient-brand` | `linear-gradient(135deg, accent, accent-2 50%, accent-3)` | same | Hero word, primary buttons, logo |

### 2.2 Category identity (systems)
Each category gets one hue used as **solid** (icons, edges), **tint** (8–12% backgrounds) and
**glow** (hover/active shadows).

| Category | Hue | Solid (light / dark) | Tint |
|---|---|---|---|
| Media & Social | Rose | `#E11D48` / `#FB7185` | rose 8% / 14% |
| Mobility & Logistics | Amber | `#D97706` / `#FBBF24` | amber 10% / 14% |
| Commerce & Fintech | Emerald | `#059669` / `#34D399` | emerald 8% / 14% |
| Bookings & Marketplaces | Violet | `#7C3AED` / `#A78BFA` | violet 8% / 14% |
| Building Blocks | Sky | `#0284C7` / `#38BDF8` | sky 8% / 14% |

Exposed as `--cat-{id}`, `--cat-{id}-tint`, `--cat-{id}-glow`, set per page on a wrapper
(`data-category="mobility"`) so components just use `--cat`, `--cat-tint`, `--cat-glow`.

### 2.3 Concept families
| Family | Hue | Concepts |
|---|---|---|
| Data & storage | Blue | caching, sharding, read replicas, search indexing, CDC, ledger |
| Scale & distribution | Orange | horizontal scaling, consistent hashing, multi-region, geospatial, IDs, Bloom filters, tries |
| Messaging & flow | Purple | event-driven, fan-out, back-pressure, websockets, saga, ABR streaming, pre-signed uploads, WebRTC |
| Reliability & correctness | Green | idempotency, distributed locks, leader election, rate limiting, microservices |
| Security | Red | authentication (+ future security concepts) |

A new `family` field on each concept (validated).

### 2.4 Diagram tiers
Tier lanes stop being grey; each gets a 6–8% tint and a coloured lane label:
Clients — slate · Edge & security — blue · Services — green · Async & streaming — purple ·
Data — pink · Analytics & platform — teal (aligned with existing node category colours).

### 2.5 Dark theme upgrade
- Base moves from flat `#0B0D12` to deep navy `#0A0F1E` with surfaces `#111830` / `#172040`.
- Two very soft radial glows (accent + category) fixed behind the page at ~6% opacity.
- Cards get a 1-px top highlight (`rgb(255 255 255 / 0.06)`) for depth.

---

## 3. Depth and texture

| Element | Treatment |
|---|---|
| Hero | Animated mesh gradient (3 blurred blobs drifting over 20 s) + 3% grain overlay; headline word "built?" in `--gradient-brand` text |
| Header | 1-px gradient bottom border; logo mark filled with brand gradient |
| Section bands (home) | Alternate: plain → category-tinted → plain → dark band ("Learning paths") → plain |
| Cards | Soft shadow + 1-px border; on hover lift 2 px and a glow in `--cat-glow` |
| Interactive visuals | Gradient border (1 px, brand gradient) to signal "play with me" |
| Section headings | Coloured icon chip + short 32-px gradient underline |

---

## 4. Imagery and icons

1. **Diagram thumbnails** on every system card and "Used in / Seen in" list — rendered to SVG at build
   time from the existing ELK layout (nodes as coloured rounded rects, edges as lines; no text).
   This alone makes the 36 cards visually distinct.
2. **System glyphs** — one brand-neutral lucide icon per system (Play for video, Car for ride-hailing,
   ShoppingCart, MessageCircle, CreditCard, Map, Ticket, Home, Plane …) inside a category-tinted tile.
3. **Concept family icons** on concept cards and page headers.
4. **Provider marks** — small coloured provider dots/pills next to service names (logos later, after
   licence checks).
5. **Spot illustrations** (simple SVG, two-colour) for 404, empty search results and empty filters.

---

## 5. Page-by-page changes

### Home
- Hero: mesh gradient, gradient headline word, hero diagram card with a subtle animated gradient
  border; stat pills (`36 systems · 36 components · 27 concepts`) as coloured chips.
- "What you can do": each card gets its own hue and a small looping micro-animation on hover
  (cloud labels flipping, a dot moving along an edge).
- Learning paths on a **dark band**: gradient header per path, numbered steps joined by a vertical
  line, progress ring per path (visited systems stored in localStorage).
- Catalogue: category filter chips coloured by category; cards with thumbnail, glyph tile,
  coloured top edge, difficulty pill (green / amber / rose).

### System workspace
- Header band tinted with the category gradient (tint → transparent), category chip and glyph.
- Diagram: tinted tier lanes, accent-coloured dot grid, provider-switch "flash" (boxes briefly glow in
  the provider colour), walkthrough with an animated packet dot along the active edge and a glow on its
  two endpoints.
- Tabs: sliding underline in the category colour.
- Capacity tab: big coloured numbers + log-scale bar per estimate.
- Data tab: store-type badges (relational blue, wide-column pink, cache red, object amber, search
  violet).
- Overview: requirements as icon rows (✓ functional, ⚡ performance, 🛡 reliability).

### Concepts
- Index: cards grouped by family with family colour edge and icon; a small family legend at top.
- Concept page: header band in family colour; "See it in action" visual cards with gradient border;
  success feedback in visuals (ledger "✓ balanced" pulses green, ring flashes when a server fails).

### Components
- Index: category sections with coloured headers; provider columns with coloured header chips.
- Component page: provider option cards with the provider's colour as left edge.

### Global
- Buttons: primary = brand gradient, secondary = tinted; subtle press scale (0.98).
- Segmented controls (provider, mode, theme): sliding pill indicator.
- Loading: shimmering skeleton diagram instead of "Laying out diagram…".
- Toast-style feedback for copy-link / share actions (future).

---

## 6. Motion spec

| Interaction | Motion | Duration |
|---|---|---|
| Card hover | translateY(-2px) + glow fade-in | 180 ms ease-out |
| Segmented/tab change | indicator slides | 200 ms |
| Provider switch | node glow pulse in provider colour | 400 ms, once |
| Walkthrough step | packet travels along edge; endpoints glow | 800 ms per step |
| Hero mesh | blobs drift | 20 s loop |
| Section reveal | fade + 8 px rise on first view | 300 ms, once |

Reduced motion: all of the above become instant state changes; the hero mesh is static.

---

## 7. Implementation approach (when we build it)

- Extend `globals.css` tokens: brand gradient, category and family palettes, tier tints, glow
  shadows, dark-theme navy values. Expose via `@theme` so `bg-cat-tint`, `shadow-cat-glow` etc. work.
- `data-category` / `data-family` attribute on page wrappers sets `--cat` / `--family` variables.
- Schema: add `family` to concepts and `icon` to systems; validator checks both.
- Build-time thumbnail script: reuse `layoutSystem` → write `public/thumbs/{slug}.svg`.
- New small components: `CategoryChip`, `GlyphTile`, `DiagramThumb`, `SegmentedControl`
  (sliding pill), `MeshGradient`, `ProgressRing`, `Skeleton`.
- Diagram: tier tint from tier id; custom edge component with an animated packet (SVG
  `<animateMotion>` or CSS offset-path) for the active step.
- Tests: Playwright visual snapshots of home, one system page and one concept page in both themes;
  axe contrast checks.

---

## 8. Phases

| Phase | Scope | Effort |
|---|---|---|
| 1. Colour foundations | Brand gradient, category + family palettes, tier tints, richer dark theme, coloured cards/chips/menus | ~1 day |
| 2. Depth & polish | Hero mesh + gradient headline, header gradient line, card glows, gradient buttons, sliding segmented controls | ~1 day |
| 3. Imagery | Diagram thumbnails, system glyphs, concept family icons, difficulty pills, illustrations | 2–3 days |
| 4. Living diagrams | Walkthrough packet + endpoint glow, provider-switch flash, skeleton loading | 1–2 days |
| 5. Page rhythm | Alternating home bands, dark learning-path band with progress rings, visual capacity/data tabs | 1–2 days |
| 6. QA | Contrast audit both themes, reduced-motion pass, visual-regression snapshots | ~1 day |

Each phase is independently shippable.

## 9. Acceptance criteria

- A screenshot of any two system pages from different categories is distinguishable at a glance.
- The home page has at least four visually distinct bands.
- Every concept and system card shows a picture (thumbnail or glyph), not just text.
- Lighthouse accessibility 100 and axe zero contrast violations in light and dark.
- With reduced motion enabled, no element animates.
