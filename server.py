"""Serve only public app files; keep project config and source archives private."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
PUBLIC = {
    "/", "/index.html", "/styles.css", "/cars.js", "/game.js",
    "/insights-model.js", "/insights.js", "/branding.js",
    "/assets/toyota-logo.svg",
    "/attached_assets/0_Screen_Shot_2026-10-25_at_12.55.02_AM_1792907721806.png",
}


class PublicHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

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
    ThreadingHTTPServer(("0.0.0.0", 5000), PublicHandler).serve_forever()
