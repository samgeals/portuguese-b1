#!/usr/bin/env python3
"""Serve the app locally and speak Portuguese with the Mac's own voices (the `say` command).

Browsers differ in which system voices they expose (Firefox often falls back to English),
so the app asks this server for audio first and only uses browser speech if it isn't available.

  GET /say/voices                     -> JSON list of installed Portuguese voices
  GET /say?text=Olá&voice=Joana&slow=1 -> WAV audio
"""
import http.server
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse

PORT = int(os.environ.get("PORT", "8000"))
ROOT = os.path.dirname(os.path.abspath(__file__))
SAY = shutil.which("say")
_cache = {}


def portuguese_voices():
    if not SAY:
        return []
    out = subprocess.run([SAY, "-v", "?"], capture_output=True, text=True).stdout
    voices = []
    for line in out.splitlines():
        m = re.match(r"^(.+?)\s+([a-z]{2,3}[_-][A-Za-z0-9]+)\s+#", line)
        if m and m.group(2).lower().startswith("pt"):
            voices.append({"name": m.group(1).strip(), "lang": m.group(2).replace("_", "-")})
    # European Portuguese first, Joana/Catarina at the top
    voices.sort(key=lambda v: (v["lang"].lower() != "pt-pt", v["name"] not in ("Joana", "Catarina"), v["name"]))
    return voices


VOICES = portuguese_voices()


def speak_wav(text, voice, slow):
    key = (text, voice, slow)
    if key in _cache:
        return _cache[key]
    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        subprocess.run(
            [SAY, "-v", voice, "-r", "120" if slow else "170",
             "--file-format=WAVE", "--data-format=LEI16@22050", "-o", path, text],
            check=True, timeout=30,
        )
        with open(path, "rb") as f:
            data = f.read()
    finally:
        os.remove(path)
    if len(_cache) > 500:
        _cache.clear()
    _cache[key] = data
    return data


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")  # always load the latest app files
        super().end_headers()

    def send_bytes(self, body, ctype, status=200):
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        if url.path == "/say/voices":
            return self.send_bytes(json.dumps(VOICES).encode(), "application/json")
        if url.path == "/say":
            q = urllib.parse.parse_qs(url.query)
            text = (q.get("text", [""])[0]).strip().lstrip("-")[:300]
            names = [v["name"] for v in VOICES]
            voice = q.get("voice", [""])[0]
            if voice not in names:
                voice = names[0] if names else ""
            if not text or not voice:
                return self.send_bytes(b"no voice or text", "text/plain", 404)
            try:
                return self.send_bytes(speak_wav(text, voice, q.get("slow", ["0"])[0] == "1"), "audio/wav")
            except Exception as e:  # noqa: BLE001
                return self.send_bytes(str(e).encode(), "text/plain", 500)
        return super().do_GET()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    pt = ", ".join(v["name"] for v in VOICES) or "none (browser speech will be used)"
    print(f"Portuguese app running at http://localhost:{PORT}  (Ctrl+C to stop)")
    print(f"Portuguese voices: {pt}")
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        sys.exit(0)
