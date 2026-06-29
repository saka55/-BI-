const regions = ["関東", "関西", "中部", "九州", "北海道"];
const categories = ["食品", "生活雑貨", "美容", "ホーム", "アウトドア"];
const channels = ["店舗", "EC", "卸"];
const months = [
  "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06",
  "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
  "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"
];

const palette = {
  "店舗": "#16847c",
  "EC": "#315f9f",
  "卸": "#b7791f",
  "食品": "#16847c",
  "生活雑貨": "#315f9f",
  "美容": "#c95243",
  "ホーム": "#357a38",
  "アウトドア": "#b7791f"
};

const state = {
  view: "overview",
  range: 12,
  region: "all",
  category: "all",
  channels: new Set(channels)
};

const titleMap = {
  overview: "売上状況サマリー",
  region: "地域別パフォーマンス",
  product: "商品カテゴリ分析",
  record: "実績欄向けプロジェクト説明"
};

function seededRandom(seed) {
  let value = seed;
  return function next() {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = seededRandom(20260629);

function generateData() {
  const regionBase = { "関東": 3300000, "関西": 2500000, "中部": 1900000, "九州": 1450000, "北海道": 1100000 };
  const categoryFactor = { "食品": 1.14, "生活雑貨": 0.98, "美容": 0.88, "ホーム": 0.8, "アウトドア": 0.62 };
  const channelFactor = { "店舗": 1.0, "EC": 0.72, "卸": 0.5 };
  const marginBase = { "食品": 0.26, "生活雑貨": 0.31, "美容": 0.38, "ホーム": 0.29, "アウトドア": 0.34 };
  const avgOrder = { "食品": 3900, "生活雑貨": 5200, "美容": 6100, "ホーム": 9600, "アウトドア": 12800 };

  const rows = [];
  months.forEach((month, monthIndex) => {
    const season = 1 + Math.sin((monthIndex + 1) / 12 * Math.PI * 2) * 0.08;
    const holidayLift = month.endsWith("-12") ? 1.18 : 1;
    const growth = 1 + monthIndex * 0.012;

    regions.forEach((region) => {
      categories.forEach((category) => {
        channels.forEach((channel) => {
          const channelShift = channel === "EC" ? 1 + monthIndex * 0.006 : channel === "店舗" ? 1 - monthIndex * 0.002 : 1;
          const noise = 0.9 + rand() * 0.2;
          const revenue = Math.round(
            regionBase[region] *
            categoryFactor[category] *
            channelFactor[channel] *
            season *
            holidayLift *
            growth *
            channelShift *
            noise / 1000
          ) * 1000;
          const marginRate = marginBase[category] + (channel === "EC" ? 0.025 : channel === "卸" ? -0.045 : 0) + (rand() - 0.5) * 0.035;
          const grossProfit = Math.round(revenue * marginRate);
          const orders = Math.max(8, Math.round(revenue / avgOrder[category] * (0.92 + rand() * 0.18)));
          const target = Math.round(revenue * (0.94 + rand() * 0.16));
          const stockoutRate = Math.max(0.01, Math.min(0.12, 0.035 + (category === "食品" ? 0.012 : 0) + (channel === "EC" ? 0.01 : 0) + (rand() - 0.5) * 0.03));
          const returnRate = Math.max(0.004, Math.min(0.08, 0.018 + (category === "美容" ? 0.01 : 0) + (channel === "EC" ? 0.014 : 0) + (rand() - 0.5) * 0.018));
          const adSpend = Math.round(revenue * (channel === "EC" ? 0.055 : channel === "店舗" ? 0.022 : 0.012));

          rows.push({
            month,
            region,
            category,
            channel,
            revenue,
            grossProfit,
            cost: revenue - grossProfit,
            orders,
            target,
            stockout: Math.round(orders * stockoutRate),
            returns: Math.round(orders * returnRate),
            adSpend
          });
        });
      });
    });
  });

  return rows;
}

const data = generateData();

function yen(value) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0
  }).format(value);
}

function shortYen(value) {
  const abs = Math.abs(value);
  if (abs >= 100000000) return `${(value / 100000000).toFixed(1)}億円`;
  if (abs >= 10000) return `${Math.round(value / 10000).toLocaleString("ja-JP")}万円`;
  return yen(value);
}

function pct(value, digits = 1) {
  if (!Number.isFinite(value)) return "--";
  return `${(value * 100).toFixed(digits)}%`;
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + row[key], 0);
}

function groupBy(rows, keyFn) {
  return rows.reduce((map, row) => {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
    return map;
  }, new Map());
}

function currentMonths() {
  return months.slice(-state.range);
}

function filteredRows() {
  const activeMonths = new Set(currentMonths());
  return data.filter((row) => {
    return activeMonths.has(row.month) &&
      (state.region === "all" || row.region === state.region) &&
      (state.category === "all" || row.category === state.category) &&
      state.channels.has(row.channel);
  });
}

function previousRows() {
  const start = Math.max(0, months.length - state.range * 2);
  const end = months.length - state.range;
  const previousMonths = new Set(months.slice(start, end));
  return data.filter((row) => {
    return previousMonths.has(row.month) &&
      (state.region === "all" || row.region === state.region) &&
      (state.category === "all" || row.category === state.category) &&
      state.channels.has(row.channel);
  });
}

function metric(rows) {
  const revenue = sum(rows, "revenue");
  const grossProfit = sum(rows, "grossProfit");
  const orders = sum(rows, "orders");
  const target = sum(rows, "target");
  const returns = sum(rows, "returns");
  const stockout = sum(rows, "stockout");
  return {
    revenue,
    grossProfit,
    orders,
    target,
    returns,
    stockout,
    marginRate: revenue ? grossProfit / revenue : 0,
    targetRate: target ? revenue / target : 0,
    returnRate: orders ? returns / orders : 0,
    stockoutRate: orders ? stockout / orders : 0
  };
}

function renderKpis(rows) {
  const now = metric(rows);
  const prevRows = previousRows();
  const prev = metric(prevRows);
  const currentMonthCount = new Set(rows.map((row) => row.month)).size || 1;
  const previousMonthCount = new Set(prevRows.map((row) => row.month)).size;
  const averageDelta = (current, previous) => {
    if (!previous || !previousMonthCount) return null;
    return (current / currentMonthCount - previous / previousMonthCount) / (previous / previousMonthCount);
  };
  const rateDelta = (current, previous) => {
    if (!previousMonthCount) return null;
    return current - previous;
  };
  const cards = [
    { label: "売上", value: shortYen(now.revenue), change: averageDelta(now.revenue, prev.revenue), kind: "percent", suffix: " / 月平均" },
    { label: "粗利", value: shortYen(now.grossProfit), change: averageDelta(now.grossProfit, prev.grossProfit), kind: "percent", suffix: " / 月平均" },
    { label: "粗利率", value: pct(now.marginRate), change: rateDelta(now.marginRate, prev.marginRate), kind: "point", suffix: " / 前期" },
    { label: "注文数", value: now.orders.toLocaleString("ja-JP"), change: averageDelta(now.orders, prev.orders), kind: "percent", suffix: " / 月平均" },
    { label: "目標達成", value: pct(now.targetRate), change: rateDelta(now.targetRate, prev.targetRate), kind: "point", suffix: " / 前期" },
    { label: "返品率", value: pct(now.returnRate), change: rateDelta(prev.returnRate, now.returnRate), kind: "point", suffix: " / 改善" }
  ];

  document.getElementById("kpiGrid").innerHTML = cards.map((card) => {
    const hasComparison = Number.isFinite(card.change);
    const className = hasComparison && card.change >= 0 ? "is-up" : "is-down";
    const arrow = hasComparison && card.change >= 0 ? "▲" : "▼";
    const changeLabel = !hasComparison
      ? "比較データなし"
      : `${arrow} ${Math.abs(card.change * 100).toFixed(1)}${card.kind === "point" ? "pt" : "%"}${card.suffix}`;
    return `
      <article class="kpi-card">
        <div class="kpi-label">${card.label}</div>
        <div class="kpi-value">${card.value}</div>
        <div class="kpi-delta ${hasComparison ? className : ""}">${changeLabel}</div>
      </article>
    `;
  }).join("");

  document.getElementById("targetBadge").textContent = `目標達成 ${pct(now.targetRate)}`;
}

function renderTrendChart(rows) {
  const grouped = groupBy(rows, (row) => row.month);
  const series = currentMonths().map((month) => {
    const monthRows = grouped.get(month) || [];
    return {
      month,
      revenue: sum(monthRows, "revenue"),
      grossProfit: sum(monthRows, "grossProfit"),
      target: sum(monthRows, "target")
    };
  });

  const svg = document.getElementById("trendChart");
  const width = 760;
  const height = 320;
  const pad = { left: 58, right: 28, top: 24, bottom: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const maxValue = Math.max(1, ...series.flatMap((item) => [item.revenue, item.grossProfit, item.target])) * 1.12;

  const x = (index) => pad.left + (series.length === 1 ? plotW / 2 : index / (series.length - 1) * plotW);
  const y = (value) => pad.top + plotH - value / maxValue * plotH;
  const path = (key) => series.map((item, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(item[key]).toFixed(1)}`).join(" ");
  const grid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const yPos = pad.top + plotH - ratio * plotH;
    return `<line class="chart-grid-line" x1="${pad.left}" y1="${yPos}" x2="${width - pad.right}" y2="${yPos}"></line>
      <text class="axis-label" x="8" y="${yPos + 4}">${shortYen(maxValue * ratio)}</text>`;
  }).join("");
  const labels = series.map((item, index) => {
    const [year, month] = item.month.split("-");
    const visible = series.length <= 8 || index % 2 === 0 || index === series.length - 1;
    return visible ? `<text class="axis-label" x="${x(index)}" y="${height - 16}" text-anchor="middle">${year.slice(2)}/${month}</text>` : "";
  }).join("");

  svg.innerHTML = `
    ${grid}
    <path d="${path("target")}" fill="none" stroke="#b7791f" stroke-width="2" stroke-dasharray="5 5"></path>
    <path d="${path("revenue")}" fill="none" stroke="#16847c" stroke-width="4" stroke-linecap="round"></path>
    <path d="${path("grossProfit")}" fill="none" stroke="#315f9f" stroke-width="3" stroke-linecap="round"></path>
    ${series.map((item, index) => `<circle cx="${x(index)}" cy="${y(item.revenue)}" r="4" fill="#16847c"><title>${item.month} 売上 ${yen(item.revenue)}</title></circle>`).join("")}
    ${labels}
    <g transform="translate(${width - 250}, 18)">
      <circle cx="0" cy="0" r="5" fill="#16847c"></circle><text class="axis-label" x="10" y="4">売上</text>
      <circle cx="58" cy="0" r="5" fill="#315f9f"></circle><text class="axis-label" x="68" y="4">粗利</text>
      <line x1="116" y1="0" x2="136" y2="0" stroke="#b7791f" stroke-width="2" stroke-dasharray="5 5"></line><text class="axis-label" x="144" y="4">目標</text>
    </g>
  `;
}

function renderChannelMix(rows) {
  const grouped = [...groupBy(rows, (row) => row.channel)].map(([name, groupRows]) => {
    const revenue = sum(groupRows, "revenue");
    const grossProfit = sum(groupRows, "grossProfit");
    return {
      name,
      revenue,
      margin: revenue ? grossProfit / revenue : 0
    };
  }).sort((a, b) => channels.indexOf(a.name) - channels.indexOf(b.name));

  const total = grouped.reduce((acc, item) => acc + item.revenue, 0) || 1;
  let cursor = 0;
  const gradient = grouped.map((item) => {
    const start = cursor;
    const end = cursor + item.revenue / total * 360;
    cursor = end;
    return `${palette[item.name]} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`;
  }).join(", ");

  document.getElementById("channelDonut").style.background = `conic-gradient(${gradient || "#e8eeee 0 360deg"})`;
  document.getElementById("channelLegend").innerHTML = grouped.map((item) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${palette[item.name]}"></span>
      <span class="legend-name">${item.name}</span>
      <span class="legend-value">${pct(item.revenue / total)} / 粗利率 ${pct(item.margin)}</span>
    </div>
  `).join("");
}

function renderRegionChart(rows) {
  const items = [...groupBy(rows, (row) => row.region)].map(([name, groupRows]) => ({
    name,
    revenue: sum(groupRows, "revenue"),
    margin: sum(groupRows, "revenue") ? sum(groupRows, "grossProfit") / sum(groupRows, "revenue") : 0
  })).sort((a, b) => b.revenue - a.revenue);

  const svg = document.getElementById("regionChart");
  const width = 520;
  const rowH = 44;
  const maxValue = Math.max(1, ...items.map((item) => item.revenue));
  const left = 72;
  const right = 94;
  const top = 28;
  const barW = width - left - right;

  svg.innerHTML = items.map((item, index) => {
    const y = top + index * rowH;
    const w = item.revenue / maxValue * barW;
    return `
      <text class="axis-label" x="0" y="${y + 19}">${item.name}</text>
      <rect x="${left}" y="${y}" width="${barW}" height="22" rx="7" fill="#eef3f3"></rect>
      <rect x="${left}" y="${y}" width="${w}" height="22" rx="7" fill="#16847c"></rect>
      <text class="axis-label" x="${left + barW + 10}" y="${y + 16}">${shortYen(item.revenue)}</text>
      <text class="axis-label" x="${left}" y="${y + 36}">粗利率 ${pct(item.margin)}</text>
    `;
  }).join("");
}

function renderCategoryRanking(rows) {
  const items = [...groupBy(rows, (row) => row.category)].map(([name, groupRows]) => {
    const revenue = sum(groupRows, "revenue");
    const grossProfit = sum(groupRows, "grossProfit");
    const orders = sum(groupRows, "orders");
    return {
      name,
      revenue,
      margin: revenue ? grossProfit / revenue : 0,
      stockoutRate: orders ? sum(groupRows, "stockout") / orders : 0
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const maxValue = Math.max(1, ...items.map((item) => item.revenue));
  document.getElementById("categoryRanking").innerHTML = items.map((item) => `
    <div class="rank-row">
      <strong>${item.name}</strong>
      <div class="rank-bar"><span style="width:${item.revenue / maxValue * 100}%; background:${palette[item.name]}"></span></div>
      <div class="rank-meta">
        <span>${shortYen(item.revenue)}</span>
        <span>粗利 ${pct(item.margin)} / 欠品 ${pct(item.stockoutRate)}</span>
      </div>
    </div>
  `).join("");
}

function renderHeatmap(rows) {
  const grouped = groupBy(rows, (row) => `${row.region}|${row.category}`);
  const values = regions.flatMap((region) => categories.map((category) => {
    const groupRows = grouped.get(`${region}|${category}`) || [];
    return {
      region,
      category,
      revenue: sum(groupRows, "revenue")
    };
  }));
  const maxValue = Math.max(1, ...values.map((item) => item.revenue));
  const map = new Map(values.map((item) => [`${item.region}|${item.category}`, item]));
  const header = `<div class="heatmap-cell header">地域</div>${categories.map((category) => `<div class="heatmap-cell header">${category}</div>`).join("")}`;
  const rowsHtml = regions.map((region) => {
    const cells = categories.map((category) => {
      const item = map.get(`${region}|${category}`);
      const alpha = item.revenue ? 0.12 + item.revenue / maxValue * 0.74 : 0.05;
      return `
        <div class="heatmap-cell" style="background:rgba(22,132,124,${alpha.toFixed(2)})">
          ${category}
          <strong>${shortYen(item.revenue)}</strong>
        </div>
      `;
    }).join("");
    return `<div class="heatmap-cell header">${region}</div>${cells}`;
  }).join("");

  document.getElementById("heatmap").innerHTML = header + rowsHtml;
}

function renderInsights(rows) {
  const regionItems = [...groupBy(rows, (row) => row.region)].map(([name, groupRows]) => ({
    name,
    revenue: sum(groupRows, "revenue"),
    margin: sum(groupRows, "grossProfit") / Math.max(1, sum(groupRows, "revenue"))
  })).sort((a, b) => b.revenue - a.revenue);
  const categoryItems = [...groupBy(rows, (row) => row.category)].map(([name, groupRows]) => ({
    name,
    revenue: sum(groupRows, "revenue"),
    stockoutRate: sum(groupRows, "stockout") / Math.max(1, sum(groupRows, "orders"))
  })).sort((a, b) => b.stockoutRate - a.stockoutRate);
  const channelItems = [...groupBy(rows, (row) => row.channel)].map(([name, groupRows]) => ({
    name,
    revenue: sum(groupRows, "revenue")
  })).sort((a, b) => b.revenue - a.revenue);
  const totalRevenue = sum(rows, "revenue") || 1;
  const kpi = metric(rows);
  const bestRegion = regionItems[0] || { name: "--", revenue: 0, margin: 0 };
  const stockRisk = categoryItems[0] || { name: "--", stockoutRate: 0 };
  const topChannel = channelItems[0] || { name: "--", revenue: 0 };

  const insights = [
    `${bestRegion.name}が売上トップで、全体の${pct(bestRegion.revenue / totalRevenue)}を占めています。地域施策の優先候補です。`,
    `${topChannel.name}チャネルの構成比が${pct(topChannel.revenue / totalRevenue)}です。チャネル別の広告費や在庫配分と合わせて確認できます。`,
    `${stockRisk.name}カテゴリの欠品率が${pct(stockRisk.stockoutRate)}で最も高く、販売機会損失の確認対象です。`,
    `全体の目標達成率は${pct(kpi.targetRate)}、粗利率は${pct(kpi.marginRate)}です。売上拡大と利益維持を同じ画面で見られます。`
  ];

  document.getElementById("insightList").innerHTML = insights.map((item) => `<li>${item}</li>`).join("");
}

function renderTable(rows) {
  const items = [...groupBy(rows, (row) => `${row.region}|${row.category}|${row.channel}`)].map(([key, groupRows]) => {
    const [region, category, channel] = key.split("|");
    const revenue = sum(groupRows, "revenue");
    const grossProfit = sum(groupRows, "grossProfit");
    const target = sum(groupRows, "target");
    return {
      region,
      category,
      channel,
      revenue,
      margin: revenue ? grossProfit / revenue : 0,
      orders: sum(groupRows, "orders"),
      targetRate: target ? revenue / target : 0
    };
  }).sort((a, b) => b.revenue - a.revenue).slice(0, 12);

  document.querySelector("#detailTable tbody").innerHTML = items.map((item) => `
    <tr>
      <td>${item.region}</td>
      <td>${item.category}</td>
      <td>${item.channel}</td>
      <td class="numeric">${shortYen(item.revenue)}</td>
      <td class="numeric">${pct(item.margin)}</td>
      <td class="numeric">${item.orders.toLocaleString("ja-JP")}</td>
      <td class="numeric">${pct(item.targetRate)}</td>
    </tr>
  `).join("");
}

function updateLabels() {
  const regionLabel = state.region === "all" ? "全地域" : state.region;
  const categoryLabel = state.category === "all" ? "全カテゴリ" : state.category;
  const channelLabel = state.channels.size === channels.length ? "全チャネル" : [...state.channels].join("・");
  document.getElementById("viewTitle").textContent = titleMap[state.view];
  document.getElementById("activeFilterLabel").textContent = `直近${state.range}か月 / ${regionLabel} / ${categoryLabel} / ${channelLabel}`;

  document.querySelectorAll("[data-panel]").forEach((panel) => {
    const supported = panel.dataset.panel.split(" ");
    panel.hidden = !supported.includes(state.view);
  });

  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === state.view);
  });
}

function render() {
  const rows = filteredRows();
  renderKpis(rows);
  renderTrendChart(rows);
  renderChannelMix(rows);
  renderRegionChart(rows);
  renderCategoryRanking(rows);
  renderHeatmap(rows);
  renderInsights(rows);
  renderTable(rows);
  updateLabels();
}

function populateFilters() {
  const regionFilter = document.getElementById("regionFilter");
  regions.forEach((region) => {
    const option = document.createElement("option");
    option.value = region;
    option.textContent = region;
    regionFilter.appendChild(option);
  });

  const categoryFilter = document.getElementById("categoryFilter");
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.appendChild(option);
  });
}

function toast(message) {
  const element = document.getElementById("toast");
  element.textContent = message;
  element.classList.add("is-visible");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => element.classList.remove("is-visible"), 2600);
}

function exportCsv() {
  const rows = filteredRows();
  const header = ["month", "region", "category", "channel", "revenue", "grossProfit", "orders", "target", "stockout", "returns", "adSpend"];
  const csv = [
    header.join(","),
    ...rows.map((row) => header.map((key) => row[key]).join(","))
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "retail-pulse-bi-filtered.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("現在の絞り込み条件でCSVを出力しました。");
}

function copySummary() {
  const summary = `Retail Pulse BI

小売・ECの売上データを対象に、売上、粗利、目標達成率、チャネル別比率、地域別売上、カテゴリ別収益性を可視化するBIダッシュボードを作成しました。

構成: 販売データ(CSV/基幹データ想定) → JavaScriptによる集計処理 → HTML/CSS/SVGによる可視化UI → インサイト表示・CSV出力

内容: 期間、地域、商品カテゴリ、販売チャネルで絞り込み、KPI、月次推移、地域×カテゴリのヒートマップ、明細テーブルを連動して更新できるようにしました。

こだわった点: 売上だけでなく粗利率、欠品率、目標達成率を同時に見られるようにし、現場担当者が次の施策を判断しやすい画面構成にしました。外部ライブラリなしで動く静的Webアプリとして作成し、公開や共有がしやすい点にも配慮しました。`;

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(summary).then(() => toast("説明文をコピーしました。"));
  } else {
    const textarea = document.createElement("textarea");
    textarea.value = summary;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    toast("説明文をコピーしました。");
  }
}

function resetFilters() {
  state.range = 12;
  state.region = "all";
  state.category = "all";
  state.channels = new Set(channels);
  document.getElementById("dateRange").value = "12";
  document.getElementById("regionFilter").value = "all";
  document.getElementById("categoryFilter").value = "all";
  document.querySelectorAll(".channel-set input").forEach((input) => {
    input.checked = true;
  });
  render();
}

function bindEvents() {
  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.view = button.dataset.view;
      render();
    });
  });

  document.getElementById("dateRange").addEventListener("change", (event) => {
    state.range = Number(event.target.value);
    render();
  });
  document.getElementById("regionFilter").addEventListener("change", (event) => {
    state.region = event.target.value;
    render();
  });
  document.getElementById("categoryFilter").addEventListener("change", (event) => {
    state.category = event.target.value;
    render();
  });
  document.querySelectorAll(".channel-set input").forEach((input) => {
    input.addEventListener("change", () => {
      const checked = [...document.querySelectorAll(".channel-set input:checked")].map((item) => item.value);
      state.channels = new Set(checked.length ? checked : channels);
      if (!checked.length) {
        document.querySelectorAll(".channel-set input").forEach((item) => {
          item.checked = true;
        });
      }
      render();
    });
  });
  document.getElementById("exportCsv").addEventListener("click", exportCsv);
  document.getElementById("copySummary").addEventListener("click", copySummary);
  document.getElementById("resetFilters").addEventListener("click", resetFilters);
}

populateFilters();
bindEvents();
render();
