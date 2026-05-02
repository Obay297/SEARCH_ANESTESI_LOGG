"""
backend_vital_parser.py
-----------------------
Parses `.vital` files produced by VitalRecorder™ into structured data.

This is the core data-processing module. It reads the proprietary binary
format via the ``vitaldb`` library and extracts two kinds of output:

1. **Structured signal report** — per-signal statistics and down-sampled
   trend points, used to draw the SVG charts in the frontend.
2. **Legacy timeline report** — per-minute first/last measurements in the
   flat format the frontend's report table expects.

Device-to-field mapping is centralised in ``SIGNAL_SPECS`` and
``LEGACY_TRACK_CANDIDATES`` so that the parser works with multiple monitor
brands (Solar8000, IntelliVue, Primus, BIS, etc.) without code duplication.
"""

from __future__ import annotations

import math
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np

try:
    from vitaldb import VitalFile  # type: ignore
except Exception:  # pragma: no cover
    VitalFile = None  # type: ignore


DEVICE_LAYOUT = [
    {
        "key": "patient_monitor",
        "label": "Patient monitor",
        "signals": ["hr", "spo2", "art_sbp", "art_dbp", "art_map"],
    },
    {
        "key": "anesthesia_machine",
        "label": "Anesthesia machine",
        "signals": ["co2"],
    },
    {
        "key": "bis_monitor",
        "label": "BIS monitor",
        "signals": ["bis"],
    },
]


SIGNAL_SPECS: dict[str, dict[str, Any]] = {
    "hr": {
        "label": "HR",
        "unit": "bpm",
        "device": "patient_monitor",
        "reference": "70–120 bpm",
        "valid_min": 40,
        "valid_max": 180,
        "tracks": [
            "Solar8000/HR",
            "Solar 8000/HR",
            "B1x5M/HR",
            "Bx50/HR",
            "Demo/HR",
            "IntelliVue/HR",
            "SNUADC/HR",
            "Dash/HR",
            "HR",
        ],
    },
    "spo2": {
        "label": "SpO₂",
        "unit": "%",
        "device": "patient_monitor",
        "reference": "95–100 %",
        "valid_min": 80,
        "valid_max": 100,
        "tracks": [
            "Solar8000/PLETH_SPO2",
            "Solar8000/SPO2",
            "B1x5M/PLETH_SPO2",
            "Bx50/PLETH_SPO2",
            "Demo/PLETH_SPO2",
            "Solar 8000/SPO2",
            "IntelliVue/SPO2",
            "IntelliVue/PLETH_SPO2",
            "Masimo/SPO2",
            "SPO2",
            "SpO2",
        ],
    },
    # ART split into SBP / DBP / MAP so snapshot builds a proper "sys/dia" string
    "art_sbp": {
        "label": "ART SBP",
        "unit": "mmHg",
        "device": "patient_monitor",
        "reference": "90–140 mmHg",
        "valid_min": 50,
        "valid_max": 220,
        "tracks": [
            "Solar8000/ART_SBP",   "Solar8000/ART1_SBP",
            "Solar8000/ABP_SBP",   "Solar8000/IBP1_SBP",
            "B1x5M/ART1_SBP",      "Bx50/ART1_SBP",
            "Demo/ART_SBP",
            # NBP fallback (non-invasive cuff) — used when no arterial line
            "Solar8000/NIBP_SBP",  "Solar8000/NBP_SBP",
            "Demo/NBP_SBP",        "B1x5M/NBP_SBP",
            "Solar 8000/ART_SBP",  "IntelliVue/ART_SBP",
            "Dash/ART_SBP",        "ART_SBP",
        ],
    },
    "art_dbp": {
        "label": "ART DBP",
        "unit": "mmHg",
        "device": "patient_monitor",
        "reference": "50–90 mmHg",
        "valid_min": 30,
        "valid_max": 150,
        "tracks": [
            "Solar8000/ART_DBP",   "Solar8000/ART1_DBP",
            "Solar8000/ABP_DBP",   "Solar8000/IBP1_DBP",
            "B1x5M/ART1_DBP",      "Bx50/ART1_DBP",
            "Demo/ART_DBP",
            # NBP fallback
            "Solar8000/NIBP_DBP",  "Solar8000/NBP_DBP",
            "Demo/NBP_DBP",        "B1x5M/NBP_DBP",
            "Solar 8000/ART_DBP",  "IntelliVue/ART_DBP",
            "Dash/ART_DBP",        "ART_DBP",
        ],
    },
    "art_map": {
        "label": "ART MAP",
        "unit": "mmHg",
        "device": "patient_monitor",
        "reference": "60–100 mmHg",
        "valid_min": 30,
        "valid_max": 200,
        "tracks": [
            "Solar8000/ART_MBP",
            "Solar8000/ART1_MBP",
            "Solar8000/ABP_MBP",
            "Solar8000/IBP1_MBP",
            "Demo/ART_MBP",
            "Solar 8000/ART_MBP",
            "IntelliVue/ART_MBP",
            "Dash/ART_MBP",
            "ART_MBP",
            "ART",
        ],
    },
    "co2": {
        "label": "CO₂",
        "unit": "mmHg",
        "device": "anesthesia_machine",
        "reference": "35–45 mmHg",
        "valid_min": 20,
        "valid_max": None,
        "tracks": [
            "Solar8000/ETCO2",
            "Primus/ETCO2",
            "Demo/ETCO2",
            "Primus/ETCO2_MMHG",
            "Solar 8000/ETCO2",
            "IntelliVue/ETCO2",
            "ETCO2",
        ],
    },
    "bis": {
        "label": "BIS",
        "unit": "index",
        "device": "bis_monitor",
        "reference": "40–60",
        "valid_min": 20,
        "valid_max": 100,
        "tracks": [
            "BIS/BIS",
            "BIS/BIS_INDEX",
            "BIS/EEG_BIS",
            "BIS/VALUE",
            "BISX/BIS",
            "BIS",
        ],
    },
}


WAVE_TRACK_CANDIDATES = {
    "ecg": [
        "Solar8000/ECG_II",
        "Solar8000/ECG1",
        "Solar 8000/ECG_II",
        "IntelliVue/ECG_II",
        "SNUADC/ECG_II",
        "ECG/II",
        "ECG_II",
    ],
    "art": [
        "Solar8000/ART1",
        "Solar8000/ART",
        "Solar8000/IBP1",
        "Solar 8000/ART1",
        "IntelliVue/ART",
        "ART",
        "ABP",
    ],
    "pleth": [
        "Solar8000/PLETH",
        "Solar 8000/PLETH",
        "IntelliVue/PLETH",
        "PLETH",
        "Pleth",
    ],
    "co2": [
        "Primus/CO2",
        "Primus/CO2_WAVE",
        "Solar8000/CO2",
        "Solar 8000/CO2",
        "IntelliVue/CO2",
        "CO2",
    ],
}


def _ensure_vitaldb_available() -> None:
    if VitalFile is None:
        raise RuntimeError(
            "vitaldb is not installed. Install requirements.txt before reading .vital files."
        )


def _format_time(seconds: float | int | None) -> str:
    if seconds is None:
        return "—"
    total   = max(int(seconds), 0)
    hours   = total // 3600
    minutes = (total % 3600) // 60
    secs    = total % 60
    if hours:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def _round_number(value: float | None, decimals: int = 1) -> float | int | None:
    if value is None or not math.isfinite(value):
        return None
    rounded = round(float(value), decimals)
    if float(rounded).is_integer():
        return int(rounded)
    return rounded


def _to_float_array(values: Any) -> np.ndarray:
    if values is None:
        return np.array([], dtype=float)

    try:
        arr = np.asarray(values, dtype=float)
    except Exception:
        cleaned = []
        for value in list(values):
            try:
                cleaned.append(float(value))
            except Exception:
                cleaned.append(np.nan)
        arr = np.asarray(cleaned, dtype=float)

    if arr.ndim == 0:
        arr = np.asarray([float(arr)], dtype=float)

    return arr.reshape(-1)


def _get_available_tracks(vf: Any) -> list[str]:
    if hasattr(vf, "get_track_names"):
        try:
            names = list(vf.get_track_names())
            if names:
                return names
        except Exception:
            pass

    trks = getattr(vf, "trks", None)
    if isinstance(trks, dict):
        return list(trks.keys())

    return []


def _find_track_name(vf: Any, candidates: list[str]) -> str | None:
    available = _get_available_tracks(vf)
    if not available:
        return None

    lower_map = {name.lower(): name for name in available}

    for candidate in candidates:
        exact = lower_map.get(candidate.lower())
        if exact:
            return exact

    for candidate in candidates:
        suffix = candidate.split("/")[-1].lower()
        for name in available:
            if name.split("/")[-1].lower() == suffix:
                return name

    return None


def _load_track_series(vf: Any, track_name: str, interval_seconds: float = 1.0) -> np.ndarray:
    try:
        values = vf.to_numpy(track_name, interval_seconds)
    except TypeError:
        values = vf.to_numpy(track_name)
    except Exception:
        return np.array([], dtype=float)

    return _to_float_array(values)


def _resolve_signal_series(
    vf: Any,
    signal_key: str,
    interval_seconds: float = 1.0,
) -> tuple[np.ndarray, str | None]:
    spec         = SIGNAL_SPECS[signal_key]
    direct_track = _find_track_name(vf, spec.get("tracks", []))
    if direct_track:
        return _load_track_series(vf, direct_track, interval_seconds), direct_track

    return np.array([], dtype=float), None


def _is_valid_value(value: float | int | None, signal_key: str) -> bool:
    spec = SIGNAL_SPECS[signal_key]

    if value is None:
        return False

    try:
        numeric = float(value)
    except Exception:
        return False

    if not math.isfinite(numeric) or numeric == 0:
        return False

    valid_min = spec.get("valid_min")
    valid_max = spec.get("valid_max")

    if valid_min is not None and numeric < float(valid_min):
        return False
    if valid_max is not None and numeric > float(valid_max):
        return False

    return True


def find_first_stable_valid_value(
    series: Any,
    signal_key: str,
    stable_samples: int = 5,
) -> dict[str, Any] | None:
    """
    Find the first run of consecutive valid samples in a signal series.

    Sensor warm-up often produces invalid readings at the start of a
    recording. This function skips those by requiring ``stable_samples``
    consecutive valid values before accepting a reading as reliable.

    Args:
        series:         Array-like of numeric samples (may contain NaN).
        signal_key:     Key into ``SIGNAL_SPECS`` used to look up the
                        physiological validity range (e.g. ``"hr"``).
        stable_samples: Minimum number of consecutive valid samples
                        required before the first value is accepted.

    Returns:
        A dict with ``index`` (int), ``value`` (float), and
        ``stableSamples`` (int), or None if no stable run is found.
    """
    arr = _to_float_array(series)
    if arr.size == 0:
        return None

    run_start: int | None = None
    run_length = 0

    for index, value in enumerate(arr):
        if _is_valid_value(value, signal_key):
            if run_start is None:
                run_start = index
            run_length += 1
            if run_length >= stable_samples:
                return {
                    "index": int(run_start),
                    "value": float(arr[run_start]),
                    "stableSamples": stable_samples,
                }
        else:
            run_start  = None
            run_length = 0

    return None


def _downsample_points(
    points: list[dict[str, float]], max_points: int = 240
) -> list[dict[str, float]]:
    if len(points) <= max_points:
        return points

    step    = max(len(points) / max_points, 1)
    sampled: list[dict[str, float]] = []
    index   = 0.0
    while int(index) < len(points):
        sampled.append(points[int(index)])
        index += step

    if sampled[-1] != points[-1]:
        sampled.append(points[-1])

    return sampled


def _build_trend_points(
    series: Any,
    signal_key: str,
    interval_seconds: float = 1.0,
    start_index: int = 0,
) -> list[dict[str, float]]:
    arr = _to_float_array(series)
    if arr.size == 0:
        return []

    points: list[dict[str, float]] = []
    for index in range(max(start_index, 0), len(arr)):
        value = arr[index]
        if not _is_valid_value(value, signal_key):
            continue
        points.append(
            {
                "second": round(index * interval_seconds, 3),
                "value":  float(value),
            }
        )

    return _downsample_points(points)


def _build_stats(points: list[dict[str, float]]) -> dict[str, Any] | None:
    if not points:
        return None

    values = np.asarray([point["value"] for point in points], dtype=float)
    return {
        "count": int(values.size),
        "min":   _round_number(float(np.min(values))),
        "max":   _round_number(float(np.max(values))),
        "avg":   _round_number(float(np.mean(values))),
    }


def _signal_payload(
    signal_key: str,
    series: Any,
    track_name: str | None,
    interval_seconds: float = 1.0,
    stable_samples: int = 5,
) -> dict[str, Any]:
    spec        = SIGNAL_SPECS[signal_key]
    arr         = _to_float_array(series)
    first_valid = find_first_stable_valid_value(arr, signal_key, stable_samples=stable_samples)
    start_index = first_valid["index"] if first_valid else 0
    trend       = _build_trend_points(arr, signal_key, interval_seconds=interval_seconds, start_index=start_index)
    stats       = _build_stats(trend)

    first_valid_payload = None
    if first_valid:
        first_valid_payload = {
            "value":        _round_number(first_valid["value"]),
            "time":         _format_time(first_valid["index"] * interval_seconds),
            "second":       round(first_valid["index"] * interval_seconds, 3),
            "stableSamples": stable_samples,
        }

    return {
        "key":        signal_key,
        "label":      spec["label"],
        "unit":       spec["unit"],
        "deviceKey":  spec["device"],
        "reference":  spec["reference"],
        "validRange": {
            "min": spec.get("valid_min"),
            "max": spec.get("valid_max"),
        },
        "track":      track_name,
        "firstValid": first_valid_payload,
        "stats":      stats,
        "trend":      trend,
        "sampleCount": int(arr.size),
    }


def _extract_duration_seconds(devices: list[dict[str, Any]]) -> int:
    last_second = 0.0
    for device in devices:
        for signal in device["signals"]:
            trend = signal.get("trend", [])
            if trend:
                last_second = max(last_second, float(trend[-1]["second"]))
            elif signal.get("firstValid"):
                last_second = max(last_second, float(signal["firstValid"]["second"]))
    return int(round(last_second))


def _make_snapshot_from_report(report_data: dict[str, Any]) -> dict[str, Any]:
    """
    FIX #9: Build a snapshot with tbp as 'sys/dia' string (matching what the
    rest of the UI expects) instead of a bare MAP number.
    """
    signal_map = {
        signal["key"]: signal
        for device in report_data.get("devices", [])
        for signal in device.get("signals", [])
    }

    def _fv(signal_key: str) -> float | int | None:
        signal      = signal_map.get(signal_key) or {}
        first_valid = signal.get("firstValid") or {}
        return first_valid.get("value")

    sbp_value = _fv("art_sbp")
    dbp_value = _fv("art_dbp")

    # Build "sys/dia" string; fall back to MAP if SBP/DBP not available
    if sbp_value is not None and dbp_value is not None:
        tbp_str = f"{sbp_value}/{dbp_value}"
    elif sbp_value is not None:
        tbp_str = f"{sbp_value}/—"
    else:
        map_value = _fv("art_map")
        tbp_str = f"{map_value}" if map_value is not None else "0/0"

    return {
        "ki":         "Loaded .vital",
        "pulse":      _fv("hr")      or 0,
        "tbp":        tbp_str,
        "o2_primary": _fv("spo2")    or 0,
        "etco2":      _fv("co2")     or 0,
        "bis":        _fv("bis")     or 0,
        # Fill remaining fields with 0 so the UI never shows undefined
        "temp":       0,
        "propofol":   0,
        "ketamin":    0,
        "fentanyl":   0,
        "isofluran":  0,
        "flow":       0,
        "o2_secondary": 0,
        "pmax":       0,
        "vt":         0,
        "frequency":  0,
        "mv":         0,
        "peep":       0,
    }


def extract_structured_report(
    vital_path: str | Path,
    interval_seconds: float = 1.0,
    stable_samples: int = 5,
) -> dict[str, Any]:
    """
    Parse a `.vital` file and return a structured signal report.

    Reads all signals defined in ``SIGNAL_SPECS``, computes per-signal
    statistics (min, max, average), down-samples trend points to at most
    240 data points for chart rendering, and finds the first stable valid
    value for each signal (skipping sensor warm-up noise).

    Args:
        vital_path:       Path to the `.vital` recording file.
        interval_seconds: Resampling interval passed to ``vitaldb``.
                          Use 1.0 for per-second resolution.
        stable_samples:   Consecutive valid samples required before the
                          first measurement is accepted.

    Returns:
        A nested dict with keys ``fileName``, ``filePath``,
        ``generatedAt``, ``durationSeconds``, ``durationLabel``,
        ``signalsFound``, ``devices`` (list of device dicts, each
        containing ``signals``), and ``snapshot`` (flat measurement dict
        for the live display panel).

    Raises:
        FileNotFoundError: If ``vital_path`` does not exist.
        RuntimeError:      If the ``vitaldb`` library is not installed.
    """
    _ensure_vitaldb_available()

    vital_path = Path(vital_path)
    if not vital_path.exists():
        raise FileNotFoundError(f".vital file not found: {vital_path}")

    vf = VitalFile(str(vital_path))
    signal_payloads: dict[str, dict[str, Any]] = {}

    for signal_key in SIGNAL_SPECS:
        series, track_name = _resolve_signal_series(vf, signal_key, interval_seconds=interval_seconds)
        signal_payloads[signal_key] = _signal_payload(
            signal_key,
            series,
            track_name,
            interval_seconds=interval_seconds,
            stable_samples=stable_samples,
        )

    devices: list[dict[str, Any]] = []
    for device in DEVICE_LAYOUT:
        devices.append(
            {
                "key":     device["key"],
                "label":   device["label"],
                "signals": [signal_payloads[key] for key in device["signals"]],
            }
        )

    duration_seconds = _extract_duration_seconds(devices)
    signals_with_values = sum(
        1
        for signal in signal_payloads.values()
        if signal.get("firstValid") is not None
    )

    snapshot = _make_snapshot_from_report({"devices": devices})

    report = {
        "fileName":             vital_path.name,
        "filePath":             str(vital_path),
        "generatedAt":          datetime.now().isoformat(timespec="seconds"),
        "stableSamplesRequired": stable_samples,
        "durationSeconds":      duration_seconds,
        "durationLabel":        _format_time(duration_seconds),
        "signalsFound":         signals_with_values,
        "devices":              devices,
        "snapshot":             snapshot,
    }
    return report


def extract_first_valid_measurements(
    vital_path: str | Path,
    interval_seconds: float = 1.0,
    stable_samples: int = 5,
) -> dict[str, Any]:
    return extract_structured_report(
        vital_path,
        interval_seconds=interval_seconds,
        stable_samples=stable_samples,
    )


# ─── Legacy timeline report (used by /record/latest and stop-recording) ───────

# Multi-candidate track lookup — covers Solar8000, Demo, B1x5M, Bx50, Primus devices.
# _find_track_name() also does suffix fallback so e.g. "Solar8000/HR" matches "Demo/HR".
LEGACY_TRACK_CANDIDATES: dict[str, list[str]] = {
    "pulse":     ["Solar8000/HR",        "B1x5M/HR",          "Bx50/HR",         "Demo/HR",        "IntelliVue/HR", "SNUADC/HR"],
    "art_sbp":   ["Solar8000/ART_SBP",   "B1x5M/ART1_SBP",  "Bx50/ART1_SBP",  "Demo/ART_SBP",
                  "Solar8000/NIBP_SBP", "Solar8000/NBP_SBP","Demo/NBP_SBP",   "B1x5M/NBP_SBP"],
    "art_dbp":   ["Solar8000/ART_DBP",   "B1x5M/ART1_DBP",  "Bx50/ART1_DBP",  "Demo/ART_DBP",
                  "Solar8000/NIBP_DBP", "Solar8000/NBP_DBP","Demo/NBP_DBP",   "B1x5M/NBP_DBP"],
    "temp":      ["Solar8000/BT",         "Demo/BT"],
    "spo2":      ["Solar8000/PLETH_SPO2", "B1x5M/PLETH_SPO2",  "Bx50/PLETH_SPO2", "Demo/PLETH_SPO2","Solar8000/SPO2"],
    "etco2":     ["Solar8000/ETCO2",      "Primus/ETCO2",       "Demo/ETCO2"],
    "frequency": ["Solar8000/VENT_RR",   "Solar8000/RR",       "Primus/RR_CO2",   "Demo/RR",        "Demo/RR_CO2"],
    "vt":        ["Solar8000/VENT_TV",   "Primus/TV",          "Demo/TV"],
    "mv":        ["Solar8000/VENT_MV",   "Primus/MV"],
    "peep":      ["Primus/PEEP_MBAR",    "Demo/PEEP"],
    "pmax":      ["Primus/PIP_MBAR",     "Solar8000/VENT_PIP", "Demo/PIP"],
    "fio2":      ["Primus/FIO2",         "Solar8000/FIO2"],
    "feo2":      ["Primus/FEO2",         "Solar8000/FEO2"],
}

# Keep old name as alias so nothing else breaks
LEGACY_TRACK_MAP = {k: v[0] for k, v in LEGACY_TRACK_CANDIDATES.items()}

LEGACY_REPORT_PARAMETERS = [
    {"key": "pulse",        "label": "HR"},
    {"key": "tbp",          "label": "TBP"},
    {"key": "temp",         "label": "Temp"},
    {"key": "o2_primary",   "label": "FiO₂"},
    {"key": "o2_secondary", "label": "FeO₂"},
    {"key": "pmax",         "label": "Pmax"},
    {"key": "vt",           "label": "Vt"},
    {"key": "frequency",    "label": "RR"},
    {"key": "mv",           "label": "MV"},
    {"key": "peep",         "label": "PEEP"},
    {"key": "etco2",        "label": "ETCO₂"},
]


def _legacy_last_valid(series: Any) -> float:
    arr = _to_float_array(series)
    arr = arr[np.isfinite(arr)]
    if arr.size == 0:
        return 0.0
    return float(arr[-1])


def _legacy_value_at_index(series: Any, index: int) -> float:
    arr = _to_float_array(series)
    if arr.size == 0:
        return 0.0
    index = max(0, min(index, arr.size - 1))
    value = arr[index]
    if np.isfinite(value):
        return float(value)

    left  = index - 1
    right = index + 1
    while left >= 0 or right < arr.size:
        if left >= 0 and np.isfinite(arr[left]):
            return float(arr[left])
        if right < arr.size and np.isfinite(arr[right]):
            return float(arr[right])
        left  -= 1
        right += 1
    return 0.0


def _legacy_first_valid_in_window(series: Any, start_index: int, end_index: int) -> float:
    arr = _to_float_array(series)
    if arr.size == 0 or start_index >= arr.size:
        return 0.0
    end_index = min(end_index, arr.size - 1)
    window    = arr[start_index : end_index + 1]
    window    = window[np.isfinite(window)]
    if window.size == 0:
        return 0.0
    return float(window[0])


def _legacy_last_valid_in_window(series: Any, start_index: int, end_index: int) -> float:
    arr = _to_float_array(series)
    if arr.size == 0 or start_index >= arr.size:
        return 0.0
    end_index = min(end_index, arr.size - 1)
    window    = arr[start_index : end_index + 1]
    window    = window[np.isfinite(window)]
    if window.size == 0:
        return 0.0
    return float(window[-1])


def _legacy_build_measurement(values: dict[str, float]) -> dict[str, Any]:
    sbp = _round_number(values.get("art_sbp"), 1) or 0
    dbp = _round_number(values.get("art_dbp"), 1) or 0

    # o2_primary = SpO2 (present on all devices); fall back to FiO2 if no SpO2 track
    spo2_val = values.get("spo2") or values.get("fio2")

    return {
        "ki":           "Real",
        "pulse":        _round_number(values.get("pulse"), 1)     or 0,
        "tbp":          f"{sbp}/{dbp}" if sbp or dbp else "0/0",
        "temp":         _round_number(values.get("temp"), 1)      or 0,
        "o2_primary":   _round_number(spo2_val, 1)               or 0,
        "propofol":     0,
        "ketamin":      0,
        "fentanyl":     0,
        "isofluran":    0,
        "flow":         0,
        "o2_secondary": _round_number(values.get("feo2"), 1)      or 0,
        "pmax":         _round_number(values.get("pmax"), 1)      or 0,
        "vt":           _round_number(values.get("vt"), 1)        or 0,
        "frequency":    _round_number(values.get("frequency"), 1) or 0,
        "mv":           _round_number(values.get("mv"), 1)        or 0,
        "peep":         _round_number(values.get("peep"), 1)      or 0,
        "etco2":        _round_number(values.get("etco2"), 1)     or 0,
    }


def _read_track_direct(vf: Any, track_name: str) -> np.ndarray:
    """
    Read every finite sample from a track's raw records, bypassing to_numpy.
    Used as a fallback when to_numpy fails or returns an all-NaN array.
    Values are returned in record order (oldest first); no resampling is applied.
    """
    trks  = getattr(vf, "trks", {}) or {}
    trk   = trks.get(track_name)
    if trk is None:
        return np.array([], dtype=float)
    samples: list[float] = []
    for rec in (getattr(trk, "recs", None) or []):
        vals = rec.get("val") if isinstance(rec, dict) else getattr(rec, "val", None)
        if vals is None:
            continue
        iterable = vals if hasattr(vals, "__iter__") else [vals]
        for v in iterable:
            try:
                fv = float(v)
                if math.isfinite(fv):
                    samples.append(fv)
            except (TypeError, ValueError):
                pass
    return np.array(samples, dtype=float) if samples else np.array([], dtype=float)


def _legacy_load_track_series(
    vf: Any, interval_seconds: float = 1.0
) -> tuple[dict[str, np.ndarray], int]:
    loaded: dict[str, np.ndarray] = {}
    lengths: list[int] = []

    for key, candidates in LEGACY_TRACK_CANDIDATES.items():
        # Discover the real track name stored in this file
        track_name = _find_track_name(vf, candidates)
        if not track_name:
            loaded[key] = np.array([], dtype=float)
            lengths.append(0)
            continue

        # Try to_numpy (time-aligned, 1 s intervals)
        arr = np.array([], dtype=float)
        try:
            arr = _to_float_array(vf.to_numpy(track_name, interval_seconds))
        except TypeError:
            try:
                arr = _to_float_array(vf.to_numpy(track_name))
            except Exception:
                pass
        except Exception:
            pass

        # If to_numpy gave us nothing useful, fall back to direct record reading
        if arr.size == 0 or not np.any(np.isfinite(arr)):
            arr = _read_track_direct(vf, track_name)

        loaded[key] = arr
        lengths.append(arr.size)

    total_points = max(lengths) if lengths else 0
    return loaded, total_points


def _legacy_measurement_from_window(
    series_map: dict[str, np.ndarray],
    start_index: int,
    end_index: int,
    mode: str = "first",
) -> dict[str, Any]:
    getter = _legacy_first_valid_in_window if mode == "first" else _legacy_last_valid_in_window
    values: dict[str, float] = {}
    for key in LEGACY_TRACK_CANDIDATES:
        values[key] = getter(series_map.get(key), start_index, end_index)
    return _legacy_build_measurement(values)


def _legacy_build_statistics(timeline: list[dict[str, Any]]) -> list[dict[str, Any]]:
    statistics: list[dict[str, Any]] = []
    for parameter in LEGACY_REPORT_PARAMETERS:
        key    = parameter["key"]
        values: list[float] = []
        for entry in timeline:
            raw_value = (entry.get("data") or {}).get(key)
            try:
                numeric = float(raw_value)
            except (TypeError, ValueError):
                continue
            if math.isfinite(numeric):
                values.append(numeric)
        if not values:
            continue
        statistics.append(
            {
                "key":     key,
                "label":   parameter["label"],
                "samples": len(values),
                "min":     round(min(values), 2),
                "max":     round(max(values), 2),
                "avg":     round(sum(values) / len(values), 2),
                "latest":  round(values[-1], 2),
            }
        )
    return statistics


def extract_report_timeseries(vital_path: str | Path) -> dict[str, Any]:
    """
    Parse a `.vital` file and return a per-minute timeline report.

    Divides the recording into 60-second windows and extracts the first
    and last valid measurement in each window for every tracked signal.
    This format matches what the frontend report table and SVG chart
    renderer expect.

    Args:
        vital_path: Path to the `.vital` recording file.

    Returns:
        A dict with keys ``firstMeasurement``, ``lastMeasurement``,
        ``minutes`` (list of per-minute dicts with ``first`` and
        ``last`` measurement snapshots), ``timeline`` (flat list of
        last-per-minute snapshots), ``statistics``, ``parameters``,
        and ``reportKind`` set to ``"timeline"``.

    Raises:
        FileNotFoundError: If ``vital_path`` does not exist.
        RuntimeError:      If the ``vitaldb`` library is not installed.
    """
    _ensure_vitaldb_available()
    vital_path = Path(vital_path)
    if not vital_path.exists():
        raise FileNotFoundError(f".vital file not found: {vital_path}")

    vf = VitalFile(str(vital_path))
    series_map, total_points = _legacy_load_track_series(vf, interval_seconds=1.0)

    empty_values = {key: 0.0 for key in LEGACY_TRACK_MAP}
    empty        = _legacy_build_measurement(empty_values)

    if total_points == 0:
        return {
            "firstMeasurement": {"time": "00:00", "data": empty},
            "lastMeasurement":  {"time": "00:00", "data": empty},
            "minutes":    [],
            "timeline":   [],
            "statistics": [],
            "parameters": LEGACY_REPORT_PARAMETERS,
            "reportKind": "timeline",
        }

    minutes: list[dict[str, Any]] = []
    for start_index in range(0, total_points, 60):
        end_index = min(start_index + 59, total_points - 1)
        first     = _legacy_measurement_from_window(series_map, start_index, end_index, "first")
        last      = _legacy_measurement_from_window(series_map, start_index, end_index, "last")
        minutes.append(
            {
                "minute": (start_index // 60) + 1,
                "from":   _format_time(start_index),
                "to":     _format_time(end_index),
                "first":  first,
                "last":   last,
            }
        )

    timeline = [
        {
            "time": item["to"],
            "data": item["last"],
        }
        for item in minutes
    ]

    return {
        "firstMeasurement": {
            "time": minutes[0]["from"],
            "data": minutes[0]["first"],
        },
        "lastMeasurement": {
            "time": minutes[-1]["to"],
            "data": minutes[-1]["last"],
        },
        "minutes":    minutes,
        "timeline":   timeline,
        "statistics": _legacy_build_statistics(timeline),
        "parameters": LEGACY_REPORT_PARAMETERS,
        "reportKind": "timeline",
    }


# ─── Raw waveform extraction ──────────────────────────────────────────────────

def _coerce_raw_wave_values(values: Any) -> list[float | None]:
    arr = _to_float_array(values)
    if arr.size == 0:
        return []
    result: list[float | None] = []
    for value in arr:
        if math.isfinite(float(value)):
            result.append(float(value))
        else:
            result.append(None)
    return result


def _extract_raw_wave_track(vf: Any, track_name: str) -> tuple[list[float | None], float]:
    trks  = getattr(vf, "trks", {}) or {}
    track = trks.get(track_name)
    if track is None:
        return [], 0.0

    srate = float(getattr(track, "srate", 0.0) or 0.0)
    recs  = getattr(track, "recs", None) or []
    if not recs:
        return [], srate

    samples: list[float | None] = []
    previous_end_time: float | None = None

    for rec in recs:
        raw_values = getattr(rec, "val", None)
        chunk      = _coerce_raw_wave_values(raw_values)
        if not chunk:
            continue

        start_time = getattr(rec, "dt",   None)
        if start_time is None:
            start_time = getattr(rec, "time", None)
        if start_time is None:
            start_time = getattr(rec, "t",    None)
        if start_time is None:
            start_time = getattr(rec, "ts",   None)

        if (
            previous_end_time is not None
            and start_time is not None
            and srate > 0
            and float(start_time) > previous_end_time
        ):
            gap_seconds = float(start_time) - previous_end_time
            missing     = int(round(gap_seconds * srate))
            if missing > 1:
                samples.extend([None] * min(missing, 5000))

        samples.extend(chunk)

        if start_time is not None and srate > 0:
            previous_end_time = float(start_time) + (len(chunk) / srate)
        else:
            previous_end_time = None

    return samples, srate


def extract_raw_waveforms(vital_path: str | Path) -> dict[str, dict[str, Any]]:
    """
    Extract high-frequency waveform data (ECG, arterial, pleth, CO₂).

    Unlike the numeric trend signals, waveforms are sampled at hundreds
    of Hz. Gaps between records are filled with ``None`` so the frontend
    renderer can draw breaks in the line rather than connecting across
    missing data.

    Args:
        vital_path: Path to the `.vital` recording file.

    Returns:
        A dict keyed by wave name (``"ecg"``, ``"art"``, ``"pleth"``,
        ``"co2"``). Each value is a dict with ``track`` (str or None),
        ``srate`` (float, samples per second), and ``samples``
        (list of float or None).

    Raises:
        FileNotFoundError: If ``vital_path`` does not exist.
        RuntimeError:      If the ``vitaldb`` library is not installed.
    """
    _ensure_vitaldb_available()

    vital_path = Path(vital_path)
    if not vital_path.exists():
        raise FileNotFoundError(f".vital file not found: {vital_path}")

    vf     = VitalFile(str(vital_path))
    result: dict[str, dict[str, Any]] = {}

    for wave_name, candidates in WAVE_TRACK_CANDIDATES.items():
        track_name = _find_track_name(vf, candidates)
        if not track_name:
            result[wave_name] = {
                "track":   None,
                "srate":   0,
                "samples": [],
            }
            continue

        samples, srate = _extract_raw_wave_track(vf, track_name)
        result[wave_name] = {
            "track":   track_name,
            "srate":   srate,
            "samples": samples,
        }

    return result
