"""
Managing the recording session lifecycle.
It represents a set of PIG actions, storing the patient's descriptive data and a list of clinical events that occurred during the recording.
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from backend_config import SESSIONS_DIR

# Creates and manages the on-disk session for the current recording. 
# Only one session is active at a time.
class SessionStore:  
    def __init__(self) -> None:
        self.current_session: dict | None = None

    def create_session(self, patient_data: dict | None) -> dict:   # Create a new session directory and write the initial JSON file.
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

    def save_events(self, events: list[dict]) -> None:  #Append the final event list to the current session JSON file.
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
        #Return the current session dict, or None if no session is active.
        return self.current_session
