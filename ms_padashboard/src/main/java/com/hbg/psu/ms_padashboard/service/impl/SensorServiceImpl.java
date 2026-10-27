package com.hbg.psu.ms_padashboard.service.impl;

import com.hbg.psu.ms_padashboard.model.Sensor;
import com.hbg.psu.ms_padashboard.repository.SensorRepository;
import com.hbg.psu.ms_padashboard.service.SensorService;
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
        Optional<Sensor> existingSensor= Optional.ofNullable(sensorRepository.findSensorById(sensorInfo.getId()));

        //Map sensor to request

        if(existingSensor.isPresent()){
            return existingSensor.get();
        } else {
        Sensor saved = sensorRepository.save(sensorInfo);
        return saved;
        }

    }

    // Remove a sensor
    @Override
    public Sensor removeSensor(String id){
        //Check if sensor exists
        Optional<Sensor> existingSensor= Optional.ofNullable(sensorRepository.findSensorById(id));

        if(existingSensor.isPresent()){
            Sensor sensor = existingSensor.get();
            sensor.setStatus("REMOVED");
            sensorRepository.save(sensor);
        }
        return sensorRepository.findSensorById(id);
    }

    // Retrieve sensor list
    @Override
    public List<Sensor> findAll() {
        return sensorRepository.findAllSensor();
    }

    // Retrieve one sensor
    @Override
    public Sensor findSensorById(String id) {
        return sensorRepository.findSensorById(id);
    }

}
