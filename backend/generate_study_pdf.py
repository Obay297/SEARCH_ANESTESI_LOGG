"""

Generates a study PDF that explains every file and every function
in the anesthesia monitoring project in plain, simple language.


"""

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether,
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER

OUTPUT_FILE = "Code_Explanation_Study_Guide.pdf"

#  Colour palette 
DARK_BLUE   = colors.HexColor("#1a2a4a")
MID_BLUE    = colors.HexColor("#2c4a7c")
LIGHT_BLUE  = colors.HexColor("#e8f0fb")
ACCENT      = colors.HexColor("#f0a500")
CODE_BG     = colors.HexColor("#f4f6f8")
BORDER      = colors.HexColor("#c0cce0")
WHITE       = colors.white
TEXT        = colors.HexColor("#1a1a2e")

#  Styles 
base = getSampleStyleSheet()

def make_style(name, parent="Normal", **kwargs):
    return ParagraphStyle(name, parent=base[parent], **kwargs)

TITLE_STYLE = make_style(
    "MainTitle", "Title",
    fontSize=26, textColor=WHITE, alignment=TA_CENTER,
    spaceAfter=6, leading=32,
)
SUBTITLE_STYLE = make_style(
    "Subtitle", "Normal",
    fontSize=13, textColor=colors.HexColor("#c8d8f0"),
    alignment=TA_CENTER, spaceAfter=4,
)
CHAPTER_STYLE = make_style(
    "Chapter", "Heading1",
    fontSize=18, textColor=WHITE, leading=24,
    spaceBefore=4, spaceAfter=4,
)
FILE_HEADER_STYLE = make_style(
    "FileHeader", "Heading2",
    fontSize=14, textColor=DARK_BLUE, leading=18,
    spaceBefore=14, spaceAfter=2,
)
PURPOSE_STYLE = make_style(
    "Purpose", "Normal",
    fontSize=10, textColor=colors.HexColor("#2c3e50"),
    leading=15, spaceAfter=6,
    leftIndent=8,
)
DEF_NAME_STYLE = make_style(
    "DefName", "Normal",
    fontSize=11, textColor=MID_BLUE, leading=14,
    spaceBefore=8, spaceAfter=2,
    fontName="Helvetica-Bold",
)
DEF_BODY_STYLE = make_style(
    "DefBody", "Normal",
    fontSize=10, textColor=TEXT, leading=15,
    leftIndent=16, spaceAfter=2,
)
LABEL_STYLE = make_style(
    "Label", "Normal",
    fontSize=9, textColor=colors.HexColor("#555577"),
    leading=13, leftIndent=16, spaceAfter=1,
    fontName="Helvetica-Bold",
)
DETAIL_STYLE = make_style(
    "Detail", "Normal",
    fontSize=9, textColor=TEXT, leading=13,
    leftIndent=28, spaceAfter=1,
)
TIP_STYLE = make_style(
    "Tip", "Normal",
    fontSize=9, textColor=colors.HexColor("#5a3e00"),
    leading=13, leftIndent=8, spaceAfter=2,
    fontName="Helvetica-Oblique",
)
SECTION_STYLE = make_style(
    "Section", "Heading3",
    fontSize=12, textColor=DARK_BLUE, leading=16,
    spaceBefore=12, spaceAfter=4,
)

#  Builder helpers

def chapter_banner(title, subtitle=""):
    """Return a full-width coloured banner for a chapter heading."""
    data = [[Paragraph(title, CHAPTER_STYLE)]]
    if subtitle:
        data.append([Paragraph(subtitle, SUBTITLE_STYLE)])
    tbl = Table(data, colWidths=[17 * cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), MID_BLUE),
        ("ROUNDEDCORNERS", [6]),
        ("TOPPADDING",    (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
        ("LEFTPADDING",   (0, 0), (-1, -1), 14),
    ]))
    return tbl


def file_box(filename, language, purpose_text):
    """Return a styled box that introduces a source file."""
    lang_color = colors.HexColor("#2ecc71") if language == "Python" else colors.HexColor("#f39c12")
    data = [
        [
            Paragraph(f"<b>{filename}</b>", make_style(
                f"fn_{filename}", "Normal",
                fontSize=12, textColor=DARK_BLUE, fontName="Helvetica-Bold",
            )),
            Paragraph(language, make_style(
                f"lang_{filename}", "Normal",
                fontSize=9, textColor=WHITE, fontName="Helvetica-Bold",
                alignment=TA_CENTER,
            )),
        ],
        [
            Paragraph(purpose_text, PURPOSE_STYLE),
            "",
        ],
    ]
    tbl = Table(data, colWidths=[13.5 * cm, 3 * cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  LIGHT_BLUE),
        ("BACKGROUND",    (1, 0), (1, 0),   lang_color),
        ("BACKGROUND",    (0, 1), (-1, 1),  WHITE),
        ("BOX",           (0, 0), (-1, -1), 1, BORDER),
        ("LINEBELOW",     (0, 0), (-1, 0),  1, BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
        ("SPAN",          (0, 1), (1, 1)),
    ]))
    return tbl


def def_card(name, signature, what_it_does, inputs=None, returns=None, tip=None):
    """
    Return a styled card describing one function or method.

    Args:
        name:         Function/method name (str).
        signature:    Short call signature shown to the student (str).
        what_it_does: Plain-English explanation (str).
        inputs:       List of (param_name, description) tuples or None.
        returns:      What the function returns (str or None).
        tip:          Study tip for the student (str or None).
    """
    rows = []

    # Header row: function name + signature
    rows.append([
        Paragraph(f"def {name}()", DEF_NAME_STYLE),
        Paragraph(
            f'<font color="#888888" size="8">{signature}</font>',
            make_style("sig", "Normal", fontSize=8, textColor=colors.grey,
                       alignment=TA_LEFT, leading=12),
        ),
    ])

    # What it does
    rows.append([Paragraph(what_it_does, DEF_BODY_STYLE), ""])

    # Inputs
    if inputs:
        rows.append([Paragraph("Takes:", LABEL_STYLE), ""])
        for param, desc in inputs:
            rows.append([
                Paragraph(f"<b>{param}</b> — {desc}", DETAIL_STYLE), "",
            ])

    # Returns
    if returns:
        rows.append([Paragraph("Returns:", LABEL_STYLE), ""])
        rows.append([Paragraph(returns, DETAIL_STYLE), ""])

    # Study tip
    if tip:
        rows.append([Paragraph(f"Study tip: {tip}", TIP_STYLE), ""])

    tbl = Table(rows, colWidths=[12 * cm, 5 * cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  LIGHT_BLUE),
        ("BACKGROUND",    (0, 1), (-1, -1), WHITE),
        ("BOX",           (0, 0), (-1, -1), 1, BORDER),
        ("LINEBELOW",     (0, 0), (-1, 0),  1, BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ("SPAN",          (0, 1), (1, -1)),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ]))
    return tbl


def spacer(h=0.3):
    return Spacer(1, h * cm)


def hr():
    return HRFlowable(width="100%", thickness=1, color=BORDER, spaceAfter=4)


# Cover page
def build_cover():
    cover_data = [[
        Paragraph("Pig Anesthesia Monitoring", TITLE_STYLE),
        Paragraph("Code Explanation — Study Guide", SUBTITLE_STYLE),
        Spacer(1, 0.4 * cm),
        Paragraph(
            "This document explains every file and every function in the project "
            "in plain, simple language. Use it to understand the code before your "
            "exam so you can answer questions in your own words.",
            make_style("coverdesc", "Normal", fontSize=11,
                       textColor=colors.HexColor("#c8d8f0"),
                       alignment=TA_CENTER, leading=17),
        ),
    ]]
    tbl = Table(cover_data, colWidths=[17 * cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), DARK_BLUE),
        ("TOPPADDING",    (0, 0), (-1, -1), 30),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 30),
        ("LEFTPADDING",   (0, 0), (-1, -1), 20),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 20),
    ]))
    return [tbl, PageBreak()]


#Content 

def build_overview():
    items = [
        chapter_banner("Project Overview", "What the system does and how the pieces fit together"),
        spacer(0.5),
        Paragraph(
            "The project is a <b>real-time anesthesia monitoring system</b> for pig surgical "
            "experiments. It has two main parts that talk to each other:",
            PURPOSE_STYLE,
        ),
        spacer(0.2),
    ]

    overview_rows = [
        ["Part", "Language", "What it does"],
        ["Backend", "Python", "Runs a web server. Launches VitalRecorder, reads .vital files, streams live data."],
        ["Frontend", "JavaScript / HTML", "Shows the dashboard in the browser. Draws charts, captures patient info, generates reports."],
    ]
    tbl = Table(overview_rows, colWidths=[3.5 * cm, 3.5 * cm, 10 * cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  MID_BLUE),
        ("TEXTCOLOR",     (0, 0), (-1, 0),  WHITE),
        ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [WHITE, LIGHT_BLUE]),
        ("BOX",           (0, 0), (-1, -1), 1, BORDER),
        ("INNERGRID",     (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
    ]))
    items.append(tbl)
    items.append(spacer(0.4))

    items.append(Paragraph("How data flows during a recording:", SECTION_STYLE))
    steps = [
        ("1", "User fills in patient form and clicks Start Recording"),
        ("2", "Backend launches VitalRecorder.exe and creates a session folder"),
        ("3", "WebSocket streams live vital signs to the browser every second"),
        ("4", "Frontend logs a snapshot every 60 seconds"),
        ("5", "User clicks Stop Recording"),
        ("6", "Backend waits for the .vital file to finish writing, then parses it"),
        ("7", "Frontend draws SVG charts from the parsed data"),
    ]
    flow_rows = [[Paragraph(f"<b>{n}</b>", PURPOSE_STYLE), Paragraph(t, PURPOSE_STYLE)] for n, t in steps]
    flow_tbl = Table(flow_rows, colWidths=[1 * cm, 16 * cm])
    flow_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), WHITE),
        ("ROWBACKGROUNDS",(0, 0), (-1, -1), [WHITE, LIGHT_BLUE]),
        ("BOX",           (0, 0), (-1, -1), 1, BORDER),
        ("INNERGRID",     (0, 0), (-1, -1), 0.5, BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
    ]))
    items.append(flow_tbl)
    items.append(PageBreak())
    return items


def build_backend():
    items = [
        chapter_banner("Backend Files", "Python — runs on the server"),
        spacer(0.5),

        #  server.py 
        file_box("server.py", "Python",
            "The starting point of the whole backend. You run this file to start the server. "
            "It contains no functions — it just tells Python to launch the web server (Uvicorn) "
            "and load all the routes from backend_main.py."
        ),
        spacer(0.15),
        Paragraph("No functions to study in this file. Just remember: "
                  "run 'python server.py' to start everything.", TIP_STYLE),
        spacer(0.5),

        #  backend_config.py
        file_box("backend_config.py", "Python",
            "Stores all the important file paths and settings in one place. "
            "No functions — just variables. If you move the project to a new computer "
            "you only need to change this file."
        ),
        spacer(0.15),
        Paragraph(
            "Key variables: BASE_DIR (project folder), SESSIONS_DIR (where session JSON files are saved), "
            "RECORDINGS_ROOT (where VitalRecorder saves .vital files), "
            "VITAL_RECORDER_EXE (path to VitalRecorder.exe).",
            DEF_BODY_STYLE,
        ),
        spacer(0.5),

        #  backend_models.py
        file_box("backend_models.py", "Python",
            "Defines the shape of the data that travels between the frontend and backend. "
            "Uses Pydantic — a library that checks that the incoming data has the right fields "
            "and types before the backend processes it."
        ),
        spacer(0.15),
        Paragraph("Classes (not functions, but important to know):", LABEL_STYLE),
        Paragraph("<b>PatientData</b> — holds patient form fields: date, id, weight, medications, notes.", DETAIL_STYLE),
        Paragraph("<b>EventItem</b> — one timestamped event (e.g. 'Intubation at 00:05').", DETAIL_STYLE),
        Paragraph("<b>StartRecordingRequest</b> — what the frontend sends when the user clicks Start.", DETAIL_STYLE),
        Paragraph("<b>StopRecordingRequest</b> — includes the list of events logged during the procedure.", DETAIL_STYLE),
        Paragraph("<b>MonitoringExportRequest</b> — all data needed to build the Excel export.", DETAIL_STYLE),
        spacer(0.5),

        #  backend_sessions.py
        file_box("backend_sessions.py", "Python",
            "Manages one recording session at a time. A 'session' is a folder on disk that "
            "stores the patient data and events in a JSON file. This makes sure nothing is "
            "lost if the server crashes."
        ),
        spacer(0.15),
        KeepTogether([
            def_card(
                "create_session",
                "create_session(patient_data)",
                "Creates a new folder named with the current date and time "
                "(e.g. '20260101_143022'). Writes the patient data into a file called session.json. "
                "This is called when the user clicks Start Recording.",
                inputs=[("patient_data", "Dictionary of patient form fields (name, weight, etc.)")],
                returns="A dictionary with the session ID, the folder path, and the patient data.",
                tip="Think of this like opening a new patient file at the hospital front desk.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "save_events",
                "save_events(events)",
                "Adds the list of clinical events to the session.json file. "
                "Called when recording stops, so the final file contains both "
                "patient info and everything that happened during the procedure.",
                inputs=[("events", "List of event dicts, each with a time and a description.")],
                returns="Nothing (writes to disk only).",
                tip="Like writing the event log into the patient file before closing it.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "get_current",
                "get_current()",
                "Returns the session that is currently active, or None if no recording is running.",
                returns="The current session dictionary, or None.",
                tip="Used by the stop-recording endpoint to check there is actually something to stop.",
            ),
        ]),
        spacer(0.5),

        #  backend_reports.py
        file_box("backend_reports.py", "Python",
            "Creates a very simple HTML report file on the server. "
            "This is a placeholder — the real, detailed report with charts is built "
            "by the JavaScript frontend. This file is mainly used for debugging."
        ),
        spacer(0.15),
        KeepTogether([
            def_card(
                "generate_placeholder_report",
                "generate_placeholder_report(session_id)",
                "Writes a minimal HTML file that says 'Report for session X'. "
                "Saves it in the reports folder.",
                inputs=[("session_id", "The unique session identifier string.")],
                returns="The file path (Path object) where the HTML was saved.",
            ),
        ]),
        PageBreak(),

        #  backend_vitalrecorder.py
        file_box("backend_vitalrecorder.py", "Python",
            "Controls VitalRecorder — the external program that talks to the physical "
            "monitoring equipment. This module starts and stops the program, and finds "
            "the .vital file it creates."
        ),
        spacer(0.15),
        KeepTogether([
            def_card(
                "_safe_stem  (helper)",
                "_safe_stem(text)",
                "Cleans up a patient ID so it can be used as a filename. "
                "Removes characters that Windows does not allow in filenames "
                "like slashes, colons, and asterisks.",
                inputs=[("text", "Raw string, e.g. a patient ID like '42:A/B'.")],
                returns="A cleaned string safe to use in a filename, e.g. '42_A_B'.",
                tip="Windows does not allow : / \\ * ? < > | in filenames. This function strips them.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "VitalRecorderBridge.start",
                "bridge.start(desired_stem)",
                "Launches VitalRecorder.exe as a separate process. "
                "Records the time it started so we can later find the .vital file "
                "it created (ignoring older files from previous sessions). "
                "If VitalRecorder is already running, does nothing.",
                inputs=[("desired_stem", "Preferred filename for the recording, e.g. 'pig42_20260101'.")],
                returns="A dict saying whether it worked: {'ok': True, 'pid': 1234} or {'ok': False, 'message': '...'}.",
                tip="Like pressing the Record button on the physical device.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "VitalRecorderBridge.stop",
                "bridge.stop()",
                "Sends a stop signal to VitalRecorder and waits up to 15 seconds "
                "for the .vital file to finish writing. It checks every second whether "
                "the file size has stopped changing — that means writing is complete. "
                "Then renames the file using the patient ID.",
                returns="A dict with {'ok': True, 'vital_file': 'C:/path/to/file.vital'}.",
                tip="The 15-second wait is necessary because VitalRecorder keeps writing for a few seconds after you tell it to stop.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "VitalRecorderBridge.find_newest_vital_file",
                "bridge.find_newest_vital_file()",
                "Scans the recordings folder for .vital files. "
                "Returns the most recently modified one. If a recording is active, "
                "only looks at files that appeared after the recording started "
                "(so it does not accidentally return an old recording).",
                returns="A Path object pointing to the newest .vital file, or None if none exist.",
            ),
        ]),
        PageBreak(),
    ]
    return items


def build_vital_parser():
    items = [
        file_box("backend_vital_parser.py", "Python",
            "The most complex file in the project. Reads .vital files (a special binary format "
            "used by VitalRecorder) and converts them into plain Python dictionaries that "
            "the frontend can display as charts and tables. "
            "It handles signals from many different monitor brands by maintaining long lists "
            "of possible track names for each measurement."
        ),
        spacer(0.3),

        Paragraph("Key constants (not functions, but essential to understand):", SECTION_STYLE),
        Paragraph(
            "<b>SIGNAL_SPECS</b> — a dictionary that defines each vital sign: "
            "its label, unit, which device it comes from, the normal range, and "
            "all the possible track names it might have depending on which monitor brand is used.",
            DETAIL_STYLE,
        ),
        spacer(0.1),
        Paragraph(
            "<b>LEGACY_TRACK_CANDIDATES</b> — a simpler list of track names used by the "
            "older timeline report system.",
            DETAIL_STYLE,
        ),
        spacer(0.3),

        Paragraph("Private helper functions (start with underscore _):", SECTION_STYLE),
        spacer(0.1),

        KeepTogether([
            def_card(
                "_format_time  (helper)",
                "_format_time(seconds)",
                "Converts a number of seconds into a readable time string like '01:23' or '01:23:45'.",
                inputs=[("seconds", "Total elapsed seconds as a number.")],
                returns="A string like '05:42' (mm:ss) or '01:05:42' (hh:mm:ss).",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "_round_number  (helper)",
                "_round_number(value, decimals)",
                "Rounds a floating-point number. If the result is a whole number "
                "(e.g. 36.0) it returns an integer (36) instead of a float, "
                "which looks cleaner in the report.",
                inputs=[
                    ("value", "The number to round."),
                    ("decimals", "How many decimal places (default is 1)."),
                ],
                returns="A rounded int or float, or None if the input was invalid.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "_to_float_array  (helper)",
                "_to_float_array(values)",
                "Converts any kind of input (list, numpy array, single number) "
                "into a flat numpy array of floats. Invalid values become NaN. "
                "This is used before processing any signal data.",
                inputs=[("values", "Any array-like or scalar input.")],
                returns="A 1-dimensional numpy array of floats.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "_find_track_name  (helper)",
                "_find_track_name(vf, candidates)",
                "Looks inside the .vital file to find which track name to use "
                "for a given signal. It tries each candidate name in order. "
                "If no exact match is found, it tries matching just the last part "
                "of the name (e.g. 'HR' matches 'Solar8000/HR' and 'Demo/HR').",
                inputs=[
                    ("vf", "The open VitalFile object."),
                    ("candidates", "A list of track name strings to try, in priority order."),
                ],
                returns="The actual track name found in the file, or None.",
                tip="This is why the system works with many different monitor brands — it tries all known names.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "_is_valid_value  (helper)",
                "_is_valid_value(value, signal_key)",
                "Checks whether a measurement value is physiologically plausible. "
                "For example, a heart rate of 0 or 500 bpm is clearly wrong. "
                "The valid range for each signal is stored in SIGNAL_SPECS.",
                inputs=[
                    ("value", "The number to check."),
                    ("signal_key", "E.g. 'hr', 'spo2', 'co2' — used to look up the valid range."),
                ],
                returns="True if the value is within the valid range, False otherwise.",
            ),
        ]),
        spacer(0.3),

        Paragraph("Public functions (the ones called from backend_main.py):", SECTION_STYLE),
        spacer(0.1),

        KeepTogether([
            def_card(
                "find_first_stable_valid_value",
                "find_first_stable_valid_value(series, signal_key, stable_samples)",
                "Finds the first point in the recording where a signal is reliably working. "
                "At the start of a recording, sensors often give bad readings while warming up. "
                "This function skips those by requiring several consecutive valid values "
                "before accepting the reading.",
                inputs=[
                    ("series", "The full array of measurements for one signal."),
                    ("signal_key", "Which signal this is (used to check valid ranges)."),
                    ("stable_samples", "How many consecutive valid values are required (default 5)."),
                ],
                returns="A dict with the index and value of the first stable reading, or None.",
                tip="Like waiting for a thermometer to stabilise before reading the temperature.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "extract_structured_report",
                "extract_structured_report(vital_path, ...)",
                "The main parsing function. Opens a .vital file, reads every configured signal, "
                "finds the first stable value, computes statistics (min, max, average), "
                "and down-samples the data to 240 points for chart drawing. "
                "Returns everything the frontend needs to draw signal charts.",
                inputs=[
                    ("vital_path", "Full path to the .vital file on disk."),
                    ("interval_seconds", "How often to sample the data (1.0 = one per second)."),
                ],
                returns="A large nested dict: file info, duration, and a list of devices each containing signals with trends and stats.",
                tip="This is the function that turns a raw recording into a structured report.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "extract_report_timeseries",
                "extract_report_timeseries(vital_path)",
                "A second parser that produces a simpler, per-minute table format. "
                "It divides the recording into 60-second windows and picks the first "
                "and last valid value in each window. This is what the report table "
                "in the frontend displays.",
                inputs=[("vital_path", "Full path to the .vital file.")],
                returns="A dict with firstMeasurement, lastMeasurement, and a list of per-minute snapshots.",
                tip="Think of this as producing the table a nurse would fill in every minute during an operation.",
            ),
        ]),
        PageBreak(),
    ]
    return items


def build_main():
    items = [
        file_box("backend_main.py", "Python",
            "The heart of the backend. Defines all the API endpoints (URLs the frontend calls) "
            "and the WebSocket connection for real-time streaming. "
            "Also handles reading live data from VitalRecorder and mapping track names "
            "to the field names the frontend expects."
        ),
        spacer(0.3),

        Paragraph("REST API Endpoints:", SECTION_STYLE),
        spacer(0.1),

        KeepTogether([
            def_card(
                "health  (GET /health)",
                "GET /health",
                "A simple check that the backend is running. "
                "The frontend calls this on startup to confirm the server is reachable.",
                returns="{'ok': True}",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "select_source  (POST /source/select)",
                "POST /source/select",
                "Switches the data source between 'simulation' (fake data), "
                "'vitalrecorder' (real device), or 'latest-file' (load a saved recording). "
                "Stores the choice in memory so the WebSocket knows which source to use.",
                inputs=[("source", "One of: 'simulation', 'vitalrecorder', 'latest-file'.")],
                returns="{'ok': True, 'source': '...'}",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "start_recording  (POST /recording/start)",
                "POST /recording/start",
                "Creates a new session on disk and launches VitalRecorder. "
                "Also builds a filename for the recording based on the patient ID and date "
                "(e.g. 'pig42_20260101.vital').",
                inputs=[("patient", "PatientData object from the form.")],
                returns="Session ID, source name, and VitalRecorder start result.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "stop_recording  (POST /recording/stop)",
                "POST /recording/stop",
                "Stops VitalRecorder, saves the clinical events to disk, "
                "waits for the .vital file to finish, then parses it and "
                "returns both the structured report and the per-minute timeline "
                "so the frontend can immediately draw the charts.",
                inputs=[("events", "List of clinical events logged during the procedure.")],
                returns="Session ID, the two parsed reports, or an error message.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "load_latest_record  (GET /record/latest)",
                "GET /record/latest",
                "Finds the most recent .vital file and parses it. "
                "Used when the user wants to load and review a previous recording "
                "without starting a new one.",
                returns="Snapshot of last measurements, timeline report, and file info.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "export_monitoring_xlsx  (POST /export/monitoring-xlsx)",
                "POST /export/monitoring-xlsx",
                "Creates an Excel file with three sheets: session info, "
                "monitoring data (one row per measurement), and events. "
                "Sends the file directly to the browser as a download.",
                inputs=[("payload", "Patient data, list of measurement rows, and events.")],
                returns="An Excel (.xlsx) file sent as a streaming download.",
            ),
        ]),
        spacer(0.3),

        Paragraph("Private helper functions:", SECTION_STYLE),
        spacer(0.1),

        KeepTogether([
            def_card(
                "_zero_measurements  (helper)",
                "_zero_measurements()",
                "Returns a dictionary where every vital-sign field is set to zero. "
                "Used as a safe default when no real data is available — "
                "prevents the frontend from crashing on missing values.",
                returns="Dict with all vital-sign fields set to 0 or '0/0'.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "_fetch_vr_values_sync  (helper)",
                "_fetch_vr_values_sync()",
                "Makes an HTTP request to VitalRecorder's built-in API on port 14041 "
                "to get the current values of all monitored signals. "
                "This is a blocking (slow) call so it runs in a separate thread.",
                returns="Dict of {track_name: value} or None if VitalRecorder is unreachable.",
                tip="VitalRecorder must have its HTTP API enabled in its settings for this to work.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "_map_vr_tracks_to_measurements  (helper)",
                "_map_vr_tracks_to_measurements(raw)",
                "Translates raw track names from VitalRecorder (like 'Solar8000/HR') "
                "into the simple field names the frontend uses (like 'pulse'). "
                "When multiple track variants exist, uses the first one with a valid value. "
                "Rounds all values to 1 decimal place.",
                inputs=[("raw", "Dict of {track_name: raw_value} from VitalRecorder.")],
                returns="Flat dict with simple field names: {pulse, tbp, temp, o2_primary, ...}.",
                tip="This is the translation layer between medical monitor jargon and the frontend field names.",
            ),
        ]),
        spacer(0.3),

        Paragraph("WebSocket endpoint:", SECTION_STYLE),
        spacer(0.1),
        KeepTogether([
            def_card(
                "live_socket  (WebSocket /live)",
                "WebSocket /live",
                "Keeps an open connection to the browser and sends a new measurement "
                "every second. First tries to get data from VitalRecorder's HTTP API. "
                "If that fails, reads the .vital file VitalRecorder is currently writing. "
                "If both fail, sends all-zero values so the display does not crash.",
                tip="A WebSocket is like a phone call — the connection stays open and data flows continuously, "
                    "unlike a normal web request which asks one question and gets one answer.",
            ),
        ]),
        PageBreak(),
    ]
    return items


def build_frontend():
    items = [
        chapter_banner("Frontend Files", "JavaScript — runs in the browser"),
        spacer(0.5),

        # patient.js
        file_box("patient.js", "JavaScript",
            "Reads and manages the patient information form. "
            "Does not store any data itself — just reads from the form and "
            "returns a plain object that app.js can send to the backend."
        ),
        spacer(0.15),
        KeepTogether([
            def_card(
                "setAutomaticDate",
                "setAutomaticDate(form)",
                "Fills in today's date and current time in the date field automatically "
                "when the form is opened. Does nothing if the field already has a value, "
                "so a manually entered date is never overwritten.",
                inputs=[("form", "The HTML form element containing the date input.")],
                returns="Nothing — modifies the DOM directly.",
                tip="Saves the user from having to type the date every time.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "getPatientFormData",
                "getPatientFormData(form)",
                "Reads all the fields from the patient form (ID, weight, medications, etc.) "
                "and returns them as a plain JavaScript object. "
                "If the form is missing, returns an object with empty strings so "
                "the rest of the code never gets undefined values.",
                inputs=[("form", "The HTML form element.")],
                returns="An object with fields: date, id, project, participants, weight, sedationTime, intubationTime, tubeSize, drugName, notes.",
                tip="This object is sent to the backend when recording starts.",
            ),
        ]),
        spacer(0.5),

        #  waves.js
        file_box("waves.js", "JavaScript",
            "Draws waveforms (ECG, blood pressure, SpO2, CO2) on a canvas element. "
            "Handles gaps in the data by lifting the pen so broken signals "
            "appear as breaks in the line, not connected jumps."
        ),
        spacer(0.15),
        KeepTogether([
            def_card(
                "drawGrid  (private)",
                "drawGrid(ctx, width, height)",
                "Draws a faint blue grid in the background of the waveform canvas. "
                "Makes it look like a real medical monitor screen. "
                "Grid lines are spaced 24 pixels apart.",
                inputs=[
                    ("ctx", "The 2D drawing context of the canvas."),
                    ("width", "Canvas width in pixels."),
                    ("height", "Canvas height in pixels."),
                ],
                returns="Nothing — draws on the canvas directly.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "drawWave  (exported)",
                "drawWave(canvas, data, color)",
                "Draws a waveform line on the canvas. "
                "Automatically scales the y-axis to fit the min/max of the data. "
                "Skips null or NaN values and starts a new line segment after each gap. "
                "Shows a text message if there is no data.",
                inputs=[
                    ("canvas", "The HTML canvas element to draw on."),
                    ("data", "Array of numbers (or null for gaps)."),
                    ("color", "Line colour, default '#00ff88' (green)."),
                ],
                returns="Nothing.",
                tip="null values in the data array represent moments when the sensor lost signal.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "prepareWaveView  (exported)",
                "prepareWaveView(container)",
                "Smoothly scrolls the page so the waveform container is visible. "
                "Called after a waveform is loaded so the user does not have to scroll manually.",
                inputs=[("container", "The DOM element to scroll into view.")],
                returns="Nothing.",
            ),
        ]),
        spacer(0.5),

        #  simulator.js 
        file_box("simulator.js", "JavaScript",
            "Generates realistic fake vital signs for testing and demonstration "
            "when no physical equipment is connected. "
            "Uses mathematical sine waves at different speeds plus small random noise "
            "to simulate natural physiological variation."
        ),
        spacer(0.15),
        KeepTogether([
            def_card(
                "clamp  (private)",
                "clamp(value, min, max)",
                "Keeps a number within a safe range. "
                "If the value is too low it returns the minimum; too high returns the maximum. "
                "Used everywhere in the simulator to keep vital signs physiologically realistic.",
                inputs=[
                    ("value", "The number to limit."),
                    ("min", "Lowest allowed value."),
                    ("max", "Highest allowed value."),
                ],
                returns="The value, clamped between min and max.",
                tip="Example: clamp(150, 40, 120) returns 120. Prevents the simulated heart rate from going to impossible values.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "getClinicalCheck  (private)",
                "getClinicalCheck(pulse, systolic, temp, spo2, etco2)",
                "Looks at the key vital signs and decides the clinical status: "
                "'Stable' (all values normal), 'Observe' (borderline values), "
                "or 'Attention' (dangerous values that need immediate action). "
                "The thresholds are set for an anaesthetised pig.",
                inputs=[
                    ("pulse", "Heart rate in bpm."),
                    ("systolic", "Systolic blood pressure in mmHg."),
                    ("temp", "Body temperature in degrees C."),
                    ("spo2", "Peripheral oxygen saturation in %."),
                    ("etco2", "End-tidal CO2 in mmHg."),
                ],
                returns="'Stable', 'Observe', or 'Attention'.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "generateSimulatedSnapshot  (private)",
                "generateSimulatedSnapshot(t)",
                "Calculates all vital signs at a given second 't'. "
                "Each signal uses overlapping sine waves (slow ~3 min, medium ~30 s, fast ~8 s) "
                "plus random noise, then clamps the result to a safe range. "
                "This makes the simulation look natural rather than perfectly flat.",
                inputs=[("t", "Elapsed time in seconds since the simulation started.")],
                returns="An object with all vital-sign fields: pulse, systolic, diastolic, temp, propofol, etc.",
                tip="The slow sine wave models gradual drug effects. The fast sine models breath-to-breath variation.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "createSimulator  (exported)",
                "createSimulator({ durationSeconds, stepMs, onUpdate, onComplete })",
                "Factory function — creates and returns a simulator object with four methods: "
                "start(), stop(), addEvent(), and getState(). "
                "When started, it fires a 'tick' every stepMs milliseconds, "
                "records a minute measurement every 60 seconds, "
                "and calls onComplete when the duration runs out.",
                inputs=[
                    ("durationSeconds", "How long the simulation runs (e.g. 1200 for 20 minutes)."),
                    ("stepMs", "Milliseconds between ticks (1000 = real-time)."),
                    ("onUpdate", "Callback called each second with the new snapshot and state."),
                    ("onComplete", "Callback called when the simulation finishes."),
                ],
                returns="An object: { start, stop, addEvent, getState }.",
                tip="This is the 'engine' — app.js calls createSimulator() and then calls .start() when the user clicks the button.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "renderSnapshotToUI  (exported)",
                "renderSnapshotToUI(metricElements, data)",
                "Writes all the vital-sign values from a snapshot into the HTML elements "
                "on the live monitoring panel. Formats each number with the correct "
                "units (bpm, mmHg, ml/t, etc.).",
                inputs=[
                    ("metricElements", "A map of field name to DOM element."),
                    ("data", "A raw snapshot object from generateSimulatedSnapshot()."),
                ],
                returns="Nothing — updates the DOM directly.",
            ),
        ]),
        spacer(0.2),
        KeepTogether([
            def_card(
                "updateSimulationIndicators  (exported)",
                "updateSimulationIndicators(elements, state)",
                "Updates the status text and button states based on whether the simulation "
                "is running, complete, or idle. Shows elapsed and remaining time in the status bar.",
                inputs=[
                    ("elements", "DOM elements: liveDataStatus, simulationStatusPill, startSimulationButton."),
                    ("state", "Current simulator state from getState()."),
                ],
                returns="Nothing.",
            ),
        ]),
        PageBreak(),
    ]
    return items


def build_exam_tips():
    items = [
        chapter_banner("Exam Preparation", "Questions you should be able to answer"),
        spacer(0.5),
    ]

    questions = [
        ("What does the WebSocket endpoint do and why is it used instead of regular HTTP requests?",
         "The WebSocket keeps a permanent open connection so the server can push data to the browser every second without the browser having to ask each time. A normal HTTP request would require the browser to ask 'any new data?' every second — less efficient and adds delay."),

        ("Why does the backend wait 15 seconds after stopping VitalRecorder before reading the file?",
         "VitalRecorder keeps writing to the .vital file for a few seconds after it receives the stop signal. If we read the file too early it will be incomplete. The code checks every second whether the file size has stopped growing, which means writing is finished."),

        ("What is 'stable_samples' in the vital parser and why is it needed?",
         "At the start of a recording, sensors often produce invalid readings while warming up (e.g. a heart rate of 0 or 999). stable_samples (default 5) means the code requires 5 consecutive valid readings before it accepts the first measurement. This filters out warm-up noise."),

        ("Why are there so many track name candidates for each signal (e.g. Solar8000/HR, Demo/HR, IntelliVue/HR...)?",
         "Different monitor brands store the same signal under different names in the .vital file. The system tries each candidate in order and uses the first one it finds. This makes the parser work with multiple hospital equipment brands without separate code for each."),

        ("What is the difference between extract_structured_report and extract_report_timeseries?",
         "extract_structured_report returns per-signal statistics and down-sampled trend points — used to draw SVG charts. extract_report_timeseries returns per-minute first/last snapshots — used for the table in the report. Both read the same .vital file but produce different output formats."),

        ("What happens if VitalRecorder's HTTP API is not enabled?",
         "The WebSocket handler first tries the HTTP API. If that returns nothing (None), it falls back to directly reading the .vital file that VitalRecorder is currently writing. If that also fails, it sends all-zero values so the frontend does not crash."),

        ("Why is Pydantic used for the request models?",
         "Pydantic validates incoming JSON automatically. If the frontend sends a request with missing or wrong-type fields, FastAPI returns a clear error immediately instead of crashing somewhere deep in the code. It also generates the API documentation automatically."),
    ]

    for i, (q, a) in enumerate(questions, 1):
        data = [
            [Paragraph(f"Q{i}: {q}", make_style(f"q{i}", "Normal", fontSize=10,
                       fontName="Helvetica-Bold", textColor=DARK_BLUE, leading=14))],
            [Paragraph(a, make_style(f"a{i}", "Normal", fontSize=9,
                       textColor=TEXT, leading=14, leftIndent=8))],
        ]
        tbl = Table(data, colWidths=[17 * cm])
        tbl.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, 0),  LIGHT_BLUE),
            ("BACKGROUND",    (0, 1), (-1, 1),  WHITE),
            ("BOX",           (0, 0), (-1, -1), 1, BORDER),
            ("LINEBELOW",     (0, 0), (-1, 0),  1, BORDER),
            ("TOPPADDING",    (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING",   (0, 0), (-1, -1), 10),
        ]))
        items.append(KeepTogether([tbl]))
        items.append(spacer(0.25))

    return items


# Page template

def on_page(canvas, doc):
    """Draw header and footer on every page."""
    canvas.saveState()
    w, h = A4

    # Header bar
    canvas.setFillColor(DARK_BLUE)
    canvas.rect(0, h - 1.2 * cm, w, 1.2 * cm, fill=1, stroke=0)
    canvas.setFillColor(WHITE)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.drawString(1.5 * cm, h - 0.8 * cm, "Pig Anesthesia Monitoring — Code Study Guide")
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(w - 1.5 * cm, h - 0.8 * cm, "Confidential — Academic Use")

    # Footer
    canvas.setFillColor(BORDER)
    canvas.rect(0, 0, w, 0.9 * cm, fill=1, stroke=0)
    canvas.setFillColor(colors.HexColor("#444466"))
    canvas.setFont("Helvetica", 8)
    canvas.drawCentredString(w / 2, 0.3 * cm, f"Page {doc.page}")

    canvas.restoreState()


#Main

def main():
    doc = SimpleDocTemplate(
        OUTPUT_FILE,
        pagesize=A4,
        topMargin=1.6 * cm,
        bottomMargin=1.4 * cm,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
    )

    story = []
    story += build_cover()
    story += build_overview()
    story += build_backend()
    story += build_vital_parser()
    story += build_main()
    story += build_frontend()
    story += build_exam_tips()

    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
    print(f"PDF created: {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
