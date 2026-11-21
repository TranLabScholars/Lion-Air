import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, AlertIcon, Box, Button, Flex, Icon, Select, SimpleGrid, Skeleton, Text, Tooltip, useColorMode, useToast,
} from '@chakra-ui/react';
// ...
import { saveTextFile } from 'utils/csv';
import { MdFileDownload, MdInfoOutline, MdRefresh } from 'react-icons/md';
import Chart from 'react-apexcharts';
import useAllSensorData from 'hooks/useAllSensorData';
import useSensorRange from 'hooks/useSensorRange';
import { clearActiveSensor, getActiveSensorIndex } from 'api/sensorRegistry';
import { aqiFromPm25, categoryFor } from 'utils/aqi';
import { Panel, StatTile, AqiPill, fmt, timeAgo } from 'components/purpleair/ui';
import { fetchHistoryCsv } from 'api/purpleair';

const HOUR = 3600000;
const DAY = 24 * HOUR;
const SELECTED_KEY = 'airQuality.selectedSensor';

const RANGES = [
  { value: '24h', label: 'Last 24 hours', title: '24 hours' },
  { value: '7d', label: 'Last week', title: 'week' },
  { value: '30d', label: 'Last month', title: 'month' },
];

// Each metric is explained exactly once; the UI reuses these via <Info />.
const METRIC_INFO = {
  aqi: 'US EPA Air Quality Index, calculated from PM2.5. The colour and advice follow the category: Good (0–50) up to Hazardous (301+).',
  pm25: 'Particles up to 2.5 µm across. They reach deep into the lungs and are what the AQI is based on.',
  pm1: 'Ultra-fine particles up to 1 µm, mostly from combustion and smoke.',
  pm10: 'Coarser particles up to 10 µm, such as dust, pollen and mould.',
  temp: 'Measured inside the sensor housing, so it usually reads a few degrees warmer than outdoors.',
  humidity: 'Relative humidity at the sensor. High humidity can make particle readings run slightly high.',
  pressure: 'Atmospheric pressure at the sensor. Falling pressure often signals changing weather.',
  averages: 'Rolling PM2.5 averages over each window. The pill shows the AQI category each average would give.',
};

// US EPA AQI categories. The graph plots AQI, and its background is split into these bands.
const AQI_BANDS = [
  { from: 0, to: 50, color: '#00e400' }, // Good
  { from: 50, to: 100, color: '#e6c800' }, // Moderate
  { from: 100, to: 150, color: '#ff7e00' }, // Unhealthy for sensitive groups
  { from: 150, to: 200, color: '#ff0000' }, // Unhealthy
  { from: 200, to: 300, color: '#8f3f97' }, // Very unhealthy
  { from: 300, to: 500, color: '#7e0023' }, // Hazardous
];
const LINE_COLOR = '#7551ff';

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
    pm25_1week: avg('pm25_1week'),
    pm25_1month: avg('pm25_1month'),
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

// Picks y-axis bounds and an evenly spaced, detailed tick scale (steps divide the AQI band edges).
const AXIS_STEPS = [1, 2, 5, 10, 20, 25, 50, 100];
function niceAxis(values, target = 8) {
  if (!values.length) return { min: 0, max: 10, tickAmount: 5, decimals: 0 };
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const span0 = hi - lo;
  const pad = span0 === 0 ? Math.max(1, hi * 0.1) : span0 * 0.15;
  lo = Math.max(0, lo - pad);
  hi += pad;

  const step = AXIS_STEPS.find((c) => (hi - lo) / c <= target) ?? AXIS_STEPS[AXIS_STEPS.length - 1];
  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  return { min, max, tickAmount: Math.max(1, Math.round((max - min) / step)), decimals: 0 };
}

const sensorLabel = (i) => i.sensor.name || i.current?.name || `Sensor ${i.sensor.sensorIndex}`;

function Info({ text }) {
  return (
    <Tooltip label={text} hasArrow placement="top" openDelay={150} maxW="260px">
      <Box as="span" display="inline-flex" ml="6px" verticalAlign="middle" cursor="help" tabIndex={0} aria-label={text}>
        <Icon as={MdInfoOutline} boxSize="14px" color="secondaryGray.600" />
      </Box>
    </Tooltip>
  );
}

function AqiChart({ history, name, range = '24h', height = 220 }) {
  const { colorMode } = useColorMode();
  const points = useMemo(
    () => history
      .map((h) => ({ t: h.t, pm25: h.pm25, aqi: aqiFromPm25(h.pm25) }))
      .filter((p) => Number.isFinite(p.aqi)),
    [history],
  );
  const axis = useMemo(() => niceAxis(points.map((p) => p.aqi), height >= 240 ? 10 : 7), [points, height]);

  // Evenly spaced numeric time axis: same spacing everywhere, no special midnight/date ticks.
  const xAxis = useMemo(() => {
    if (!points.length) return null;
    const min = points[0].t;
    let max = points[points.length - 1].t;
    if (max <= min) max = min + HOUR;
    const unit = range === '24h' ? HOUR : DAY;
    const units = Math.round((max - min) / unit);
    const ticks = [6, 8, 4, 5, 3, 7, 9, 10, 2].find((k) => units > 0 && units % k === 0) ?? 6;
    const step = (max - min) / ticks;
    const wholeHours = new Date(min).getMinutes() === 0 && step % HOUR === 0;
    const label = (v) => (range === '24h'
      ? new Date(v).toLocaleTimeString([], wholeHours ? { hour: 'numeric' } : { hour: 'numeric', minute: '2-digit' })
      : new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' }));
    return { min, max, ticks, label };
  }, [points, range]);

  const chart = useMemo(() => {
    if (!xAxis) return null;
    const dark = colorMode === 'dark';
    // Only the part of each band that falls inside the visible y-axis is drawn.
    const bands = AQI_BANDS
      .filter((b) => b.to > axis.min && b.from < axis.max)
      .map((b) => ({
        y: Math.max(b.from, axis.min),
        y2: Math.min(b.to, axis.max),
        fillColor: b.color,
        opacity: dark ? 0.2 : 0.16,
        borderColor: 'transparent',
        borderWidth: 0,
      }));

    return {
      series: [{ name, data: points.map((p) => [p.t, p.aqi]) }],
      options: {
        chart: {
          type: 'area',
          toolbar: { show: false },
          background: 'transparent',
          zoom: { enabled: false },
          animations: { enabled: false },
        },
        stroke: { curve: 'straight', width: 2 },
        markers: { size: 0 },
        theme: { mode: colorMode },
        colors: [LINE_COLOR],
        fill: { type: 'gradient', gradient: { opacityFrom: 0.25, opacityTo: 0.02 } },
        dataLabels: { enabled: false },
        xaxis: {
          type: 'numeric',
          min: xAxis.min,
          max: xAxis.max,
          tickAmount: xAxis.ticks,
          labels: { formatter: (v) => xAxis.label(v), rotate: 0, hideOverlappingLabels: false },
          tooltip: { enabled: false },
        },
        yaxis: {
          min: axis.min,
          max: axis.max,
          tickAmount: axis.tickAmount,
          labels: { formatter: (v) => v.toFixed(0) },
        },
        tooltip: {
          x: {
            formatter: (v) => new Date(v).toLocaleString([], {
              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
            }),
          },
          y: {
            formatter: (v, { dataPointIndex }) => {
              const pm = points[dataPointIndex]?.pm25;
              return `AQI ${Math.round(v)}${Number.isFinite(pm) ? ` · ${pm} µg/m³` : ''}`;
            },
          },
        },
        annotations: { yaxis: bands },
        grid: { borderColor: dark ? '#2b3674' : '#e9edf7' },
      },
    };
  }, [points, colorMode, axis, xAxis, name]);

  if (!points.length || !chart) {
    return <Text color="secondaryGray.600" minH={`${height}px`}>No history returned yet.</Text>;
  }
  return <Chart options={chart.options} series={chart.series} type="area" height={height} />;
}

function MetricList({ current, showInfo }) {
  const rows = [
    ['PM2.5', fmt(current?.pm25), 'µg/m³', 'pm25'],
    ['PM1.0', fmt(current?.pm1), 'µg/m³', 'pm1'],
    ['PM10', fmt(current?.pm10), 'µg/m³', 'pm10'],
    ['Temperature', fmt(current?.tempF, 0), '°F', 'temp'],
    ['Humidity', fmt(current?.humidity, 0), '%', 'humidity'],
    ['Pressure', fmt(current?.pressure, 0), 'hPa', 'pressure'],
  ];
  return rows.map(([label, value, unit, key]) => (
    <Flex key={label} justify="space-between" align="center" py="6px" borderTop="1px solid" borderColor="secondaryGray.300">
      <Text fontSize="sm" color="secondaryGray.600">
        {label}
        {showInfo && <Info text={METRIC_INFO[key]} />}
      </Text>
      <Text fontSize="sm" fontWeight="600">{value} {unit}</Text>
    </Flex>
  ));
}

// One cell of the overview grid. Info icons only render on the first (average) card
// so no explanation is repeated.
function SensorCard({ title, subtitle, current, history, onClick, showInfo }) {
  const aqi = aqiFromPm25(current?.pm25);
  const cat = categoryFor(aqi);
  return (
    <Box
      h="100%"
      cursor={onClick ? 'pointer' : 'default'}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(); } : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <Panel borderTop={`6px solid ${cat.color}`} h="100%">
        <Flex justify="space-between" align="center" gap="12px" mb="8px">
          <Box minW={0}>
            <Text fontWeight="700" noOfLines={1}>{title}</Text>
            <Text fontSize="sm" color="secondaryGray.600" noOfLines={1} minH="20px">{subtitle || ' '}</Text>
          </Box>
          <Flex align="baseline" gap="8px" flexShrink={0}>
            <Text fontSize="3xl" fontWeight="800" lineHeight="1" color={cat.color}>{aqi ?? '–'}</Text>
            <Text fontSize="sm" fontWeight="600">
              {cat.label}
              {showInfo && <Info text={METRIC_INFO.aqi} />}
            </Text>
          </Flex>
        </Flex>
        <AqiChart history={history} name="AQI" height={200} />
        <Box mt="8px">
          <MetricList current={current} showInfo={showInfo} />
        </Box>
      </Panel>
    </Box>
  );
}

export default function AirQualityDashboard() {
  const { items, loading, error, refresh, refreshing } = useAllSensorData();

  // Opens on the sensor you arrived on, otherwise the one you were last viewing (survives a page refresh).
  const [selected, setSelected] = useState(() => {
    const idx = getActiveSensorIndex();
    if (idx) return String(idx);
    try { return sessionStorage.getItem(SELECTED_KEY) || 'all'; } catch { return 'all'; }
  });
  const [range, setRange] = useState('24h');
  useEffect(() => { clearActiveSensor(); }, []);
  useEffect(() => {
    try { sessionStorage.setItem(SELECTED_KEY, selected); } catch { /* ignore */ }
  }, [selected]);
  // Leaving the dashboard (map, sensor list...) forgets the selection; a page refresh does not
  // run this cleanup, so refreshing keeps it.
  useEffect(() => () => {
    try { sessionStorage.removeItem(SELECTED_KEY); } catch { /* ignore */ }
  }, []);

  const picked = selected === 'all'
    ? null
    : items.find((i) => String(i.sensor.sensorIndex) === selected) || null;
  const selectValue = picked ? selected : 'all';
  useEffect(() => { setRange('24h'); }, [selectValue]);

  const overview = useMemo(() => consolidate(items), [items]);
  const current = picked ? picked.current : overview.current;
  const reporting = items.filter((i) => i.current).length;

  // One history request per picked sensor, cached, shared by week/month tiles and graph.
  const { data: rangeData, loading: rangeLoading, error: rangeError } = useSensorRange(picked?.sensor, !!picked);

  const aqi = aqiFromPm25(current?.pm25);
  const cat = categoryFor(aqi);

  const chartHistory = useMemo(() => {
    if (!picked) return [];
    if (range === '7d') return rangeData?.history7 || [];
    if (range === '30d') return rangeData?.history30 || [];
    return picked.history;
  }, [picked, range, rangeData]);
  const rangeTitle = RANGES.find((r) => r.value === range).title;
  const chartPending = range !== '24h' && rangeLoading;

  const headline = picked
    ? `${sensorLabel(picked)}${picked.sensor.location ? ` · ${picked.sensor.location}` : ''}`
    : (items.length ? `All sensors · ${reporting} of ${items.length} reporting` : 'All sensors');
  const updated = current
    ? `${picked ? `Sensor ${current.index} · ` : ''}Last updated ${timeAgo(current.lastSeen)}`
    : '';

  const toast = useToast();
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

  const weekAvg = rangeData?.avg7 ?? null;
  const monthAvg = rangeData?.avg30 ?? null;
  const averageWindows = [
    ['Last 10 minutes', current?.pm25_10min],
    ['Last hour', current?.pm25_60min],
    ['Last 24 hours', current?.pm25_24h],
    ['Last week', weekAvg],
    ['Last month', monthAvg],
  ];

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      {/* Static header: text on the left (fixed height), controls on the right (fixed widths). */}
      <Flex
        justify="space-between"
        align={{ base: 'stretch', md: 'flex-start' }}
        direction={{ base: 'column', md: 'row' }}
        gap="12px"
        mb="20px"
      >
        <Box minW={0} flex="1" minH="48px">
          <Skeleton isLoaded={!loading} minW="260px">
            <Text fontWeight="700" fontSize="lg" noOfLines={1}>{headline}</Text>
          </Skeleton>
          <Text color="secondaryGray.600" fontSize="sm" minH="20px" noOfLines={1}>{updated}</Text>
        </Box>
        <Flex gap="12px" flexShrink={0} wrap={{ base: 'wrap', md: 'nowrap' }} align="center">
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
          <Button
            leftIcon={<MdRefresh />}
            onClick={refresh}
            isLoading={refreshing}
            colorScheme="purple"
            variant="outline"
            minW="110px"
          >
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
              minW="170px"
            >
              Download CSV
            </Button>
          </Tooltip>
        </Flex>
      </Flex>

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

      {!picked && (
        <SimpleGrid columns={{ base: 1, lg: 2 }} gap="20px" mb="20px">
          {loading
            ? [0, 1, 2, 3].map((k) => <Skeleton key={k} borderRadius="16px" minH="470px" />)
            : items.length > 0 && (
            <>
              {/*<SensorCard*/}
              {/*title="Average"*/}
              {/*subtitle={`${reporting} of ${items.length} sensors reporting`}*/}
              {/*current={overview.current}*/}
              {/*history={overview.history}*/}
              {/*showInfo*/}
              {/*/>*/}
              {items.map((i) => (
                <SensorCard
                  key={i.sensor.id || i.sensor.sensorIndex}
                  title={sensorLabel(i)}
                  subtitle={[i.sensor.location, i.current ? `updated ${timeAgo(i.current.lastSeen)}` : 'no reading yet'].filter(Boolean).join(' · ')}
                  current={i.current}
                  history={i.history}
                  onClick={() => setSelected(String(i.sensor.sensorIndex))}
                />
              ))}
            </>
          )}
        </SimpleGrid>
      )}

      {picked && (
        <>
          <SimpleGrid columns={{ base: 1, xl: 3 }} gap="20px" mb="20px">
            <Skeleton isLoaded={!loading} borderRadius="16px" minH="170px">
              <Panel borderTop={`6px solid ${cat.color}`} h="100%">
                <Text color="secondaryGray.600" fontWeight="500">
                  Air quality index (PM2.5)
                  <Info text={METRIC_INFO.aqi} />
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
                <Flex justify="space-between" align="center" gap="12px" mb="8px">
                  <Text fontWeight="700">Air quality index over the last {rangeTitle}</Text>
                  <Select
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                    w="170px"
                    size="sm"
                    borderRadius="10px"
                    aria-label="Graph time range"
                  >
                    {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </Select>
                </Flex>
                {chartPending ? (
                  <Skeleton borderRadius="12px" h="260px" />
                ) : (
                  <>
                    <AqiChart key={`${selectValue}-${range}`} history={chartHistory} name="AQI" range={range} height={260} />
                    {range !== '24h' && rangeError && (
                      <Text fontSize="sm" color="red.500" mt="8px">{rangeError}</Text>
                    )}
                  </>
                )}
              </Panel>
            </Skeleton>
          </SimpleGrid>

          <SimpleGrid columns={{ base: 2, md: 3, xl: 6 }} gap="20px" mb="20px">
            {[
              ['PM2.5 now', fmt(current?.pm25), 'µg/m³', 'pm25'],
              ['PM1.0', fmt(current?.pm1), 'µg/m³', 'pm1'],
              ['PM10', fmt(current?.pm10), 'µg/m³', 'pm10'],
              ['Temperature', fmt(current?.tempF, 0), '°F', 'temp'],
              ['Humidity', fmt(current?.humidity, 0), '%', 'humidity'],
              ['Pressure', fmt(current?.pressure, 0), 'hPa', 'pressure'],
            ].map(([label, value, unit, key]) => (
              <Skeleton key={label} isLoaded={!loading} borderRadius="16px" minH="96px">
                <Box position="relative">
                  <StatTile label={label} value={value} unit={unit} />
                  <Box position="absolute" top="10px" right="12px"><Info text={METRIC_INFO[key]} /></Box>
                </Box>
              </Skeleton>
            ))}
          </SimpleGrid>

          <Skeleton isLoaded={!loading} borderRadius="16px" minH="110px" mb="20px">
            <Panel>
              <Text fontWeight="700" mb="12px">
                PM2.5 averages
                <Info text={METRIC_INFO.averages} />
              </Text>
              <SimpleGrid columns={{ base: 1, md: 5 }} gap="16px">
                {averageWindows.map(([label, v]) => {
                  const a = aqiFromPm25(v);
                  const waiting = rangeLoading && (label === 'Last week' || label === 'Last month');
                  return (
                    <Flex key={label} justify="space-between" align="center">
                      <Box>
                        <Text color="secondaryGray.600" fontSize="sm">{label}</Text>
                        <Text fontSize="xl" fontWeight="700">
                          {waiting ? '…' : fmt(v)} <Text as="span" fontSize="sm" fontWeight="400">µg/m³</Text>
                        </Text>
                      </Box>
                      <AqiPill aqi={a} category={categoryFor(a)} />
                    </Flex>
                  );
                })}
              </SimpleGrid>
            </Panel>
          </Skeleton>
        </>
      )}
    </Box>
  );
}
