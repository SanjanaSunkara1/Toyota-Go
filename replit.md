# Toyota Go

An imported, vanilla HTML/CSS/JavaScript educational Toyota exploration app.
Preserve the existing static stack and game flow; there is no database or real authentication.

## Run

Use the **Toyota Go** workflow, which runs `python3 server.py` on port 5000.
The Python standard-library server serves an explicit public-file allowlist.
No application secrets or external API services are required. Fonts and car photos
use external Google/Toyota hosts; the branding image and logo are local.

## Features and data

- Toyota Go branding and tagline: **To You Total Assistance**.
- Demo signup/login only. Passwords are not saved or sent.
- Budget/needs filters, Toyota shortlist, up to three-car comparison, payment plans and driving games.
- Instant Deal Benefit Score and five-year retained-value/net-equity scenarios.
- Safety is illustrative assist-feature coverage, not crash performance.
- Environmental comparison is tailpipe CO₂, not lifecycle emissions.
- Reliability is a maintenance-budget proxy, not measured failure rates.
- All resale, coverage and maintenance assumptions are editable educational examples.
  Do not describe them as verified brand performance or a guarantee.
- Current vehicle is assumed owned outright. Rival is a generic gasoline scenario.
- The model and all assumptions/methodology are visible in the comparison dashboard.

## Verify

`node --test tests/deal-model.test.cjs`

`python3 tests/browser_smoke.py`

The browser test requires the app workflow to be running and Playwright installed.
Use the Replit-provided Chromium via `REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE`.
