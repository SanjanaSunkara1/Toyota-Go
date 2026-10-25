(() => {
  const needsForm = document.querySelector("#needs-form");
  const screens = document.querySelector("#question-wizard");
  if (!needsForm || !screens) return;
  const byId = id => document.getElementById(id);
  let steps = [];
  let current = 0;
  const skipped = new Set();
  needsForm.noValidate = true;

  function addFieldsetQuestion(id, title, nodes, key, condition = () => true) {
    steps.push({ id, title, nodes: nodes.filter(Boolean), key, condition });
  }

  function buildQuestions() {
    steps = [];
    addFieldsetQuestion("body", "Choose a body style", [byId("customization-fields").querySelector('label[for="car-type-filter"]') || byId("car-type-filter").closest("label")], "body");
    addFieldsetQuestion("color", "Choose a paint color", [byId("paint-color").closest("label"), ...byId("customization-fields").querySelectorAll(".field-caption")], "color");

    const budget = [...document.querySelectorAll(".finance-card > label")];
    addFieldsetQuestion("price", "Set your maximum vehicle price", [budget[0]], "max-price");
    addFieldsetQuestion("payment-cap", "Set a comfortable monthly payment", [budget[1]], "monthly-cap");
    addFieldsetQuestion("savings", "Set the savings available for your purchase", [budget[2]], "total-funds");
    addFieldsetQuestion("down-payment", "Choose a planned down payment", [budget[3]], "down-payment");
    addFieldsetQuestion("credit", "Choose a credit-score range, if you want", [budget[4], document.querySelector(".credit-note")], "credit");
    addFieldsetQuestion("plan", "How would you like to pay?", [budget[5]], "payment");
    addFieldsetQuestion("mileage", "How much do you drive each year?", [budget[6]], "mileage");

    const vehicle = byId("vehicle-preference-fields");
    const loan = byId("current-loan-fields"), lease = byId("current-lease-fields");
    addFieldsetQuestion("ownership", "Do you currently have a car loan or lease?", [vehicle.querySelector(":scope > label:first-of-type")], "ownership");
    addFieldsetQuestion("trade-intent", "Might you trade in your current vehicle?", [byId("trade-intent-field")], "trade", () => byId("current-vehicle-status").value !== "none");
    [...loan.querySelectorAll(":scope > label")].forEach((node, index) =>
      addFieldsetQuestion(`loan-${index}`, node.querySelector("input")?.labels?.[0]?.textContent || node.textContent.trim(), [node], `loan-${index}`, () => byId("current-vehicle-status").value === "loan"));
    [...lease.querySelectorAll(":scope > label")].forEach((node, index) =>
      addFieldsetQuestion(`lease-${index}`, node.querySelector("input")?.labels?.[0]?.textContent || node.textContent.trim(), [node], `lease-${index}`, () => byId("current-vehicle-status").value === "lease"));

    const safety = [...document.querySelectorAll('.needs-card:not(.finance-card)')];
    const safetySelect = safety[0]?.querySelector("label");
    const safetyChecks = safety[0]?.querySelectorAll(".check-row");
    addFieldsetQuestion("safety", "What matters most for safety and confidence?", [safetySelect, safety[0]?.querySelector(".field-caption")], "safety");
    addFieldsetQuestion("safety-needs", "Which safety and space preferences matter?", [...(safetyChecks || [])], "safety-needs");
    const everyday = safety[1]?.querySelectorAll("label") || [];
    addFieldsetQuestion("passengers", "How many people usually ride with you?", [everyday[0]], "passengers");
    addFieldsetQuestion("driving", "Where and how do you drive?", [everyday[1]], "driving");
    addFieldsetQuestion("powertrain", "What powertrain would you like to explore?", [everyday[2]], "powertrain");

    const custom = byId("customization-fields");
    const bodyIndex = steps.findIndex(s => s.id === "body");
    const colorIndex = steps.findIndex(s => s.id === "color");
    steps[bodyIndex].nodes = [byId("car-type-filter").closest("label")];
    steps[colorIndex].nodes = [byId("paint-color").closest("label"), ...custom.querySelectorAll(".field-caption")];
    vehicle.classList.remove("hidden");
    loan.classList.remove("hidden");
    lease.classList.remove("hidden");
    custom.classList.remove("hidden");
    document.querySelector(".needs-grid").classList.add("hidden");
    vehicle.classList.add("hidden");
    loan.classList.add("hidden");
    lease.classList.add("hidden");
    custom.classList.add("hidden");
    screens.replaceChildren();
    for (const step of steps) {
      const article = document.createElement("section");
      article.className = "question-step hidden";
      article.dataset.question = step.id;
      article.setAttribute("aria-label", step.title);
      const heading = document.createElement("div");
      heading.className = "question-heading";
      const caption = document.createElement("span");
      caption.textContent = step.title;
      const skip = document.createElement("button");
      skip.className = "question-skip";
      skip.type = "button";
      skip.textContent = "Skip";
      skip.setAttribute("aria-label", `Skip ${step.title}`);
      skip.addEventListener("click", () => { skipQuestion(step); render(); });
      heading.append(caption, skip);
      article.append(heading);
      step.nodes.forEach(node => { if (node) article.append(node); });
      screens.append(article);
    }
    const existing = steps.findIndex(s => s.id === "ownership");
    if (existing >= 0) current = existing;
  }

  const skipDefaults = {
    body: ["car-type-filter", "any"], color: ["paint-color", "Any color"],
    "max-price": ["max-price", "100000"], "monthly-cap": ["monthly-cap", "2000"],
    "total-funds": ["total-funds", "100000"], "down-payment": ["down-payment", "0"],
    credit: ["credit-tier", "unknown"], payment: ["payment-preference", "any"],
    mileage: ["annual-miles", "12000"], ownership: ["current-vehicle-status", "none"],
    trade: ["trade-intent", "no"], "loan-0": ["current-loan-payment", ""],
    "loan-1": ["current-loan-balance", ""], "loan-2": ["current-vehicle-value", ""],
    "loan-3": ["current-loan-apr", ""], "loan-4": ["current-loan-term", ""], "loan-5": ["current-loan-mileage", ""],
    "lease-0": ["current-lease-payment", ""], "lease-1": ["lease-maturity", ""],
    "lease-2": ["lease-current-mileage", ""], "lease-3": ["lease-allowed-mileage", ""],
    "lease-4": ["lease-residual", ""], "lease-5": ["lease-overage-rate", ""], safety: ["safety-priority", "all"],
    passengers: ["passengers", "2"], driving: ["driving-style", "mixed"],
    powertrain: ["fuel-interest", "any"],
  };

  function visibleSteps() { return steps.filter(step => step.condition()); }
  function pageQuestions() { return visibleSteps().slice(current * 3, current * 3 + 3); }
  function pageCount() { return Math.ceil(visibleSteps().length / 3); }
  function skipQuestion(step) {
    skipped.add(step.key);
    const defaults = skipDefaults[step.key];
    if (defaults) byId(defaults[0]).value = defaults[1];
    if (step.id === "safety-needs") screens.querySelectorAll('.check-row input[type="checkbox"]').forEach(input => { input.checked = false; });
    step.nodes.forEach(node => node.querySelectorAll?.("input").forEach(input => input.setCustomValidity("")));
  }
  function render() {
    const visible = visibleSteps();
    current = Math.min(current, Math.ceil(visible.length / 3) - 1);
    const group = pageQuestions();
    [...screens.children].forEach(node => {
      node.classList.toggle("hidden", !group.some(step => step.id === node.dataset.question));
      const configuration = steps.find(item => item.id === node.dataset.question);
      node.classList.toggle("question-skipped", skipped.has(configuration.key));
      node.querySelector(".question-skip").textContent = skipped.has(configuration.key) ? "Skipped" : "Skip";
      node.querySelectorAll("input,select").forEach(input => { input.disabled = !configuration.condition(); });
    });
    const pos = current + 1;
    byId("wizard-step-label").textContent = `Step ${pos} of ${pageCount()}`;
    byId("wizard-step-title").textContent = current === 0 ? "Start with your preferences" : "A little more about your needs";
    byId("wizard-progress-fill").style.width = `${pos / pageCount() * 100}%`;
    byId("wizard-back").disabled = current === 0;
    byId("wizard-skip").hidden = false;
    byId("wizard-skip").textContent = "Skip these questions";
    byId("wizard-next").textContent = current === pageCount() - 1 ? "Find my Toyota matches" : "Next";
    byId("wizard-next").setAttribute("aria-label", byId("wizard-next").textContent);
  }
  function moveNext(skip = false) {
    const group = pageQuestions();
    if (skip) group.forEach(skipQuestion);
    byId("down-payment").setCustomValidity("");
    for (const step of group) {
      const screen = [...screens.children].find(node => node.dataset.question === step.id);
      for (const control of screen.querySelectorAll("input,select")) {
        if (!control.checkValidity()) { control.reportValidity(); return; }
      }
    }
    if (group.some(step => step.id === "down-payment") && Number(byId("down-payment").value) > Number(byId("total-funds").value)) {
      byId("down-payment").setCustomValidity("The planned down payment cannot exceed your available savings.");
      byId("down-payment").reportValidity(); return;
    }
    if (current === pageCount() - 1) {
      if (Number(byId("down-payment").value) > Number(byId("total-funds").value)) {
        current = Math.floor(visibleSteps().findIndex(step => step.id === "down-payment") / 3);
        render(); byId("down-payment").focus(); return;
      }
      readNeedsForm(); return;
    }
    current = Math.min(current + 1, pageCount() - 1);
    render();
    const active = screens.querySelector(".question-step:not(.hidden)");
    active?.querySelector("input:not([type=checkbox]):not([type=radio]),select")?.focus({ preventScroll: true });
  }
  needsForm.addEventListener("submit", event => {
    event.preventDefault();
    moveNext(false);
  });
  byId("wizard-next").addEventListener("click", () => moveNext(false));
  byId("wizard-skip").addEventListener("click", () => moveNext(true));
  byId("wizard-back").addEventListener("click", () => { current = Math.max(0, current - 1); render(); });
  needsForm.addEventListener("input", event => {
    event.target.setCustomValidity?.("");
    const question = event.target.closest("[data-question]");
    if (question) {
      skipped.delete(steps.find(step => step.id === question.dataset.question).key);
      question.classList.remove("question-skipped");
      question.querySelector(".question-skip").textContent = "Skip";
    }
  });
  byId("current-vehicle-status").addEventListener("change", () => {
    byId("current-loan-fields").classList.toggle("hidden", byId("current-vehicle-status").value !== "loan");
    byId("current-lease-fields").classList.toggle("hidden", byId("current-vehicle-status").value !== "lease");
    render();
  });
  document.querySelectorAll(".check-row input[type=checkbox]").forEach(input => {
    input.closest(".check-row")?.setAttribute("data-wizard-checkbox", "true");
  });
  buildQuestions();
  current = 0;
  render();
  window.ToyotaWizard = {
    reset() { skipped.clear(); current = 0; render(); },
    restart() { current = 0; render(); },
    skipped() { return [...skipped]; },
    setSkipped(keys) { skipped.clear(); keys.forEach(key => skipped.add(key)); },
    goTo(id) { current = Math.floor(visibleSteps().findIndex(step => step.id === id) / 3); render(); },
    finish: () => needsForm.requestSubmit(),
  };
})();
