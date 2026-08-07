const state = { data: null, risk: "ALL", scenario: "base", selectedMine: null };

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const riskClass = (risk) => risk.toLowerCase();
const toneClass = (tone) => `tone-${tone || "orange"}`;

function sourceLink(source) {
  return `<a href="${source.url}" target="_blank" rel="noreferrer">${source.name}</a>`;
}

function renderHeader(data) {
  $("#update-line").textContent = `Weekly update Â· ${data.meta.as_of} Â· ${data.meta.review_status}`;
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
      <span><b>${mine.name}</b><small>${mine.country} Â· ${mine.status}</small></span>
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
  drawer.innerHTML = `<h3>${mine.name} Â· ${mine.country}</h3>
    <div><label>Evidence</label><p>${mine.evidence}</p></div>
    <div><label>Quantified signal</label><p>${mine.signal}</p></div>
    <div><label>Next checkpoint</label><p>${mine.next_checkpoint}<br>${sourceLink(mine.source)} Â· ${mine.source.published}</p></div>`;
  drawer.classList.add("open");
  drawer.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderTightness(data) {
  $("#tightness-grid").innerHTML = data.indicators.map((metric) => `
    <div class="metric">
      <label>${metric.label}</label><strong>${metric.value}</strong>
      <div class="signal">${metric.signal}</div>
      <div class="spark">${metric.spark.map((height) => `<i style="height:${height}%"></i>`).join("")}</div>
      <div class="provenance">${sourceLink(metric.source)}<br>Published ${metric.source.published} Â· Tier ${metric.source.tier}</div>
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
  $("#outlook-chart").innerHTML = `${lines}<line class="axis" x1="75" x2="720" y1="310" y2="310"/><path class="supply-line" d="${path(supply)}"/><path class="demand-line" d="${path(demand)}"/>${dots(supply, "supply")}${dots(demand, "demand")}<text x="570" y="25" class="chart-label">Supply â€” green Â· Demand â€” copper</text>`;
  $("#assumption-title").textContent = `${state.scenario[0].toUpperCase()}${state.scenario.slice(1)}-case assumptions`;
  $("#assumptions").innerHTML = scenario.assumptions.map((item) => `<div class="assumption-row"><span>${item.label}<small>${item.detail}</small></span><strong>${item.value}</strong></div>`).join("");
  $("#outlook-note").innerHTML = `${scenario.note} Sources: ${outlook.sources.map(sourceLink).join(" Â· ")}`;
}

function renderDrivers(data) {
  $("#driver-rows").innerHTML = data.items.map((driver) => `<tr>
    <td><b>${driver.name}</b></td><td>${driver.type}</td><td>${driver.horizon}</td>
    <td class="direction ${driver.direction.toLowerCase()}">${driver.direction}</td><td>${driver.momentum}</td>
    <td><span class="dots">${"â—".repeat(driver.evidence)}${"â—‹".repeat(5 - driver.evidence)}</span></td>
  </tr>`).join("");
  $("#driver-assessment").innerHTML = `<h3>Analyst assessment</h3><label>${data.rating}</label><p>${data.assessment}</p><p>${data.sources.map(sourceLink).join(" Â· ")}</p>`;
}

function renderSources(groups) {
  $("#source-groups").innerHTML = groups.map((group) => `<div class="source-group"><h3>Tier ${group.tier} Â· ${group.label}</h3><div class="source-items">${group.sources.map((source) => `<div class="source-item"><a href="${source.url}" target="_blank" rel="noreferrer">${source.name}</a><span>${source.scope}</span></div>`).join("")}</div></div>`).join("");
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
    renderDrivers(state.data.drivers); renderSources(state.data.sourcÛ~½ÚÚ$z{-®éÜj×öG’#¢%F†RvVV¶Ç’¦ö"6†V6·2÷W&F÷"&VÆV6W2Â&VwVÆF÷'’f–Æ–æw2æBv÷fW&æÖVçBæ÷F–6W2f—'7Bâ—BF†Vâ6†V6·2”54rÂ”TÂU4u2Âv÷&ÆB&æ²æB4ô4„”Ä4òâöæÇ’gFW"F†÷6R76W2FöW2—BVW'’tDTÅBæB'&öBæWw2f÷"WfVçG2F†BÖ’æ÷B–WBV"–â&–Ö'’F—66Æ÷7W&W2â Ğ¢ÒÀĞ¢°Ğ¢'F—FÆR#¢#"âF—7'WF–öâ66÷&R"ÀĞ¢&&öG’#¢%&—6²6öÖ&–æW266ÆRƒ3RR’Â7W'&VçB÷W&F–ær–×7Bƒ#RR’ÂW‡V7FVBGW&F–öâƒ#R’Â&V6÷fW'’Væ6W'F–çG’ƒR’æB6÷W&6R6öæf–FVæ6RƒR’â†–v‚—2s(	3ÂÖVF—VÒC(	3c’æBÆ÷r&VÆ÷rCâ&W6öÇfVBWfVçB6â&VÖ–âÖöæ—F÷&VBv†–ÆR—G2÷W&F–öæÂ&—6²fÆÇ2â Ğ¢ÒÀĞ¢°Ğ¢'F—FÆR#¢#2âÖ&¶WBF–v‡FæW72"ÀĞ¢&&öG’#¢$Ö–æRö6öæ6VçG&FRF–v‡FæW72æB&Vf–æVBÖÖ&¶WB&Ææ6R&R76W76VB6W&FVÇ’âG&VFÖVçB6†&vW2ÂÖ–æRWF–Æ—6F–öâÂ–çfVçF÷&–W2Â&Vf–æVB&Ææ6RæB67&&W7öç6R&Ræ÷B6öÆÆ6VB–çFòöæRVç7W÷'FVBçVÖ&W"â Ğ¢ÒÀĞ¢°Ğ¢'F—FÆR#¢#Bâ÷WFÆöö²F—66—Æ–æR"ÀĞ¢&&öG’#¢%V&Æ—6†VBf÷&V67G2&RÆ&VÆÆVB27V6‚â–çFW&æÂ66Væ&–òW‡FVç6–öç2F—66Æ÷6RF†V—"77V×F–öç2æB&RæWfW"&W6VçFVB2F†—&B×'G’f÷&V67G2âÖFW&–Â76W76ÖVçB6†ævW26†÷VÆB&V6V—fRæÇ—7B&Wf–Wr&Vf÷&R&V–ærFW67&–&VB2f–æÂâ Ğ¢ÒÀĞ¢°Ğ¢'F—FÆR#¢#RâVF—BG&–Â"ÀĞ¢&&öG’#¢$V6‚6æF–FFR—FVÒ&V6÷&G26÷W&6RF–W"ÂU$ÂÂ&WG&–WfÂF–ÖRæB6öçFVçBf–ævW'&–çBâvVV¶Ç’FF6†ævW2&R6öÖÖ—GFVBFòfW'6–öâ6öçG&öÂ&Vf÷&RFWÆ÷–ÖVçBÂv—f–ærF†RFVÒ&W&öGV6–&ÆR†—7F÷'’â Ğ¢ĞĞ¢ĞĞ§ĞĞ