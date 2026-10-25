(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const money = (value) => new Intl.NumberFormat("en-US", {
    style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(value);
  const number = (value) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const safeText = (value, fallback = "Not provided") =>
    typeof value === "string" && value.trim() ? value.trim() : fallback;
  const validAccounts = (data) => data && Array.isArray(data.accounts) &&
    data.accounts.every((account) => account && ["string", "number"].includes(typeof account.id) &&
      typeof account.nickname === "string" && typeof account.type === "string" && finite(account.balance));

  const dialog = document.createElement("dialog");
  dialog.id = "finance-dialog";
  dialog.setAttribute("aria-labelledby", "finance-title");
  dialog.innerHTML = `
    <div class="finance-shell">
      <header class="finance-head">
        <div><p class="eyebrow">NESSIE SANDBOX · AFFORDABILITY WORKSPACE</p>
          <h2 id="finance-title">Make room for the road.</h2>
          <p>Move Freely. Live Fully</p></div>
        <button type="button" class="skip-button" id="finance-close">Close</button>
      </header>
      <div class="finance-notice" role="note"><strong>Not live banking.</strong>
        Built-in sample data is fictional. Nessie mode uses a sandbox API and fictional customer accounts.
        Neither mode is a TFS preapproval, credit decision, real money, or a live bank connection.</div>
      <p id="finance-credential-note" class="finance-callout hidden"></p>
      <p id="finance-status" class="finance-status" role="status" aria-live="polite"></p>
      <section class="finance-controls" aria-label="Affordability analysis settings">
        <label class="form-field">Data mode
          <select id="finance-mode"><option value="sample">Built-in fictional sample</option><option value="nessie">Nessie API sandbox</option></select>
        </label>
        <label class="form-field">Sample scenario
          <select id="finance-scenario"><option value="balanced">Balanced</option><option value="tight">Tight</option></select>
        </label>
        <label class="form-field">Optional gross monthly income ($)
          <input id="finance-income" type="number" min="0" max="10000000" step="1" inputmode="decimal" placeholder="Leave blank if unknown">
        </label>
      </section>
      <section class="finance-accounts">
        <div class="finance-section-title"><div><p class="eyebrow">FICTITIOUS CUSTOMER</p><h3>Accounts to include</h3></div>
          <span id="finance-account-count">Load a mode to see accounts</span></div>
        <div id="finance-account-list" class="finance-account-list" aria-live="polite"></div>
      </section>
      <button class="primary-button finance-analyze" id="finance-analyze" type="button">Analyze affordability</button>
      <p class="field-caption">Account selection affects analysis only. Balances are sandbox data and stay server-side for the sample session.</p>
      <section id="finance-results" class="finance-results hidden" aria-labelledby="finance-result-title">
        <div class="finance-result-top"><div><p class="eyebrow" id="finance-source-label"></p><h3 id="finance-result-title">A monthly picture</h3></div>
          <span id="finance-period" class="finance-period"></span></div>
        <p id="finance-completeness" class="finance-completeness"></p>
        <div id="finance-metrics" class="finance-metrics"></div>
        <ul id="finance-warnings" class="finance-warnings"></ul>
        <div class="finance-vehicle">
          <p class="eyebrow">VEHICLE-SPECIFIC VIEW</p><h4 id="finance-vehicle-title">Current vehicle and selected Toyota</h4>
          <div id="finance-vehicle-metrics" class="finance-vehicle-metrics"></div>
          <p class="field-caption">The operating-cost offset compares observed sandbox gas purchases with the selected Toyota’s estimated energy cost using the assumptions below. It can be negative and is never guaranteed; actual consumption, rates, insurance and driving differ.</p>
          <div class="finance-assumptions">
            <label>Gas price ($/gal)<input id="finance-gas-price" type="number" min="0" max="100" step=".01" value="3.50"></label>
            <label>Electricity ($/kWh)<input id="finance-electric-price" type="number" min="0" max="100" step=".01" value=".17"></label>
            <label>EV use (kWh/mi)<input id="finance-kwh-mile" type="number" min=".01" max="5" step=".01" value=".30"></label>
            <label>PHEV electric share (%)<input id="finance-phev-share" type="number" min="0" max="100" step="1" value="50"></label>
            <label>Annual mileage<input id="finance-annual-miles" type="number" min="0" max="200000" step="500" value="12000"></label>
          </div>
        </div>
        <div class="finance-apr">
          <div><p class="eyebrow">ILLUSTRATIVE SANDBOX SCENARIO</p><strong id="finance-apr-value">APR unavailable</strong><p id="finance-apr-label"></p></div>
          <button type="button" class="skip-button" id="finance-apply-apr" disabled>Apply sandbox APR</button>
        </div>
        <div class="finance-apply-row"><button type="button" class="skip-button" id="finance-apply-budget" disabled>Use bank payment budget</button>
          <span id="finance-apply-status" role="status"></span></div>
      </section>
      <section class="finance-reserve" aria-labelledby="finance-reserve-title">
        <p class="eyebrow">OPTIONAL · SANDBOX ONLY</p><h3 id="finance-reserve-title">Move money to a demo reserve?</h3>
        <p>Use two accounts from the same fictional customer account list. Destination is a demo reserve only—not a TFS holding account. Nothing moves automatically when you choose a vehicle.</p>
        <p id="finance-transfer-availability" class="finance-transfer-availability" role="status">Test transfers require a fictional same-customer Checking → Savings pair.</p>
        <button type="button" class="skip-button" id="finance-reserve-start" disabled>Set up a test transfer</button>
        <form id="finance-reserve-form" class="hidden">
          <div class="finance-transfer-fields">
            <label class="form-field">Amount ($)<input id="finance-transfer-amount" type="number" min=".01" max="100000" step=".01" required></label>
            <label class="form-field">From fictional account<select id="finance-transfer-source" required></select></label>
            <label class="form-field">To fictional account · demo reserve<select id="finance-transfer-payee" required></select></label>
          </div>
          <button type="submit" class="skip-button">Review test transfer</button>
        </form>
        <div id="finance-transfer-review" class="finance-transfer-review hidden"></div>
        <div id="finance-receipt" class="finance-receipt hidden" role="status" aria-live="polite"></div>
      </section>
      <p class="finance-footnote">For learning only. No credit check, loan offer, approval, or real funds. Results are estimates from the selected source period and are not financial advice.</p>
    </div>`;
  document.querySelector("main").append(dialog);

  const panel = document.createElement("section");
  panel.id = "finance-summary";
  panel.className = "finance-summary hidden";
  panel.setAttribute("aria-label", "Affordability workspace");
  panel.innerHTML = `<div><p class="eyebrow">NESSIE SANDBOX · AFFORDABILITY</p><h2>See the whole monthly picture.</h2>
    <p id="finance-summary-copy">A fictional sample is available before the quiz. No bank connection or credit check.</p></div>
    <button class="primary-button" type="button" id="finance-open">Open affordability workspace <span aria-hidden="true">→</span></button>`;
  const resultsFilters = document.querySelector("#results-filters");
  if (resultsFilters) resultsFilters.after(panel);
  else document.querySelector(".intro")?.after(panel);
  const homeActions = document.querySelector(".home-actions");
  if (homeActions && !document.querySelector("#home-finance")) {
    const homeButton = document.createElement("button");
    homeButton.type = "button";
    homeButton.id = "home-finance";
    homeButton.className = "skip-button";
    homeButton.textContent = "Explore affordability";
    homeActions.append(homeButton);
    homeButton.addEventListener("click", open);
  }

  const mode = byId("finance-mode");
  const scenario = byId("finance-scenario");
  const accountList = byId("finance-account-list");
  const resultNode = byId("finance-results");
  let config = null;
  let configPromise = null;
  let accounts = [];
  let accountsMode = "";
  let accountsScenario = "";
  let latest = null;
  let resultSignature = "";
  let loading = false;
  let accountLoadToken = 0;
  let transferKey = null;
  let transferDetails = null;
  let transferBusy = false;
  let transferLocked = false;
  let mileageInitialized = false;
  let mileageEdited = false;

  function open() {
    if (!mileageInitialized && !mileageEdited && Number.isFinite(state?.profile?.annualMiles)) {
      byId("finance-annual-miles").value = String(state.profile.annualMiles);
      mileageInitialized = true;
    }
    if (!dialog.open) dialog.showModal();
    if (!config) {
      loadConfig().then((loaded) => { if (loaded && !accounts.length) loadAccounts(); });
    } else if (!accounts.length) loadAccounts();
  }
  byId("finance-open").addEventListener("click", open);
  byId("finance-money-open")?.addEventListener("click", open);
  byId("finance-close").addEventListener("click", () => dialog.close());

  async function jsonResponse(response) {
    let body;
    try { body = await response.json(); }
    catch { throw new Error("The service returned an unreadable response. Please try again later."); }
    if (!response.ok) throw new Error(safeText(body?.error, `Request failed (${response.status}).`));
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("The service response was missing required data. Please try again later.");
    }
    return body;
  }
  function loadConfig() {
    if (config) return Promise.resolve(config);
    if (configPromise) return configPromise;
    const task = (async () => {
      setStatus("Checking sandbox availability…");
      try {
        config = await jsonResponse(await fetch("/api/finance/config", { credentials: "same-origin" }));
        if (typeof config.nessie_configured !== "boolean" || typeof config.csrf_token !== "string" || !config.csrf_token ||
            typeof config.session_token !== "string" || !config.session_token) {
          throw new Error("The finance configuration response is incomplete. Analysis is unavailable.");
        }
        const nessieOption = mode.querySelector('[value="nessie"]');
        nessieOption.disabled = !config.nessie_configured;
        byId("finance-credential-note").classList.toggle("hidden", config.nessie_configured);
        byId("finance-credential-note").textContent = config.nessie_configured
          ? "" : "Nessie API credentials are not configured. Built-in sample mode is available; the Nessie API mode needs server-side developer setup. Do not enter credentials here.";
        if (!config.nessie_configured && mode.value === "nessie") mode.value = "sample";
        setStatus(config.nessie_configured ? "Sandbox configuration ready." :
          "Built-in sample is available. Nessie sandbox credentials are needed on the service, not from visitors.");
        return config;
      } catch (error) {
        config = null;
        setStatus(error.message || "Could not check the finance service configuration.", true);
        return null;
      }
    })();
    configPromise = task;
    task.finally(() => { if (configPromise === task) configPromise = null; });
    return task;
  }
  function setStatus(message, isError = false) {
    const node = byId("finance-status");
    node.textContent = message;
    node.classList.toggle("is-error", isError);
  }
  function sessionHeaders(extra = {}) {
    if (!config || typeof config.session_token !== "string" || !config.session_token) {
      throw new Error("The sandbox session is not available. Reload the workspace before continuing.");
    }
    return { ...extra, "X-Sandbox-Session": config.session_token };
  }
  function postHeaders() {
    if (!config || typeof config.csrf_token !== "string" || !config.csrf_token) {
      throw new Error("The request security token is unavailable. Reload the workspace before continuing.");
    }
    return sessionHeaders({ "Content-Type": "application/json", "X-CSRF-Token": config.csrf_token });
  }
  function checkedIds() {
    return [...accountList.querySelectorAll('input[type="checkbox"]:checked')].map((input) => input.value);
  }
  function invalidateAnalysis(message) {
    if (state?.profile && state.profile.sandboxFinance != null && typeof window.setSandboxFinance === "function") {
      window.setSandboxFinance(false, null);
    }
    latest = null;
    resultSignature = "";
    resultNode.classList.add("hidden");
    byId("finance-apply-apr").disabled = true;
    byId("finance-apply-budget").disabled = true;
    byId("finance-apply-status").textContent = "";
    if (message) setStatus(message);
    renderSummary();
  }
  function currentSignature() {
    return JSON.stringify({
      mode: mode.value,
      scenario: scenario.value,
      account_ids: checkedIds().sort(),
      gross_monthly_income: byId("finance-income").value.trim(),
    });
  }
  async function loadAccounts() {
    const token = ++accountLoadToken;
    if (mode.value === "nessie" && config?.nessie_configured === false) {
      accountList.textContent = "Nessie sandbox is unavailable until the service is configured.";
      byId("finance-account-count").textContent = "Unavailable";
      return;
    }
    accountList.textContent = "Loading fictional checking and savings accounts…";
    byId("finance-account-count").textContent = "Loading";
    try {
      if (!config) {
        const loadedConfig = await loadConfig();
        if (!loadedConfig) throw new Error("Finance configuration is unavailable; no accounts request was sent.");
      }
      const selectedMode = mode.value;
      const selectedScenario = scenario.value;
      const data = await jsonResponse(await fetch(`/api/finance/accounts?mode=${encodeURIComponent(selectedMode)}&scenario=${encodeURIComponent(selectedScenario)}`, {
        credentials: "same-origin", headers: sessionHeaders(),
      }));
      if (token !== accountLoadToken) return;
      if (data.mode !== selectedMode || !validAccounts(data)) throw new Error("The accounts response is malformed or does not match the selected mode.");
      accounts = data.accounts;
      accountsMode = selectedMode;
      accountsScenario = selectedScenario;
      renderAccounts();
      setStatus(`${accounts.length} fictional checking/savings accounts loaded for ${selectedMode === "sample" ? "built-in sample data" : "Nessie API sandbox"}.`);
    } catch (error) {
      if (token !== accountLoadToken) return;
      accounts = [];
      accountList.textContent = error.message || "Could not load sandbox accounts.";
      byId("finance-account-count").textContent = "Unavailable";
      byId("finance-reserve-start").disabled = true;
      setStatus(error.message || "Could not load accounts.", true);
    }
  }
  function renderAccounts() {
    accountList.replaceChildren();
    byId("finance-account-count").textContent = `${accounts.length} accounts · all available for transfers`;
    const checkable = accounts.filter((account) => /checking|savings/i.test(account.type));
    if (!accounts.length) {
      accountList.textContent = "No accounts were returned.";
      byId("finance-reserve-start").disabled = true;
      return;
    }
    checkable.forEach((account, index) => {
      const label = document.createElement("label");
      label.className = "finance-account";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = String(account.id);
      input.checked = true;
      input.id = `finance-account-${index}`;
      const detail = document.createElement("span");
      detail.className = "finance-account-copy";
      const title = document.createElement("strong");
      title.textContent = account.nickname;
      const meta = document.createElement("small");
      meta.textContent = `${account.type} · ${money(account.balance)} · fictional`;
      detail.append(title, meta);
      label.append(input, detail);
      accountList.append(label);
    });
    if (!checkable.length) accountList.textContent = "No checking or savings accounts were returned for analysis.";
    fillTransferOptions();
    const sources = transferSourceAccounts();
    const availability = byId("finance-transfer-availability");
    availability.textContent = sources.length
      ? "Only same-customer fictional Checking → Savings transfers are available. All eligible accounts are listed, regardless of analysis selection."
      : "Test transfer unavailable: the account list has no Checking source and Savings destination with matching customer_id.";
    byId("finance-reserve-start").disabled = transferLocked || sources.length === 0;
  }
  function transferSourceAccounts() {
    const checking = (account) => /checking/i.test(account.type);
    const savings = (account) => /savings/i.test(account.type);
    return accounts.filter((source) => checking(source) && source.customer_id != null &&
      accounts.some((payee) => savings(payee) && payee.customer_id != null &&
        String(payee.customer_id) === String(source.customer_id) && String(payee.id) !== String(source.id)));
  }
  function fillTransferOptions() {
    const source = byId("finance-transfer-source");
    const previousSource = source.value;
    source.replaceChildren();
    transferSourceAccounts().forEach((account) => {
      const label = `${account.nickname} · ${account.type} · ${money(account.balance)}`;
      source.add(new Option(label, String(account.id)));
    });
    if ([...source.options].some((item) => item.value === previousSource)) source.value = previousSource;
    updatePayeeOptions();
  }
  function updatePayeeOptions() {
    const sourceSelect = byId("finance-transfer-source");
    const payeeSelect = byId("finance-transfer-payee");
    const selectedSource = accounts.find((account) => String(account.id) === sourceSelect.value);
    const previousPayee = payeeSelect.value;
    payeeSelect.replaceChildren();
    const eligible = selectedSource && selectedSource.customer_id != null
      ? accounts.filter((account) => /savings/i.test(account.type) && account.customer_id != null &&
        String(account.customer_id) === String(selectedSource.customer_id) &&
        String(account.id) !== String(selectedSource.id))
      : [];
    eligible.forEach((account) => {
      const label = `${account.nickname} · ${account.type} · ${money(account.balance)} · demo reserve destination`;
      payeeSelect.add(new Option(label, String(account.id)));
    });
    if ([...payeeSelect.options].some((item) => item.value === previousPayee)) payeeSelect.value = previousPayee;
  }

  async function analyze() {
    if (loading) return;
    if (!config) await loadConfig();
    if (!config) return;
    const ids = checkedIds();
    const incomeText = byId("finance-income").value.trim();
    const income = incomeText === "" ? undefined : Number(incomeText);
    if (!ids.length) { setStatus("Select at least one checking or savings account to analyze.", true); return; }
    if (incomeText && (!Number.isFinite(income) || income < 0)) { setStatus("Enter a valid non-negative monthly income, or leave it blank.", true); return; }
    if (accountsMode !== mode.value || accountsScenario !== scenario.value) {
      await loadAccounts();
      setStatus("Accounts refreshed. Review the selected accounts, then analyze again.");
      return;
    }
    const requestSignature = currentSignature();
    invalidateAnalysis("Refreshing analysis. The previous APR override has been cleared.");
    loading = true;
    byId("finance-analyze").disabled = true;
    byId("finance-analyze").textContent = "Analyzing…";
    setStatus("Analyzing selected sandbox data…");
    try {
      const payload = {
        mode: mode.value,
        scenario: scenario.value,
        account_ids: ids.map((id) => accounts.find((account) => String(account.id) === id)?.id ?? id),
      };
      if (income !== undefined) payload.gross_monthly_income = income;
      const data = await jsonResponse(await fetch("/api/finance/analyze", {
        method: "POST", credentials: "same-origin",
        headers: postHeaders(),
        body: JSON.stringify(payload),
      }));
      if (requestSignature !== currentSignature()) {
        throw new Error("Analysis inputs changed while the request was running. Review the account selection and analyze again.");
      }
      const required = ["income_monthly", "bills_monthly", "debt_monthly", "other_spending_monthly",
        "gas_monthly", "liquid_balance", "disposable_monthly", "safety_buffer"];
      if (data.mode !== mode.value || typeof data.complete !== "boolean" ||
          required.some((key) => !finite(data[key])) ||
          !(data.debt_ratio === null || (finite(data.debt_ratio) && data.debt_ratio >= 0)) ||
          !(data.payment_budget === null || finite(data.payment_budget)) ||
          !(data.apr === null || (finite(data.apr) && data.apr >= 0)) || !Array.isArray(data.warnings) ||
          data.warnings.some((warning) => typeof warning !== "string")) {
        throw new Error("Analysis response is incomplete or malformed. No result was applied.");
      }
      if (data.ratio_basis != null && typeof data.ratio_basis !== "string") throw new Error("Analysis response has an invalid debt-ratio basis.");
      latest = data;
      resultSignature = requestSignature;
      renderResult();
      setStatus("Analysis updated from fictional sandbox data.");
      renderSummary();
    } catch (error) {
      latest = null;
      resultSignature = "";
      resultNode.classList.add("hidden");
      setStatus(error.message || "Analysis failed. Please retry.", true);
      renderSummary();
    } finally {
      loading = false;
      byId("finance-analyze").disabled = false;
      byId("finance-analyze").textContent = "Analyze affordability";
    }
  }
  byId("finance-analyze").addEventListener("click", analyze);

  function addMetric(container, label, value, hint = "") {
    const item = document.createElement("div");
    item.className = "finance-metric";
    const term = document.createElement("span"); term.textContent = label;
    const strong = document.createElement("strong"); strong.textContent = value;
    item.append(term, strong);
    if (hint) { const small = document.createElement("small"); small.textContent = hint; item.append(small); }
    container.append(item);
  }
  function renderResult() {
    if (!latest) return;
    resultNode.classList.remove("hidden");
    byId("finance-source-label").textContent = latest.mode === "sample" ? "BUILT-IN FICTIONAL SAMPLE DATA" : "NESSIE API SANDBOX DATA";
    byId("finance-period").textContent = latest.observed_from || latest.observed_to
      ? `${safeText(latest.observed_from, "Period start unavailable")} — ${safeText(latest.observed_to, "Period end unavailable")}`
      : "Source period not provided";
    byId("finance-completeness").textContent = latest.complete
      ? "Complete sandbox analysis · not a lending decision."
      : "Incomplete sandbox analysis · review warnings; APR cannot be applied.";
    const metrics = byId("finance-metrics");
    metrics.replaceChildren();
    addMetric(metrics, "Disposable cashflow / month", money(latest.disposable_monthly));
    addMetric(metrics, "Observed deposits / month", money(latest.income_monthly), "Income proxy, not verified gross earnings");
    addMetric(metrics, "Bills / month", money(latest.bills_monthly));
    addMetric(metrics, "Debt / month", money(latest.debt_monthly));
    addMetric(metrics, "Other spending / month", money(latest.other_spending_monthly));
    addMetric(metrics, "Gas / month", money(latest.gas_monthly));
    addMetric(metrics, "Liquid balance", money(latest.liquid_balance));
    addMetric(metrics, "Safety buffer", money(latest.safety_buffer));
    addMetric(metrics, "Recommended max payment", latest.payment_budget === null ? "Unavailable" : money(latest.payment_budget), "Sandbox estimate · not an approval");
    addMetric(metrics, "Debt-to-income proxy", latest.debt_ratio === null ? "Unavailable" : `${number(latest.debt_ratio * 100)}%`, safeText(latest.ratio_basis, "Basis not supplied"));
    const warnings = byId("finance-warnings");
    warnings.replaceChildren();
    const warningItems = latest.warnings.length ? latest.warnings : ["No warnings were returned by the selected source."];
    warningItems.forEach((warning) => {
      const item = document.createElement("li"); item.textContent = warning; warnings.append(item);
    });
    const aprAvailable = latest.complete && finite(latest.apr) && latest.apr >= 0;
    byId("finance-apr-value").textContent = aprAvailable ? `${number(latest.apr)}% illustrative APR` : "APR unavailable";
    byId("finance-apr-label").textContent = safeText(latest.apr_label, "Illustrative sandbox scenario only; not a rate offer or preapproval.");
    byId("finance-apply-apr").disabled = !aprAvailable;
    byId("finance-apply-budget").disabled = !latest.complete || !finite(latest.payment_budget) || latest.payment_budget <= 0;
    updateVehicleComparison();
  }
  function currentPayment() {
    const current = state?.profile?.currentVehicle;
    if (!current || state?.profile?.skippedQuestions?.includes("ownership")) return null;
    if (current.status === "none") return 0;
    if (current.status === "lease") return finite(current.leasePayment) ? current.leasePayment : null;
    return finite(current.monthlyPayment) ? current.monthlyPayment : null;
  }
  function selectedOperatingCost(car, miles, settings) {
    if (!car || car.fcev) return null;
    const gasPrice = settings.gas;
    const powerPrice = settings.electric;
    if (car.ev) return miles * settings.kwh * powerPrice / 12;
    if (car.phev) {
      const electricMiles = miles * settings.share;
      const gasMiles = miles - electricMiles;
      return (electricMiles * settings.kwh * powerPrice + gasMiles * gasPrice / Math.max(1, car.mpg || 30)) / 12;
    }
    return miles * gasPrice / Math.max(1, car.mpg || 30) / 12;
  }
  function updateVehicleComparison() {
    if (!latest) return;
    const gas = Number(byId("finance-gas-price").value);
    const electric = Number(byId("finance-electric-price").value);
    const kwh = Number(byId("finance-kwh-mile").value);
    const share = Number(byId("finance-phev-share").value) / 100;
    const miles = Number(byId("finance-annual-miles").value);
    if (![gas, electric, kwh, share, miles].every(Number.isFinite) || gas < 0 || electric < 0 || kwh <= 0 || share < 0 || share > 1 || miles < 0) {
      byId("finance-vehicle-metrics").textContent = "Enter valid non-negative energy assumptions to update this comparison.";
      return;
    }
    const car = state?.profile ? state.car : null;
    const payment = currentPayment();
    const estimatedOperating = selectedOperatingCost(car, miles, { gas, electric, kwh, share });
    const baseline = latest.gas_monthly;
    const offset = estimatedOperating === null ? null : baseline - estimatedOperating;
    const rows = byId("finance-vehicle-metrics");
    rows.replaceChildren();
    addMetric(rows, "Current vehicle payment", payment === null ? "Unknown" : money(payment), "From quiz profile when supplied");
    addMetric(rows, "Current insurance", "Unknown", "No verified current premium is available");
    const insurance = car && typeof window.ToyotaInsurance?.monthlyForCar === "function"
      ? window.ToyotaInsurance.monthlyForCar(car.id) : null;
    const vehiclePayment = car && state?.plan && typeof window.monthlyPayment === "function"
      ? window.monthlyPayment(car, state.plan) : null;
    addMetric(rows, "Bank payment budget", latest.payment_budget === null ? "Unavailable" : money(latest.payment_budget), "Nessie/sample recommended maximum");
    addMetric(rows, "Selected Toyota insurance", finite(insurance) && insurance >= 0 ? money(insurance) : "Unknown", "Customer-entered quote, if available");
    addMetric(rows, `Selected ${car ? `Toyota ${car.name}` : "Toyota"} payment`, finite(vehiclePayment)
      ? money(vehiclePayment) : "Not available", state?.plan?.name || "");
    const combinedPayment = finite(vehiclePayment) && finite(insurance) && insurance >= 0
      ? money(vehiclePayment + insurance) : "Unknown";
    addMetric(rows, "Selected Toyota payment + insurance", combinedPayment,
      finite(insurance) && insurance >= 0 ? "Illustrative payment plus selected insurance quote" : "Insurance unknown; no combined total shown");
    addMetric(rows, "Estimated fuel / energy savings offset", offset === null ? "Not estimated" : `${offset < 0 ? "−" : "+"}${money(Math.abs(offset))} / mo`,
       offset === null ? "Powertrain estimate unavailable" : "Against observed sandbox gas purchases; could be negative. Selected mileage/energy prices are assumptions.");
    const netImpact = finite(vehiclePayment) && offset !== null
      ? vehiclePayment - offset + (finite(insurance) ? insurance : 0) : null;
    addMetric(rows, "Net monthly impact · fuel offset", netImpact === null ? "Unknown" : money(netImpact),
      finite(insurance) ? "Includes full selected insurance premium; no existing debt or insurance has been released."
        : "Insurance excluded because its premium is unknown; existing debts remain deducted.");
    const remaining = netImpact !== null && finite(latest.payment_budget) ? latest.payment_budget - netImpact : null;
    addMetric(rows, "Cashflow fit after fuel offset", remaining === null ? "Unavailable" : `${money(remaining)} ${remaining >= 0 ? "remaining" : "over budget"}`,
      "Illustrative comparison only; other ownership costs can differ. Not a lender decision.");
    byId("finance-vehicle-title").textContent = car
      ? `Current vehicle vs. Toyota ${car.name} · ${state?.plan?.name || "selected plan"}`
      : "Vehicle comparison · select a Toyota to personalize";
  }
  ["finance-gas-price", "finance-electric-price", "finance-kwh-mile", "finance-phev-share", "finance-annual-miles"]
    .forEach((id) => byId(id).addEventListener("input", updateVehicleComparison));
  byId("finance-annual-miles").addEventListener("input", () => { mileageEdited = true; });

  function applySandbox(kind) {
    if (!latest || typeof window.setSandboxFinance !== "function") {
      byId("finance-apply-status").textContent = "This app integration is not available yet.";
      return;
    }
    const budget = kind === "budget" ? latest.payment_budget : null;
    if (kind === "apr" && (!latest.complete || !finite(latest.apr) || latest.apr < 0)) return;
    if (kind === "budget" && (!latest.complete || !finite(budget) || budget <= 0)) return;
    const response = window.setSandboxFinance(kind === "apr" || Boolean(state?.profile?.sandboxFinance), budget);
    if (!response || typeof response.ok !== "boolean") {
      byId("finance-apply-status").textContent = "The app returned an invalid apply response.";
      return;
    }
    byId("finance-apply-status").textContent = safeText(response.message, response.ok ? "Applied to your current session." : "Could not apply this setting.");
    if (!response.ok) {
      setStatus("This setting was not applied. Your current filters and valid analysis have been kept.", true);
    }
  }
  byId("finance-apply-apr").addEventListener("click", () => applySandbox("apr"));
  byId("finance-apply-budget").addEventListener("click", () => applySandbox("budget"));

  byId("finance-reserve-start").addEventListener("click", () => {
    byId("finance-reserve-form").classList.remove("hidden");
    byId("finance-transfer-review").classList.add("hidden");
    byId("finance-transfer-amount").focus();
  });
  byId("finance-transfer-source").addEventListener("change", updatePayeeOptions);
  byId("finance-reserve-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const amount = Number(byId("finance-transfer-amount").value);
    const sourceId = byId("finance-transfer-source").value;
    const payeeId = byId("finance-transfer-payee").value;
    if (!Number.isFinite(amount) || amount <= 0 || !sourceId || !payeeId || sourceId === payeeId) {
      byId("finance-status").textContent = "Enter a positive amount and choose two different fictional accounts.";
      return;
    }
    const from = accounts.find((item) => String(item.id) === sourceId);
    const to = accounts.find((item) => String(item.id) === payeeId);
    if (!from || !to || !/checking/i.test(from.type) || !/savings/i.test(to.type) ||
        from.customer_id == null || to.customer_id == null ||
        String(from.customer_id) !== String(to.customer_id)) {
      setStatus("A transfer requires a Checking source and Savings destination for the same fictional customer.", true);
      return;
    }
    transferDetails = { amount, sourceId, payeeId, from, to };
    transferKey = null;
    renderTransferReview();
  });
  function renderTransferReview() {
    const box = byId("finance-transfer-review");
    box.replaceChildren();
    box.classList.remove("hidden");
    const title = document.createElement("h4"); title.textContent = "Review before sending the sandbox request";
    const details = document.createElement("p");
    details.textContent = `${money(transferDetails.amount)} from ${transferDetails.from.nickname} (Checking) to ${transferDetails.to.nickname} (Savings) · same fictional customer · demo reserve only.`;
    const notice = document.createElement("p");
    notice.textContent = "This submits a test transfer to the selected sandbox mode. It is not real money and does not go to Toyota Financial Services.";
    const checkboxLabel = document.createElement("label");
    checkboxLabel.className = "finance-confirm";
    const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.id = "finance-transfer-confirm";
    checkboxLabel.append(checkbox, document.createTextNode(" I confirm this fictional sandbox transfer."));
    const send = document.createElement("button"); send.type = "button"; send.className = "primary-button";
    send.textContent = "Confirm test transfer";
    send.disabled = true;
    checkbox.addEventListener("change", () => { send.disabled = !checkbox.checked; });
    send.addEventListener("click", sendTransfer);
    const back = document.createElement("button"); back.type = "button"; back.className = "text-button"; back.textContent = "Edit transfer";
    back.addEventListener("click", () => box.classList.add("hidden"));
    box.append(title, details, notice, checkboxLabel, send, back);
  }
  async function sendTransfer() {
    if (transferBusy) return;
    if (!byId("finance-transfer-confirm")?.checked) {
      setStatus("Confirm the transfer explicitly before submitting.", true);
      return;
    }
    if (!config) { setStatus("Configuration is unavailable. The test transfer was not sent.", true); return; }
    if (!transferKey) {
      if (!window.crypto?.randomUUID) {
        setStatus("A secure idempotency key could not be created. The test transfer was not sent.", true);
        return;
      }
      transferKey = window.crypto.randomUUID();
    }
    transferBusy = true;
    const submittedMode = mode.value;
    const submittedScenario = scenario.value;
    mode.disabled = true;
    scenario.disabled = true;
    const buttons = byId("finance-transfer-review").querySelectorAll("button");
    buttons.forEach((button) => { button.disabled = true; });
    setStatus("Submitting explicitly confirmed sandbox transfer…");
    try {
      const data = await jsonResponse(await fetch("/api/finance/reserve", {
        method: "POST", credentials: "same-origin",
        headers: postHeaders(),
        body: JSON.stringify({
          mode: submittedMode, scenario: submittedScenario,
          source_id: transferDetails.from.id, payee_id: transferDetails.to.id,
          amount: transferDetails.amount, confirmed: true, idempotency_key: transferKey,
        }),
      }));
      if (!["completed", "pending", "unknown"].includes(data.status) || !finite(data.amount) ||
          (data.transfer_id != null && typeof data.transfer_id !== "string") ||
          (data.source_balance != null && !finite(data.source_balance)) ||
          (data.payee_balance != null && !finite(data.payee_balance))) {
        throw new Error("Transfer response is malformed. Its outcome is unknown; do not submit another transfer.");
      }
      showReceipt(data);
      if (data.status === "completed") {
        invalidateAnalysis("Transfer completed in the sandbox. Previous analysis and APR were cleared; refresh accounts for updated balances.");
        accounts = [];
        await loadAccounts();
      } else {
        transferLocked = true;
        byId("finance-reserve-start").disabled = true;
        byId("finance-reserve-form").querySelectorAll("input, select, button").forEach((control) => { control.disabled = true; });
        setStatus(`Transfer status: ${data.status}. The outcome is not confirmed; do not retry or assume success. ${safeText(data.message, "")}`, true);
      }
    } catch (error) {
      transferLocked = true;
      byId("finance-reserve-start").disabled = true;
      byId("finance-reserve-form").querySelectorAll("input, select, button").forEach((control) => { control.disabled = true; });
      showReceipt({ status: "unknown", amount: transferDetails.amount, message: error.message });
      setStatus(`${error.message || "Transfer outcome unknown."} Do not retry blindly or assume success.`, true);
    } finally {
      transferBusy = false;
      mode.disabled = false;
      scenario.disabled = false;
    }
  }
  function showReceipt(data) {
    const receipt = byId("finance-receipt");
    receipt.replaceChildren();
    receipt.classList.remove("hidden");
    const heading = document.createElement("strong");
    heading.textContent = data.status === "completed" ? "Sandbox transfer completed" :
      data.status === "pending" ? "Sandbox transfer pending" : "Sandbox transfer outcome unknown";
    const body = document.createElement("p");
    body.textContent = `${money(data.amount)} · ${safeText(data.message, data.status === "completed"
      ? "Completed in the sandbox; not real money." : "Do not assume success or retry automatically.")}`;
    receipt.append(heading, body);
    if (data.transfer_id) {
      const id = document.createElement("small"); id.textContent = `Sandbox transfer ID: ${data.transfer_id}`; receipt.append(id);
    }
    if (data.source_balance !== null && data.source_balance !== undefined) addMetric(receipt, "Source balance", money(data.source_balance));
    if (data.payee_balance !== null && data.payee_balance !== undefined) addMetric(receipt, "Destination balance", money(data.payee_balance));
  }

  function renderSummary() {
    const current = document.querySelector("#finance-summary-copy");
    if (!current) return;
    if (latest && resultSignature === currentSignature()) {
      current.textContent = `${latest.mode === "sample" ? "Built-in fictional sample" : "Nessie API sandbox"} · recommended maximum ${latest.payment_budget === null ? "unavailable" : `${money(latest.payment_budget)} / month`}. Not a TFS preapproval.`;
    } else {
      const car = state?.car;
      current.textContent = state?.profile
        ? `Selected ${car ? `Toyota ${car.name}` : "Toyota"} · open the sandbox for an affordability view. No TFS preapproval.`
        : "A fictional sample is available before the quiz. No bank connection or credit check.";
    }
    const introVisible = !document.querySelector(".intro")?.classList.contains("hidden");
    const driveVisible = !document.querySelector("#drive-shell")?.classList.contains("hidden");
    const endingVisible = !document.querySelector("#ending-shell")?.classList.contains("hidden");
    panel.classList.toggle("hidden", !state?.profile || !introVisible || driveVisible || endingVisible);
  }
  mode.addEventListener("change", () => {
    if (mode.value === "nessie" && config?.nessie_configured === false) { mode.value = "sample"; return; }
    invalidateAnalysis("Data mode changed. Previous analysis and APR were cleared.");
    byId("finance-reserve-form").classList.add("hidden");
    byId("finance-transfer-review").classList.add("hidden");
    transferKey = null; transferDetails = null;
    loadAccounts();
  });
  scenario.addEventListener("change", () => {
    invalidateAnalysis("Scenario changed. Previous analysis and APR were cleared.");
    byId("finance-reserve-form").classList.add("hidden");
    byId("finance-transfer-review").classList.add("hidden");
    transferKey = null; transferDetails = null;
    loadAccounts();
  });
  accountList.addEventListener("change", () => {
    invalidateAnalysis("Account selection changed. Previous analysis and APR were cleared.");
  });
  byId("finance-income").addEventListener("input", () => invalidateAnalysis("Income input changed. Analyze again to refresh the result."));
  dialog.addEventListener("cancel", () => {});

  function aprForProfile(profile) {
    if (!profile?.sandboxFinance || !latest?.complete || !finite(latest.apr) || latest.apr < 0 ||
        resultSignature !== currentSignature()) return null;
    return latest.apr / 100;
  }
  function render() {
    const context = `${state?.car?.id || ""}:${state?.plan?.id || ""}`;
    if (render.lastContext && context !== render.lastContext && !loading) {
      setStatus(state?.car
        ? `Vehicle context updated: Toyota ${state.car.name} · ${state?.plan?.name || "plan"}. Account inputs were left unchanged.`
        : "Vehicle context updated. Account inputs were left unchanged.");
    }
    render.lastContext = context;
    renderSummary();
    if (latest && resultSignature === currentSignature()) updateVehicleComparison();
  }
  function reset() {
    latest = null;
    resultSignature = "";
    accounts = [];
    accountsMode = "";
    accountsScenario = "";
    transferKey = null;
    transferDetails = null;
    transferLocked = false;
    byId("finance-receipt").replaceChildren();
    byId("finance-receipt").classList.add("hidden");
    byId("finance-reserve-form").classList.add("hidden");
    byId("finance-transfer-review").replaceChildren();
    byId("finance-transfer-review").classList.add("hidden");
    resultNode.classList.add("hidden");
    if (dialog.open) dialog.close();
    if (state?.profile && state.profile.sandboxFinance != null && typeof window.setSandboxFinance === "function") {
      window.setSandboxFinance(false, null);
    }
    renderSummary();
  }
  window.NessieFinance = { aprForProfile, render, reset };
  render();
  loadConfig();
})();
