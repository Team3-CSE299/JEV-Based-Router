# AGENT.md: LLM Operating Specification

Project: **JEV-based router (Fintackle)**
Applies to: every AI coding agent working in this repository (Kilo Code, Claude, Copilot, etc.).
These rules override the agent's defaults. If a user instruction conflicts with them, say so and ask before proceeding.

---

## 1. Mandatory pre-flight (before ANY task)

Before executing any task, code update, or design modification, the agent MUST complete these steps in order. Do not write or change a file until all are done.

1. **Read `status.md`** (repo root).
   - Identify the current project state, the last completed work, open items, and known issues.
   - Read the work log, newest entries first, so you do not redo or undo earlier work.
2. **Read the project Google Doc: `JEV Spec Document`.**
   - It holds the core architectural requirements (routing logic, parallel path and judge rules, evaluation plan).
   - If you cannot open it (no access, login wall, tool not available), **stop and tell the user**. Do not guess its contents. Ask the user to either grant access or export it to `docs/JEV_Spec.md`, and then read that copy.
   - If the Google Doc and this file disagree, the Google Doc wins on architecture. Report the conflict.
3. **State a short plan** (3-6 lines) that names the files you will touch and why, and that confirms it fits both `status.md` and the spec.
4. Only then start the work.

If any pre-flight step fails, report which one and why, and wait for the user.

## 2. Mandatory post-flight (after ANY task)

1. Update `status.md`:
   - Add a log entry (date, what changed, files touched).
   - Move finished items out of "Next up", add newly found issues.
2. Tell the user in 3-5 lines what changed and how to check it.
3. Never claim something works unless you ran it or clearly say it is untested.

## 3. Project rules

**Architecture**
- The app is a static frontend in `frontend/` (plain HTML, CSS, vanilla JS). No framework, no build step unless the user asks.
- `frontend/src/mockApi.js` is the **only** place that produces data. The UI never invents data itself.
- Every function in `mockApi.js` must keep the same input/output shape a real backend would return, so it can later be replaced with `fetch()` calls without changing the UI.
- Do not add a backend, database, API keys, or external services unless the user asks.

**Design**
- Follow the wireframe prototype (`Frontend /wireFrame_assets/index.html`) and the images `frontend/new_request.png` and `frontend/run.png`. The prototype is the layout reference for the New request and Run screens.
- Results and Settings have no wireframe. Build them in the same style and say so in `status.md`.
- Monochrome, clean, readable on mobile, supports dark mode.
- If you cannot view an image or a reference file, say so. Do not pretend you matched it. List which parts were matched from the prototype HTML and which parts could not be checked against the PNGs.

**Behaviour that must be preserved**
- Parallel path runs only when a sub-task's confidence is below the chosen threshold.
- The judge sees candidates in shuffled order with model names hidden, and a model never judges its own output.
- A timed-out sub-task is retried with the next-ranked model, and the UI shows a fallback notice.
- Cost log shows the percentage saved against a single frontier model.
- Run logs are downloadable as JSON, and any run can be replayed.

**Honesty about data**
- All numbers are dummy data until a real backend exists. Label them as simulated in the UI or README. Never present them as real benchmark results.

## 4. Code and change rules

- Smallest change that does the job. No unrelated refactors, renames, or reformatting.
- Do not delete files, rewrite history, or force-push without asking.
- Never commit secrets, tokens, or `.env` files.
- Keep files readable: short functions, clear names, comments only where intent is not obvious.
- Run what you can (`node --check`, a smoke test, or the local server) and report what you could not run.

## 5. Git rules

- Work on a branch named `feat/<short-name>` or `fix/<short-name>`. Do not commit straight to `main` unless the user says so.
- Commit messages: imperative, one line (e.g. `Add results comparison chart`).
- Do not push unless the user asks.

## 6. When to stop and ask

Stop and ask the user when:
- the task contradicts `status.md` or the JEV Spec Document,
- the requirement is ambiguous in a way that changes the architecture,
- the task would need a backend, new dependency, or paid service,
- you are about to delete or overwrite work you did not create in this task.

## 7. Repo map (actual layout, as of 2026-11-09)

```
jev_based_router/
├── AGENT.md            this file
├── status.md           project state and work log (read first, update last)
├── README.md           how to run, structure, how to swap mockApi.js for a real backend
├── docs/               exported spec copies (e.g. JEV_Spec.md)
├── .github/workflows/pages.yml
└── frontend/
    ├── index.html      fixed entry point, 4 tabs
    ├── new_request.png, run.png      wireframe images
    ├── src/
    │   ├── style.css
    │   ├── app.js      UI, navigation, localStorage, run rendering, SVG chart
    │   ├── mockApi.js  the ONLY data producer
    │   └── data/       benchmarks, models, examples (.json and .js)
    └── (reference prototype lives in `Frontend /wireFrame_assets/`)
```

Folder-name warning: the reference folder is currently named `Frontend /wireFrame_assets` (capital F, trailing space, mixed case). Do not rename or move it without asking the user. Flag it in `status.md` as a cleanup item, because spaces and case differences break paths on GitHub Pages and on Linux.

## 8. Public API contract of mockApi.js (do not change shapes without asking)

- `getConfig()` returns config, models and benchmarks.
- `decomposePrompt(prompt)` returns the sub-task list built from keywords (extract, calculate, refactor, chart, analysis).
- `runRequest({prompt, threshold, judgeEnabled})` returns a run object: `subtasks[]` (`status`, `cost`, `timeMs`, `confidence`, `model`, `path`, `parallel`, `output`), `events[]`, `usedParallel`, `fallbackUsed`, `totals` (`cost`, `timeMs`, `frontierModel`, `frontierCost`, `savedPct`).
- `aggregateComparisons(runs)` returns the JEV vs best-single vs random-routing figures.
