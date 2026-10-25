// Quotes are entered by the customer, held in memory, and never fabricated or bound here.
(() => {
  const providers = [
    ["Toyota Insurance", "https://toyotainsurance.com/"],
    ["Progressive", "https://www.progressive.com/auto/"],
    ["GEICO", "https://www.geico.com/auto-insurance/"],
    ["State Farm", "https://www.statefarm.com/insurance/auto/"],
  ];
  let quotes = [], serial = 0, selected = {}, asked = new Set(), continuation = null;
  const escape = insightEscape;
  const money = value => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(value);
  const panel = document.createElement("section");
  panel.id = "insurance-panel";
  panel.className = "hidden";
  document.querySelector("#deal-insights").after(panel);
  const dialog = document.createElement("dialog");
  dialog.id = "insurance-dialog";
  dialog.className = "compare-dialog";
  dialog.setAttribute("aria-labelledby","insurance-title");
  dialog.innerHTML = `
    <div class="compare-head"><h2 id="insurance-title">Compare insurance quotes</h2><button type="button" id="close-insurance" class="skip-button">Done / continue</button></div>
    <div id="insurance-question"><h3>Would you like to compare insurance plans?</h3><p id="insurance-chosen-car"></p><button type="button" id="insurance-yes" class="primary-button">Yes, compare quotes</button> <button type="button" id="insurance-no" class="skip-button">Not now</button></div>
    <div id="insurance-workspace" class="hidden">
      <p class="insurance-note"><strong>No live quote feed is connected.</strong> Open an official provider site to request a personalized quote, then enter the offer you received. Toyota Go does not sell, verify or bind insurance. No driver, address, license or payment data is requested here.</p>
      <nav class="insurance-providers" aria-label="Official insurance quote websites">${providers.map(([name,url]) => `<a href="${url}" target="_blank" rel="noopener noreferrer">Get a quote · ${name} ↗</a>`).join("")}</nav>
      <form id="insurance-quote-form"><h3>Add a quote you received</h3><div class="results-filter-grid">
        <label class="form-field">Vehicle<select id="insurance-car" required></select></label>
        <label class="form-field">Insurer<select id="insurance-carrier">${providers.map(([name])=>`<option>${name}</option>`).join("")}<option>Other insurer</option></select></label>
        <label class="form-field">Plan / quote label<input id="insurance-label" maxlength="80" placeholder="e.g. Offer A · comprehensive & collision" required></label>
        <label class="form-field">Total quoted premium for the term ($)<input id="insurance-premium" type="number" min="0.01" max="100000" step="0.01" required placeholder="Enter the actual quote"></label>
        <label class="form-field">Quoted term<select id="insurance-term"><option value="6">6 months</option><option value="12">12 months</option><option value="1">1 month</option></select></label>
        <label class="form-field">Liability limits (bodily injury / property)<select id="insurance-liability"><option value="Not provided">Not provided</option><option>50/100/50</option><option>100/300/100</option><option>250/500/100</option><option>State minimum · varies by state</option><option>Other limits · consult quote</option></select></label>
        <label class="form-field">Collision deductible<select id="insurance-collision"><option>Not provided</option><option>Not included</option><option value="0">$0</option><option value="500">$500</option><option value="1000">$1,000</option><option value="2500">$2,500</option></select></label>
        <label class="form-field">Comprehensive deductible<select id="insurance-comprehensive"><option>Not provided</option><option>Not included</option><option value="0">$0</option><option value="500">$500</option><option value="1000">$1,000</option><option value="2500">$2,500</option></select></label>
        <label class="form-field">Quote date (optional)<input id="insurance-date" type="date"></label>
      </div><button type="submit" class="primary-button">Add quote to comparison</button><p id="insurance-form-status" role="status"></p></form>
      <div id="insurance-quote-comparison"></div>
      <p class="field-caption">Compare the same driver, location, limits, term and coverages. Liability limits shown as 100/300/100 mean $100,000 per person / $300,000 per accident bodily injury / $100,000 property damage. Financing or leasing may require collision/comprehensive and specific deductibles; check your contract. Monthly equivalent divides total quoted premium by term and excludes installment fees. Rates can change at renewal. This is not a complete coverage review.</p>
    </div>`;
  document.querySelector("main").append(dialog);
  const byId = id => document.getElementById(id);
  function chosen(carId) { return quotes.find(quote => quote.id === selected[carId]); }
  function carLabel(car) { return `${car.year} Toyota ${car.name}`; }
  function monthly(quote) { return quote.premium / quote.term; }
  function planFor(car) { return car.id === state.car?.id ? state.plan : bestPlan(car); }
  function close() {
    dialog.close();
    const action = continuation; continuation = null;
    if (action) action();
  }
  function quoteTable() {
    const target = byId("insurance-quote-comparison");
    if (!quotes.length) { target.innerHTML = "<p>No quotes entered yet. Premiums stay unknown until you add a real offer.</p>"; return; }
    target.innerHTML = `<div class="compare-scroll"><table class="compare-table"><caption>Customer-entered quotes · not verified or binding</caption><thead><tr><th>Vehicle / quote</th><th>Premium & term</th><th>Monthly equivalent</th><th>Vehicle payment + insurance / month</th><th>Coverages & deductibles</th><th>Actions</th></tr></thead><tbody>${quotes.map(quote => {
      const car = cars.find(item => item.id === quote.carId);
      const payment = monthlyPayment(car, planFor(car));
      return `<tr><th>${escape(carLabel(car))}<br>${escape(quote.insurer)} · ${escape(quote.label)}${quote.date ? `<br>Quoted ${escape(quote.date)}` : ""}</th>
        <td>${money(quote.premium)} / ${quote.term} months</td><td>${money(monthly(quote))}</td><td>${money(payment + monthly(quote))}<small> Vehicle payment is illustrative.</small></td>
        <td>Liability ${escape(quote.liability)}<br>Collision: ${escape(quote.collision)}<br>Comprehensive: ${escape(quote.comprehensive)}</td>
        <td><button class="skip-button" type="button" data-insurance-use="${quote.id}">${selected[quote.carId] === quote.id ? "Selected for this vehicle" : "Use this quote"}</button><button class="text-button" type="button" data-insurance-delete="${quote.id}">Remove</button></td></tr>`;
    }).join("")}</tbody></table></div><p class="field-caption">A lower premium is not necessarily better coverage. Quotes may not be directly comparable. No policy is purchased by selecting a quote.</p>`;
    target.querySelectorAll("[data-insurance-use]").forEach(button => button.addEventListener("click", () => {
      const quote = quotes.find(item => item.id === Number(button.dataset.insuranceUse));
      selected[quote.carId] = quote.id; render(); quoteTable();
    }));
    target.querySelectorAll("[data-insurance-delete]").forEach(button => button.addEventListener("click", () => {
      const id = Number(button.dataset.insuranceDelete);
      const quote = quotes.find(item => item.id === id);
      if (selected[quote.carId] === id) delete selected[quote.carId];
      quotes = quotes.filter(item => item.id !== id); render(); quoteTable();
    }));
  }
  function open(car = state.car, ask = false, next = null) {
    if (!state.profile || !car) return;
    continuation = next;
    byId("insurance-car").replaceChildren(...cars.map(item => new Option(carLabel(item),item.id)));
    byId("insurance-car").value = car.id;
    byId("insurance-chosen-car").textContent = `Selected: ${carLabel(car)}. Compare premiums and coverage alongside its ${state.plan.name.toLowerCase()} costs.`;
    byId("insurance-question").classList.toggle("hidden", !ask);
    byId("insurance-workspace").classList.toggle("hidden", ask);
    byId("insurance-title").textContent = ask ? "Your Toyota, your coverage" : "Compare insurance quotes";
    asked.add(car.id); quoteTable();
    if (!dialog.open) dialog.showModal();
  }
  function render() {
    if (!state.profile || !state.car || !state.matches.length) { panel.classList.add("hidden"); return; }
    panel.classList.remove("hidden");
    const quote = chosen(state.car.id), payment = monthlyPayment(state.car,state.plan);
    panel.innerHTML = `<p class="eyebrow">YOUR CAR & YOUR COVERAGE</p><h2>Would you like to compare insurance plans?</h2><p>${escape(carLabel(state.car))} · ${quote ? `Selected customer quote: ${escape(quote.insurer)} · ${money(monthly(quote))}/month equivalent. Vehicle payment + insurance: <strong>${money(payment + monthly(quote))}/month</strong>.` : "See how actual quoted premiums change your monthly vehicle cost."}</p><button type="button" class="primary-button" id="open-insurance">Compare real quotes</button><p class="field-caption">Official insurer quote links + customer-entered offers. No live quotes or purchase in Toyota Go. Quotes are kept only in this page session. Insurance totals are shown separately and are not included in the Deal Benefit Score or game budget.</p>`;
    byId("open-insurance").addEventListener("click", () => open());
  }
  byId("insurance-yes").addEventListener("click", () => {
    byId("insurance-question").classList.add("hidden"); byId("insurance-workspace").classList.remove("hidden");
    byId("insurance-title").textContent = "Compare insurance quotes";
  });
  byId("insurance-no").addEventListener("click", close);
  byId("close-insurance").addEventListener("click", close);
  dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
  byId("insurance-quote-form").addEventListener("submit", event => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const carId = byId("insurance-car").value;
    const quote = { id: ++serial, carId, insurer: byId("insurance-carrier").value,
      label: byId("insurance-label").value.trim(), premium: Number(byId("insurance-premium").value),
      term: Number(byId("insurance-term").value), liability: byId("insurance-liability").value,
      collision: byId("insurance-collision").value, comprehensive: byId("insurance-comprehensive").value,
      date: byId("insurance-date").value };
    if (!quote.label) { byId("insurance-label").setCustomValidity("Enter a quote label."); byId("insurance-label").reportValidity(); return; }
    quotes.push(quote); selected[carId] = quote.id; render(); quoteTable();
    byId("insurance-form-status").textContent = "Quote added. Review the premium and coverage before using it for a comparison.";
    byId("insurance-label").value = ""; byId("insurance-premium").value = "";
  });
  byId("insurance-label").addEventListener("input", event => event.target.setCustomValidity(""));
  const compareButton = document.createElement("button");
  compareButton.type = "button"; compareButton.className = "primary-button"; compareButton.textContent = "Compare insurance";
  document.querySelector("#compare-dialog .compare-head > div").prepend(compareButton);
  compareButton.addEventListener("click", () => { byId("compare-dialog").close(); open(); });
  window.ToyotaInsurance = {
    render,
    prompt(car) { if (!asked.has(car.id)) open(car,true); },
    beforeDrive(action) { if (asked.has(state.car.id)) action(); else open(state.car,true,action); },
    reset() { quotes = []; selected = {}; asked.clear(); continuation = null; if (dialog.open) dialog.close(); render(); },
    rows() { return [
      ["Insurance quote (customer entered)", car => { const quote = chosen(car.id); return quote ? `${escape(quote.insurer)} · ${escape(quote.label)} · ${money(monthly(quote))}/mo equivalent` : "No quote supplied"; }],
      ["Vehicle payment + selected insurance / month (comparison plan)", car => { const quote = chosen(car.id); return quote ? money(monthlyPayment(car,bestPlan(car)) + monthly(quote)) : "Unknown · enter a quote"; }],
      ["Insurance premium over 36 months, if unchanged", car => { const quote = chosen(car.id); return quote ? money(monthly(quote)*36) : "Unknown"; }],
      ["Est. three-year ownership cost + insurance, if premium unchanged", car => { const quote = chosen(car.id); return quote ? money(threeYearCost(car,bestPlan(car)) + monthly(quote)*36) : "Unknown · enter a quote"; }],
      ["Insurance limits / collision / comprehensive", car => { const quote = chosen(car.id); return quote ? escape(`${quote.liability} / ${quote.collision} / ${quote.comprehensive}`) : "Not provided"; }],
    ]; },
  };
  document.addEventListener("toyota:matches", render);
})();
