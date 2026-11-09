# status.md: Project State and Work Log

Read this first. Update it last. Newest log entries go at the top of the log.

## Current state

- **Project:** JEV-based router (Fintackle), CSE299 project
- **Stage:** Frontend demo with dummy data, rebuilt to match the wireframe prototype. No backend yet.
- **Last updated:** 2026-11-09
- **Run locally:** `cd frontend && python3 -m http.server 4173`, then open http://localhost:4173 (or open `frontend/index.html` directly)
- **Deploy:** GitHub Pages via `.github/workflows/pages.yml` (needs Settings, Pages, Source: GitHub Actions). Not pushed yet.

## What exists

- `frontend/index.html`: fixed entry point, wireframe-style shell with 4 tabs (New request, Run, Results, Settings)
- New request: prompt box, threshold dropdown, 3 example prompts, Run, recent runs saved in localStorage
- Run: stepwise sub-task table, parallel panel (Candidates A/B/C, judge ranks, sandbox), fallback notice, benchmark bars by category, cost log with % saved vs a frontier model, verified answer, Download log (JSON), Replay
- Results: past runs plus SVG comparison of JEV routing vs best single model vs random routing (dummy, derived numbers)
- Settings: default threshold, judge on/off, model and benchmark table the router reads
- `src/mockApi.js` is the only data producer: `getConfig()`, `decomposePrompt()`, `runRequest()`, `aggregateComparisons()`
- Keyword decomposition changes sub-tasks and models per prompt; confidence is randomised so the threshold changes which path is used
- Data files in `src/data/` (benchmarks, models, examples)

## Known issues and open questions

- [ ] The agent still cannot view the PNGs (`frontend/new_request.png`, `frontend/run.png`). The layout was matched to the prototype HTML (`Frontend /wireFrame_assets/index.html`), not to the images. A human must compare the screens.
- [ ] Not tested in a real browser. Only `node --check` on `app.js` and `mockApi.js` and a Node smoke test of `mockApi`.
- [ ] Folder naming: `Frontend /wireFrame_assets` has a trailing space and mixed case. Rename later (for example `wireframe/`) because it can break paths on GitHub and Linux.
- [ ] Results and Settings have no wireframe. They were built to match the style.
- [ ] The JEV Spec Document (Google Doc) has not been checked against the build. Export it to `docs/JEV_Spec.md`.
- [ ] All numbers are simulated. A visible "simulated data" label is not confirmed in the UI.

## Next up

1. Open the app in a browser and run the full flow (example, Run, parallel, fallback, cost, log, replay, Results, Settings, refresh persistence)
2. Compare Run and New request with the two PNGs and list any differences for the agent
3. Export the JEV Spec Document to `docs/JEV_Spec.md` and check routing, judge and evaluation rules against `mockApi.js`
4. Add a visible "simulated data" label to the UI
5. Rename the wireframe folder, update paths, push to GitHub, enable Pages

## Decisions

- Static site, vanilla JS, no build step
- All data comes from `mockApi.js`, with shapes matching a future real backend (see AGENT.md section 8)
- Prototype HTML is the layout source of truth until the PNGs can be compared by a human

## Work log

### 2026-11-09: Rebuild to match wireframe prototype (Kilo Code)
- Rebuilt `index.html`, `style.css`, `app.js`, `mockApi.js` to follow the prototype structure (nav, sub-task table, parallel path, fallback notice, benchmark bars, cost log, verified answer, download and replay)
- Kept the data contract and the four-function API; data files unchanged
- Verified: `node --check` on both JS files, Node smoke test (config, 4 sub-task mixed run, parallel path, totals and savings)
- Not verified: browser run, PNG match

### 2026-11-09: Initial multi-file frontend (Kilo Code)
- Split the single-file prototype into `index.html`, `src/style.css`, `src/app.js`, `src/mockApi.js`, `src/data/*`
- Added `README.md`, `.github/workflows/pages.yml`, updated `.gitignore`
- Verified: `node --check`, Node smoke test of `mockApi.runRequest`
