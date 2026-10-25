"""Guided cards, whole Toyota catalog, dropdown filters, insurance and TSS regression checks."""
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
    seen = []
    for _ in range(20):
        if not page.locator("#needs-shell").is_visible():
            return seen
        handled = set()
        for _ in range(12):
            screens = page.locator(".question-step:not(.hidden)")
            assert 1 <= screens.count() <= 3
            pending = [screen for screen in screens.all() if screen.get_attribute("data-question") not in handled]
            if not pending:
                break
            screen = pending[0]
            question = screen.get_attribute("data-question")
            handled.add(question)
            seen.append(question)
            answered = False
            for control in screen.locator("input:not([type=checkbox]),select").all():
                control_id = control.get_attribute("id")
                if control_id in answers:
                    if control.evaluate("(node) => node.tagName") == "SELECT":
                        control.select_option(answers[control_id])
                    else:
                        control.fill(str(answers[control_id]))
                    answered = True
            if not answered:
                screen.locator(".question-skip").click()
        page.locator("#wizard-next").click()
    raise AssertionError(f"Quiz did not finish: {seen}")


def clear_filters(page):
    page.locator("#edit-preferences").click()
    page.locator("#clear-results-filters").click()


def filter_results(page, values):
    for field, value in values.items():
        page.locator(f"#filter-{field}").select_option(value)
    page.locator("#apply-results-filters").click()


def run():
    with sync_playwright() as tool:
        browser = tool.chromium.launch(
            executable_path=os.environ.get("REPLIT_PLAYWRIGHT_CHROMIUM_EXECUTABLE"),
            headless=True, args=["--no-sandbox"],
        )
        page = browser.new_page(viewport={"width":1280,"height":900})
        errors = []
        page.on("pageerror",lambda error: errors.append(str(error)))
        page.goto(BASE, wait_until="domcontentloaded")
        page.wait_for_function("typeof ToyotaInsurance !== 'undefined' && typeof ResultsFilters !== 'undefined'")
        page.wait_for_function("document.querySelector('.home-dealership-hero img').naturalWidth > 0")
        assert page.locator("#home-overview").is_visible()
        assert page.locator(".home-dealership-hero img").is_visible()
        page.screenshot(path=str(OUTPUT / "home-updated-desktop.png"))
        menu(page,"customization")
        assert page.locator(".question-step:not(.hidden)").count() == 3
        page.locator("#needs-shell").screenshot(path=str(OUTPUT / "grouped-quiz-desktop.png"))
        answers = {
            "car-type-filter":"sedan", "paint-color":"Blue", "max-price":"38000",
            "monthly-cap":"650", "total-funds":"12000", "down-payment":"4000",
            "credit-tier":"670-739", "payment-preference":"loan", "annual-miles":"7500",
            "current-vehicle-status":"loan", "trade-intent":"yes",
            "current-loan-payment":"450.25", "current-loan-balance":"12000",
            "current-vehicle-value":"18000", "current-loan-apr":"6.9",
            "current-loan-term":"36", "current-loan-mileage":"42000",
        }
        seen = complete_quiz(page,answers)
        assert "loan-5" in seen and not any(key.startswith("lease-") for key in seen)
        assert page.evaluate("state.allMatches.every(car=>car.body==='sedan' && car.price<=38000)")
        assert page.evaluate("state.matches.length === state.allMatches.length")
        assert "$6,000.00" in page.locator(".current-contract-summary").inner_text()
        page.locator("#deal-chart-mode").select_option("equity")
        assert page.evaluate("dealProjection()[2].values[0]") == 6000
        assert not page.locator("#recommendation-intro").is_visible()
        assert "3 test-drive adventures" not in page.locator(".intro").inner_text()
        assert "About 5 minutes" not in page.locator(".intro").inner_text()
        assert page.locator(".result-hero-photo").evaluate("(img)=>img.naturalWidth>0")
        red_targets = ["#page-title em","#start-drive",".insight-header .eyebrow",".score-number",".insight-table thead th"]
        for target in red_targets:
            rgb = page.locator(target).first.evaluate("(node)=>getComputedStyle(node).color")
            if target != "#start-drive":
                channels = [int(n) for n in rgb.removeprefix("rgb(").removesuffix(")").split(",")[:3]]
                assert channels[0] > channels[1] * 1.5, (target,rgb)
        clear_filters(page)
        assert page.locator(".car-card").count() == 43
        assert page.evaluate("state.matches.length") == 43
        assert page.locator("#show-all").is_hidden()
        # Different real dropdown combinations must not return the same six cars.
        filter_results(page,{"car-type-filter":"truck","fuel-interest":"hybrid","year-filter":"2026","max-price":"50000"})
        assert page.evaluate("state.matches.map(car=>car.id)") == ["tacomahybrid"]
        clear_filters(page)
        filter_results(page,{"model-filter":"priusphev","year-filter":"2027"})
        assert page.evaluate("state.matches.map(car=>car.id)") == ["priusphev"]
        assert page.locator("#car-grid .car-card").count() == 1
        clear_filters(page)
        filter_results(page,{"passengers":"7"})
        assert page.evaluate("state.matches.length > 0 && state.matches.every(car=>car.seats>=7)")
        clear_filters(page)
        filter_results(page,{"model-filter":"chr","car-type-filter":"truck"})
        assert page.locator("#no-matches").is_visible()
        assert page.locator(".car-card").count() == 0
        page.locator("#edit-needs").click()
        assert page.locator("#results-filters").get_attribute("open") is not None
        page.locator("#clear-results-filters").click()
        assert page.locator(".car-card").count() == 43
        filter_results(page,{"max-price":"25000"})
        assert page.evaluate("state.matches.length>0 && state.matches.every(car=>car.price<=25000)")
        clear_filters(page)
        ids = page.evaluate("state.matches.slice(0,2).map(car=>car.id)")
        # Selection asks about insurance; all premiums remain user-entered rather than fake live rates.
        page.locator(f'[data-car="{ids[0]}"]').click()
        assert page.locator("#insurance-question").is_visible()
        page.locator("#insurance-yes").click()
        assert "No live quote feed" in page.locator("#insurance-workspace").inner_text()
        assert page.locator(".insurance-providers a").count() == 4
        page.locator("#insurance-label").fill("Plan A <check>")
        page.locator("#insurance-carrier").select_option("GEICO")
        page.locator("#insurance-premium").fill("600")
        page.locator("#insurance-term").select_option("6")
        page.locator("#insurance-liability").select_option("100/300/100")
        page.locator("#insurance-collision").select_option("500")
        page.locator("#insurance-comprehensive").select_option("500")
        page.locator("#insurance-quote-form button[type=submit]").click()
        assert "$100.00" in page.locator("#insurance-quote-comparison").inner_text()
        assert page.locator("#insurance-quote-comparison check").count() == 0
        page.locator("#insurance-car").select_option(ids[1])
        page.locator("#insurance-label").fill("Plan C")
        page.locator("#insurance-premium").fill("1200")
        page.locator("#insurance-term").select_option("12")
        page.locator("#insurance-quote-form button[type=submit]").click()
        page.locator("#insurance-car").select_option(ids[0])
        page.locator("#insurance-label").fill("Plan B")
        page.locator("#insurance-premium").fill("900")
        page.locator("#insurance-term").select_option("6")
        page.locator("#insurance-quote-form button[type=submit]").click()
        page.locator('[data-insurance-use="1"]').click()
        page.locator('[data-insurance-delete="3"]').click()
        assert page.locator("#insurance-quote-comparison tbody tr").count() == 2
        page.locator("#close-insurance").click()
        assert "$100.00/month" in page.locator("#insurance-panel").inner_text()
        for car_id in ids:
            page.locator(f'[data-compare="{car_id}"]').click()
        page.locator("#open-compare").click()
        comparison = page.locator("#compare-dialog").inner_text()
        assert "Plan A <check>" in comparison and "Plan C" in comparison
        assert "Vehicle payment + selected insurance" in comparison
        assert "three-year ownership cost + insurance" in comparison
        page.locator("#close-compare").click()
        # Lease details still work in grouped cards and known overage uses the entered contract rate.
        page.locator("#edit-preferences").click()
        page.locator("#edit-contract").click()
        seen = complete_quiz(page,{
            "current-vehicle-status":"lease","current-lease-payment":"399.99",
            "lease-maturity":"2027-01-15","lease-current-mileage":"32000",
            "lease-allowed-mileage":"30000","lease-residual":"22000","lease-overage-rate":"0.25",
        })
        assert "lease-5" in seen
        assert "$500.00" in page.locator(".current-contract-summary").inner_text()
        menu(page,"safety")
        assert "driver awareness concepts, model to year specific award sources" in page.locator(".safety-intro").inner_text()
        assert page.locator(".award-card a").count() == 3
        # Every available TSS concept runs and completes; reduced motion avoids unnecessary test wait.
        page.emulate_media(reduced_motion="reduce")
        feature_options = page.locator("#tss-feature-select option").evaluate_all("(options)=>options.map(option=>option.value)")
        assert {"vehicle","pedestrian","bicycle","motorcycle","drcc","lda","lta","rsa","ahb","pda","edss"} == set(feature_options)
        for feature in feature_options:
            page.locator("#tss-feature-select").select_option(feature)
            assert page.locator("#tss-feature-description br").count() == 1
            page.locator("#run-safety-simulation").click()
            page.wait_for_function("document.querySelector('#tss-demo-scene').dataset.state==='complete'")
        page.locator('[data-tss-version="TSS-C"]').click()
        assert page.locator("#tss-feature-select option").count() == 3
        page.locator('[data-tss-version="2.0"]').click()
        assert page.locator('#tss-feature-select option[value="pda"]').count() == 0
        assert page.locator('#tss-feature-select option[value="lta"]').count() == 1
        page.locator('[data-tss-version="4.0"]').click()
        page.locator("#tss-feature-select").select_option("pedestrian")
        page.locator("#run-safety-simulation").click()
        page.wait_for_function("document.querySelector('#tss-demo-scene').dataset.state==='complete'")
        page.locator(".safety-demo-section").screenshot(path=str(OUTPUT / "tss-features-desktop.png"))
        for kind,count in [("ev",6),("phev",3),("fcev",1)]:
            page.locator(f'[data-power="{kind}"]').click()
            assert page.locator(".electric-card").count() == count
        page.locator('[data-power="phev"]').click()
        image = page.locator(".electric-card img").first
        image.scroll_into_view_if_needed()
        page.wait_for_function("document.querySelector('.electric-card img')?.naturalWidth>0")
        assert "priuspluginhybrid" in image.get_attribute("src")
        before = page.locator("#sustainability-fact").inner_text()
        page.locator("#next-sustainability-fact").click()
        assert page.locator("#sustainability-fact").inner_text() != before
        for width in [390,768]:
            page.set_viewport_size({"width":width,"height":844})
            assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
            menu(page,"home")
            assert page.locator(".home-dealership-hero img").is_visible()
            assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
            page.screenshot(path=str(OUTPUT / f"home-updated-{width}.png"))
            menu(page,"customization")
            assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
            page.locator("#edit-preferences").click()
            assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
            page.locator("#edit-contract").click()
            assert 1<=page.locator(".question-step:not(.hidden)").count()<=3
            assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1")
            complete_quiz(page,{})
        assert not errors, errors
        assert page.request.get(BASE+"/.replit").status == 404
        assert page.request.get(BASE+"/zipFile.zip").status == 404
        browser.close()
        print("PASS: grouped skippable quiz, conditional contracts, all 43 catalog results, distinct dropdown filters including 7 seats and no matches, red accents, Home image, insurance prompt/quote math/select/delete/car comparisons, every TSS feature, actual Prius PHEV image, EV filters and responsive layouts; no browser errors.")


if __name__ == "__main__":
    run()
