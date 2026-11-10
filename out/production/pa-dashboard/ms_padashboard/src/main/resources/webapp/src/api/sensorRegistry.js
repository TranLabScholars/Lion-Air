import { BACKEND_URL, SENSOR_INDEX, SENSOR_READ_KEY, SENSOR_LOCATION } from 'config/purpleair';

const LIST_KEY = 'purpleair.sensors';
const ACTIVE_KEY = 'purpleair.activeSensor';

export function getSensors() {
  try { return JSON.parse(localStorage.getItem(LIST_KEY)) || []; } catch (e) { return []; }
}

function saveSensors(list) {
  try { localStorage.setItem(LIST_KEY, JSON.stringify(list)); } catch (e) { /* storage unavailable */ }
}

export function removeSensor(sensorIndex) {
  saveSensors(getSensors().filter((s) => s.sensorIndex !== Number(sensorIndex)));
}

export function setActiveSensor(sensorIndex) {
  try { localStorage.setItem(ACTIVE_KEY, String(sensorIndex)); } catch (e) { /* ignore */ }
}

// The sensor the dashboard/map show: last one chosen by the user, else config default.
export function getActiveSensor() {
  const fallback = { sensorIndex: SENSOR_INDEX, readKey: SENSOR_READ_KEY, name: '', location: SENSOR_LOCATION };  try {
    const active = Number(localStorage.getItem(ACTIVE_KEY));
    return getSensors().find((s) => s.sensorIndex === active) || fallback;
  } catch (e) { return fallback; }
}

// Saves locally (always) and POSTs to the backend when REACT_APP_BACKEND_URL is set.
// Returns { backendOk: true | false | null } (null = no backend configured).
export async function registerSensor(payload) {
  const sensor = { ...payload, sensorIndex: Number(payload.sensorIndex), registeredAt: new Date().toISOString() };
  saveSensors([...getSensors().filter((s) => s.sensorIndex !== sensor.sensorIndex), sensor]);
  setActiveSensor(sensor.sensorIndex);

  if (!BACKEND_URL) return { sensor, backendOk: null };
  try {
    const res = await fetch(`${BACKEND_URL}/api/sensors/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sensor),
    });
    return { sensor, backendOk: res.ok };
  } catch (e) {
    return { sensor, backendOk: false };
  }
}
