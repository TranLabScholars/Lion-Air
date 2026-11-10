import { useEffect, useState } from 'react';
import { fetchSensors, getActiveSensorIndex } from 'api/sensorRegistry';

export default function useActiveSensor() {
  const [state, setState] = useState({ sensors: [], sensor: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    fetchSensors()
      .then((sensors) => {
        if (cancelled) return;
        const idx = getActiveSensorIndex();
        const sensor = sensors.find((s) => s.sensorIndex === idx) || sensors[0] || null;
        setState({ sensors, sensor, loading: false, error: null });
      })
      .catch((e) => {
        if (!cancelled) setState({ sensors: [], sensor: null, loading: false, error: e.message });
      });
    return () => { cancelled = true; };
  }, []);

  return state;
}
