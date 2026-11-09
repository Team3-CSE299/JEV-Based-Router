# JEV-Based Router (Fintackle)

Frontend demo for a university project (CSE299). It shows a web UI for a system that takes a mixed financial/technical prompt, decomposes it into sub-tasks, routes each sub-task to the best LLM using live benchmark scores (simulated), and runs low-confidence sub-tasks through a parallel path (3 candidate models + judge + sandbox check). **No backend and no real LLM calls** — all data is dummy, produced in `frontend/src/mockApi.js` with fake latency so it feels like a working product.

## Run it

**Option A — open directly (no build step):**
1. Open `frontend/index.html` in a browser.

**Option B — local static server (recommended for consistent behavior):**
```bash
cd frontend
python3 -m http.server 4173
# then open http://localhost:4173
```

## Folder structure

```
frontend/
  index.html                  # App shell and tabs (New request, Run, Results, Settings)
  src/
    style.css                 # Responsive, dark-mode, monochrome wireframe look
    app.js                    # UI, navigation, localStorage, rendering
    mockApi.js                # ONLY place that produces run data (async + fake latency)
    data/
      benchmarks.json         # Benchmark scores by category/model
      models.json             # Model catalog + cost/latency metadata
      examples.json           # Example prompts
      benchmarks.js           # Same data exposed on window for file:// usage
      models.js
      examples.js
.github/workflows/pages.yml   # Deploys frontend/ to GitHub Pages on push to main
```

## Replace `mockApi.js` with a real backend

Keep every data-producing function in `mockApi.js` and preserve its input/output shape; the UI only calls these functions:

| Function | Purpose | Returns |
|---|---|---|
| `getConfig()` | Load benchmarks, models, examples, defaults | `{ benchmarks, models, examples, defaults }` |
| `runRequest({ prompt, threshold, judgeEnabled })` | Run decomposition/routing/parallel/judge/sandbox (simulated) | run object with `id, createdAt, prompt, subtasks[], events[], usedParallel, fallbackUsed, totals` |
| `aggregateComparisons(runs)` | Results comparison data | `{ labels, avgCost, avgTimeMs, quality }` |
| `decomposePrompt(prompt)` | Preview decomposition (used by UI) | sub-task descriptors |

To connect a Python API later, replace implementations with `fetch()` calls, e.g.:

```js
async function runRequest(payload) {
  const res = await fetch("/api/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Run failed");
  return res.json();
}
```

Keep the returned run shape stable (`subtasks` with `status/cost/timeMs/confidence/model/path/parallel/output`, and `totals` with `cost/timeMs/frontierModel/frontierCost/savedPct`) so `app.js` does not need UI changes.

## GitHub Pages

`.github/workflows/pages.yml` uploads the `frontend/` directory as a Pages artifact and deploys it when `main` is updated. In the repository settings, set **Pages → Source** to **GitHub Actions**.
