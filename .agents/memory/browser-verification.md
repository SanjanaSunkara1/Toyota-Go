---
name: Browser verification
description: A Playwright native-option assertion caveat observed in this environment.
---

For disabled native select options, assert the DOM `option.disabled` property rather than relying on Playwright `Locator.is_disabled()`.

**Why:** In this environment, `is_disabled()` returned false for an option whose disabled property was true and whose disabled HTML attribute was present. This led to false regression failures.

**How to apply:** Use an element evaluation when testing unavailable dropdown options. Verify counts independently; do not assume a model has only one catalog entry, since the catalog can include multiple model years.
