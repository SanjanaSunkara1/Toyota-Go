# Toyota Go

An imported, vanilla HTML/CSS/JavaScript educational Toyota exploration app.
Preserve the existing static stack and game flow; there is no database or real authentication.

## Run

Use the **Toyota Go** workflow, which runs `python3 server.py` on port 5000.
The Python standard-library server serves an explicit public-file allowlist.
No application secrets or external API services are required. Fonts and car photos
use external Google/Toyota hosts; the branding image and logo are local.

## Features and data

- Toyota Go branding and tagline: **Move Freely. Live Fully**.
- Demo signup/login only. Passwords are not saved or sent.
- Budget/needs filters, Toyota shortlist, up to three-car comparison, payment plans and driving games.
- Skippable grouped preferences (up to three questions per card), with body style,
  paint preference, exact seating capacity and mileage questions.
- Full 43-entry U.S. model-year manufacturer catalog snapshot, sourced from Toyota's
  all-vehicles page on October 25, 2026. Not a live dealer inventory feed.
- Results show all matches, with dropdown filters for model, year, type, finance,
  powertrain and capacity, plus sorting. Paint is not a verified stock filter.
- Conditional current loan/lease questions; estimated current equity, payment baseline,
  lease maturity, and already-incurred mileage overage using the customer's optional contract rate.
- Home, Customization, and Vehicle Safety & Sustainability navigation.
- Public illustrative 2D TSS generation/feature animations, sourced IIHS model-year awards, electrified-model
  exploration, and Toyota environmental facts/goals with source links.
- Warm neutral styling with requested Toyota red accents for key actions, headings,
  comparison state, annual-value table headings and selected safety titles.
- Insurance comparison uses official quote-site links and customer-entered offers only;
  no live insurance feed, verification, policy binding or invented premiums. Premiums
  are shown separately from the Deal Benefit Score/game budget and held only in memory.
- Instant Deal Benefit Score and five-year retained-value/net-equity scenarios.
- Safety is illustrative assist-feature coverage, not crash performance.
- Environmental comparison is tailpipe CO₂, not lifecycle emissions.
- Reliability is a maintenance-budget proxy, not measured failure rates.
- All resale, coverage and maintenance assumptions are editable educational examples.
  Do not describe them as verified brand performance or a guarantee.
- Current vehicle is assumed owned outright unless the customer supplies current loan details.
  Current leased vehicles have no owned-equity series. Trade-in equity is not automatically
  applied to a new purchase. Rival is a generic gasoline scenario.
- Skipped finance filters are relaxed and explicitly disclosed broad example inputs are
  used for educational scores, not presented as the customer's actual budget.
- Paint preference does not guarantee model/trim/dealer color availability.
- The model and all assumptions/methodology are visible in the comparison dashboard.
- Nessie affordability is sandbox-only: built-in fictional accounts work without
  credentials; optional server-side Nessie API mode uses NESSIE_API_KEY.
  Never describe it as live bank access, TFS preapproval, or real money movement.
  Down-payment tests require review and explicit confirmation, move only between
  same-customer fictional checking/savings accounts, and use session idempotency.
  Sample balances and transfer receipts are ephemeral (two hours/server lifetime).
  No genuine TFS holding account or lender integration exists.
- Cashflow averages 90 observed days over three 30-day months; deposits are an
  income proxy. Missing loan/bill data withholds APR/budget suggestions. Optional
  gross income affects the debt ratio only. Applying a budget or APR is explicit
  and must preserve at least two exact matches without relaxing other filters.

## Verify

`python3 -m unittest discover -s tests -p 'test_*.py'`

`node --test tests/*.test.cjs`

`node --test tests/deal-model.test.cjs`

`node --test tests/catalog.test.cjs`

`python3 tests/browser_smoke.py`

The browser test requires the app workflow to be running and Playwright installed.
Use the Replit-provided Chromium via `REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE`.
