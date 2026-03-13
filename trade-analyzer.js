// trade-analyzer.js
// ff-trade-analyzer v0.1.0 (2026-03-13)
// PART1–5 integrated: CSV + Stats + Symbol + Martin + SWOT + AI stub

// ================== PART 1: Global + CSV + Stats + Symbol ==================

let globalTrades = [];
let globalBySymbol = {};
let globalEAKey = "SMA";

let equityChart, weekdayChart, symbolProfitChart;
let mfeChart, maeChart, holdingChart;
let symbolCumulativeChart,
  symbolWeekdayProfitChart,
  symbolWeekdayCountChart,
  symbolHourlyProfitChart,
  symbolHourlyCountChart;

let mfeMaeMode = "pips"; // "pips" | "money"
let cumulativeMode = "all"; // "all" | "separate"

// ---------- Theme Switch ----------
(function setupThemeSwitch() {
  const html = document.documentElement;
  const themeInput = document.getElementById("themeSwitch");
  if (!themeInput) return;

  const saved = localStorage.getItem("theme") || "light";
  html.setAttribute("data-theme", saved);
  themeInput.checked = saved === "dark";

  themeInput.addEventListener("change", () => {
    const theme = themeInput.checked ? "dark" : "light";
    html.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  });
})();

// ---------- Cumulative Switch ----------
(function setupCumSwitch() {
  const cumInput = document.getElementById("cumSwitch");
  if (!cumInput) return;

  cumulativeMode = "all";
  cumInput.checked = false;

  cumInput.addEventListener("change", () => {
    cumulativeMode = cumInput.checked ? "separate" : "all";
    const activeSymbolBtn = document.querySelector(".symbol-btn.active");
    const sym = activeSymbolBtn ? activeSymbolBtn.dataset.symbol : "ALL";
    const trades = sym === "ALL" ? globalTrades : globalBySymbol[sym] || [];
    renderSymbolExtraCharts(sym, trades);
  });
})();

// Analyze button
const analyzeBtn = document.getElementById("analyzeBtn");
if (analyzeBtn) {
  analyzeBtn.addEventListener("click", handleAnalyze);
}

// Reset button
const resetBtn = document.getElementById("resetBtn");
if (resetBtn) resetBtn.addEventListener("click", resetView);

// Pips / Money switch for MFE/MAE/Holding
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".toggle-mode");
  if (!btn) return;
  const mode = btn.dataset.mode;
  if (!mode || mode === mfeMaeMode) return;

  mfeMaeMode = mode;
  document
    .querySelectorAll(".toggle-mode")
    .forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));

  const activeSymbolBtn = document.querySelector(".symbol-btn.active");
  const sym = activeSymbolBtn ? activeSymbolBtn.dataset.symbol : "ALL";
  const trades = sym === "ALL" ? globalTrades : globalBySymbol[sym] || [];
  renderMfeMaeHoldingCharts(trades);
});

function handleAnalyze() {
  const fileInput = document.getElementById("csvFile");
  const file = fileInput ? fileInput.files[0] : null;
  if (!file) {
    alert("請先選擇 CSV 檔案");
    return;
  }

  const eaSelect = document.getElementById("eaSelect");
  globalEAKey = eaSelect ? eaSelect.value : "SMA";

  const reader = new FileReader();
  reader.onload = (e) => {
    parseCsv(e.target.result);
    buildAll();
  };
  reader.readAsText(file);
}

// ---------- CSV 解析 ----------
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) {
    globalTrades = [];
    globalBySymbol = {};
    return;
  }

  const headers = lines[0].split(",");
  const idx = (name) =>
    headers.findIndex(
      (h) => h.trim().toLowerCase() === name.trim().toLowerCase()
    );

  const iOpenTime =
    idx("open time") !== -1 ? idx("open time") : idx("Open Time");
  const iCloseTime =
    idx("close time") !== -1 ? idx("close time") : idx("Close Time");
  const iType = idx("type");
  const iLots = idx("lots") !== -1 ? idx("lots") : idx("volume");
  const iSymbol = idx("symbol");
  const iNetProfit =
    idx("net profit") !== -1 ? idx("net profit") : idx("profit");
  const iNetPips = idx("net pips") !== -1 ? idx("net pips") : idx("pips");
  const iMFE = idx("mfe") !== -1 ? idx("mfe") : idx("max profit pips");
  const iMAE = idx("mae") !== -1 ? idx("mae") : idx("max loss pips");
  const iHold = idx("holding time") !== -1 ? idx("holding time") : -1;

  const trades = [];

  for (let i = 1; i < lines.length; i++) {
    const rowRaw = lines[i];
    if (!rowRaw.trim()) continue;
    const cells = rowRaw.split(",");
    if (iType < 0 || iSymbol < 0) continue;

    const type = (cells[iType] || "").trim().toLowerCase();
    if (type !== "buy" && type !== "sell") continue;

    const t = {
      openTime: iOpenTime >= 0 ? cells[iOpenTime] || "" : "",
      closeTime: iCloseTime >= 0 ? cells[iCloseTime] || "" : "",
      type,
      symbol: (cells[iSymbol] || "").trim(),
      lots: iLots >= 0 ? parseFloat(cells[iLots] || "0") || 0 : 0,
      netProfit:
        iNetProfit >= 0 ? parseFloat(cells[iNetProfit] || "0") || 0 : 0,
      netPips: iNetPips >= 0 ? parseFloat(cells[iNetPips] || "0") || 0 : 0,
      mfe: iMFE >= 0 ? parseFloat(cells[iMFE] || "0") || 0 : 0,
      mae: iMAE >= 0 ? parseFloat(cells[iMAE] || "0") || 0 : 0,
      holdingRaw: iHold === -1 ? "" : cells[iHold] || ""
    };
    t.holdingDays = parseHoldingToDays(t.holdingRaw);
    trades.push(t);
  }

  globalTrades = trades;
  globalBySymbol = groupBySymbol(trades);
}

function parseHoldingToDays(text) {
  if (!text) return 0;
  const t = text.toLowerCase().trim();

  if (t.endsWith("days") || t.endsWith("day")) {
    const v = parseFloat(t);
    return isNaN(v) ? 0 : v;
  }
  if (t.endsWith("hrs") || t.endsWith("hours") || t.endsWith("hr")) {
    const v = parseFloat(t);
    return isNaN(v) ? 0 : v / 24.0;
  }
  return 0;
}

function groupBySymbol(trades) {
  const map = {};
  for (const t of trades) {
    if (!t.symbol) continue;
    if (!map[t.symbol]) map[t.symbol] = [];
    map[t.symbol].push(t);
  }
  return map;
}

// ---------- 基本統計 ----------
function buildStats(trades) {
  const totalTrades = trades.length;
  if (!totalTrades) return null;

  let grossProfit = 0;
  let grossLoss = 0;
  let profitTrades = 0;
  let lossTrades = 0;
  let maxConsecLoss = 0;
  let curConsecLoss = 0;
  let cum = 0;
  let peak = 0;
  let maxDD = 0;

  for (const t of trades) {
    const p = t.netProfit;
    if (p > 0) {
      profitTrades++;
      grossProfit += p;
      curConsecLoss = 0;
    } else if (p < 0) {
      lossTrades++;
      grossLoss += -p;
      curConsecLoss++;
      if (curConsecLoss > maxConsecLoss) maxConsecLoss = curConsecLoss;
    }
    cum += p;
    if (cum > peak) peak = cum;
    const dd = peak - cum;
    if (dd > maxDD) maxDD = dd;
  }

  const winRate = profitTrades / totalTrades || 0;
  const lossRate = lossTrades / totalTrades || 0;
  const avgWin = profitTrades ? grossProfit / profitTrades : 0;
  const avgLoss = lossTrades ? grossLoss / lossTrades : 0;
  const expectancy = avgWin * winRate - avgLoss * lossRate;
  const pf =
    grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  return {
    totalTrades,
    grossProfit,
    grossLoss,
    profitTrades,
    lossTrades,
    winRate,
    lossRate,
    avgWin,
    avgLoss,
    expectancy,
    profitFactor: pf,
    maxDrawdown: maxDD,
    maxConsecLoss
  };
}

function buildAccountSummary() {
  const stats = buildStats(globalTrades);
  const bySymbolProfit = {};
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  let cum = 0;
  const curve = [];
  let firstTime = null;
  let lastTime = null;

  for (const t of globalTrades) {
    cum += t.netProfit;
    const ts = new Date(t.closeTime || t.openTime);
    const label = isNaN(ts.getTime()) ? "" : ts.toISOString().slice(0, 10);
    const wd = ts.getDay();
    weekdayCounts[wd]++;

    bySymbolProfit[t.symbol] = (bySymbolProfit[t.symbol] || 0) + t.netProfit;
    curve.push({ x: label, y: cum });

    if (!firstTime || ts < firstTime) firstTime = ts;
    if (!lastTime || ts > lastTime) lastTime = ts;
  }

  const symbolRanking = Object.entries(bySymbolProfit).sort(
    (a, b) => b[1] - a[1]
  );

  return { stats, weekdayCounts, symbolRanking, curve, firstTime, lastTime };
}

// ---------- Collapsible ----------
document.addEventListener("click", (e) => {
  const header = e.target.closest(".collapsible-header");
  if (!header) return;
  const targetId = header.dataset.target;
  if (!targetId) return;
  const body = document.getElementById(targetId);
  if (!body) return;

  const btn = header.querySelector(".collapse-toggle");
  const isCollapsed = body.classList.toggle("collapsed");
  if (isCollapsed) {
    body.style.maxHeight = "0px";
    if (btn) btn.textContent = "＋";
  } else {
    body.style.maxHeight = body.scrollHeight + "px";
    if (btn) btn.textContent = "－";
  }
});

function expandBody(id) {
  const body = document.getElementById(id);
  if (!body) return;
  body.classList.remove("collapsed");
  body.style.maxHeight = body.scrollHeight + "px";
}

// ---------- 總流程 / RESET ----------
function buildAll() {
  if (!globalTrades.length) {
    alert("CSV 內沒有有效交易紀錄");
    return;
  }

  const acc = buildAccountSummary();
  renderSummaryCards(acc);
  document.getElementById("summaryCardsSection").style.display = "block";
  expandBody("summaryCardsBody");

  renderAccountStats(acc.stats);
  renderMinimumArea(acc.stats);
  renderAccountCharts(acc);
  document.getElementById("accountSection").style.display = "block";
  expandBody("accountBody");

  renderSymbolButtons();
  document.getElementById("symbolSection").style.display = "block";
  renderSymbolMiniCharts();
  expandBody("symbolBody");

  renderSymbol("ALL");
}

function resetView() {
  globalTrades = [];
  globalBySymbol = {};
  globalEAKey = "SMA";
  mfeMaeMode = "pips";
  cumulativeMode = "all";

  if (equityChart) equityChart.destroy();
  if (weekdayChart) weekdayChart.destroy();
  if (symbolProfitChart) symbolProfitChart.destroy();
  if (mfeChart) mfeChart.destroy();
  if (maeChart) maeChart.destroy();
  if (holdingChart) holdingChart.destroy();
  if (symbolCumulativeChart) symbolCumulativeChart.destroy();
  if (symbolWeekdayProfitChart) symbolWeekdayProfitChart.destroy();
  if (symbolWeekdayCountChart) symbolWeekdayCountChart.destroy();
  if (symbolHourlyProfitChart) symbolHourlyProfitChart.destroy();
  if (symbolHourlyCountChart) symbolHourlyCountChart.destroy();

  equityChart = weekdayChart = symbolProfitChart = null;
  mfeChart = maeChart = holdingChart = null;
  symbolCumulativeChart =
    symbolWeekdayProfitChart =
    symbolWeekdayCountChart =
    symbolHourlyProfitChart =
    symbolHourlyCountChart =
      null;

  const hideIds = [
    "summaryCardsSection",
    "accountSection",
    "symbolSection",
    "symbolDetailSection",
    "swotSection",
    "martinSection"
  ];
  hideIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  const clearIds = [
    "accountStats",
    "symbolButtons",
    "symbolMiniCharts",
    "symbolStats",
    "martinTables",
    "minimumArea",
    "swotST",
    "swotS",
    "swotSW",
    "swotT",
    "swotW",
    "swotOT",
    "swotO",
    "swotOW",
    "eaCenterAnalysis"
  ];
  clearIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });

  const summaryDefaults = {
    growthValue: "0 %",
    growthPeriod: "",
    radarAlgo: "EA Radar",
    radarProfitTrades: "",
    radarLossTrades: "",
    radarMaxDD: "",
    radarPF: "",
    radarActivity: "",
    equityValue: "0.00",
    profitValue: "0.00",
    initialDepositValue: "0.00"
  };
  Object.entries(summaryDefaults).forEach(([id, text]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  });

  const equityBar = document.getElementById("equityBar");
  const profitBar = document.getElementById("profitBar");
  if (equityBar) equityBar.style.width = "0%";
  if (profitBar) profitBar.style.width = "0%";

  const fileInput = document.getElementById("csvFile");
  if (fileInput) fileInput.value = "";

  const eaSelect = document.getElementById("eaSelect");
  if (eaSelect) eaSelect.value = "SMA";

  const symbolTitle = document.getElementById("symbolTitle");
  if (symbolTitle) symbolTitle.textContent = "5. Symbol 深入分析 📊";

  const eaTag = document.getElementById("eaTag");
  if (eaTag) eaTag.textContent = "EA";

  document
    .querySelectorAll(".toggle-mode")
    .forEach((b) => b.classList.remove("active"));
  const pipsBtn = document.querySelector('.toggle-mode[data-mode="pips"]');
  if (pipsBtn) pipsBtn.classList.add("active");

  const themeInput = document.getElementById("themeSwitch");
  if (themeInput) {
    themeInput.checked = false;
    document.documentElement.setAttribute("data-theme", "light");
    localStorage.setItem("theme", "light");
  }

  const cumInput = document.getElementById("cumSwitch");
  if (cumInput) cumInput.checked = false;
  cumulativeMode = "all";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ---------- 帳戶摘要卡 ----------
function renderSummaryCards(acc) {
  const stats = acc.stats;
  const netProfit = stats.grossProfit - stats.grossLoss;
  const initialDeposit = 5000;
  const equity = initialDeposit + netProfit;
  const growthPct = (equity / initialDeposit - 1) * 100;

  const periodDays =
    acc.firstTime && acc.lastTime
      ? Math.max(
          1,
          Math.round(
            (acc.lastTime.getTime() - acc.firstTime.getTime()) /
              (1000 * 3600 * 24)
          )
        )
      : 0;
  const weeks = (periodDays / 7).toFixed(1);

  document.getElementById("growthValue").textContent =
    growthPct.toFixed(2) + " %";
  document.getElementById("growthPeriod").textContent = "Week(s): " + weeks;

  const radarProfit = document.getElementById("radarProfitTrades");
  const radarLoss = document.getElementById("radarLossTrades");
  const radarMaxDD = document.getElementById("radarMaxDD");
  const radarPF = document.getElementById("radarPF");
  const radarActivity = document.getElementById("radarActivity");

  if (radarProfit)
    radarProfit.textContent = (stats.winRate * 100).toFixed(1) + " %";
  if (radarLoss)
    radarLoss.textContent = (stats.lossRate * 100).toFixed(1) + " %";
  if (radarMaxDD) radarMaxDD.textContent = stats.maxDrawdown.toFixed(2);
  if (radarPF)
    radarPF.textContent =
      stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2);
  if (radarActivity) radarActivity.textContent = stats.totalTrades + " trades";

  document.getElementById("equityValue").textContent = equity.toFixed(2);
  document.getElementById("profitValue").textContent = netProfit.toFixed(2);
  document.getElementById("initialDepositValue").textContent =
    initialDeposit.toFixed(2);

  const equityPct = Math.min(100, (equity / initialDeposit) * 20);
  const profitPct = Math.min(100, Math.abs(netProfit / initialDeposit) * 20);
  document.getElementById("equityBar").style.width = equityPct + "%";
  document.getElementById("profitBar").style.width = profitPct + "%";
}

// ---------- 帳戶總覽圖表 + MINIMUM ----------
function renderAccountStats(stats) {
  const net = stats.grossProfit - stats.grossLoss;
  const el = document.getElementById("accountStats");
  el.innerHTML = `
    <div class="account-row">
      <span>總交易: ${stats.totalTrades}</span>
      <span>勝率: ${(stats.winRate * 100).toFixed(1)}%</span>
      <span>淨盈利: ${net.toFixed(2)}</span>
      <span>Profit Factor: ${
        stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)
      }</span>
    </div>
    <div class="account-row">
      <span>期望值/單: ${stats.expectancy.toFixed(2)}</span>
      <span>最大回撤: ${stats.maxDrawdown.toFixed(2)}</span>
      <span>最大連虧: ${stats.maxConsecLoss}</span>
    </div>
  `;
}

function renderMinimumArea(stats) {
  const el = document.getElementById("minimumArea");
  if (!el) return;
  el.innerHTML = `
    <div><strong>Avg Win:</strong> ${stats.avgWin.toFixed(2)}</div>
    <div><strong>Avg Loss:</strong> ${stats.avgLoss.toFixed(2)}</div>
    <div><strong>Expectancy:</strong> ${stats.expectancy.toFixed(2)}</div>
    <div><strong>Max DD:</strong> ${stats.maxDrawdown.toFixed(2)}</div>
  `;
}

function renderAccountCharts(acc) {
  const ctx1 = document.getElementById("equityChart").getContext("2d");
  const ctx2 = document.getElementById("weekdayChart").getContext("2d");
  const ctx3 = document.getElementById("symbolProfitChart").getContext("2d");

  if (equityChart) equityChart.destroy();
  if (weekdayChart) weekdayChart.destroy();
  if (symbolProfitChart) symbolProfitChart.destroy();

  const POS = "#22d3ee";
  const NEG = "#ef4444";

  equityChart = new Chart(ctx1, {
    type: "line",
    data: {
      labels: acc.curve.map((p) => p.x),
      datasets: [
        {
          label: "Equity",
          data: acc.curve.map((p) => p.y),
          borderColor: "#0b5c7f",
          fill: false,
          pointRadius: 0
        }
      ]
    },
    options: {
      scales: {
        x: {
          type: "category",
          title: { display: true, text: "時間 (按交易順序)" },
          ticks: { maxTicksLimit: 10 }
        },
        y: { title: { display: true, text: "累積 Profit" } }
      }
    }
  });

  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  weekdayChart = new Chart(ctx2, {
    type: "bar",
    data: {
      labels: weekdayNames,
      datasets: [
        {
          label: "交易數",
          data: acc.weekdayCounts,
          backgroundColor: POS
        }
      ]
    },
    options: {
      scales: {
        y: { beginAtZero: true, title: { display: true, text: "單數" } }
      }
    }
  });

  const labels = acc.symbolRanking.map((r) => r[0]);
  const data = acc.symbolRanking.map((r) => r[1]);
  symbolProfitChart = new Chart(ctx3, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "淨盈利",
          data,
          backgroundColor: data.map((v) => (v >= 0 ? POS : NEG))
        }
      ]
    },
    options: {
      indexAxis: "y",
      scales: {
        x: { title: { display: true, text: "Profit" } }
      }
    }
  });
}

// ---------- Symbol 按鈕 + 詳細 ----------
function renderSymbolButtons() {
  const container = document.getElementById("symbolButtons");
  container.innerHTML = "";
  const symbols = Object.keys(globalBySymbol).sort();

  const allStats = buildStats(globalTrades);
  const allNet = allStats.grossProfit - allStats.grossLoss;
  const allBtn = document.createElement("button");
  allBtn.className = "symbol-btn active";
  allBtn.dataset.symbol = "ALL";
  allBtn.innerHTML = `
    <span>All Symbols</span>
    <span class="value">${allNet.toFixed(0)}</span>
  `;
  allBtn.onclick = () => {
    [...container.querySelectorAll(".symbol-btn")].forEach((b) =>
      b.classList.remove("active")
    );
    allBtn.classList.add("active");
    renderSymbol("ALL");
  };
  container.appendChild(allBtn);

  symbols.forEach((sym) => {
    const stats = buildStats(globalBySymbol[sym]);
    const net = stats.grossProfit - stats.grossLoss;
    const btn = document.createElement("button");
    btn.className = "symbol-btn";
    btn.dataset.symbol = sym;
    btn.innerHTML = `
      <span>${sym}</span>
      <span class="value">${net.toFixed(0)}</span>
    `;
    btn.onclick = () => {
      [...container.querySelectorAll(".symbol-btn")].forEach((b) =>
        b.classList.remove("active")
      );
      btn.classList.add("active");
      renderSymbol(sym);
    };
    container.appendChild(btn);
  });
}

function renderSymbol(symbol) {
  const trades = symbol === "ALL" ? globalTrades : globalBySymbol[symbol] || [];
  if (!trades.length) return;

  document.getElementById("symbolDetailSection").style.display = "block";
  document.getElementById("swotSection").style.display = "block";
  expandBody("symbolDetailBody");
  expandBody("swotBody");

  document.getElementById("symbolTitle").textContent =
    symbol === "ALL"
      ? "5. Symbol 深入分析 📊 – All Symbols"
      : `5. Symbol 深入分析 📊 – ${symbol}`;

  const cumWrap = document.getElementById("cumSwitchWrapper");
  if (cumWrap) {
    if (symbol === "ALL") {
      cumWrap.style.display = "inline-flex";
    } else {
      cumWrap.style.display = "none";
    }
  }

  const stats = buildStats(trades);
  renderSymbolStats(stats);

  const rule = EA_RULES[globalEAKey] || EA_RULES.OtherBasic;
  const eaTag = document.getElementById("eaTag");
  if (eaTag)
    eaTag.textContent =
      symbol === "ALL" ? `${rule.name} – 全組合` : rule.name;

  let martinSummary = null;
  if (rule.martin && symbol !== "ALL") {
    const m = buildMartinForSymbol(trades);
    martinSummary = m.martinSummary;
    renderMartinTables(symbol, m.tablePerSide);
    document.getElementById("martinSection").style.display = "block";
  } else {
    document.getElementById("martinSection").style.display = "none";
  }

  // MFE / MAE / Holding 暫時停用，不畫圖
  renderMfeMaeHoldingCharts(trades);

  renderSymbolExtraCharts(symbol, trades);

  const swot = buildSwotForEA(globalEAKey, symbol, stats, martinSummary);
  renderSwot(swot);
}

function renderSymbolStats(stats) {
  const net = stats.grossProfit - stats.grossLoss;
  const el = document.getElementById("symbolStats");
  el.innerHTML = `
    <div class="symbol-row">
      <span>Symbol 單數: ${stats.totalTrades}</span>
      <span>勝率: ${(stats.winRate * 100).toFixed(1)}%</span>
      <span>淨盈利: ${net.toFixed(2)}</span>
      <span>PF: ${
        stats.profitFactor === Infinity ? "∞" : stats.profitFactor.toFixed(2)
      }</span>
    </div>
    <div class="symbol-row">
      <span>期望值/單: ${stats.expectancy.toFixed(2)}</span>
      <span>Max DD: ${stats.maxDrawdown.toFixed(2)}</span>
      <span>最大連虧: ${stats.maxConsecLoss}</span>
    </div>
  `;
}

// ---------- Symbol 累積 Profit 小圖 ----------
function renderSymbolMiniCharts() {
  const container = document.getElementById("symbolMiniCharts");
  container.innerHTML = "";

  addMiniChartCard(container, "All Symbols", globalTrades);
  const symbols = Object.keys(globalBySymbol).sort();
  symbols.forEach((sym) => {
    addMiniChartCard(container, sym, globalBySymbol[sym]);
  });
}

function addMiniChartCard(container, label, trades) {
  if (!trades || !trades.length) return;

  const stats = buildStats(trades);
  const net = stats.grossProfit - stats.grossLoss;

  const div = document.createElement("div");
  div.className = "mini-chart-card";

  const canvas = document.createElement("canvas");
  div.appendChild(canvas);

  const title = document.createElement("div");
  title.className = "mini-chart-title";
  title.innerHTML = `<span>${label}</span><span class="value">${net.toFixed(
    0
  )}</span>`;
  div.appendChild(title);

  container.appendChild(div);

  let cum = 0;
  const points = [];
trades
  .slice()
  .sort((a, b) => {
    const ta = new Date(a.closeTime);
    const tb = new Date(b.closeTime);
    if (isNaN(ta) && isNaN(tb)) return 0;
    if (isNaN(ta)) return -1; // 冇 closeTime 你想排前
    if (isNaN(tb)) return 1;
    return ta - tb;
  })
  .forEach((t) => {
    cum += t.netProfit;
    points.push(cum);
  });


  new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: points.map((_, i) => i + 1),
      datasets: [
        {
          data: points,
          borderColor: "#22c55e",
          borderWidth: 1,
          fill: false,
          pointRadius: 0,
          tension: 0.2
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { x: { display: false }, y: { display: false } }
    }
  });
}

// ---------- Symbol 深入分析：Cumulative / Weekday / Hourly ----------
function renderSymbolExtraCharts(symbol, trades) {
  const cumCtx = document.getElementById("symbolCumulativeChart");
  const wdProfitCtx = document.getElementById("symbolWeekdayProfitChart");
  const wdCountCtx = document.getElementById("symbolWeekdayCountChart");
  const hrProfitCtx = document.getElementById("symbolHourlyProfitChart");
  const hrCountCtx = document.getElementById("symbolHourlyCountChart");

  if (symbolCumulativeChart) symbolCumulativeChart.destroy();
  if (symbolWeekdayProfitChart) symbolWeekdayProfitChart.destroy();
  if (symbolWeekdayCountChart) symbolWeekdayCountChart.destroy();
  if (symbolHourlyProfitChart) symbolHourlyProfitChart.destroy();
  if (symbolHourlyCountChart) symbolHourlyCountChart.destroy();

  if (!trades || !trades.length) return;
  if (!cumCtx || !wdProfitCtx || !wdCountCtx || !hrProfitCtx || !hrCountCtx)
    return;

 const sorted = trades
  .slice()
  .sort((a, b) => {
    const ta = new Date(a.closeTime);
    const tb = new Date(b.closeTime);
    if (isNaN(ta) && isNaN(tb)) return 0;
    if (isNaN(ta)) return -1;
    if (isNaN(tb)) return 1;
    return ta - tb;
  });
;

  const cumCtx2d = cumCtx.getContext("2d");

  if (symbol === "ALL" && cumulativeMode === "separate") {
    const grouped = {};
    sorted.forEach((t) => {
      if (!t.symbol) return;
      if (!grouped[t.symbol]) grouped[t.symbol] = [];
      grouped[t.symbol].push(t);
    });

    const baseColors = [
      "#22d3ee",
      "#a855f7",
      "#f97316",
      "#22c55e",
      "#eab308",
      "#ec4899",
      "#0ea5e9"
    ];
    let colorIndex = 0;
    const datasets = [];
    let maxLen = 0;

    Object.entries(grouped).forEach(([symKey, arr]) => {
      let cum = 0;
      const data = [];
      arr.forEach((t) => {
        cum += t.netProfit;
        data.push(cum);
      });
      if (data.length > maxLen) maxLen = data.length;
      const c = baseColors[colorIndex++ % baseColors.length];
      datasets.push({
        label: symKey,
        data,
        borderColor: c,
        fill: false,
        pointRadius: 0,
        tension: 0.15
      });
    });

    const labels = Array.from({ length: maxLen }, (_, i) => i + 1);
    symbolCumulativeChart = new Chart(cumCtx2d, {
      type: "line",
      data: { labels, datasets },
      options: {
        plugins: { legend: { display: true } },
        scales: {
          x: { title: { display: true, text: "Trade Index (per Symbol)" } },
          y: { title: { display: true, text: "Profit" } }
        }
      }
    });
  } else {
    let cum = 0;
    const cumLabels = [];
    const cumData = [];
    sorted.forEach((t, idx) => {
      cum += t.netProfit;
      cumLabels.push(idx + 1);
      cumData.push(cum);
    });

    symbolCumulativeChart = new Chart(cumCtx2d, {
      type: "line",
      data: {
        labels: cumLabels,
        datasets: [
          {
            label: "Cumulative Profit",
            data: cumData,
            borderColor: "#2563eb",
            fill: false,
            pointRadius: 0,
            tension: 0.15
          }
        ]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: "Trade Index" } },
          y: { title: { display: true, text: "Profit" } }
        }
      }
    });
  }

  const weekdayProfit = Array(7).fill(0);
  const weekdayCount = Array(7).fill(0);
  sorted.forEach((t) => {
    const d = new Date(t.closeTime || t.openTime);
    const wd = isNaN(d) ? 0 : d.getDay();
    weekdayProfit[wd] += t.netProfit;
    weekdayCount[wd] += 1;
  });

  const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  symbolWeekdayProfitChart = new Chart(wdProfitCtx.getContext("2d"), {
    type: "bar",
    data: {
      labels: weekdayNames,
      datasets: [
        {
          label: "Profit",
          data: weekdayProfit,
          backgroundColor: weekdayProfit.map((v) =>
            v >= 0 ? "#22d3ee" : "#ef4444"
          )
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: { title: { display: true, text: "Profit" } }
      }
    }
  });

  symbolWeekdayCountChart = new Chart(wdCountCtx.getContext("2d"), {
    type: "bar",
    data: {
      labels: weekdayNames,
      datasets: [
        {
          label: "Count",
          data: weekdayCount,
          backgroundColor: "#6366f1"
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        y: {
          title: { display: true, text: "Trades" },
          beginAtZero: true
        }
      }
    }
  });

  const hourlyProfit = Array(24).fill(0);
  const hourlyCount = Array(24).fill(0);
  sorted.forEach((t) => {
    const d = new Date(t.closeTime || t.openTime);
    const h = isNaN(d) ? 0 : d.getHours();
    hourlyProfit[h] += t.netProfit;
    hourlyCount[h] += 1;
  });

  const hourLabels = Array.from({ length: 24 }, (_, i) =>
    i.toString().padStart(2, "0")
  );
  symbolHourlyProfitChart = new Chart(hrProfitCtx.getContext("2d"), {
    type: "bar",
    data: {
      labels: hourLabels,
      datasets: [
        {
          label: "Profit",
          data: hourlyProfit,
          backgroundColor: hourlyProfit.map((v) =>
            v >= 0 ? "#22d3ee" : "#ef4444"
          )
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: "Hour" } },
        y: { title: { display: true, text: "Profit" } }
      }
    }
  });

  symbolHourlyCountChart = new Chart(hrCountCtx.getContext("2d"), {
    type: "bar",
    data: {
      labels: hourLabels,
      datasets: [
        {
          label: "Count",
          data: hourlyCount,
          backgroundColor: "#3b82f6"
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { title: { display: true, text: "Hour" } },
        y: {
          title: { display: true, text: "Trades" },
          beginAtZero: true
        }
      }
    }
  });
}

// ---------- MFE / MAE / Holding 暫時停用 ----------
function renderMfeMaeHoldingCharts(trades) {
  // 暫時完全停用，避免 canvas getContext 錯誤：
  return;
}

// ================== PART 2: Martin (新) ==================

function buildMartinForSymbol(symbolTrades) {
  const map = {};

  for (const t of symbolTrades) {
    const key = `${t.symbol}|${t.type}|${t.lots.toFixed(2)}`;
    if (!map[key]) {
      map[key] = {
        key,
        symbol: t.symbol,
        side: t.type.toUpperCase(),
        lots: t.lots,
        tradeCount: 0,
        sumProfit: 0,
        sumPips: 0,

        winCount: 0,
        lossCount: 0,
        maxProfit: -Infinity,
        maxLoss: Infinity,
        maxLossPips: Infinity,

        trades: []
      };
    }

    const m = map[key];
    m.tradeCount++;
    m.sumProfit += t.netProfit;
    m.sumPips += t.netPips;

    if (t.netProfit > 0) m.winCount++;
    else if (t.netProfit < 0) m.lossCount++;

    if (t.netProfit > m.maxProfit) m.maxProfit = t.netProfit;
    if (t.netProfit < m.maxLoss) m.maxLoss = t.netProfit;
    if (t.netPips < m.maxLossPips) m.maxLossPips = t.netPips;

    m.trades.push(t);
  }

  const rows = Object.values(map);

  const bySide = {};
  for (const r of rows) {
    const key = `${r.symbol}|${r.side}`;
    if (!bySide[key]) bySide[key] = [];
    bySide[key].push(r);
  }

  const tablePerSide = [];
  const martinSummary = {
    totalProfit: 0,
    firstPositiveLevel: null,
    maxLevel: 0,
    worstSideNegative: null
  };

  for (const key of Object.keys(bySide)) {
    const [symbol, side] = key.split("|");
    const arr = bySide[key];

    arr.sort((a, b) => a.lots - b.lots);

    let totalProfit = 0;
    let totalPips = 0;
    let totalTrades = 0;

    arr.forEach((r) => {
      totalProfit += r.sumProfit;
      totalPips += r.sumPips;
      totalTrades += r.tradeCount;
    });

    martinSummary.totalProfit += totalProfit;

    let bestIndex = -1;
    let bestWinRate = -1;

    arr.forEach((m, idx) => {
      if (m.tradeCount === 0) {
        m.winRate = 0;
      } else {
        m.winRate = m.winCount / m.tradeCount;
      }

      if (m.tradeCount >= 3 && m.winRate > bestWinRate) {
        bestWinRate = m.winRate;
        bestIndex = idx;
      }
    });

    tablePerSide.push({
      symbol,
      side,
      rows: arr,
      totalProfit,
      totalPips,
      totalTrades,
      bestIndex
    });
  }

  return { tablePerSide, martinSummary };
}

function renderMartinTables(symbol, tablePerSide) {
  const container = document.getElementById("martinTables");
  if (!container) return;
  container.innerHTML = "";

  if (!tablePerSide || !tablePerSide.length) {
    container.textContent = "沒有馬丁資料。";
    return;
  }

  tablePerSide.forEach((sideData) => {
    const card = document.createElement("div");
    card.className = "martin-card";

    const title = document.createElement("h4");
    title.className = "martin-title";
    title.textContent = `${symbol} – ${sideData.side}`;
    card.appendChild(title);

    const summary = document.createElement("div");
    summary.className = "martin-side-summary";
    summary.innerHTML = `
      <span>總單數: ${sideData.totalTrades}</span>
      <span>總 Profit: ${sideData.totalProfit.toFixed(2)}</span>
      <span>總 Pips: ${sideData.totalPips.toFixed(1)}</span>
    `;
    card.appendChild(summary);

    const table = document.createElement("table");
    table.className = "martin-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th></th>
        <th>層</th>
        <th>Lots</th>
        <th>單數</th>
        <th>總 Profit</th>
        <th>總 Pips</th>
        <th>勝率 %</th>
        <th>Max Profit</th>
        <th>Max Loss</th>
        <th>Max Loss (Pips)</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    sideData.rows.forEach((m, idx) => {
      const tr = document.createElement("tr");
      tr.classList.add("martin-row");

      if (m.sumProfit > 0) tr.classList.add("martin-positive");
      else if (m.sumProfit < 0) tr.classList.add("martin-negative");

      if (idx === sideData.bestIndex) tr.classList.add("martin-best-winrate");

      const winRatePct = (m.winRate * 100).toFixed(1) + "%";
      const maxProfit =
        m.maxProfit === -Infinity ? 0 : parseFloat(m.maxProfit || 0);
      const maxLoss =
        m.maxLoss === Infinity ? 0 : parseFloat(m.maxLoss || 0);
      const maxLossPips =
        m.maxLossPips === Infinity ? 0 : parseFloat(m.maxLossPips || 0);

      const toggleBtn = `<button class="martin-toggle" data-key="${m.key}">＋</button>`;

      tr.innerHTML = `
        <td>${toggleBtn}</td>
        <td>${idx + 1}</td>
        <td>${m.lots.toFixed(2)}</td>
        <td>${m.tradeCount}</td>
        <td>${m.sumProfit.toFixed(2)}</td>
        <td>${m.sumPips.toFixed(1)}</td>
        <td>${winRatePct}</td>
        <td>${maxProfit.toFixed(2)}</td>
        <td>${maxLoss.toFixed(2)}</td>
        <td>${maxLossPips.toFixed(1)}</td>
      `;
      tbody.appendChild(tr);

      const subTr = document.createElement("tr");
      subTr.classList.add("martin-subtrades", "collapsed");
      subTr.dataset.key = m.key;
      subTr.innerHTML = `
        <td colspan="10">
          ${renderMartinSubTradesTable(m.trades)}
        </td>
      `;
      tbody.appendChild(subTr);
    });

    table.appendChild(tbody);
    card.appendChild(table);
    container.appendChild(card);
  });
}

function renderMartinSubTradesTable(trades) {
  if (!trades || !trades.length) {
    return `<div class="empty-subtrades">此層暫時無單</div>`;
  }

  const rows = trades
    .map((t) => {
      const timeStr = t.closeTime || t.openTime || "";
      const typeStr = t.type.toUpperCase();
      const lotsStr = t.lots.toFixed(2);
      const profitStr = t.netProfit.toFixed(2);
      const pipsStr = t.netPips.toFixed(1);

      return `
        <tr>
          <td>${timeStr}</td>
          <td>${typeStr}</td>
          <td>${lotsStr}</td>
          <td>${profitStr}</td>
          <td>${pipsStr}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table class="martin-subtable">
      <thead>
        <tr>
          <th>Time</th>
          <th>Type</th>
          <th>Lots</th>
          <th>Profit</th>
          <th>Pips</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest(".martin-toggle");
  if (!btn) return;

  const key = btn.dataset.key;
  if (!key) return;

  const subRow = document.querySelector(
    `.martin-subtrades[data-key="${key}"]`
  );
  if (!subRow) return;

  const isCollapsed = subRow.classList.contains("collapsed");
  if (isCollapsed) {
    subRow.classList.remove("collapsed");
    btn.textContent = "－";
  } else {
    subRow.classList.add("collapsed");
    btn.textContent = "＋";
  }
});

// ================== PART 3: EA 規則 + SWOT ==================

const EA_RULES = {
  SMA: {
    key: "SMA",
    name: "SMA Trend EA",
    description: "以均線為主的順勢策略，偏中長線 Trending。",
    goodWinRate: 0.55,
    greatWinRate: 0.6,
    weakWinRate: 0.45,
    goodPF: 1.5,
    greatPF: 2.0,
    weakPF: 1.0,
    safeDD: 0.1,
    warnDD: 0.2,
    minTradesForConfidence: 50,
    martin: true
  },
  OtherBasic: {
    key: "OtherBasic",
    name: "EA (General)",
    description: "一般型 EA，使用通用評估標準。",
    goodWinRate: 0.55,
    greatWinRate: 0.6,
    weakWinRate: 0.45,
    goodPF: 1.4,
    greatPF: 1.8,
    weakPF: 1.0,
    safeDD: 0.12,
    warnDD: 0.22,
    minTradesForConfidence: 30,
    martin: false
  }
};

function buildEaStats(symbol, stats, martinSummary, trades) {
  const netProfit = stats.grossProfit - stats.grossLoss;
  const totalTrades = stats.totalTrades || 0;

  const initialDeposit = 5000;
  const maxDDPct = initialDeposit
    ? stats.maxDrawdown / initialDeposit
    : 0;

  const sideMartin = martinSummary || {
    totalProfit: 0,
    firstPositiveLevel: null,
    maxLevel: 0,
    worstSideNegative: null
  };

  let daysSpan = 0;
  let avgTradesPerDay = 0;
  let avgTradesPerWeek = 0;
  if (trades && trades.length) {
    let firstTime = null;
    let lastTime = null;
    trades.forEach((t) => {
      const d = new Date(t.closeTime || t.openTime);
      if (isNaN(d)) return;
      if (!firstTime || d < firstTime) firstTime = d;
      if (!lastTime || d > lastTime) lastTime = d;
    });
    if (firstTime && lastTime) {
      const diffDays = Math.max(
        1,
        Math.round(
          (lastTime.getTime() - firstTime.getTime()) / (1000 * 3600 * 24)
        )
      );
      daysSpan = diffDays;
      avgTradesPerDay = totalTrades / diffDays;
      avgTradesPerWeek = (totalTrades / diffDays) * 7;
    }
  }

  return {
    symbol,
    totalTrades,
    netProfit,
    winRate: stats.winRate,
    lossRate: stats.lossRate,
    profitFactor: stats.profitFactor,
    expectancy: stats.expectancy,
    maxDrawdownAbs: stats.maxDrawdown,
    maxDrawdownPct: maxDDPct,
    maxConsecLoss: stats.maxConsecLoss,
    avgWin: stats.avgWin,
    avgLoss: stats.avgLoss,
    martinTotalProfit: sideMartin.totalProfit || 0,
    daysSpan,
    avgTradesPerDay,
    avgTradesPerWeek
  };
}

function winRateNotHigh(winRate, rule) {
  return winRate < rule.goodWinRate;
}

function buildSwotForEA(eaKey, symbol, stats, martinSummary) {
  const rule = EA_RULES[eaKey] || EA_RULES.OtherBasic;
  const trades =
    symbol === "ALL" ? globalTrades : globalBySymbol[symbol] || [];

  const eaStats = buildEaStats(symbol, stats, martinSummary, trades);

  const S = [];
  const W = [];
  const O = [];
  const T = [];

  const {
    totalTrades,
    netProfit,
    winRate,
    profitFactor,
    expectancy,
    maxDrawdownPct,
    maxConsecLoss,
    avgWin,
    avgLoss,
    martinTotalProfit,
    daysSpan,
    avgTradesPerWeek
  } = eaStats;

  const hasEnoughData = totalTrades >= rule.minTradesForConfidence;

  if (netProfit > 0 && profitFactor > rule.goodPF) {
    S.push(
      `整體呈現穩定淨盈利，Profit Factor 約 ${
        profitFactor === Infinity ? "∞" : profitFactor.toFixed(2)
      }，具備長期正期望特徵。`
    );
  }
  if (winRate >= rule.greatWinRate) {
    S.push(
      `勝率偏高（約 ${(winRate * 100).toFixed(
        1
      )}%），屬於此策略類型中較理想水平。`
    );
  } else if (winRate >= rule.goodWinRate) {
    S.push(
      `勝率尚算穩定（約 ${(winRate * 100).toFixed(
        1
      )}%），對沖交易成本與滑點仍有餘地。`
    );
  }
  if (expectancy > 0) {
    S.push(
      `單筆期望值為 ${expectancy.toFixed(
        2
      )}，平均每單具備正收益，長期有機會向上累積。`
    );
  }
  if (maxDrawdownPct <= rule.safeDD && maxDrawdownPct > 0) {
    S.push(
      `最大回撤約 ${(maxDrawdownPct * 100).toFixed(
        1
      )}% ，整體風險控制相對保守。`
    );
  }
  if (avgWin > 0 && avgLoss > 0 && avgWin >= avgLoss) {
    S.push(
      `平均贏一單 (${avgWin.toFixed(
        2
      )}) 大約 ≥ 平均輸一單 (${avgLoss.toFixed(
        2
      )})，風報比結構偏健康。`
    );
  }

  if (netProfit <= 0) {
    W.push(
      `當前樣本期內整體淨利潤偏弱（${netProfit.toFixed(
        2
      )}），策略可能仍在調整期或市場環境不利。`
    );
  }
  if (profitFactor < rule.weakPF) {
    W.push(
      `Profit Factor 低於 ${rule.weakPF.toFixed(
        2
      )}，盈利交易對虧損交易的優勢不足。`
    );
  }
  if (winRate < rule.weakWinRate) {
    W.push(
      `勝率偏低（約 ${(winRate * 100).toFixed(
        1
      )}%），需要依賴更高 RRR 或更嚴格風控才能穩定。`
    );
  }
  if (maxDrawdownPct >= rule.warnDD) {
    W.push(
      `最大回撤較深（約 ${(maxDrawdownPct * 100).toFixed(
        1
      )}%），需要重新檢視倉位大小、加倉層數或止損規則。`
    );
  }
  if (maxConsecLoss >= 5) {
    W.push(
      `最大連續虧損達 ${maxConsecLoss} 單，心理壓力與資金回撤都較大，需要確認資金是否足夠承受。`
    );
  }

  if (!hasEnoughData) {
    O.push(
      `目前樣本量約 ${totalTrades} 單，未達「穩定統計樣本」門檻（建議 ≥ ${
        rule.minTradesForConfidence
      } 單），後續可透過增加樣本期進一步驗證。`
    );
  } else {
    O.push(
      `已有 ${totalTrades} 單樣本，統計具一定參考價值，可考慮在相近市場環境內放大倉位或增加觀察週期。`
    );
  }
  if (martinTotalProfit > 0) {
    O.push(
      `Martin 結構整體仍貢獻正收益（約 ${martinTotalProfit.toFixed(
        2
      )}），可進一步優化入場/加倉條件，保留優點同時降低極端回撤風險。`
    );
  }
  if (daysSpan > 0 && avgTradesPerWeek > 0) {
    O.push(
      `於約 ${daysSpan} 日內完成 ${totalTrades} 單（每週約 ${avgTradesPerWeek.toFixed(
        1
      )} 單），策略具備一定活躍度，可用作疊代與優化的測試平台。`
    );
  }

  if (maxDrawdownPct >= rule.warnDD) {
    T.push(
      `回撤放大時可能引發強平或心理崩潰，有必要設定明確「停機條件」或回撤上限。`
    );
  }
  if (profitFactor < 1 && netProfit > 0) {
    T.push(
      `目前盈利主要依賴少量大單帶動，一旦市場結構改變，策略表現可能明顯回落。`
    );
  }
  if (avgLoss > avgWin && winRateNotHigh(winRate, rule)) {
    T.push(
      `平均單筆虧損 (${avgLoss.toFixed(
        2
      )}) 高於平均單筆盈利 (${avgWin.toFixed(
        2
      )})，一旦勝率回落，策略會更容易陷入長期負期望。`
    );
  }

  if (!S.length) {
    S.push("暫未見明顯結構性優勢，建議先延長測試期並觀察更多樣本。");
  }
  if (!W.length) {
    W.push("暫未發現明顯弱點，但仍需持續監控回撤與風報比變化。");
  }
  if (!O.length) {
    O.push(
      "可透過增加品種、時間段或不同市場環境測試，挖掘更多可行場景。"
    );
  }
  if (!T.length) {
    T.push("主要風險為市場結構變化與極端行情，建議搭配資金管理與停機條件。");
  }

  return { strengths: S, weaknesses: W, opportunities: O, threats: T, eaStats };
}

function renderSwot(swot) {
  if (!swot) return;

  const { strengths, weaknesses, opportunities, threats } = swot;

  const elST = document.getElementById("swotST");
  const elS = document.getElementById("swotS");
  const elSW = document.getElementById("swotSW");
  const elW = document.getElementById("swotW");
  const elOT = document.getElementById("swotOT");
  const elO = document.getElementById("swotO");
  const elOW = document.getElementById("swotOW");
  const elT = document.getElementById("swotT");

  if (elST) elST.textContent = "S – Strengths（優勢）";
  if (elSW) elSW.textContent = "W – Weaknesses（劣勢）";
  if (elOT) elOT.textContent = "O – Opportunities（機會）";
  if (elOW) elOW.textContent = "T – Threats（風險）";

  if (elS)
    elS.innerHTML = strengths
      .map((s) => `<li>${s}</li>`)
      .join("") || "<li>暫無明顯優勢</li>";
  if (elW)
    elW.innerHTML = weaknesses
      .map((w) => `<li>${w}</li>`)
      .join("") || "<li>暫無明顯劣勢</li>";
  if (elO)
    elO.innerHTML = opportunities
      .map((o) => `<li>${o}</li>`)
      .join("") || "<li>暫無明顯機會</li>";
  if (elT)
    elT.innerHTML = threats
      .map((t) => `<li>${t}</li>`)
      .join("") || "<li>暫無明顯風險</li>";
}

// ================== PART 4: Helper + Context Summary ==================

function safeToFixed(value, digits) {
  const v = Number(value);
  if (!isFinite(v)) return "0";
  return v.toFixed(digits);
}

function safePercent(value, digits) {
  const v = Number(value);
  if (!isFinite(v)) return "0";
  return (v * 100).toFixed(digits) + " %";
}

function formatSymbolLabel(symbol) {
  return symbol === "ALL" ? "All Symbols" : symbol;
}

function buildSymbolContextSummary(symbol, stats, eaStats) {
  const name = formatSymbolLabel(symbol);
  const netProfit = stats.grossProfit - stats.grossLoss;

  const lines = [];

  lines.push(`標的：${name}`);
  lines.push(
    `總交易數：${stats.totalTrades}，勝率：約 ${safePercent(
      stats.winRate,
      1
    )}，Profit Factor：${
      stats.profitFactor === Infinity
        ? "∞"
        : safeToFixed(stats.profitFactor, 2)
    }。`
  );
  lines.push(
    `淨利潤：約 ${safeToFixed(
      netProfit,
      2
    )}，最大回撤：約 ${safeToFixed(stats.maxDrawdown, 2)}。`
  );
  lines.push(
    `平均贏一單：${safeToFixed(
      stats.avgWin,
      2
    )}，平均輸一單：${safeToFixed(stats.avgLoss, 2)}，期望值/單：${safeToFixed(
      stats.expectancy,
      2
    )}。`
  );

  if (eaStats) {
    if (eaStats.daysSpan > 0) {
      lines.push(
        `統計期間：約 ${eaStats.daysSpan} 日，日均交易約 ${safeToFixed(
          eaStats.avgTradesPerDay,
          2
        )} 單，週均約 ${safeToFixed(eaStats.avgTradesPerWeek, 1)} 單。`
      );
    }
    if (eaStats.martinTotalProfit !== undefined) {
      lines.push(
        `Martin 結構總 Profit：約 ${safeToFixed(
          eaStats.martinTotalProfit,
          2
        )}。`
      );
    }
  }

  return lines.join("\n");
}

function getCurrentSymbolContextSummary() {
  const activeBtn = document.querySelector(".symbol-btn.active");
  const symbol = activeBtn ? activeBtn.dataset.symbol : "ALL";
  const trades =
    symbol === "ALL" ? globalTrades : globalBySymbol[symbol] || [];
  if (!trades.length) return "目前沒有可用的交易資料。";

  const stats = buildStats(trades);
  const dummyMartinSummary = {
    totalProfit: 0,
    firstPositiveLevel: null,
    maxLevel: 0,
    worstSideNegative: null
  };
  const eaStats = buildEaStats(symbol, stats, dummyMartinSummary, trades);

  return buildSymbolContextSummary(symbol, stats, eaStats);
}

// ================== PART 5: AI Chat Stub（可先唔用 HTML） ==================

(function setupAiChatStub() {
  const trigger = document.getElementById("aiChatTrigger");
  const panel = document.getElementById("aiChatPanel");
  const closeBtn = document.getElementById("aiChatClose");
  const sendBtn = document.getElementById("aiChatSend");
  const input = document.getElementById("aiChatInput");
  const msgContainer = document.getElementById("aiChatMessages");

  // 如果 HTML 未提供 AI chat 結構，就唔啟動 stub
  if (!trigger || !panel || !closeBtn || !sendBtn || !input || !msgContainer) {
    return;
  }

  let isOpen = false;

  function openPanel() {
    panel.classList.remove("ai-chat-hidden");
    isOpen = true;
    input.focus();
    if (!panel.dataset.initiated) {
      panel.dataset.initiated = "1";
      appendAiMessage("你好，我可以幫你解讀目前帳戶 / Symbol 的交易表現。");
    }
  }

  function closePanel() {
    panel.classList.add("ai-chat-hidden");
    isOpen = false;
  }

  trigger.addEventListener("click", () => {
    if (isOpen) closePanel();
    else openPanel();
  });

  closeBtn.addEventListener("click", () => {
    closePanel();
  });

  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  function handleSend() {
    const text = input.value.trim();
    if (!text) return;

    appendUserMessage(text);
    input.value = "";

    const contextSummary = getCurrentSymbolContextSummary();

    console.log("【AI Chat 應該送去後端的 payload】", {
      message: text,
      context: contextSummary
    });

    const fakeReply =
      "（Stub）如果連接真實 API，我會根據以下 context 幫你分析：\n\n" +
      contextSummary;
    appendAiMessage(fakeReply);
  }

  function appendUserMessage(text) {
    const row = document.createElement("div");
    row.className = "ai-chat-message user";
    const bubble = document.createElement("div");
    bubble.className = "ai-chat-bubble";
    bubble.textContent = text;
    row.appendChild(bubble);
    msgContainer.appendChild(row);
    scrollMessagesToBottom();
  }

  function appendAiMessage(text) {
    const row = document.createElement("div");
    row.className = "ai-chat-message ai";
    const bubble = document.createElement("div");
    bubble.className = "ai-chat-bubble";
    bubble.innerHTML = text
      .split("\n")
      .map((line) => line.replace(/ /g, "&nbsp;"))
      .join("<br>");
    row.appendChild(bubble);
    msgContainer.appendChild(row);
    scrollMessagesToBottom();
  }

  function scrollMessagesToBottom() {
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }
})();

// ================== PART 2: Martin (新) ==================

function buildMartinForSymbol(symbolTrades) {
  const map = {};

  for (const t of symbolTrades) {
    const key = `${t.symbol}|${t.type}|${t.lots.toFixed(2)}`;
    if (!map[key]) {
      map[key] = {
        key,
        symbol: t.symbol,
        side: t.type.toUpperCase(),
        lots: t.lots,
        tradeCount: 0,
        sumProfit: 0,
        sumPips: 0,

        winCount: 0,
        lossCount: 0,
        maxProfit: -Infinity,
        maxLoss: Infinity,
        maxLossPips: Infinity,

        trades: []
      };
    }

    const m = map[key];
    m.tradeCount++;
    m.sumProfit += t.netProfit;
    m.sumPips += t.netPips;

    if (t.netProfit > 0) m.winCount++;
    else if (t.netProfit < 0) m.lossCount++;

    if (t.netProfit > m.maxProfit) m.maxProfit = t.netProfit;
    if (t.netProfit < m.maxLoss) m.maxLoss = t.netProfit;
    if (t.netPips < m.maxLossPips) m.maxLossPips = t.netPips;

    m.trades.push(t);
  }

  const rows = Object.values(map);

  const bySide = {};
  for (const r of rows) {
    const key = `${r.symbol}|${r.side}`;
    if (!bySide[key]) bySide[key] = [];
    bySide[key].push(r);
  }

  const tablePerSide = [];
  const martinSummary = {
    totalProfit: 0,
    firstPositiveLevel: null,
    maxLevel: 0,
    worstSideNegative: null
  };

  for (const key of Object.keys(bySide)) {
    const [symbol, side] = key.split("|");
    const arr = bySide[key];

    arr.sort((a, b) => a.lots - b.lots);

    let totalProfit = 0;
    let totalPips = 0;
    let totalTrades = 0;

    arr.forEach((r) => {
      totalProfit += r.sumProfit;
      totalPips += r.sumPips;
      totalTrades += r.tradeCount;
    });

    martinSummary.totalProfit += totalProfit;

    let bestIndex = -1;
    let bestWinRate = -1;

    arr.forEach((m, idx) => {
      if (m.tradeCount === 0) {
        m.winRate = 0;
      } else {
        m.winRate = m.winCount / m.tradeCount;
      }

      if (m.tradeCount >= 3 && m.winRate > bestWinRate) {
        bestWinRate = m.winRate;
        bestIndex = idx;
      }
    });

    tablePerSide.push({
      symbol,
      side,
      rows: arr,
      totalProfit,
      totalPips,
      totalTrades,
      bestIndex
    });
  }

  return { tablePerSide, martinSummary };
}

function renderMartinTables(symbol, tablePerSide) {
  const container = document.getElementById("martinTables");
  if (!container) return;
  container.innerHTML = "";

  if (!tablePerSide || !tablePerSide.length) {
    container.textContent = "沒有馬丁資料。";
    return;
  }

  tablePerSide.forEach((sideData) => {
    const card = document.createElement("div");
    card.className = "martin-card";

    const title = document.createElement("h4");
    title.className = "martin-title";
    title.textContent = `${symbol} – ${sideData.side}`;
    card.appendChild(title);

    const summary = document.createElement("div");
    summary.className = "martin-side-summary";
    summary.innerHTML = `
      <span>總單數: ${sideData.totalTrades}</span>
      <span>總 Profit: ${sideData.totalProfit.toFixed(2)}</span>
      <span>總 Pips: ${sideData.totalPips.toFixed(1)}</span>
    `;
    card.appendChild(summary);

    const table = document.createElement("table");
    table.className = "martin-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `
      <tr>
        <th></th>
        <th>層</th>
        <th>Lots</th>
        <th>單數</th>
        <th>總 Profit</th>
        <th>總 Pips</th>
        <th>勝率 %</th>
        <th>Max Profit</th>
        <th>Max Loss</th>
        <th>Max Loss (Pips)</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    sideData.rows.forEach((m, idx) => {
      const tr = document.createElement("tr");
      tr.classList.add("martin-row");

      if (m.sumProfit > 0) tr.classList.add("martin-positive");
      else if (m.sumProfit < 0) tr.classList.add("martin-negative");

      if (idx === sideData.bestIndex) tr.classList.add("martin-best-winrate");

      const winRatePct = (m.winRate * 100).toFixed(1) + "%";
      const maxProfit =
        m.maxProfit === -Infinity ? 0 : parseFloat(m.maxProfit || 0);
      const maxLoss =
        m.maxLoss === Infinity ? 0 : parseFloat(m.maxLoss || 0);
      const maxLossPips =
        m.maxLossPips === Infinity ? 0 : parseFloat(m.maxLossPips || 0);

      const toggleBtn = `<button class="martin-toggle" data-key="${m.key}">＋</button>`;

      tr.innerHTML = `
        <td>${toggleBtn}</td>
        <td>${idx + 1}</td>
        <td>${m.lots.toFixed(2)}</td>
        <td>${m.tradeCount}</td>
        <td>${m.sumProfit.toFixed(2)}</td>
        <td>${m.sumPips.toFixed(1)}</td>
        <td>${winRatePct}</td>
        <td>${maxProfit.toFixed(2)}</td>
        <td>${maxLoss.toFixed(2)}</td>
        <td>${maxLossPips.toFixed(1)}</td>
      `;
      tbody.appendChild(tr);

      const subTr = document.createElement("tr");
      subTr.classList.add("martin-subtrades", "collapsed");
      subTr.dataset.key = m.key;
      subTr.innerHTML = `
        <td colspan="10">
          ${renderMartinSubTradesTable(m.trades)}
        </td>
      `;
      tbody.appendChild(subTr);
    });

    table.appendChild(tbody);
    card.appendChild(table);
    container.appendChild(card);
  });
}

function renderMartinSubTradesTable(trades) {
  if (!trades || !trades.length) {
    return `<div class="empty-subtrades">此層暫時無單</div>`;
  }

  const rows = trades
    .map((t) => {
      const timeStr = t.closeTime || t.openTime || "";
      const typeStr = t.type.toUpperCase();
      const lotsStr = t.lots.toFixed(2);
      const profitStr = t.netProfit.toFixed(2);
      const pipsStr = t.netPips.toFixed(1);

      return `
        <tr>
          <td>${timeStr}</td>
          <td>${typeStr}</td>
          <td>${lotsStr}</td>
          <td>${profitStr}</td>
          <td>${pipsStr}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <table class="martin-subtable">
      <thead>
        <tr>
          <th>Time</th>
          <th>Type</th>
          <th>Lots</th>
          <th>Profit</th>
          <th>Pips</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

// 展開 / 收起 Martin 每層 trades
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".martin-toggle");
  if (!btn) return;

  const key = btn.dataset.key;
  if (!key) return;

  const subRow = document.querySelector(
    `.martin-subtrades[data-key="${key}"]`
  );
  if (!subRow) return;

  const isCollapsed = subRow.classList.contains("collapsed");
  if (isCollapsed) {
    subRow.classList.remove("collapsed");
    btn.textContent = "－";
  } else {
    subRow.classList.add("collapsed");
    btn.textContent = "＋";
  }
});

// ================== PART 3: EA 規則 + SWOT ==================

const EA_RULES = {
  SMA: {
    key: "SMA",
    name: "SMA Trend EA",
    description: "以均線為主的順勢策略，偏中長線 Trending。",
    goodWinRate: 0.55,
    greatWinRate: 0.6,
    weakWinRate: 0.45,
    goodPF: 1.5,
    greatPF: 2.0,
    weakPF: 1.0,
    safeDD: 0.1,
    warnDD: 0.2,
    minTradesForConfidence: 50,
    martin: true
  },
  OtherBasic: {
    key: "OtherBasic",
    name: "EA (General)",
    description: "一般型 EA，使用通用評估標準。",
    goodWinRate: 0.55,
    greatWinRate: 0.6,
    weakWinRate: 0.45,
    goodPF: 1.4,
    greatPF: 1.8,
    weakPF: 1.0,
    safeDD: 0.12,
    warnDD: 0.22,
    minTradesForConfidence: 30,
    martin: false
  }
};

function buildEaStats(symbol, stats, martinSummary, trades) {
  const netProfit = stats.grossProfit - stats.grossLoss;
  const totalTrades = stats.totalTrades || 0;

  const initialDeposit = 5000;
  const maxDDPct = initialDeposit
    ? stats.maxDrawdown / initialDeposit
    : 0;

  const sideMartin = martinSummary || {
    totalProfit: 0,
    firstPositiveLevel: null,
    maxLevel: 0,
    worstSideNegative: null
  };

  let daysSpan = 0;
  let avgTradesPerDay = 0;
  let avgTradesPerWeek = 0;
  if (trades && trades.length) {
    let firstTime = null;
    let lastTime = null;
    trades.forEach((t) => {
      const d = new Date(t.closeTime || t.openTime);
      if (isNaN(d)) return;
      if (!firstTime || d < firstTime) firstTime = d;
      if (!lastTime || d > lastTime) lastTime = d;
    });
    if (firstTime && lastTime) {
      const diffDays = Math.max(
        1,
        Math.round(
          (lastTime.getTime() - firstTime.getTime()) / (1000 * 3600 * 24)
        )
      );
      daysSpan = diffDays;
      avgTradesPerDay = totalTrades / diffDays;
      avgTradesPerWeek = (totalTrades / diffDays) * 7;
    }
  }

  return {
    symbol,
    totalTrades,
    netProfit,
    winRate: stats.winRate,
    lossRate: stats.lossRate,
    profitFactor: stats.profitFactor,
    expectancy: stats.expectancy,
    maxDrawdownAbs: stats.maxDrawdown,
    maxDrawdownPct: maxDDPct,
    maxConsecLoss: stats.maxConsecLoss,
    avgWin: stats.avgWin,
    avgLoss: stats.avgLoss,
    martinTotalProfit: sideMartin.totalProfit || 0,
    daysSpan,
    avgTradesPerDay,
    avgTradesPerWeek
  };
}

function winRateNotHigh(winRate, rule) {
  return winRate < rule.goodWinRate;
}

function buildSwotForEA(eaKey, symbol, stats, martinSummary) {
  const rule = EA_RULES[eaKey] || EA_RULES.OtherBasic;
  const trades =
    symbol === "ALL" ? globalTrades : globalBySymbol[symbol] || [];

  const eaStats = buildEaStats(symbol, stats, martinSummary, trades);

  const S = [];
  const W = [];
  const O = [];
  const T = [];

  const {
    totalTrades,
    netProfit,
    winRate,
    profitFactor,
    expectancy,
    maxDrawdownPct,
    maxConsecLoss,
    avgWin,
    avgLoss,
    martinTotalProfit,
    daysSpan,
    avgTradesPerWeek
  } = eaStats;

  const hasEnoughData = totalTrades >= rule.minTradesForConfidence;

  // Strengths
  if (netProfit > 0 && profitFactor > rule.goodPF) {
    S.push(
      `整體呈現穩定淨盈利，Profit Factor 約 ${
        profitFactor === Infinity ? "∞" : profitFactor.toFixed(2)
      }，具備長期正期望特徵。`
    );
  }
  if (winRate >= rule.greatWinRate) {
    S.push(
      `勝率偏高（約 ${(winRate * 100).toFixed(
        1
      )}%），屬於此策略類型中較理想水平。`
    );
  } else if (winRate >= rule.goodWinRate) {
    S.push(
      `勝率尚算穩定（約 ${(winRate * 100).toFixed(
        1
      )}%），對沖交易成本與滑點仍有餘地。`
    );
  }
  if (expectancy > 0) {
    S.push(
      `單筆期望值為 ${expectancy.toFixed(
        2
      )}，平均每單具備正收益，長期有機會向上累積。`
    );
  }
  if (maxDrawdownPct <= rule.safeDD && maxDrawdownPct > 0) {
    S.push(
      `最大回撤約 ${(maxDrawdownPct * 100).toFixed(
        1
      )}% ，整體風險控制相對保守。`
    );
  }
  if (avgWin > 0 && avgLoss > 0 && avgWin >= avgLoss) {
    S.push(
      `平均贏一單 (${avgWin.toFixed(
        2
      )}) 大約 ≥ 平均輸一單 (${avgLoss.toFixed(
        2
      )})，風報比結構偏健康。`
    );
  }

  // Weaknesses
  if (netProfit <= 0) {
    W.push(
      `當前樣本期內整體淨利潤偏弱（${netProfit.toFixed(
        2
      )}），策略可能仍在調整期或市場環境不利。`
    );
  }
  if (profitFactor < rule.weakPF) {
    W.push(
      `Profit Factor 低於 ${rule.weakPF.toFixed(
        2
      )}，盈利交易對虧損交易的優勢不足。`
    );
  }
  if (winRate < rule.weakWinRate) {
    W.push(
      `勝率偏低（約 ${(winRate * 100).toFixed(
        1
      )}%），需要依賴更高 RRR 或更嚴格風控才能穩定。`
    );
  }
  if (maxDrawdownPct >= rule.warnDD) {
    W.push(
      `最大回撤較深（約 ${(maxDrawdownPct * 100).toFixed(
        1
      )}%），需要重新檢視倉位大小、加倉層數或止損規則。`
    );
  }
  if (maxConsecLoss >= 5) {
    W.push(
      `最大連續虧損達 ${maxConsecLoss} 單，心理壓力與資金回撤都較大，需要確認資金是否足夠承受。`
    );
  }

  // Opportunities
  if (!hasEnoughData) {
    O.push(
      `目前樣本量約 ${totalTrades} 單，未達「穩定統計樣本」門檻（建議 ≥ ${
        rule.minTradesForConfidence
      } 單），後續可透過增加樣本期進一步驗證。`
    );
  } else {
    O.push(
      `已有 ${totalTrades} 單樣本，統計具一定參考價值，可考慮在相近市場環境內放大倉位或增加觀察週期。`
    );
  }
  if (martinTotalProfit > 0) {
    O.push(
      `Martin 結構整體仍貢獻正收益（約 ${martinTotalProfit.toFixed(
        2
      )}），可進一步優化入場/加倉條件，保留優點同時降低極端回撤風險。`
    );
  }
  if (daysSpan > 0 && avgTradesPerWeek > 0) {
    O.push(
      `於約 ${daysSpan} 日內完成 ${totalTrades} 單（每週約 ${avgTradesPerWeek.toFixed(
        1
      )} 單），策略具備一定活躍度，可用作疊代與優化的測試平台。`
    );
  }

  // Threats
  if (maxDrawdownPct >= rule.warnDD) {
    T.push(
      `回撤放大時可能引發強平或心理崩潰，有必要設定明確「停機條件」或回撤上限。`
    );
  }
  if (profitFactor < 1 && netProfit > 0) {
    T.push(
      `目前盈利主要依賴少量大單帶動，一旦市場結構改變，策略表現可能明顯回落。`
    );
  }
  if (avgLoss > avgWin && winRateNotHigh(winRate, rule)) {
    T.push(
      `平均單筆虧損 (${avgLoss.toFixed(
        2
      )}) 高於平均單筆盈利 (${avgWin.toFixed(
        2
      )})，一旦勝率回落，策略會更容易陷入長期負期望。`
    );
  }

  if (!S.length) {
    S.push("暫未見明顯結構性優勢，建議先延長測試期並觀察更多樣本。");
  }
  if (!W.length) {
    W.push("暫未發現明顯弱點，但仍需持續監控回撤與風報比變化。");
  }
  if (!O.length) {
    O.push(
      "可透過增加品種、時間段或不同市場環境測試，挖掘更多可行場景。"
    );
  }
  if (!T.length) {
    T.push("主要風險為市場結構變化與極端行情，建議搭配資金管理與停機條件。");
  }

  return { strengths: S, weaknesses: W, opportunities: O, threats: T, eaStats };
}

function renderSwot(swot) {
  if (!swot) return;

  const { strengths, weaknesses, opportunities, threats } = swot;

  const elST = document.getElementById("swotST");
  const elS = document.getElementById("swotS");
  const elSW = document.getElementById("swotSW");
  const elW = document.getElementById("swotW");
  const elOT = document.getElementById("swotOT");
  const elO = document.getElementById("swotO");
  const elOW = document.getElementById("swotOW");
  const elT = document.getElementById("swotT");

  if (elST) elST.textContent = "S – Strengths（優勢）";
  if (elSW) elSW.textContent = "W – Weaknesses（劣勢）";
  if (elOT) elOT.textContent = "O – Opportunities（機會）";
  if (elOW) elOW.textContent = "T – Threats（風險）";

  if (elS)
    elS.innerHTML = strengths
      .map((s) => `<li>${s}</li>`)
      .join("") || "<li>暫無明顯優勢</li>";
  if (elW)
    elW.innerHTML = weaknesses
      .map((w) => `<li>${w}</li>`)
      .join("") || "<li>暫無明顯劣勢</li>";
  if (elO)
    elO.innerHTML = opportunities
      .map((o) => `<li>${o}</li>`)
      .join("") || "<li>暫無明顯機會</li>";
  if (elT)
    elT.innerHTML = threats
      .map((t) => `<li>${t}</li>`)
      .join("") || "<li>暫無明顯風險</li>";
}

// ================== PART 4: Helper + Context Summary ==================

function safeToFixed(value, digits) {
  const v = Number(value);
  if (!isFinite(v)) return "0";
  return v.toFixed(digits);
}

function safePercent(value, digits) {
  const v = Number(value);
  if (!isFinite(v)) return "0";
  return (v * 100).toFixed(digits) + " %";
}

function formatSymbolLabel(symbol) {
  return symbol === "ALL" ? "All Symbols" : symbol;
}

/**
 * 將某個 symbol（或 ALL）嘅主要 stats + EA stats 整成一段文字 summary，
 * 之後可以俾 AI chat / SWOT 以外用途用。
 */
function buildSymbolContextSummary(symbol, stats, eaStats) {
  const name = formatSymbolLabel(symbol);
  const netProfit = stats.grossProfit - stats.grossLoss;

  const lines = [];

  lines.push(`標的：${name}`);
  lines.push(
    `總交易數：${stats.totalTrades}，勝率：約 ${safePercent(
      stats.winRate,
      1
    )}，Profit Factor：${
      stats.profitFactor === Infinity
        ? "∞"
        : safeToFixed(stats.profitFactor, 2)
    }。`
  );
  lines.push(
    `淨利潤：約 ${safeToFixed(
      netProfit,
      2
    )}，最大回撤：約 ${safeToFixed(stats.maxDrawdown, 2)}。`
  );
  lines.push(
    `平均贏一單：${safeToFixed(
      stats.avgWin,
      2
    )}，平均輸一單：${safeToFixed(stats.avgLoss, 2)}，期望值/單：${safeToFixed(
      stats.expectancy,
      2
    )}。`
  );

  if (eaStats) {
    if (eaStats.daysSpan > 0) {
      lines.push(
        `統計期間：約 ${eaStats.daysSpan} 日，日均交易約 ${safeToFixed(
          eaStats.avgTradesPerDay,
          2
        )} 單，週均約 ${safeToFixed(eaStats.avgTradesPerWeek, 1)} 單。`
      );
    }
    if (eaStats.martinTotalProfit !== undefined) {
      lines.push(
        `Martin 結構總 Profit：約 ${safeToFixed(
          eaStats.martinTotalProfit,
          2
        )}。`
      );
    }
  }

  return lines.join("\n");
}

/**
 * 方便 AI chat call：直接根據當前 active symbol 建一段 summary。
 */
function getCurrentSymbolContextSummary() {
  const activeBtn = document.querySelector(".symbol-btn.active");
  const symbol = activeBtn ? activeBtn.dataset.symbol : "ALL";
  const trades =
    symbol === "ALL" ? globalTrades : globalBySymbol[symbol] || [];
  if (!trades.length) return "目前沒有可用的交易資料。";

  const stats = buildStats(trades);
  const dummyMartinSummary = {
    totalProfit: 0,
    firstPositiveLevel: null,
    maxLevel: 0,
    worstSideNegative: null
  };
  const eaStats = buildEaStats(symbol, stats, dummyMartinSummary, trades);

  return buildSymbolContextSummary(symbol, stats, eaStats);
}

// ================== PART 5: AI Chat Stub（前端，暫不調用 API） ==================

(function setupAiChatStub() {
  const trigger = document.getElementById("aiChatTrigger");
  const panel = document.getElementById("aiChatPanel");
  const closeBtn = document.getElementById("aiChatClose");
  const sendBtn = document.getElementById("aiChatSend");
  const input = document.getElementById("aiChatInput");
  const msgContainer = document.getElementById("aiChatMessages");

  // 如果 HTML 未提供 AI chat 結構，就唔啟動 stub，避免報錯
  if (!trigger || !panel || !closeBtn || !sendBtn || !input || !msgContainer) {
    return;
  }

  let isOpen = false;

  function openPanel() {
    panel.classList.remove("ai-chat-hidden");
    isOpen = true;
    input.focus();
    if (!panel.dataset.initiated) {
      panel.dataset.initiated = "1";
      appendAiMessage("你好，我可以幫你解讀目前帳戶 / Symbol 的交易表現。");
    }
  }

  function closePanel() {
    panel.classList.add("ai-chat-hidden");
    isOpen = false;
  }

  trigger.addEventListener("click", () => {
    if (isOpen) closePanel();
    else openPanel();
  });

  closeBtn.addEventListener("click", () => {
    closePanel();
  });

  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  function handleSend() {
    const text = input.value.trim();
    if (!text) return;

    appendUserMessage(text);
    input.value = "";

    const contextSummary = getCurrentSymbolContextSummary();

    // 之後你可以改呢度做 fetch('/api/chat', ...)；而家只係 console log
    console.log("【AI Chat 應該送去後端的 payload】", {
      message: text,
      context: contextSummary
    });

    const fakeReply =
      "（Stub）如果連接真實 API，我會根據以下 context 幫你分析：\n\n" +
      contextSummary;
    appendAiMessage(fakeReply);
  }

  function appendUserMessage(text) {
    const row = document.createElement("div");
    row.className = "ai-chat-message user";
    const bubble = document.createElement("div");
    bubble.className = "ai-chat-bubble";
    bubble.textContent = text;
    row.appendChild(bubble);
    msgContainer.appendChild(row);
    scrollMessagesToBottom();
  }

  function appendAiMessage(text) {
    const row = document.createElement("div");
    row.className = "ai-chat-message ai";
    const bubble = document.createElement("div");
    bubble.className = "ai-chat-bubble";
    bubble.innerHTML = text
      .split("\n")
      .map((line) => line.replace(/ /g, "&nbsp;"))
      .join("<br>");
    row.appendChild(bubble);
    msgContainer.appendChild(row);
    scrollMessagesToBottom();
  }

  function scrollMessagesToBottom() {
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }
})();
