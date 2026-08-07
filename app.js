const state = { data: null, risk: "ALL", scenario: "base", selectedMine: null };

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const riskClass = (risk) => risk.toLowerCase();
const toneClass = (tone) => `tone-${tone || "orange"}`;

function sourceLink(source) {
  return `<a href="${source.url}" target="_blank" rel="noreferrer">${source.name}</a>`;
}

function renderHeader(data) {
  $("#update-line").textContent = `Weekly update · ${data.meta.as_of} · ${data.meta.review_status}`;
  $("#sources-checked").textContent = `Sources checked ${data.meta.sources_checked}`;
  $("#next-refresh").textContent = `Next scheduled refresh: ${data.meta.next_refresh}`;
}

function renderKpis(kpis) {
  $("#kpi-rail").innerHTML = kpis.map((item) => `
    <div class="kpi"><label>${item.label}</label><strong class="${toneClass(item.tone)}">${item.value}</strong><small>${item.detail}</small></div>
  `).join("");
}

function mapCoordinates(lon, lat) {
  return { x: 450 + lon * 2.12, y: 220 - lat * 2.12 };
}

function renderMap(mines) {
  const land = `
    <path class="land" d="M60 120 L170 65 290 90 330 155 292 204 230 194 185 240 117 217 73 171Z"/>
    <path class="land" d="M240 255 L310 240 338 288 320 355 286 414 262 346Z"/>
    <path class="land" d="M407 107 L473 68 580 76 626 116 716 94 824 135 839 193 775 229 681 207 624 249 551 224 514 177 453 188 411 157Z"/>
    <path class="land" d="M455 209 L550 202 592 264 568 365 509 388 465 307Z"/>
    <path class="land" d="M731 307 L811 294 847 340 817 390 748 375Z"/>
  `;
  const visible = mines.filter((mine) => state.risk === "ALL" || mine.risk === state.risk || (state.risk === "RECOVERING" && mine.status.toLowerCase().includes("recover")));
  const markers = visible.map((mine) => {
    const { x, y } = mapCoordinates(mine.lon, mine.lat);
    const color = mine.risk === "HIGH" ? "#ff514b" : mine.risk === "MEDIUM" ? "#f5a623" : "#5bbf6a";
    const anchor = x > 690 ? "end" : "start";
    const offset = x > 690 ? -13 : 13;
    return `<g class="map-mine" data-mine="${mine.id}" tabindex="0" role="button" aria-label="Open ${mine.name}">
      <circle class="mine-marker" cx="${x}" cy="${y}" r="9" fill="${color}" />
      <text class="marker-label" x="${x + offset}" y="${y - 12}" text-anchor="${anchor}">${mine.name}</text>
    </g>`;
  }).join("");
  $("#world-map").innerHTML = `<rect width="900" height="440" fill="#061725"/>${land}${markers}`;
  $$(".map-mine").forEach((marker) => {
    const open = () => showMine(marker.dataset.mine);
    marker.addEventListener("click", open);
    marker.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") open(); });
  });
}

function renderMineList(mines) {
  const visible = mines.filter((mine) => state.risk === "ALL" || mine.risk === state.risk || (state.risk === "RECOVERING" && mine.status.toLowerCase().includes("recover")));
  $("#mine-list").innerHTML = visible.map((mine) => `
    <button class="mine-row ${state.selectedMine === mine.id ? "selected" : ""}" data-mine="${mine.id}">
      <b>${String(mine.rank).padStart(2, "0")}</b>
      <span><b>${mine.name}</b><small>${mine.country} · ${mine.status}</small></span>
      <span class="risk ${riskClass(mine.risk)}">${mine.risk}</span>
      <span class="mine-issue">${mine.issue}<small>${mine.operator}</small></span>
      <span class="trend">${mine.trend}</span>
    </button>`).join("");
  $$(".mine-row").forEach((row) => row.addEventListener("click", () => showMine(row.dataset.mine)));
}

function showMine(id) {
  state.selectedMine = id;
  const mine = state.data.disruptions.find((item) => item.id === id);
  if (!mine) return;
  renderMineList(state.data.disruptions);
  const drawer = $("#mine-detail");
  drawer.innerHTML = `<h3>${mine.name} · ${mine.country}</h3>
    <div><label>Evidence</label><p>${mine.evidence}</p></div>
    <div><label>Quantified signal</label><p>${mine.signal}</p></div>
    <div><label>Next checkpoint</label><p>${mine.next_checkpoint}<br>${sourceLink(mine.source)} · ${mine.source.published}</p></div>`;
  drawer.classList.add("open");
  drawer.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderTightness(data) {
  $("#tightness-grid").innerHTML = data.indicators.map((metric) => `
    <div class="metric">
      <label>${metric.label}</label><strong>${metric.value}</strong>
      <div class="signal">${metric.signal}</div>
      <div class="spark">${metric.spark.map((height) => `<i style="height:${height}%"></i>`).join("")}</div>
      <div class="provenance">${sourceLink(metric.source)}<br>Published ${metric.source.published} · Tier ${metric.source.tier}</div>
    </div>`).join("");
  $("#tightness-assessment").innerHTML = `<b>Assessment: ${data.rating}.</b> ${data.assessment}`;
}

function chartPath(points, values, min, max, top = 55, bottom = 310) {
  const step = 610 / (points.length - 1);
  return values.map((value, index) => {
    const x = 90 + step * index;
    const y = bottom - ((value - min) / (max - min)) * (bottom - top);
    return { x, y, value, label: points[index] };
  });
}

function renderOutlook() {
  const outlook = state.data.outlook;
  const scenario = outlook.scenarios[state.scenario];
  const years = scenario.years;
  const allValues = [...scenario.supply, ...scenario.demand];
  const min = Math.floor(Math.min(...allValues) - .5);
  const max = Math.ceil(Math.max(...allValues) + .5);
  const supply = chartPath(years, scenario.supply, min, max);
  const demand = chartPath(years, scenario.demand, min, max);
  const path = (points) => points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ");
  const lines = [0, 1, 2, 3].map((index) => {
    const y = 55 + index * 85;
    const value = (max - ((max - min) / 3) * index).toFixed(1);
    return `<line class="grid-line" x1="75" x2="720" y1="${y}" y2="${y}"/><text class="chart-label" x="20" y="${y + 4}">${value} Mt</text>`;
  }).join("");
  const dots = (points, klass) => points.map((point) => `<circle class="chart-dot ${klass}" cx="${point.x}" cy="${point.y}" r="6"/><text class="chart-value" x="${point.x}" y="${point.y - 14}" text-anchor="middle">${point.value}</text><text class="chart-label" x="${point.x}" y="340" text-anchor="middle">${point.label}</text>`).join("");
  $("#outlook-chart").innerHTML = `${lines}<line class="axis" x1="75" x2="720" y1="310" y2="310"/><path class="supply-line" d="${path(supply)}"/><path class="demand-line" d="${path(demand)}"/>${dots(supply, "supply")}${dots(demand, "demand")}<text x="570" y="25" class="chart-label">Supply — green · Demand — copper</text>`;
  $("#assumption-title").textContent = `${state.scenario[0].toUpperCase()}${state.scenario.slice(1)}-case assumptions`;
  $("#assumptions").innerHTML = scenario.assumptions.map((item) => `<div class="assumption-row"><span>${item.label}<small>${item.detail}</small></span><strong>${item.value}</strong></div>`).join("");
  $("#outlook-note").innerHTML = `${scenario.note} Sources: ${outlook.sources.map(sourceLink).join(" · ")}`;
}

function renderDrivers(data) {
  $("#driver-rows").innerHTML = data.items.map((driver) => `<tr>
    <td><b>${driver.name}</b></td><td>${driver.type}</td><td>${driver.horizon}</td>
    <td class="direction ${driver.direction.toLowerCase()}">${driver.direction}</td><td>${driver.momentum}</td>
    <td><span class="dots">${"●".repeat(driver.evidence)}${"○".repeat(5 - driver.evidence)}</span></td>
  </tr>`).join("");
  $("#driver-assessment").innerHTML = `<h3>Analyst assessment</h3><label>${data.rating}</label><p>${data.assessment}</p><p>${data.sources.map(sourceLink).join(" · ")}</p>`;
}

function renderSources(groups) {
  $("#source-groups").innerHTML = groups.map((group) => `<div class="source-group"><h3>Tier ${group.tier} · ${group.label}</h3><div class="source-items">${group.sources.map((source) => `<div class="source-item"><a href="${source.url}" target="_blank" rel="noreferrer">${source.name}</a><span>${source.scope}</span></div>`).join("")}</div></div>`).join("");
}

function renderMethodology(methodology) {
  $("#methodology-content").innerHTML = methodology.map((item) => `<h3>${item.title}</h3><p>${item.body}</p>`).join("");
}

function bindInteractions() {
  $$(".tab").forEach((tab) => tab.addEventListener("click", () => {
    $$(".tab").forEach((item) => item.classList.toggle("active", item === tab));
    document.getElementById(tab.dataset.target).scrollIntoView({ behavior: "smooth" });
  }));
  $$(".filter").forEach((button) => button.addEventListener("click", () => {
    state.risk = button.dataset.risk;
    $$(".filter").forEach((item) => item.classList.toggle("active", item === button));
    renderMap(state.data.disruptions); renderMineList(state.data.disruptions);
  }));
  $$("[data-scenario]").forEach((button) => button.addEventListener("click", () => {
    state.scenario = button.dataset.scenario;
    $$("[data-scenario]").forEach((item) => item.classList.toggle("active", item === button));
    renderOutlook();
  }));
  const dialog = $("#methodology-dialog");
  $$("[data-open-methodology]").forEach((button) => button.addEventListener("click", () => dialog.showModal()));
}

async function init() {
  try {
    const response = await fetch("data/current.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
    state.data = await response.json();
    renderHeader(state.data); renderKpis(state.data.kpis); renderMap(state.data.disruptions);
    renderMineList(state.data.disruptions); renderTightness(state.data.tightness); renderOutlook();
    renderDrivers(state.data.drivers); renderSources(state.data.source_register); renderMethodology(state.data.methodology);
    bindInteractions();
  } catch (error) {
    document.body.innerHTML = `<main><section class="dashboard-section"><div class="section-heading"><div><h2>Dashboard data unavailable</h2><p>${error.message}</p></div></div></section></main>`;
    console.error(error);
  }
}

init();
