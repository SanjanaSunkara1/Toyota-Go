(() => {
  const home = document.querySelector("#home-page");
  const overview = document.querySelector("#home-overview");
  if (!home || !overview || home.querySelector(".home-dealership-hero")) return;
  overview.classList.remove("hidden");

  const figure = document.createElement("figure");
  figure.className = "home-dealership-hero";
  figure.setAttribute("aria-label", "A couple reviews financing options with a Toyota dealership advisor");

  const image = document.createElement("img");
  image.src = "attached_assets/Two-people-in-a-dealership-showroom-sitting-with-a-finance-ad_1792913602649.avif";
  image.alt = "A couple sits with a dealership advisor to review vehicle financing in a Toyota showroom.";
  image.width = 1920;
  image.height = 640;
  image.loading = "eager";
  image.fetchPriority = "high";

  figure.append(image);
  home.insertBefore(figure, overview);
})();
