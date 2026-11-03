import React, { useMemo } from 'react';
import {
  Alert, AlertIcon, Box, Button, Flex, Heading, SimpleGrid, Skeleton, Text, useColorMode,
} from '@chakra-ui/react';
import { MdRefresh } from 'react-icons/md';
import Chart from 'react-apexcharts';
import useSensorData from 'hooks/useSensorData';
import { getActiveSensor } from 'api/sensorRegistry';
import { aqiFromPm25, categoryFor } from 'utils/aqi';
import { Panel, StatTile, AqiPill, PURPLE, fmt, timeAgo } from 'components/purpleair/ui';

export default function AirQualityDashboard() {
  const sensor = useMemo(() => getActiveSensor(), []);
  const { current, history, loading, error, refresh, isMock } = useSensorData(sensor.sensorIndex, sensor.readKey);
  const { colorMode } = useColorMode();

  const aqi = aqiFromPm25(current?.pm25);
  const cat = categoryFor(aqi);

  const chart = useMemo(() => ({
    series: [{ name: 'PM2.5 (µg/m³)', data: history.map((h) => [h.t, h.pm25]) }],
    options: {
      chart: { type: 'area', toolbar: { show: false }, background: 'transparent', zoom: { enabled: false }, animations: { enabled: false } },
      stroke: { curve: 'straight', width: 2 },
      markers: { size: 0 },
      theme: { mode: colorMode },
      colors: [PURPLE],
      fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0.02 } },
      dataLabels: { enabled: false },
      xaxis: { type: 'datetime', labels: { datetimeUTC: false } },
      yaxis: {
        min: 0,
        max: (max) => Math.max(max, 30),
        labels: { formatter: (v) => v.toFixed(0) },
      },
      tooltip: { x: { format: 'MMM d, h:mm tt' } },
      grid: { borderColor: colorMode === 'dark' ? '#2b3674' : '#e9edf7' },
    },
  }), [history, colorMode]);

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      <Flex justify="space-between" align="flex-start" wrap="wrap" gap="12px" mb="20px">
        {/*<Box>*/}
        {/*  <Heading size="lg">Purple Air Dashboard</Heading>*/}
        {/*  <Text color="secondaryGray.600" mt="4px">*/}
        {/*  <Text color="secondaryGray.600" mt="4px">*/}
        {/*    {current ? `${current.name} · sensor ${current.index} · updated ${timeAgo(current.lastSeen)}` : `Sensor ${sensor.sensorIndex}`}*/}
        {/*  </Text>*/}
        {/*</Box>*/}
        <Button leftIcon={<MdRefresh />} onClick={refresh} isLoading={loading} colorScheme="purple" variant="outline">
          Refresh
        </Button>
      </Flex>

      {isMock && (
        <Alert status="info" borderRadius="12px" mb="20px">
          <AlertIcon />
          Showing simulated readings. Add REACT_APP_PURPLEAIR_API_KEY to your .env file to load live data.
        </Alert>
      )}
      {error && (
        <Alert status="error" borderRadius="12px" mb="20px">
          <AlertIcon />
          {error}
        </Alert>
      )}

      <SimpleGrid columns={{ base: 1, xl: 3 }} gap="20px" mb="20px">
        <Panel borderTop={`6px solid ${cat.color}`}>
          <Text color="secondaryGray.600" fontWeight="500">Air quality index (PM2.5)</Text>
          <Skeleton isLoaded={!loading || !!current}>
            <Flex align="baseline" gap="12px" mt="8px">
              <Text fontSize="6xl" fontWeight="800" lineHeight="1" color={cat.color}>{aqi ?? '–'}</Text>
              <Text fontSize="lg" fontWeight="600">{cat.label}</Text>
            </Flex>
            <Text mt="12px" fontSize="sm">{cat.advice}</Text>
          </Skeleton>
        </Panel>
        <Panel gridColumn={{ xl: 'span 2' }}>
          <Text fontWeight="700" mb="8px">PM2.5 over the last 24 hours</Text>
          <Skeleton isLoaded={!loading || history.length > 0} minH="260px">
            {history.length ? (
              <Chart options={chart.options} series={chart.series} type="area" height={260} />
            ) : (
              <Text color="secondaryGray.600">No history returned for this sensor.</Text>
            )}
          </Skeleton>
        </Panel>
      </SimpleGrid>

      <SimpleGrid columns={{ base: 2, md: 3, xl: 6 }} gap="20px" mb="20px">
        <StatTile label="PM2.5 now" value={fmt(current?.pm25)} unit="µg/m³" />
        <StatTile label="PM1.0" value={fmt(current?.pm1)} unit="µg/m³" />
        <StatTile label="PM10" value={fmt(current?.pm10)} unit="µg/m³" />
        <StatTile label="Temperature" value={fmt(current?.tempF, 0)} unit="°F" />
        <StatTile label="Humidity" value={fmt(current?.humidity, 0)} unit="%" />
        <StatTile label="Pressure" value={fmt(current?.pressure, 0)} unit="hPa" />
      </SimpleGrid>

      <Panel>
        <Text fontWeight="700" mb="12px">PM2.5 averages</Text>
        <SimpleGrid columns={{ base: 1, md: 3 }} gap="16px">
          {[['10 minutes', current?.pm25_10min], ['1 hour', current?.pm25_60min], ['24 hours', current?.pm25_24h]].map(([label, v]) => {
            const a = aqiFromPm25(v);
            return (
              <Flex key={label} justify="space-between" align="center">
                <Box>
                  <Text color="secondaryGray.600" fontSize="sm">{label}</Text>
                  <Text fontSize="xl" fontWeight="700">{fmt(v)} <Text as="span" fontSize="sm" fontWeight="400">µg/m³</Text></Text>
                </Box>
                <AqiPill aqi={a} category={categoryFor(a)} />
              </Flex>
            );
          })}
        </SimpleGrid>
      </Panel>
    </Box>
  );
}
