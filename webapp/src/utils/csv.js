export function saveTextFile(filename, text, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const esc = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Combines several sensors' CSVs into one file, adding sensor columns up front.
export function mergeSensorCsvs(parts) {
  let header = null;
  const rows = [];
  parts.forEach(({ sensor, csv }) => {
    const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (!lines.length) return;
    if (!header) header = lines[0];
    const prefix = [sensor.sensorIndex, sensor.name, sensor.location].map(esc).join(',');
    lines.slice(1).forEach((l) => rows.push(`${prefix},${l}`));
  });
  if (!header) return '';
  return [`sensor_index,sensor_name,location,${header}`, ...rows].join('\n');
}
