import React, { useState } from 'react';
import {
  Box, Button, FormControl, FormErrorMessage, FormHelperText, FormLabel,
  Input, Select, SimpleGrid, Text, useToast,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { fetchSensor } from 'api/purpleair';
import { registerSensor } from 'api/sensorRegistry';
import { Panel } from 'components/purpleair/ui';

const EMPTY = { sensorName: '', sensorIndex: '', location: 'Penn State Harrisburg', sensorType: 'Indoor', readKey: '' };

export default function SensorRegistration() {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.sensorName.trim()) e.sensorName = 'Give the sensor a name.';
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

      // 2. Save it through the backend.
      await registerSensor({
        sensorName: form.sensorName.trim(),
        sensorIndex: form.sensorIndex.trim(),
        sensorType: form.sensorType,
        location: form.location.trim(),
        readKey: form.readKey.trim(),
      });

      toast({
        title: 'Sensor added',
        description: `${form.sensorName.trim()} has been successfully registered.`,
        status: 'success',
        duration: 4000,
      });
      navigate('/admin/sensors-list');
    } catch (err) {
      setErrors({ sensorIndex: err.message });
      toast({ title: 'Could not add sensor', description: err.message, status: 'error', duration: 5000 });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box pt={{ base: '130px', md: '80px', xl: '80px' }}>
      <Text color="secondaryGray.600" mb="20px">
        Add a PurpleAir sensor to track it on the dashboard.
      </Text>
      <Panel maxW="720px">
        <form onSubmit={submit} noValidate>
          <SimpleGrid columns={{ base: 1, md: 2 }} gap="18px">
            <FormControl isInvalid={!!errors.sensorName} isRequired>
              <FormLabel>Sensor name</FormLabel>
              <Input value={form.sensorName} onChange={set('sensorName')} placeholder="1st Floor sensor" />
              <FormErrorMessage>{errors.sensorName}</FormErrorMessage>
            </FormControl>
            <FormControl isInvalid={!!errors.sensorIndex} isRequired>
              <FormLabel>Sensor index</FormLabel>
              <Input value={form.sensorIndex} onChange={set('sensorIndex')} inputMode="numeric" placeholder="123456" />
              {errors.sensorIndex
                ? <FormErrorMessage>{errors.sensorIndex}</FormErrorMessage>
                : <FormHelperText>Found in the sensor's URL on map.purpleair.com.</FormHelperText>}
            </FormControl>
            <FormControl isInvalid={!!errors.location} isRequired>
              <FormLabel>Location</FormLabel>
              <Input value={form.location} onChange={set('location')} placeholder="Penn State Harrisburg" />
              <FormErrorMessage>{errors.location}</FormErrorMessage>
            </FormControl>
            <FormControl>
              <FormLabel>Sensor type</FormLabel>
              <Select value={form.sensorType} onChange={set('sensorType')}>
                <option>Indoor</option>
                <option>Outdoor</option>
              </Select>
            </FormControl>
            <FormControl gridColumn={{ md: 'span 2' }}>
              <FormLabel>Read key (private sensors only)</FormLabel>
              <Input value={form.readKey} onChange={set('readKey')} placeholder="Leave empty for public sensors" autoComplete="off" />
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
