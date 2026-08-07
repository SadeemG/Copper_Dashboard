const state = {
  data: null,
  risk: "ALL",
  scenario: "base",
  selectedMine: null,
};

const COLORS = {
  white: "#FFFFFF",
  black: "#000000",
  blue050: "#BFEFFF",
  blue100: "#80DCFF",
  blue300: "#00B5FF",
  blue500: "#007AA8",
  blue700: "#004A64",
  blue900: "#002532",
  red050: "#FFE6ED",
  red100: "#FFCCD9",
  red300: "#FF80A1",
  red500: "#FF0042",
  red700: "#A8002F",
  red900: "#64001C",
  green050: "#C3FFE7",
  green100: "#5FFEBF",
  green300: "#01DD85",
  green500: "#00965B",
  green700: "#00643C",
  green900: "#00321E",
};

const FONT_FAMILY = "Roboto, sans-serif";
const PLOT_CONFIG = {
  responsive: true,
  displaylogo: false,
  displayModeBar: "hover",
  modeBarButtonsToRemove: [
    "zoom2d",
    "pan2d",
    "select2d",
    "lasso2d",
    "zoomIn2d",
    "zoomOut2d",
    "autoScale2d",
    "resetScale2d",
    "hoverClosestCartesian",
    "hoverCompareCartesian",
    "toggleSpikelines",
    "zoomInGeo",
    "zoomOutGeo",
    "resetGeo",
  ],
  toImageButtonOptions: {
    format: "png",
    filename: "ts-lombard-copper-intelligence",
    scale: 2,
  },
  scrollZoom: false,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}

function sourceLink(source) {
  return `<a href="${safeUrl(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.name)}</a>`;
}

function plotLayout(overrides = {}) {
  return {
    autosize: true,
    paper_bgcolor: COLORS.white,
    plot_bgcolor: COLORS.white,
    font: {
      family: FONT_FAMILY,
      color: COLORS.blue900,
      size: 11,
    },
    hoverlabel: {
      bgcolor: COLORS.blue900,
      bordercolor: COLORS.blue900,
      font: { family: FONT_FAMILY, color: COLORS.white, size: 11 },
    },
    margin: { l: 42, r: 16, t: 18, b: 36 },
    showlegend: false,
    ...overrides,
  };
}

function visibleMines() {
  if (state.risk === "ALL") return state.data.disruptions;
  if (state.risk === "RECOVERING") {
    return state.data.disruptions.filter((mine) => mine.status.toLowerCase().includes("recover"));
  }
  return state.data.disruptions.filter((mine) => mine.risk === state.risk);
}

function riskColor(risk) {
  if (risk === "HIGH") return COLORS.red500;
  if (risk === "MEDIUM") return COLORS.red300;
  return COLORS.green500;
}

function trendText(mine) {
  if (mine.status.toLowerCase().includes("recover")) return "Improving";
  if (mine.status.toLowerCase().includes("resolved")) return "Easing";
  return "Stable";
}

function trendClass(mine) {
  return trendText(mine).toLowerCase();
}

function renderHeader(data) {
  $("#update-line").textContent = `Updated ${data.meta.as_of}`;
  $("#footer-sources").textContent = `Sources checked: ${data.meta.sources_checked}`;
  $("#next-refresh").textContent = `Update cadence: Weekly · Next update: ${data.meta.next_refresh}`;
}

function renderKpis(kpis) {
  $("#kpi-rail").innerHTML = kpis
    .map(
      (item) => `
        <div class="kpi">
          <label>${escapeHtml(item.label)}</label>
          <strong class="tone-${item.tone === "red" || item.value === "TIGHT" ? "red" : item.tone === "green" ? "green" : "blue"}">${escapeHtml(item.value)}</strong>
          <small>${escapeHtml(item.detail)}</small>
        </div>`,
    )
    .join("");
}

function renderMap() {
  if (!window.Plotly) return;
  const mines = visibleMines();
  const referenceMines = state.data.reference_mines?.items || [];
  const selected = state.selectedMine;
  const map = $("#mine-map");
  const referenceTrace = {
    type: "scattergeo",
    mode: "markers",
    lon: referenceMines.map((mine) => mine.lon),
    lat: referenceMines.map((mine) => mine.lat),
    text: referenceMines.map((mine) => mine.name),
    customdata: referenceMines.map((mine) => mine.country),
    marker: {
      color: "rgba(0, 37, 50, 0.28)",
      size: 7,
      line: { color: "rgba(0, 37, 50, 0.48)", width: 0.8 },
    },
    hovertemplate:
      "<b>%{text}</b><br>%{customdata}<br>Reference operation · no active disruption assessment<extra></extra>",
  };
  const disruptionTrace = {
    type: "scattergeo",
    mode: "markers",
    lon: mines.map((mine) => mine.lon),
    lat: mines.map((mine) => mine.lat),
    text: mines.map((mine) => mine.name),
    customdata: mines.map((mine) => mine.id),
    marker: {
      color: mines.map((mine) => riskColor(mine.risk)),
      size: mines.map((mine) => (mine.id === selected ? 15 : 10)),
      line: {
        color: mines.map((mine) => (mine.id === selected ? COLORS.blue900 : COLORS.white)),
        width: mines.map((mine) => (mine.id === selected ? 2.5 : 1.5)),
      },
    },
    hovertemplate: "<b>%{text}</b><br>Select for evidence<extra></extra>",
  };

  const layout = plotLayout({
    margin: { l: 0, r: 0, t: 4, b: 0 },
    dragmode: false,
    geo: {
      scope: "world",
      projection: { type: "natural earth" },
      showframe: false,
      showcoastlines: true,
      coastlinecolor: COLORS.blue100,
      coastlinewidth: 0.7,
      showcountries: true,
      countrycolor: COLORS.blue100,
      countrywidth: 0.55,
      showland: true,
      landcolor: COLORS.white,
      showocean: true,
      oceancolor: COLORS.white,
      bgcolor: COLORS.white,
      lataxis: { range: [-55, 78] },
      lonaxis: { range: [-170, 180] },
    },
  });

  window.Plotly.react(map, [referenceTrace, disruptionTrace], layout, PLOT_CONFIG);
  if (typeof map.removeAllListeners === "function") map.removeAllListeners("plotly_click");
  map.on("plotly_click", (event) => {
    const point = event.points?.[0];
    const mineId = point?.curveNumber === 1 ? point.customdata : null;
    if (mineId) showMine(mineId);
  });
}

function renderMineTable() {
  const mines = visibleMines();
  $("#mine-table-body").innerHTML = mines
    .map(
      (mine) => `
        <tr data-mine="${escapeHtml(mine.id)}" class="${mine.id === state.selectedMine ? "selected" : ""}">
          <td>${String(mine.rank).padStart(2, "0")}</td>
          <td><button class="mine-button" type="button" data-mine="${escapeHtml(mine.id)}">${escapeHtml(mine.name)}</button></td>
          <td>${escapeHtml(mine.country)}</td>
          <td>${escapeHtml(mine.status)}</td>
          <td><span class="risk-label ${mine.risk.toLowerCase()}">${escapeHtml(mine.risk)}</span></td>
          <td><span class="trend-label ${trendClass(mine)}">${trendText(mine)}</span></td>
        </tr>`,
    )
    .join("");

  $$(".mine-table tbody tr").forEach((row) => {
    row.addEventListener("click", () => showMine(row.dataset.mine));
  });
}

function showMine(id) {
  const mine = state.data.disruptions.find((item) => item.id === id);
  if (!mine) return;
  state.selectedMine = id;
  renderMineTable();
  renderMap();

  const drawer = $("#mine-detail");
  drawer.innerHTML = `
    <div>
      <label>Selected operation</label>
      <h3>${escapeHtml(mine.name)}</h3>
      <p>${escapeHtml(mine.country)} · ${escapeHtml(mine.status)}</p>
    </div>
    <div>
      <label>Evidence</label>
      <p>${escapeHtml(mine.evidence)}</p>
    </div>
    <div>
      <label>Next checkpoint</label>
      <p>${escapeHtml(mine.next_checkpoint)}</p>
      <p>${sourceLink(mine.source)} · ${escapeHtml(mine.source.published)}</p>
    </div>`;
  drawer.hidden = false;
}

function tightnessTone(metric) {
  const label = metric.label.toLowerCase();
  if (label.includes("gap")) return { line: COLORS.red500, fill: COLORS.red050 };
  if (label.includes("balance")) return { line: COLORS.green500, fill: COLORS.green050 };
  return { line: COLORS.blue500, fill: COLORS.blue050 };
}

function renderTightness(data) {
  $("#tightness-grid").innerHTML = data.indicators
    .map(
      (metric, index) => `
        <article class="tightness-card">
          <header>
            <h3>${escapeHtml(metric.label)}</h3>
            <strong>${escapeHtml(metric.value)}</strong>
          </header>
          <div id="tightness-plot-${index}" class="plot tightness-plot" aria-label="${escapeHtml(metric.label)} recent direction"></div>
          <p>${escapeHtml(metric.signal)}</p>
          ${sourceLink(metric.source)}
        </article>`,
    )
    .join("");

  if (window.Plotly) {
    data.indicators.forEach((metric, index) => {
      const tone = tightnessTone(metric);
      const trace = {
        type: "scatter",
        mode: "lines",
        x: metric.spark.map((_, point) => point),
        y: metric.spark,
        line: { color: tone.line, width: 2 },
        fill: "tozeroy",
        fillcolor: tone.fill,
        hovertemplate: "Direction index: %{y}<extra></extra>",
      };
      const layout = plotLayout({
        margin: { l: 2, r: 2, t: 10, b: 2 },
        xaxis: {
          visible: false,
          fixedrange: true,
        },
        yaxis: {
          visible: false,
          fixedrange: true,
          rangemode: "tozero",
        },
      });
      window.Plotly.react(`tightness-plot-${index}`, [trace], layout, PLOT_CONFIG);
    });
  }

  $("#tightness-assessment").innerHTML = `<strong>${escapeHtml(data.rating)}.</strong> ${escapeHtml(data.assessment)}`;
}

function renderOutlook() {
  const outlook = state.data.outlook;
  const scenario = outlook.scenarios[state.scenario];
  const scenarioLabel = state.scenario[0].toUpperCase() + state.scenario.slice(1);
  const finalGap = scenario.demand.at(-1) - scenario.supply.at(-1);
  const gapFill = finalGap > 0 ? COLORS.red050 : COLORS.green050;

  if (window.Plotly) {
    const supplyTrace = {
      type: "scatter",
      mode: "lines+markers",
      name: "Supply",
      x: scenario.years,
      y: scenario.supply,
      line: { color: COLORS.blue500, width: 2.5 },
      marker: { color: COLORS.blue500, size: 6 },
      hovertemplate: "<b>Supply</b><br>%{x}: %{y:.1f} Mt<extra></extra>",
    };
    const demandTrace = {
      type: "scatter",
      mode: "lines+markers",
      name: "Demand",
      x: scenario.years,
      y: scenario.demand,
      line: { color: COLORS.green500, width: 2.5 },
      marker: { color: COLORS.green500, size: 6 },
      fill: "tonexty",
      fillcolor: gapFill,
      hovertemplate: "<b>Demand</b><br>%{x}: %{y:.1f} Mt<extra></extra>",
    };

    const allValues = [...scenario.supply, ...scenario.demand];
    const layout = plotLayout({
      margin: { l: 52, r: 18, t: 28, b: 42 },
      showlegend: true,
      legend: {
        orientation: "h",
        x: 0,
        y: 1.12,
        font: { family: FONT_FAMILY, size: 10, color: COLORS.blue700 },
      },
      xaxis: {
        tickmode: "array",
        tickvals: scenario.years,
        ticktext: scenario.years,
        tickfont: { family: FONT_FAMILY, size: 10, color: COLORS.blue700 },
        gridcolor: COLORS.blue050,
        linecolor: COLORS.blue100,
        zeroline: false,
        fixedrange: true,
      },
      yaxis: {
        title: { text: "Million tonnes", font: { family: FONT_FAMILY, size: 10, color: COLORS.blue700 } },
        range: [Math.min(...allValues) - 0.3, Math.max(...allValues) + 0.3],
        tickfont: { family: FONT_FAMILY, size: 10, color: COLORS.blue700 },
        gridcolor: COLORS.blue050,
        linecolor: COLORS.blue100,
        zeroline: false,
        fixedrange: true,
      },
      hovermode: "x unified",
      uirevision: "outlook",
    });
    window.Plotly.react("outlook-plot", [supplyTrace, demandTrace], layout, PLOT_CONFIG);
  }

  $("#assumption-title").textContent = `${scenarioLabel}-case assumptions`;
  $("#assumptions").innerHTML = scenario.assumptions
    .map(
      (item) => `
        <div class="assumption-row">
          <span>${escapeHtml(item.label)}<small>${escapeHtml(item.detail)}</small></span>
          <strong>${escapeHtml(item.value)}</strong>
        </div>`,
    )
    .join("");
  $("#outlook-note").innerHTML = `${escapeHtml(scenario.note)} Sources: ${outlook.sources.map(sourceLink).join(" · ")}`;
}

function renderDrivers(data) {
  const endUse = [...data.end_use].reverse();
  const chartLabel = (name) =>
    ({
      "Consumer, cooling & electronics": "Consumer, cooling<br>& electronics",
      "Power & telecom infrastructure": "Power & telecom<br>infrastructure",
      "Building construction": "Building<br>construction",
      "Industrial equipment": "Industrial<br>equipment",
    })[name] || name;
  if (window.Plotly) {
    const trace = {
      type: "bar",
      orientation: "h",
      x: endUse.map((item) => item.share),
      y: endUse.map((item) => chartLabel(item.name)),
      text: endUse.map((item) => `${item.share}%`),
      textposition: "outside",
      cliponaxis: false,
      customdata: endUse.map((item) => [item.name, item.detail]),
      marker: { color: COLORS.blue500 },
      hovertemplate: "<b>%{customdata[0]}</b><br>%{x}% of global copper use<br>%{customdata[1]}<extra></extra>",
    };
    const layout = plotLayout({
      margin: { l: window.innerWidth < 620 ? 132 : 184, r: 42, t: 10, b: 48 },
      xaxis: {
        title: { text: "Share of global copper use · 2024 (%)", font: { family: FONT_FAMILY, size: 10, color: COLORS.blue700 } },
        range: [0, 30],
        dtick: 5,
        tickfont: { family: FONT_FAMILY, size: 10, color: COLORS.blue700 },
        gridcolor: COLORS.blue050,
        linecolor: COLORS.blue100,
        zeroline: false,
        fixedrange: true,
      },
      yaxis: {
        tickfont: { family: FONT_FAMILY, size: window.innerWidth < 620 ? 9 : 10, color: COLORS.blue900 },
        fixedrange: true,
      },
      bargap: 0.38,
    });
    window.Plotly.react("drivers-plot", [trace], layout, PLOT_CONFIG);
  }

  $("#drivers-source").innerHTML = `${escapeHtml(data.end_use_source.note)} Source: ${sourceLink(data.end_use_source)}.`;
  $("#driver-kpis").innerHTML = data.items
    .map(
      (item) => `
        <div class="driver-kpi-row">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.type)} · ${escapeHtml(item.horizon)}</span>
            <em class="driver-direction ${item.direction.toLowerCase()}">${escapeHtml(item.direction)} · ${escapeHtml(item.momentum)}</em>
          </div>
          <div class="evidence-kpi" aria-label="Evidence confidence ${item.evidence} out of 5">
            <strong>${item.evidence}/5</strong>
            <span>Evidence</span>
          </div>
        </div>`,
    )
    .join("");

  $("#driver-assessment").innerHTML = `
    <strong>${escapeHtml(data.rating)}.</strong>
    ${escapeHtml(data.assessment)}
    Sources: ${data.sources.map(sourceLink).join(" · ")}`;
}

function renderSources(groups) {
  $("#source-groups").innerHTML = groups
    .map(
      (group) => `
        <section class="source-group">
          <h3>Tier ${group.tier} · ${escapeHtml(group.label)}</h3>
          ${group.sources
            .map(
              (source) => `
                <div class="source-item">
                  ${sourceLink(source)}
                  <span>${escapeHtml(source.scope)}</span>
                </div>`,
            )
            .join("")}
        </section>`,
    )
    .join("");
}

function renderMethodology(methodology) {
  $("#methodology-content").innerHTML = methodology
    .map((item) => `<h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.body)}</p>`)
    .join("");
}

function bindInteractions() {
  $$(".filter").forEach((button) => {
    button.addEventListener("click", () => {
      state.risk = button.dataset.risk;
      $$(".filter").forEach((item) => item.classList.toggle("active", item === button));
      renderMineTable();
      renderMap();
    });
  });

  $$("[data-scenario]").forEach((button) => {
    button.addEventListener("click", () => {
      state.scenario = button.dataset.scenario;
      $$("[data-scenario]").forEach((item) => item.classList.toggle("active", item === button));
      renderOutlook();
    });
  });

  const dialog = $("#methodology-dialog");
  $$("[data-open-methodology]").forEach((button) => {
    button.addEventListener("click", () => dialog.showModal());
  });

  const navLinks = $$(".section-nav a");
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.forEach((item) => item.classList.toggle("active", item === link));
    });
  });

  const sections = ["overview", "disruptions", "tightness", "outlook", "drivers"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      navLinks.forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === `#${visible.target.id}`);
      });
    },
    { rootMargin: "-25% 0px -65% 0px", threshold: [0, 0.1, 0.5] },
  );
  sections.forEach((section) => observer.observe(section));
}

function showLoadError(error) {
  const main = $("main");
  const alert = document.createElement("section");
  alert.className = "dashboard-section";
  alert.setAttribute("role", "alert");
  alert.innerHTML = `<div class="section-heading"><h2>Dashboard data unavailable</h2></div><p>${escapeHtml(error.message)}</p>`;
  main.prepend(alert);
}

async function init() {
  try {
    const response = await fetch("data/current.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
    state.data = await response.json();

    renderHeader(state.data);
    renderKpis(state.data.kpis);
    renderMineTable();
    renderTightness(state.data.tightness);
    renderOutlook();
    renderDrivers(state.data.drivers);
    renderSources(state.data.source_register);
    renderMethodology(state.data.methodology);
    bindInteractions();

    if (!window.Plotly) {
      document.body.classList.add("plotly-not-ready");
      console.error("Plotly failed to load; data tables remain available.");
      return;
    }
    renderMap();
  } catch (error) {
    showLoadError(error);
    console.error(error);
  }
}

init();
