# Crater

Chrome extension (MV3, no backend) that builds a local database of Bandcamp fans and their collections, and turns it into recommendations: *Also bought*, *Crate mates* and *For you*.

- Plan: [ROADMAP.md](ROADMAP.md). Tick boxes as you finish steps.
- Findings and decisions that override the original spec: [docs/decisions.md](docs/decisions.md). Read it before touching scanning, parsing or scoring.
- Bandcamp response samples: [tests/fixtures/](tests/fixtures/README.md)

Stack: TypeScript (strict), Vite + CRXJS, React, Dexie (IndexedDB), Vitest.

## Code principles

The goal is code that stays clean, modular and maintainable as the project grows.

- **Small, single-purpose modules.** One responsibility per file. If a file is getting long or doing two things, split it.
- **Clear boundaries between layers.** Each layer talks to the next through typed functions or messages, never by reaching into another layer's internals:
  - `bandcamp/`: all knowledge of Bandcamp's HTML and JSON. Nothing else parses Bandcamp data.
  - `db/`: the Dexie schema and typed repository functions. No raw table access outside `db/`.
  - `scoring/`: pure functions over plain data. No I/O, so they're easy to test.
  - `background/`: queue, scheduler and message routing. It wires the layers together.
  - `content/`, `popup/`: UI only. They talk to the worker through the typed message bus in `shared/messages.ts`.
- **All network requests go through the service worker.** Content scripts never `fetch` (CORS fails on artist subdomains; see decisions §5).
- **Types first.** Define the shapes of data in one place and reuse them. No `any`. Use discriminated unions for messages and job kinds.
- **Pure where possible.** Keep side effects at the edges (worker, repositories) and logic in pure functions.
- **No dead code, no speculative abstractions.** Build what the current phase needs, and name things for what they do.
- **Tests:** every parser has a fixture test, and every scorer has a test on a small synthetic dataset. Run `pnpm test` before calling a step done.
- Comments explain *why*, not *what*. Keep them short.

## UI principles

The UI should feel consistent and thoughtful: one visual language across the sidebar, profile tabs and popup.

- **Build from a small shared component set** in `src/ui/` (e.g. `Button`, `Tabs`, `Row`, `Badge`, `Progress`, `Tooltip`, `Toggle`), and compose screens from them. Don't style one-off elements inline in feature code.
- **Use headless primitives where they fit**, such as Radix UI for Tabs, Tooltip, Dropdown, Switch and Dialog, so behaviour and accessibility come for free. Wrap each primitive in our own component so feature code never imports Radix directly.
- **Design tokens:** colours, spacing, radii, font sizes and shadows are CSS variables defined once. Components use the tokens, never hard-coded values. Match Bandcamp's look closely enough that injected UI feels native.
- **Shadow DOM:** all injected UI renders inside a shadow root, so Bandcamp CSS can't leak in. Radix portals (Tooltip, Dropdown, Dialog) default to `document.body`, which is outside the shadow root and loses our styles. Always pass the shadow-root container to `Portal`.
- **Every view has all its states:** loading or scanning (with progress), empty, error ("parser broken", "queue paused") and results. Never show a blank panel.
- **Accessible by default:** keyboard reachable, visible focus, real buttons and labels.
- Keep components presentational. Data loading and messaging live in small hooks (`useAlsoBought`, `useScanProgress`, …), not inside UI components.
