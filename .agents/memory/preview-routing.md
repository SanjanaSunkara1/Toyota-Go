---
name: Preview routing
description: Why Toyota Go supports both the default and explicit-port development Preview addresses.
---

Keep both the default development URL and its explicit `:5000` variant working. The extra listener is development-only and must share the same application state, rather than starting a second independent banking service.

**Why:** The user's Preview pane retained an explicit `:5000` URL even after being given the healthy default URL. The default address returned 200 while the explicit-port address returned a proxy-unreachable error. Replit does not allow one local port to be mapped to multiple external ports, so a same-process development alias is intentional.

**How to apply:** Check the exact proxied address in the user's preview context, not just the primary local listener. Preserve the default production startup and the shared sandbox session behavior when changing development routing.
