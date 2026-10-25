"""End-to-end sandbox UI plus HTTP security/session regression checks."""
import sys
sys.path.insert(0, "tests")
from browser_smoke import BASE, OUTPUT, complete_quiz, menu, sync_playwright, os


def value(page, group, label):
    return page.locator(f"#{group}").get_by_text(label, exact=True).locator("xpath=..").locator("strong").inner_text()


def analyze(page):
    page.locator("#finance-analyze").click()
    page.locator("#finance-results").wait_for(state="visible")


def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE"),
                                    args=["--no-sandbox"])
        context = browser.new_context(viewport={"width":1280, "height":900})
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(BASE)
        page.wait_for_function("typeof NessieFinance!=='undefined'")
        page.locator("#home-finance").click()
        page.locator("#finance-account-list input").first.wait_for()
        assert page.locator("#finance-account-list input").count() == 2
        # Explicit session headers must work even with third-party cookies unavailable.
        context.clear_cookies()
        analyze(page)
        assert value(page, "finance-metrics", "Observed deposits / month") == "$6,000.00"
        assert value(page, "finance-metrics", "Disposable cashflow / month") == "$2,090.00"
        assert value(page, "finance-metrics", "Recommended max payment") == "$890.00"
        assert value(page, "finance-metrics", "Debt-to-income proxy") == "10%"
        assert "FICTIONAL SAMPLE" in page.locator("#finance-source-label").inner_text()
        assert "1.9" in page.locator("#finance-apr-value").inner_text()
        assert "Unknown" in page.locator("#finance-vehicle-metrics").inner_text()
        page.locator("#finance-apply-apr").click()
        assert "first" in page.locator("#finance-apply-status").inner_text()
        page.locator("#finance-close").click()
        menu(page, "customization")
        complete_quiz(page, {})
        page.locator("#finance-money-open").click()
        assert "Toyota" in page.locator("#finance-vehicle-title").inner_text()
        page.locator("#finance-apply-apr").click()
        assert page.evaluate("state.profile.sandboxFinance && illustrativeApr()===0.019")
        expected = page.evaluate("monthlyPayment(state.car,state.plan)")
        assert expected > 0
        page.locator("#finance-apply-budget").click()
        assert page.evaluate("state.profile.monthlyCap===875 && state.matches.length>=2")
        assert "875" in page.locator("#finance-apply-status").inner_text()
        assert "Net monthly impact" in page.locator("#finance-vehicle-metrics").inner_text()
        before = value(page, "finance-vehicle-metrics", "Estimated fuel / energy savings offset")
        page.locator("#finance-gas-price").fill("12")
        assert value(page, "finance-vehicle-metrics", "Estimated fuel / energy savings offset") != before
        assert "−" in value(page, "finance-vehicle-metrics", "Estimated fuel / energy savings offset")
        page.locator("#finance-gas-price").fill("3.5")
        page.locator("#finance-dialog").screenshot(path=str(OUTPUT / "finance-analysis-desktop.png"))
        # Native modal retains underlying filtered results when closed.
        selected = page.evaluate("state.car.id")
        page.locator("#finance-close").click()
        assert page.evaluate("state.car.id") == selected
        page.locator("#finance-money-open").click()
        page.locator("#finance-scenario").select_option("tight")
        page.wait_for_function("document.querySelector('#finance-account-list').textContent.includes('$900')")
        assert not page.evaluate("state.profile.sandboxFinance")
        assert page.locator("#finance-results").is_hidden()
        analyze(page)
        assert value(page, "finance-metrics", "Recommended max payment") == "$0.00"
        assert page.locator("#finance-apply-apr").is_disabled()
        assert page.locator("#finance-apply-budget").is_disabled()
        # Missing income stays unknown, never 0% DTI or a fabricated rate.
        page.locator("#finance-account-0").uncheck()
        analyze(page)
        assert value(page, "finance-metrics", "Debt-to-income proxy") == "Unavailable"
        assert value(page, "finance-metrics", "Recommended max payment") == "Unavailable"
        page.locator("#finance-scenario").select_option("balanced")
        page.wait_for_function("document.querySelector('#finance-account-list').textContent.includes('$14,500')")
        analyze(page)
        page.locator("#finance-reserve-start").click()
        page.locator("#finance-transfer-amount").fill("2000.01")
        page.locator("#finance-reserve-form button[type=submit]").click()
        confirm = page.get_by_role("button", name="Confirm test transfer", exact=True)
        assert confirm.is_disabled()
        assert "$2,000.01" in page.locator("#finance-transfer-review").inner_text()
        page.locator("#finance-transfer-confirm").check()
        confirm.click()
        page.locator("#finance-receipt").wait_for(state="visible")
        assert "completed" in page.locator("#finance-receipt").inner_text().lower()
        assert "$12,499.99" in page.locator("#finance-receipt").inner_text()
        assert "$10,000.01" in page.locator("#finance-receipt").inner_text()
        assert page.locator("#finance-results").is_hidden()
        assert not page.evaluate("state.profile.sandboxFinance")
        assert "$12,499.99" in page.locator("#finance-account-list").inner_text()
        analyze(page)
        assert value(page, "finance-metrics", "Liquid balance") == "$22,500.00"
        for width in [390,768]:
            page.set_viewport_size({"width":width, "height":844})
            assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
            assert page.locator("#finance-dialog").evaluate("(node)=>node.scrollWidth<=node.clientWidth+1")
            page.locator("#finance-dialog").screenshot(path=str(OUTPUT / f"finance-analysis-{width}.png"))
        # Raw API endpoints reject missing CSRF, duplicates, and transfer overdraw.
        config = page.request.get(BASE + "/api/finance/config").json()
        headers = {"X-Sandbox-Session": config["session_token"], "X-CSRF-Token": config["csrf_token"]}
        assert page.request.post(BASE + "/api/finance/analyze", data={"account_ids":["demo-checking"]}).status == 403
        assert page.request.post(BASE + "/api/finance/analyze", headers=headers,
                                 data={"account_ids":["demo-checking","demo-checking"]}).status == 400
        overdraw = {"source_id":"demo-checking", "payee_id":"demo-savings",
                    "amount":99999, "confirmed":True, "idempotency_key":"browser-overdraw-00001"}
        assert page.request.post(BASE + "/api/finance/reserve", headers=headers, data=overdraw).status == 400
        # Unknown endpoints, private server sources and bank-key injection are not served.
        assert page.request.get(BASE + "/banking.py").status == 404
        assert page.request.get(BASE + "/server.py").status == 404
        assert not errors, errors
        browser.close()
        print("PASS: sample analysis, absent income, tight budget, APR/payment integration, fuel offset, confirmed test transfer, cookie-free sessions, CSRF/error boundaries, modal navigation and responsive layouts.")


if __name__ == "__main__":
    run()
