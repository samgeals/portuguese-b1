#!/bin/bash
# Double-click this file (macOS) or run ./start.command to open the app.
cd "$(dirname "$0")"
PORT=8000
( sleep 1; open "http://localhost:$PORT" 2>/dev/null || xdg-open "http://localhost:$PORT" 2>/dev/null ) &

PORT="$PORT" python3 server.py
