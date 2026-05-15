// The simulator.js program continuously generates simulated vital signs, such as heart rate, blood pressure, temperature, oxygen saturation, 
//and anesthetic drug levels.
//The program uses mathematical and random oscillations to simulate realistic physiological behavior over time.
//It also dynamically assesses the pig's status (stable/monitored/under observation) based on predefined thresholds.
//The simulator.js also structures data snapshots for reporting, recording, and real-time monitoring updates.



function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}


function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}


function formatNumber(value, decimals = 0) {
  return Number(value).toFixed(decimals);
}



function getClinicalCheck(pulse, systolic, temp, spo2, etco2) {
  if (pulse < 50 || systolic < 80 || spo2 < 92) {
    return 'Attention';
  }

  if (pulse > 110 || systolic < 90 || temp > 38.2 || spo2 < 94 || etco2 > 50) {
    return 'Observe';
  }

  return 'Stable';
}



function generateSimulatedSnapshot(t) {
  const slowPhase   = t / 180;
  const mediumPhase = t / 32;
  const fastPhase   = t / 8;

  const pulse = clamp(
    72 + 6 * Math.sin(slowPhase) + 3 * Math.sin(mediumPhase) + randomBetween(-2.2, 2.2),
    55, 108,
  );

  const systolic = clamp(
    118 + 8 * Math.sin(slowPhase + 0.6) + 4 * Math.sin(mediumPhase * 0.8) + randomBetween(-3, 3),
    92, 145,
  );

  const diastolic = clamp(
    74 + 5 * Math.sin(slowPhase + 0.9) + 3 * Math.sin(mediumPhase * 0.85) + randomBetween(-2, 2),
    56, 95,
  );

  const temp = clamp(
    36.8 + 0.18 * Math.sin(t / 420) + randomBetween(-0.04, 0.04),
    36.3, 37.6,
  );

  const o2Primary = clamp(
    48 + 4 * Math.sin(t / 150) + randomBetween(-1.0, 1.0),
    40, 60,
  );

  const propofol = clamp(
    8.5 + 0.8 * Math.sin(t / 210) + 0.3 * Math.sin(fastPhase / 2) + randomBetween(-0.15, 0.15),
    6.8, 10.5,
  );

  const ketamin = clamp(
    1.7 + 0.25 * Math.sin(t / 260 + 0.7) + randomBetween(-0.08, 0.08),
    1.1, 2.3,
  );

  const fentanyl = clamp(
    2.4 + 0.28 * Math.sin(t / 300 + 1.1) + randomBetween(-0.08, 0.08),
    1.9, 3.0,
  );

  const isofluran = clamp(
    0.92 + 0.08 * Math.sin(t / 240) + randomBetween(-0.03, 0.03),
    0.75, 1.15,
  );

  const flow = clamp(
    2.1 + 0.2 * Math.sin(t / 200) + randomBetween(-0.08, 0.08),
    1.6, 2.7,
  );

  const o2Secondary = clamp(
    44 + 3 * Math.sin(t / 160 + 0.2) + randomBetween(-0.8, 0.8),
    38, 52,
  );

  const pmax = clamp(
    18 + 2.2 * Math.sin(mediumPhase) + 0.8 * Math.sin(fastPhase) + randomBetween(-0.8, 0.8),
    13, 24,
  );

  const vt = clamp(
    510 + 35 * Math.sin(mediumPhase + 0.4) + 12 * Math.sin(fastPhase) + randomBetween(-10, 10),
    430, 620,
  );

  const frequency = clamp(
    12.5 + 1.1 * Math.sin(t / 95) + randomBetween(-0.4, 0.4),
    10, 16,
  );

  // Minute volume is derived from tidal volume and respiratory rate.
  const mv = clamp((vt / 1000) * frequency, 5.5, 8.8);

  const peep = clamp(
    5.2 + 0.4 * Math.sin(t / 220) + randomBetween(-0.12, 0.12),
    4.5, 6.2,
  );

  const etco2 = clamp(
    35 + 2.4 * Math.sin(t / 80 + 0.5) + 1.3 * Math.sin(t / 24) + randomBetween(-0.8, 0.8),
    30, 42,
  );

  const ki = getClinicalCheck(pulse, systolic, temp, o2Secondary, etco2);

  return {
    ki,
    pulse,
    systolic,
    diastolic,
    temp,
    o2_primary: o2Primary,
    propofol,
    ketamin,
    fentanyl,
    isofluran,
    flow,
    o2_secondary: o2Secondary,
    pmax,
    vt,
    frequency,
    mv,
    peep,
    etco2,
  };
}



function measurementSummary(data) {
  return {
    ki:           data.ki,
    pulse:        `${formatNumber(data.pulse, 0)}`,
    tbp:          `${formatNumber(data.systolic, 0)}/${formatNumber(data.diastolic, 0)}`,
    temp:         `${formatNumber(data.temp, 1)}`,
    o2_primary:   `${formatNumber(data.o2_primary, 0)}`,
    propofol:     `${formatNumber(data.propofol, 1)}`,
    ketamin:      `${formatNumber(data.ketamin, 2)}`,
    fentanyl:     `${formatNumber(data.fentanyl, 2)}`,
    isofluran:    `${formatNumber(data.isofluran, 2)}`,
    flow:         `${formatNumber(data.flow, 1)}`,
    o2_secondary: `${formatNumber(data.o2_secondary, 0)}`,
    pmax:         `${formatNumber(data.pmax, 0)}`,
    vt:           `${formatNumber(data.vt, 0)}`,
    frequency:    `${formatNumber(data.frequency, 0)}`,
    mv:           `${formatNumber(data.mv, 1)}`,
    peep:         `${formatNumber(data.peep, 1)}`,
    etco2:        `${formatNumber(data.etco2, 0)}`,
  };
}



function formatClockFromSeconds(totalSeconds) {
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}



export function renderSnapshotToUI(metricElements, data) {
  metricElements.ki.textContent           = data.ki;
  metricElements.pulse.textContent        = `${formatNumber(data.pulse, 0)} bpm`;
  metricElements.tbp.textContent          = `${formatNumber(data.systolic, 0)}/${formatNumber(data.diastolic, 0)}`;
  metricElements.temp.textContent         = `${formatNumber(data.temp, 1)} °C`;
  metricElements.o2_primary.textContent   = `${formatNumber(data.o2_primary, 0)} %`;
  metricElements.propofol.textContent     = `${formatNumber(data.propofol, 1)} ml/t`;
  metricElements.ketamin.textContent      = `${formatNumber(data.ketamin, 2)} ml/t`;
  metricElements.fentanyl.textContent     = `${formatNumber(data.fentanyl, 2)} ml/t`;
  metricElements.isofluran.textContent    = `${formatNumber(data.isofluran, 2)} vol%`;
  metricElements.flow.textContent         = `${formatNumber(data.flow, 1)} L/min`;
  metricElements.o2_secondary.textContent = `${formatNumber(data.o2_secondary, 0)} %`;
  metricElements.pmax.textContent         = `${formatNumber(data.pmax, 0)} cmH₂O`;
  metricElements.vt.textContent           = `${formatNumber(data.vt, 0)} ml`;
  metricElements.frequency.textContent    = `${formatNumber(data.frequency, 0)} /min`;
  metricElements.mv.textContent           = `${formatNumber(data.mv, 1)} L/min`;
  metricElements.peep.textContent         = `${formatNumber(data.peep, 1)} cmH₂O`;
  metricElements.etco2.textContent        = `${formatNumber(data.etco2, 0)} mmHg`;
}


export function renderReportPreview(reportPreviewElement, reportData) {
  const { patient, firstMeasurement, minuteMeasurements, lastMeasurement, eventLog } = reportData;

  const patientSummary = `
    <h4>Procedure Information</h4>
    <ul>
      <li>Dato: ${patient.date || '—'}</li>
      <li>ID: ${patient.id || '—'}</li>
      <li>Prosjekt: ${patient.project || '—'}</li>
      <li>Antall deltakere: ${patient.participants || '—'}</li>
      <li>Vekt (kg): ${patient.weight || '—'}</li>
      <li>Sedasjon kl.: ${patient.sedationTime || '—'}</li>
      <li>Intubert kl.: ${patient.intubationTime || '—'}</li>
      <li>Tube str.: ${patient.tubeSize || '—'}</li>
      <li>Notater: ${patient.notes || '—'}</li>
    </ul>
  `;

  const minuteList = minuteMeasurements.length
    ? minuteMeasurements.map((item) =>
        `<li>${item.time} — Puls ${item.data.pulse}, TBP ${item.data.tbp}, ` +
        `Temp ${item.data.temp}, ETCO₂ ${item.data.etco2}</li>`
      ).join('')
    : '<li>No minute measurements recorded yet.</li>';

  const eventList = eventLog.length
    ? eventLog.map((item) => `<li>${item.displayTime} — ${item.text}</li>`).join('')
    : '<li>No doctor comments recorded yet.</li>';

  reportPreviewElement.innerHTML = `
    <h3>Report Preview</h3>
    ${patientSummary}
    <h4>First Measurement</h4>
    <ul>
      <li>${
        firstMeasurement
          ? `${firstMeasurement.time} — Puls ${firstMeasurement.data.pulse}, ` +
            `TBP ${firstMeasurement.data.tbp}, Temp ${firstMeasurement.data.temp}, ` +
            `ETCO₂ ${firstMeasurement.data.etco2}`
          : 'Not recorded yet.'
      }</li>
    </ul>
    <h4>Measurements Every Minute</h4>
    <ul>${minuteList}</ul>
    <h4>Last Measurement</h4>
    <ul>
      <li>${
        lastMeasurement
          ? `${lastMeasurement.time} — Puls ${lastMeasurement.data.pulse}, ` +
            `TBP ${lastMeasurement.data.tbp}, Temp ${lastMeasurement.data.temp}, ` +
            `ETCO₂ ${lastMeasurement.data.etco2}`
          : 'Not recorded yet.'
      }</li>
    </ul>
    <h4>Doctor Comments / Events</h4>
    <ul>${eventList}</ul>
  `;
}



export function updateSimulationIndicators(elements, state) {
  const remaining         = Math.max(state.durationSeconds - state.elapsedSeconds, 0);
  const elapsedMinutes    = Math.floor(state.elapsedSeconds / 60);
  const elapsedRemainder  = String(state.elapsedSeconds % 60).padStart(2, '0');
  const remainingMinutes  = Math.floor(remaining / 60);
  const remainingRemainder = String(remaining % 60).padStart(2, '0');

  if (state.running) {
    elements.liveDataStatus.textContent =
      `Simulation running • elapsed ${elapsedMinutes}:${elapsedRemainder} ` +
      `• remaining ${remainingMinutes}:${remainingRemainder}`;
    elements.simulationStatusPill.textContent  = 'Simulation Running';
    elements.startSimulationButton.disabled    = true;
    return;
  }

  if (state.elapsedSeconds >= state.durationSeconds) {
    elements.liveDataStatus.textContent        = '20-minute simulation completed';
    elements.simulationStatusPill.textContent  = 'Simulation Complete';
    elements.startSimulationButton.disabled    = false;
    return;
  }

  elements.liveDataStatus.textContent        = 'Prepared for real-time values';
  elements.simulationStatusPill.textContent  = 'Simulation Idle';
  elements.startSimulationButton.disabled    = false;
}



export function createSimulator({ durationSeconds, stepMs, onUpdate, onComplete }) {
  let intervalId       = null;
  let running          = false;
  let elapsedSeconds   = 0;
  let latestSnapshot   = null;
  let firstMeasurement = null;
  let lastMeasurement  = null;
  let minuteMeasurements = [];
  let eventLog           = [];

  /** Return a copy of the current simulator state. */
  function getState() {
    return {
      running,
      elapsedSeconds,
      durationSeconds,
      latestSnapshot,
      firstMeasurement,
      lastMeasurement,
      minuteMeasurements,
      eventLog,
    };
  }

  function addEvent(text) {
    if (!text || !text.trim()) return;

    eventLog.push({
      timeInSeconds: elapsedSeconds,
      displayTime:   formatClockFromSeconds(elapsedSeconds),
      text:          text.trim(),
    });
  }

  /** Stop the simulation and fire the onComplete callback. */
  function stop() {
    clearInterval(intervalId);
    intervalId = null;
    running    = false;

    if (typeof onComplete === 'function') {
      onComplete(getState());
    }
  }

  function tick() {
    latestSnapshot     = generateSimulatedSnapshot(elapsedSeconds);
    const summary      = measurementSummary(latestSnapshot);
    const currentTime  = formatClockFromSeconds(elapsedSeconds);

    if (!firstMeasurement) {
      firstMeasurement = { time: currentTime, data: summary };
    }

    if (elapsedSeconds % 60 === 0) {
      minuteMeasurements.push({ time: currentTime, data: summary });
    }

    lastMeasurement = { time: currentTime, data: summary };

    if (typeof onUpdate === 'function') {
      onUpdate(latestSnapshot, getState());
    }

    elapsedSeconds += 1;

    if (elapsedSeconds > durationSeconds) {
      stop();
    }
  }


  function start() {
    if (running) return;

    elapsedSeconds     = 0;
    latestSnapshot     = null;
    firstMeasurement   = null;
    lastMeasurement    = null;
    minuteMeasurements = [];
    eventLog           = [];
    running            = true;

    tick(); // run the first tick immediately so the display updates at t=0
    intervalId = setInterval(tick, stepMs);
  }

  return { start, stop, addEvent, getState };
}
