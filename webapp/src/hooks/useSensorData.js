import { useCallback, useEffect, useState } from 'react';
import { fetchSensor, fetchHistory } from 'api/purpleair';
import { POLL_MS } from 'config/purpleair';

export default function useSensorData(sensorIndex, readKey, { withHistory = true, pollMs = POLL_MS } = {}) {
  const [state, setState] = useState({ current: null, history: [], loading: true, error: null });

  const load = useCallback(async () => {
    try {
      const [current, history] = await Promise.all([
        fetchSensor(sensorIndex, readKey),
        withHistory ? fetchHistory(sensorIndex, readKey) : Promise.resolve([]),
      ]);
      setState({ current, history, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message }));
    }
  }, [sensorIndex, readKey, withHistory]);

  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    load();
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  return { ...state, refresh: load };
}
