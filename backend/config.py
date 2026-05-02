"""
backend_config.py
-----------------
Central configuration for the anesthesia monitoring backend.

All file-system paths and server settings are defined here so that they
are easy to find and change in one place. Each path can be overridden
via an environment variable, which is useful when deploying on a
different machine without editing source code.
"""

from __future__ import annotations

from pathlib import Path
import os


BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
SESSIONS_DIR = DATA_DIR / "sessions"
REPORTS_DIR = DATA_DIR / "reports"

for folder in (DATA_DIR, SESSIONS_DIR, REPORTS_DIR):
    folder.mkdir(parents=True, exist_ok=True)

HOST = os.getenv("HOST", "127.0.0.1")
PORT = int(os.getenv("PORT", "8001"))

RECORDINGS_ROOT = Path(
    os.getenv(
        "RECORDINGS_ROOT",
        r"C:\Users\Elev\Skrivebord\recordings",
    )
)

VITAL_RECORDER_EXE = Path(
    os.getenv(
        "VITAL_RECORDER_EXE",
        r"C:\Users\Elev\Skrivebord\Bach. oppgave\Vital.exe",
    )
)
