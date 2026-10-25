const DEFAULT_DEAL_SCENARIO = Object.freeze({
  currentValue: 18000, currentMpg: 25, currentRetention: 45,
  rivalPrice: 30000, rivalMpg: 32, rivalRetention: 55,
  toyotaRetention: 60, toyotaSafety: 80, rivalSafety: 60, currentSafety: 40,
  toyotaMaintenance: 500, rivalMaintenance: 650, currentMaintenance: 1000,
});
let activeDealScenario = { ...DEFAULT_DEAL_SCENARIO };
let dealChartMode = "resale";
let dealAssumptionsOpen = false;
function dealScenario() { return activeDealScenario; }
function resetDealScenario() {
  activeDealScenario = { ...DEFAULT_DEAL_SCENARIO };
  dealChartMode = "resale";
  dealAssumptionsOpen = false;
}
const insightColors = ["#1F74AD", "#E98E2E", "#979797"];
const insightEscape = (text) => String(text).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function insightBars(rows, unit, max = 100) {
  return `<div class="comparison-bars">${rows.map(([label, value], i) => `
    <div class="metric-bar"><div class="insight-bar-label"><span>${insightEscape(label)}</span><strong>${unit === "$" ? dollars(value) : `${Math.round(value).toLocaleString()}${unit}`}</strong></div>
    <div class="bar-track"><i style="display:block;height:100%;width:${DealModel.clamp(value / max * 100)}%;background:${insightColors[i]}"></i></div></div>`).join("")}</div>`;
}

function dealProjection() {
  const s = dealScenario(), car = state.car, apr = illustrativeApr();
  const equity = dealChartMode === "equity";
  const years = [0, 1, 2, 3, 4, 5];
  const values = (price, retention, kind) => years.map(year => {
    const resale = DealModel.retained(price, retention, year);
    const current = state.profile.currentVehicle;
    if (kind === "current" && current?.status === "lease") return null;
    if (!equity) return resale;
    if (kind === "current") {
      if (current?.status !== "loan") return resale;
      if (current.payoffBalance === null || current.estimatedValue === null) return null;
      if (year === 0 || current.payoffBalance === 0) return resale - current.payoffBalance;
      if (current.monthlyPayment === null || current.apr === null) return null;
      const months = year * 12, rate = current.apr / 1200;
      const balance = Math.max(0, rate
        ? current.payoffBalance * Math.pow(1 + rate, months) - current.monthlyPayment * (Math.pow(1 + rate, months) - 1) / rate
        : current.payoffBalance - current.monthlyPayment * months);
      return resale - balance;
    }
    if (state.plan.id === "cash") return resale;
    if (state.plan.id === "lease") return null;
    return resale - DealModel.balance(price, Math.min(price, state.profile.downPayment), apr, year);
  });
  return [
    { name: `Toyota ${car.name}`, values: values(car.price, s.toyotaRetention, "toyota") },
    { name: "Rival scenario", values: values(s.rivalPrice, s.rivalRetention, "rival") },
    { name: "Keep current car", values: values(s.currentValue, s.currentRetention, "current") },
  ];
}

function retentionChart(series) {
  const all = series.flatMap(s => s.values).filter(v => v !== null);
  const min = Math.min(0, ...all), max = Math.max(1000, ...all);
  const lower = Math.floor(min / 5000) * 5000, upper = Math.ceil(max / 5000) * 5000;
  const x = year => 65 + year * 111, y = value => 248 - (value - lower) / (upper - lower) * 215;
  const ticks = Array.from({ length: 5 }, (_, i) => lower + (upper - lower) * i / 4);
  return `<svg viewBox="0 0 650 295" role="img" aria-labelledby="retention-chart-title retention-chart-desc">
    <title id="retention-chart-title">Illustrative five-year ${dealChartMode === "equity" ? "net equity" : "resale value"} in USD</title>
    <desc id="retention-chart-desc">Editable constant annual depreciation scenarios, not forecasts. Exact annual values are provided in the table below. No confidence interval is available.</desc>
    ${ticks.map(t => `<line x1="65" x2="620" y1="${y(t)}" y2="${y(t)}" stroke="#e9e9e9"/><text x="55" y="${y(t) + 4}" text-anchor="end" fill="#666" font-size="11">${dollars(t)}</text>`).join("")}
    ${[0, 1, 2, 3, 4, 5].map(i => `<text x="${x(i)}" y="274" text-anchor="middle" fill="#666" font-size="11">${i === 0 ? "Today" : `Year ${i}`}</text>`).join("")}
    ${series.map((s, i) => s.values.every(value => value === null) ? "" : `<polyline fill="none" stroke="${insightColors[i]}" stroke-width="3" ${i === 2 ? 'stroke-dasharray="6 5"' : ""} points="${s.values.map((v, year) => v === null ? null : `${x(year)},${y(v)}`).filter(Boolean).join(" ")}"/>
      ${s.values.map((v, year) => v === null ? "" : `<circle cx="${x(year)}" cy="${y(v)}" r="4" fill="${insightColors[i]}"><title>${insightEscape(s.name)} · Year ${year}: ${dollars(v)}</title></circle>`).join("")}`).join("")}
    </svg>`;
}

function assumptionInput(key, label, min, max, step = 1) {
  return `<label class="form-field">${label}<input type="number" data-assumption="${key}" value="${dealScenario()[key]}" min="${min}" max="${max}" step="${step}" required></label>`;
}

function currentContractSummary(nextMonthly) {
  const contract = state.profile.currentVehicle;
  if (!contract || contract.status === "none") return "";
  const amount = value => value === null ? "Not provided" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
  let rows = [];
  if (contract.status === "loan") {
    const equity = contract.estimatedValue === null || contract.payoffBalance === null ? null : contract.estimatedValue - contract.payoffBalance;
    const interest = contract.apr === null || contract.payoffBalance === null ? null : contract.payoffBalance * contract.apr / 1200;
    const principal = interest === null || contract.monthlyPayment === null ? null : contract.monthlyPayment - interest;
    rows = [
      ["Current monthly payment", amount(contract.monthlyPayment)],
      ["Remaining payoff balance", amount(contract.payoffBalance)],
      ["Estimated current equity", amount(equity)],
      ["Current APR", contract.apr === null ? "Not provided" : `${contract.apr}%`],
      ["Remaining term", contract.monthsRemaining === null ? "Not provided" : `${contract.monthsRemaining} months`],
      ["Estimated next-month interest / principal", interest === null || principal === null ? "Not provided" : `${amount(interest)} / ${amount(principal)}`],
      ["New plan payment vs. current loan", contract.monthlyPayment === null ? "Not provided" : `${amount(Math.abs(nextMonthly - contract.monthlyPayment))} ${nextMonthly <= contract.monthlyPayment ? "less" : "more"} per month`],
      ["Current odometer", contract.odometerMileage === null ? "Not provided" : `${contract.odometerMileage.toLocaleString()} miles`],
    ];
  } else {
    const over = contract.currentMileage === null || contract.allowedMileage === null ? null : Math.max(0, contract.currentMileage - contract.allowedMileage);
    let maturity = "Not provided";
    if (contract.maturityDate) {
      const day = new Date(`${contract.maturityDate}T12:00:00`);
      const days = Math.ceil((day.getTime() - Date.now()) / 86400000);
      maturity = `${day.toLocaleDateString("en-US")} · ${days < 0 ? `${Math.abs(days)} days past maturity` : `${days} days remaining`}`;
    }
    rows = [
      ["Current base lease payment", amount(contract.leasePayment)],
      ["Lease maturity", maturity],
      ["Current / allowed total mileage", contract.currentMileage === null || contract.allowedMileage === null ? "Not provided" : `${contract.currentMileage.toLocaleString()} / ${contract.allowedMileage.toLocaleString()} miles`],
      ["Miles already over contract allowance", over === null ? "Not provided" : over.toLocaleString()],
      ["Potential overage at your contract rate", over === null || contract.overageRate === null ? "Add your contract’s per-mile rate to calculate" : amount(over * contract.overageRate)],
      ["Residual / purchase option price", amount(contract.residualValue)],
      ["New plan payment vs. current base lease", contract.leasePayment === null ? "Not provided" : `${amount(Math.abs(nextMonthly - contract.leasePayment))} ${nextMonthly <= contract.leasePayment ? "less" : "more"} per month, before differences in taxes/fees`],
    ];
  }
  return `<section class="current-contract-summary"><p class="eyebrow">YOUR CURRENT ${contract.status === "loan" ? "LOAN" : "LEASE"} · DETAILS YOU SHARED</p><h2>Your starting point</h2><dl>${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${insightEscape(value)}</dd></div>`).join("")}</dl><p class="field-caption">This summary does not refinance, settle or terminate your contract. ${contract.status === "loan" ? "Equity is estimated vehicle value minus payoff. It is not automatically added to your new down payment; the amount and any negative equity must be confirmed. Next-month interest is a simplified APR/12 estimate; daily accrual and fees can differ." : "Overage includes miles already driven only; future use, tax, disposition, early-termination and other fees are excluded. Lease residual is a purchase option, not owned equity."}</p></section>`;
}

function renderDealInsights() {
  const root = document.querySelector("#deal-insights");
  if (!root || !state.profile) return;
  if (!state.matches.length) { root.innerHTML = '<p class="insight-empty">No matching vehicle. Edit your preferences to calculate a score.</p>'; return; }
  const s = dealScenario(), p = state.profile, car = state.car;
  const result = DealModel.evaluate(car, state.plan, p, s, illustrativeApr());
  const labels = [`Toyota ${car.name}`, "Rival scenario", "Keep current car"];
  const projection = dealProjection();
  const rivalCO2 = p.annualMiles / s.rivalMpg * 8.887;
  const saving = result.baselineCO2 - result.co2;
  const maintenance = [s.toyotaMaintenance, s.rivalMaintenance, s.currentMaintenance];
  root.innerHTML = `
    <div class="insight-header"><div><p class="eyebrow">YOUR DECISION, IN PERSPECTIVE</p><h2>Does the move make sense?</h2><p>Toyota ${insightEscape(car.name)} · ${state.plan.name} · ${p.annualMiles.toLocaleString()} miles/year</p></div><span class="estimate-badge">ILLUSTRATIVE ESTIMATES</span></div>
    ${(p.skippedQuestions || []).some(key => ["max-price", "monthly-cap", "total-funds", "down-payment", "mileage"].includes(key)) ? '<p class="field-caption skipped-assumption-note">You skipped some financial or mileage questions. Those filters are relaxed; the score and cost examples use broad illustrative limits or default mileage, not your actual savings or budget. Adjust your answers for a more relevant estimate.</p>' : ""}
    ${currentContractSummary(result.monthly)}
    <div class="benefit-overview">
      <div class="benefit-score"><p class="eyebrow">INSTANT DEAL BENEFIT SCORE</p><strong class="score-number" aria-live="polite">${result.score}<span>%</span></strong><p>${result.score >= 75 ? "A promising modeled fit" : result.score >= 50 ? "A balanced choice, with trade-offs" : "Review the costs and trade-offs"}</p><small>An educational fit index, not a recommendation or probability.</small></div>
      <div class="score-breakdown">
        ${[["Financial fit", result.financial, "45% weight"], ["Ecological fit", result.ecological, "25% weight"], ["Assist-feature coverage", result.safety, "20% weight"], ["Maintenance headroom", result.reliability, "10% weight"]].map(([label, val, weight]) => `<div class="metric-bar"><div class="insight-bar-label"><span>${label} <small>· ${weight}</small></span><strong>${val}%</strong></div><div class="bar-track"><i style="display:block;height:100%;width:${val}%;background:#1F74AD"></i></div></div>`).join("")}
        <p class="field-caption">Estimated payment + energy + maintenance: <strong>${dollars(result.monthlyOwnership)}/month</strong>. Your payment-only cap: ${dollars(p.monthlyCap)}/month. Insurance is excluded.</p>
      </div>
    </div>
    <div class="insight-grid">
      <article class="insight-card retention-card"><div class="insight-header"><div><p class="eyebrow">EQUITY GAIN / RESALE PROTECTION</p><h2>Your next five years</h2></div><label class="form-field">Show<select id="deal-chart-mode"><option value="resale" ${dealChartMode === "resale" ? "selected" : ""}>Retained resale value</option><option value="equity" ${dealChartMode === "equity" ? "selected" : ""}>Net ownership equity</option></select></label></div>
        <p class="field-caption">USD · constant depreciation scenarios · today through year 5 · uncertainty not quantified.</p>
        <div class="chart-legend">${labels.map((label, i) => `<span><i style="background:${insightColors[i]}"></i>${insightEscape(label)}</span>`).join("")}</div>
        <div class="chart-wrap">${retentionChart(projection)}</div>
        <p class="retention-summary">${state.plan.id === "lease"
          ? "Leasing does not build ownership equity. Resale value belongs to the lessor, not to you. Rival equity is also unavailable in the lease scenario."
          : `Year-five modeled Toyota resale: <strong>${dollars(DealModel.retained(car.price, s.toyotaRetention, 5))}</strong> (${s.toyotaRetention}% retained). This is retained value, not profit.`}</p>
        <details><summary>View annual values</summary><div style="overflow-x:auto"><table class="insight-table"><caption>Illustrative ${dealChartMode === "equity" ? "net equity" : "resale value"} (USD)</caption><thead><tr><th scope="col">Year</th>${projection.map(row => `<th scope="col">${insightEscape(row.name)}</th>`).join("")}</tr></thead><tbody>${[0, 1, 2, 3, 4, 5].map(year => `<tr><th scope="row">${year}</th>${projection.map(row => `<td>${row.values[year] === null ? "Not owned / insufficient data" : dollars(row.values[year])}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>
      </article>
      <article class="insight-card"><p class="eyebrow">SAFETY & CONFIDENCE</p><h2>Assumed assist-feature coverage</h2><p>See how Toyota's driver-assistance focus could compare in this example.</p>
        ${insightBars(labels.map((name, i) => [name, [s.toyotaSafety, s.rivalSafety, s.currentSafety][i]]), "%")}
        <p class="field-caption">Example coverage of five feature categories: pre-collision assistance, lane support, adaptive cruise, blind-spot monitoring and rear cross-traffic alert. Defaults assume 4/5, 3/5 and 2/5 categories, respectively; not verified equipment or crash ratings. Trim and year matter.</p>
        <a href="${car.url}" target="_blank" rel="noopener noreferrer">Check this Toyota's equipment ↗</a> · <a href="https://www.iihs.org/ratings" target="_blank" rel="noopener noreferrer">Compare IIHS crash ratings ↗</a>
      </article>
      <article class="insight-card"><p class="eyebrow">ECOLOGICAL IMPACT</p><h2>Lower emissions, mile by mile</h2><p>Modeled annual tailpipe CO₂ · kg · lower is better</p>
        ${insightBars(labels.map((name, i) => [name, [result.co2, rivalCO2, result.baselineCO2][i]]), " kg", Math.max(1, result.co2, rivalCO2, result.baselineCO2))}
        <p class="retention-summary">${saving >= 0 ? "Modeled reduction" : "Modeled increase"} vs. current car: <strong>${Math.abs(Math.round(saving)).toLocaleString()} kg/year (${Math.round(Math.abs(saving) / result.baselineCO2 * 100)}%)</strong>.</p>
        <p class="field-caption">Gasoline: 8.887 kg CO₂/gallon. EVs and hydrogen vehicles: zero tailpipe CO₂, not zero lifecycle emissions. Plug-in hybrids use gasoline MPG only; charging, manufacturing, grid and hydrogen production are excluded.</p>
      </article>
      <article class="insight-card"><p class="eyebrow">RELIABILITY & OWNERSHIP</p><h2>Plan for the long run</h2><p>Assumed annual maintenance · lower is better</p>
        ${insightBars(labels.map((name, i) => [name, maintenance[i]]), "$", Math.max(1, ...maintenance))}
        <p class="field-caption">A maintenance-budget scenario, not a measured reliability rating or failure probability. Maintenance headroom = 100 − annual maintenance ÷ 20, clamped to 0–100%. Service history, age, use and unexpected repairs can change actual costs.</p>
        <a href="https://www.toyota.com/owners/resources/warranty-owners-manuals/" target="_blank" rel="noopener noreferrer">Explore Toyota maintenance & warranty ↗</a>
      </article>
    </div>
    <details class="insight-methodology" id="deal-assumptions" ${dealAssumptionsOpen ? "open" : ""}><summary>Adjust comparison assumptions & see the score methodology</summary>
      <p>All three scenarios use editable assumptions, not verified brand averages. Rival is a generic example, not a claim about a named competitor. Toyota is not guaranteed to outperform it.</p>
      <div class="insight-controls">
        ${assumptionInput("currentValue", "Current car value ($, assumed owned outright)", 1000, 150000, 500)}
        ${assumptionInput("currentMpg", "Current car gasoline MPG", 5, 100)}
        ${assumptionInput("currentRetention", "Current car value retained at year 5 (%)", 5, 100)}
        ${assumptionInput("rivalPrice", "Rival purchase price ($)", 10000, 150000, 500)}
        ${assumptionInput("rivalMpg", "Rival gasoline MPG", 5, 100)}
        ${assumptionInput("rivalRetention", "Rival value retained at year 5 (%)", 5, 100)}
        ${assumptionInput("toyotaRetention", "Toyota value retained at year 5 (%)", 5, 100)}
        ${assumptionInput("toyotaSafety", "Toyota assist coverage (%)", 0, 100, 20)}
        ${assumptionInput("rivalSafety", "Rival assist coverage (%)", 0, 100, 20)}
        ${assumptionInput("currentSafety", "Current car assist coverage (%)", 0, 100, 20)}
        ${assumptionInput("toyotaMaintenance", "Toyota maintenance budget ($/year)", 0, 5000, 50)}
        ${assumptionInput("rivalMaintenance", "Rival maintenance budget ($/year)", 0, 5000, 50)}
        ${assumptionInput("currentMaintenance", "Current maintenance budget ($/year)", 0, 5000, 50)}
      </div><button class="text-button" id="reset-deal-assumptions" type="button">Reset example assumptions</button>
      <p><strong>Score:</strong> 45% financial + 25% ecological + 20% assist coverage + 10% maintenance headroom. Financial = 55% monthly headroom + 25% savings headroom + 20% resale retention (0 for lease). Monthly headroom = 100 × [1 − ownership cost ÷ (2 × payment cap)]. Savings headroom = 100 × [1 − (due + $300 reserve) ÷ savings]. Each component is clamped to 0–100. Ecological = 50 + 50 × reduction in tailpipe CO₂ relative to the current car, clamped to 0–100.</p>
      <p><strong>Projection:</strong> value × (year-five retention ÷ 100)<sup>year ÷ 5</sup>. New-vehicle net equity subtracts a 60-month amortizing loan balance at your example APR and down payment; cash has no balance. Rival uses the same payment type, down payment and APR for comparison, even if outside your filters. The current car is assumed paid off unless you provide current loan details. With a current loan, the model uses the supplied payoff, monthly payment and APR; missing data leaves future equity unavailable. A currently leased car has no owned-equity or retained-resale series. Current-car trade-in proceeds are not applied to the new purchase. Taxes/fees are paid upfront, not financed. Insurance, inflation, selling costs and lifecycle emissions are excluded. Equity is not net ownership cost or investment return.</p>
      <p><a href="https://www.epa.gov/greenvehicles/greenhouse-gas-emissions-typical-passenger-vehicle" target="_blank" rel="noopener noreferrer">EPA gasoline emissions factor ↗</a> · All resale, safety and maintenance assumptions are illustrative; no confidence intervals are available.</p>
    </details>`;
  root.querySelector("#deal-chart-mode").addEventListener("change", event => {
    dealChartMode = event.target.value;
    renderDealInsights();
  });
  root.querySelector("#deal-assumptions").addEventListener("toggle", event => {
    if (event.currentTarget.isConnected) dealAssumptionsOpen = event.currentTarget.open;
  });
  root.querySelectorAll("[data-assumption]").forEach(input => {
    input.addEventListener("change", () => {
      if (!input.reportValidity()) return;
      activeDealScenario[input.dataset.assumption] = Number(input.value);
      dealAssumptionsOpen = true;
      renderDealInsights();
    });
  });
  root.querySelector("#reset-deal-assumptions").addEventListener("click", () => {
    resetDealScenario(); dealAssumptionsOpen = true; renderDealInsights();
  });
}
