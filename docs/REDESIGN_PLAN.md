# UI Redesign Plan (v2)

This version redefines the UI changes so the redesign has room for the depth features in
[IMPROVEMENTS_PLAN.md](IMPROVEMENTS_PLAN.md): capacity calculator, failure simulator, security
overlay, cost estimator, observability, interview mode and code labs. v1 only restyled today's
pages; v2 restructures them so those features fit without making pages longer.

---

## 1. Principles

1. **The diagram is the product.** Every system page is built around a large, persistent diagram;
   text, numbers and tools sit beside it, not above it.
2. **One page, many lenses.** Instead of more sections, the same diagram is viewed through *modes*:
   Architecture · Walkthrough · Failure · Security · Cost · Trace.
3. **Show, then explain.** Every number and claim can be expanded into its formula, rule or reason.
4. **Progressive depth.** Overview first; depth (indexes, SLOs, configs, code) one click away.
5. **Calm and fast.** Light-first, few borders, strong type, short purposeful motion, works on phones.

---

## 2. Visual language

### Tokens (replacing the current slate-inversion trick)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#FAFAF9` | `#0B0D12` | Page |
| `--surface` | `#FFFFFF` | `#12151C` | Cards, panels |
| `--surface-raised` | `#FFFFFF` + shadow | `#181C25` | Popovers, sheets |
| `--border` | `#E7E5E4` | `#232836` | Dividers (used sparingly) |
| `--text` | `#1C1917` | `#ECEDEE` | Body |
| `--text-muted` | `#57534E` | `#9BA1AE` | Secondary (≥ 4.5:1) |
| `--accent` | `#4F46E5` | `#818CF8` | Links, focus, primary actions |
| `--accent-soft` | indigo 8% | indigo 14% | Selected states |
| `--danger` / `--warn` / `--ok` | red / amber / green 600 | 400 | Failure sim, SLO status |

Defined once per theme, exposed to Tailwind through `@theme` (`bg-surface`, `text-muted`, …).
Category and provider colours become **tints** (10–14%) with a coloured 3-px edge, not solid fills.

### Typography
- Display: **Geist** 600–700 (already loaded), tracking −2%; page titles 40/48, section titles 24/32.
- Body 16/26, small 14/22, labels 12/16 uppercase only for overlines.
- Mono (Geist Mono) for APIs, keys, formulas and code.

### Shape, depth and motion
- Radius 12 px (cards), 8 px (controls), full for pills. Fewer borders; elevation via soft shadow
  (light) or 1-px top highlight (dark).
- Motion 150–250 ms ease-out: panels slide, provider labels cross-fade, walkthrough edges "draw",
  failures pulse once. Everything respects `prefers-reduced-motion`.

---

## 3. Global layout & navigation

- **Top bar (56 px)** replaces the sidebar: logo · *Systems* (mega-menu by category) · *Components* ·
  *Concepts* · *Practice* (interview mode) · search (⌘K) · theme toggle.
- **Command palette** becomes the fastest navigation: systems, components, concepts, services and
  actions ("Simulate Redis failure in Uber", "Switch to Azure").
- **Breadcrumb + context switcher** on system pages: `Systems / Mobility / Uber ▾` to jump between
  related systems.
- Max content width 1280 px; system workspace uses the full width.

---

## 4. Page-by-page

### 4.1 Home — landing + catalogue
1. **Hero:** headline, one-line value prop, and a **live mini-diagram** (URL shortener) that cycles
   AWS → GCP → Azure → OSS labels and plays a 3-step walkthrough. CTA: *Explore a system* /
   *Start a learning path*.
2. **"Choose your lens"** strip: six small cards demoing the modes (architecture, walkthrough,
   failure, security, cost, interview).
3. **Learning paths:** Beginner → Intermediate → Advanced sequences with progress rings.
4. **Catalogue:** cards with an auto-generated **diagram thumbnail**, category tint, difficulty dot,
   concepts on hover; filters become a compact toolbar with a filter popover.

### 4.2 System workspace (the core redesign)

**Desktop (≥ 1024 px): split view**

```
┌ Breadcrumb · Uber ▾ ─────────────────────────── Provider [Generic|AWS|GCP|Azure|OSS] ┐
│ ┌──────────── Diagram canvas (sticky, ~60%) ───────────┐ ┌──── Panel (~40%) ─────────┐ │
│ │ Mode bar: Architecture · Walkthrough · Failure ·     │ │ Tabs:                      │ │
│ │           Security · Cost · Trace                    │ │ Overview · Capacity · Data │ │
│ │                                                      │ │ Reliability · Security ·   │ │
│ │   swimlane tiers, larger nodes, provider logos       │ │ Cost · Observability ·     │ │
│ │                                                      │ │ Interview · Code           │ │
│ │ Bottom dock: mode controls (play/step, break/fix,    │ │                            │ │
│ │ cost range, legend chips)                            │ │  scrollable content        │ │
│ └──────────────────────────────────────────────────────┘ └────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Diagram ↔ panel sync:** hovering a data-model row highlights its store; clicking a node opens a
  node sheet *inside the panel* (not over the diagram); a bottleneck card "focuses" its nodes.
- **Panel tabs** absorb today's nine sections and the new features:

| Tab | Contents |
|---|---|
| Overview | Description, requirements (functional / non-functional), concepts, ADR cards, "evolution v1→v3" mini-timeline |
| Capacity | Calculator inputs (sliders, presets), live outputs with expandable formulas, sizing table |
| Data | Entities as cards (partition/sort keys, indexes, TTL), query → index matrix, hot-partition warnings, DDL toggle |
| Reliability | SLO cards with error-budget bars, RTO/RPO, bottlenecks & fixes, scaling notes |
| Security | Identity flow, RBAC/ABAC table, data classification, secrets, threat cards |
| Cost | Provider comparison bars (ranges), top cost drivers, savings tips, assumptions |
| Observability | Golden signals per node, top alerts, trace waterfall of the selected flow |
| Interview | Questions → follow-ups → good answer / red flags, rubric, "start mock" button |
| Code | Snippet for the selected node / flow step in the chosen language, link to the lab |

- **Tablet (768–1023 px):** diagram on top (60 vh, sticky), panel below with tabs as a horizontal
  scroller.
- **Phone:** tabs become a bottom segmented bar; the tier list replaces the canvas (as today), with
  modes applied to the list (failed items red, encrypted links badged, costs per item).

### 4.3 Diagram modes

| Mode | What changes on the canvas | Dock controls |
|---|---|---|
| Architecture | Default; provider labels and logos; ×N sizing badges from Capacity | Legend chips, fit, layout density |
| Walkthrough | Active edge draws with a moving packet; visited path solid; rest faded; caption in dock | Flow picker, prev / play / next, speed |
| Failure | Failed node red with ✕, impacted sync paths amber, queues pulse with backlog count | "Break" menu (per node or scenario), "Apply fix" toggles, impact summary |
| Security | Trust-boundary lanes (internet / edge / private / PCI), lock on encrypted edges, PII badges on stores | Boundary toggle, highlight PII flows |
| Cost | Node size or heat shows monthly cost share; labels show $ range | Provider, preset, monthly / yearly |
| Trace | Selected flow renders as a span waterfall beside the canvas; nodes show latency budget | Flow picker, p50 / p99 toggle |

### 4.4 Node design (canvas)
- 240×96 px; **3-px left edge in category colour**, provider logo top-right, service name in 15 px
  semibold, generic label + role on hover/expand.
- States: default · hover (raised) · selected (accent ring) · in-path (amber edge) · failed (red,
  hatched) · faded (40% opacity).
- **Expandable nodes** ("+" button) reveal internals for deep-dive services (e.g. Uber matching
  pipeline) as a nested sub-graph.

### 4.5 Components & Concepts
- **Component page:** hero with provider tabs; *Compare* table (configs, limits, managed vs
  self-hosted effort, lock-in); "Used in" as diagram thumbnails that open the system with that node
  selected; kind-level failure modes, security controls, golden signals and pricing units.
- **Concept page:** a short animated explainer diagram at the top, then explanation, trade-offs,
  "seen in" thumbnails, related concepts as a small graph.

### 4.6 Practice (interview mode)
- Pick a system → 45-minute timer with phase stepper (Clarify · Estimate · API · Data · Design ·
  Deep dive · Wrap-up); the workspace opens with tabs hidden until each phase is reached; hints
  ladder; self-score rubric; history stored locally.

---

## 5. Component library

Built on **shadcn/ui (Radix)** primitives, styled with the tokens:
Button, IconButton, Tabs, Sheet, Dialog, Popover, Tooltip, Command (⌘K), Slider, Segmented control,
Toggle group, Badge/Pill, Card, Table, Accordion, Progress ring, Toast.
Custom: `DiagramCanvas`, `ModeDock`, `NodeCard`, `SwimlaneTier`, `FormulaReveal`, `SloCard`,
`CostBar`, `TraceWaterfall`, `ThreatCard`, `CodeTabs`, `DiagramThumbnail`.

---

## 6. Accessibility & performance

- WCAG 2.2 AA in both themes (checked with axe in CI); every mode has a text equivalent in the
  panel (diagram is never the only source of information).
- Full keyboard support on the canvas: Tab between nodes, Enter to select, arrow keys to walk edges.
- Lighthouse budgets: LCP < 2 s, CLS < 0.05; diagram thumbnails pre-rendered as SVG at build time;
  ELK layout precomputed at build and shipped as JSON (no layout work in the browser).

---

## 7. Delivery phases (aligned with IMPROVEMENTS_PLAN.md)

| Phase | UI work | Unlocks |
|---|---|---|
| 1. Foundations | Tokens, type scale, top bar, ⌘K actions, shadcn primitives, restyled cards | Everything |
| 2. Workspace shell | Split view, panel tabs (Overview, Data, Reliability), mode bar + dock, node redesign, swimlanes, precomputed layouts | Current content in new layout |
| 3. Capacity & Cost | Capacity tab + ×N badges, Cost tab + Cost mode | Calculator, cost estimator |
| 4. Failure & Security | Failure mode + Reliability tab upgrades, Security mode + tab | Simulator, security |
| 5. Trace & Observability | Trace mode, waterfall, Observability tab | Observability |
| 6. Practice & Code | Practice page, Interview tab, Code tab | Interview mode, labs |
| 7. Landing & polish | Hero mini-diagram, learning paths, thumbnails, motion, visual-regression tests | Discovery |

Each phase ships behind the same URLs; old query parameters (`?cloud=&node=&flow=&step=`) keep
working and gain `mode=` and `tab=`.

---

## 8. What changes from v1 of this plan

| v1 | v2 |
|---|---|
| Restyle existing sections | Restructure into a diagram-centred workspace with tabs and modes |
| Split view with generic tabs | Tabs mapped one-to-one to the new depth features |
| Animated walkthrough only | Six diagram modes sharing one canvas and dock |
| Sidebar → top nav | Top nav + ⌘K actions + Practice section |
| Visual polish phases | Phases aligned with the feature roadmap so each UI step ships a capability |
