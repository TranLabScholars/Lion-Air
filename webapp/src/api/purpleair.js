import { BACKEND_URL } from 'config/purpleair';

// All PurpleAir calls go through our own backend (/api/v1/purpleair/...), which holds the API key.
// Nothing secret is needed or sent from the browser.

const CURRENT_FIELDS = [
  'name', 'latitude', 'longitude', 'last_seen',
  'humidity', 'temperature', 'pressure',
  'pm1.0_atm', 'pm2.5_atm', 'pm10.0_atm',
  'pm2.5_10minute', 'pm2.5_60minute', 'pm2.5_24hour',
].join(',');

async function request(path, params = {}, { text = false } = {}) {
  // The base is a window.location.origin fallback so a relative BACKEND_URL ('') still forms a valid URL.
  const url = new URL(`${BACKEND_URL}/api/v1/purpleair${path}`, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });

  let res;
  try {
    res = await fetch(url.toString());
  } catch (e) {
    throw new Error(`Could not reach the server (${e.message}).`);
  }
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).description || ''; } catch (e) { /* ignore */ }
    if (res.status === 403) throw new Error(`PurpleAir rejected the request (403). ${detail || 'Check the server API key and the sensor read key.'}`);
    if (res.status === 404) throw new Error(`Sensor not found. ${detail}`);
    if (res.status === 503) throw new Error(detail || 'PurpleAir is not configured on the server.');
    throw new Error(`PurpleAir error ${res.status}. ${detail}`);
  }
  return text ? res.text() : res.json();
}

// Combines the sensor's two laser channels; returns null if unusable or the channels disagree.
function mergeChannels(a, b) {
  const okA = typeof a === 'number' && a >= 0;
  const okB = typeof b === 'number' && b >= 0;
  if (okA && okB) {
    const mean = (a + b) / 2;
    if (Math.abs(a - b) >= 5 && Math.abs(a - b) / mean >= 0.61) return null;
    return mean;
  }
  if (okA) return a;
  if (okB) return b;
  return null;
}

// ── Public API ─────────────────────────────────────────────────────────────
export async function fetchSensor(index, readKey) {
  const { sensor: s } = await request(`/sensors/${index}`, { fields: CURRENT_FIELDS, read_key: readKey });
  const st = s.stats || {};
  const avg = (k) => st[k] ?? s[k];

  return {
    index: s.sensor_index,
    name: s.name,
    latitude: s.latitude,
    longitude: s.longitude,
    lastSeen: s.last_seen,
    pm1: s['pm1.0_atm'],
    pm25: s['pm2.5_atm'],
    pm10: s['pm10.0_atm'],
    pm25_10min: avg('pm2.5_10minute'),
    pm25_60min: avg('pm2.5_60minute'),
    pm25_24h: avg('pm2.5_24hour'),
    tempF: s.temperature,
    humidity: s.humidity,
    pressure: s.pressure,
  };
}

// Last 24h, hourly averages (averages channel A and B).
export async function fetchHistory(index, readKey) {
  const end = Math.floor(Date.now() / 1000);
  const json = await request(`/sensors/${index}/history`, {
    fields: 'pm2.5_atm_a,pm2.5_atm_b',
    average: 60,
    start_timestamp: end - 86400,
    end_timestamp: end,
    read_key: readKey,
  });

  const cols = json.fields || [];
  const iT = cols.indexOf('time_stamp');
  const iA = cols.indexOf('pm2.5_atm_a');
  const iB = cols.indexOf('pm2.5_atm_b');
  if (iT < 0) return [];

  const buckets = new Map();
  (json.data || []).forEach((row) => {
    const v = mergeChannels(row[iA], row[iB]);
    if (v === null) return;
    const hour = Math.floor(row[iT] / 3600) * 3600 * 1000;
    const e = buckets.get(hour) || { sum: 0, n: 0 };
    e.sum += v;
    e.n += 1;
    buckets.set(hour, e);
  });

  return [...buckets.entries()]
    .sort((x, y) => x[0] - y[0])
    .map(([t, { sum, n }]) => ({ t, pm25: Number((sum / n).toFixed(1)) }));
}

// Longer history for the week/month graph and averages: one request, 6-hour averages.
export async function fetchHistoryRange(index, readKey, { days = 31, average = 360 } = {}) {
  const end = Math.floor(Date.now() / 1000);
  const json = await request(`/sensors/${index}/history`, {
    fields: 'pm2.5_atm_a,pm2.5_atm_b',
    average,
    start_timestamp: end - days * 86400,
    end_timestamp: end,
    read_key: readKey,
  });

  const cols = json.fields || [];
  const iT = cols.indexOf('time_stamp');
  const iA = cols.indexOf('pm2.5_atm_a');
  const iB = cols.indexOf('pm2.5_atm_b');
  if (iT < 0) return [];

  return (json.data || [])
    .map((row) => ({ t: row[iT] * 1000, pm25: mergeChannels(row[iA], row[iB]) }))
    .filter((p) => p.pm25 !== null)
    .map((p) => ({ t: p.t, pm25: Number(p.pm25.toFixed(1)) }))
    .sort((x, y) => x.t - y.t);
}

// Columns in the CSV. These are PurpleAir history field names.
export const CSV_FIELDS = [
  'pm1.0_atm_a', 'pm1.0_atm_b',
  'pm2.5_atm_a', 'pm2.5_atm_b',
  'pm10.0_atm_a', 'pm10.0_atm_b',
  'humidity_a', 'temperature_a', 'pressure_a',
];

// Returns the raw CSV text for one sensor (hourly averages by default).
export async function fetchHistoryCsv(index, readKey, { hours = 24, average = 60 } = {}) {
  const end = Math.floor(Date.now() / 1000);
  return request(
    `/sensors/${index}/history/csv`,
    {
      fields: CSV_FIELDS.join(','),
      average,
      start_timestamp: end - hours * 3600,
      end_timestamp: end,
      read_key: readKey,
    },
    { text: true },
  );
}
