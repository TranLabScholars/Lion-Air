import React, { useEffect, useState } from 'react';
import { Alert, AlertIcon, Box, Button, Flex, SimpleGrid, Skeleton, Text } from '@chakra-ui/react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { MdAdd } from 'react-icons/md';
import useSensorData from 'hooks/useSensorData';
import { fetchSensors, setActiveSensor } from 'api/sensorRegistry';
import { aqiFromPm25, categoryFor } from 'utils/aqi';
import { Panel, AqiPill, fmt, timeAgo } from 'components/purpleair/ui';

function SensorCard({ sensor, onOpen }) {
  const { current, loading, error } = useSensorData(sensor.sensorIndex, sensor.readKey, { withHistory: false });
  const aqi = aqiFromPm25(current?.pm25);
  return (
    <Panel>
      <Text fontWeight="700" fontSize="lg">{sensor.name || current?.name || `Sensor ${sensor.sensorIndex}`}</Text>
      <Text fontSize="sm" color="secondaryGray.600">
        {[sensor.location, `index ${sensor.sensorIndex}`, sensor.environment, sensor.status].filter(Boolean).join(' · ')}
      </Text>
      <Skeleton isLoaded={!loading || !!current} mt="14px" minH="56px">
        {error ? (
          <Text color="red.500" fontSize="sm">{error}</Text>
        ) : (
          <Flex justify="space-between" align="center">
            <Box>
              <Text fontSize="2xl" fontWeight="800">
                {fmt(current?.pm25)} <Text as="span" fontSize="sm" fontWeight="400">µg/m³</Text>
              </Text>
              <Text fontSize="xs" color="secondaryGray.600">updated {timeAgo(current?.lastSeen)}</Text>
            </Box>
            <AqiPill aqi={aqi} category={categoryFor(aqi)} />
          </Flex>
        )}
      </Skeleton>
      <Button mt="14px" size="sm" colorScheme="purple" variant="outline" onClick={() => onOpen(sensor)}>
        Show on dashboard
      </Button>
    </Panel>
  );
}

export default function MySensors() {
  const [state, setState] = useState({ sensors: [], loading: true, error: null });
  const navigate = useNavigate();

  useEffect(() => {
    fetchSensors()
      .then((sensors) => setState({ sensors, loading: false, error: null }))
      .catch((e) => setState({ sensors: [], loading: false, error: e.message }));
  }, []);

  const open = (s) => { setActiveSensor(s.sensorIndex); navigate('/admin/default'); };

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      <Flex justify="space-between" align="center" mb="20px" wrap="wrap" gap="12px">
        <Button as={RouterLink} to="/admin/sensor-registration" leftIcon={<MdAdd />} colorScheme="purple">
          Add a sensor
        </Button>
      </Flex>
      {state.error && (
        <Alert status="error" borderRadius="12px" mb="20px"><AlertIcon />{state.error}</Alert>
      )}
      {!state.loading && !state.error && !state.sensors.length && (
        <Text color="secondaryGray.600">No sensors registered yet.</Text>
      )}
      <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="20px">
        {state.sensors.map((s) => (
          <SensorCard key={s.id || s.sensorIndex} sensor={s} onOpen={open} />
        ))}
      </SimpleGrid>
    </Box>
  );
}
