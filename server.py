"""
server.py
---------
Entry point for the anesthesia monitoring backend (SEARCH_ANESTESI_LOGG).

Run this file directly to start the FastAPI development server:
    python server.py

The server listens on 127.0.0.1:8001 by default. All API routes and
The WebSocket endpoints are defined in backend_main.py.
"""

import uvicorn
from backend_main import app

if __name__ == "__main__":
    uvicorn.run("backend_main:app", host="127.0.0.1", port=8001, reload=False)
