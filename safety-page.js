(() => {
  const grid = document.querySelector("#electric-grid");
  const colors = ["#37597a", "#60745b", "#536a7b", "#a95751"];
  function powerType(car) {
    return car.fcev ? "fcev" : car.phev ? "phev" : car.ev ? "ev" : car.hybrid ? "hybrid" : "gas";
  }
  function renderElectric(filter = "all") {
    if (!grid) return;
    const models = cars.filter(car => car.ev || car.hybrid || car.fcev)
      .filter(car => filter === "all" || powerType(car) === filter);
    grid.innerHTML = models.length ? models.map((car, index) => {
      const kind = powerType(car);
      const kindName = { ev: "Battery electric", phev: "Plug-in hybrid", hybrid: "Hybrid", fcev: "Fuel cell" }[kind];
      const range = car.epa;
      const img = car.images[0];
      return `<article class="electric-card">
        <div class="electric-photo"><img src="${img}" alt="Toyota ${insightEscape(car.name)}" loading="lazy" onerror="this.hidden=true"><span class="electric-type">${kindName}</span></div>
        <div class="electric-copy"><small>${car.type.split(" · ")[0]} MODEL YEAR</small><h3>Toyota ${insightEscape(car.name)}</h3>
          <p>${insightEscape(car.subtitle)}</p><div class="electric-facts"><strong>${dollars(car.price)}</strong><span>${insightEscape(range)}</span></div>
          <a href="${car.url}" target="_blank" rel="noopener noreferrer">Explore official details ↗</a>
          <button type="button" class="electric-choose" data-model="${car.id}">Choose this Toyota</button>
        </div>
      </article>`;
    }).join("") : '<p class="insight-empty">No current model in this powertrain category. See Toyota for current availability.</p>';
    grid.querySelectorAll(".electric-choose").forEach(button => button.addEventListener("click", () => {
      const car = cars.find(item => item.id === button.dataset.model);
      if (!car) return;
      navigateToPage("customization");
      if (state.profile) {
        const match = cars.find(item => item.id === car.id);
        state.car = match;
        state.allMatches = [match, ...state.allMatches.filter(item => item.id !== match.id)];
        state.matches = [match, ...state.matches.filter(item => item.id !== match.id)];
        renderSetup();
        document.querySelector(".intro").classList.remove("hidden");
        document.querySelector(".game-shell").classList.remove("hidden");
        document.querySelector(".needs-shell").classList.add("hidden");
      } else {
        document.querySelector("#fuel-interest").value = car.ev || car.fcev ? "hybrid" : "any";
        showNeeds();
      }
    }));
  }
  document.querySelectorAll(".electric-tabs [data-power]").forEach(tab => tab.addEventListener("click", () => {
    document.querySelectorAll(".electric-tabs [data-power]").forEach(button => button.setAttribute("aria-selected", String(button === tab)));
    renderElectric(tab.dataset.power);
  }));
  const facts = [
    ["The Toyota Environmental Challenge 2050 is a set of six environmental challenges announced in 2015. It is a long-term aspiration, not a statement that the targets have been achieved.", "https://www.toyota.com/2050challenge/", "Toyota Environmental Challenge 2050"],
    ["Toyota's North American environmental plan states a goal of carbon neutrality at its North American facilities by 2035.", "https://www.toyota.com/usa/environmentalsustainability/goals-and-targets", "Toyota North American goals & targets"],
    ["Toyota's stated U.S. goal is for electrified vehicles to account for 70% of new Toyota/Lexus vehicle sales by unit in 2030. This is a target, not a reported result.", "https://www.toyota.com/usa/environmentalsustainability/goals-and-targets", "Toyota North American goals & targets"],
    ["Toyota describes a 2050 challenge to reduce average new-vehicle operating CO₂ emissions by 90% from 2010 levels. This is a company goal, not a measured promise for any one vehicle.", "https://www.toyota.com/2050challenge/", "Toyota Environmental Challenge 2050"],
  ];
  let factIndex = 0;
  function showFact() {
    const [text, url, title] = facts[factIndex++ % facts.length];
    const target = document.querySelector("#sustainability-fact");
    if (!target) return;
    target.textContent = text;
    document.querySelector("#sustainability-source").innerHTML = `Source: <a href="${url}" target="_blank" rel="noopener noreferrer">${title} ↗</a>`;
  }
  document.querySelector("#next-sustainability-fact")?.addEventListener("click", showFact);
  showFact();
  renderElectric();

  const scene = document.querySelector(".safety-demo-car");
  const detection = document.querySelector(".detection-pulse");
  const run = document.querySelector("#run-safety-simulation");
  const reset = document.querySelector("#reset-safety-simulation");
  const status = document.querySelector("#safety-simulation-status");
  let animationTimer;
  function restore() {
    clearTimeout(animationTimer);
    scene?.classList.remove("simulating", "stopped");
    detection?.classList.remove("active");
    if (run) run.disabled = false;
    if (status) status.textContent = "Ready · follow the marked crossing.";
  }
  run?.addEventListener("click", () => {
    restore();
    run.disabled = true;
    status.textContent = "Illustrative scenario: a pedestrian enters the marked crossing; the vehicle slows in the model.";
    requestAnimationFrame(() => {
      scene?.classList.add("simulating");
      detection?.classList.add("active");
    });
    animationTimer = setTimeout(() => {
      scene?.classList.remove("simulating");
      scene?.classList.add("stopped");
      status.textContent = "The illustrative vehicle stopped before the crossing. Real-world outcomes vary; remain attentive and never rely on driver-assistance features alone.";
      run.disabled = false;
    }, 1450);
  });
  reset?.addEventListener("click", restore);
})();
