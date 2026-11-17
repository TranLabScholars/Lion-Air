import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, AlertIcon, Box, Button, Flex, Select, SimpleGrid, Skeleton, Text, Tooltip, useColorMode, useToast,
} from '@chakra-ui/react';
// ...
import { saveTextFile } from 'utils/csv';
import { MdFileDownload, MdRefresh } from 'react-icons/md';
import Chart from 'react-apexcharts';
import useAllSensorData from 'hooks/useAllSensorData';
import { clearActiveSensor, getActiveSensorIndex } from 'api/sensorRegistry';
import { aqiFromPm25, categoryFor } from 'utils/aqi';
import { Panel, StatTile, AqiPill, PURPLE, fmt, timeAgo } from 'components/purpleair/ui';
import { fetchHistoryCsv } from 'api/purpleair';

const HOUR = 3600000;

const mean = (arr) => {
  const v = arr.filter(Number.isFinite);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

// Averages every sensor that has data into one "current" reading and one hourly history.
function consolidate(items) {
  const loaded = items.filter((i) => i.current);
  if (!loaded.length) return { current: null, history: [], count: 0 };

  const avg = (k) => mean(loaded.map((i) => i.current[k]));
  const current = {
    pm1: avg('pm1'),
    pm25: avg('pm25'),
    pm10: avg('pm10'),
    pm25_10min: avg('pm25_10min'),
    pm25_60min: avg('pm25_60min'),
    pm25_24h: avg('pm25_24h'),
    tempF: avg('tempF'),
    humidity: avg('humidity'),
    pressure: avg('pressure'),
    lastSeen: Math.max(...loaded.map((i) => i.current.lastSeen || 0)),
  };

  const buckets = new Map();
  items.forEach((i) => i.history.forEach((h) => {
    const hour = Math.floor(h.t / HOUR) * HOUR;
    const e = buckets.get(hour) || { sum: 0, n: 0 };
    e.sum += h.pm25;
    e.n += 1;
    buckets.set(hour, e);
  }));
  const history = [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([t, { sum, n }]) => ({ t, pm25: Number((sum / n).toFixed(1)) }));

  return { current, history, count: loaded.length };
}

// Picks y-axis bounds and clean tick steps from the data range.
function niceAxis(values) {
  if (!values.length) return { min: 0, max: 10, tickAmount: 5, decimals: 0 };
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const span0 = hi - lo;
  const pad = span0 === 0 ? Math.max(1, hi * 0.1) : span0 * 0.15;
  lo = Math.max(0, lo - pad);
  hi += pad;

  const raw = (hi - lo) / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;

  const min = Number((Math.floor(lo / step) * step).toFixed(4));
  const max = Number((Math.ceil(hi / step) * step).toFixed(4));
  return {
    min,
    max,
    tickAmount: Math.max(1, Math.round((max - min) / step)),
    decimals: step < 0.1 ? 2 : step < 1 ? 1 : 0,
  };
}

const sensorLabel = (i) => i.sensor.name || i.current?.name || `Sensor ${i.sensor.sensorIndex}`;

export default function AirQualityDashboard() {
  const { items, loading, error, refresh, refreshing, isMock } = useAllSensorData();
  const { colorMode } = useColorMode();

  // Opens on "All sensors", unless the user arrived via "Show on dashboard" or just registered one.
  const [selected, setSelected] = useState(() => {
    const idx = getActiveSensorIndex();
    return idx ? String(idx) : 'all';
  });
  useEffect(() => { clearActiveSensor(); }, []);

  const picked = selected === 'all'
    ? null
    : items.find((i) => String(i.sensor.sensorIndex) === selected) || null;
  const selectValue = picked ? selected : 'all';

  const view = useMemo(
    () => (picked
      ? { current: picked.current, history: picked.history }
      : consolidate(items)),
    [picked, items],
  );
  const { current, history } = view;
  const reporting = items.filter((i) => i.current).length;

  const aqi = aqiFromPm25(current?.pm25);
  const cat = categoryFor(aqi);

  const subtitle = picked
    ? (current
      ? `${sensorLabel(picked)}${picked.sensor.location ? ` · ${picked.sensor.location}` : ''} · sensor ${current.index} · updated ${timeAgo(current.lastSeen)}`
      : '')
    : (items.length ? `All sensors · ${reporting} of ${items.length} reporting` : '');

  const axis = useMemo(() => niceAxis(history.map((h) => h.pm25)), [history]);

  // Put these outside the component
  const AQI_LEVELS = [
    { max: 50,  color: '#00e400', light: '#e8fbe8', dark: '#12301a' }, // Good
    { max: 100, color: '#e6c800', light: '#fffbe0', dark: '#3a3512' }, // Moderate
    { max: 150, color: '#ff7e00', light: '#fff0e0', dark: '#3d2a12' }, // Unhealthy for sensitive groups
    { max: 200, color: '#ff0000', light: '#ffe5e5', dark: '#3d1717' }, // Unhealthy
    { max: 300, color: '#8f3f97', light: '#f3e6f5', dark: '#2f1a33' }, // Very unhealthy
    { max: Infinity, color: '#7e0023', light: '#f5dfe4', dark: '#33121a' }, // Hazardous
  ];

  const getAqiLevel = (aqi) =>
    AQI_LEVELS.find((l) => aqi <= l.max) ?? AQI_LEVELS[AQI_LEVELS.length - 1];

// Optional: only needed if you don't already have an AQI number (US EPA PM2.5 breakpoints)
  const pm25ToAqi = (c) => {
    const bp = [
      [0, 9.0, 0, 50], [9.1, 35.4, 51, 100], [35.5, 55.4, 101, 150],
      [55.5, 125.4, 151, 200], [125.5, 225.4, 201, 300], [225.5, 500.4, 301, 500],
    ];
    const [cl, ch, il, ih] = bp.find(([lo, hi]) => c <= hi) ?? bp[bp.length - 1];
    return Math.round(((ih - il) / (ch - cl)) * (c - cl) + il);
  };

  const currentAqi = aqi ?? pm25ToAqi(history[history.length - 1]?.pm25 ?? 0);

  const chart = useMemo(() => {
    const level = getAqiLevel(currentAqi);
    const plotBg = colorMode === 'dark' ? level.dark : level.light;

    return {
      series: [{ name: picked ? 'PM2.5 (µg/m³)' : 'Average PM2.5 (µg/m³)', data: history.map((h) => [h.t, h.pm25]) }],
      options: {
        chart: {
          type: 'area',
          toolbar: { show: false },
          background: 'transparent',   // axes stay neutral
          zoom: { enabled: false },
          animations: { enabled: false },
        },
        stroke: { curve: 'straight', width: 2 },
        markers: { size: 0 },
        theme: { mode: colorMode },
        colors: [level.color],
        fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0.02 } },
        dataLabels: { enabled: false },
        xaxis: { type: 'datetime', labels: { datetimeUTC: false } },
        yaxis: {
          min: axis.min,
          max: axis.max,
          tickAmount: axis.tickAmount,
          labels: { formatter: (v) => v.toFixed(axis.decimals) },
        },
        tooltip: { x: { format: 'MMM d, h:mm tt' } },
        grid: {
          borderColor: colorMode === 'dark' ? '#2b3674' : '#e9edf7',
          row: { colors: [plotBg], opacity: 1 },  // <- AQI tint, plot area only, behind the line
        },
      },
    };
  }, [history, colorMode, axis, picked, currentAqi]);  const toast = useToast();
  const [downloading, setDownloading] = useState(false);

  // The CSV endpoint takes one sensor index, so this works on a single selected sensor.
  const handleDownload = async () => {
    if (!picked) return;
    const { sensor } = picked;
    setDownloading(true);
    try {
      const csv = await fetchHistoryCsv(sensor.sensorIndex, sensor.readKey);
      const day = new Date().toISOString().slice(0, 10);
      saveTextFile(`purpleair-${sensor.sensorIndex}-${day}.csv`, csv);
    } catch (e) {
      toast({
        title: 'Download failed',
        description: e.message,
        status: 'error',
        duration: 6000,
        isClosable: true,
      });
    } finally {
      setDownloading(false);
    }
  };

  // Errors only appear once loading has finished and there is genuinely nothing to show.
  const showListError = !loading && !!error;
  const showEmpty = !loading && !error && items.length === 0;
  const showNoData = !loading && !error && items.length > 0 && !current;

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      <Flex justify="space-between" align="center" wrap="wrap" gap="12px" mb="20px">
        <Skeleton isLoaded={!loading} minW="260px" minH="20px">
          <Text color="secondaryGray.600">{subtitle}</Text>
        </Skeleton>
        <Flex gap="12px" wrap="wrap" align="center">
          <Skeleton isLoaded={!loading} borderRadius="12px">
            <Select
              value={selectValue}
              onChange={(e) => setSelected(e.target.value)}
              w={{ base: '100%', md: '260px' }}
              aria-label="Choose sensor"
            >
              <option value="all">All sensors</option>
              {items.map((i) => (
                <option key={i.sensor.id || i.sensor.sensorIndex} value={String(i.sensor.sensorIndex)}>
                  {sensorLabel(i)}{i.sensor.location ? ` · ${i.sensor.location}` : ''}
                </option>
              ))}
            </Select>
          </Skeleton>
          <Button leftIcon={<MdRefresh />} onClick={refresh} isLoading={refreshing} colorScheme="purple" variant="outline">
            Refresh
          </Button>
          <Tooltip
            label="Select a single sensor to download its data"
            isDisabled={!!picked}
            hasArrow
            shouldWrapChildren
          >
            <Button
              leftIcon={<MdFileDownload />}
              onClick={handleDownload}
              isLoading={downloading}
              isDisabled={loading || !picked}
              loadingText="Preparing"
              colorScheme="purple"
            >
              Download CSV
            </Button>
          </Tooltip>
        </Flex>
      </Flex>

      {isMock && (
        <Alert status="info" borderRadius="12px" mb="20px">
          <AlertIcon />
          Showing simulated readings. Add REACT_APP_PURPLEAIR_API_KEY to your .env file to load live data.
        </Alert>
      )}
      {showListError && (
        <Alert status="error" borderRadius="12px" mb="20px"><AlertIcon />{error}</Alert>
      )}
      {showEmpty && (
        <Alert status="info" borderRadius="12px" mb="20px">
          <AlertIcon />No sensors registered yet. Use "Add a sensor" in the sidebar.
        </Alert>
      )}
      {showNoData && (
        <Alert status="warning" borderRadius="12px" mb="20px">
          <AlertIcon />No readings are available for {picked ? 'this sensor' : 'any sensor'} right now.
        </Alert>
      )}

      <SimpleGrid columns={{ base: 1, xl: 3 }} gap="20px" mb="20px">
        <Skeleton isLoaded={!loading} borderRadius="16px" minH="170px">
          <Panel borderTop={`6px solid ${cat.color}`} h="100%">
            <Text color="secondaryGray.600" fontWeight="500">
              Air quality index (PM2.5){picked ? '' : ' · average'}
            </Text>
            <Flex align="baseline" gap="12px" mt="8px">
              <Text fontSize="6xl" fontWeight="800" lineHeight="1" color={cat.color}>{aqi ?? '–'}</Text>
              <Text fontSize="lg" fontWeight="600">{cat.label}</Text>
            </Flex>
            <Text mt="12px" fontSize="sm">{cat.advice}</Text>
          </Panel>
        </Skeleton>
        <Skeleton isLoaded={!loading} borderRadius="16px" minH="320px" gridColumn={{ xl: 'span 2' }}>
          <Panel h="100%">
            <Text fontWeight="700" mb="8px">
              PM2.5 over the last 24 hours{picked ? '' : ` · average of ${reporting} sensor${reporting === 1 ? '' : 's'}`}
            </Text>
            {history.length ? (
              <Chart key={selectValue} options={chart.options} series={chart.series} type="area" height={260} />
            ) : (
              <Text color="secondaryGray.600">No history returned yet.</Text>
            )}
          </Panel>
        </Skeleton>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 2, md: 3, xl: 6 }} gap="20px" mb="20px">
        {[
          ['PM2.5 now', fmt(current?.pm25), 'µg/m³'],
          ['PM1.0', fmt(current?.pm1), 'µg/m³'],
          ['PM10', fmt(current?.pm10), 'µg/m³'],
          ['Temperature', fmt(current?.tempF, 0), '°F'],
          ['Humidity', fmt(current?.humidity, 0), '%'],
          ['Pressure', fmt(current?.pressure, 0), 'hPa'],
        ].map(([label, value, unit]) => (
          <Skeleton key={label} isLoaded={!loading} borderRadius="16px" minH="96px">
            <StatTile label={label} value={value} unit={unit} />
          </Skeleton>
        ))}
      </SimpleGrid>

      <Skeleton isLoaded={!loading} borderRadius="16px" minH="110px" mb="20px">
        <Panel>
          <Text fontWeight="700" mb="12px">PM2.5 averages</Text>
          <SimpleGrid columns={{ base: 1, md: 3 }} gap="16px">
            {[['10 minutes', current?.pm25_10min], ['1 hour', current?.pm25_60min], ['24 hours', current?.pm25_24h]].map(([label, v]) => {
              const a = aqiFromPm25(v);
              return (
                <Flex key={label} justify="space-between" align="center">
                  <Box>
                    <Text color="secondaryGray.600" fontSize="sm">{label}</Text>
                    <Text fontSize="xl" fontWeight="700">
                      {fmt(v)} <Text as="span" fontSize="sm" fontWeight="400">µg/m³</Text>
                    </Text>
                  </Box>
                  <AqiPill aqi={a} category={categoryFor(a)} />
                </Flex>
              );
            })}
          </SimpleGrid>
        </Panel>
      </Skeleton>

      {!picked && (
        <Skeleton isLoaded={!loading} borderRadius="16px" minH={loading ? '140px' : undefined}>
          {items.length > 0 && (
            <Panel>
              <Text fontWeight="700" mb="12px">Sensors</Text>
              {items.map((i) => {
                const a = aqiFromPm25(i.current?.pm25);
                return (
                  <Flex
                    key={i.sensor.id || i.sensor.sensorIndex}
                    justify="space-between"
                    align="center"
                    py="10px"
                    borderTop="1px solid"
                    borderColor="secondaryGray.300"
                    cursor="pointer"
                    onClick={() => setSelected(String(i.sensor.sensorIndex))}
                  >
                    <Box>
                      <Text fontWeight="600">{sensorLabel(i)}</Text>
                      <Text fontSize="sm" color="secondaryGray.600">
                        {[i.sensor.location, i.current ? `updated ${timeAgo(i.current.lastSeen)}` : 'no reading yet'].filter(Boolean).join(' · ')}
                      </Text>
                    </Box>
                    <Flex align="center" gap="12px">
                      <Text fontWeight="700">{fmt(i.current?.pm25)} µg/m³</Text>
                      <AqiPill aqi={a} category={categoryFor(a)} />
                    </Flex>
                  </Flex>
                );
              })}
            </Panel>
          )}
        </Skeleton>
      )}
    </Box>
  );
}
