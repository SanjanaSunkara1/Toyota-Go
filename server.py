"""Serve only public app files; keep project config and source archives private."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit, parse_qs
from http.cookies import SimpleCookie
from contextlib import ExitStack
from threading import Thread
import argparse
import json
import os
import secrets

from banking import FinanceError, service

ROOT = Path(__file__).resolve().parent
PUBLIC = {
    "/", "/index.html", "/styles.css", "/cars.js", "/game.js",
    "/insights-model.js", "/insights.js", "/branding.js",
    "/wizard.js", "/navigation.js", "/safety-page.js", "/experience.css",
    "/catalog.js", "/revision.css", "/home-hero.js", "/filters.js", "/insurance.js", "/tss.js",
    "/finance.js", "/finance.css",
    "/assets/toyota-logo.svg",
    "/attached_assets/0_Screen_Shot_2026-10-25_at_12.55.02_AM_1792907721806.png",
    "/attached_assets/image_1792909171658.png",
    "/attached_assets/Two-people-in-a-dealership-showroom-sitting-with-a-finance-ad_1792913602649.avif",
}


class PublicHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        # Request bodies and banking credentials must never reach HTTP logs.
        super().log_message(fmt, *args)

    def finance_session(self):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
        except Exception:
            pass
        token = self.headers.get("X-Sandbox-Session") or (cookie["toyota_sandbox"].value if "toyota_sandbox" in cookie else None)
        return service.session(token)

    def json_response(self, data, status=200, token=None):
        body = json.dumps(data, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if token:
            secure = "; Secure" if self.headers.get("X-Forwarded-Proto") == "https" else ""
            self.send_header("Set-Cookie", f"toyota_sandbox={token}; Path=/api/finance; HttpOnly; SameSite=Lax; Max-Age=7200{secure}")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlsplit(self.path)
        if not parsed.path.startswith("/api/finance/"):
            return super().do_GET()
        try:
            token, session = self.finance_session()
            if parsed.path == "/api/finance/config":
                return self.json_response({"nessie_configured": bool(os.environ.get("NESSIE_API_KEY")),
                                           "csrf_token": session["csrf"], "session_token": token}, token=token)
            if parsed.path == "/api/finance/accounts":
                payload = {key: values[0] for key, values in parse_qs(parsed.query).items()}
                return self.json_response(service.run(session, "accounts", payload), token=token)
            raise FinanceError("Unknown finance endpoint.", 404)
        except FinanceError as exc:
            self.json_response({"error": str(exc)}, exc.status)

    def do_POST(self):
        if self.path not in {"/api/finance/analyze", "/api/finance/reserve"}:
            return self.json_response({"error": "Not found."}, 404)
        try:
            token, session = self.finance_session()
            if not secrets.compare_digest(self.headers.get("X-CSRF-Token", ""), session["csrf"]):
                raise FinanceError("Sandbox session expired. Reopen the finance workspace and try again.", 403)
            if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                raise FinanceError("Use a JSON request.", 415)
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                raise FinanceError("Invalid request size.") from None
            if not 0 < length <= 16384:
                raise FinanceError("Request size is invalid.", 413)
            try:
                payload = json.loads(self.rfile.read(length))
            except (ValueError, UnicodeDecodeError):
                raise FinanceError("Invalid JSON request.") from None
            if not isinstance(payload, dict):
                raise FinanceError("A JSON object is required.")
            action = self.path.rsplit("/", 1)[1]
            self.json_response(service.run(session, action, payload), token=token)
        except FinanceError as exc:
            self.json_response({"error": str(exc)}, exc.status)

    def send_head(self):
        if unquote(urlsplit(self.path).path) not in PUBLIC:
            self.send_error(404)
            return None
        return super().send_head()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview-alias-port", type=int,
                        help="Optional development listener for an additional Preview URL.")
    args = parser.parse_args()
    if args.preview_alias_port is not None and (
            not 1024 <= args.preview_alias_port <= 65535 or args.preview_alias_port == 5000):
        parser.error("The preview alias must be a distinct port between 1024 and 65535.")
    # Both development URLs use the same handler and in-memory banking service.
    # Production still starts only the primary listener with `python3 server.py`.
    with ExitStack() as stack:
        primary = stack.enter_context(ThreadingHTTPServer(("0.0.0.0", 5000), PublicHandler))
        alias = None
        if args.preview_alias_port is not None:
            alias = stack.enter_context(
                ThreadingHTTPServer(("0.0.0.0", args.preview_alias_port), PublicHandler))
            Thread(target=alias.serve_forever, daemon=True).start()
        print(f"Toyota Go listening on 0.0.0.0:5000"
              + (f" and preview alias :{args.preview_alias_port}" if alias else ""), flush=True)
        try:
            primary.serve_forever()
        finally:
            if alias:
                alias.shutdown()
