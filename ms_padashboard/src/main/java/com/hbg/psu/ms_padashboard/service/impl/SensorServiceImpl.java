package com.hbg.psu.ms_padashboard.service.impl;

import com.hbg.psu.ms_padashboard.model.Sensor;
import com.hbg.psu.ms_padashboard.repository.SensorRepository;
import com.hbg.psu.ms_padashboard.service.SensorService;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class SensorServiceImpl implements SensorService {
    private final SensorRepository sensorRepository;

    // Add a sensor
    @Override
    public Sensor createSensor(Sensor sensorInfo){
        //Check if a sensor with the same name doesn't exist already
        Optional<Sensor> existingSensor= sensorRepository.findById(sensorInfo.getSensorIndex());

        //Map sensor to request
        return existingSensor.orElseGet(() -> sensorRepository.save(sensorInfo));

    }

    // Remove a sensor
    @Override
    @Transactional
    public Optional<Sensor> removeSensor(String sensorIndex) {
        Optional<Sensor> existing = sensorRepository.findBySensorIndex(sensorIndex);
        existing.ifPresent(sensorRepository::delete);
        return existing; // the deleted sensor, or empty if it didn't exist
    }

    // Retrieve sensor list
    @Override
    public List<Sensor> findAll() {
        // Return all sensors with active status
        return sensorRepository.findAll();
    }

    // Retrieve one sensor
    @Override
    public Optional<Sensor> findSensorById(String id) {
        return sensorRepository.findById(id);
    }

}
