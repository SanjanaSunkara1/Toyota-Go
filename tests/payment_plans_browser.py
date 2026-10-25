"""Payment plans stay selectable; previews never bypass financial limits."""
from browser_smoke import BASE, OUTPUT, complete_quiz, menu, sync_playwright, os


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=os.environ.get("REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE"),
            args=["--no-sandbox"])
        page = browser.new_page(viewport={"width":1280,"height":900})
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(BASE)
        menu(page, "customization")
        complete_quiz(page, {"max-price":38000,"monthly-cap":550,
                            "total-funds":12000,"down-payment":4000,
                            "annual-miles":"12000"})
        assert page.evaluate("state.matches.length>=2")
        original = page.evaluate("JSON.stringify(state.profile)")
        lease = page.locator('[data-plan="lease"]')
        cash = page.locator('[data-plan="cash"]')
        assert lease.is_enabled() and cash.is_enabled()
        lease.click()
        assert lease.get_attribute("aria-pressed") == "true"
        assert page.evaluate("state.plan.id") == "lease"
        assert "10,000 miles/year" in page.locator("#plan-limit-notice").inner_text()
        assert page.locator("#start-drive").is_disabled()
        cash.click()
        assert page.evaluate("state.plan.id") == "cash"
        assert cash.get_attribute("aria-pressed") == "true"
        assert page.locator("#monthly-cost").inner_text() == "None"
        assert "available savings" in page.locator("#plan-limit-notice").inner_text()
        page.evaluate("startDrive()")
        assert not page.locator("#drive-shell").is_visible()
        assert page.evaluate("state.plan.id") == "cash"
        assert page.evaluate("JSON.stringify(state.profile)") == original
        page.locator('[data-plan="loan"]').click()
        assert page.locator("#start-drive").is_enabled()
        assert not page.locator("#plan-limit-notice").is_visible()
        cash.click()
        page.get_by_role("button",name="Review budget and mileage filters").click()
        assert page.locator("#results-filters").evaluate("(node)=>node.open")
        page.locator("#filter-total-funds").select_option("100000")
        page.locator("#filter-annual-miles").select_option("7500")
        page.locator("#apply-results-filters").click()
        for plan in ["lease","cash"]:
            page.locator(f'[data-plan="{plan}"]').click()
            assert page.evaluate("state.plan.id") == plan
            assert page.locator("#start-drive").is_enabled()
            assert not page.locator("#plan-limit-notice").is_visible()
            page.locator("#start-drive").click()
            if page.locator("#insurance-no").is_visible():
                page.locator("#insurance-no").click()
            assert page.locator("#drive-shell").is_visible()
            page.locator("#back-to-matches").click()
            assert page.evaluate("state.plan.id") == plan
        page.set_viewport_size({"width":390,"height":844})
        page.locator('[data-plan="lease"]').click()
        assert page.evaluate("state.plan.id") == "lease"
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
        page.locator("#plan-grid").screenshot(path=str(OUTPUT/"payment-plans-mobile.png"))
        page.set_viewport_size({"width":1280,"height":900})
        page.locator("#plan-grid").screenshot(path=str(OUTPUT/"payment-plans-desktop.png"))
        assert not errors, errors
        browser.close()
        print("PASS: lease/cash clickable, selected previews persist, limits explained and enforced, filters recover eligibility, both drive paths work and retain plan, mobile layout clean.")


if __name__ == "__main__":
    run()
