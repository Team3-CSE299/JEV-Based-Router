/* mockApi.js — ONLY place that produces data.
   Async functions + fake latency. UI creates no run data.
   To replace with a real backend: swap implementations with fetch() calls
   that return the same shapes. Keep function names/signatures stable.
*/
(function () {
  'use strict';
  var delay = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var jitter = function (base, spread) { spread = spread == null ? 0.25 : spread; return Math.max(60, Math.round(base * (1 + (Math.random() * 2 - 1) * spread))); };
  var money = function (n) { return Math.round(n * 10000) / 10000; };
  var clamp = function (n, a, b) { return Math.min(b, Math.max(a, n)); };
  var pick = function (arr) { return arr[Math.floor(Math.random() * arr.length)]; };

  var BENCHMARKS = (typeof window !== 'undefined' && window.BENCHMARKS) || {};
  var MODELS = (typeof window !== 'undefined' && window.MODELS) || [];
  var EXAMPLES = (typeof window !== 'undefined' && window.EXAMPLES) || [];

  function uid() { return 'run_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); }
  function getSettings() { try { return JSON.parse(localStorage.getItem('fintackle.settings') || '{}'); } catch (e) { return {}; } }

  function getConfig() {
    return delay(80).then(function () {
      var settings = getSettings();
      return {
        benchmarks: BENCHMARKS,
        models: MODELS,
        examples: EXAMPLES,
        defaults: {
          threshold: typeof settings.threshold === 'number' ? settings.threshold : 0.85,
          judgeEnabled: settings.judgeEnabled !== false
        }
      };
    });
  }

  function decomposePrompt(prompt) {
    var p = String(prompt || '').toLowerCase();
    var tasks = [];
    var add = function (type, label, category) { tasks.push({ id: 't' + (tasks.length + 1), type: type, label: label, category: category }); };
    if (/extract|table|parse|pull|filing|debt|cash|income/.test(p)) add('Extraction', 'Extract structured data/table', 'extraction');
    if (/calculat|growth|margin|throughput|sum|average|percent|yoy|year/.test(p)) add('Calculation', 'Calculate metrics', 'math');
    if (/refactor|code|script|pipeline|function|bug|fix/.test(p)) add('Code', 'Refactor/analyze code', 'coding');
    if (/chart|graph|plot|visual|bar/.test(p)) add('Chart', 'Chart the result', 'charting');
    if (/summar|analy[sz]|bottleneck|insight|compare|risk/.test(p)) add('Analysis', 'Analyze findings', 'analysis');
    if (!tasks.length) {
      add('Analysis', 'Analyze the request', 'analysis');
      add('Extraction', 'Extract key information', 'extraction');
      add('Calculation', 'Compute supporting metrics', 'math');
    }
    return tasks.slice(0, 5);
  }

  function routeTask(task, models, benchmarks) {
    var scores = benchmarks[task.category] || {};
    var best = null;
    models.forEach(function (m) {
      var score = scores[m.name] != null ? scores[m.name] : 75;
      var value = score - m.costPer1k * 700;
      if (!best || value > best.value) best = { model: m, score: score, value: value };
    });
    if (!best) best = { model: { name: 'Model', id: 'm', costPer1k: 0.01, latencyMs: 800 }, score: 80 };
    var baseConf = (best.score / 100) * 0.93;
    var confidence = clamp(baseConf + (Math.random() * 0.22 - 0.09), 0.42, 0.98);
    var tokens = Math.round(650 + Math.random() * 1000);
    return {
      model: best.model.name, modelId: best.model.id, benchmarkScore: best.score,
      confidence: confidence, tokens: tokens,
      cost: money((tokens / 1000) * best.model.costPer1k),
      timeMs: jitter(best.model.latencyMs + tokens * 0.12)
    };
  }

  function makeCandidates(task, models, benchmarks) {
    var scores = benchmarks[task.category] || {};
    var ranked = models.slice().sort(function (a, b) { return (scores[b.name] || 0) - (scores[a.name] || 0); });
    var picks = ranked.slice(0, 3);
    while (picks.length < 3 && models.length) picks.push(models[picks.length % models.length]);
    var candidates = picks.map(function (m, i) {
      var q = clamp(((scores[m.name] || 75) / 100) + (Math.random() * 0.18 - 0.09), 0.45, 0.99);
      return {
        id: String.fromCharCode(65 + i), model: m.name, quality: q,
        latencyMs: jitter(m.latencyMs),
        answer: '[' + m.name + '] ' + task.label + ': produced a plausible ' + task.type.toLowerCase() + ' result (dummy).'
      };
    });
    candidates.sort(function (a, b) { return b.quality - a.quality; });
    candidates.forEach(function (c, i) { c.judgeRank = i + 1; });
    return {
      candidates: candidates, selected: candidates[0],
      sandbox: Math.random() > 0.08 ? 'tests passed 3/3' : 'tests passed 3/3 (retry)',
      judge: 'Judge model (dummy): order shuffled, models hidden; ranked by task fit, consistency, and format checks.'
    };
  }

  function runRequest(opts) {
    var prompt = opts.prompt, threshold = opts.threshold, judgeEnabled = opts.judgeEnabled;
    var startedAt = Date.now();
    return getConfig().then(function (config) {
      var runId = uid();
      var tasks = decomposePrompt(prompt);
      var events = [];
      var subtasks = [];
      var usedParallel = false;
      var fallbackUsed = false;
      var chain = Promise.resolve();
      tasks.forEach(function (task) {
        chain = chain.then(function () {
          events.push({ at: Date.now() - startedAt, type: 'subtask.start', task: task.label });
          return delay(jitter(180, 0.35)).then(function () {
            var routed = routeTask(task, config.models, config.benchmarks);
            var result = {
              label: task.label, type: task.type, category: task.category,
              model: routed.model, benchmarkScore: routed.benchmarkScore,
              confidence: routed.confidence, status: 'Done',
              cost: routed.cost, timeMs: routed.timeMs, tokens: routed.tokens,
              path: routed.confidence < threshold ? 'parallel' : 'direct',
              output: '[' + routed.model + '] Completed "' + task.label + '" (confidence ' + routed.confidence.toFixed(2) + ', dummy).'
            };
            if (result.path === 'direct' && Math.random() < 0.14) {
              fallbackUsed = true;
              var alt = pick(config.models.filter(function (m) { return m.name !== routed.model; })) || config.models[0];
              events.push({ type: 'fallback.timeout', task: task.label, from: routed.model, to: alt.name });
              return delay(jitter(240)).then(function () {
                result.model = alt.name; result.status = 'Done (fallback)';
                result.timeMs = result.timeMs + jitter(alt.latencyMs);
                result.cost = money(result.cost + (850 / 1000) * alt.costPer1k);
                result.output = '[' + alt.name + ' fallback] Completed "' + task.label + '" after timeout on ' + routed.model + ' (dummy).';
                subtasks.push(result);
              });
            }
            if (result.path === 'parallel') {
              usedParallel = true;
              return delay(jitter(300)).then(function () {
                var parallel = makeCandidates(task, config.models, config.benchmarks);
                var judgeCost = judgeEnabled ? money(0.002 + Math.random() * 0.0025) : 0;
                result.cost = money(result.cost + parallel.candidates.reduce(function (s, c) { return s + 0.0035 + Math.random() * 0.003; }, 0) + judgeCost);
                result.timeMs = result.timeMs + Math.max.apply(null, parallel.candidates.map(function (c) { return c.latencyMs; })) + (judgeEnabled ? 220 : 0);
                result.parallel = parallel; result.judgeEnabled = !!judgeEnabled;
                result.output = parallel.selected.answer;
                result.confidence = clamp(parallel.selected.quality, result.confidence, 0.99);
                events.push({ type: 'parallel', task: task.label, selected: parallel.selected.model });
                subtasks.push(result);
              });
            }
            subtasks.push(result);
          }).then(function () { events.push({ type: 'subtask.done', task: task.label }); return delay(jitter(90, 0.4)); });
        });
      });
      return chain.then(function () {
        var totalCost = money(subtasks.reduce(function (s, t) { return s + t.cost; }, 0));
        var totalTimeMs = Math.max(Date.now() - startedAt, subtasks.reduce(function (s, t) { return s + t.timeMs; }, 0));
        var frontier = config.models.reduce(function (a, b) { return a.costPer1k > b.costPer1k ? a : b; }, config.models[0] || { name: 'Frontier', costPer1k: 0.03 });
        var estTokens = subtasks.reduce(function (s, t) { return s + (t.tokens || 1100); }, 0);
        var frontierCost = money((estTokens / 1000) * frontier.costPer1k);
        var savedPct = frontierCost > 0 ? Math.max(0, Math.round((1 - totalCost / frontierCost) * 100)) : 0;
        return {
          id: runId, createdAt: new Date().toISOString(), prompt: prompt,
          threshold: threshold, judgeEnabled: !!judgeEnabled,
          subtasks: subtasks, events: events,
          usedParallel: usedParallel, fallbackUsed: fallbackUsed,
          totals: { cost: totalCost, timeMs: totalTimeMs, frontierModel: frontier.name, frontierCost: frontierCost, savedPct: savedPct }
        };
      });
    });
  }

  function aggregateComparisons(runs) {
    var n = Math.max((runs || []).length, 1);
    var jev = money(runs.reduce(function (s, r) { return s + ((r.totals && r.totals.cost) || 0); }, 0) / n || 0.022);
    var bestSingle = money(runs.reduce(function (s, r) { return s + ((r.totals && r.totals.frontierCost) || 0); }, 0) / n || 0.036);
    var random = money(bestSingle * 0.9);
    var jevTime = Math.round(runs.reduce(function (s, r) { return s + ((r.totals && r.totals.timeMs) || 0); }, 0) / n || 4200);
    return {
      labels: ['JEV routing', 'Best single model', 'Random routing'],
      avgCost: [jev, bestSingle, random],
      avgTimeMs: [jevTime, Math.round(jevTime * 0.82), Math.round(jevTime * 1.08)],
      quality: [91, 89, 74]
    };
  }

  window.mockApi = { getConfig: getConfig, runRequest: runRequest, aggregateComparisons: aggregateComparisons, decomposePrompt: decomposePrompt };
})();
