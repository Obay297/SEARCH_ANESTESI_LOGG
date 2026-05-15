# Bridge between backend and VitalRecorder application
from __future__ import annotations

import re
import subprocess
import time
from pathlib import Path

from backend_config import RECORDINGS_ROOT, VITAL_RECORDER_EXE


def _safe_stem(text: str) -> str:
   
    return re.sub(r'[\\/:*?"<>|]+', "_", text).strip("_ ")

   
class VitalRecorderBridge:


    def __init__(self) -> None:
        self.running                       = False
        self.process: subprocess.Popen[str] | None = None
        self.exe_path                      = Path(VITAL_RECORDER_EXE)
        self.recordings_root               = Path(RECORDINGS_ROOT)
        self.last_found_vital_file: str | None = None
        self.recording_started_at: float | None = None
        self._desired_stem: str | None     = None

    def start(self, desired_stem: str | None = None) -> dict:
       
        if self.process and self.process.poll() is None:
            self.running = True
            return {"ok": True, "message": "Vital Recorder already running"}

        if not self.exe_path.exists():
            self.running = False
            return {
                "ok":      False,
                "message": f"Vital Recorder executable not found: {self.exe_path}",
            }

        self.process              = subprocess.Popen([str(self.exe_path)])
        self.running              = True
        self.recording_started_at = time.time()
        self.last_found_vital_file = None
        self._desired_stem        = desired_stem or None

        return {
            "ok":      True,
            "message": "Vital Recorder started",
            "pid":     self.process.pid,
        }

    def stop(self) -> dict:
       
        self.running = False

        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=10)
            except Exception:
                pass

        # Poll until the .vital 
        newest    = None
        deadline  = time.time() + 15
        last_size: int | None = None

        while time.time() < deadline:
            time.sleep(1)
            candidate = self.find_newest_vital_file()
            if candidate:
                size = candidate.stat().st_size
                if size > 0 and size == last_size:
                  
                    newest = candidate
                    break
                last_size = size
                newest    = candidate  

        if newest and self._desired_stem:
            target = newest.with_name(_safe_stem(self._desired_stem) + ".vital")
            if target != newest and not target.exists():
                try:
                    newest = newest.rename(target)
                except Exception:
                    pass  # keep original name on failure

        self.last_found_vital_file = str(newest) if newest else None
        self._desired_stem         = None

        return {
            "ok":        True,
            "message":   "Vital Recorder stopped",
            "vital_file": self.last_found_vital_file,
        }

    def find_newest_vital_file(self) -> Path | None:
       
        if not self.recordings_root.exists():
            return None

        vital_files = list(self.recordings_root.rglob("*.vital"))
        if not vital_files:
            return None

        if self.recording_started_at:
            recent = [     # Filters files created around recording start time
                path
                for path in vital_files
                if path.stat().st_mtime >= self.recording_started_at - 10
            ]
            if recent:
                return max(recent, key=lambda path: path.stat().st_mtime)

        return max(vital_files, key=lambda path: path.stat().st_mtime)
