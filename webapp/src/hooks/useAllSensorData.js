import { useCallback, useEffect, useState } from 'react';
import { fetchSensors } from 'api/sensorRegistry';
import { fetchSensor, fetchHistory } from 'api/purpleair';
import { POLL_MS } from 'config/purpleair';

// Loads the sensor list from the backend, then live readings and 24h history
// for every sensor from PurpleAir
export default function useAllSensorData(pollMs = POLL_MS) {
  const [state, setState] = useState({ items: [], loading: true, error: null });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const sensors = await fetchSensors();
      const results = await Promise.allSettled(
        sensors.map(async (s) => {
          const [current, history] = await Promise.all([
            fetchSensor(s.sensorIndex, s.readKey),
            fetchHistory(s.sensorIndex, s.readKey),
          ]);
          return { current, history };
        }),
      );
      const items = sensors.map((sensor, i) => ({
        sensor,
        current: results[i].status === 'fulfilled' ? results[i].value.current : null,
        history: results[i].status === 'fulfilled' ? results[i].value.history : [],
        error: results[i].status === 'rejected' ? results[i].reason.message : null,
      }));
      setState({ items, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e.message }));
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { ...state, refresh, refreshing };
}
