 //The waves.js displays real-time biomedical waveforms on an HTML panel.
//It draws a structured grid background to simulate medical monitoring screens.
//The waveform dynamically adapts to incoming digital data using scaling and normalization.
//The waves.js handles missing or invalid samples seamlessly, ensuring continuous signal display
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

export function prepareWaveView(container) {
  container?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
