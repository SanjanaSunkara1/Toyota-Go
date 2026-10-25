"""Exercise the Toyota Go guided quiz and public safety/sustainability views."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get("TEST_BASE_URL") or "https://" + os.environ["REPLIT_DEV_DOMAIN"]
OUTPUT = Path("generated-artifacts")
OUTPUT.mkdir(exist_ok=True)


def menu(page, destination):
    page.locator("#menu-toggle").click()
    page.locator(f'#site-menu [data-page="{destination}"]').click()


def complete_quiz(page, answers):
    """Answer provided controls and explicitly skip the other questions."""
    seen = []
    for _ in range(50):
        if not page.locator("#needs-shell").is_visible():
            return seen
        screen = page.locator(".question-step:not(.hidden)")
        assert screen.count() == 1
        seen.append(screen.get_attribute("data-question"))
        controls = screen.locator("input:not([type=checkbox]),select")
        answered = False
        for control in controls.all():
            control_id = control.get_attribute("id")
            if control_id in answers:
                if control.evaluate("(node) => node.tagName") == "SELECT":
                    control.select_option(answers[control_id])
                else:
                    control.fill(str(answers[control_id]))
                answered = True
        page.locator("#wizard-next" if answered else "#wizard-skip").click()
    raise AssertionError(f"Quiz did not complete: {seen}")


def run():
    with sync_playwright() as tool:
        browser = tool.chromium.launch(
            executable_path=os.environ.get("REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE"),
            headless=True, args=["--no-sandbox"],
        )
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(BASE, wait_until="domcontentloaded")
        page.wait_for_function("typeof ToyotaWizard !== 'undefined'")
        assert "Toyota Go" in page.title()
        assert page.locator(".brand-logo").first.evaluate("(img) => img.complete && img.naturalWidth > 0")
        page.locator("#login-tab").click()
        assert "Toyota Go" in page.locator("#auth-title").inner_text()
        page.locator("#signup-tab").click()
        page.locator("#account-name").fill("Demo Driver")
        page.locator("#account-email").fill("demo@example.com")
        page.locator("#account-password").fill("demo-only")
        page.locator("#auth-form button[type=submit]").click()
        assert page.locator("#customization-page").is_visible()
        assert page.locator(".question-step:not(.hidden)").count() == 1
        page.locator("#needs-shell").screenshot(path=str(OUTPUT / "guided-question-desktop.png"))
        loan_answers = {
            "car-type-filter": "sedan", "paint-color": "Blue",
            "max-price": "38000", "monthly-cap": "650", "total-funds": "12000",
            "down-payment": "4000", "credit-tier": "670-739",
            "payment-preference": "loan", "annual-miles": "7500",
            "current-vehicle-status": "loan", "trade-intent": "yes",
            "current-loan-payment": "450.25", "current-loan-balance": "12000",
            "current-vehicle-value": "18000", "current-loan-apr": "6.9",
            "current-loan-term": "36", "current-loan-mileage": "42000",
        }
        seen = complete_quiz(page, loan_answers)
        assert "loan-5" in seen and not any(step.startswith("lease-") for step in seen)
        page.locator(".score-number").wait_for()
        assert page.evaluate("state.allMatches.every(car => car.body === 'sedan')")
        assert page.evaluate("state.profile.paintColor") == "Blue"
        assert page.evaluate("state.profile.currentVehicle.monthlyPayment") == 450.25
        contract = page.locator(".current-contract-summary").inner_text()
        assert "$6,000.00" in contract and "$450.25" in contract
        assert page.locator(".result-hero-photo").evaluate("(img) => img.complete && img.naturalWidth > 0")
        page.locator("#deal-chart-mode").select_option("equity")
        assert page.evaluate("dealProjection()[2].values[0]") == 6000
        assert "current loan details" in page.locator("#deal-insights").text_content()
        # Inputs remain editable, and score updates still work.
        page.locator("#deal-assumptions summary").click()
        original = page.locator(".score-number").inner_text()
        page.locator('[data-assumption="toyotaMaintenance"]').fill("3000")
        page.locator('[data-assumption="toyotaMaintenance"]').press("Tab")
        assert page.locator(".score-number").inner_text() != original
        page.locator("#reset-deal-assumptions").click()
        page.locator("[data-compare]").nth(0).click()
        page.locator("[data-compare]").nth(1).click()
        page.locator("#open-compare").click()
        assert "Illustrative Deal Benefit Score" in page.locator("#compare-dialog").inner_text()
        page.locator("#close-compare").click()
        page.locator("#deal-assumptions summary").click()
        page.locator(".intro").screenshot(path=str(OUTPUT / "results-hero-desktop.png"))
        # Home is not blank after finishing a quiz.
        menu(page, "home")
        assert page.locator("#home-overview").is_visible()
        page.locator("#home-resume").click()
        assert page.locator(".game-shell").is_visible()
        # Editing goes back to the guided flow and conditionally asks lease questions.
        page.locator("#edit-preferences").click()
        lease_answers = {
            "current-vehicle-status": "lease", "current-lease-payment": "399.99",
            "lease-maturity": "2027-01-15", "lease-current-mileage": "32000",
            "lease-allowed-mileage": "30000", "lease-residual": "22000",
            "lease-overage-rate": "0.25",
        }
        seen = complete_quiz(page, lease_answers)
        assert "lease-5" in seen and not any(step.startswith("loan-") for step in seen)
        summary = page.locator(".current-contract-summary").inner_text()
        assert "$399.99" in summary and "$500.00" in summary and "2,000" in summary
        page.locator("#deal-chart-mode").select_option("equity")
        assert page.evaluate("dealProjection()[2].values.every(value => value === null)")
        assert "Not specified" in page.locator("#budget-amount").inner_text()
        assert page.locator(".skipped-assumption-note").is_visible()
        # Safety tab: simulation, sourced award cards, all electrified categories, facts.
        menu(page, "safety")
        assert page.locator("#safety-page").is_visible()
        assert page.locator(".award-card a").count() == 3
        page.locator("#run-safety-simulation").click()
        page.locator(".safety-demo-car.stopped").wait_for()
        assert "illustrative vehicle stopped" in page.locator("#safety-simulation-status").inner_text()
        page.locator("#reset-safety-simulation").click()
        assert page.locator(".safety-demo-car.stopped").count() == 0
        for kind, expected in [("ev", 3), ("phev", 2), ("fcev", 1)]:
            page.locator(f'[data-power="{kind}"]').click()
            assert page.locator(".electric-card").count() == expected
            assert page.locator(".electric-card a").first.get_attribute("href").startswith("https://www.toyota.com/")
        fact = page.locator("#sustainability-fact").inner_text()
        page.locator("#next-sustainability-fact").click()
        assert page.locator("#sustainability-fact").inner_text() != fact
        page.locator('[data-power="ev"]').click()
        page.locator(".safety-page").screenshot(path=str(OUTPUT / "safety-sustainability-desktop.png"))
        # "Find like this" changes quiz preferences without bypassing budget filters.
        page.locator(".electric-choose").first.click()
        assert page.locator("#needs-shell").is_visible()
        assert page.locator("#car-type-filter").input_value() == "suv"
        assert page.locator("#fuel-interest").input_value() == "ev"
        complete_quiz(page, {"car-type-filter": "suv", "fuel-interest": "ev"})
        assert page.evaluate("state.allMatches.every(car => car.ev)")
        # All-skip works, including the final question, and resets clear prior contracts.
        page.locator("#menu-toggle").click()
        page.locator("#reset-button").click()
        menu(page, "customization")
        complete_quiz(page, {})
        assert page.evaluate("state.profile.currentVehicle.status") == "none"
        assert page.evaluate("state.profile.currentVehicle.payoffBalance") is None
        assert page.locator(".current-contract-summary").count() == 0
        assert page.locator(".score-number").is_visible()
        for width in [390, 768]:
            page.set_viewport_size({"width": width, "height": 844})
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
            page.locator(".intro").screenshot(path=str(OUTPUT / f"results-{width}.png"))
            menu(page, "safety")
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
            menu(page, "customization")
        page.locator("#edit-preferences").click()
        page.set_viewport_size({"width": 390, "height": 844})
        assert page.locator(".question-step:not(.hidden)").count() == 1
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
        page.screenshot(path=str(OUTPUT / "guided-question-mobile.png"), full_page=True)
        assert not errors, errors
        assert page.request.get(BASE + "/.replit").status == 404
        assert page.request.get(BASE + "/zipFile.zip").status == 404
        browser.close()
        print("PASS: one-question quiz, every-question skip, body/color preferences, conditional loan/lease details, equity/overage summary, menu navigation, public safety demo, award links, electrified filters, sustainability facts, comparison, responsive layouts; no page errors.")


if __name__ == "__main__":
    run()
