import React, { useState } from 'react';
import { Box, Button, Flex, Heading, SimpleGrid, Text, Skeleton, useToast } from '@chakra-ui/react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { MdAdd, MdDelete } from 'react-icons/md';
import useSensorData from 'hooks/useSensorData';
import { getSensors, removeSensor, setActiveSensor } from 'api/sensorRegistry';
import { SENSOR_INDEX, SENSOR_READ_KEY } from 'config/purpleair';
import { aqiFromPm25, categoryFor } from 'utils/aqi';
import { Panel, AqiPill, fmt, timeAgo } from 'components/purpleair/ui';

function SensorCard({ sensor, onRemove, onOpen, isDefault }) {
  const { current, loading, error } = useSensorData(sensor.sensorIndex, sensor.readKey, { withHistory: false });
  const aqi = aqiFromPm25(current?.pm25);
  return (
    <Panel>
      <Flex justify="space-between" align="flex-start" gap="8px">
        <Box>
          <Text fontWeight="700" fontSize="lg">{sensor.name || current?.name || `Sensor ${sensor.sensorIndex}`}</Text>
          <Text fontSize="sm" color="secondaryGray.600">
            {[sensor.location, `index ${sensor.sensorIndex}`, sensor.environment].filter(Boolean).join(' · ')}
          </Text>
        </Box>
        {!isDefault && (
          <Button size="sm" variant="ghost" aria-label={`Remove ${sensor.name}`} onClick={() => onRemove(sensor)}>
            <MdDelete />
          </Button>
        )}
      </Flex>
      <Skeleton isLoaded={!loading || !!current} mt="14px" minH="56px">
        {error ? (
          <Text color="red.500" fontSize="sm">{error}</Text>
        ) : (
          <Flex justify="space-between" align="center">
            <Box>
              <Text fontSize="2xl" fontWeight="800">{fmt(current?.pm25)} <Text as="span" fontSize="sm" fontWeight="400">µg/m³</Text></Text>
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
  const [sensors, setSensors] = useState(getSensors());
  const navigate = useNavigate();
  const toast = useToast();

  const all = sensors.length
    ? sensors
    : [{ sensorIndex: SENSOR_INDEX, readKey: SENSOR_READ_KEY, name: 'Default sensor', isDefault: true }];

  const open = (s) => { setActiveSensor(s.sensorIndex); navigate('/admin/default'); };
  const remove = (s) => {
    removeSensor(s.sensorIndex);
    setSensors(getSensors());
    toast({ title: 'Sensor removed', description: s.name, status: 'info', duration: 3000 });
  };

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      <Flex justify="space-between" align="center" mb="20px" wrap="wrap" gap="12px">
        <Heading size="lg">My sensors</Heading>
        <Button as={RouterLink} to="/admin/sensor-registration" leftIcon={<MdAdd />} colorScheme="purple">
          Add a sensor
        </Button>
      </Flex>
      <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} gap="20px">
        {all.map((s) => (
          <SensorCard key={s.sensorIndex} sensor={s} isDefault={!!s.isDefault} onRemove={remove} onOpen={open} />
        ))}
      </SimpleGrid>
      {!sensors.length}
    </Box>
  );
}
