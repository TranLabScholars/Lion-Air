import React, { useMemo } from 'react';
import { Alert, AlertIcon, Box, Heading, Skeleton, Text } from '@chakra-ui/react';
import useSensorData from 'hooks/useSensorData';
import { getActiveSensor } from 'api/sensorRegistry';
import { Panel } from 'components/purpleair/ui';

export default function SensorMap() {
  const sensor = useMemo(() => getActiveSensor(), []);
  const { current, loading, error } = useSensorData(sensor.sensorIndex, sensor.readKey, { withHistory: false });

  const src = current
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${current.longitude - 0.03}%2C${current.latitude - 0.018}%2C${current.longitude + 0.03}%2C${current.latitude + 0.018}&layer=mapnik&marker=${current.latitude}%2C${current.longitude}`
    : null;

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      <Heading size="lg" mb="4px">Map</Heading>
      <Text color="secondaryGray.600" mb="20px">
        {current ? `${current.name} · ${current.latitude.toFixed(4)}, ${current.longitude.toFixed(4)}` : 'Locating sensor…'}
      </Text>
      {error && (
        <Alert status="error" borderRadius="12px" mb="20px"><AlertIcon />{error}</Alert>
      )}
      <Panel p="8px">
        <Skeleton isLoaded={!loading || !!current} minH="520px" borderRadius="12px">
          {src && (
            <iframe
              title="Sensor location"
              src={src}
              style={{ width: '100%', height: '520px', border: 0, borderRadius: '12px' }}
            />
          )}
        </Skeleton>
      </Panel>
    </Box>
  );
}
