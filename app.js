//The app.js controller handles live streaming, recording sessions, 
//demo simulations, user interface updates, report generation, 
//event logging, data export, and WebSocket connection to the backend server.

import { setAutomaticDate, getPatientFormData } from './patient.js';

import { printReport, buildReportData, renderPrintableReport, setReportViewMode, getReportViewMode, setDisplayInterval } from './report.js';
// Import patient form helper functions from patient.js
import {
  initPigMonitoring,
  ensurePigMonitoringVisible,
  resetPigMonitoring,
  pushPigMonitoringData,
  getPigMonitoringExportPayload,
  setPigMonitoringEvents
} from './pig-monitoring.js';
 
const BRIDGE_HTTP = 'http://127.0.0.1:8001';
const BRIDGE_WS   = 'ws://127.0.0.1:8001/live';
 
const LATEST_REPORT_FIELDS = [
  { key: 'pulse',        label: 'HR' },
  { key: 'tbp',          label: 'TBP' },
  { key: 'temp',         label: 'Temp' },
  { key: 'o2_primary',   label: 'FiO₂' },
  { key: 'o2_secondary', label: 'FeO₂' },
  { key: 'pmax',         label: 'Pmax' },
  { key: 'vt',           label: 'Vt' },
  { key: 'frequency',    label: 'RR' },
  { key: 'mv',           label: 'MV' },
  { key: 'peep',         label: 'PEEP' },
  { key: 'etco2',        label: 'ETCO₂' }
];
 

 
const elements = {
  simulationModeButton:     document.getElementById('btn-simulation-mode'),
  experimentalValuesButton: document.getElementById('btn-experimental-values'),
  showMonitoringButton:     document.getElementById('btn-show-monitoring'),
  startRecordingButton:     document.getElementById('btn-start-recording'),
  stopRecordingButton:      document.getElementById('btn-stop-recording'),
  loadLatestRecordButton:   document.getElementById('btn-load-latest-record') || document.getElementById('btn-data-analysis'),
  printReportButton:        document.getElementById('btn-print-report'),
  printReportRoot:          document.getElementById('print-report-root'),
  exportButton:             document.getElementById('btn-export-monitoring-excel'),
  addEventButton:           document.getElementById('btn-add-event'),
  eventNoteInput:           document.getElementById('input-event-note'),
  eventLogList:             document.getElementById('event-log-list'),
  patientForm:              document.getElementById('patient-form'),
  liveDataStatus:           document.getElementById('live-data-status'),
  simulationStatusPill:     document.getElementById('simulation-status-pill'),
  currentSourceLabel:       document.getElementById('current-source-label'),
  bridgeStatusLabel:        document.getElementById('bridge-status-label'),
  reportPreview:            document.getElementById('final-report-preview'),
 
  // Latest record panel
  loadedRecordStatus:  document.getElementById('loaded-record-status'),
  latestRecordSummary: document.getElementById('latest-record-summary'),
  minuteReportTable:   document.getElementById('minute-report-table'),
 
  metrics: {
    ki:           document.querySelector('[data-parameter="ki"]'),
    pulse:        document.querySelector('[data-parameter="pulse"]'),
    tbp:          document.querySelector('[data-parameter="tbp"]'),
    temp:         document.querySelector('[data-parameter="temp"]'),
    o2_primary:   document.querySelector('[data-parameter="o2_primary"]'),
    propofol:     document.querySelector('[data-parameter="propofol"]'),
    ketamin:      document.querySelector('[data-parameter="ketamin"]'),
    fentanyl:     document.querySelector('[data-parameter="fentanyl"]'),
    isofluran:    document.querySelector('[data-parameter="isofluran"]'),
    flow:         document.querySelector('[data-parameter="flow"]'),
    o2_secondary: document.querySelector('[data-parameter="o2_secondary"]'),
    pmax:         document.querySelector('[data-parameter="pmax"]'),
    vt:           document.querySelector('[data-parameter="vt"]'),
    frequency:    document.querySelector('[data-parameter="frequency"]'),
    mv:           document.querySelector('[data-parameter="mv"]'),
    peep:         document.querySelector('[data-parameter="peep"]'),
    etco2:        document.querySelector('[data-parameter="etco2"]')
  }
};
 
const pigRefs = {
  panel:    document.getElementById('pig-monitoring-panel'),
  timeline: document.getElementById('monitor-events-strip'),
 
  status: {
    hr:   document.getElementById('status-hr'),
    temp: document.getElementById('status-temp'),
    bp:   document.getElementById('status-bp'),
    resp: document.getElementById('status-resp'),
    vt:   document.getElementById('status-vt'),
    mv:   document.getElementById('status-mv')
  },
 
  ranges: {
    hr:   document.getElementById('range-hr'),
    temp: document.getElementById('range-temp'),
    bp:   document.getElementById('range-bp'),
    resp: document.getElementById('range-resp'),
    vt:   document.getElementById('range-vt'),
    mv:   document.getElementById('range-mv')
  },
 \\
  dashboard: {
    vtValue:         document.getElementById('monitor-vt-value'),
    respValue:       document.getElementById('monitor-resp-value'),
    peepValue:       document.getElementById('monitor-peep-value'),
    o2Value:         document.getElementById('monitor-o2-value'),
    o2TileValue:     document.getElementById('monitor-o2-tile-value'),
    flowValue:       document.getElementById('monitor-flow-value'),
    etco2Value:      document.getElementById('monitor-etco2-value'),
    hrValue:         document.getElementById('monitor-hr-value'),
    bpValue:         document.getElementById('monitor-bp-value'),
    tempValue:       document.getElementById('monitor-temp-value'),
    mvValue:         document.getElementById('monitor-mv-value'),
    medicationChart: document.getElementById('monitor-medication-chart'),
    vitalsChart:     document.getElementById('monitor-vitals-chart'),
    etco2Chart:      document.getElementById('monitor-etco2-chart'),
    ecgChart:        document.getElementById('monitor-ecg-chart'),
    // Bar gauge fill elements
    vtBar:           document.getElementById('bar-vt'),
    respBar:         document.getElementById('bar-resp'),
    peepBar:         document.getElementById('bar-peep'),
    pmaxBar:         document.getElementById('bar-pmax'),
    pmaxBarValue:    document.getElementById('monitor-pmax-bar-value'),
    spo2Bar:         document.getElementById('bar-spo2'),
    flowBar:         document.getElementById('bar-flow'),
  }
};
 
// State

let liveSocket               = null;
let currentSource            = 'simulation';
let experimentalInterval     = null;
let experimentalModeActive   = false;
let recordingIntervalSeconds = 60;    // set by the interval prompt modal
let loadedVitalData          = null;  // data from the most recently loaded .vital file

const recorderState = {
  recording:          false,
  elapsedSeconds:     0,
  durationSeconds:    4 * 3600,   // default 4 h; overwritten from duration selector on start
  sessionName:        null,
  firstMeasurement:   null,
  lastMeasurement:    null,
  minuteMeasurements: [],
  timepointMarkers:   [],
  eventLog:           [],
  latestSnapshot:     null
};
 
// Utilities 
 
function formatClockFromSeconds(totalSeconds) {
  const s   = Math.max(0, Math.floor(totalSeconds));
  const hh  = Math.floor(s / 3600);
  const mm  = Math.floor((s % 3600) / 60);
  const ss  = s % 60;
  const pad = n => String(n).padStart(2, '0');
  if (hh > 0) return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
  return `${pad(mm)}:${pad(ss)}`;
}
 
function getZeroSnapshot() {
  return {
    pulse: 0, tbp: '0/0', temp: 0, o2_primary: 0,
    propofol: 0, ketamin: 0, fentanyl: 0, isofluran: 0,
    flow: 0, o2_secondary: 0, pmax: 0, vt: 0,
    frequency: 0, mv: 0, peep: 0, etco2: 0
  };
}
 
// UI updates
function updateIndicators() {
  elements.currentSourceLabel.textContent = currentSource;
 
  if (recorderState.recording) {
    const remaining = Math.max(recorderState.durationSeconds - recorderState.elapsedSeconds, 0);
    elements.liveDataStatus.textContent =
      `Recording • ⏱ ${formatClockFromSeconds(remaining)}`;
    elements.simulationStatusPill.textContent =
      currentSource === 'experimental' ? 'Experimental' : 'Recording';
    elements.bridgeStatusLabel.textContent =
      currentSource === 'experimental' ? 'Experimental' : 'Streaming';
    elements.startRecordingButton.disabled = true;
    elements.stopRecordingButton.disabled  = false;
  } else {
    elements.liveDataStatus.textContent       = 'Prepared for real-time values';
    elements.simulationStatusPill.textContent = 'Idle';
    elements.bridgeStatusLabel.textContent    = 'Ready';
    elements.startRecordingButton.disabled    = false;
    elements.stopRecordingButton.disabled     = true;
  }
}
 
function renderEventLog(eventLog) {
  if (!eventLog.length) {
    elements.eventLogList.innerHTML = '<div class="event-log-empty">No events recorded yet.</div>';
    return;
  }
  elements.eventLogList.innerHTML = eventLog.map(item => `
    <div class="event-log-item">
      <span class="event-log-time">${item.displayTime}</span>
      <div class="event-log-text">${item.text}</div>
    </div>
  `).join('');
}
 
function measurementSummary(data) {
  return {
    ki:           data.ki           ?? '',
    pulse:        data.pulse        != null ? String(data.pulse)        : '',
    tbp:          data.tbp          ?? '',
    temp:         data.temp         != null ? String(data.temp)         : '',
    o2_primary:   data.o2_primary   != null ? String(data.o2_primary)   : '',
    propofol:     data.propofol     != null ? String(data.propofol)     : '',
    ketamin:      data.ketamin      != null ? String(data.ketamin)      : '',
    fentanyl:     data.fentanyl     != null ? String(data.fentanyl)     : '',
    isofluran:    data.isofluran    != null ? String(data.isofluran)    : '',
    flow:         data.flow         != null ? String(data.flow)         : '',
    o2_secondary: data.o2_secondary != null ? String(data.o2_secondary) : '',
    pmax:         data.pmax         != null ? String(data.pmax)         : '',
    vt:           data.vt           != null ? String(data.vt)           : '',
    frequency:    data.frequency    != null ? String(data.frequency)    : '',
    mv:           data.mv           != null ? String(data.mv)           : '',
    peep:         data.peep         != null ? String(data.peep)         : '',
    etco2:        data.etco2        != null ? String(data.etco2)        : ''
  };
}
 
function updateMeasurementLog(data) {
  const time    = formatClockFromSeconds(recorderState.elapsedSeconds);
  const summary = measurementSummary(data);
 
  if (!recorderState.firstMeasurement) {
    recorderState.firstMeasurement = { time, data: summary };
  }
 
  if (recorderState.elapsedSeconds % recordingIntervalSeconds === 0) {
    const exists = recorderState.minuteMeasurements.some(item => item.time === time);
    if (!exists) recorderState.minuteMeasurements.push({ time, data: summary });
  }
 
  recorderState.lastMeasurement = { time, data: summary };
  recorderState.latestSnapshot  = data;
  recorderState.elapsedSeconds += 1;
}
 
function renderSnapshotToUI(data) {
  const fmt1 = v => (+(v ?? 0)).toFixed(1);

  // Kl. card shows the live clock
  if (elements.metrics.ki) {
    elements.metrics.ki.textContent = new Date().toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }
  elements.metrics.pulse.textContent        = `${fmt1(data.pulse)} bpm`;
  elements.metrics.tbp.textContent          =  data.tbp ?? '0/0';
  elements.metrics.temp.textContent         = `${fmt1(data.temp)} °C`;
  elements.metrics.o2_primary.textContent   = `${fmt1(data.o2_primary)} %`;
  elements.metrics.propofol.textContent     = `${fmt1(data.propofol)} ml/t`;
  elements.metrics.ketamin.textContent      = `${fmt1(data.ketamin)} ml/t`;
  elements.metrics.fentanyl.textContent     = `${fmt1(data.fentanyl)} ml/t`;
  elements.metrics.isofluran.textContent    = `${fmt1(data.isofluran)} vol%`;
  elements.metrics.flow.textContent         = `${fmt1(data.flow)} L/min`;
  elements.metrics.o2_secondary.textContent = `${fmt1(data.o2_secondary)} %`;
  elements.metrics.pmax.textContent         = `${fmt1(data.pmax)} cmH₂O`;
  elements.metrics.vt.textContent           = `${fmt1(data.vt)} ml`;
  elements.metrics.frequency.textContent    = `${fmt1(data.frequency)} /min`;
  elements.metrics.mv.textContent           = `${fmt1(data.mv)} L/min`;
  elements.metrics.peep.textContent         = `${fmt1(data.peep)} cmH₂O`;
  elements.metrics.etco2.textContent        = `${fmt1(data.etco2)} mmHg`;
}
 
function resetLiveDataDisplayToZero() {
  renderSnapshotToUI(getZeroSnapshot());
}
 
function renderReportPreview() {
  if (!elements.reportPreview) return;
  // Prefer loaded .vital file data; fall back to live recording state
  const base       = loadedVitalData ?? recorderState;
  const reportData = buildReportData(base, elements.patientForm, recorderState.eventLog);
  renderPrintableReport(elements.reportPreview, reportData);
}
 
// Latest record panel
 
function renderLatestRecordSummary(payload) {
  if (!elements.latestRecordSummary) return;
 
  const minuteCount = payload.reportData?.minutes?.length ?? 0;
  const firstTime   = payload.reportData?.firstMeasurement?.time ?? '—';
  const lastTime    = payload.reportData?.lastMeasurement?.time  ?? '—';
 
  elements.latestRecordSummary.innerHTML = `
    <article class="analysis-card">
      <h4>Loaded File</h4>
      <div class="value" title="${payload.file ?? ''}"
           style="font-size:.8rem;word-break:break-all;white-space:normal;max-width:100%">
        ${payload.file ?? '—'}
      </div>
    </article>
    <article class="analysis-card">
      <h4>Total Minutes</h4>
      <div class="value">${minuteCount}</div>
    </article>
    <article class="analysis-card">
      <h4>First Measurement</h4>
      <div class="value">${firstTime}</div>
    </article>
    <article class="analysis-card">
      <h4>Last Measurement</h4>
      <div class="value">${lastTime}</div>
    </article>
  `;
}
 
function renderMinuteReportTable(reportData) {
  if (!elements.minuteReportTable) return;
 
  const minutes = reportData?.minutes ?? [];
 
  if (!minutes.length) {
    elements.minuteReportTable.innerHTML = `
      <tbody>
        <tr><td class="muted-text">No minute data found in the loaded record.</td></tr>
      </tbody>`;
    return;
  }
 
  const headerCells = LATEST_REPORT_FIELDS.map(
    f => `<th>${f.label} first</th><th>${f.label} last</th>`
  ).join('');
 
  const rows = minutes.map(item => {
    const cells = LATEST_REPORT_FIELDS.map(f => `
      <td>${item.first?.[f.key] ?? ''}</td>
      <td>${item.last?.[f.key]  ?? ''}</td>
    `).join('');
    return `
      <tr>
        <td>${item.minute}</td>
        <td>${item.from}</td>
        <td>${item.to}</td>
        ${cells}
      </tr>`;
  }).join('');
 
  elements.minuteReportTable.innerHTML = `
    <thead>
      <tr>
        <th>Minute</th><th>From</th><th>To</th>
        ${headerCells}
      </tr>
    </thead>
    <tbody>${rows}</tbody>`;
}
 
// Backend calls 
 
async function selectSource(source) {
  const response = await fetch(`${BRIDGE_HTTP}/source/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source })
  });
  if (!response.ok) throw new Error('Failed to select source');
  const data = await response.json();
  currentSource = data.source;
  updateIndicators();
}
 
async function startRecording() {
  const patient  = getPatientFormData(elements.patientForm);
  const response = await fetch(`${BRIDGE_HTTP}/recording/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient })
  });
  if (!response.ok) throw new Error('Failed to start recording');
  return response.json();
}
 
async function stopRecording() {
  const response = await fetch(`${BRIDGE_HTTP}/recording/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events: recorderState.eventLog })
  });
  if (!response.ok) throw new Error('Failed to stop recording');
  return response.json();
}
 
async function loadLatestRecord() {
  try {
    if (elements.loadedRecordStatus) {
      elements.loadedRecordStatus.textContent = 'Loading latest .vital file…';
    }

    const response = await fetch(`${BRIDGE_HTTP}/record/latest`);
    const payload  = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || 'Failed to load latest record');
    }

  
    loadedVitalData = payload.reportData;

    // Prefer last real measurement from the timeline; fall back to snapshot field
    const snap = payload.reportData?.lastMeasurement?.data
              ?? payload.snapshot
              ?? getZeroSnapshot();
    renderSnapshotToUI(snap);
    renderLatestRecordSummary(payload);
    renderMinuteReportTable(payload.reportData);

    if (elements.loadedRecordStatus) {
      elements.loadedRecordStatus.textContent = payload.file ?? '';
      elements.loadedRecordStatus.title       = payload.path ?? payload.file ?? '';
    }

    elements.currentSourceLabel.textContent = 'latest-vital-file';
    elements.bridgeStatusLabel.textContent  = 'Loaded';

    // Update the report preview with the loaded vital file data
    renderReportPreview();

    document.getElementById('latest-record-panel')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (error) {
    console.error(error);
    if (elements.loadedRecordStatus) {
      elements.loadedRecordStatus.textContent = error.message || 'Failed to load latest record';
    }
  }
}
 
function exportMonitoringExcel() {
  const payload = getPigMonitoringExportPayload();
  if (!payload.rows.length) {
    if (elements.liveDataStatus)
      elements.liveDataStatus.textContent = 'No monitoring data to export';
    return;
  }

  

  const patient  = getPatientFormData(elements.patientForm) || {};
  const sections = [];


  sections.push('=== Session Info ===');
  sections.push('Field,Value');
  Object.entries(patient).forEach(([k, v]) =>
    sections.push(`${csvEsc(k)},${csvEsc(v)}`)
  );
  sections.push(`Source,${csvEsc(currentSource || '')}`);
  sections.push('');

  
  sections.push('=== Monitoring Data ===');
  const dataHeaders = Object.keys(payload.rows[0]);
  sections.push(dataHeaders.map(csvEsc).join(','));
  payload.rows.forEach(row =>
    sections.push(dataHeaders.map(h => csvEsc(row[h] ?? '')).join(','))
  );
  sections.push('');


  sections.push('=== Procedure Events ===');
  sections.push('Time,Event');
  payload.events.forEach(ev =>
    sections.push(`${csvEsc(ev.time)},${csvEsc(ev.text)}`)
  );

  const csv  = '\uFEFF' + sections.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;

  const ts   = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
  const stem = recorderState.sessionName || `monitoring_${ts}`;
  a.download = `${stem}_monitoring.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  if (elements.liveDataStatus)
    elements.liveDataStatus.textContent = '✅ Exported — open the .csv file in Excel';
}


function csvEsc(v) {
  const s = String(v ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
 
function exportVitalFileToCSV() {
  const data = loadedVitalData;
  if (!data) {
    alert('No vital file loaded. Please click "Load Latest Record" first.');
    return;
  }

  const minutes  = data.minutes  ?? [];
  const timeline = data.timeline ?? [];
  const csvRows  = [];

  const LABEL = {
    pulse: 'HR (bpm)', tbp: 'BP (mmHg)', temp: 'Temp (°C)',
    o2_primary: 'FiO₂ (%)', o2_secondary: 'FeO₂ (%)',
    pmax: 'Pmax (cmH₂O)', vt: 'Vt (mL)', frequency: 'RR (/min)',
    mv: 'MV (L/min)', peep: 'PEEP (cmH₂O)', etco2: 'ETCO₂ (mmHg)',
    flow: 'Flow (L/min)',
    propofol: 'Propofol (mL/h)', ketamin: 'Ketamin (mL/h)',
    fentanyl: 'Fentanyl (mL/h)', isofluran: 'Isofluran (vol%)',
  };
  const colLabel = k => LABEL[k] || k;

  if (minutes.length) {
    const keySet = new Set();
    minutes.forEach(m => {
      Object.keys(m.first || {}).forEach(k => keySet.add(k));
      Object.keys(m.last  || {}).forEach(k => keySet.add(k));
    });
    const keys = [...keySet];

    csvRows.push([
      'Minute', 'Time From', 'Time To',
      ...keys.flatMap(k => [`${colLabel(k)} First`, `${colLabel(k)} Last`]),
    ]);
    for (const m of minutes) {
      csvRows.push([
        m.minute ?? '', m.from ?? '', m.to ?? '',
        ...keys.flatMap(k => [m.first?.[k] ?? '', m.last?.[k] ?? '']),
      ]);
    }

    csvRows.push([]);
    csvRows.push(['=== SUMMARY STATISTICS ===']);
    csvRows.push(['Parameter', 'Min', 'Max', 'Average', 'Samples']);
    for (const k of keys) {
      const vals = minutes
        .flatMap(m => [parseFloat(m.first?.[k]), parseFloat(m.last?.[k])])
        .filter(v => !isNaN(v) && v > 0);
      if (!vals.length) continue;
      const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
      csvRows.push([
        colLabel(k),
        Math.min(...vals).toFixed(1),
        Math.max(...vals).toFixed(1),
        avg,
        vals.length,
      ]);
    }

  } else if (timeline.length) {
    const keySet = new Set();
    timeline.forEach(pt => Object.keys(pt.data || {}).forEach(k => keySet.add(k)));
    const keys = [...keySet];

    csvRows.push(['Time (MM:SS)', ...keys.map(colLabel)]);
    for (const pt of timeline) {
      csvRows.push([pt.time || '', ...keys.map(k => pt.data?.[k] ?? '')]);
    }

    // Summary stats below
    csvRows.push([]);
    csvRows.push(['=== SUMMARY STATISTICS ===']);
    csvRows.push(['Parameter', 'Min', 'Max', 'Average', 'Samples']);
    for (const k of keys) {
      const vals = timeline
        .map(pt => parseFloat(pt.data?.[k]))
        .filter(v => !isNaN(v) && v > 0);
      if (!vals.length) continue;
      const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
      csvRows.push([
        colLabel(k),
        Math.min(...vals).toFixed(1),
        Math.max(...vals).toFixed(1),
        avg,
        vals.length,
      ]);
    }

  } else {
    alert('No data available to export. Try loading a .vital file first.');
    return;
  }


  const escapeCell = cell => {
    const s = String(cell ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = csvRows.map(row => row.map(escapeCell).join(',')).join('\r\n');

  const blob     = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  const baseName = (data.fileName || data.filePath || recorderState.sessionName || 'vital_export').replace(/\.[^.]+$/, '');
  a.href         = url;
  a.download     = `${baseName}_export.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

 
function resetRecordingState() {
  recorderState.recording          = false;
  recorderState.elapsedSeconds     = 0;
  recorderState.sessionName        = null;
  recorderState.firstMeasurement   = null;
  recorderState.lastMeasurement    = null;
  recorderState.minuteMeasurements = [];
  recorderState.timepointMarkers   = [];
  recorderState.eventLog           = [];
  recorderState.latestSnapshot     = null;
}
 

 
function generateExperimentalSnapshot(tick) {
  const pulse     = 68 + Math.round(8 * Math.sin(tick / 3));
  const temp      = (36.8 + 0.2 * Math.sin(tick / 10)).toFixed(1);
  const etco2     = 34 + Math.round(3 * Math.sin(tick / 4));
  const vt        = 480 + Math.round(40 * Math.sin(tick / 5));
  const frequency = 11 + Math.round(2 * Math.sin(tick / 6));
  const pmax      = 17 + Math.round(2 * Math.sin(tick / 7));
  const peep      = 5;
  const flow      = (1.8 + 0.3 * Math.sin(tick / 8)).toFixed(1);
  const propofol  = (6.0 + 1.2 * Math.sin(tick / 9)).toFixed(1);
  const ketamin   = (1.5 + 0.4 * Math.sin(tick / 11)).toFixed(1);
  const fentanyl  = (2.0 + 0.3 * Math.sin(tick / 12)).toFixed(1);
  const isofluran = (0.9 + 0.1 * Math.sin(tick / 10)).toFixed(2);
  const mv        = (6.0 + 0.4 * Math.sin(tick / 6)).toFixed(1);
  const o2a       = 45 + Math.round(3 * Math.sin(tick / 8));
  const o2b       = 44 + Math.round(2 * Math.sin(tick / 7));
 
  return {
    pulse,
    tbp:          `${118 + Math.round(4 * Math.sin(tick / 5))}/${76 + Math.round(3 * Math.sin(tick / 6))}`,
    temp:         Number(temp),
    o2_primary:   o2a,
    propofol:     Number(propofol),
    ketamin:      Number(ketamin),
    fentanyl:     Number(fentanyl),
    isofluran:    Number(isofluran),
    flow:         Number(flow),
    o2_secondary: o2b,
    pmax,
    vt,
    frequency,
    mv:           Number(mv),
    peep,
    etco2
  };
}
 
function closeLiveSocket() {
  if (liveSocket) {
    try { liveSocket.close(); } catch (e) { console.error(e); }
    liveSocket = null;
  }
}
 
function connectLiveSocket() {
  if (
    liveSocket &&
    (liveSocket.readyState === WebSocket.OPEN ||
     liveSocket.readyState === WebSocket.CONNECTING)
  ) return;
 
  liveSocket = new WebSocket(BRIDGE_WS);
 
  liveSocket.onopen = () => {
    elements.bridgeStatusLabel.textContent = 'Connected';
  };
 
  liveSocket.onmessage = (event) => {
    if (experimentalModeActive) return;

    const payload = JSON.parse(event.data);
    const data    = payload.measurements ?? {};

    renderSnapshotToUI(data);
    updateMeasurementLog(data);
    recorderState.recording = true;
    updateIndicators();
    pushPigMonitoringData(data, pigRefs);
  };

  liveSocket.onclose = () => {
    if (experimentalModeActive) return;
    elements.bridgeStatusLabel.textContent = 'Disconnected';

    // Auto-reconnect while the user has an active recording session
    if (recorderState.recording) {
      setTimeout(() => {
        if (recorderState.recording && !experimentalModeActive) {
          elements.bridgeStatusLabel.textContent = 'Reconnecting…';
          connectLiveSocket();
        }
      }, 2000);
    } else {
      resetLiveDataDisplayToZero();
      updateIndicators();
    }
  };

  liveSocket.onerror = () => {
    elements.bridgeStatusLabel.textContent = 'Error';
    elements.liveDataStatus.textContent    = 'WebSocket connection error';
    if (!experimentalModeActive) resetLiveDataDisplayToZero();
  };
}
 
function startExperimentalValues() {
  if (experimentalInterval) return;
 
  closeLiveSocket();
  experimentalModeActive                    = true;
  currentSource                             = 'experimental';
  recorderState.recording                   = true;
  elements.bridgeStatusLabel.textContent    = 'Experimental';
  elements.simulationStatusPill.textContent = 'Experimental';
  updateIndicators();
 
  let tick = 0;
  experimentalInterval = window.setInterval(() => {
    const data = generateExperimentalSnapshot(tick);
    renderSnapshotToUI(data);
    updateMeasurementLog(data);
    renderReportPreview();
    pushPigMonitoringData(data, pigRefs, { allowExperimental: true });
    tick += 1;
  }, 1000);
}
 
function stopExperimentalValues() {
  if (experimentalInterval) {
    clearInterval(experimentalInterval);
    experimentalInterval = null;
  }
  experimentalModeActive                    = false;
  recorderState.recording                   = false;
  currentSource                             = 'simulation';
  elements.bridgeStatusLabel.textContent    = 'Ready';
  elements.simulationStatusPill.textContent = 'Idle';
  elements.liveDataStatus.textContent       = 'Experimental values stopped';
  resetLiveDataDisplayToZero();
  updateIndicators();
}
 

 
elements.simulationModeButton.addEventListener('click', async () => {
  try {
    if (experimentalModeActive) stopExperimentalValues();
    await selectSource('simulation');
    elements.liveDataStatus.textContent       = 'Simulation mode selected';
    elements.simulationStatusPill.textContent = 'Simulation';
    resetLiveDataDisplayToZero();
    resetPigMonitoring(pigRefs);
  } catch (error) {
    console.error(error);
    elements.liveDataStatus.textContent = 'Failed to select simulation mode';
  }
});
 
elements.experimentalValuesButton?.addEventListener('click', () => {
  if (experimentalModeActive) {
    stopExperimentalValues();
    resetPigMonitoring(pigRefs);
  } else {
    resetRecordingState();
    renderEventLog([]);
    renderReportPreview();
    resetPigMonitoring(pigRefs);
    startExperimentalValues();
  }
});
 
elements.showMonitoringButton?.addEventListener('click', () => {
  ensurePigMonitoringVisible(pigRefs);
});
 
elements.startRecordingButton.addEventListener('click', async () => {
  try {
    if (experimentalModeActive) stopExperimentalValues();

    resetRecordingState();


    const durSel = document.getElementById('select-duration');
    recorderState.durationSeconds = durSel ? (parseInt(durSel.value, 10) || 4 * 3600) : 4 * 3600;

    const patientData = getPatientFormData(elements.patientForm);
    const pid         = (patientData.id   || '').trim();
    const pdate       = (patientData.date || '').trim().slice(0, 10).replace(/-/g, '');
    const today       = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    recorderState.sessionName = pid ? `${pid}_${pdate || today}` : `recording_${today}`;

    renderEventLog([]);
    renderReportPreview();
    resetLiveDataDisplayToZero();
    resetPigMonitoring(pigRefs);

    await startRecording();
    currentSource           = 'vitalrecorder';
    recorderState.recording = true;
    connectLiveSocket();
    updateIndicators();
    ensurePigMonitoringVisible(pigRefs);
    pigRefs.panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    console.error(error);
    elements.liveDataStatus.textContent       = 'Failed to start recording';
    elements.simulationStatusPill.textContent = 'Error';
    resetLiveDataDisplayToZero();
    resetPigMonitoring(pigRefs);
  }
});
 
elements.stopRecordingButton.addEventListener('click', async () => {
  try {
    const result = await stopRecording();
    recorderState.recording = false;
    closeLiveSocket();
    resetLiveDataDisplayToZero();
    updateIndicators();
    elements.liveDataStatus.textContent       = 'Recording stopped';
    elements.simulationStatusPill.textContent = 'Stopped';
 
    if (result?.reportData) {
      loadedVitalData = result.reportData; // make available for charts
      renderMinuteReportTable(result.reportData);
      renderLatestRecordSummary({
        file: result.bridge?.vital_file ?? '',
        reportData: result.reportData
      });
      renderReportPreview();
    }
  } catch (error) {
    console.error(error);
    elements.liveDataStatus.textContent       = 'Failed to stop recording';
    elements.simulationStatusPill.textContent = 'Error';
  }
});
 
elements.loadLatestRecordButton?.addEventListener('click', loadLatestRecord);
 
elements.exportButton?.addEventListener('click', exportMonitoringExcel);

document.getElementById('btn-export-vital-excel')?.addEventListener('click', exportVitalFileToCSV);
 
elements.printReportButton.addEventListener('click', async () => {
  const choice = await showPrintFormatModal();
  if (!choice) return; // cancelled

  setReportViewMode(choice.format);
  setDisplayInterval(choice.interval);

  // Use loaded .vital file data 
  const base       = loadedVitalData ?? recorderState;
  const reportData = buildReportData(base, elements.patientForm, recorderState.eventLog);
  renderPrintableReport(elements.printReportRoot, reportData);
  printReport();
});
 
elements.addEventButton.addEventListener('click', () => {
  const text = elements.eventNoteInput.value.trim();
  if (!text) return;
 
  recorderState.eventLog.push({
    timeInSeconds: recorderState.elapsedSeconds,
    displayTime:   formatClockFromSeconds(recorderState.elapsedSeconds),
    text
  });
 
  elements.eventNoteInput.value = '';
  renderEventLog(recorderState.eventLog);
  renderReportPreview();
  setPigMonitoringEvents(recorderState.eventLog, pigRefs);
});
 


function captureTimepointSnapshot(label) {
  if (!recorderState.latestSnapshot) return;
  const time    = formatClockFromSeconds(recorderState.elapsedSeconds);
  const summary = measurementSummary(recorderState.latestSnapshot);


  if (recorderState.minuteMeasurements.some(m => m.label === label)) return;

  recorderState.minuteMeasurements.push({ time, label, data: summary, isTimepoint: true });
  recorderState.timepointMarkers.push({ second: recorderState.elapsedSeconds, label });

  recorderState.eventLog.push({
    timeInSeconds: recorderState.elapsedSeconds,
    displayTime:   time,
    text:          `Auto-captured: ${label}`
  });

  renderEventLog(recorderState.eventLog);
  renderReportPreview();
  setPigMonitoringEvents(recorderState.eventLog, pigRefs);
}



function showPrintFormatModal() {
  return new Promise(resolve => {
    const modal = document.getElementById('modal-print-format');
    if (!modal) { resolve({ format: 'charts', interval: 60 }); return; }
    modal.classList.remove('hidden');

    let selFormat   = 'charts';
    let selInterval = 60;

    const setActive = (group, activeId) => {
      modal.querySelectorAll(`[data-group="${group}"]`).forEach(b => {
        b.classList.toggle('modal-toggle-active', b.id === activeId);
      });
    };
    setActive('format',   'mpr-charts');
    setActive('interval', 'mpr-1min');

    const cleanup = () => modal.classList.add('hidden');

    document.getElementById('mpr-charts').onclick  = () => { selFormat = 'charts';  setActive('format',   'mpr-charts');  };
    document.getElementById('mpr-numbers').onclick = () => { selFormat = 'numbers'; setActive('format',   'mpr-numbers'); };
    document.getElementById('mpr-1min').onclick    = () => { selInterval = 60;      setActive('interval', 'mpr-1min');    };
    document.getElementById('mpr-5min').onclick    = () => { selInterval = 300;     setActive('interval', 'mpr-5min');    };

    document.getElementById('modal-print-go').onclick     = () => { cleanup(); resolve({ format: selFormat, interval: selInterval }); };
    document.getElementById('modal-print-cancel').onclick = () => { cleanup(); resolve(null); };
  });
}


document.getElementById('input-sedation-time')?.addEventListener('change', () => {
  captureTimepointSnapshot('Sedation');
});

document.getElementById('input-intubation-time')?.addEventListener('change', () => {
  captureTimepointSnapshot('Intubation');
});


document.getElementById('input-incision-time')?.addEventListener('change', () => {
  captureTimepointSnapshot('Incision start');
});


document.getElementById('btn-view-charts')?.addEventListener('click', () => {
  setReportViewMode('charts');
  document.getElementById('btn-view-charts')?.classList.add('active');
  document.getElementById('btn-view-numbers')?.classList.remove('active');
  renderReportPreview();
});

document.getElementById('btn-view-numbers')?.addEventListener('click', () => {
  setReportViewMode('numbers');
  document.getElementById('btn-view-numbers')?.classList.add('active');
  document.getElementById('btn-view-charts')?.classList.remove('active');
  renderReportPreview();
});

setAutomaticDate(elements.patientForm);
renderEventLog([]);
renderReportPreview();
resetLiveDataDisplayToZero();
initPigMonitoring(pigRefs);
updateIndicators();
selectSource('simulation').catch(console.error);
 

setInterval(() => {
  if (elements.metrics.ki) {
    elements.metrics.ki.textContent = new Date().toLocaleTimeString([], {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }
}, 1000);
