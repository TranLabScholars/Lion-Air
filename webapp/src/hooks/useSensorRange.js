import { useEffect, useState } from 'react';

const API_KEY = process.env.REACT_APP_PURPLEAIR_API_KEY;
const API_BASE = process.env.REACT_APP_API_BASE;
const DAY = 86400000;
const TTL = 30 * 60 * 1000; // 30 minutes
const AVERAGE_MINUTES = 360;

const memory = new Map();
const inflight = new Map();

const mean = (arr) => {
  const v = arr.filter(Number.isFinite);
  return v.length ? Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)) : null;
};

function summarize(points) {
  const weekCutoff = Date.now() - 7 * DAY;
  const week = points.filter((p) => p.t >= weekCutoff);
  return {
    history7: week,
    history30: points,
    avg7: mean(week.map((p) => p.pm25)),
    avg30: mean(points.map((p) => p.pm25)),
  };
}

function mockPoints() {
  const now = Date.now();
  const out = [];
  for (let t = now - 31 * DAY; t <= now; t += AVERAGE_MINUTES * 60000) {
    const day = (t / DAY) * 2 * Math.PI;
    out.push({ t, pm25: Number((8 + 4 * Math.sin(day) + 3 * Math.sin(day / 7)).toFixed(1)) });
  }
  return out;
}

function readSession(id) {
  try {
    const raw = sessionStorage.getItem(`pa.range.${id}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(id, entry) {
  try {
    sessionStorage.setItem(`pa.range.${id}`, JSON.stringify(entry));
  } catch {
    /* storage full or unavailable: memory cache still works */
  }
}

async function requestRange(sensor) {
  console.log(`${API_BASE}/sensors/${sensor.sensorIndex}/history`)
  if (!API_KEY) return summarize(mockPoints());

  const start = Math.floor((Date.now() - 31 * DAY) / 1000);
  const params = new URLSearchParams({
    fields: 'pm2.5_atm',
    average: String(AVERAGE_MINUTES),
    start_timestamp: String(start),
  });
  if (sensor.readKey) params.set('read_key', sensor.readKey);
  const res = await fetch(
    `${API_BASE}/sensors/${sensor.sensorIndex}/history?${params}`,
    { headers: { 'X-API-KEY': API_KEY } },
  );
  if (!res.ok) throw new Error(`History request failed (${res.status})`);

  const json = await res.json();
  const col = (json.fields || []).indexOf('pm2.5_atm');
  const tCol = (json.fields || []).indexOf('time_stamp');
  const points = (json.data || [])
    .map((row) => ({ t: row[tCol] * 1000, pm25: Number(row[col]) }))
    .filter((p) => Number.isFinite(p.pm25))
    .sort((a, b) => a.t - b.t);

  return summarize(points);
}

async function loadRange(sensor) {
  const id = String(sensor.sensorIndex);
  const now = Date.now();

  const mem = memory.get(id);
  if (mem && now - mem.at < TTL) return mem.data;

  const stored = readSession(id);
  if (stored && now - stored.at < TTL) {
    memory.set(id, stored);
    return stored.data;
  }

  if (inflight.has(id)) return inflight.get(id);

  const p = requestRange(sensor)
    .then((data) => {
      const entry = { at: Date.now(), data };
      memory.set(id, entry);
      writeSession(id, entry);
      return data;
    })
    .finally(() => inflight.delete(id));

  inflight.set(id, p);
  return p;
}

export default function useSensorRange(sensor, enabled) {
  const id = sensor?.sensorIndex;
  const [state, setState] = useState({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!enabled || id == null) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    loadRange(sensor)
      .then((data) => { if (!cancelled) setState({ data, loading: false, error: null }); })
      .catch((e) => { if (!cancelled) setState({ data: null, loading: false, error: e.message }); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, id]);

  return state;
}
