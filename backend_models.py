"""
backend_models.py
-----------------
Pydantic request/response models for the anesthesia monitoring API.

These models are used by FastAPI to automatically validate incoming
JSON request bodies and to generate the API documentation. Each field
has a default value so that partial payloads are accepted gracefully.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class PatientData(BaseModel):
    """Demographic and procedure information collected before recording starts."""

    date:           str = ""
    id:             str = ""
    project:        str = ""
    participants:   str = ""
    weight:         str = ""
    sedationTime:   str = ""
    intubationTime: str = ""
    tubeSize:       str = ""
    drugName:       str = ""
    notes:          str = ""


class EventItem(BaseModel):
    """A single timestamped clinical event logged during a procedure."""

    timeInSeconds: int
    displayTime:   str
    text:          str


class SourceSelectRequest(BaseModel):
    """Payload for the /source/select endpoint."""

    source: str  # "simulation", "vitalrecorder", or "latest-file"


class StartRecordingRequest(BaseModel):
    """Payload for the /recording/start endpoint."""

    patient: Optional[PatientData] = None


class StopRecordingRequest(BaseModel):
    """Payload for the /recording/stop endpoint."""

    events: List[EventItem] = Field(default_factory=list)


class MonitoringExportRequest(BaseModel):
    """Payload for the /export/monitoring-xlsx endpoint."""

    patient: Optional[Dict[str, Any]] = None
    source:  Optional[str]            = None
    rows:    List[Dict[str, Any]]     = Field(default_factory=list)
    events:  List[Dict[str, Any]]     = Field(default_factory=list)
