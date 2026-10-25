"""End-to-end checks for the imported static app and new decision dashboard."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = os.environ.get("TEST_BASE_URL") or "https://" + os.environ["REPLIT_DEV_DOMAIN"]
OUTPUT = Path("generated-artifacts")
OUTPUT.mkdir(exist_ok=True)


def run():
    with sync_playwright() as browser_tool:
        browser = browser_tool.chromium.launch(
            executable_path=os.environ.get("REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE"),
            headless=True,
            args=["--no-sandbox"],
        )
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(BASE, wait_until="domcontentloaded")
        page.wait_for_function("document.title.includes('Toyota Go')")
        assert page.locator(".top-note").inner_text() == "To You Total Assistance"
        assert page.locator(".brand-logo").first.evaluate("(img) => img.complete && img.naturalWidth > 0")
        page.locator("#login-tab").click()
        assert "Toyota Go" in page.locator("#auth-title").inner_text()
        page.locator("#signup-tab").click()
        page.locator("#account-name").fill("Demo Driver")
        page.locator("#account-email").fill("demo@example.com")
        page.locator("#account-password").fill("demo-only")
        page.locator("#auth-form button[type=submit]").click()
        page.locator("#annual-miles").select_option("7500")
        page.locator("#needs-form button[type=submit]").click()
        page.locator(".score-number").wait_for()
        assert page.locator("#deal-insights .insight-card").count() == 4
        initial = page.locator(".score-number").inner_text()
        first_car = page.evaluate("state.car.id")
        page.locator("[data-car]").nth(1).click()
        assert page.evaluate("state.car.id") != first_car
        assert page.locator("#deal-insights").inner_text().find(page.evaluate("state.car.name")) >= 0
        page.locator("#deal-assumptions summary").click()
        page.locator('[data-assumption="toyotaMaintenance"]').fill("3000")
        page.locator('[data-assumption="toyotaMaintenance"]').press("Tab")
        assert page.locator(".score-number").inner_text() != initial
        page.locator("#reset-deal-assumptions").click()
        assert page.locator('[data-assumption="toyotaMaintenance"]').input_value() == "500"
        page.locator("#deal-chart-mode").select_option("equity")
        assert "net equity" in page.locator("#retention-chart-title").text_content()
        page.locator('[data-plan="lease"]').click()
        assert "Leasing does not build" in page.locator("#deal-insights").inner_text()
        assert "Not owned" in page.locator(".insight-table").text_content(), page.evaluate("({plan:state.plan.id,mode:dealChartMode,values:dealProjection()})")
        page.locator('[data-plan="loan"]').click()
        page.locator("[data-compare]").nth(0).click()
        page.locator("[data-compare]").nth(1).click()
        page.locator("#open-compare").click()
        assert page.locator("#compare-dialog").is_visible()
        assert "Illustrative Deal Benefit Score" in page.locator("#compare-dialog").inner_text()
        page.locator("#close-compare").click()
        page.locator("#deal-assumptions summary").click()
        page.locator("#deal-insights").screenshot(path=str(OUTPUT / "insights-desktop.png"))
        page.locator("#start-drive").click()
        assert page.locator("#drive-shell").is_visible()
        page.locator("#reset-button").click()
        assert page.locator("#auth-shell").is_visible()
        assert page.evaluate("dealScenario().toyotaMaintenance") == 500
        # Cash ownership, no-match handling, and changing financial filters.
        page.locator("#login-tab").click()
        page.locator("#account-email").fill("demo@example.com")
        page.locator("#account-password").fill("demo-only")
        page.locator("#auth-form button[type=submit]").click()
        page.locator("#max-price").fill("10000")
        page.locator("#needs-form button[type=submit]").click()
        assert page.locator("#no-matches").is_visible()
        assert page.locator(".score-number").count() == 0
        page.locator("#edit-needs").click()
        page.locator("#max-price").fill("38000")
        page.locator("#total-funds").fill("50000")
        page.locator("#payment-preference").select_option("cash")
        page.locator("#needs-form button[type=submit]").click()
        assert page.evaluate("state.plan.id") == "cash"
        assert page.locator("#monthly-cost").inner_text() == "None"
        page.locator("#deal-chart-mode").select_option("equity")
        assert page.locator(".insight-table").inner_text().find("Not owned") == -1
        # Responsive checks use the actual interacted page, not an auth bypass.
        for width in [390, 768]:
            page.set_viewport_size({"width": width, "height": 844})
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
            page.locator("#deal-insights").screenshot(path=str(OUTPUT / f"insights-{width}.png"))
        page.locator("#reset-button").click()
        page.set_viewport_size({"width": 390, "height": 844})
        page.screenshot(path=str(OUTPUT / "login-mobile.png"), full_page=True)
        assert not errors, errors
        assert page.request.get(BASE + "/.replit").status == 404
        assert page.request.get(BASE + "/zipFile.zip").status == 404
        browser.close()
        print("PASS: branding, demo onboarding, car/plan selection, score updates, assumptions/reset, equity/lease/cash, comparison, no matches, drive start, mobile/tablet layout, private-file protection; no page errors.")


if __name__ == "__main__":
    run()
