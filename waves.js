/**
 * waves.js
 * --------
 * Canvas rendering utilities for high-frequency waveform data.
 *
 * Draws waveforms (ECG, arterial pressure, pleth, CO₂) on an HTML
 * <canvas> element. Gaps in the data (null or non-finite values) are
 * rendered as breaks in the line rather than connecting across missing
 * samples.
 */


/**
 * Draw a faint grid on the canvas to give the waveform a monitor-like
 * appearance.
 *
 * @param {CanvasRenderingContext2D} ctx    - The 2D rendering context.
 * @param {number}                  width  - Canvas width in pixels.
 * @param {number}                  height - Canvas height in pixels.
 */
function drawGrid(ctx, width, height) {
  ctx.save();
  ctx.strokeStyle = 'rgba(120, 220, 255, 0.10)';
  ctx.lineWidth   = 1;

  for (let x = 0; x <= width; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.restore();
}


/**
 * Draw a waveform onto a canvas element.
 *
 * The y-axis is auto-scaled to the min/max of the finite samples in
 * ``data``. Non-finite values (null, NaN, Infinity) interrupt the line,
 * which visually represents recording gaps.
 *
 * @param {HTMLCanvasElement}      canvas - Target canvas element.
 * @param {(number|null)[]}        data   - Array of sample values. Use
 *                                          null or NaN to indicate gaps.
 * @param {string}                 [color='#00ff88'] - Stroke colour for
 *                                          the waveform line.
 */
export function drawWave(canvas, data, color = '#00ff88') {
  if (!canvas) return;

  const ctx    = canvas.getContext('2d');
  const width  = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);
  drawGrid(ctx, width, height);

  if (!data || !data.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font      = '14px Arial';
    ctx.fillText('No waveform data', 12, 22);
    return;
  }

  const finiteValues = data.filter((value) => Number.isFinite(value));
  if (!finiteValues.length) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font      = '14px Arial';
    ctx.fillText('Waveform contains no valid samples', 12, 22);
    return;
  }

  const min   = Math.min(...finiteValues);
  const max   = Math.max(...finiteValues);
  const range = (max - min) || 1; // avoid division by zero for flat signals

  ctx.strokeStyle = color;
  ctx.lineWidth   = 1;
  ctx.beginPath();

  let pathStarted = false;

  data.forEach((value, index) => {
    const x = (index / Math.max(data.length - 1, 1)) * (width - 1);

    if (!Number.isFinite(value)) {
      // Gap in the data — lift the pen so the next valid sample starts a new segment.
      pathStarted = false;
      return;
    }

    // Map the sample value to a canvas y-coordinate (top = high, bottom = low).
    const y = height - 10 - ((value - min) / range) * (height - 20);

    if (!pathStarted) {
      ctx.moveTo(x, y);
      pathStarted = true;
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();
}


/**
 * Scroll the waveform container into view smoothly.
 *
 * Called after a waveform is loaded so the user does not have to scroll
 * manually to see the newly rendered chart.
 *
 * @param {Element|null} container - The DOM element to scroll into view.
 */
export function prepareWaveView(container) {
  container?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
