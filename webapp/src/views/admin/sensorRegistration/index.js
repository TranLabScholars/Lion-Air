import React, { useState } from 'react';
import {
  Alert, AlertIcon, Box, Button, FormControl, FormErrorMessage, FormHelperText, FormLabel,
  Heading, Input, Select, SimpleGrid, Text, Textarea, useToast,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { fetchSensor } from 'api/purpleair';
import { registerSensor } from 'api/sensorRegistry';
import { BACKEND_URL, USE_MOCK } from 'config/purpleair';
import { Panel } from 'components/purpleair/ui';

const EMPTY = { name: '', sensorIndex: '', location: '', environment: 'Outdoor', readKey: '', notes: '' };

export default function SensorRegistration() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Give the sensor a name.';
    if (!/^\d+$/.test(form.sensorIndex.trim())) e.sensorIndex = 'Enter the numeric sensor index from the PurpleAir map.';
    if (!form.location.trim()) e.location = 'Add a location, for example a city or address.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;

    setSubmitting(true);

    try {
      // 1. Verify that PurpleAir knows this sensor.
      await fetchSensor(form.sensorIndex.trim(), form.readKey.trim());

      // 2. Send sensor information to Spring Boot.
      const response = await fetch('http://localhost:8080/api/v1/sensors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sensorName: form.name.trim(),
          location: form.location.trim(),
          sensorIndex: form.sensorIndex.trim(),
          // readKey: form.readKey.trim(),
        }),
      });

      if (!response.ok) {
        const errorMessage = await response.text();
        throw new Error(errorMessage || 'Failed to save sensor to backend.');
      }

      // 3. Notify user of success.
      toast({
        title: 'Sensor added',
        description: `${form.name} has been successfully registered!`,
        status: 'success',
        duration: 4000,
      });

      navigate('/admin/my-sensors');

    } catch (err) {
      setErrors({ sensorIndex: err.message });

      toast({
        title: 'Could not add sensor',
        description: err.message,
        status: 'error',
        duration: 5000,
      });

    } finally {
      setSubmitting(false);
    }
  };
  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      <Text color="secondaryGray.600" mb="20px">
        Register a PurpleAir sensor to track it on your dashboard.
      </Text>
      {USE_MOCK && (
        <Alert status="info" borderRadius="12px" mb="20px">
          <AlertIcon />
          No API key set, so the sensor can't be verified against PurpleAir. It will still be saved.
        </Alert>
      )}
      <Panel maxW="720px">
        <form onSubmit={submit} noValidate>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="18px">
            <FormControl isInvalid={!!errors.name} isRequired>
              <FormLabel>Sensor name</FormLabel>
              <Input value={form.name} onChange={set('name')} placeholder="Backyard sensor" />
              <FormErrorMessage>{errors.name}</FormErrorMessage>
            </FormControl>
            <FormControl isInvalid={!!errors.sensorIndex} isRequired>
              <FormLabel>Sensor index</FormLabel>
              <Input value={form.sensorIndex} onChange={set('sensorIndex')} inputMode="numeric" placeholder="131075" />
              {errors.sensorIndex
                ? <FormErrorMessage>{errors.sensorIndex}</FormErrorMessage>
                : <FormHelperText>Found in the sensor's URL on map.purpleair.com.</FormHelperText>}
            </FormControl>
            <FormControl isInvalid={!!errors.location} isRequired>
              <FormLabel>Location</FormLabel>
              <Input value={form.location} onChange={set('location')} placeholder="Steelton, PA" />
              <FormErrorMessage>{errors.location}</FormErrorMessage>
            </FormControl>
            <FormControl>
              <FormLabel>Placement</FormLabel>
              <Select value={form.environment} onChange={set('environment')}>
                <option>Outdoor</option>
                <option>Indoor</option>
              </Select>
            </FormControl>
            <FormControl gridColumn={{ md: 'span 2' }}>
              <FormLabel>Read key (private sensors only)</FormLabel>
              <Input value={form.readKey} onChange={set('readKey')} placeholder="Leave empty for public sensors" autoComplete="off" />
            </FormControl>
            <FormControl gridColumn={{ md: 'span 2' }}>
              <FormLabel>Notes</FormLabel>
              <Textarea value={form.notes} onChange={set('notes')} rows={3} />
            </FormControl>
          </SimpleGrid>
          <Button type="submit" colorScheme="purple" mt="24px" isLoading={submitting} loadingText="Checking sensor">
            Add sensor
          </Button>
        </form>
      </Panel>
    </Box>
  );
}
