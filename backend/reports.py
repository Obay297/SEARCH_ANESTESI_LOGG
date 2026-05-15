"""
A tool for creating temporary HTML reports in the backend.
This module produces a simple HTML file confirming the existence of a session.
This is useful for debugging or as a workaround if the frontend is unavailable.
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
