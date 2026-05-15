"""
backend_sessions.py
Session lifecycle management for recording sessions.
A "session" groups one pig procedure: it stores the patient metadata
and the list of clinical events that occurred during the recording.
Session data is persisted to disk as JSON so it survives a server
restart or an unexpected shutdown.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from backend_config import SESSIONS_DIR


class SessionStore:
    """
    Creates and manages the on-disk session for the current recording.

    Only one session is active at a time. Call create_session() when a
    recording starts and save_events() when it stops.
    """

    def __init__(self) -> None:
        self.current_session: dict | None = None

    def create_session(self, patient_data: dict | None) -> dict:
        """
        Create a new session directory and write the initial JSON file.

        Args:
            patient_data: Dictionary of patient fields from the frontend
                          form. May be None or empty if the user skipped
                          the form.

        Returns:
            A dict with keys ``session_id`` (str), ``session_dir``
            (Path), and ``patient`` (dict).
        """
        session_id  = datetime.now().strftime("%Y%m%d_%H%M%S")
        session_dir = SESSIONS_DIR / session_id
        session_dir.mkdir(parents=True, exist_ok=True)

        payload = {
            "sessionId": session_id,
            "createdAt": datetime.now().isoformat(timespec="seconds"),
            "patient":   patient_data or {},
            "events":    [],
        }

        with open(session_dir / "session.json", "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)

        self.current_session = {
            "session_id":  session_id,
            "session_dir": session_dir,
            "patient":     patient_data or {},
        }
        return self.current_session

    def save_events(self, events: list[dict]) -> None:
        """
        Append the final event list to the current session JSON file.

        Args:
            events: List of event dicts, each with keys
                    ``timeInSeconds``, ``displayTime``, and ``text``.
        """
        if not self.current_session:
            return

        session_dir:  Path = self.current_session["session_dir"]
        session_file        = session_dir / "session.json"

        if session_file.exists():
            with open(session_file, "r", encoding="utf-8") as handle:
                payload = json.load(handle)
        else:
            payload = {
                "sessionId": self.current_session["session_id"],
                "createdAt": datetime.now().isoformat(timespec="seconds"),
                "patient":   self.current_session.get("patient", {}),
            }

        payload["events"] = events

        with open(session_file, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)

    def get_current(self) -> dict | None:
        """Return the current session dict, or None if no session is active."""
        return self.current_session
