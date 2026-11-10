import { BACKEND_URL } from 'config/purpleair';

const SENSORS_URL = `${BACKEND_URL}/api/v1/sensors`;
const ACTIVE_KEY = 'purpleair.activeSensor';
const READ_KEYS = 'purpleair.readKeys';

// ── Browser-only storage: which sensor is selected, and private read keys ──
// (the backend entity has no read key field, so those stay in this browser)
function readKeyMap() {
  try { return JSON.parse(localStorage.getItem(READ_KEYS)) || {}; } catch (e) { return {}; }
}

function saveReadKey(sensorIndex, readKey) {
  const map = readKeyMap();
  if (readKey) map[String(sensorIndex)] = readKey;
  else delete map[String(sensorIndex)];
  try { localStorage.setItem(READ_KEYS, JSON.stringify(map)); } catch (e) { /* ignore */ }
}

export function getActiveSensorIndex() {
  try {
    const v = localStorage.getItem(ACTIVE_KEY);
    return v ? Number(v) : null;
  } catch (e) { return null; }
}

export function setActiveSensor(sensorIndex) {
  try { localStorage.setItem(ACTIVE_KEY, String(sensorIndex)); } catch (e) { /* ignore */ }
}

// ── Backend ───────────────────────────────────────────────────────────────
async function backendFetch(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (e) {
    console.error('[backend] request failed:', options?.method || 'GET', url, e);
    throw new Error(
      `Request to ${url} was blocked or failed (${e.message}). ` +
      'Check the browser console: a CORS error means the backend rejected the preflight.',
    );
  }
  if (!res.ok) {
    throw new Error((await res.text()) || `Backend error ${res.status}`);
  }
  return res;
}

// Maps the Spring entity to the shape the UI uses.
function normalize(s, keys) {
  return {
    id: s.id,
    sensorIndex: Number(s.sensorIndex),
    name: s.sensorName,
    location: s.location,
    environment: s.sensorType,
    status: s.status,
    readKey: keys[String(s.sensorIndex)] || '',
  };
}

export async function fetchSensors() {
  const res = await backendFetch(SENSORS_URL);
  const data = await res.json();
  const list = Array.isArray(data) ? data : data.content || [];
  const keys = readKeyMap();
  return list.map((s) => normalize(s, keys));
}
export function clearActiveSensor() {
  try { localStorage.removeItem(ACTIVE_KEY); } catch (e) { /* ignore */ }
}
export async function registerSensor({ sensorName, sensorIndex, sensorType, location, readKey }) {
  const res = await backendFetch(SENSORS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sensorName,
      sensorIndex: String(sensorIndex),
      sensorType,
      location,
    }),
  });
  const saved = await res.json().catch(() => ({}));
  saveReadKey(sensorIndex, readKey);
  setActiveSensor(sensorIndex);
  return normalize(
    { ...saved, sensorIndex, sensorName, sensorType, location },
    readKeyMap(),
  );
}
