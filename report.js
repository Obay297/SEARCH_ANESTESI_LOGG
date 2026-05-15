// report.js: Builds a medical vital signs report
// Displays it as either graphs or a table of numbers, depending on the selected mode
// Prepares patient data, events, and printable output



import { getPatientFormData } from './patient.js';

//  View mode & display interval 
let reportViewMode        = 'charts'; 
let displayIntervalSecs   = 60;       

export function setReportViewMode(mode) { reportViewMode = mode === 'numbers' ? 'numbers' : 'charts'; }
export function getReportViewMode()     { return reportViewMode; }
export function setDisplayInterval(s)   { displayIntervalSecs = Number(s) || 60; }


const CHART_CONFIGS = [
  {
    id: 'circulatory',
    title: 'Heart Rate & Blood Pressure',
    subtitle: 'bpm / mmHg — shared scale',
    height: 220,
    sharedScale: { min: 30, max: 220 },
    refBands: [
      { min: 75,  max: 85,  color: 'rgba(95,212,255,0.07)'  },   // HR normal range
      { min: 100, max: 140, color: 'rgba(255,92,92,0.06)'   },   // SBP normal range
    ],
    series: [
      { id: 'pulse', key: 'pulse', label: 'HR',  unit: 'bpm',  color: '#5fd4ff' },
      { id: '_sbp',  key: '_sbp',  label: 'SBP', unit: 'mmHg', color: '#ff5c5c' },
      { id: '_dbp',  key: '_dbp',  label: 'DBP', unit: 'mmHg', color: '#ff9b5c', dashed: true },
    ],
  },
  {
    id: 'temp-etco2',
    title: 'Temperature & Gas Exchange',
    subtitle: '°C / mmHg / % — independent scales',
    height: 210,
    independentScales: true,
    series: [
      { id: 'temp',  key: 'temp',       label: 'Temp',  unit: '°C',   color: '#ffd166', scaleMin: 35, scaleMax: 41, validMin: 35 },
      { id: 'etco2', key: 'etco2',      label: 'ETCO₂', unit: 'mmHg', color: '#79f2c0', scaleMin: 20, scaleMax: 55  },
      { id: 'fio2',  key: 'o2_primary', label: 'FiO₂',  unit: '%',    color: '#4af7b0', scaleMin: 20, scaleMax: 100 },
    ],
  },
  {
    id: 'respiratory',
    title: 'Respiratory Parameters',
    subtitle: 'Vt / RR / MV / PEEP / Pmax — independent scales',
    height: 210,
    independentScales: true,
    series: [
      { id: 'vt',        key: 'vt',        label: 'Vt',   unit: 'mL',    color: '#b085f5' },
      { id: 'frequency', key: 'frequency', label: 'RR',   unit: '/min',  color: '#c9b1ff' },
      { id: 'mv',        key: 'mv',        label: 'MV',   unit: 'L/min', color: '#93c5fd' },
      { id: 'peep',      key: 'peep',      label: 'PEEP', unit: 'cmH₂O', color: '#ffc966' },
      { id: 'pmax',      key: 'pmax',      label: 'Pmax', unit: 'cmH₂O', color: '#ff7eb3' },
    ],
  },
  {
    id: 'medications',
    title: 'Medication Infusions',
    subtitle: 'mL/h / vol% — independent scales',
    height: 210,
    independentScales: true,
    series: [
      { id: 'propofol',  key: 'propofol',  label: 'Propofol',  unit: 'mL/h', color: '#ff8fa3' },
      { id: 'ketamin',   key: 'ketamin',   label: 'Ketamin',   unit: 'mL/h', color: '#ffb347' },
      { id: 'fentanyl',  key: 'fentanyl',  label: 'Fentanyl',  unit: 'mL/h', color: '#a78bfa' },
      { id: 'isofluran', key: 'isofluran', label: 'Isofluran', unit: 'vol%', color: '#6ee7b7' },
    ],
  },
];

// Rows shown in the numbers table
const NUMBER_TABLE_PARAMS = [
  { key: 'pulse',        label: 'HR (bpm)'          },
  { key: 'tbp',          label: 'BP (mmHg)'         },
  { key: 'temp',         label: 'Temp (°C)'         },
  { key: 'etco2',        label: 'ETCO₂ (mmHg)'      },
  { key: 'o2_primary',   label: 'FiO₂ (%)'          },
  { key: 'o2_secondary', label: 'FeO₂ (%)'          },
  { key: 'pmax',         label: 'Pmax (cmH₂O)'      },
  { key: 'vt',           label: 'Vt (mL)'           },
  { key: 'frequency',    label: 'RR (/min)'         },
  { key: 'mv',           label: 'MV (L/min)'        },
  { key: 'peep',         label: 'PEEP (cmH₂O)'      },
  { key: 'propofol',     label: 'Propofol (mL/h)'   },
  { key: 'ketamin',      label: 'Ketamin (mL/h)'    },
  { key: 'fentanyl',     label: 'Fentanyl (mL/h)'   },
  { key: 'isofluran',    label: 'Isofluran (vol%)'  },
  { key: 'flow',         label: 'Flow (L/min)'      },
];

// Minimum physiologically valid value per key.

const PARAM_VALID_MIN = {
  temp: 35,  // °C — probe reads ~25-26 while cold-warming up
};

// Keys already rendered by CHART_CONFIGS — used to detect extra .vital signals
const CHART_CONFIG_KEYS = new Set(
  CHART_CONFIGS.flatMap(g => g.series.map(s => s.key)).filter(k => !k.startsWith('_'))
);


const EXTRA_SIGNAL_COLORS = [
  '#94a3b8','#f59e0b','#10b981','#6366f1','#ec4899','#14b8a6','#f97316','#a78bfa',
];



function escapeHtml(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function isStructuredReport(d) { return Array.isArray(d?.devices); }

function timeToSeconds(t) {
  if (typeof t !== 'string') return 0;
  const [m, s] = t.split(':').map(Number);
  return (m || 0) * 60 + (s || 0);
}

function flattenSignals(d) {
  return (d?.devices || []).flatMap(dev => dev.signals || []);
}

function formatValue(sig) {
  const fv = sig?.firstValid;
  if (!fv || fv.value == null) return '—';
  return `${fv.value}${sig.unit ? ` ${sig.unit}` : ''}`;
}


function getTimelinePoints(reportData) {
  // Loaded .vital file timeline (high-resolution, per-second or per-minute).
  // Sort ascending by time — .vital files are often stored newest-first.
  if (Array.isArray(reportData?.timeline) && reportData.timeline.length >= 2) {
    return reportData.timeline
      .map(m => ({ second: timeToSeconds(m.time), data: m.data || {} }))
      .sort((a, b) => a.second - b.second);
  }


  if (isStructuredReport(reportData)) {
    const signals = flattenSignals(reportData);
    if (signals.length) {
      const lengths = signals.map(s => (s.trend || []).length);
      const maxLen  = lengths.length ? Math.max(...lengths) : 0;
      if (maxLen >= 2) {
        const longest = signals.find(s => (s.trend || []).length === maxLen);
        return (longest.trend || []).map(pt => {
          const data = {};
          for (const sig of signals) {
            const match = (sig.trend || []).find(p => Math.abs(p.second - pt.second) < 0.5);
            if (match) data[sig.key || sig.label] = match.value;
          }
          return { second: pt.second, data };
        }).sort((a, b) => a.second - b.second);
      }
    }
  }

  // Live recording session
  const all = collectAllMeasurements(reportData);
  const raw = all.map(m => ({ second: timeToSeconds(m.time), data: m.data || {} }));
  return trimLeadingZeros(raw);
}


function getMinutePoints(reportData) {
  let pts;

  // From loaded .vital file  – use the per-minute timeline rows
  if (Array.isArray(reportData?.minutes) && reportData.minutes.length) {
    pts = reportData.minutes.map(m => ({
      time:   m.from || String(m.minute),
      second: timeToSeconds(m.from || String(m.minute)),
      label:  `Min ${m.minute}`,
      data:   m.first || {},
    }));
  } else {
    const all = collectAllMeasurements(reportData);
    pts = all.map(m => ({ ...m, second: timeToSeconds(m.time) }));
  }

  // Filter leading zeros then downsample to chosen display interval
  const cleaned = pts.filter(p => parseFloat(p.data?.pulse) > 0 || pts.indexOf(p) > 0);
  return resampleTimeline(cleaned, displayIntervalSecs);
}


function collectAllMeasurements(reportData) {
  const seen = new Set();
  const all  = [];
  const push = m => {
    if (!m || seen.has(m.time)) return;
    seen.add(m.time);
    all.push(m);
  };
  push(reportData?.firstMeasurement);
  (reportData?.minuteMeasurements || []).forEach(push);
  push(reportData?.lastMeasurement);
  all.sort((a, b) => timeToSeconds(a.time) - timeToSeconds(b.time));
  return all;
}


function trimLeadingZeros(points) {
  const firstReal = points.findIndex(p => parseFloat(p.data?.pulse) > 0);
  return firstReal > 0 ? points.slice(firstReal) : points;
}


function trimSeriesZeros(pts, validMin = 0) {
  const lo = validMin > 0 ? validMin : 0;
  const first = pts.findIndex(p => p.value > 0 && p.value >= lo);
  if (first < 0) return []; // no valid data — skip
  let last = pts.length - 1;
  while (last > first && pts[last].value === 0) last--;
  return pts.slice(first, last + 1);
}


function resampleTimeline(points, intervalSecs) {
  if (!points.length || intervalSecs <= 0) return points;
  const out  = [];
  let next   = points[0].second;
  for (const p of points) {
    if (p.second >= next) { out.push(p); next += intervalSecs; }
  }
  const last = points[points.length - 1];
  if (out[out.length - 1]?.second !== last.second) out.push(last);
  return out;
}

// ─── Single-series SVG chart (one measurement per chart panel) ───────────────


function buildSingleSeriesChart(s, pts, opts = {}) {
  const { markers = [], sharedScale = null, refBands = [] } = opts;

  const W = 760, H = 155;
  const pL = 46, pR = 14, pT = 18, pB = 32;
  const iW = W - pL - pR, iH = H - pT - pB;
  const fx = n => n.toFixed(2);

  const sMin = pts[0].second;
  const sMax = pts[pts.length - 1].second;
  const sRange = sMax - sMin || 1;
  const xOf = sec => pL + ((sec - sMin) / sRange) * iW;

  // Y scale: shared > explicit series range > auto-fit from data
  const vals = pts.map(p => p.value);
  const dMin = Math.min(...vals);
  const dMax = Math.max(...vals);
  let yLo, yHi;
  if (sharedScale) {
    yLo = sharedScale.min; yHi = sharedScale.max;
  } else if (s.scaleMin !== undefined && s.scaleMax !== undefined) {
    yLo = s.scaleMin; yHi = s.scaleMax;
  } else {
    const pad = (dMax - dMin) * 0.15 || 2;
    yLo = dMin - pad; yHi = dMax + pad;
  }
  const yRange = yHi - yLo || 1;
  const yOf = val => pT + iH - ((val - yLo) / yRange) * iH;

  // Horizontal grid + Y labels
  let gridSvg = '';
  const GRID = 4;
  for (let i = 0; i <= GRID; i++) {
    const y = pT + (iH / GRID) * (GRID - i);
    const v = yLo + (yRange / GRID) * i;
    gridSvg += `<line x1="${fx(pL)}" y1="${fx(y)}" x2="${fx(pL + iW)}" y2="${fx(y)}" stroke="rgba(255,255,255,0.13)" stroke-width="1"/>`;
    gridSvg += `<text x="${fx(pL - 5)}" y="${fx(y + 4)}" text-anchor="end" font-size="9" fill="rgba(200,230,255,0.75)">${v.toFixed(0)}</text>`;
  }

  // X-axis time labels (6 ticks)
  let xSvg = '';
  for (let i = 0; i <= 5; i++) {
    const sec = sMin + (sRange / 5) * i;
    const x   = xOf(sec);
    const mm  = Math.floor(sec / 60), ss = Math.round(sec % 60);
    const anchor = i === 0 ? 'start' : i === 5 ? 'end' : 'middle';
    xSvg += `<text x="${fx(x)}" y="${fx(pT + iH + 20)}" text-anchor="${anchor}" font-size="9" fill="rgba(200,230,255,0.72)">${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}</text>`;
  }

  // Reference bands
  let bandsSvg = '';
  for (const b of refBands) {
    const by1 = yOf(b.max), by2 = yOf(b.min);
    if (by2 > by1) bandsSvg += `<rect x="${fx(pL)}" y="${fx(by1)}" width="${fx(iW)}" height="${fx(by2 - by1)}" fill="${b.color}" rx="2"/>`;
  }

  // Series line + end dot
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${fx(xOf(p.second))} ${fx(yOf(p.value))}`).join(' ');
  const dash  = s.dashed ? ' stroke-dasharray="6 3"' : '';
  const lastPt = pts[pts.length - 1];

  // Clinical markers
  let markersSvg = '';
  for (const mk of markers) {
    const sec = Number(mk.second);
    if (sec >= sMin && sec <= sMax) {
      const x = fx(xOf(sec));
      markersSvg += `
        <line x1="${x}" y1="${fx(pT)}" x2="${x}" y2="${fx(pT + iH)}"
              stroke="rgba(255,220,80,0.75)" stroke-width="1.5" stroke-dasharray="5 3"/>
        <text x="${fx(xOf(sec) + 3)}" y="${fx(pT + 12)}"
              font-size="9" fill="rgba(255,220,80,0.95)">${escapeHtml(mk.label || '')}</text>`;
    }
  }

  const rangeStr = dMin.toFixed(0) !== dMax.toFixed(0)
    ? `${dMin.toFixed(0)} – ${dMax.toFixed(0)}`
    : dMin.toFixed(0);

  // Unique clip-path id per chart so multiple charts on the page don't share one
  const clipId = `clip-${s.key}-${sMin}`;

  return `
    <div class="mc-block">
      <div class="mc-block-header">
        <strong style="color:${s.color}">${escapeHtml(s.label)}</strong>
        <span class="mc-block-subtitle">${escapeHtml(s.unit)} &nbsp;·&nbsp; range: ${rangeStr} &nbsp;·&nbsp; last: ${lastPt.value.toFixed(0)}</span>
      </div>
      <svg viewBox="0 0 ${W} ${H}" class="mc-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="${clipId}">
            <rect x="${fx(pL)}" y="${fx(pT)}" width="${fx(iW)}" height="${fx(iH)}"/>
          </clipPath>
        </defs>
        ${bandsSvg}${gridSvg}
        <g clip-path="url(#${clipId})">
          <path d="${pathD}" fill="none" stroke="${s.color}" stroke-width="2.2"
                stroke-linejoin="round" stroke-linecap="round"${dash} opacity="0.93"/>
          ${markersSvg}
        </g>
        <circle cx="${fx(xOf(lastPt.second))}" cy="${fx(yOf(lastPt.value))}" r="3.5" fill="${s.color}" opacity="0.9"/>
        <line x1="${fx(pL)}" y1="${fx(pT)}"     x2="${fx(pL)}"     y2="${fx(pT+iH)}" stroke="rgba(180,220,255,0.32)" stroke-width="1"/>
        <line x1="${fx(pL)}" y1="${fx(pT+iH)}"  x2="${fx(pL+iW)}" y2="${fx(pT+iH)}" stroke="rgba(180,220,255,0.32)" stroke-width="1"/>
        ${xSvg}
      </svg>
    </div>`; // no trailing newline to avoid extra whitespace
}



function buildMonitoringStyleCharts(reportData) {
  const timelinePoints = getTimelinePoints(reportData);

  if (timelinePoints.length < 2) {
    return `
      <section class="print-report-section">
        <div class="mc-empty" style="padding:2rem 0">
          Not enough data to build charts — need at least 2 time points.<br>
          Load a .vital file or record for longer before printing.
        </div>
      </section>`;
  }

  // Clinical event markers (sedation / intubation / incision)
  const markers = (reportData.eventLog || [])
    .filter(e => typeof e.text === 'string' && e.text.startsWith('Auto-captured:'))
    .map(e => ({ second: e.timeInSeconds, label: e.text.replace('Auto-captured: ', '') }));

  let groupsHtml = '';

  for (const group of CHART_CONFIGS) {
    let groupChartsHtml = '';

    for (const s of group.series) {
      // Extract this series' data points from the timeline.
      // Sub-threshold warm-up values (e.g. temp probe reading 26 °C) are mapped
      // to 0 so that trimSeriesZeros treats them as "not yet connected".
      const pValidMin = s.validMin || 0;
      const raw = timelinePoints.map(tp => {
        let val;
        if      (s.key === '_sbp') val = parseFloat(String(tp.data?.tbp ?? '').split('/')[0]);
        else if (s.key === '_dbp') val = parseFloat(String(tp.data?.tbp ?? '').split('/')[1]);
        else                        val = parseFloat(tp.data?.[s.key]);
        if (val == null || isNaN(val)) return null;
        // Map any value below the physiological minimum to 0 (warm-up artifact)
        const clean = (pValidMin > 0 && val < pValidMin) ? 0 : val;
        return { second: tp.second, value: clean };
      }).filter(Boolean);

      // Trim BOTH leading and trailing zeros/invalid values for this series
      const trimmed = trimSeriesZeros(raw, 0);
      if (trimmed.length < 2) continue; // no meaningful data — skip

      groupChartsHtml += buildSingleSeriesChart(s, trimmed, {
        markers,
        sharedScale: group.sharedScale  || null,
        refBands:    (group.refBands && group.sharedScale) ? group.refBands : [],
      });
    }

    if (groupChartsHtml) {
      groupsHtml += `
        <div class="mc-group">
          <div class="mc-group-title">${escapeHtml(group.title)}</div>
          <div class="mc-chart-stack">${groupChartsHtml}</div>
        </div>`;
    }
  }

  
  if (isStructuredReport(reportData)) {
    const extraSignals = flattenSignals(reportData).filter(sig => {
      const key = sig.key || (sig.label || '').toLowerCase().replace(/\s+/g, '_');
      return !CHART_CONFIG_KEYS.has(key) && !CHART_CONFIG_KEYS.has(sig.label)
        && (sig.trend || []).length >= 2;
    });

    let extraHtml = '';
    extraSignals.forEach((sig, idx) => {
      const raw = (sig.trend || [])
        .map(pt => ({ second: Number(pt.second), value: parseFloat(pt.value) }))
        .filter(pt => !isNaN(pt.value) && !isNaN(pt.second));
      const trimmed = trimSeriesZeros(raw, 0);
      if (trimmed.length < 2) return;
      const sc = {
        label: sig.label || sig.key || 'Unknown',
        unit:  sig.unit  || '',
        color: EXTRA_SIGNAL_COLORS[idx % EXTRA_SIGNAL_COLORS.length],
        key:   sig.key || sig.label,
      };
      extraHtml += buildSingleSeriesChart(sc, trimmed, { markers });
    });

    if (extraHtml) {
      groupsHtml += `
        <div class="mc-group">
          <div class="mc-group-title">Additional signals from .vital file</div>
          <div class="mc-chart-stack">${extraHtml}</div>
        </div>`;
    }

    const skipKeys = new Set([
      ...CHART_CONFIG_KEYS,
      'tbp',        // already split into _sbp/_dbp above
      'time', 'second', 'timestamp', 'label',
    ]);

 
    const allTimelineKeys = new Set();
    timelinePoints.forEach(tp => Object.keys(tp.data || {}).forEach(k => allTimelineKeys.add(k)));

    const extraKeys = [...allTimelineKeys].filter(k => !skipKeys.has(k));

    let extraTimelineHtml = '';
    extraKeys.forEach((key, idx) => {
      const raw = timelinePoints.map(tp => {
        const val = parseFloat(tp.data?.[key]);
        return !isNaN(val) ? { second: tp.second, value: val } : null;
      }).filter(Boolean);

      const trimmed = trimSeriesZeros(raw, 0);
      if (trimmed.length < 2) return; // no real data

      const sc = {
        label: key,
        unit:  '',
        color: EXTRA_SIGNAL_COLORS[idx % EXTRA_SIGNAL_COLORS.length],
        key,
      };
      extraTimelineHtml += buildSingleSeriesChart(sc, trimmed, { markers });
    });

    if (extraTimelineHtml) {
      groupsHtml += `
        <div class="mc-group">
          <div class="mc-group-title">Additional measurements</div>
          <div class="mc-chart-stack">${extraTimelineHtml}</div>
        </div>`;
    }
  }

  if (!groupsHtml) {
    return `
      <section class="print-report-section">
        <div class="mc-empty">No active measurement data to chart.</div>
      </section>`;
  }

  return `
    <section class="print-report-section">
      <h2>Vital Signs Charts</h2>
      ${groupsHtml}
    </section>`;
}



function buildNumbersReport(reportData) {
  const cols = getMinutePoints(reportData);

  if (!cols.length) {
    return `
      <section class="print-report-section">
        <div class="mc-empty">No recorded data available.</div>
      </section>`;
  }

  const timeHeaders = cols.map(c => {
    const t   = escapeHtml(c.time || c.from || '');
    const lbl = c.label ? `<br><small style="opacity:.65">${escapeHtml(c.label)}</small>` : '';
    return `<th style="min-width:72px;white-space:nowrap;padding:8px 10px">${t}${lbl}</th>`;
  }).join('');

  const dataRows = NUMBER_TABLE_PARAMS.map(p => {
    const pMin = PARAM_VALID_MIN[p.key] ?? 0;
    const cells = cols.map(c => {
      const raw = (c.data || c.first || {})[p.key];
      const fv  = parseFloat(raw);
      const invalid = raw == null || raw === '' || raw === '0' || raw === '0/0'
        || fv === 0 || (pMin > 0 && !isNaN(fv) && fv < pMin);
      const display = invalid
        ? '<span style="opacity:.35">—</span>'
        : escapeHtml(raw);
      return `<td style="min-width:72px;white-space:nowrap;padding:8px 10px">${display}</td>`;
    }).join('');
    return `<tr><th style="white-space:nowrap;padding:8px 10px;text-align:left">${escapeHtml(p.label)}</th>${cells}</tr>`;
  }).join('');


  const allPts = getTimelinePoints(reportData);

 
  const timelineVals = (key, pMin) => allPts
    .map(pt => {
      if (key === '_sbp') return parseFloat(String(pt.data?.tbp ?? '').split('/')[0]);
      if (key === '_dbp') return parseFloat(String(pt.data?.tbp ?? '').split('/')[1]);
      return parseFloat(pt.data?.[key]);
    })
    .filter(v => !isNaN(v) && v > 0 && (pMin <= 0 || v >= pMin));

 
  const statsParams = [
    ...NUMBER_TABLE_PARAMS.filter(p => p.key !== 'tbp'),
    { key: '_sbp', label: 'SBP (mmHg)' },
    { key: '_dbp', label: 'DBP (mmHg)' },
  ];

  const statRows = statsParams.map(p => {
    const pMin = PARAM_VALID_MIN[p.key] ?? 0;
    const vals = timelineVals(p.key, pMin);
    if (!vals.length) return '';
    const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
    return `
      <tr>
        <td>${escapeHtml(p.label)}</td>
        <td>${Math.min(...vals).toFixed(1)}</td>
        <td>${Math.max(...vals).toFixed(1)}</td>
        <td>${avg}</td>
        <td>${vals.length}</td>
      </tr>`;
  }).filter(Boolean).join('');

  return `
    <section class="print-report-section">
      <h2>Recorded measurements</h2>
      <div style="overflow-x:auto">
        <table class="structured-report-table">
          <thead><tr><th>Parameter</th>${timeHeaders}</tr></thead>
          <tbody>${dataRows}</tbody>
        </table>
      </div>
    </section>

    <section class="print-report-section">
      <h2>Statistical summary</h2>
      <table class="structured-report-table">
        <thead>
          <tr><th>Parameter</th><th>Min</th><th>Max</th><th>Avg</th><th>Samples</th></tr>
        </thead>
        <tbody>${statRows || '<tr><td colspan="5">No numeric data.</td></tr>'}</tbody>
      </table>
    </section>`;
}



function renderPatientSection(p) {
  return `
    <section class="print-report-section">
      <h2>Patient information</h2>
      <div class="print-patient-grid compact-grid">
        <div><strong>Date:</strong> ${escapeHtml(p.date || '—')}</div>
        <div><strong>ID:</strong> ${escapeHtml(p.id || '—')}</div>
        <div><strong>Project:</strong> ${escapeHtml(p.project || '—')}</div>
        <div><strong>Participants:</strong> ${escapeHtml(p.participants || '—')}</div>
        <div><strong>Weight:</strong> ${escapeHtml(p.weight || '—')}</div>
        <div><strong>Sedation time:</strong> ${escapeHtml(p.sedationTime || '—')}</div>
        <div><strong>Intubation time:</strong> ${escapeHtml(p.intubationTime || '—')}</div>
        <div><strong>Incision time:</strong> ${escapeHtml(p.incisionTime || '—')}</div>
        <div><strong>Tube size:</strong> ${escapeHtml(p.tubeSize || '—')}</div>
        <div><strong>Drug name:</strong> ${escapeHtml(p.drugName || '—')}</div>
      </div>
      <div class="print-notes-block">
        <strong>Notes:</strong>
        <div>${escapeHtml(p.notes || '—')}</div>
      </div>
    </section>`;
}

function renderEvents(reportData) {
  const rows = (reportData.eventLog || []).length
    ? reportData.eventLog
        .map(e => `<tr><td>${escapeHtml(e.displayTime || '—')}</td><td>${escapeHtml(e.text || '')}</td></tr>`)
        .join('')
    : '<tr><td colspan="2">No events recorded.</td></tr>';
  return `
    <section class="print-report-section">
      <h2>Procedure events</h2>
      <table class="structured-report-table">
        <thead><tr><th>Time</th><th>Comment</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>`;
}


function renderStructuredDeviceSections(reportData) {
  return (reportData.devices || []).map(dev => {
    const rows = (dev.signals || []).map(sig => `
      <tr>
        <td>${escapeHtml(sig.label)}</td>
        <td>${escapeHtml(formatValue(sig))}</td>
        <td>${escapeHtml(sig.firstValid?.time || '—')}</td>
        <td>${escapeHtml(sig.track || 'Not found')}</td>
        <td>${escapeHtml(sig.reference || '—')}</td>
      </tr>`).join('');
    return `
      <section class="print-report-section">
        <h2>${escapeHtml(dev.label)}</h2>
        <table class="structured-report-table">
          <thead>
            <tr><th>Signal</th><th>First valid</th><th>Time</th><th>Track</th><th>Reference</th></tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="5">No data.</td></tr>'}</tbody>
        </table>
      </section>`;
  }).join('');
}



export function printReport() { window.print(); }

export function buildReportData(rawReport, patientForm, eventLog = []) {
  return {
    ...(rawReport || {}),
    patient:  getPatientFormData(patientForm),
    eventLog: Array.isArray(eventLog) ? eventLog : [],
  };
}

export function renderPrintableReport(container, reportData) {
  if (!container) return;

  const patient = reportData.patient || {};

  // Always show monitoring charts OR numbers table based on mode
  const bodyMarkup = reportViewMode === 'numbers'
    ? buildNumbersReport(reportData)
    : buildMonitoringStyleCharts(reportData);

  // If this is a structured .vital file report, also prepend the device table
  const deviceTable = isStructuredReport(reportData)
    ? renderStructuredDeviceSections(reportData)
    : '';

  container.innerHTML = `
    <section class="print-report-page chart-style-report">
      <header class="print-report-header">
        <div>
          <h1>Vital Recorder — Final Report</h1>
          <div class="print-report-meta">
            <span><strong>File:</strong> ${escapeHtml(reportData.fileName || reportData.filePath || '—')}</span>
            <span><strong>Duration:</strong> ${escapeHtml(reportData.durationLabel || '—')}</span>
            <span><strong>Format:</strong> ${reportViewMode === 'numbers' ? 'Numbers / Table' : 'Charts'}</span>
          </div>
        </div>
      </header>

      ${renderPatientSection(patient)}
      ${deviceTable}
      ${bodyMarkup}
      ${renderEvents(reportData)}
    </section>`;
}
