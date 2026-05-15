const pigMonitoringState = {
  visible: false,
  history: [],
  events: []
};

const pigRanges = {
  hr:    { min: 75,   max: 85,   label: '75–85 bpm' },
  temp:  { min: 38.5, max: 40.0, label: '38.5–40 °C' },
  bpSys: { min: 110,  max: 130,  label: '110–130 mmHg' },
  bpDia: { min: 60,   max: 80,   label: '60–80 mmHg' },
  resp:  { min: 25,   max: 35,   label: '25–35 /min' },
  vt:    { min: 0.35, max: 0.55, label: '0.35–0.55 L' },
  mv:    { min: 8,    max: 14,   label: '8–14 L/min' },
  etco2: { min: 35,   max: 45,   label: '35–45 mmHg' },
  spo2:  { min: 94,   max: 100,  label: '94–100 %' },
  peep:  { min: 4,    max: 8,    label: '4–8 cmH₂O' },
  flow:  { min: 1.5,  max: 3.0,  label: '1.5–3.0 L/min' }
};

function getPigValueState(value, min, max) {
  if (value < min) return 'low';
  if (value > max) return 'high';
  return 'normal';
}

function getPigMarkerPercent(value, min, max) {
  const span       = (max - min) || 1;
  const displayMin = min - span;
  const displayMax = max + span;
  const percent    = ((value - displayMin) / (displayMax - displayMin)) * 100;
  return Math.max(0, Math.min(100, percent));
}

function setPigStatusClass(el, state) {
  if (!el) return;
  el.classList.remove('low', 'normal', 'high', 'neutral');
  el.classList.add(state);
}

function applyPigValue(el, value, unit, min, max) {
  if (!el) return;
  const display = Number.isFinite(value) ? +value.toFixed(1) : 0;
  if (!display) {
    setPigStatusClass(el, 'neutral');
    el.textContent = `0.0${unit ? ` ${unit}` : ''}`;
    return;
  }
  const state = getPigValueState(display, min, max);
  setPigStatusClass(el, state);
  el.textContent = `${display.toFixed(1)}${unit ? ` ${unit}` : ''}`;
}

function applyPigBP(el, sys, dia) {
  if (!el) return;
  const s = Number.isFinite(sys) ? +Number(sys).toFixed(1) : 0;
  const d = Number.isFinite(dia) ? +Number(dia).toFixed(1) : 0;
  if (!s && !d) {
    setPigStatusClass(el, 'neutral');
    el.textContent = '0/0';
    return;
  }
  const sysState = getPigValueState(s, pigRanges.bpSys.min, pigRanges.bpSys.max);
  const diaState = getPigValueState(d, pigRanges.bpDia.min, pigRanges.bpDia.max);
  const state    = sysState === 'normal' && diaState === 'normal'
    ? 'normal'
    : (sysState === 'high' || diaState === 'high' ? 'high' : 'low');
  setPigStatusClass(el, state);
  el.textContent = `${s.toFixed(1)}/${d.toFixed(1)}`;
}

function applyPigRange(el, value, min, max) {
  if (!el) return;
  el.style.setProperty('--marker-pos', `${getPigMarkerPercent(value || 0, min, max)}%`);
}

function clearCanvas(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  return ctx;
}

function drawEmpty(canvas, text = 'No data yet') {
  const ctx = clearCanvas(canvas);
  if (!ctx) return;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font      = '14px Arial';
  ctx.fillText(text, 18, 26);
}

function drawGrid(ctx, width, height, lines = 4) {
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth   = 1;
  for (let i = 1; i <= lines; i += 1) {
    const y = (height / (lines + 1)) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawLineSeries(ctx, values, width, height, color, options = {}) {
  if (!values.length) return;
  const min   = options.min ?? Math.min(...values);
  const max   = options.max ?? Math.max(...values);
  const range = (max - min) || 1;

  ctx.beginPath();
  values.forEach((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * (width - 30) + 15;
    const y = height - 18 - ((value - min) / range) * (height - 36);
    if (index === 0) ctx.moveTo(x, y);
    else             ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2.5;
  ctx.stroke();
}

function drawMedicationBars(canvas, entries) {
  if (!canvas) return;
  const ctx = clearCanvas(canvas);
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const pL = 40, pR = 12, pT = 10, pB = 28;
  const cW = W - pL - pR, cH = H - pT - pB;

  const groups = [
    { key: 'propofol',  color: '#4da3ff' },
    { key: 'ketamin',   color: '#7bc043' },
    { key: 'fentanyl',  color: '#ffb000' },
    { key: 'isofluran', color: '#ff5c5c' }
  ];

  const recent   = entries.length ? entries.slice(-8) : [];
  const allVals  = recent.flatMap(e => groups.map(g => Number(e[g.key] || 0)));
  const rawMax   = Math.max(1, ...allVals);
  const yMax     = Math.ceil(rawMax / 10) * 10 + 10;
  const ySteps   = 4;

  // Y-axis grid + labels
  for (let i = 0; i <= ySteps; i++) {
    const val = (yMax / ySteps) * i;
    const y   = pT + cH - (val / yMax) * cH;
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(pL + cW, y); ctx.stroke();
    ctx.fillStyle   = 'rgba(255,255,255,0.5)';
    ctx.font        = '11px Arial';
    ctx.textAlign   = 'right';
    ctx.fillText(Math.round(val), pL - 5, y + 4);
  }

  if (!recent.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.font = '13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('No medication data yet', W / 2, H / 2);
    return;
  }

  const groupW    = cW / recent.length;
  const barW      = Math.max(6, Math.min(18, (groupW - 20) / groups.length));
  const barGap    = 3;
  const totalBarW = groups.length * (barW + barGap) - barGap;

  recent.forEach((item, idx) => {
    const cx     = pL + idx * groupW + groupW / 2;
    const startX = cx - totalBarW / 2;

    groups.forEach((g, gi) => {
      const val = Number(item[g.key] || 0);
      if (val <= 0) return;
      const bh  = (val / yMax) * cH;
      const x   = startX + gi * (barW + barGap);
      const y   = pT + cH - bh;
      const gr  = ctx.createLinearGradient(x, y, x, y + bh);
      gr.addColorStop(0, g.color);
      gr.addColorStop(1, g.color + '66');
      ctx.fillStyle = gr;
      ctx.fillRect(x, y, barW, bh);
    });

    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font      = '14px courier new';
    ctx.textAlign = 'center';
    ctx.fillText(item.label || '', cx, H - 7);
  });
}


function _spline(ctx, pts) {
  if (pts.length < 2) return;
  ctx.moveTo(pts[0].x, pts[0].y);
  const t = 0.35; // tension
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    ctx.bezierCurveTo(
      p1.x + (p2.x - p0.x) * t, p1.y + (p2.y - p0.y) * t,
      p2.x - (p3.x - p1.x) * t, p2.y - (p3.y - p1.y) * t,
      p2.x, p2.y
    );
  }
}

function drawVitalTrend(canvas, entries) {
  if (!canvas) return;
  const ctx = clearCanvas(canvas);
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;

  const pL = 10, pR = 10, pT = 12, pB = 12;
  const cW = W - pL - pR, cH = H - pT - pB;


  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth   = 1;
  [0.25, 0.5, 0.75].forEach(f => {
    const y = pT + f * cH;
    ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(pL + cW, y); ctx.stroke();
  });

  if (!entries.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.font = '14px Arial'; ctx.textAlign = 'center';
    ctx.fillText('No monitoring values yet', W / 2, H / 2);
    return;
  }

  const recent = entries.slice(-40);
  const n      = recent.length;


  const series = [
    { key: 'bpSys', color: '#ffd400', yHi: 0.02, yLo: 0.40 }, // top band
    { key: 'spo2',  color: '#49d8ff', yHi: 0.22, yLo: 0.60 }, // upper-middle
    { key: 'temp',  color: '#ff5c5c', yHi: 0.44, yLo: 0.82 }, // lower-middle
    { key: 'mv',    color: '#c79cff', yHi: 0.62, yLo: 1.00 }, // bottom band
  ];

  series.forEach(s => {
    const vals = recent.map(e => Number(e[s.key] || 0));
    const real = vals.filter(v => v > 0);
    if (!real.length) return;

    const vMin  = Math.min(...real);
    const vMax  = Math.max(...real);
    const range = (vMax - vMin) || 1;

    // Map value → Y coordinate within this series' band
    const bandH = (s.yLo - s.yHi) * cH;
    const yOf   = v => pT + s.yHi * cH + bandH - ((v - vMin) / range) * bandH * 0.88 + bandH * 0.06;

    const pts = recent.reduce((acc, e, i) => {
      const v = Number(e[s.key] || 0);
      if (v > 0) acc.push({ x: pL + (i / Math.max(n - 1, 1)) * cW, y: yOf(v), v });
      return acc;
    }, []);
    if (pts.length < 2) return;

  
    ctx.save();
    ctx.shadowColor = s.color;
    ctx.shadowBlur  = 8;
    ctx.beginPath();
    _spline(ctx, pts);
    ctx.strokeStyle = s.color + '55';
    ctx.lineWidth   = 5;
    ctx.stroke();
    ctx.restore();

─
    ctx.save();
    ctx.shadowColor = s.color;
    ctx.shadowBlur  = 4;
    ctx.beginPath();
    _spline(ctx, pts);
    ctx.strokeStyle = s.color;
    ctx.lineWidth   = 2.5;
    ctx.stroke();
    ctx.restore();

    
    ctx.shadowBlur = 0;
    pts.forEach((p, i) => {
      if (i % 4 !== 0 && i !== pts.length - 1) return;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle   = s.color;
      ctx.shadowColor = s.color;
      ctx.shadowBlur  = 6;
      ctx.fill();
      ctx.shadowBlur  = 0;
    });
  });
}

function drawEtco2Trend(canvas, entries) {
  if (!canvas) return;
  const ctx = clearCanvas(canvas);
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const pL = 8, pR = 8, pT = 8, pB = 8;
  const cW = W - pL - pR, cH = H - pT - pB;

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = pT + (i / 4) * cH;
    ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(pL + cW, y); ctx.stroke();
  }

  if (!entries.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.font = '12px Arial'; ctx.textAlign = 'center';
    ctx.fillText('No ETCO₂ data', W / 2, H / 2);
    return;
  }

  const recent = entries.slice(-40);
  const vals   = recent.map(e => Number(e.etco2 || 0));
  const real   = vals.filter(v => v > 0);
  if (!real.length) return;
  const vMin = Math.min(...real), vMax = Math.max(...real);
  const range = (vMax - vMin) || 1;

  // Capnography-style: flat baseline, then rapid rise + plateau, then drop
  ctx.beginPath();
  vals.forEach((val, i) => {
    const x    = pL + (i / Math.max(recent.length - 1, 1)) * cW;
    const norm = val > 0 ? (val - vMin) / range : 0;
    const y    = pT + cH - norm * cH * 0.85 - cH * 0.07;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#e8e8e8';
  ctx.lineWidth   = 1.8;
  ctx.stroke();
}

function drawEcgStrip(canvas, entries) {
  if (!canvas) return;
  const ctx = clearCanvas(canvas);
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const pL = 10, pR = 10, pB = 26;
  const cW = W - pL - pR;
  const cH = H - pB;           // usable chart height

  // Split chart vertically:
  //   ECG waveform  → top 65%  (y: 0 … ecgH)
  //   Breathing wave → bottom 35% (y: ecgH … cH)
  const ecgH  = Math.round(cH * 0.65);
  const respH = cH - ecgH;     // 35%


  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth   = 1;
  // Horizontal separator between ECG and breathing zones
  ctx.beginPath(); ctx.moveTo(pL, ecgH); ctx.lineTo(pL + cW, ecgH); ctx.stroke();
  // Two lines inside ECG zone
  [0.33, 0.66].forEach(f => {
    const y = f * ecgH;
    ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(pL + cW, y); ctx.stroke();
  });

  if (!entries.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.font = '14px Arial'; ctx.textAlign = 'center';
    ctx.fillText('No ECG data yet', W / 2, ecgH / 2);
    return;
  }

  const recent = entries.slice(-80);
  const n      = recent.length;


  const CYCLE = 14;

  const ECG_SHAPE = [
    0.42,  //  0 isoelectric
    0.42,  //  1 isoelectric
    0.50,  //  2 P wave up
    0.47,  //  3 P wave down
    0.42,  //  4 PR segment
    0.29,  //  5 Q dip
    0.97,  //  6 R spike  ← always fires, very tall
    0.17,  //  7 S dip
    0.42,  //  8 return to baseline
    0.42,  //  9 ST segment
    0.49,  // 10 T wave rise
    0.54,  // 11 T peak
    0.47,  // 12 T fall
    0.42,  // 13 back to isoelectric
  ];

  const ecgTop = 4, ecgBot = ecgH - 4;
  const drawH  = ecgBot - ecgTop;

  ctx.beginPath();
  recent.forEach((item, i) => {
    const x      = pL + (i / Math.max(n - 1, 1)) * cW;
    const v      = ECG_SHAPE[i % CYCLE];
    const hrAdj  = (Number(item.hr || 75) - 75) / 700;   // subtle HR influence
    const y      = ecgBot - (v + hrAdj) * drawH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#7bc043';
  ctx.lineWidth   = 2.4;
  ctx.stroke();

 
  const respTop = ecgH + 4, respBot = cH - 4;
  const respAmp = (respBot - respTop) * 0.42;   // 42% of zone height
  const respMid = (respTop + respBot) / 2;

  ctx.beginPath();
  recent.forEach((item, i) => {
    const x    = pL + (i / Math.max(n - 1, 1)) * cW;
    const resp = Number(item.resp || 20);
    // 4 breathing cycles: 4 * 2π over n samples
    const angle = (i / Math.max(n - 1, 1)) * Math.PI * 8;
    const amp   = respAmp * (0.85 + resp / 200);
    const y     = respMid - amp * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#ff4b2b';
  ctx.lineWidth   = 2;
  ctx.stroke();

  
  ctx.fillStyle   = 'rgba(255,255,255,0.55)';
  ctx.font        = '14px courier new';
  ctx.textAlign   = 'center';
  const steps = Math.min(5, n);
  for (let i = 0; i <= steps; i++) {
    const idx  = Math.round((i / steps) * (n - 1));
    const item = recent[idx];
    if (!item?.label) continue;
    ctx.fillText(item.label, pL + (idx / Math.max(n - 1, 1)) * cW, H - 7);
  }
}

function formatNumber(value, decimals = 0) {
  if (value == null || Number.isNaN(value)) return '0';
  return Number(value).toFixed(decimals);
}

function updateTimeline(refs) {
  if (!refs.timeline) return;
  const items = pigMonitoringState.events.slice(-4);
  if (!items.length) {
    refs.timeline.innerHTML = '<span class="monitor-event-pill">No procedure events recorded yet</span>';
    return;
  }
  refs.timeline.innerHTML = items.map(item => `
    <span class="monitor-event-pill"><strong>${item.displayTime || ''}</strong> ${item.text || ''}</span>
  `).join('');
}

/** Set a bar-gauge fill element height (5–100%) relative to max. */
function setBarHeight(el, value, max) {
  if (!el || !max) return;
  const pct = Math.max(8, Math.min(100, (value / max) * 100));
  el.style.height = `${pct}%`;
}

function updateDashboardTiles(entry, refs) {
  if (!refs.dashboard) return;
  const d = refs.dashboard;


  if (d.vtValue)     d.vtValue.textContent     = formatNumber(entry.vtMl || 0, 1);
  if (d.respValue)   d.respValue.textContent   = formatNumber(entry.resp  || 0, 1);
  if (d.peepValue)   d.peepValue.textContent   = formatNumber(entry.peep  || 0, 1);
  if (d.o2Value)     d.o2Value.textContent     = `${formatNumber(entry.spo2 || 0, 1)}%`;
  if (d.o2TileValue) d.o2TileValue.textContent = `${formatNumber(entry.spo2 || 0, 1)}%`;
  if (d.flowValue)   d.flowValue.textContent   = formatNumber(entry.flow  || 0, 1);
  if (d.etco2Value)  d.etco2Value.textContent  = formatNumber(entry.etco2 || 0, 1);
  if (d.hrValue)     d.hrValue.textContent     = formatNumber(entry.hr    || 0, 1);
  if (d.bpValue)     d.bpValue.textContent     = `${formatNumber(entry.bpSys || 0, 1)}/${formatNumber(entry.bpDia || 0, 1)}`;
  if (d.tempValue)   d.tempValue.textContent   = formatNumber(entry.temp  || 0, 1);
  if (d.mvValue)     d.mvValue.textContent     = formatNumber(entry.mv    || 0, 1);
  if (d.pmaxBarValue) d.pmaxBarValue.textContent = formatNumber(entry.pmax || 0, 1);

  // Vt: normal pig range 300–600 mL, max scale 800 mL
  setBarHeight(d.vtBar,   entry.vtMl || 0, 800);
  // RR: normal 25–35 /min, max scale 50
  setBarHeight(d.respBar, entry.resp  || 0, 50);
  // PEEP: normal 4–8 cmH₂O, max scale 20
  setBarHeight(d.peepBar, entry.peep  || 0, 20);
  // Pmax: normal 15–25 cmH₂O, max scale 40
  setBarHeight(d.pmaxBar, entry.pmax  || 0, 40);
  // SpO₂: compress 80–100% range into full bar height
  setBarHeight(d.spo2Bar, Math.max(0, (entry.spo2 || 0) - 80), 20);
  // Flow: max 10 L/min
  setBarHeight(d.flowBar, entry.flow  || 0, 10);
}

function updatePigDashboard(entry, refs) {
  applyPigValue(refs.status.hr,   entry.hr,   'bpm',   pigRanges.hr.min,   pigRanges.hr.max);
  applyPigValue(refs.status.temp, entry.temp, '°C',    pigRanges.temp.min, pigRanges.temp.max);
  applyPigBP   (refs.status.bp,   entry.bpSys, entry.bpDia);
  applyPigValue(refs.status.resp, entry.resp, '/min',  pigRanges.resp.min, pigRanges.resp.max);
  applyPigValue(refs.status.vt,   entry.vt,   'L',     pigRanges.vt.min,   pigRanges.vt.max);
  applyPigValue(refs.status.mv,   entry.mv,   'L/min', pigRanges.mv.min,   pigRanges.mv.max);

  applyPigRange(refs.ranges.hr,   entry.hr,    pigRanges.hr.min,    pigRanges.hr.max);
  applyPigRange(refs.ranges.temp, entry.temp,  pigRanges.temp.min,  pigRanges.temp.max);
  applyPigRange(refs.ranges.bp,   entry.bpSys, pigRanges.bpSys.min, pigRanges.bpSys.max);
  applyPigRange(refs.ranges.resp, entry.resp,  pigRanges.resp.min,  pigRanges.resp.max);
  applyPigRange(refs.ranges.vt,   entry.vt,    pigRanges.vt.min,    pigRanges.vt.max);
  applyPigRange(refs.ranges.mv,   entry.mv,    pigRanges.mv.min,    pigRanges.mv.max);

  updateDashboardTiles(entry, refs);
}

function redrawPigCharts(refs) {
  if (!refs.dashboard) return;
  const history = pigMonitoringState.history;
  drawMedicationBars(refs.dashboard.medicationChart, history);
  drawVitalTrend    (refs.dashboard.vitalsChart,     history);
  drawEtco2Trend    (refs.dashboard.etco2Chart,      history);
  drawEcgStrip      (refs.dashboard.ecgChart,        history);
}

function zeroPigEntry() {
  return {
    label: '',
    hr: 0, temp: 0, bpSys: 0, bpDia: 0,
    resp: 0, vt: 0, vtMl: 0, mv: 0,
    spo2: 0, etco2: 0, peep: 0, pmax: 0, flow: 0,
    propofol: 0, ketamin: 0, fentanyl: 0, isofluran: 0
  };
}

function entryFromMeasurements(measurements) {
  const pulse = Number(measurements.pulse ?? 0);
  const temp  = Number(measurements.temp  ?? 0);
  const resp  = Number(measurements.frequency ?? 0);
  let bpSys = 0;
  let bpDia = 0;
  if (typeof measurements.tbp === 'string' && measurements.tbp.includes('/')) {
    const [sys, dia] = measurements.tbp.split('/');
    bpSys = Number(sys) || 0;
    bpDia = Number(dia) || 0;
  }
  const vtMl = Number(measurements.vt ?? 0);
  const vt   = vtMl > 0 ? Number((vtMl / 1000).toFixed(2)) : 0;

  return {
    timestamp: Date.now(),
    label:     new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    hr:        pulse,
    temp,
    bpSys,
    bpDia,
    resp,
    vt,
    vtMl,
    mv:        Number(measurements.mv        ?? 0),
    spo2:      Number(measurements.o2_primary ?? 0),
    etco2:     Number(measurements.etco2     ?? 0),
    peep:      Number(measurements.peep      ?? 0),
    pmax:      Number(measurements.pmax      ?? 0),
    flow:      Number(measurements.flow      ?? 0),
    propofol:  Number(measurements.propofol  ?? 0),
    ketamin:   Number(measurements.ketamin   ?? 0),
    fentanyl:  Number(measurements.fentanyl  ?? 0),
    isofluran: Number(measurements.isofluran ?? 0)
  };
}

export function initPigMonitoring(refs) {
  updatePigDashboard(zeroPigEntry(), refs);
  redrawPigCharts(refs);
  updateTimeline(refs);
}

export function togglePigMonitoring(refs) {
  pigMonitoringState.visible = !pigMonitoringState.visible;
  refs.panel.classList.toggle('hidden', !pigMonitoringState.visible);
}

export function ensurePigMonitoringVisible(refs) {
  pigMonitoringState.visible = true;
  refs.panel.classList.remove('hidden');
}

export function resetPigMonitoring(refs) {
  pigMonitoringState.history = [];
  pigMonitoringState.events  = [];
  updatePigDashboard(zeroPigEntry(), refs);
  redrawPigCharts(refs);
  updateTimeline(refs);
}

export function pushPigMonitoringData(measurements, refs, { allowExperimental = false } = {}) {
  const entry   = entryFromMeasurements(measurements);
  const hasData = entry.hr > 0 || entry.temp > 0 || entry.bpSys > 0 ||
                  entry.resp > 0 || entry.vt > 0 || entry.mv > 0 || entry.etco2 > 0;
  if (!hasData && !allowExperimental) return;

  pigMonitoringState.history.push(entry);
  if (pigMonitoringState.history.length > 300) {
    pigMonitoringState.history.shift();
  }

  updatePigDashboard(entry, refs);
  redrawPigCharts(refs);
}

export function replacePigMonitoringHistory(entries, refs) {
  pigMonitoringState.history = [];
  entries.forEach(measurements => {
    pigMonitoringState.history.push(entryFromMeasurements(measurements));
  });
  const latest = pigMonitoringState.history[pigMonitoringState.history.length - 1] || zeroPigEntry();
  updatePigDashboard(latest, refs);
  redrawPigCharts(refs);
}

export function setPigMonitoringEvents(events, refs) {
  pigMonitoringState.events = Array.isArray(events) ? [...events] : [];
  updateTimeline(refs);
}

export function getPigMonitoringExportPayload() {
  return {
    rows: pigMonitoringState.history.map(item => ({
      timestamp:            item.timestamp,
      label:                item.label,
      hr:                   item.hr,
      temperature_c:        item.temp,
      bp_sys:               item.bpSys,
      bp_dia:               item.bpDia,
      respiration_rate:     item.resp,
      tidal_volume_l:       item.vt,
      tidal_volume_ml:      item.vtMl,
      minute_volume_l_min:  item.mv,
      spo2_percent:         item.spo2,
      etco2_mmhg:           item.etco2,
      peep_cmh2o:           item.peep,
      flow_l_min:           item.flow,
      propofol_ml_h:        item.propofol,
      ketamin_ml_h:         item.ketamin,
      fentanyl_ml_h:        item.fentanyl,
      isofluran_vol_percent: item.isofluran
    })),
    events: pigMonitoringState.events.map(item => ({
      time: item.displayTime || '',
      text: item.text        || ''
    }))
  };
}
