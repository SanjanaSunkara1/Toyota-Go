(() => {
  const tagline = "Move Freely. Live Fully";
  const logoPath = "assets/toyota-logo.svg";
  const photoPath = "attached_assets/0_Screen_Shot_2026-10-25_at_12.55.02_AM_1792907721806.png";

  document.title = "Toyota Go — Move Freely. Live Fully";
  const description = "Explore affordable, safe and sustainable Toyota choices with friendly guidance and a hands-on driving experience.";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#c9141d");
  document.querySelector('meta[name="description"]')?.setAttribute("content", description);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", "Toyota Go — Move Freely. Live Fully");
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);

  document.querySelectorAll(".brand").forEach((brand) => {
    brand.setAttribute("aria-label", "Toyota Go home");
    brand.innerHTML = `<img class="brand-logo" src="${logoPath}" alt="Toyota logo"><span>Toyota Go</span>`;
  });

  const topNote = document.querySelector(".top-note");
  if (topNote) topNote.textContent = tagline;

  const footerBrand = document.querySelector("footer span:first-child");
  if (footerBrand) footerBrand.textContent = "Toyota Go";
  const footerCopy = document.querySelector("footer span:last-child");
  if (footerCopy) {
    footerCopy.textContent = "Move Freely. Live Fully · Explore affordable, safe and sustainable choices. Independent educational demo; not affiliated with Toyota Motor Corporation.";
  }

  const authCopy = document.querySelector(".auth-copy");
  if (authCopy) authCopy.textContent = "Sign in or create an account to explore Toyota choices that fit your budget, priorities, and the way you drive.";
  const authArt = document.querySelector(".auth-art");
  const resultsArt = document.querySelector(".hero-art");
  if (resultsArt) {
    const photo = document.createElement("img");
    photo.className = "result-hero-photo";
    photo.src = "attached_assets/image_1792909171658.png";
    photo.alt = "White Toyota SUV driving through a sunlit trail";
    resultsArt.replaceChildren(photo);
    resultsArt.setAttribute("aria-label", "Toyota SUV on a sunlit trail");
  }
  if (authArt) {
    authArt.replaceChildren();
    const photo = document.createElement("img");
    photo.className = "auth-building-photo";
    photo.src = photoPath;
    photo.alt = "Toyota logo and lettering on a dealership building";
    const story = document.createElement("div");
    story.className = "auth-brand-story";
    story.innerHTML = `<span>TOYOTA GO</span><strong>${tagline}</strong><p>A friendly place to compare affordable, safe and more sustainable ways to get moving.</p>`;
    authArt.append(photo, story);
    authArt.setAttribute("aria-label", "Toyota dealership building");
  }

  // game.js updates this heading when the sign-in tab is selected.
  const updateAuthTitle = () => {
    const title = document.querySelector("#auth-title");
    if (title && title.textContent.includes("Toyota Match")) {
      title.innerHTML = "Welcome back to<br><em>Toyota Go.</em>";
    }
  };
  updateAuthTitle();
  const title = document.querySelector("#auth-title");
  if (title) new MutationObserver(updateAuthTitle).observe(title, { childList: true, subtree: true, characterData: true });
})();
