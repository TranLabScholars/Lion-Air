import { useEffect, useState } from 'react';
import { fetchHistoryRange } from 'api/purpleair';


const DAY = 86400000;
const TTL = 30 * 60 * 1000; // 30 minutes

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
  }
}

async function requestRange(sensor) {
  const points = await fetchHistoryRange(sensor.sensorIndex, sensor.readKey);
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
