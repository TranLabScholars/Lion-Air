import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AlertIcon, Box, Flex, Skeleton, Text } from '@chakra-ui/react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchSensors, setActiveSensor } from 'api/sensorRegistry';
import { fetchSensor } from 'api/purpleair';
import { POLL_MS } from 'config/purpleair';
import { aqiFromPm25, categoryFor } from 'utils/aqi';
import { Panel, AqiPill, fmt, timeAgo } from 'components/purpleair/ui';
import { useNavigate } from 'react-router-dom';

// Loads the sensor list from the backend, then each sensor's live reading from PurpleAir.
function useAllSensors() {
  const [state, setState] = useState({ rows: [], loading: true, error: null });

  const load = useCallback(async () => {
    try {
      const sensors = await fetchSensors();
      const results = await Promise.allSettled(
        sensors.map((s) => fetchSensor(s.sensorIndex, s.readKey)),
      );
      const rows = sensors.map((sensor, i) => ({
        sensor,
        current: results[i].status === 'fulfilled' ? results[i].value : null,
        error: results[i].status === 'rejected' ? results[i].reason.message : null,
      }));
      setState({ rows, loading: false, error: null });
    } catch (e) {
      setState({ rows: [], loading: false, error: e.message });
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  return state;
}

// Zooms the map so every marker is visible.
function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) map.setView(points[0], 14);
    else map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
  }, [map, points]);
  return null;
}

export default function SensorMap() {
  const { rows, loading, error } = useAllSensors();
  const navigate = useNavigate();

  const located = rows.filter((r) => r.current && Number.isFinite(r.current.latitude) && Number.isFinite(r.current.longitude));
  const failed = rows.filter((r) => r.error);
  const points = located.map((r) => [r.current.latitude, r.current.longitude]);
  const pointsKey = points.map((p) => p.join(',')).join('|');

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      {error && (
        <Alert status="error" borderRadius="12px" mb="20px"><AlertIcon />{error}</Alert>
      )}
      {!loading && !error && !rows.length && (
        <Alert status="info" borderRadius="12px" mb="20px">
          <AlertIcon />No sensors registered yet. Use "Add a sensor" in the sidebar.
        </Alert>
      )}
      {failed.length > 0 && (
        <Alert status="warning" borderRadius="12px" mb="20px">
          <AlertIcon />
          <Box>
            {failed.length} sensor{failed.length > 1 ? 's' : ''} could not be loaded and {failed.length > 1 ? 'are' : 'is'} not on the map:
            {failed.map((r) => (
              <Text key={r.sensor.sensorIndex} fontSize="sm">
                {r.sensor.name || r.sensor.sensorIndex}: {r.error}
              </Text>
            ))}
          </Box>
        </Alert>
      )}

      <Panel p="8px">
        <Skeleton isLoaded={!loading} minH="520px" borderRadius="12px">
          <Box h="520px" borderRadius="12px" overflow="hidden">
            <MapContainer
              center={[40.2, -76.8]}
              zoom={10}
              scrollWheelZoom
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds key={pointsKey} points={points} />
              {located.map(({ sensor, current }) => {
                const aqi = aqiFromPm25(current.pm25);
                const cat = categoryFor(aqi);
                return (
                  <CircleMarker
                    key={sensor.id || sensor.sensorIndex}
                    center={[current.latitude, current.longitude]}
                    radius={13}
                    pathOptions={{ color: '#ffffff', weight: 2, fillColor: cat.color, fillOpacity: 0.9 }}
                  >
                    <Popup>
                      <Box minW="180px">
                        <Text fontWeight="700">{sensor.name || current.name}</Text>
                        {sensor.location && <Text fontSize="sm">{sensor.location}</Text>}
                        <Text fontSize="sm" mt="6px">PM2.5: {fmt(current.pm25)} µg/m³</Text>
                        <Text fontSize="xs" color="gray.500" mb="6px">updated {timeAgo(current.lastSeen)}</Text>
                        <Flex align="center" gap="8px">
                          <AqiPill aqi={aqi} category={cat} />
                        </Flex>
                        <Text
                          as="button"
                          mt="8px"
                          fontSize="sm"
                          color="purple.600"
                          textDecoration="underline"
                          onClick={() => { setActiveSensor(sensor.sensorIndex); navigate('/admin/default'); }}
                        >
                          Show on dashboard
                        </Text>
                      </Box>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </Box>
        </Skeleton>
      </Panel>
    </Box>
  );
}
