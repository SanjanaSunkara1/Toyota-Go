const costPerMile = (car) => (car.ev ? 0.05 : car.fcev ? 0.4 : 3.5 / car.mpg);

const plans = [
  { id: "loan", name: "Buy with a loan", badge: "OWN IT", description: "Estimated payment · APR varies by selected score range · 60 months", months: 60 },
  { id: "lease", name: "Lease", badge: "MILEAGE LIMITS", description: "Illustrative 36-month lease · 10,000 mi/year", months: 36 },
  { id: "cash", name: "Pay cash", badge: "NO PAYMENTS", description: "No monthly payment · uses full vehicle price", months: 0 },
];

const drives = [
  {
    title: "The long way around.",
    location: "MILE 08 · RIVER ROAD",
    story: "The river road is winding and pretty. A slower scenic route adds a little time, while the highway gets you there sooner.",
    choices: [
      { label: "Take the scenic route", cost: 18, miles: 10, result: "The view was worth slowing down for. A little extra fuel, a much better story." },
      { label: "Stick to the highway", cost: 10, miles: 6, result: "Smooth sailing. You kept fuel use low and made good time." },
    ],
  },
  {
    title: "A little detour.",
    location: "MILE 34 · OLD TOWN",
    story: "A local points you to a tiny roadside market. There’s a shortcut through town, or you can stop for a snack and take the longer back road.",
    choices: [
      { label: "Explore the back road", cost: 24, miles: 13, result: "A lovely unexpected stop—and a few extra miles on the odometer." },
      { label: "Take the town shortcut", cost: 9, miles: 5, result: "You found the quick route through town and kept the day on budget." },
    ],
  },
  {
    title: "The final stretch.",
    location: "MILE 71 · MOUNTAIN PASS",
    story: "A dashboard light flickers as you reach the pass. It could be nothing, but a quick check now might prevent a bigger headache later.",
    choices: [
      { label: "Get it checked nearby", cost: 55, miles: 8, result: "A quick check caught a small issue early. It cost a little now, but gave you peace of mind." },
      { label: "Keep an eye on it", cost: 12, miles: 12, result: "You made it through. The gamble saved cash today, though a warning light is worth checking soon." },
    ],
  },
];

const state = {
  email: "",
  name: "",
  profile: null,
  matches: [...cars],
  allMatches: [...cars],
  car: cars[0],
  plan: plans[0],
  driveIndex: 0,
  remaining: 0,
  tripCosts: 0,
  fuelCosts: 0,
  score: 0,
  compare: [],
  drive: null,
  animationFrame: 0,
  keys: { left: false, right: false, accelerate: false, brake: false },
};

const dollars = (amount) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
}).format(Math.round(amount));

function getPlan(id = state.plan.id) {
  return plans.find((plan) => plan.id === id) || plans[0];
}

function bindPedal(selector, keyName) {
  const button = document.querySelector(selector);
  const press = (event) => {
    if (!state.drive || state.drive.finished) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    state.keys[keyName] = true;
    button.classList.add("pressed");
  };
  const release = () => {
    state.keys[keyName] = false;
    button.classList.remove("pressed");
  };
  button.addEventListener("pointerdown", press);
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
}

const FEE_RATE = 0.07, ROAD_RESERVE = 300; // est. tax/title/fees; cash kept for the road
const feesFor = (car, plan) => (plan.id === "lease" ? 0 : Math.round(car.price * FEE_RATE));
function upfrontCost(car, plan) {
  if (plan.id === "cash") return car.price + feesFor(car, plan);
  if (plan.id === "lease") return Math.max(1500, Math.round(car.price * 0.03));
  return Math.min(car.price, state.profile.downPayment) + feesFor(car, plan);
}

function illustrativeApr() {
  const sandbox = window.NessieFinance?.aprForProfile(state.profile);
  if (Number.isFinite(sandbox) && sandbox > 0) return sandbox;
  const rates = {
    under580: 0.145,
    "580-669": 0.105,
    "670-739": 0.078,
    "740plus": 0.065,
    unknown: 0.092,
  };
  return rates[state.profile?.creditTier || "unknown"];
}

function monthlyPayment(car, plan) {
  if (plan.id === "cash") return 0;
  if (plan.id === "lease") return car.price * 0.0061;
  const principal = Math.max(0, car.price - Math.min(car.price, state.profile.downPayment));
  const rate = illustrativeApr() / 12;
  return principal * rate / (1 - Math.pow(1 + rate, -plan.months));
}

function planIsAffordable(car, plan) {
  const p = state.profile;
  const skipped = p.skippedQuestions || [];
  const leaseMileageFits = plan.id !== "lease" || skipped.includes("mileage") || p.annualMiles <= 10000;
  return leaseMileageFits && (skipped.includes("max-price") || car.price <= p.maxPrice) &&
    (skipped.includes("monthly-cap") || monthlyPayment(car, plan) <= p.monthlyCap) &&
    (skipped.includes("total-funds") || upfrontCost(car, plan) + monthlyPayment(car, plan) + ROAD_RESERVE <= p.totalFunds);
}

function meetsNeeds(car) {
  const p = state.profile, green = car.hybrid || car.ev || car.fcev;
  if (p.modelFamily && p.modelFamily !== "any" && car.family !== p.modelFamily) return false;
  if (p.modelYear && p.modelYear !== "any" && car.year !== Number(p.modelYear)) return false;
  const seatsNeeded = Math.max(p.childSeats ? 5 : 1, p.passengers);
  if (p.bodyStyle && p.bodyStyle !== "any" && car.body !== p.bodyStyle) return false;
  if (car.seats < seatsNeeded || (p.childSeats && car.body === "coupe")) return false;
  if (p.awd && !car.awd) return false;
  if (p.fuelInterest === "hybrid" && !car.hybrid) return false;
  if (p.fuelInterest === "ev" && !car.ev) return false;
  if (p.fuelInterest === "phev" && !car.phev) return false;
  if (p.fuelInterest === "fcev" && !car.fcev) return false;
  if (p.fuelInterest === "gas" && green) return false;
  return true;
}

// Evaluate drafts without changing the selected profile or catalog prices.
function matchingVehicles(profile) {
  const previous = state.profile;
  state.profile = profile;
  try {
    return cars.map(car => ({
      ...car,
      price: car.basePrice + (profile.awd && car.awd && !car.awdStd ? AWD_PREMIUM : 0),
    })).filter(car => meetsNeeds(car) && (profile.preferredPlan === "any"
      ? plans.some(plan => planIsAffordable(car, plan))
      : planIsAffordable(car, getPlan(profile.preferredPlan))));
  } finally {
    state.profile = previous;
  }
}

function requirementChips(car, plan) {
  const p = state.profile, need = Math.max(p.childSeats ? 5 : 1, p.passengers);
  const pay = monthlyPayment(car, plan);
  const skipped = p.skippedQuestions || [];
  const chips = [skipped.includes("max-price") ? `Price ${dollars(car.price)} · no price filter` : `Price ${dollars(car.price)} ≤ ${dollars(p.maxPrice)} max`,
    plan.id === "cash" ? "No monthly payment" : skipped.includes("monthly-cap") ? `${dollars(pay)}/mo example` : `${dollars(pay)}/mo ≤ ${dollars(p.monthlyCap)} cap`,
    skipped.includes("total-funds") ? `${dollars(upfrontCost(car, plan))} due · savings not specified` : `${dollars(upfrontCost(car, plan))} due ≤ ${dollars(p.totalFunds)} savings`, `${car.seats} seats (need ${need})`];
  if (p.awd) chips.push("AWD");
  if (p.fuelInterest === "hybrid") chips.push("Hybrid / electric");
  if (p.fuelInterest === "gas") chips.push("Gas-powered");
  if (p.childSeats) chips.push("Child-seat room");
  return chips;
}

function bestPlan(car) {
  const pref = state.profile.preferredPlan;
  if (pref !== "any" && planIsAffordable(car, getPlan(pref))) return getPlan(pref);
  return plans.find((plan) => planIsAffordable(car, plan)) || plans[0];
}

function matchScore(car) {
  const p = state.profile;
  const big = car.body === "bigsuv" || car.body === "van";
  const roomy = big || car.body === "suv";
  const green = car.hybrid || car.ev;
  const compact = car.body === "sedan" || car.body === "hatch";
  let score = 0;
  if (p.fuelInterest === "hybrid" && green) score += 4;
  if (p.fuelInterest === "gas" && !green) score += 3;
  if (p.awd && car.awd) score += 3;
  if (p.childSeats || p.passengers >= 4) score += big ? 5 : roomy ? 4 : compact ? 1 : car.body === "truck" ? 2 : -4;
  if (p.passengers >= 5) score += big ? 3 : -2;
  if (p.drivingStyle === "city" && compact) score += 3;
  if (p.drivingStyle === "highway" && (car.body === "sedan" || car.hybrid)) score += 3;
  if (p.drivingStyle === "adventure" && (roomy || car.body === "truck")) score += 4;
  if (p.safetyPriority === "visibility" && compact) score += 2;
  if (p.safetyPriority === "space" && roomy) score += 2;
  if (p.safetyPriority === "assist" && roomy) score += 1;
  if (car.body === "coupe" || /^GR/.test(car.name)) score -= 2;
  return score - car.price / 40000;
}

function carSilhouette(car) {
  const shape = { sedan: [50, 150, 22, 22, 30], hatch: [50, 160, 24, 22, 12], coupe: [62, 140, 18, 28, 26], suv: [44, 168, 28, 16, 8], bigsuv: [40, 172, 30, 14, 8], truck: [38, 104, 26, 18, 10], van: [34, 176, 32, 12, 10] }[car.body] || [50, 150, 22, 22, 30];
  const [c1, c2, h, a, b] = shape;
  const c = car.color || "#6e8293";
  const bed = car.body === "truck" ? `<rect x="104" y="38" width="88" height="6" fill="${c}"/>` : "";
  return `<svg viewBox="0 0 200 80" role="img" aria-label="${car.name} illustration"><ellipse cx="100" cy="73" rx="86" ry="5" fill="#2a3d33" opacity=".18"/><rect x="8" y="40" width="184" height="24" rx="9" fill="${c}"/><path d="M${c1} 42L${c1 + a} ${42 - h}L${c2 - b} ${42 - h}L${c2} 42Z" fill="${c}"/><path d="M${c1 + 8} 40L${c1 + a + 3} ${44 - h}L${c2 - b - 3} ${44 - h}L${c2 - 8} 40Z" fill="#cfe0dd"/>${bed}<circle cx="48" cy="64" r="11" fill="#26342d"/><circle cx="48" cy="64" r="4.5" fill="#e7ddc4"/><circle cx="152" cy="64" r="11" fill="#26342d"/><circle cx="152" cy="64" r="4.5" fill="#e7ddc4"/></svg>`;
}

function imgFail(img) { // try the next official image URL, then the drawn silhouette
  const list = JSON.parse(img.dataset.alts || "[]");
  if (list.length) { img.dataset.alts = JSON.stringify(list.slice(1)); img.src = list[0]; return; }
  img.outerHTML = decodeURIComponent(img.dataset.fb);
}
function carIllustration(car) {
  const fallback = carSilhouette(car);
  const [first, ...rest] = car.images || [];
  if (!first) return fallback;
  return `<img src="${first}" alt="${car.name} exterior" loading="lazy" data-alts='${JSON.stringify(rest)}' data-fb="${encodeURIComponent(fallback)}" onerror="imgFail(this)">`;
}

function renderCars() {
  const grid = document.querySelector("#car-grid");
  grid.innerHTML = state.matches.map((car) => { const bp = bestPlan(car); return `
    <article class="car-card ${state.car.id === car.id ? "selected" : ""}">
      <button class="car-select" type="button" data-car="${car.id}" aria-pressed="${state.car.id === car.id}">
        <div class="car-illustration">${carIllustration(car)}</div>
        <span class="car-tag">${car.type}</span>
        <h3>Toyota ${car.name}</h3>
        <span class="car-subtitle">${car.subtitle}</span>
      </button>
      <div class="car-facts">${car.tags.map((tag) => `<span>${tag}</span>`).join("")}</div>
      <div class="car-facts req-facts">${requirementChips(car, bp).map((t) => `<span>✓ ${t}</span>`).join("")}</div>
      <div class="model-details"><span>SAFETY</span><p>${car.safety}</p><span>SPACE</span><p>${car.cargo}</p></div>
      <div class="car-price-row"><span>${car.est || car.awdAdded ? "Est. starting MSRP" : "Starting MSRP"}${car.awdAdded ? " with AWD" : ""}</span><strong>${car.est || car.awdAdded ? "≈ " : ""}${dollars(car.price)}</strong></div>
      <div class="car-price-row"><span>Fits your limits · ${bp.name}</span><strong>${bp.id === "cash" ? "No payment" : `${dollars(monthlyPayment(car, bp))}/mo`} · ${dollars(upfrontCost(car, bp))} due</strong></div>
      <div class="paint-preview"><i style="background:${paintSwatch(state.profile.paintColor)}"></i><span>${state.profile.paintColor === "Any color" ? "Any exterior color" : `${state.profile.paintColor} color preference`}</span></div>
      <a class="official-link" href="${car.url}" target="_blank" rel="noopener noreferrer">Official Toyota details &amp; current pricing <span>↗</span></a>
      <button class="compare-toggle ${state.compare.includes(car.id) ? "on" : ""}" type="button" data-compare="${car.id}" aria-pressed="${state.compare.includes(car.id)}">${state.compare.includes(car.id) ? "✓ In comparison" : "+ Compare"}</button>
    </article>`; }).join("");

  grid.querySelectorAll("[data-compare]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.dataset.compare, at = state.compare.indexOf(id);
      if (at >= 0) state.compare.splice(at, 1);
      else if (state.compare.length >= 3) { document.querySelector("#compare-names").textContent = "You can compare up to 3 cars. Remove one first."; return; }
      else state.compare.push(id);
      renderCars();
    });
  });
  renderCompareTray();
  grid.querySelectorAll("[data-car]").forEach((button) => {
    button.addEventListener("click", () => {
      state.car = state.matches.find((car) => car.id === button.dataset.car);
      renderSetup();
      window.ToyotaInsurance?.prompt(state.car);
    });
  });
}

function paintSwatch(name) {
  return ({ White: "#eeeae0", Black: "#242729", Silver: "#aeb1b3", Gray: "#777b7f", Red: "#bd3035", Blue: "#32628f", Green: "#49644e", "Earth tones": "#937861" })[name] || "#b8b7ae";
}

function renderPlans() {
  const grid = document.querySelector("#plan-grid");
  grid.innerHTML = plans.map((plan) => {
    const affordable = planIsAffordable(state.car, plan);
    const upfront = upfrontCost(state.car, plan);
    return `<button class="plan-card ${state.plan.id === plan.id ? "selected" : ""}" type="button" data-plan="${plan.id}" aria-pressed="${state.plan.id === plan.id}" ${!affordable ? "disabled" : ""}>
      <span class="plan-title-row"><strong>${plan.name}</strong><span>${affordable ? plan.badge : "OUTSIDE YOUR LIMITS"}</span></span>
      <p>${plan.description}</p>
      <p class="plan-cost">Due at start: ${dollars(upfront)} · ${plan.id === "cash" ? "No payment" : `${dollars(monthlyPayment(state.car, plan))}/mo`}</p>
    </button>`;
  }).join("");
  grid.querySelectorAll("[data-plan]").forEach((button) => {
    button.addEventListener("click", () => {
      state.plan = getPlan(button.dataset.plan);
      renderSetup();
    });
  });
}

function renderSetup() {
  if (!state.profile) return;
  if (!planIsAffordable(state.car, state.plan)) {
    state.plan = plans.find((plan) => planIsAffordable(state.car, plan)) || plans[0];
  }
  renderCars();
  renderPlans();
  document.querySelector("#budget-amount").textContent = state.profile.skippedQuestions?.includes("total-funds") ? "Not specified" : dollars(state.profile.totalFunds);
  document.querySelector("#budget-caption").textContent = state.profile.skippedQuestions?.includes("max-price") ? "No maximum vehicle-price filter applied" : `Upfront + trip savings · ${dollars(state.profile.maxPrice)} max car price`;
  document.querySelector("#upfront-cost").textContent = dollars(upfrontCost(state.car, state.plan));
  document.querySelector("#monthly-cost").textContent = state.plan.id === "cash" ? "None" : `${dollars(monthlyPayment(state.car, state.plan))} / mo`;
  document.querySelector("#credit-apr").textContent = `${(illustrativeApr() * 100).toFixed(1)}% example`;
  document.querySelector("#plan-grid").querySelector('[data-plan="loan"] p').textContent =
    `Estimated payment · ${(illustrativeApr() * 100).toFixed(1)}% example APR · 60 months`;
  document.querySelector("#annual-mile-value").textContent = `${state.profile.annualMiles.toLocaleString("en-US")} mi / yr${state.profile.skippedQuestions?.includes("mileage") ? " (example)" : ""}`;
  document.querySelector("#fit-copy").textContent = `${state.car.fit} ${state.profile.awd && state.car.awd ? "Matches your interest in available AWD." : ""}`;
  renderDealInsights();
  window.ToyotaInsurance?.render();
  window.NessieFinance?.render();
}

// Apply sandbox assumptions only after explicit consent, retaining real filters.
window.setSandboxFinance = function setSandboxFinance(enabled, budget = null) {
  if (!state.profile) return {ok:false, message:"Find your Toyota matches first, then apply a sandbox financing scenario."};
  const profile = {...state.profile, sandboxFinance: Boolean(enabled),
                   skippedQuestions:[...(state.profile.skippedQuestions || [])]};
  if (enabled && !Number.isFinite(window.NessieFinance?.aprForProfile(profile))) {
    return {ok:false, message:"Analyze complete sandbox records with an APR scenario before applying it."};
  }
  if (budget !== null) {
    if (!Number.isFinite(budget) || budget <= 0) return {ok:false,message:"No positive payment budget is available."};
    profile.monthlyCap = Math.floor(Math.min(2000, budget) / 25) * 25;
    if (profile.monthlyCap <= 0) return {ok:false,message:"This budget is below the minimum usable payment step."};
    profile.skippedQuestions = profile.skippedQuestions.filter(key => key !== "monthly-cap");
  }
  const ids = new Set(matchingVehicles(profile).map(car => car.id));
  if (ids.size < 2) {
    if (!enabled && budget === null) {
      state.profile.sandboxFinance = false;
      showNeeds();
      window.ResultsFilters?.reject();
      return {ok:true,message:"The sandbox APR is off. Broaden your quiz preferences before viewing new matches."};
    }
    return {ok:false,message:"These assumptions leave fewer than two matches. Broaden your vehicle or budget preferences; no filters were silently relaxed."};
  }
  state.profile = profile;
  ToyotaWizard.setSkipped(profile.skippedQuestions);
  if (budget !== null) document.querySelector("#monthly-cap").value = profile.monthlyCap;
  state.allMatches = cars.filter(car => ids.has(car.id)).sort((a,b) => matchScore(b)-matchScore(a));
  state.matches = [...state.allMatches];
  state.compare = state.compare.filter(id => ids.has(id));
  if (!ids.has(state.car.id)) state.car = state.matches[0];
  if (!planIsAffordable(state.car,state.plan)) state.plan = bestPlan(state.car);
  document.querySelector("#recommendation-count").textContent = `${ids.size} possible matches · based on your answers`;
  renderSetup();
  document.dispatchEvent(new Event("toyota:matches"));
  return {ok:true,message:budget !== null
    ? `Applied a $${profile.monthlyCap}/month cap, rounded down to the supported $25 step. Rates remain illustrative, not pre-approved.`
    : `Sandbox APR scenario ${enabled ? "applied" : "removed"}. No credit decision or TFS offer was made.`};
};

function syncShowAll() {
  const button = document.querySelector("#show-all");
  const more = state.allMatches.length > state.matches.length;
  button.classList.toggle("hidden", !more);
  button.textContent = `Show all ${state.allMatches.length} matching Toyotas`;
}

function readNeedsForm() {
  const form = document.querySelector("#needs-form");
  const maxPrice = Number(document.querySelector("#max-price").value);
  const monthlyCap = Number(document.querySelector("#monthly-cap").value);
  const totalFunds = Number(document.querySelector("#total-funds").value);
  const downPayment = Number(document.querySelector("#down-payment").value);
  const downPaymentInput = document.querySelector("#down-payment");
  downPaymentInput.setCustomValidity(downPayment > totalFunds ? "Your planned down payment cannot exceed your available savings." : "");
  if (!form.reportValidity()) return;
  const preferredPlan = document.querySelector("#payment-preference").value;
  const optionalNumber = id => document.querySelector(`#${id}`).value === "" ? null : Number(document.querySelector(`#${id}`).value);
  const profile = {
    sandboxFinance: Boolean(state.profile?.sandboxFinance),
    maxPrice,
    monthlyCap,
    totalFunds,
    downPayment,
    bodyStyle: document.querySelector("#car-type-filter").value,
    paintColor: document.querySelector("#paint-color").value,
    modelFamily: document.querySelector("#model-filter").value,
    modelYear: document.querySelector("#year-filter").value,
    skippedQuestions: ToyotaWizard.skipped(),
    annualMiles: Number(document.querySelector("#annual-miles").value),
    creditTier: document.querySelector("#credit-tier").value,
    safetyPriority: document.querySelector("#safety-priority").value,
    safetyAssist: document.querySelector("#safety-assist").checked,
    childSeats: document.querySelector("#safety-space").checked,
    awd: document.querySelector("#safety-awd").checked,
    passengers: Number(document.querySelector("#passengers").value),
    drivingStyle: document.querySelector("#driving-style").value,
    fuelInterest: document.querySelector("#fuel-interest").value,
    preferredPlan,
    currentVehicle: {
      status: document.querySelector("#current-vehicle-status").value,
      tradeIntent: document.querySelector("#trade-intent").value,
      monthlyPayment: optionalNumber("current-loan-payment"),
      payoffBalance: optionalNumber("current-loan-balance"),
      estimatedValue: optionalNumber("current-vehicle-value"),
      apr: optionalNumber("current-loan-apr"),
      monthsRemaining: optionalNumber("current-loan-term"),
      odometerMileage: optionalNumber("current-loan-mileage"),
      leasePayment: optionalNumber("current-lease-payment"),
      maturityDate: document.querySelector("#lease-maturity").value,
      currentMileage: optionalNumber("lease-current-mileage"),
      allowedMileage: optionalNumber("lease-allowed-mileage"),
      residualValue: optionalNumber("lease-residual"),
      overageRate: optionalNumber("lease-overage-rate"),
    },
  };
  const matchingIds = new Set(matchingVehicles(profile).map(car => car.id));
  if (matchingIds.size < 2) {
    window.ResultsFilters?.reject(profile);
    return false;
  }
  state.profile = profile;
  document.querySelector("#quiz-match-warning")?.classList.add("hidden");
  state.compare = [];
  if (state.profile.currentVehicle.status === "loan" && state.profile.currentVehicle.estimatedValue !== null) {
    activeDealScenario.currentValue = state.profile.currentVehicle.estimatedValue;
  }
  cars.forEach((c) => { c.awdAdded = !!(state.profile.awd && c.awd && !c.awdStd); c.price = c.basePrice + (c.awdAdded ? AWD_PREMIUM : 0); });
  plans[0].description = `Estimated payment · ${(illustrativeApr() * 100).toFixed(1)}% example APR · 60 months`;
  state.allMatches = cars.filter(car => matchingIds.has(car.id));
  state.allMatches.sort((a, b) => matchScore(b) - matchScore(a));
  state.matches = [...state.allMatches];
  document.querySelector(".money-panel").classList.toggle("hidden", state.matches.length === 0);
  renderCompareTray();
  if (state.matches.length === 0) {
    document.querySelector("#car-grid").replaceChildren();
    document.querySelector("#plan-grid").replaceChildren();
    const needOnly = cars.filter(meetsNeeds).length;
    document.querySelector("#no-matches p").textContent = needOnly
      ? `${needOnly} Toyotas fit your seating, drivetrain and fuel needs, but none fit your price, payment and savings limits together. Try a higher payment limit, more savings or down payment, or a higher max price.`
      : "No Toyotas fit that mix of seating, AWD and fuel needs. Try relaxing the AWD or fuel choice.";
    document.querySelector("#no-matches").classList.remove("hidden");
    document.querySelector("#car-grid").classList.add("hidden");
    document.querySelector("#plan-grid").classList.add("hidden");
    document.querySelector("#start-drive").disabled = true;
  } else {
    document.querySelector("#no-matches").classList.add("hidden");
    document.querySelector("#car-grid").classList.remove("hidden");
    document.querySelector("#plan-grid").classList.remove("hidden");
    document.querySelector("#start-drive").disabled = false;
    state.car = state.matches[0];
    state.plan = preferredPlan === "any"
      ? plans.find((plan) => planIsAffordable(state.car, plan))
      : getPlan(preferredPlan);
  }

  document.querySelectorAll(".step").forEach((step, index) => {
    step.classList.toggle("active", index === 0);
    step.classList.remove("done");
  });
  document.querySelector("#auth-shell").classList.add("hidden");
  document.querySelector("#needs-shell").classList.add("hidden");
  document.querySelector(".intro").classList.remove("hidden");
  document.querySelector("#edit-preferences").classList.remove("hidden");
  document.querySelector(".game-shell").classList.remove("hidden");
  document.querySelector("#recommendation-count").textContent = state.matches.length
    ? `${state.matches.length === state.allMatches.length ? state.matches.length : `Top ${state.matches.length} of ${state.allMatches.length}`} possible ${state.allMatches.length === 1 ? "match" : "matches"} · based on your answers`
    : "No exact matches · adjust your budget or payment limit";
  syncShowAll();
  navigateToPage("customization");
  if (state.matches.length) renderSetup();
  else document.querySelector("#deal-insights").innerHTML = '<p class="insight-empty">Adjust your filters to find a vehicle before calculating a Deal Benefit Score.</p>';
  document.dispatchEvent(new Event("toyota:matches"));
  window.ResultsFilters?.finish();
  return true;
}

function returnToMatches() {
  if (!state.profile) { showNeeds(); return; }
  cancelAnimationFrame(state.animationFrame);
  state.drive = null;
  Object.keys(state.keys).forEach(key => { state.keys[key] = false; });
  document.querySelectorAll(".pressed").forEach(button => button.classList.remove("pressed"));
  ["#auth-shell", "#needs-shell", "#drive-shell", "#ending-shell"].forEach(id => document.querySelector(id).classList.add("hidden"));
  [".intro", ".game-shell", "#edit-preferences", "#deal-insights"].forEach(id => document.querySelector(id).classList.remove("hidden"));
  navigateToPage("customization");
  renderSetup();
  window.ResultsFilters?.render();
  window.ResultsFilters?.finish();
}

function startDrive() {
  if (!state.matches.length || !state.profile) return;
  const firstPayment = monthlyPayment(state.car, state.plan);
  state.remaining = state.profile.totalFunds - upfrontCost(state.car, state.plan) - firstPayment;
  state.tripCosts = 0;
  state.fuelCosts = 0;
  state.score = 0;
  state.driveIndex = 0;
  document.querySelector(".game-shell").classList.add("hidden");
  document.querySelector(".intro").classList.add("hidden");
  document.querySelector("#edit-preferences").classList.add("hidden");
  window.ResultsFilters?.hide();
  ["#deal-insights", "#insurance-panel", "#compare-tray", "#finance-summary"].forEach(id => document.querySelector(id)?.classList.add("hidden"));
  document.querySelector("#drive-shell").classList.remove("hidden");
  document.querySelector('[data-step="1"]').classList.remove("active");
  document.querySelector('[data-step="1"]').classList.add("done");
  document.querySelector('[data-step="2"]').classList.add("done");
  document.querySelector('[data-step="3"]').classList.add("active");
  document.querySelector("#road-trip-car").textContent = `TOYOTA ${state.car.name.toUpperCase()}`;
  renderDrive();
  window.scrollTo({ top: 0, behavior: "instant" });
}

function renderDrive() {
  const drive = drives[state.driveIndex];
  document.querySelector("#drive-eyebrow").textContent = `TOYOTA TEST DRIVE 0${state.driveIndex + 1} OF 03`;
  document.querySelector("#drive-title").textContent = drive.title;
  document.querySelector("#drive-story").textContent = drive.story;
  document.querySelector("#scene-location").textContent = drive.location;
  document.querySelector("#drive-distance").textContent = `DRIVE ${state.driveIndex + 1} OF ${drives.length}`;
  document.querySelector("#progress-fill").style.width = `${state.driveIndex / drives.length * 100}%`;
  document.querySelector("#road-money").textContent = dollars(state.remaining);
  document.querySelector("#road-note").textContent = `Toyota ${state.car.name} · after upfront + first payment`;
  document.querySelector("#drive-overlay").textContent = "Choose a route to start your test drive";
  document.querySelector("#drive-overlay").classList.remove("hidden");
  document.querySelector("#drive-percent").textContent = "READY";
  document.querySelector("#drive-speed").textContent = "35 MPH";
  document.querySelector("#drive-instructions").textContent = "Steer ← → · accelerate ↑ / W · brake ↓ / S";
  state.drive = null;
  drawDriveScene(0, false);
  document.querySelectorAll(".choice-result").forEach((result) => result.remove());
  document.querySelector("#choice-list").innerHTML = drive.choices.map((choice, index) =>
    `<button class="choice-button" type="button" data-choice="${index}">${choice.label}</button>`
  ).join("");
  document.querySelectorAll("[data-choice]").forEach((button) => {
    button.addEventListener("click", () => chooseDrive(Number(button.dataset.choice), drive));
  });
}

function chooseDrive(choiceIndex, drive) {
  const choice = drive.choices[choiceIndex];
  document.querySelectorAll(".choice-button").forEach((button) => { button.disabled = true; });
  const result = document.createElement("p");
  result.className = "choice-result";
  result.textContent = `${choice.result} Dodge cones ($35) and slow traffic ($120), stay under 55 MPH at the speed camera ($75 ticket), and grab coins (+$4). Brake to a full stop at red lights ($150 if you run one).`;
  document.querySelector("#choice-list").after(result);
  document.querySelector("#drive-overlay").classList.add("hidden");
  document.querySelector("#drive-percent").textContent = "0%";
  document.querySelector("#drive-alert").textContent = "";
  const pickLane = () => [-1, 0, 1][Math.floor(Math.random() * 3)];
  state.drive = {
    lastFrame: performance.now(), progress: 0, x: 0, vx: 0, steer: 0, roll: 0, pitch: 0, by: 0, bv: 0,
    cur: 0, phase: Math.random() * 6.28, speed: 35, speedTime: 0, elapsed: 0,
    distance: choice.miles, routeCost: choice.cost, collisions: 0, collisionCost: 0, tickets: 0, camDone: false, camWarn: false, redRuns: 0, bonusPts: 0,
    lights: [0.4, 0.78].slice(0, state.driveIndex ? 2 : 1).map((at) => ({ at, phase: "idle", timer: 0, hold: 0, red: Math.random() < 0.65 })),
    traffic: Array.from({ length: 3 + state.driveIndex * 2 }, () => ({ p: 0.15 + Math.random() * 0.8, x: pickLane(), v: 0.04 + Math.random() * 0.035, hit: false, big: Math.random() < 0.3,
      color: ["#c2412f", "#3f6f9a", "#d9b44a", "#6b7a5a", "#8a5aa0", "#e7e3d6"][Math.floor(Math.random() * 6)] })), coinsGot: 0, shake: 0,
    braking: false, offroad: false, wasOff: false, finished: false, lastHitAt: 0,
    obstacles: [0.16, 0.34, 0.52, 0.7, 0.88].map((progress, i) => ({ progress, x: pickLane() + (Math.random() - 0.5) * 0.3, passed: false, car: i === 3 || (i === 1 && state.driveIndex > 0) })),
    coins: [0.07, 0.25, 0.43, 0.61, 0.79].map((progress) => ({ progress, x: pickLane(), done: false })),
  };
  state.keys.left = false;
  state.keys.right = false;
  state.keys.accelerate = false;
  state.keys.brake = false;
  document.querySelector("#drive-instructions").textContent = "Steer · accelerate · brake";
  cancelAnimationFrame(state.animationFrame);
  state.animationFrame = requestAnimationFrame(updateDrive);
}

function driveCanvasContext() {
  const canvas = document.querySelector("#drive-canvas");
  const bounds = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.floor(bounds.width * ratio));
  const height = Math.max(1, Math.floor(bounds.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width: bounds.width, height: bounds.height };
}

const THEMES = [
  { skyTop: "#cbdedc", skyBot: "#f3e8c9", sun: "#edc77f", hill: "#a3b59b", g1: "#5f7d63", g2: "#6a8a6c", field: "#66836a" },
  { skyTop: "#e8b98a", skyBot: "#f7dcae", sun: "#f08a4b", hill: "#b49a86", g1: "#7a7a52", g2: "#86865a", field: "#7d7e56" },
  { skyTop: "#8a9aa6", skyBot: "#c9cfcf", sun: "#d9d9cf", hill: "#7f8f93", g1: "#4f6a5a", g2: "#58735f", field: "#55705f", rain: true },
];
const IDLE = { x: 0, steer: 0, roll: 0, by: 0, pitch: 0, speed: 0, cur: 0.35, shake: 0, braking: false, offroad: false, obstacles: [], coins: [], lights: [], traffic: [] };
const HANDLING = {
  sedan: { grip: 1, roll: 0.55, top: 1, power: 1 }, hatch: { grip: 1.05, roll: 0.5, top: 1, power: 1.05 },
  coupe: { grip: 1.3, roll: 0.3, top: 1.1, power: 1.35 }, suv: { grip: 0.88, roll: 0.9, top: 0.98, power: 0.95 },
  bigsuv: { grip: 0.78, roll: 1.1, top: 0.97, power: 0.9 }, truck: { grip: 0.8, roll: 1, top: 0.97, power: 0.95 },
  van: { grip: 0.82, roll: 1.05, top: 0.95, power: 0.85 },
};

function drawCar(ctx, cx, cy, w, car, d) {
  const body = car.body || "sedan";
  const cabH = { sedan: 0.26, hatch: 0.3, coupe: 0.2, suv: 0.33, bigsuv: 0.36, truck: 0.32, van: 0.4 }[body] || 0.28;
  const cabW = { sedan: 0.74, hatch: 0.8, coupe: 0.7, suv: 0.82, bigsuv: 0.84, truck: 0.74, van: 0.86 }[body] || 0.78;
  const bodyH = w * (body === "coupe" ? 0.26 : body === "van" || body === "bigsuv" ? 0.38 : 0.32);
  ctx.fillStyle = "rgba(20,40,30,.38)";
  ctx.beginPath();
  ctx.ellipse(cx, cy + w * 0.02, w * 0.62, w * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(cx, cy - d.by * w * 0.012);
  ctx.rotate(d.roll);
  ctx.scale(1, 1 + d.pitch * 0.02);
  ctx.fillStyle = "#1c241f";
  ctx.beginPath();
  ctx.roundRect(-w * 0.49, -w * 0.2, w * 0.14, w * 0.2, w * 0.03);
  ctx.roundRect(w * 0.35, -w * 0.2, w * 0.14, w * 0.2, w * 0.03);
  ctx.fill();
  const top = -w * 0.1 - bodyH;
  ctx.fillStyle = car.color || "#c66d4e";
  ctx.beginPath();
  ctx.roundRect(-w / 2, top, w, bodyH, w * 0.07);
  ctx.fill();
  const bw = w * cabW, tw = bw * 0.84, ch = w * cabH, gi = w * 0.035;
  ctx.beginPath();
  ctx.moveTo(-bw / 2, top + 2); ctx.lineTo(-tw / 2, top - ch); ctx.lineTo(tw / 2, top - ch); ctx.lineTo(bw / 2, top + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#b9d1d0";
  ctx.beginPath();
  ctx.moveTo(-bw / 2 + gi * 1.6, top - gi * 0.3); ctx.lineTo(-tw / 2 + gi, top - ch + gi); ctx.lineTo(tw / 2 - gi, top - ch + gi); ctx.lineTo(bw / 2 - gi * 1.6, top - gi * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,.22)";
  ctx.beginPath();
  ctx.roundRect(-w / 2, top + bodyH * 0.68, w, bodyH * 0.32, w * 0.05);
  ctx.fill();
  if (body === "truck") ctx.fillRect(-w / 2, top - w * 0.02, w, w * 0.04);
  ctx.fillStyle = d.braking ? "#ff4b3a" : "#9c2a24";
  if (d.braking) { ctx.shadowColor = "#ff3b2f"; ctx.shadowBlur = w * 0.15; }
  ctx.fillRect(-w * 0.47, top + bodyH * 0.14, w * 0.2, w * 0.05);
  ctx.fillRect(w * 0.27, top + bodyH * 0.14, w * 0.2, w * 0.05);
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#f1ead0";
  ctx.fillRect(-w * 0.1, top + bodyH * 0.5, w * 0.2, w * 0.07);
  ctx.restore();
}

function drawDriveScene(progress, moving) {
  const { context: ctx, width, height } = driveCanvasContext();
  const d = moving && state.drive ? state.drive : IDLE;
  const horizon = height * 0.4, yNear = height * 0.8, center = width / 2;
  const T = THEMES[state.driveIndex] || THEMES[0];
  const laneNear = width * 0.26, K = 5, A = 0.13, DD = 0.045;
  const camX = d.x * 0.6;
  const proj = (dd) => 1 / (1 + K * dd);
  const sx = (wx, dd) => center + (wx - camX + A * dd * dd * d.cur) * proj(dd) * laneNear;
  ctx.clearRect(-20, -20, width + 40, height + 40);
  if (d.shake > 0) ctx.translate((Math.random() - 0.5) * 10 * d.shake, (Math.random() - 0.5) * 6 * d.shake);

  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, T.skyTop);
  sky.addColorStop(1, T.skyBot);
  ctx.fillStyle = sky;
  ctx.fillRect(-20, -20, width + 40, horizon + 24);
  ctx.fillStyle = T.sun;
  ctx.beginPath();
  ctx.arc(width * 0.79 - d.cur * 12, height * 0.17, Math.min(width, height) * 0.07, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.7)";
  for (let i = 0; i < 4; i += 1) {
    const cloudX = (((i * 0.37 + progress * 0.4) % 1.3) - 0.15) * width;
    ctx.beginPath();
    ctx.ellipse(cloudX, height * (0.1 + (i % 2) * 0.08), 42 + i * 8, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const ox = -(camX * 9 + d.cur * 24);
  ctx.fillStyle = T.hill;
  ctx.beginPath();
  ctx.moveTo(-width * 0.2 + ox, horizon + 2);
  [[0, 0.4], [0.13, 0.18], [0.27, 0.4], [0.43, 0.12], [0.62, 0.4], [0.77, 0.2], [1, 0.4], [1.2, 0.3]].forEach(([fx, fy]) => ctx.lineTo(fx * width + ox, height * fy));
  ctx.lineTo(width * 1.2 + ox, horizon + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = T.field;
  ctx.fillRect(-20, horizon, width + 40, height);

  const N = 46, pts = [];
  for (let i = 0; i <= N; i += 1) {
    const sc = 2.2 * Math.pow(0.02 / 2.2, i / N);
    const dd = (1 / sc - 1) / K;
    pts.push({ dd, y: horizon + (yNear - horizon) * sc, cx: sx(0, dd), half: sc * laneNear });
  }
  const quad = (a, b, o1, o2, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(b.cx + o1 * b.half, b.y); ctx.lineTo(b.cx + o2 * b.half, b.y);
    ctx.lineTo(a.cx + o2 * a.half, a.y); ctx.lineTo(a.cx + o1 * a.half, a.y);
    ctx.closePath();
    ctx.fill();
  };
  for (let i = N; i >= 1; i -= 1) {
    const near = pts[i - 1], far = pts[i];
    const band = Math.floor(((near.dd + far.dd) / 2 + progress * 22) * 1.5) & 1;
    quad(near, far, -80, 80, band ? T.g1 : T.g2);
    quad(near, far, -2.15, 2.15, "#8d8f78");
    quad(near, far, -1.95, -1.72, band ? "#d9534b" : "#f1ebd6");
    quad(near, far, 1.72, 1.95, band ? "#d9534b" : "#f1ebd6");
    quad(near, far, -1.7, 1.7, band ? "#5a5f58" : "#62675f");
    quad(near, far, -1.58, -1.52, "#f3e5bd");
    quad(near, far, 1.52, 1.58, "#f3e5bd");
    if (band) { quad(near, far, -0.53, -0.47, "#fff4d7"); quad(near, far, 0.47, 0.53, "#fff4d7"); }
  }

  const items = [];
  const baseIdx = Math.floor(progress / 0.03);
  for (let k = 1; k < 18; k += 1) {
    const idx = baseIdx + k, dd = (idx * 0.03 - progress) / DD;
    if (dd > 8) break;
    items.push({ dd, kind: "tree", wx: -(3.1 + ((idx * 37) % 10) / 10 * 1.6), idx });
    items.push({ dd, kind: "tree", wx: 3.1 + ((idx * 53) % 10) / 10 * 1.6, idx: idx + 1 });
  }
  d.obstacles.forEach((o) => { if (!o.passed) items.push({ dd: (o.progress - progress) / DD, kind: o.car ? "car" : "cone", wx: o.x }); });
  if (moving && !d.camDone) items.push({ dd: (0.58 - progress) / DD, kind: "cam", wx: 0 });
  d.lights.forEach((L) => { if (L.phase !== "done") items.push({ dd: (L.at - progress) / DD, kind: "light", wx: 0, phase: L.phase }); });
  d.traffic.forEach((c) => items.push({ dd: (c.p - progress) / DD, kind: "car", wx: c.x, color: c.color, big: c.big }));
  d.coins.forEach((c) => { if (!c.done) items.push({ dd: (c.progress - progress) / DD, kind: "coin", wx: c.x }); });
  items.filter((it) => it.dd > -0.02 && it.dd < 8).sort((a, b) => b.dd - a.dd).forEach((it) => {
    const sc = proj(it.dd), x = sx(it.wx, it.dd), y = horizon + (yNear - horizon) * sc;
    if (it.kind === "tree") {
      const t = sc * laneNear * 0.5;
      ctx.fillStyle = "#775c42";
      ctx.fillRect(x - t * 0.08, y - t * 0.5, t * 0.16, t * 0.5);
      ctx.fillStyle = it.idx % 2 ? "#526f57" : "#74906b";
      ctx.beginPath();
      ctx.arc(x, y - t * 0.85, t * 0.55, 0, Math.PI * 2);
      ctx.fill();
    } else if (it.kind === "car") {
      const w = sc * laneNear * (it.big ? 0.8 : 0.62);
      ctx.fillStyle = it.color || "#4b5563"; ctx.fillRect(x - w / 2, y - w * 0.5, w, w * 0.5);
      ctx.fillStyle = "#7d8996"; ctx.fillRect(x - w * 0.36, y - w * 0.78, w * 0.72, w * 0.3);
      ctx.fillStyle = "#ff4b3a"; ctx.fillRect(x - w * 0.46, y - w * 0.4, w * 0.18, w * 0.08); ctx.fillRect(x + w * 0.28, y - w * 0.4, w * 0.18, w * 0.08);
    } else if (it.kind === "light") {
      const w = sc * laneNear, px = x + w * 2.1;
      ctx.fillStyle = "#f4eed9"; ctx.fillRect(x - w * 1.7, y - w * 0.04, w * 3.4, Math.max(2, w * 0.08));
      ctx.fillStyle = "#2a3038"; ctx.fillRect(px - w * 0.03, y - w * 1.5, w * 0.06, w * 1.5); ctx.fillRect(px - w * 0.14, y - w * 1.9, w * 0.28, w * 0.6);
      [["red", "#ff4b3a", 1.75], ["yellow", "#f2c230", 1.55], ["green", "#4bd06a", 1.35]].forEach(([n, col, hh]) => {
        const on = it.phase === n || (n === "green" && it.phase === "idle");
        ctx.fillStyle = on ? col : "rgba(60,60,60,.8)";
        if (on) { ctx.shadowColor = col; ctx.shadowBlur = w * 0.2; }
        ctx.beginPath(); ctx.arc(px, y - w * hh, w * 0.08, 0, 6.3); ctx.fill(); ctx.shadowBlur = 0;
      });
    } else if (it.kind === "cam") {
      const w = sc * laneNear * 2.2;
      ctx.fillStyle = "#3b4a52"; ctx.fillRect(x - w, y - w * 0.9, w * 0.07, w * 0.9); ctx.fillRect(x + w * 0.93, y - w * 0.9, w * 0.07, w * 0.9);
      ctx.fillStyle = "#f4eed9"; ctx.fillRect(x - w, y - w * 0.95, w * 2, w * 0.14);
      ctx.fillStyle = "#c2412f"; ctx.font = `700 ${Math.max(8, w * 0.1)}px sans-serif`; ctx.textAlign = "center"; ctx.fillText("55 MPH · CAMERA", x, y - w * 0.85);
    } else if (it.kind === "cone") {
      const t = sc * laneNear * 0.2;
      ctx.fillStyle = "#f4eed9";
      ctx.beginPath();
      ctx.ellipse(x, y, t * 0.9, t * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e49a50";
      ctx.beginPath();
      ctx.moveTo(x, y - t * 2); ctx.lineTo(x - t * 0.65, y); ctx.lineTo(x + t * 0.65, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff4dc";
      ctx.fillRect(x - t * 0.34, y - t * 1.1, t * 0.68, Math.max(1.5, t * 0.2));
    } else {
      const r = sc * laneNear * 0.15, spin = Math.abs(Math.cos(progress * 60 + it.wx * 3));
      ctx.fillStyle = "#e9be4a";
      ctx.strokeStyle = "#b98a22";
      ctx.lineWidth = Math.max(1, r * 0.18);
      ctx.beginPath();
      ctx.ellipse(x, y - r * 1.6, Math.max(r * 0.15, r * spin), r, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  });

  const carX = center + (d.x - camX) * laneNear;
  drawCar(ctx, carX, yNear, laneNear * 0.7, state.car, d);
  if (moving && d.speed > 50) {
    ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.35, (d.speed - 50) / 60)})`;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 10; i += 1) {
      const t = (i / 10 + progress * 30) % 1, side = i % 2 ? 1 : -1;
      const x0 = center + side * (width * 0.18 + t * width * 0.4), y0 = horizon + t * (height - horizon) * 0.9;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + side * t * 40, y0 + t * 40);
      ctx.stroke();
    }
  }
  if (moving && d.offroad) {
    ctx.fillStyle = "rgba(150,120,80,.5)";
    for (let i = 0; i < 8; i += 1) {
      ctx.beginPath();
      ctx.arc(carX + (Math.random() - 0.5) * laneNear * 0.9, yNear - Math.random() * 14, 2 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (T.rain) {
    ctx.strokeStyle = "rgba(235,242,245,.45)"; ctx.lineWidth = 1;
    for (let i = 0; i < 70; i += 1) {
      const rx = (i * 97 + progress * 900 * (1 + (i % 3))) % width, ry = (i * 53 + progress * 4000 * (1 + (i % 2))) % height;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 14); ctx.stroke();
    }
  }
  if (d.shake > 0) {
    ctx.fillStyle = `rgba(200, 60, 40, ${d.shake * 0.25})`;
    ctx.fillRect(-20, -20, width + 40, height + 40);
  }
}

function updateDrive(timestamp) {
  const d = state.drive;
  if (!d || d.finished || d.paused) return;
  const delta = Math.min(100, timestamp - d.lastFrame);
  d.lastFrame = timestamp;
  const dt = delta / 1000;
  const h0 = HANDLING[state.car.body] || HANDLING.sedan;
  const h = state.driveIndex === 2 ? { ...h0, grip: h0.grip * 0.85 } : h0; // rain on the mountain pass
  const power = h.power * (state.car.ev ? 1.25 : 1);
  const alertEl = document.querySelector("#drive-alert");
  const setAlert = (text) => { alertEl.textContent = text; d.lastHitAt = timestamp; };
  const steerIn = Number(state.keys.right) - Number(state.keys.left);
  const accel = state.keys.accelerate, brake = state.keys.brake;
  d.braking = brake;
  d.offroad = Math.abs(d.x) > 1.7;
  if (d.offroad && !d.wasOff) setAlert("OFF ROAD · SLOWING");
  d.wasOff = d.offroad;

  const stopZone = d.lights.some((L) => (L.phase === "red" || L.phase === "yellow") && d.progress < L.at);
  let target = brake ? (stopZone ? 0 : 18) : accel ? 68 * h.top : 42;
  if (d.offroad) target = Math.min(target, 26);
  d.speed += (target - d.speed) * Math.min(1, dt * (brake ? 2.4 : accel ? 0.9 * power : 0.7));

  d.cur = Math.sin(d.progress * 9.4 + d.phase) * 0.8 + Math.sin(d.progress * 3.1) * 0.2;
  d.cur *= 1 + state.driveIndex * 0.2;
  d.steer += (steerIn - d.steer) * Math.min(1, dt * 7);
  const sp = d.speed / 50;
  const authority = h.grip * Math.min(1, d.speed / 14) * (1.5 - 0.6 * sp);
  const push = d.cur * sp * sp * 2.6 / (0.6 + h.grip * 0.4);
  const ax = d.steer * authority * 5.5 - push - d.vx * 2.4 * h.grip;
  d.vx += ax * dt;
  d.x += d.vx * dt;
  if (Math.abs(d.x) > 2.6) {
    d.x = Math.sign(d.x) * 2.6;
    d.vx *= -0.35;
    d.speed *= 0.82;
    d.bv += 10;
    d.shake = Math.max(d.shake, 0.6);
    setAlert("GUARDRAIL");
  }

  const rollTarget = Math.max(-0.14, Math.min(0.14, -ax * 0.014 * h.roll));
  d.roll += (rollTarget - d.roll) * Math.min(1, dt * 8);
  d.pitch += ((brake ? 1 : accel ? -0.6 : 0) - d.pitch) * Math.min(1, dt * 6);
  d.bv += (-d.by * 110 - d.bv * 10) * dt + (Math.random() - 0.5) * dt * (d.offroad ? 160 : d.speed * 0.5);
  d.by += d.bv * dt;

  d.speedTime += d.speed * delta;
  d.elapsed += delta;
  d.progress = Math.min(1, d.progress + dt / 11 * (d.speed / 42));
  d.shake = Math.max(0, d.shake - dt * 2.8);

  d.obstacles.forEach((o) => {
    if (o.passed || d.progress < o.progress) return;
    o.passed = true;
    if (Math.abs(d.x - o.x) < (o.car ? 0.6 : 0.45)) {
      d.collisions += 1;
      d.collisionCost += o.car ? 120 : 35;
      d.speed *= 0.55;
      d.vx += (d.x >= o.x ? 1 : -1) * 1.6;
      d.bv += 14;
      d.shake = 1;
      setAlert(o.car ? "TRAFFIC HIT · $120" : "CONE HIT · $35");
    }
  });
  d.coins.forEach((c) => {
    if (c.done || d.progress < c.progress) return;
    c.done = true;
    if (Math.abs(d.x - c.x) < 0.5) {
      d.coinsGot += 1;
      setAlert("COIN +$4");
    }
  });

  d.lights.forEach((L) => {
    if (L.phase === "done") return;
    if (L.phase === "idle" && d.progress >= L.at - 0.22) { L.phase = L.red ? "yellow" : "green"; L.timer = 0; if (L.red) setAlert("LIGHT CHANGING · BRAKE"); }
    L.timer += dt;
    if (L.phase === "yellow" && L.timer > 0.9) { L.phase = "red"; L.timer = 0; setAlert("RED LIGHT · STOP"); }
    if (L.phase === "red" && d.speed < 6) { L.hold += dt; if (L.hold > 1.2) { L.phase = "green"; d.bonusPts += 100; setAlert("GREEN · GO (+100 pts)"); } }
    if (d.progress >= L.at) {
      if (L.phase === "red") { d.redRuns += 1; d.collisionCost += 150; setAlert("RAN A RED · $150"); }
      L.phase = "done";
    }
  });
  d.traffic.forEach((c) => {
    c.p += c.v * dt;
    if (!c.hit && Math.abs(d.progress - c.p) < 0.012 && Math.abs(d.x - c.x) < 0.65) {
      c.hit = true; d.collisions += 1; d.collisionCost += 120; d.speed *= 0.5; d.vx += (d.x >= c.x ? 1 : -1) * 1.4; d.bv += 14; d.shake = 1;
      setAlert("TRAFFIC HIT · $120");
    }
  });
  if (!d.camWarn && d.progress >= 0.48) { d.camWarn = true; setAlert("SPEED CAMERA AHEAD · LIMIT 55"); }
  if (!d.camDone && d.progress >= 0.58) {
    d.camDone = true;
    if (d.speed > 55) { d.tickets += 1; setAlert("SPEED CAMERA · $75 TICKET"); } else setAlert("CAMERA · UNDER THE LIMIT ✓");
  }
  drawDriveScene(d.progress, true);
  document.querySelector("#drive-percent").textContent = `${Math.floor(d.progress * 100)}%`;
  document.querySelector("#drive-speed").textContent = `${Math.round(d.speed)} MPH`;
  document.querySelector("#progress-fill").style.width = `${(state.driveIndex + d.progress) / drives.length * 100}%`;
  document.querySelector("#drive-distance").textContent = `DRIVE ${state.driveIndex + 1} OF ${drives.length} · ${Math.floor(d.progress * 100)}%`;
  if (timestamp - d.lastHitAt > 1000) alertEl.textContent = "";
  if (d.progress >= 1) {
    finishDrive();
    return;
  }
  state.animationFrame = requestAnimationFrame(updateDrive);
}

function finishDrive() {
  const drive = state.drive;
  if (!drive || drive.finished) return;
  drive.finished = true;
  state.keys.accelerate = false;
  state.keys.brake = false;
  state.keys.left = false;
  state.keys.right = false;
  const averageSpeed = drive.speedTime / Math.max(1, drive.elapsed);
  const fuelFactor = Math.max(0.82, 1 + (averageSpeed - 42) * 0.007);
  const fuel = drive.distance * costPerMile(state.car) * fuelFactor;
  const collisionCost = drive.collisionCost + drive.tickets * 75;
  const bonus = drive.coinsGot * 4;
  const score = Math.max(0, 600 + drive.coinsGot * 120 - drive.collisions * 200 - drive.tickets * 150 - drive.redRuns * 150 + drive.bonusPts);
  state.score += score;
  const spent = drive.routeCost + fuel + collisionCost - bonus;
  state.remaining -= spent;
  state.tripCosts += drive.routeCost + collisionCost - bonus;
  state.fuelCosts += fuel;
  document.querySelector("#road-money").textContent = dollars(state.remaining);
  document.querySelector("#drive-overlay").textContent = `${drive.collisions
    ? `Test drive complete · ${drive.collisions} hit${drive.collisions > 1 ? "s" : ""} · ${dollars(collisionCost)} added cost`
    : "Test drive complete · clean driving!"} · ${drive.coinsGot}/${drive.coins.length} coins`;
  document.querySelector("#drive-overlay").classList.remove("hidden");
  document.querySelector("#drive-percent").textContent = "DONE";
  document.querySelector("#drive-speed").textContent = "0 MPH";
  document.querySelector("#drive-alert").textContent = drive.collisions ? `${drive.collisions} HIT` : "CLEAN RUN";
  document.querySelector("#drive-instructions").textContent =
    `${dollars(spent)} spent · ${dollars(fuel)} fuel · ${Math.round(averageSpeed)} MPH average · ${score} pts`;
  document.querySelector("#choice-list").innerHTML = `<button class="primary-button next-drive-button" type="button">${state.driveIndex === drives.length - 1 ? "See my results" : "Continue the trip"} <span>→</span></button>`;
  document.querySelector(".next-drive-button").addEventListener("click", () => {
    state.driveIndex += 1;
    if (state.driveIndex < drives.length) renderDrive();
    else renderEnding();
  });
}

function changeLane(direction) {
  if (!state.drive || state.drive.finished) return;
  state.drive.vx += direction * 1.4;
}

function threeYearCost(car, plan) {
  const paymentMonths = plan.id === "cash" ? 0 : 36;
  const fuel = state.profile.annualMiles * costPerMile(car) * 3;
  const upkeep = (60 + car.price / 1500) * 36;
  const estimatedResale = car.price * 0.58;
  if (plan.id === "lease") return upfrontCost(car, plan) + monthlyPayment(car, plan) * paymentMonths + fuel + upkeep;
  let balance = 0;
  if (plan.id === "loan") {
    const rate = illustrativeApr() / 12;
    const principal = Math.max(0, car.price - Math.min(car.price, state.profile.downPayment));
    const payment = monthlyPayment(car, plan);
    balance = principal * Math.pow(1 + rate, 36) - payment * (Math.pow(1 + rate, 36) - 1) / rate;
  }
  return upfrontCost(car, plan) + monthlyPayment(car, plan) * paymentMonths + fuel + upkeep - estimatedResale + balance;
}

function renderEnding() {
  document.querySelector("#drive-shell").classList.add("hidden");
  document.querySelector("#ending-shell").classList.remove("hidden");
  document.querySelector('[data-step="3"]').classList.remove("active");
  document.querySelector('[data-step="3"]').classList.add("done");
  const payment = monthlyPayment(state.car, state.plan);
  const candidates = cars.filter(meetsNeeds).flatMap((car) => plans
    .filter((plan) => planIsAffordable(car, plan))
    .filter((plan) => car.id !== state.car.id || plan.id !== state.plan.id)
    .map((plan) => ({ car, plan })));
  const alternative = candidates.sort((a, b) => threeYearCost(a.car, a.plan) - threeYearCost(b.car, b.plan))[0];
  const currentTotal = threeYearCost(state.car, state.plan);
  const alternativeTotal = alternative ? threeYearCost(alternative.car, alternative.plan) : currentTotal;
  document.querySelector("#ending-title").textContent = state.remaining >= state.profile.monthlyCap * 3
    ? "Room in the budget. Room to roam."
    : state.remaining >= 0 ? "A few good miles, mindfully spent." : "A memorable drive—with a tighter budget.";
  document.querySelector("#ending-summary").textContent =
    `Your Toyota ${state.car.name} ${state.plan.id === "lease" ? "lease" : state.plan.id === "cash" ? "cash purchase" : "loan"} made it through three different drives. You finished with ${dollars(state.remaining)} left in the road budget.`;
  document.querySelector("#ending-badge").textContent = state.remaining < 0
    ? `${dollars(Math.abs(state.remaining))} over your road budget`
    : `${dollars(state.remaining)} left in your road budget`;
  const grade = state.score >= 3000 ? "S" : state.score >= 2400 ? "A" : state.score >= 1800 ? "B" : "C";
  let best = state.score;
  try { best = Math.max(state.score, Number(localStorage.getItem("openroad-best") || 0)); localStorage.setItem("openroad-best", String(best)); } catch (e) { /* storage unavailable */ }
  document.querySelector("#ending-breakdown").innerHTML = [
    ["Vehicle demo price", dollars(state.car.price)],
    ["Upfront cost", dollars(upfrontCost(state.car, state.plan))],
    ["First monthly payment", state.plan.id === "cash" ? "None" : dollars(payment)],
    ["Test-drive choices", dollars(state.tripCosts)],
    ["Estimated test-drive fuel", dollars(state.fuelCosts)],
    ["Road budget remaining", dollars(state.remaining)],
    ["Driver score", `${state.score} pts · grade ${grade}`],
    ["Personal best", `${best} pts`],
    ["Illustrative 3-year net cost*", dollars(currentTotal)],
  ].map(([label, value]) => `<div class="breakdown-row ${label.startsWith("Road budget") ? "total" : ""}"><span>${label}</span><strong>${value}</strong></div>`).join("");
  if (alternative) {
    document.querySelector("#whatif-title").textContent = `Toyota ${alternative.car.name} · ${alternative.plan.name}`;
    document.querySelector("#whatif-copy").textContent =
      `Over an illustrative 3 years, this option is estimated at ${dollars(alternativeTotal)} versus ${dollars(currentTotal)} for your choice. ${alternative.car.id === state.car.id ? "It keeps the same vehicle but changes the way you pay." : `${alternative.car.suitability} `}${alternative.plan.id === "lease" ? "A lease can mean lower upfront costs, but mileage limits and no ownership at the end are important trade-offs." : alternative.plan.id === "cash" ? "Paying cash avoids monthly bills, but ties up more of your savings." : "With a loan, you own the vehicle after paying it off, and your monthly bill may be higher than a lease."}`;
    const difference = currentTotal - alternativeTotal;
    document.querySelector("#whatif-savings").textContent = difference > 0
      ? `Estimated difference: ${dollars(difference)} less over 3 years*`
      : difference < 0 ? `Estimated difference: ${dollars(Math.abs(difference))} more over 3 years*`
        : "Estimated 3-year costs are about the same*";
  } else {
    document.querySelector("#whatif-title").textContent = "No other plan fits your guardrails";
    document.querySelector("#whatif-copy").textContent = "Try adjusting your monthly payment limit or down payment to compare more options.";
    document.querySelector("#whatif-savings").textContent = "Your selected plan is the only option within your stated limits.";
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

const BODY_LABEL = { sedan: "Sedan", hatch: "Hatchback", coupe: "Coupe", suv: "SUV / crossover", bigsuv: "Three-row SUV", truck: "Pickup", van: "Minivan" };
const powertrain = (c) => (c.ev ? "Electric" : c.fcev ? "Hydrogen fuel cell" : c.phev ? "Plug-in hybrid" : c.hybrid ? "Hybrid" : "Gas");
const drivetrain = (c) => (c.awdStd ? "AWD / 4WD standard" : c.awd ? "AWD / 4WD available" : "No AWD offered");

function compareList() { return state.compare.map((id) => cars.find((c) => c.id === id)).filter(Boolean); }

function compareRows() {
  const p = state.profile, plan = (c) => bestPlan(c), energy = (c) => Math.round(p.annualMiles * costPerMile(c));
  return [
    ["Starting MSRP", (c) => `${c.est || c.awdAdded ? "≈ " : ""}${dollars(c.price)}`, (c) => c.price, "min"],
    ["Payment plan that fits you", (c) => plan(c).name],
    ["Monthly payment", (c) => (plan(c).id === "cash" ? "None" : `${dollars(monthlyPayment(c, plan(c)))}/mo`), (c) => monthlyPayment(c, plan(c)), "min"],
    ["Due at start (incl. est. fees)", (c) => dollars(upfrontCost(c, plan(c))), (c) => upfrontCost(c, plan(c)), "min"],
    ["Fuel economy / range (est.)", (c) => c.epa, (c) => costPerMile(c), "min"],
    ["Est. fuel / energy per year", (c) => dollars(energy(c)), energy, "min"],
    ["Est. 3-year net cost*", (c) => dollars(threeYearCost(c, plan(c))), (c) => threeYearCost(c, plan(c)), "min"],
    ["Powertrain", powertrain],
    ["Drivetrain", drivetrain],
    ["Seats", (c) => String(c.seats), (c) => c.seats, "max"],
    ["Body style", (c) => BODY_LABEL[c.body] || c.body],
    ["Safety", (c) => c.safety],
    ["Illustrative Deal Benefit Score", (c) => `${DealModel.evaluate(c, bestPlan(c), state.profile, dealScenario(), illustrativeApr()).score}%`],
    ["Illustrative 5-year resale value", (c) => dollars(DealModel.retained(c.price, dealScenario().toyotaRetention, 5))],
    ["Assumed assist-feature coverage (not crash safety)", () => `${dealScenario().toyotaSafety}%`],
    ["Modeled tailpipe CO₂ / year (not lifecycle)", (c) => `${Math.round(DealModel.emissions(c, p.annualMiles)).toLocaleString()} kg`],
    ["Assumed annual maintenance", () => dollars(dealScenario().toyotaMaintenance)],
    ["Your requirements met", (c) => requirementChips(c, plan(c)).map((t) => `✓ ${t}`).join("<br>")],
    ...(window.ToyotaInsurance?.rows() || []),
    ["Official page", (c) => `<a href="${c.url}" target="_blank" rel="noopener noreferrer">${c.url.replace("https://www.", "")} ↗</a>`],
  ];
}

function renderCompareTray() {
  const tray = document.querySelector("#compare-tray");
  tray.classList.toggle("hidden", !state.compare.length);
  document.querySelector("#compare-names").textContent = compareList().map((c) => c.name).join(" · ") + (state.compare.length < 2 ? " · add one more to compare" : "");
  document.querySelector("#open-compare").disabled = state.compare.length < 2;
}

function openCompare() {
  const list = compareList();
  if (list.length < 2) return;
  const head = `<tr><th></th>${list.map((c) => `<th><div class="cmp-img">${carIllustration(c)}</div>${c.year} Toyota ${c.name}<button class="text-button" type="button" data-pick="${c.id}">Choose this car</button></th>`).join("")}</tr>`;
  const body = compareRows().map(([label, show, num, dir]) => {
    const vals = list.map((c) => (num ? num(c) : 0));
    const best = num ? (dir === "min" ? Math.min(...vals) : Math.max(...vals)) : null;
    const differs = num && new Set(vals.map((v) => Math.round(v * 1000))).size > 1;
    return `<tr><th scope="row">${label}</th>${list.map((c, i) => {
      const win = differs && vals[i] === best;
      return `<td class="${win ? "best" : ""}">${show(c)}${win ? ' <b class="best-tag">BEST</b>' : ""}</td>`;
    }).join("")}</tr>`;
  }).join("");
  document.querySelector("#compare-table").innerHTML = `<table class="compare-table"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  document.querySelectorAll("[data-pick]").forEach((button) => button.addEventListener("click", () => {
    state.car = cars.find((c) => c.id === button.dataset.pick);
    document.querySelector("#compare-dialog").close();
    renderSetup();
    window.ToyotaInsurance?.prompt(state.car);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));
  document.querySelector("#compare-dialog").showModal();
}

function compareText() {
  const list = compareList();
  const strip = (h) => h.replace(/<br>/g, "; ").replace(/<[^>]+>/g, "");
  return ["TOYOTA MATCH · TOYOTA COMPARISON", new Date().toLocaleDateString("en-US"), "", `Comparing: ${list.map((c) => `Toyota ${c.name}`).join(" vs ")}`, "",
    ...compareRows().map(([label, show]) => `${label}: ${list.map((c) => strip(show(c))).join("  |  ")}`), "",
    "*Illustrative demo estimates. Confirm current pricing at toyota.com."].join("\\n");
}

function resultsText() {
  const p = state.profile, rows = Array.from(document.querySelectorAll("#ending-breakdown .breakdown-row"), (r) => `${r.children[0].textContent}: ${r.children[1].textContent}`);
  const text = (id) => document.querySelector(id).textContent;
  return [`TOYOTA MATCH · MY TOYOTA RESULTS${state.name ? ` · ${state.name}` : ""}`, new Date().toLocaleDateString("en-US"), "",
    `${text("#ending-title")}`, text("#ending-summary"), "",
    `MY PICK: Toyota ${state.car.name} (${state.car.type}) · ${state.plan.name}`,
    `Official page: ${state.car.url}`, "", "MY REQUIREMENTS",
    `Max price ${dollars(p.maxPrice)} · monthly cap ${dollars(p.monthlyCap)} · savings ${dollars(p.totalFunds)} · down payment ${dollars(p.downPayment)}`,
    `People: ${p.passengers}${p.childSeats ? " · child seats" : ""}${p.awd ? " · AWD" : ""} · ${p.annualMiles.toLocaleString("en-US")} mi/yr`,
    "Requirements met: " + requirementChips(state.car, state.plan).join(" · "), "", "THE NUMBERS", ...rows, "",
    `WHAT IF: ${text("#whatif-title")}`, text("#whatif-copy"), text("#whatif-savings"), "",
    "Illustrative demo estimates, not a Toyota offer. Confirm pricing and terms at toyota.com."].join("\n");
}

function setSaveStatus(message) {
  const el = document.querySelector("#save-status");
  el.textContent = message;
  setTimeout(() => { el.textContent = ""; }, 3000);
}

async function copyResults() {
  const text = resultsText();
  try { await navigator.clipboard.writeText(text); } catch (e) {
    const area = document.createElement("textarea");
    area.value = text; document.body.appendChild(area); area.select();
    try { document.execCommand("copy"); } catch (err) { /* ignore */ }
    area.remove();
  }
  setSaveStatus("Copied to clipboard ✓");
}

function saveResults() {
  const url = URL.createObjectURL(new Blob([resultsText()], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url; link.download = `toyota-match-${state.car.id}-results.txt`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setSaveStatus("Saved ✓");
}

function showNeeds() {
  window.ResultsFilters?.hide();
  document.querySelector("#finance-summary")?.classList.add("hidden");
  cancelAnimationFrame(state.animationFrame);
  state.drive = null;
  document.querySelector("#auth-shell").classList.add("hidden");
  document.querySelector("#needs-shell").classList.remove("hidden");
  document.querySelector(".intro").classList.add("hidden");
  document.querySelector(".game-shell").classList.add("hidden");
  document.querySelector("#drive-shell").classList.add("hidden");
  document.querySelector("#ending-shell").classList.add("hidden");
  ToyotaWizard?.restart();
  navigateToPage("customization");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setAuthMode(mode) {
  const isSignup = mode === "signup";
  document.querySelector("#signup-tab").classList.toggle("active", isSignup);
  document.querySelector("#login-tab").classList.toggle("active", !isSignup);
  document.querySelector("#signup-tab").setAttribute("aria-selected", String(isSignup));
  document.querySelector("#login-tab").setAttribute("aria-selected", String(!isSignup));
  document.querySelector("#name-field").classList.toggle("hidden", !isSignup);
  document.querySelector("#account-name").required = isSignup;
  document.querySelector("#account-password").autocomplete = isSignup ? "new-password" : "current-password";
  document.querySelector("#auth-submit-label").textContent = isSignup ? "Create my account" : "Sign in";
  document.querySelector("#auth-title").innerHTML = isSignup ? "Let's find a Toyota<br>that <em>fits.</em>" : "Welcome back to<br><em>Toyota Go.</em>";
}

function resetGame() {
  cancelAnimationFrame(state.animationFrame);
  state.drive = null;
  state.keys.left = false;
  state.keys.right = false;
  state.keys.accelerate = false;
  state.keys.brake = false;
  state.profile = null;
  state.email = "";
  state.name = "";
  state.matches = [...cars];
  state.car = cars[0];
  state.plan = plans[0];
  state.driveIndex = 0;
  state.remaining = 0;
  state.tripCosts = 0;
  state.fuelCosts = 0;
  state.score = 0;
  state.compare = [];
  resetDealScenario();
  document.querySelector("#auth-form").reset();
  document.querySelector("#needs-form").reset();
  ToyotaWizard?.reset();
  window.ToyotaInsurance?.reset();
  window.NessieFinance?.reset();
  window.ResultsFilters?.hide();
  setAuthMode("signup");
  document.querySelector("#auth-shell").classList.remove("hidden");
  document.querySelector("#needs-shell").classList.add("hidden");
  document.querySelector(".intro").classList.add("hidden");
  document.querySelector(".game-shell").classList.add("hidden");
  document.querySelector("#drive-shell").classList.add("hidden");
  document.querySelector("#ending-shell").classList.add("hidden");
  document.querySelectorAll(".step").forEach((step, index) => {
    step.classList.toggle("active", index === 0);
    step.classList.remove("done");
  });
  navigateToPage("home");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelector("#signup-tab").addEventListener("click", () => setAuthMode("signup"));
document.querySelector("#login-tab").addEventListener("click", () => setAuthMode("login"));
document.querySelector("#auth-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  state.email = document.querySelector("#account-email").value.trim();
  state.name = document.querySelector("#account-name").value.trim();
  document.querySelector("#account-password").value = "";
  showNeeds();
});
document.querySelector("#edit-needs").addEventListener("click", () => window.ResultsFilters?.open());
document.querySelector("#start-drive").addEventListener("click", () => window.ToyotaInsurance ? ToyotaInsurance.beforeDrive(startDrive) : startDrive());
document.querySelector("#show-all").addEventListener("click", () => {
  state.matches = state.allMatches;
  document.querySelector("#recommendation-count").textContent = `${state.matches.length} possible matches · based on your answers`;
  syncShowAll();
  renderSetup();
});
document.querySelector("#reset-button").addEventListener("click", resetGame);
document.querySelector("#open-compare").addEventListener("click", openCompare);
document.querySelector("#clear-compare").addEventListener("click", () => { state.compare = []; renderCars(); });
document.querySelector("#close-compare").addEventListener("click", () => document.querySelector("#compare-dialog").close());
document.querySelector("#copy-compare").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(compareText()); document.querySelector("#compare-status").textContent = "Copied ✓"; } catch (e) { document.querySelector("#compare-status").textContent = "Copy not available in this browser"; }
});
document.querySelector("#copy-results").addEventListener("click", copyResults);
document.querySelector("#save-results").addEventListener("click", saveResults);
document.querySelector("#print-results").addEventListener("click", () => window.print());
document.querySelector("#replay-button").addEventListener("click", returnToMatches);
document.querySelector("#back-to-matches").addEventListener("click", returnToMatches);
document.querySelector("#edit-preferences").addEventListener("click", () => window.ResultsFilters?.open());
window.addEventListener("keydown", (event) => {
  if (!state.drive || state.drive.finished || state.drive.paused) return;
  const key = event.key.toLowerCase();
  if (key === "arrowleft" || key === "a") {
    event.preventDefault();
    state.keys.left = true;
  } else if (key === "arrowright" || key === "d") {
    event.preventDefault();
    state.keys.right = true;
  } else if (key === "arrowup" || key === "w") {
    event.preventDefault();
    state.keys.accelerate = true;
  } else if (key === "arrowdown" || key === "s") {
    event.preventDefault();
    state.keys.brake = true;
  }
});
window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  if (key === "arrowleft" || key === "a") state.keys.left = false;
  if (key === "arrowright" || key === "d") state.keys.right = false;
  if (key === "arrowup" || key === "w") state.keys.accelerate = false;
  if (key === "arrowdown" || key === "s") state.keys.brake = false;
});
window.addEventListener("blur", () => {
  state.keys.left = false;
  state.keys.right = false;
  state.keys.accelerate = false;
  state.keys.brake = false;
});
[
  ["#steer-left", "left", -1],
  ["#steer-right", "right", 1],
].forEach(([selector, directionKey, direction]) => {
  const button = document.querySelector(selector);
  button.addEventListener("pointerdown", (event) => {
    if (!state.drive || state.drive.finished) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    changeLane(direction);
    state.keys[directionKey] = true;
  });
  const release = () => { state.keys[directionKey] = false; };
  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
  button.addEventListener("click", (event) => {
    if (event.detail === 0) changeLane(direction);
  });
});
bindPedal("#accelerate-button", "accelerate");
bindPedal("#brake-button", "brake");
renderSetup();
