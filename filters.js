(() => {
  const byId = id => document.getElementById(id);
  const panel = document.createElement("details");
  panel.id = "results-filters";
  panel.className = "hidden";
  panel.innerHTML = '<summary>Filters <span id="active-filter-count"></span></summary><form id="results-filter-form"><div class="results-filter-grid"></div><div class="filter-actions"><button id="apply-results-filters" type="submit" class="primary-button">Apply filters</button><button id="clear-results-filters" type="button" class="skip-button">Clear filters · browse full library</button><button id="edit-contract" type="button" class="text-button">Current loan or lease details</button></div><p class="field-caption">Paint is a preference, not confirmed model/trim stock. Amounts are broad estimates; use the official model links to verify a trim and its equipment.</p></form>';
  document.querySelector(".intro").after(panel);
  const specifications = [
    ["model-filter", "Model", "model", "any"],
    ["year-filter", "Model year", "year", "any"],
    ["car-type-filter", "Body style", "body", "any"],
    ["paint-color", "Color preference", "color", "Any color"],
    ["max-price", "Maximum starting price", "max-price", "100000", [25000,30000,35000,40000,45000,50000,60000,70000,100000]],
    ["monthly-cap", "Monthly vehicle-payment cap", "monthly-cap", "2000", [250,350,450,550,650,750,1000,1500,2000]],
    ["total-funds", "Available purchase savings", "total-funds", "100000", [2000,5000,10000,12000,15000,20000,30000,50000,75000,100000]],
    ["down-payment", "Down payment", "down-payment", "0", [0,1000,2000,4000,5000,7500,10000,15000,20000,30000]],
    ["credit-tier", "Credit-score range", "credit", "unknown"],
    ["payment-preference", "Payment type", "payment", "any"],
    ["annual-miles", "Annual driving mileage", "mileage", "12000"],
    ["passengers", "Passenger capacity", "passengers", "2"],
    ["fuel-interest", "Powertrain", "powertrain", "any"],
    ["driving-style", "Driving style", "driving", "mixed"],
    ["safety-priority", "Priority", "safety", "all"],
    ["safety-assist", "Driver-assistance priority", "safety-needs", "false"],
    ["safety-space", "Room for child seats", "safety-needs", "false"],
    ["safety-awd", "All-wheel drive", "safety-needs", "false"],
  ];
  function optionsFor(id, amounts) {
    const source = byId(id);
    if (id === "model-filter") return [["any","All models"], ...[...new Map(cars.map(car => [car.family, car.name])).entries()].sort((a,b) => a[1].localeCompare(b[1]))];
    if (id === "year-filter") return [["any","All model years"], ...[...new Set(cars.map(car => car.year))].sort().map(year => [String(year),String(year)])];
    if (source.type === "checkbox") return [["false","No requirement"],["true","Required / preferred"]];
    if (amounts) return [...new Set([...amounts.map(String), source.value])].sort((a,b) => Number(a)-Number(b)).map(value => [value,dollars(Number(value))]);
    return [...source.options].map(option => [option.value,option.textContent]);
  }
  function render() {
    if (!state.profile) { panel.classList.add("hidden"); return; }
    panel.classList.toggle("hidden", document.querySelector(".intro").classList.contains("hidden"));
    const grid = panel.querySelector(".results-filter-grid");
    grid.replaceChildren();
    specifications.forEach(([id,label,key,defaultValue,amounts]) => {
      const field = document.createElement("label");
      field.className = "form-field";
      field.textContent = label;
      const select = document.createElement("select");
      select.id = `filter-${id}`;
      select.dataset.source = id;
      select.add(new Option("No preference / skip", "__skip__"));
      optionsFor(id, amounts).forEach(([value,text]) => select.add(new Option(text,value)));
      const source = byId(id);
      select.value = ToyotaWizard.skipped().includes(key) ? "__skip__" : source.type === "checkbox" ? String(source.checked) : source.value;
      field.append(select); grid.append(field);
    });
    const label = document.createElement("label");
    label.className = "form-field"; label.textContent = "Sort results";
    const sort = document.createElement("select"); sort.id = "filter-sort";
    [["recommended","Recommended"],["price-low","Price: low to high"],["price-high","Price: high to low"],["name","Model name"],["year","Newest year"]].forEach(([value,text]) => sort.add(new Option(text,value)));
    sort.value = state.resultSort || "recommended"; label.append(sort); grid.append(label);
    byId("active-filter-count").textContent = `${state.allMatches.length} matching model-year entries`;
  }
  function sortResults() {
    const sorter = {
      "price-low": (a,b) => a.price-b.price,
      "price-high": (a,b) => b.price-a.price,
      name: (a,b) => a.name.localeCompare(b.name) || b.year-a.year,
      year: (a,b) => b.year-a.year || a.name.localeCompare(b.name),
    }[state.resultSort];
    if (sorter) { state.allMatches.sort(sorter); state.matches = [...state.allMatches]; if (state.matches.length) renderCars(); }
  }
  panel.querySelector("form").addEventListener("submit", event => {
    event.preventDefault();
    const skipped = new Set(ToyotaWizard.skipped());
    specifications.forEach(([id,label,key,defaultValue]) => {
      const value = byId(`filter-${id}`).value;
      const source = byId(id);
      if (value === "__skip__") skipped.add(key); else skipped.delete(key);
      if (source.type === "checkbox") source.checked = value !== "__skip__" && value === "true";
      else source.value = value === "__skip__" ? defaultValue : value;
      source.setCustomValidity?.("");
    });
    // Checkbox preferences are tracked by their individual values, not a single shared skip flag.
    if (["safety-assist","safety-space","safety-awd"].some(id => byId(id).checked)) skipped.delete("safety-needs");
    ToyotaWizard.setSkipped([...skipped]);
    state.resultSort = byId("filter-sort").value;
    if (Number(byId("down-payment").value) > Number(byId("total-funds").value)) {
      byId("filter-down-payment").setCustomValidity("Down payment cannot exceed purchase savings.");
      byId("filter-down-payment").reportValidity(); return;
    }
    readNeedsForm();
  });
  panel.addEventListener("change", () => panel.querySelectorAll("select").forEach(control => control.setCustomValidity("")));
  byId("clear-results-filters").addEventListener("click", () => {
    const skipped = new Set(ToyotaWizard.skipped());
    specifications.forEach(([id,label,key,defaultValue]) => {
      const source = byId(id);
      if (source.type === "checkbox") source.checked = false; else source.value = defaultValue;
      source.setCustomValidity?.(""); skipped.add(key);
    });
    ToyotaWizard.setSkipped([...skipped]); state.resultSort = "name";
    readNeedsForm(); panel.open = true;
  });
  byId("edit-contract").addEventListener("click", () => { showNeeds(); ToyotaWizard.goTo("ownership"); });
  document.addEventListener("toyota:matches", () => { sortResults(); render(); });
  window.ResultsFilters = {
    render,
    open() { render(); panel.open = true; panel.scrollIntoView({behavior:"smooth",block:"start"}); },
    hide() { panel.classList.add("hidden"); },
  };
})();
