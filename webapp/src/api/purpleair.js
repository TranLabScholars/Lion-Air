import {API_BASE, API_KEY, SENSOR_INDEX, USE_MOCK} from 'config/purpleair';

const CURRENT_FIELDS = [
  'name', 'latitude', 'longitude', 'last_seen',
  'humidity', 'temperature', 'pressure',
  'pm1.0_atm', 'pm2.5_atm', 'pm10.0_atm',
  'pm2.5_10minute', 'pm2.5_60minute', 'pm2.5_24hour',
].join(',');

async function request(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString(), { headers: { 'X-API-key': API_KEY } });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).description || ''; } catch (e) { /* ignore */ }
    if (res.status === 403) throw new Error(`PurpleAir rejected the request (403). ${detail || 'Check your API key and sensor read key.'}`);
    if (res.status === 404) throw new Error(`Sensor not found. ${detail}`);
    throw new Error(`PurpleAir error ${res.status}. ${detail}`);
  }
  return res.json();
}

// ── Simulated data (used automatically when there is no API key) ──────────
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const seeded = (i) => ((Math.sin(Number(i) * 12.9898) * 43758.5453) % 1 + 1) % 1;

function mockPm(index, tSec) {
  const base = 6 + seeded(index) * 22;
  const daily = Math.sin((tSec / 86400) * 2 * Math.PI) * 5;
  const wobble = Math.sin(tSec / 1900) * 2;
  return Math.max(0.5, base + daily + wobble);
}

function mockCurrent(index) {
  const now = Math.floor(Date.now() / 1000);
  const pm = mockPm(index, now);
  return {
    index: Number(index),
    name: `Demo sensor ${index}`,
    latitude: 40.2732 + seeded(index) * 0.05,
    longitude: -76.8867 + seeded(index + 1) * 0.05,
    lastSeen: now - 40,
    pm1: pm * 0.62,
    pm25: pm,
    pm10: pm * 1.35,
    pm25_10min: mockPm(index, now - 300),
    pm25_60min: mockPm(index, now - 1800),
    pm25_24h: mockPm(index, now - 43200),
    tempF: 66 + Math.sin(now / 9000) * 8,
    humidity: 52 + Math.sin(now / 7000) * 14,
    pressure: 1014 + Math.sin(now / 20000) * 5,
  };
}

function mockHistory(index) {
  const now = Math.floor(Date.now() / 1000);
  return Array.from({ length: 24 }, (_, k) => {
    const t = now - (23 - k) * 3600;
    return { t: t * 1000, pm25: Number(mockPm(index, t).toFixed(1)) };
  });
}
// ── Public API ─────────────────────────────────────────────────────────────
export async function fetchSensor(index, readKey) {
  console.log('[purpleair] fetchSensor called', index, 'mock?', USE_MOCK);
  if (USE_MOCK) { await wait(350); return mockCurrent(index); }
  const { sensor: s } = await request(`/sensors/${index}`, { fields: CURRENT_FIELDS, read_key: readKey });
  const st = s.stats || {};
  const avg = (k) => st[k] ?? s[k];
  console.log('[purpleair] raw sensor', s);

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
// Last 24h, hourly averages (averages channel A and B).
export async function fetchHistory(index, readKey) {
  if (USE_MOCK) { await wait(450); return mockHistory(index); }
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
    const a = row[iA];
    const b = row[iB];
    const okA = typeof a === 'number' && a >= 0;
    const okB = typeof b === 'number' && b >= 0;
    let v;
    if (okA && okB) {
      const mean = (a + b) / 2;
      if (Math.abs(a - b) >= 5 && Math.abs(a - b) / mean >= 0.61) return; // channels disagree
      v = mean;
    } else if (okA) v = a;
    else if (okB) v = b;
    else return;

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

console.log(SENSOR_INDEX)
console.log('[purpleair] key loaded:', !!API_KEY, '| USE_MOCK:', USE_MOCK);
