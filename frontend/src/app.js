(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var RUNS_KEY = 'fintackle.runs';
  var SETTINGS_KEY = 'fintackle.settings';
  var api = window.mockApi;
  var config = null;
  var currentRun = null;
  var running = false;

  function loadRuns() { try { return JSON.parse(localStorage.getItem(RUNS_KEY) || '[]'); } catch (e) { return []; } }
  function saveRuns(runs) { localStorage.setItem(RUNS_KEY, JSON.stringify(runs.slice(0, 50))); }
  function loadSettings() { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch (e) { return {}; } }
  function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function money(n) { return '$' + Number(n || 0).toFixed(3); }
  function secs(ms) { return (Number(ms || 0) / 1000).toFixed(1) + ' s'; }
  function short(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function showView(name) {
    ['new','run','results','settings'].forEach(function (v) {
      var main = $('#view-' + v);
      var tab = $('#tab' + v.charAt(0).toUpperCase() + v.slice(1));
      if (main) main.classList.toggle('hide', v !== name);
      if (tab) tab.classList.toggle('on', v === name);
    });
    if (name === 'results') renderResults();
  }

  function setThresholdOptions(sel, value) {
    var opts = [
      { v: 0.85, t: 'Confidence below 0.85' },
      { v: 0.70, t: 'Confidence below 0.70' },
      { v: 0.78, t: 'Confidence below 0.78' },
      { v: 0.90, t: 'Confidence below 0.90' },
      { v: 0.95, t: 'Confidence below 0.95' }
    ];
    sel.innerHTML = opts.map(function (o) { return '<option value="' + o.v + '"' + (Math.abs(o.v - value) < 0.001 ? ' selected' : '') + '>' + o.t + '</option>'; }).join('');
  }

  function renderExamples() {
    var wrap = $('#examples');
    wrap.innerHTML = (config.examples || []).map(function (ex, i) {
      return '<button type="button" data-i="' + i + '">' + esc(ex.label) + '</button>';
    }).join('');
    wrap.onclick = function (e) {
      var b = e.target.closest('button[data-i]');
      if (!b) return;
      $('#prompt').value = config.examples[Number(b.getAttribute('data-i'))].prompt;
    };
  }

  function renderRecent() {
    var runs = loadRuns();
    var body = $('#recentBody');
    if (!runs.length) { body.innerHTML = '<tr><td colspan="5" class="meta">No runs yet.</td></tr>'; return; }
    body.innerHTML = runs.slice(0, 8).map(function (r) {
      return '<tr><td>' + esc(r.id.slice(-4).toUpperCase()) + '</td><td>' + esc(short(r.prompt, 46)) + '</td><td>' + (r.subtasks || []).length + '</td><td>' + money(r.totals && r.totals.cost) + '</td><td>' + (r.fallbackUsed ? 'Done (fallback)' : 'Done') + '</td></tr>';
    }).join('');
  }

  function renderModels() {
    var b = config.benchmarks || {};
    $('#modelsBody').innerHTML = (config.models || []).map(function (m) {
      return '<tr><td>' + esc(m.name) + '</td><td>' + esc(m.provider) + '</td><td>' + (b.coding && b.coding[m.name] || '—') + '</td><td>' + (b.extraction && b.extraction[m.name] || '—') + '</td><td>' + (b.math && b.math[m.name] || '—') + '</td><td>' + (b.analysis && b.analysis[m.name] || '—') + '</td><td>' + (b.charting && b.charting[m.name] || '—') + '</td><td>' + money(m.costPer1k) + '</td></tr>';
    }).join('');
  }

  function renderBenchmarkPanel(category) {
    var scores = (config.benchmarks || {})[category] || {};
    if (!Object.keys(scores).length) {
      $('#benchmarkPanel').innerHTML = '<div class="meta">No benchmark data.</div>';
      return;
    }
    $('#benchmarkPanel').innerHTML = Object.keys(scores).sort(function (a,b){return scores[b]-scores[a];}).map(function (name) {
      return '<div>' + esc(name) + ' — ' + esc(category) + '</div><div class="meter" style="width:' + scores[name] + '%"></div>';
    }).join('');
  }

  function renderTaskRows(tasks, highlightIndex) {
    var body = $('#taskRows');
    if (!tasks || !tasks.length) { body.innerHTML = '<tr><td colspan="8" class="meta">No sub-tasks.</td></tr>'; return; }
    body.innerHTML = tasks.map(function (t, i) {
      var st = t.status || 'Queued';
      return '<tr' + (i === highlightIndex ? ' class="hl"' : '') + '><td>' + (i + 1) + '</td><td>' + esc(t.type) + '</td><td>' + esc(t.model || '—') + '</td><td>' + (t.confidence != null ? Number(t.confidence).toFixed(2) : '—') + '</td><td>' + esc(t.path || '—') + '</td><td>' + esc(st) + '</td><td>' + (t.cost ? money(t.cost) : '$0') + '</td><td>' + (t.timeMs ? secs(t.timeMs) : '0.0 s') + '</td></tr>';
    }).join('');
  }

  async function doRun(replayRun) {
    if (running) return;
    var prompt = replayRun ? replayRun.prompt : $('#prompt').value.trim();
    if (!prompt) { $('#prompt').focus(); return; }
    var threshold = replayRun ? replayRun.threshold : Number($('#threshold').value);
    var settings = loadSettings();
    var judgeEnabled = typeof settings.judgeEnabled === 'boolean' ? settings.judgeEnabled : config.defaults.judgeEnabled;

    running = true;
    $('#runBtn').disabled = true;
    $('#downloadBtn').disabled = true;
    $('#replayBtn').disabled = true;
    $('#fallbackNotice').classList.add('hide');
    $('#parallelBox').classList.add('hide');
    $('#answer').textContent = 'Running…';
    $('#costLog').textContent = 'Tokens in/out per model\nCost vs single frontier model: –';
    showView('run');

    var preview = api.decomposePrompt(prompt);
    var staged = preview.map(function (t) { return { label: t.label, type: t.type, category: t.category, model: '—', confidence: null, path: '—', status: 'Queued', cost: 0, timeMs: 0 }; });
    $('#runId').textContent = 'pending';
    $('#promptSummary').textContent = short(prompt, 55);
    $('#totalCost').textContent = '$0.000';
    $('#totalTime').textContent = '0.0';
    renderTaskRows(staged, -1);
    renderBenchmarkPanel(preview[0] && preview[0].category || 'analysis');

    var totalCost = 0, totalTime = 0;
    for (var i = 0; i < staged.length; i++) {
      renderBenchmarkPanel(staged[i].category);
      staged[i].status = 'Routing';
      renderTaskRows(staged, i);
      await sleep(220 + Math.random() * 220);
      // provisional route to show progression
      var scores = (config.benchmarks || {})[staged[i].category] || {};
      var best = config.models[0];
      config.models.forEach(function (m) { if ((scores[m.name] || 0) > (scores[best.name] || 0)) best = m; });
      var conf = Math.min(0.98, Math.max(0.42, ((scores[best.name] || 75) / 100) * 0.92 + (Math.random() * 0.18 - 0.06)));
      staged[i].model = conf < threshold ? '3 models' : best.name;
      staged[i].confidence = conf;
      staged[i].path = conf < threshold ? 'Parallel' : 'Single';
      staged[i].status = 'Running';
      renderTaskRows(staged, i);
      if (conf < threshold) showParallelProgress(staged[i], i);
      await sleep(520 + Math.random() * 450);
      staged[i].status = conf < threshold ? 'Judged' : 'Done';
      staged[i].timeMs = Math.round(best.latencyMs * (0.8 + Math.random() * 0.7));
      staged[i].cost = Math.round(((700 + Math.random() * 700) / 1000) * best.costPer1k * 10000) / 10000;
      totalCost += staged[i].cost;
      totalTime += staged[i].timeMs;
      $('#totalCost').textContent = money(totalCost);
      $('#totalTime').textContent = (totalTime / 1000).toFixed(1);
      renderTaskRows(staged, i);
    }

    // Authoritative run for consistent data, log, persistence, and replacement-safe shape.
    var run = await api.runRequest({ prompt: prompt, threshold: threshold, judgeEnabled: judgeEnabled });
    run.totals.timeMs = Math.max(run.totals.timeMs, totalTime);
    currentRun = run;
    var runs = loadRuns();
    runs.unshift(run);
    saveRuns(runs);
    renderRecent();
    renderFinal(run);
    $('#downloadBtn').disabled = false;
    $('#replayBtn').disabled = false;
    running = false;
    $('#runBtn').disabled = false;
  }

  function showParallelProgress(task, index) {
    $('#parallelBox').classList.remove('hide');
    $('#parallelTitle').textContent = 'Sub-task ' + (index + 1) + ' detail: parallel path';
    $('#candidates').innerHTML = (config.models.slice(0, 3)).map(function (m, i) {
      return '<div class="cand"><b>Candidate ' + 'ABC'[i] + '</b><br>' + esc(m.name) + '<br><i>' + esc(task.label) + '</i><br>Running…<br>Judge rank: –</div>';
    }).join('');
    $('#judgeBox').textContent = 'Judge: waiting…';
    $('#sandboxBox').textContent = 'Sandbox: running…';
  }

  function renderFinal(run) {
    $('#runId').textContent = '#' + run.id.slice(-4).toUpperCase();
    $('#promptSummary').textContent = short(run.prompt, 55);
    $('#totalCost').textContent = money(run.totals.cost);
    $('#totalTime').textContent = (run.totals.timeMs / 1000).toFixed(1);
    renderBenchmarkPanel(run.subtasks[0] && run.subtasks[0].category || 'analysis');

    var hl = run.subtasks.findIndex(function (t) { return t.path === 'parallel'; });
    $('#taskRows').innerHTML = run.subtasks.map(function (t, i) {
      var st = t.status || (t.path === 'parallel' ? 'Judged' : 'Done');
      if (t.status && t.status.indexOf('fallback') > -1) st = 'Retried';
      return '<tr' + (i === hl ? ' class="hl"' : '') + '><td>' + (i + 1) + '</td><td>' + esc(t.type) + '</td><td>' + esc(t.path === 'parallel' ? '3 models' : t.model) + '</td><td>' + Number(t.confidence).toFixed(2) + '</td><td>' + esc(t.path === 'parallel' ? 'Parallel' : 'Single') + '</td><td>' + esc(st) + '</td><td>' + money(t.cost) + '</td><td>' + secs(t.timeMs) + '</td></tr>';
    }).join('');

    var fallbacks = (run.events || []).filter(function (e) { return e.type === 'fallback.timeout'; });
    if (fallbacks.length) {
      $('#fallbackNotice').classList.remove('hide');
      $('#fallbackNotice').textContent = 'Fallback notice: ' + fallbacks.map(function (f) { return f.task + ' timed out, retried with ' + f.to; }).join('; ') + '.';
    } else {
      $('#fallbackNotice').classList.add('hide');
    }

    var pTask = run.subtasks.find(function (t) { return t.parallel; });
    if (pTask) {
      var p = pTask.parallel;
      $('#parallelBox').classList.remove('hide');
      $('#parallelTitle').textContent = esc(pTask.label) + ' detail: parallel path';
      $('#candidates').innerHTML = p.candidates.map(function (c) {
        return '<div class="cand' + (c.judgeRank === 1 ? ' win' : '') + '"><b>Candidate ' + esc(c.id) + '</b><br>' + esc(c.model) + '<br><i>' + esc(c.answer) + '</i><br>' + secs(c.latencyMs) + ' · quality ' + c.quality.toFixed(2) + '<br>Judge rank: ' + c.judgeRank + '</div>';
      }).join('');
      $('#judgeBox').textContent = 'Judge: order shuffled, models hidden. ' + (run.judgeEnabled ? 'Winner: Candidate ' + p.selected.id + ' (' + p.selected.model + ').' : 'Post-execution judge off in Settings (simulated ranking shown).');
      $('#sandboxBox').textContent = 'Sandbox: ' + p.sandbox + '.';
    } else {
      $('#parallelBox').classList.add('hide');
    }

    var tok = run.subtasks.map(function (t) { return (Math.round((t.tokens || 1100) / 100) / 10) + 'k/' + (Math.round(((t.tokens || 1100) * 0.28) / 100) / 10) + 'k'; }).join(' · ');
    $('#costLog').innerHTML = 'Tokens in/out per model: ' + esc(tok) + '<br>Cost vs single frontier model (' + esc(run.totals.frontierModel) + ', ' + money(run.totals.frontierCost) + '): <span class="pill">' + run.totals.savedPct + '% lower</span>';
    $('#answer').textContent = run.subtasks.map(function (t) { return t.label + ': ' + t.output; }).join('\n\n');
  }

  function renderResults() {
    var runs = loadRuns();
    var body = $('#resultsBody');
    if (!runs.length) {
      body.innerHTML = '<tr><td colspan="7" class="meta">No past runs.</td></tr>';
      renderComparison([]);
      return;
    }
    body.innerHTML = runs.map(function (r) {
      return '<tr><td>#' + esc(r.id.slice(-4).toUpperCase()) + '</td><td>' + esc(new Date(r.createdAt).toLocaleString()) + '</td><td>' + esc(short(r.prompt, 60)) + '</td><td>' + (r.subtasks || []).length + '</td><td>' + money(r.totals && r.totals.cost) + '</td><td>' + secs(r.totals && r.totals.timeMs) + '</td><td>' + (r.usedParallel ? 'yes' : 'no') + '</td></tr>';
    }).join('');
    renderComparison(runs);
  }

  function renderComparison(runs) {
    var cmp = api.aggregateComparisons(runs);
    var max = Math.max.apply(null, cmp.avgCost.concat([0.001])) * 1.2;
    var w = 640, h = 230, pad = 44, barW = 80, gap = 92;
    var fills = ['var(--bar-fill)', '#999', '#c2c2c2'];
    var bars = cmp.labels.map(function (label, i) {
      var val = cmp.avgCost[i];
      var bh = (val / max) * (h - pad * 2);
      var x = pad + i * (barW + gap);
      var y = h - pad - bh;
      return '<rect x="' + x + '" y="' + y + '" width="' + barW + '" height="' + Math.max(bh,1) + '" fill="' + fills[i] + '"/>' +
        '<text x="' + (x + barW/2) + '" y="' + (y - 6) + '" text-anchor="middle">' + money(val) + '</text>' +
        '<text x="' + (x + barW/2) + '" y="' + (h - pad + 16) + '" text-anchor="middle">' + esc(label) + '</text>' +
        '<text x="' + (x + barW/2) + '" y="' + (h - pad + 31) + '" text-anchor="middle" style="fill:var(--mute)">quality ' + cmp.quality[i] + '</text>';
    }).join('');
    $('#comparisonChart').innerHTML = '<div class="tbl"><svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" style="max-width:' + w + 'px" role="img" aria-label="Routing comparison">' +
      '<line class="g" x1="' + pad + '" y1="' + (h-pad) + '" x2="' + (w-10) + '" y2="' + (h-pad) + '"/>' +
      bars + '</svg></div><div class="meta" style="margin-top:8px">Avg time (dummy): JEV ' + secs(cmp.avgTimeMs[0]) + ', best single ' + secs(cmp.avgTimeMs[1]) + ', random ' + secs(cmp.avgTimeMs[2]) + '. ' + (runs.length ? 'Based on ' + runs.length + ' stored run(s).' : 'Placeholder values until runs exist.') + '</div>';
  }

  function initSettings() {
    var s = loadSettings();
    setThresholdOptions($('#defaultThreshold'), typeof s.threshold === 'number' ? s.threshold : config.defaults.threshold);
    $('#judgeEnabled').checked = s.judgeEnabled !== false;
    $('#saveSettings').onclick = function () {
      var next = { threshold: Number($('#defaultThreshold').value), judgeEnabled: $('#judgeEnabled').checked };
      saveSettings(next);
      config.defaults = next;
      setThresholdOptions($('#threshold'), next.threshold);
      $('#settingsMsg').textContent = 'Saved.';
      setTimeout(function () { $('#settingsMsg').textContent = ''; }, 1800);
    };
  }

  async function init() {
    config = await api.getConfig();
    var s = loadSettings();
    setThresholdOptions($('#threshold'), typeof s.threshold === 'number' ? s.threshold : config.defaults.threshold);
    renderExamples();
    renderRecent();
    renderModels();
    renderBenchmarkPanel('analysis');
    initSettings();

    document.querySelectorAll('.tabs button[data-view]').forEach(function (b) {
      b.addEventListener('click', function () { showView(b.getAttribute('data-view')); });
    });
    $('#runBtn').addEventListener('click', function () { doRun(null); });
    $('#replayBtn').addEventListener('click', function () { if (currentRun) doRun(currentRun); });
    $('#downloadBtn').addEventListener('click', function () {
      if (!currentRun) return;
      var blob = new Blob([JSON.stringify(currentRun, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = currentRun.id + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
    renderResults();
  }

  init().catch(function (e) {
    var el = document.createElement('pre');
    el.style.padding = '16px'; el.style.color = 'crimson';
    el.textContent = 'App init failed: ' + (e && e.stack || e);
    document.body.appendChild(el);
  });
})();
