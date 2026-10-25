(() => {
  const toggle = document.querySelector("#menu-toggle");
  const menu = document.querySelector("#site-menu");
  if (!toggle || !menu) return;
  window.navigateToPage = function navigateToPage(name) {
    const valid = ["home", "customization", "safety"];
    const page = valid.includes(name) ? name : "home";
    if (state.drive && !state.drive.finished) {
      if (page !== "customization") {
        cancelAnimationFrame(state.animationFrame);
        state.drive.paused = true;
        Object.keys(state.keys).forEach(key => { state.keys[key] = false; });
      } else if (state.drive.paused) {
        state.drive.paused = false;
        state.drive.lastFrame = performance.now();
        state.animationFrame = requestAnimationFrame(updateDrive);
      }
    }
    document.querySelector("#home-overview").classList.toggle("hidden", !state.profile);
    if (page === "home" && !state.profile) document.querySelector("#auth-shell").classList.remove("hidden");
    document.querySelectorAll(".page-view").forEach(section => {
      section.classList.toggle("hidden", section.dataset.view !== page);
    });
    menu.querySelectorAll("[data-page]").forEach(button => {
      if (button.dataset.page === page) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    menu.classList.add("hidden");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open navigation");
    document.title = page === "safety"
      ? "Toyota Go — Vehicle Safety & Sustainability"
      : page === "customization" ? "Toyota Go — Find Your Toyota" : "Toyota Go — To You Total Assistance";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  toggle.addEventListener("click", () => {
    const open = menu.classList.toggle("hidden") === false;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    if (open) menu.querySelector('[data-page="home"]').focus();
  });
  menu.querySelectorAll("[data-page]").forEach(button =>
    button.addEventListener("click", () => {
      if (button.dataset.page === "customization" && !state.profile) showNeeds();
      else navigateToPage(button.dataset.page);
    }));
  document.querySelector("#home-resume")?.addEventListener("click", () => {
    if (state.profile) navigateToPage("customization");
    else showNeeds();
  });
  document.querySelector("#home-safety")?.addEventListener("click", () => navigateToPage("safety"));
  document.addEventListener("click", event => {
    if (!menu.classList.contains("hidden") && !event.target.closest("#site-menu") && !event.target.closest("#menu-toggle")) {
      menu.classList.add("hidden");
      toggle.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !menu.classList.contains("hidden")) {
      menu.classList.add("hidden");
      toggle.setAttribute("aria-expanded", "false");
      toggle.focus();
    }
  });
  const brand = document.querySelector(".topbar .brand");
  brand?.addEventListener("click", event => { event.preventDefault(); navigateToPage("home"); });
})();
