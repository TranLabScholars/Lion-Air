import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AlertIcon, Box, Flex, Skeleton, Text } from '@chakra-ui/react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchSensors, setActiveSensor } from 'api/sensorRegistry';
import { fetchSensor } from 'api/purpleair';
import { POLL_MS } from 'config/purpleair';
import { aqiFromPm25, categoryFor } from 'utils/aqi';
import { Panel, AqiPill, fmt, timeAgo } from 'components/purpleair/ui';
import { useNavigate } from 'react-router-dom';

const WORLD_BOUNDS = [[-90, -180], [90, 180]];

// Remembers the last map position/zoom for as long as the app is open,
// so leaving the page and coming back doesn't reset the view.
let savedView = null;

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

// Fits the map to all markers ONCE (first time data arrives), and only if
// the user has no saved view. After that it never moves the map again.
function FitBoundsOnce({ points }) {
  const map = useMap();
  const done = useRef(!!savedView);
  useEffect(() => {
    if (done.current || !points.length) return;
    done.current = true;
    if (points.length === 1) map.setView(points[0], 14);
    else map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
  }, [map, points]);
  return null;
}

// Saves the view whenever the user pans or zooms.
function ViewTracker() {
  const map = useMapEvents({
    moveend: () => {
      savedView = { center: map.getCenter(), zoom: map.getZoom() };
    },
  });
  return null;
}

// Pick black or white text depending on how light the marker color is.
function textColorFor(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#fff';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#000' : '#fff';
}

// Colored circle with the AQI number inside.
function aqiIcon(aqi, color) {
  const label = Number.isFinite(aqi) ? Math.round(aqi) : '–';
  return L.divIcon({
    className: '', // removes Leaflet's default white box
    html: `<div style="
      width:32px;height:32px;border-radius:50%;
      background:${color};border:1px solid #333;
      display:flex;align-items:center;justify-content:center;
      font:700 13px/1 sans-serif;color:${textColorFor(color)};
      box-shadow:0 1px 3px rgba(0,0,0,.4);">${label}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

export default function SensorMap() {
  const { rows, loading, error } = useAllSensors();
  const navigate = useNavigate();

  const located = rows.filter((r) => r.current && Number.isFinite(r.current.latitude) && Number.isFinite(r.current.longitude));
  const failed = rows.filter((r) => r.error);
  const points = located.map((r) => [r.current.latitude, r.current.longitude]);

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
              center={savedView ? savedView.center : [40.2, -76.8]}
              zoom={savedView ? savedView.zoom : 10}
              minZoom={2}
              maxZoom={22}
              maxBounds={WORLD_BOUNDS}
              maxBoundsViscosity={1.0}
              worldCopyJump={false}
              scrollWheelZoom
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                noWrap
                bounds={WORLD_BOUNDS}
                maxNativeZoom={19}
                maxZoom={22}
              />
              <ViewTracker />
              <FitBoundsOnce points={points} />
              {located.map(({ sensor, current }) => {
                const aqi = aqiFromPm25(current.pm25);
                const cat = categoryFor(aqi);
                return (
                  <Marker
                    key={sensor.id || sensor.sensorIndex}
                    position={[current.latitude, current.longitude]}
                    icon={aqiIcon(aqi, cat.color)}
                  >
                    <Popup>
                      <Box minW="180px">
                        <Text fontWeight="700">{sensor.name || current.name}</Text>
                        {sensor.location && <Text fontSize="sm">{sensor.location}</Text>}
                        <Text fontSize="sm" mt="6px">PM2.5: <strong>{fmt(current.pm25)} µg/m³</strong></Text>
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
                  </Marker>
                );
              })}
            </MapContainer>
          </Box>
        </Skeleton>
      </Panel>
    </Box>
  );
}
