// Educational feature concepts, based on Toyota's Safety Hub. Never vehicle/sensor software.
(() => {
  const section = document.querySelector(".safety-demo-section");
  if (!section) return;
  const versions = ["4.0","3.0","2.5 & 2.5+","2.0","TSS-P","TSS-C"];
  const definitions = {
    vehicle: ["Pre-Collision System · vehicle ahead", "Helps reduce the risk or severity of some frontal collisions by warning and, in supported circumstances, braking.", "Detection and braking have limits; the driver must remain attentive and brake when needed."],
    pedestrian: ["Pre-Collision System · pedestrian", "Can warn and provide emergency braking for a detected pedestrian under supported conditions.", "It cannot detect every person or prevent every collision; visibility, speed and generation matter."],
    bicycle: ["Pre-Collision System · bicyclist", "Can help reduce collision risk with a detected bicyclist in supported circumstances.", "Recognition depends on conditions and equipment; always watch for cyclists and be ready to brake."],
    motorcycle: ["Pre-Collision System · motorcyclist", "Newer supported systems can warn and provide emergency braking for a detected motorcyclist.", "This is a simplified concept, not a promise of detection or an avoidance test."],
    drcc: ["Dynamic Radar Cruise Control", "Helps maintain a preset following distance as a detected vehicle ahead changes speed.", "Intended for appropriate highway use; it is not collision avoidance or hands-free driving."],
    lda: ["Lane Departure Alert", "Warns about an unintended lane departure when supported lane markings or boundaries are recognized.", "Steering assistance is generation- and vehicle-dependent; keep control and check your surroundings."],
    lta: ["Lane Tracing Assist", "With supported cruise control and detected lanes, helps keep the vehicle centered in its lane.", "This is driving assistance, not autonomous steering; keep your hands on the wheel."],
    rsa: ["Road Sign Assist", "Recognizes supported signs and displays their information to improve driver awareness.", "It does not replace reading signs or automatically guarantee the correct speed."],
    ahb: ["Automatic High Beams", "Can switch between high and low beams when supported oncoming or preceding vehicle lights are detected.", "This helps visibility and reduces glare, but the driver remains responsible for safe lighting."],
    pda: ["Proactive Driving Assist", "Can provide gentle braking or steering support for distance control and supported driving tasks.", "It is not a substitute for the Pre-Collision System or active driver control."],
    edss: ["Emergency Driving Stop System", "Under supported Lane Tracing Assist conditions, can prompt an unresponsive driver and bring the vehicle to a stop.", "Availability and operating conditions vary; it is not a medical monitor or a substitute for attentive driving."],
  };
  let version = "4.0", feature = "pedestrian", frame = 0, running = false;
  section.innerHTML = `<p class="eyebrow">INTERACTIVE LEARNING DEMOS</p><h2 id="safety-demo-title">Toyota Safety Sense™</h2>
    <p>Choose a generation and a feature to explore its purpose. Equipment and operating conditions vary by model year and trim; check the exact vehicle’s owner’s manual.</p>
    <div id="tss-generation-tabs" role="tablist" aria-label="Toyota Safety Sense generation">${versions.map((item,index) => `<button type="button" role="tab" data-tss-version="${item}" aria-selected="${index===0}">${item.startsWith("TSS") ? item : `TSS ${item}`}</button>`).join("")}</div>
    <label class="form-field">Explore a feature / situation<select id="tss-feature-select"></select></label>
    <h3 id="tss-feature-title"></h3><p id="tss-feature-description"></p>
    <div id="tss-demo-scene"></div>
    <div class="safety-demo-controls"><button id="run-safety-simulation" type="button" class="primary-button">Run this simulation</button><button id="reset-safety-simulation" type="button" class="skip-button">Reset</button><span id="safety-simulation-status" role="status" aria-live="polite"></span></div>
    <p class="field-caption">Illustrative 2D feature concepts only—not an exhaustive set of road situations, a sensor test, Toyota software, or a guarantee of collision avoidance. Some equipment is available rather than standard. <a href="https://www.toyota.com/safety-sense/" target="_blank" rel="noopener noreferrer">Source: Toyota Safety Hub ↗</a></p>`;
  const byId = id => document.getElementById(id);
  function available() {
    const modern = version === "4.0" || version === "3.0";
    const laneSuite = !["TSS-P","TSS-C"].includes(version);
    return ["vehicle", ...(version !== "TSS-C" ? ["pedestrian"] : []),
      ...(laneSuite ? ["bicycle"] : []), ...(modern ? ["motorcycle"] : []),
      ...(version !== "TSS-C" ? ["drcc"] : []), "lda", ...(laneSuite ? ["lta","rsa"] : []), "ahb",
      ...(modern ? ["pda","edss"] : [])];
  }
  const auto = (id,x,y,color) => `<g id="${id}" transform="translate(${x} ${y})"><rect x="-25" y="-43" width="50" height="86" rx="12" fill="${color}" stroke="#fff" stroke-width="2"/><rect x="-18" y="-24" width="36" height="22" rx="4" fill="#d8e5e7"/><rect x="-18" y="15" width="36" height="14" rx="3" fill="#b1c4cc"/><circle cx="-18" cy="-37" r="3" fill="#fbe9ad"/><circle cx="18" cy="-37" r="3" fill="#fbe9ad"/></g>`;
  function scene() {
    const night = feature === "ahb";
    let target = "";
    if (["vehicle","drcc","lta","pda"].includes(feature)) target = auto("tss-target",410,55,"#a3b5bd");
    if (feature === "ahb") target = auto("tss-target",500,40,"#9cadbd");
    if (["pedestrian","bicycle","motorcycle"].includes(feature)) {
      target = `<g id="tss-target" transform="translate(295 100)">
        ${feature !== "pedestrian" ? '<circle cx="-17" cy="16" r="12" fill="none" stroke="#243c42" stroke-width="4"/><circle cx="18" cy="16" r="12" fill="none" stroke="#243c42" stroke-width="4"/><path d="m-17 16 15-20 20 20H-17L-5-10" fill="none" stroke="#496e82" stroke-width="4"/>' : ""}
        <circle cy="-25" r="8" fill="#263d43"/><path d="M0-15v25m0-17-12 12m12-12 12 12M0 10-10 28M0 10 12 28" stroke="#263d43" stroke-width="5" fill="none" stroke-linecap="round"/></g>`;
    }
    byId("tss-demo-scene").innerHTML = `<svg viewBox="0 0 840 320" role="img" aria-labelledby="tss-scene-title tss-scene-desc"><title id="tss-scene-title">${insightEscape(definitions[feature][0])}</title><desc id="tss-scene-desc">Top-down illustrative roadway. Run the simulation to see this driver-assistance concept.</desc>
      <rect width="840" height="320" fill="${night ? "#172734" : "#e1e7df"}"/>
      <rect x="265" width="310" height="320" fill="${night ? "#263844" : "#66716f"}"/>
      <path d="M285 0V320M555 0V320" stroke="#f3f0d9" stroke-width="5"/><path d="M465 0V320" stroke="#f3f0d9" stroke-width="3" stroke-dasharray="24 18"/>
      ${feature === "pedestrian" ? '<path d="M290 100h250m-250 13h250m-250 13h250" stroke="#fff" stroke-width="6" opacity=".5"/>' : ""}
      ${feature === "pda" ? '<path d="M400 310C400 170 430 80 545 0" stroke="#d1d7cf" stroke-width="6" fill="none" stroke-dasharray="16 9"/>' : ""}
      <path id="tss-lane-highlight" d="M320 0V320M455 0V320" fill="none" stroke="#a5e9d1" stroke-width="5" opacity="0"/>
      <path id="tss-gap" d="M410 90V165" stroke="#a5e9d1" stroke-width="4" stroke-dasharray="7 6" opacity="0"/>
      <polygon id="tss-beams" points="390,185 370,20 450,20 430,185" fill="#fff5ad" opacity="${night ? ".3" : "0"}"/>
      ${target}${auto("tss-ego",410,240,"#b81c27")}
      <g id="tss-road-sign" transform="translate(610 90)"><rect x="-26" y="-35" width="52" height="66" rx="5" fill="white" stroke="#45574f" stroke-width="2"/><text x="0" y="-17" text-anchor="middle" font-size="9">SPEED</text><text x="0" y="14" text-anchor="middle" font-size="27" font-weight="bold">40</text></g>
      <rect x="18" y="18" width="220" height="95" rx="7" fill="${night ? "#2a3e4c" : "#f9faf5"}"/><text x="34" y="43" font-size="12" fill="${night ? "white" : "#394e44"}">ILLUSTRATIVE DRIVER DISPLAY</text><text id="tss-display" x="34" y="76" font-size="17" fill="${night ? "#f9e4a4" : "#394e44"}">Ready</text>
      <text x="598" y="275" font-size="11" fill="${night ? "#f5f5ef" : "#394e44"}">Not a performance test</text>
      </svg>`;
    byId("safety-simulation-status").textContent = "Ready · press Run to explore the selected concept.";
    byId("tss-demo-scene").dataset.state = "ready";
  }
  function stop() {
    cancelAnimationFrame(frame); running = false;
    byId("run-safety-simulation").disabled = false;
  }
  function showFeature() {
    stop();
    const [title, first, second] = definitions[feature];
    byId("tss-feature-title").textContent = title;
    byId("tss-feature-description").replaceChildren(document.createTextNode(first),document.createElement("br"),document.createTextNode(second));
    scene();
  }
  function chooseVersion() {
    const options = available();
    if (!options.includes(feature)) feature = options[0];
    byId("tss-feature-select").replaceChildren(...options.map(key => new Option(definitions[key][0],key)));
    byId("tss-feature-select").value = feature;
    section.querySelectorAll("[data-tss-version]").forEach(button => button.setAttribute("aria-selected",String(button.dataset.tssVersion === version)));
    showFeature();
  }
  function renderFrame(progress) {
    const ego = byId("tss-ego"), target = byId("tss-target"), display = byId("tss-display");
    let x = 410, y = 240, rotation = 0, text = "Driver attentive", message = "The illustrative scenario is running.";
    const ease = 1-Math.pow(1-progress,3);
    if (["vehicle","pedestrian","bicycle","motorcycle"].includes(feature)) {
      y -= 90 * ease;
      if (feature !== "vehicle") target.setAttribute("transform",`translate(${295 + 115*Math.min(1,progress*2)} 100)`);
      text = progress < .35 ? "Object ahead" : progress < .7 ? "Warning · braking" : "Modeled stop";
      message = progress < .35 ? "A supported target enters the modeled path." : progress < .7 ? "The conceptual system warns and brakes." : "The illustrative vehicle stopped. Detection and real-world outcomes are not guaranteed.";
    } else if (feature === "drcc") {
      y -= 55*ease; target.setAttribute("transform",`translate(410 ${55-12*ease})`);
      byId("tss-gap").setAttribute("opacity","1");
      text = progress < .4 ? "Lead vehicle slows" : "Following gap held";
      message = "Speed adapts in the model to support a preset following distance; the driver still controls the vehicle.";
    } else if (feature === "lda") {
      const warningOnly = version === "TSS-C";
      x += progress < .5 ? progress*135 : warningOnly ? 67 : (1-progress)*135;
      y -= 35*progress; byId("tss-lane-highlight").setAttribute("opacity",progress>.3?".8":"0");
      text = progress < .35 ? "Unintended drift" : warningOnly ? "Lane warning" : "Warning · steering support";
      message = warningOnly ? "The model warns about a lane departure; this generation demo does not apply steering correction." : "A lane warning and supported gentle corrective steering are illustrated. This is not hands-free driving.";
    } else if (feature === "lta") {
      x += Math.sin(progress*Math.PI*3)*20*(1-progress); y -= 45*progress;
      byId("tss-lane-highlight").setAttribute("opacity",".8"); text = "Lane-centering support";
      message = "With supported cruise control and detected lanes, assistance supports lane centering while the driver steers.";
    } else if (feature === "rsa") {
      y -= 70*progress; text = progress < .4 ? "Reading supported sign" : "Speed limit: 40";
      byId("tss-road-sign").setAttribute("opacity",progress>.4?"1":".6");
      message = "A detected sign is displayed. The model does not change vehicle speed in response to the sign.";
    } else if (feature === "ahb") {
      y -= 25*progress; target.setAttribute("transform",`translate(500 ${40+120*progress}) rotate(180)`);
      byId("tss-beams").setAttribute("points",progress<.45?"390,185 350,15 470,15 430,185":"390,190 380,135 440,135 430,190");
      text = progress < .45 ? "High beams" : "Low beams";
      message = "The model switches to low beams as oncoming lights approach, illustrating glare reduction.";
    } else if (feature === "pda") {
      x += 60*ease*ease; y -= 85*ease; rotation = 25*ease;
      text = progress < .35 ? "Approaching curve" : "Gentle driving support";
      message = "Gentle braking or steering support is illustrated through a curve. This is distinct from emergency collision braking.";
    } else if (feature === "edss") {
      y -= 85*ease; text = progress < .35 ? "Resume control" : progress < .7 ? "Driver prompts" : "Controlled modeled stop";
      ego.setAttribute("opacity",progress>.65 && Math.floor(progress*30)%2 ? ".65" : "1");
      message = "In this supported concept, unanswered driver prompts are followed by a controlled stop. Actual availability and conditions vary.";
    }
    ego.setAttribute("transform",`translate(${x} ${y}) rotate(${rotation})`);
    display.textContent = text;
    if (byId("safety-simulation-status").textContent !== message) byId("safety-simulation-status").textContent = message;
  }
  byId("run-safety-simulation").addEventListener("click", () => {
    if (running) return;
    scene(); running = true; byId("run-safety-simulation").disabled = true;
    byId("tss-demo-scene").dataset.state = "running";
    const start = performance.now(), reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    function tick(time) {
      const progress = reduced ? 1 : Math.min(1,(time-start)/4000);
      renderFrame(progress);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else { stop(); byId("tss-demo-scene").dataset.state = "complete"; }
    }
    frame = requestAnimationFrame(tick);
  });
  byId("reset-safety-simulation").addEventListener("click", showFeature);
  byId("tss-feature-select").addEventListener("change", event => { feature = event.target.value; showFeature(); });
  section.querySelectorAll("[data-tss-version]").forEach(button => button.addEventListener("click", () => { version = button.dataset.tssVersion; chooseVersion(); }));
  section.querySelectorAll('[role="tab"]').forEach((button,index,tabs) => button.addEventListener("keydown",event => {
    if (!["ArrowLeft","ArrowRight","Home","End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length-1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length)%tabs.length;
    tabs[next].focus(); tabs[next].click();
  }));
  chooseVersion();
})();
