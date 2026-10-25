---
name: Nessie sandbox boundaries
description: Reasons behind iframe-safe banking sandbox sessions and conservative transfer handling.
---

Keep an explicit, unguessable sandbox-session header plus a separate CSRF token; do not replace this with cookie-only session handling without verifying the embedded preview.

**Why:** Toyota Go is viewed inside an iframe where third-party cookies may be restricted. Browser verification deliberately clears cookies and confirms analysis still works through the explicit session header.

**How to apply:** All banking requests after configuration must carry the same sandbox-session header, and writes must also carry CSRF protection. This is a synthetic-data demo mechanism, not sufficient authentication for a future real-bank product.

Treat a network failure during transfer submission as an uncertain outcome, not proof that nothing happened. Keep the original operation key and do not automatically resubmit under a new key.

**Why:** Nessie may have accepted a sandbox transfer before the network failed; no provider-level idempotency guarantee was verified.

**How to apply:** Present an unknown/pending receipt and require inspection of the sandbox ledger before another operation. Do not promote this ephemeral demo receipt handling to real payments without durable storage and authorized payment-provider semantics.
