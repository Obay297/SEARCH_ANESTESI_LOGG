/**
 * simulator.js
 * ------------
 * Simulation engine that generates realistic synthetic vital signs.
 *
 * Used in "simulation mode" when no VitalRecorder device is connected.
 * All vital signs are modelled as a combination of slow, medium, and
 * fast sine waves plus small random noise, keeping values within
 * physiologically plausible ranges for an anaesthetised pig.
 *
 * Public API (exported functions):
 *   createSimulator()           — factory that returns a simulator instance
 *   renderSnapshotToUI()        — write the latest snapshot values to DOM elements
 *   renderReportPreview()       — build a text-based report HTML preview
 *   updateSimulationIndicators()— update status labels and button states
 */


// ── Private helpers ────────────────────────────────────────────────────────────

/**
 * Clamp a number between a minimum and maximum value.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}


/**
 * Return a uniformly distributed random number in [min, max).
 *
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}


/**
 * Format a number with a fixed number of decimal places.
 *
 * @param {number} value
 * @param {number} [decimals=0]
 * @returns {string}
 */
function formatNumber(value, decimals = 0) {
  return Number(value).toFixed(decimals);
}


/**
 * Determine the clinical status category based on key vital signs.
 *
 * Thresholds are chosen for an anaesthetised pig and indicate whether
 * the anaesthetist should intervene immediately (Attention), monitor
 * more closely (Observe), or no action is needed (Stable).
 *
 * @param {number} pulse     - Heart rate in bpm.
 * @param {number} systolic  - Systolic blood pressure in mmHg.
 * @param {number} temp      - Body temperature in °C.
 * @param {number} spo2      - Peripheral oxygen saturation in %.
 * @param {number} etco2     - End-tidal CO₂ in mmHg.
 * @returns {'Attention'|'Observe'|'Stable'}
 */
function getClinicalCheck(pulse, systolic, temp, spo2, etco2) {
  if (pulse < 50 || systolic < 80 || spo2 < 92) {
    return 'Attention';
  }

  if (pulse > 110 || systolic < 90 || temp > 38.2 || spo2 < 94 || etco2 > 50) {
    return 'Observe';
  }

  return 'Stable';
}


/**
 * Generate one simulated vital-sign snapshot at time ``t``.
 *
 * Each signal is modelled using overlapping sine waves at different
 * frequencies plus a small random noise term, then clamped to a
 * physiological range. The slow-phase sine (~3 min cycle) models
 * gradual anaesthetic drift; the fast-phase (~8 s) models breath-to-
 * breath variation.
 *
 * @param {number} t - Elapsed time in seconds since the simulation started.
 * @returns {Object} A snapshot object with all vital-sign fields.
 */
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


/**
 * Convert a raw snapshot into the string-formatted summary the report uses.
 *
 * @param {Object} data - Raw snapshot from generateSimulatedSnapshot().
 * @returns {Object} Summary with all values formatted as strings.
 */
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


/**
 * Format elapsed seconds as a "MM:SS" clock string.
 *
 * @param {number} totalSeconds - Elapsed time in whole seconds.
 * @returns {string} E.g. "05:42"
 */
function formatClockFromSeconds(totalSeconds) {
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}


// ── Exported functions ─────────────────────────────────────────────────────────

/**
 * Write the latest vital-sign snapshot values into the live display DOM elements.
 *
 * @param {Object} metricElements - Map of field name → DOM element
 *                                  (e.g. ``{ pulse: HTMLElement, … }``).
 * @param {Object} data           - Raw snapshot from generateSimulatedSnapshot().
 */
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


/**
 * Render a text-based report preview into an HTML container element.
 *
 * @param {HTMLElement} reportPreviewElement - Container element to populate.
 * @param {Object}      reportData           - Object with patient, firstMeasurement,
 *                                             minuteMeasurements, lastMeasurement,
 *                                             and eventLog.
 */
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


/**
 * Update status labels and the start-button state to reflect simulation progress.
 *
 * @param {Object} elements - DOM element references:
 *   ``liveDataStatus``, ``simulationStatusPill``, ``startSimulationButton``.
 * @param {Object} state    - Current simulator state from ``getState()``.
 */
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


/**
 * Create a new simulator instance.
 *
 * The simulator advances time by one second on every tick, records a
 * measurement at the start of each minute, and stops automatically when
 * ``durationSeconds`` is reached.
 *
 * @param {Object}   options
 * @param {number}   options.durationSeconds - Total simulation length in seconds.
 * @param {number}   options.stepMs          - Interval between ticks in milliseconds
 *                                             (use 1000 for real-time).
 * @param {Function} options.onUpdate        - Called each tick with
 *                                             (snapshot, state).
 * @param {Function} options.onComplete      - Called once when the simulation ends,
 *                                             with the final state.
 * @returns {{ start: Function, stop: Function, addEvent: Function, getState: Function }}
 */
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

  /**
   * Add a timestamped clinical event to the event log.
   *
   * @param {string} text - Free-text description of the event.
   */
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

  /** Advance the simulation by one second and fire onUpdate. */
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

  /** Reset state and start the simulation from the beginning. */
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
