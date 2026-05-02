import { printReport } from './report.js';

function isNumeric(value) {
  if (value === null || value === undefined || value === '') return false;
  return !Number.isNaN(Number(value));
}

function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) return [];

  const headers = lines[0].split(',').map(h => h.trim());

  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? '';
    });
    return row;
  });
}

function normalizeInputData(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.measurements)) return data.measurements;
  return [];
}

function calculateStats(rows) {
  const numericColumns = {};
  const rowCount = rows.length;

  rows.forEach(row => {
    Object.entries(row).forEach(([key, value]) => {
      if (!isNumeric(value)) return;
      if (!numericColumns[key]) numericColumns[key] = [];
      numericColumns[key].push(Number(value));
    });
  });

  const summary = Object.entries(numericColumns).map(([key, values]) => {
    const count = values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const avg = values.reduce((sum, value) => sum + value, 0) / count;
    const latest = values[count - 1];

    return {
      parameter: key,
      count,
      min: Number(min.toFixed(2)),
      max: Number(max.toFixed(2)),
      avg: Number(avg.toFixed(2)),
      latest: Number(latest.toFixed(2))
    };
  });

  return {
    rowCount,
    parameterCount: summary.length,
    summary
  };
}

function renderAnalysisSummary(container, stats, fileName) {
  if (!stats) {
    container.innerHTML = `
      <h3>Data Analysis Summary</h3>
      <p class="muted">No analysis file loaded.</p>
    `;
    return;
  }

  const cards = `
    <div class="analysis-summary-grid">
      <div class="analysis-card">
        <h4>File</h4>
        <div class="value">${fileName}</div>
      </div>
      <div class="analysis-card">
        <h4>Rows</h4>
        <div class="value">${stats.rowCount}</div>
      </div>
      <div class="analysis-card">
        <h4>Numeric Parameters</h4>
        <div class="value">${stats.parameterCount}</div>
      </div>
    </div>
  `;

  const tableRows = stats.summary.length
    ? stats.summary.map(item => `
        <tr>
          <td>${item.parameter}</td>
          <td>${item.latest}</td>
          <td>${item.min}</td>
          <td>${item.max}</td>
          <td>${item.avg}</td>
          <td>${item.count}</td>
        </tr>
      `).join('')
    : `
      <tr>
        <td colspan="6">No numeric columns found in the file.</td>
      </tr>
    `;

  container.innerHTML = `
    <h3>Data Analysis Summary</h3>
    ${cards}
    <table class="report-table">
      <thead>
        <tr>
          <th>Parameter</th>
          <th>Latest</th>
          <th>Min</th>
          <th>Max</th>
          <th>Average</th>
          <th>Samples</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  `;
}

function renderPrintableAnalysis(printRoot, stats, fileName) {
  const tableRows = stats.summary.length
    ? stats.summary.map(item => `
        <tr>
          <td>${item.parameter}</td>
          <td>${item.latest}</td>
          <td>${item.min}</td>
          <td>${item.max}</td>
          <td>${item.avg}</td>
          <td>${item.count}</td>
        </tr>
      `).join('')
    : `
      <tr>
        <td colspan="6">No numeric columns found in the file.</td>
      </tr>
    `;

  printRoot.innerHTML = `
    <section class="print-report-page chart-style-report">
      <header class="print-report-header">
        <h1>Data Analysis Report</h1>
        <div><strong>Source file:</strong> ${fileName}</div>
        <div><strong>Rows analyzed:</strong> ${stats.rowCount}</div>
        <div><strong>Numeric parameters:</strong> ${stats.parameterCount}</div>
      </header>

      <section class="chart-table-section">
        <table class="chart-report-table">
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Latest</th>
              <th>Min</th>
              <th>Max</th>
              <th>Average</th>
              <th>Samples</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </section>
    </section>
  `;
}

async function readFileAsText(file) {
  return await file.text();
}

async function parseAnalysisFile(file) {
  const text = await readFileAsText(file);
  const lowerName = file.name.toLowerCase();

  if (lowerName.endsWith('.json')) {
    const parsed = JSON.parse(text);
    return normalizeInputData(parsed);
  }

  if (lowerName.endsWith('.csv')) {
    return parseCsv(text);
  }

  throw new Error('Unsupported file format. Use JSON or CSV.');
}

export function setupDataAnalysis({
  openButton,
  fileInput,
  previewContainer,
  printRoot,
  printButton
}) {
  let currentAnalysis = null;

  openButton?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const rows = await parseAnalysisFile(file);
      const stats = calculateStats(rows);

      currentAnalysis = {
        fileName: file.name,
        rows,
        stats
      };

      renderAnalysisSummary(previewContainer, stats, file.name);
      renderPrintableAnalysis(printRoot, stats, file.name);
    } catch (error) {
      currentAnalysis = null;
      previewContainer.innerHTML = `
        <h3>Data Analysis Summary</h3>
        <p class="muted">Failed to load file: ${error.message}</p>
      `;
      printRoot.innerHTML = '';
      console.error(error);
    } finally {
      fileInput.value = '';
    }
  });

  printButton?.addEventListener('click', () => {
    if (currentAnalysis) {
      renderPrintableAnalysis(printRoot, currentAnalysis.stats, currentAnalysis.fileName);
    }
    printReport();
  });

  return {
    getCurrentAnalysis() {
      return currentAnalysis;
    }
  };
}