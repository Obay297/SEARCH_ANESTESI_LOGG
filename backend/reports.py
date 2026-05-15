"""
backend_reports.py

Utility for generating placeholder HTML reports on the backend.

The full, chart-rich report is assembled by the JavaScript frontend.
This module produces a minimal HTML file that confirms a session
exists — useful for debugging or as a fallback when the frontend is
unavailable.
"""

from pathlib import Path

from backend_config import REPORTS_DIR


def generate_placeholder_report(session_id: str) -> Path:
    
    report_path = REPORTS_DIR / f"{session_id}.html"

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Report {session_id}</title>
</head>
<body>
  <h1>Generated Report</h1>
  <p>Session: {session_id}</p>
  <p>This is a temporary backend-generated report.</p>
</body>
</html>
"""
    report_path.write_text(html, encoding="utf-8")
    return report_path
