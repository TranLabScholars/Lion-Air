package com.hbg.psu.ms_padashboard.service;

import com.hbg.psu.ms_padashboard.model.Sensor;

import java.util.List;
import java.util.Optional;

public interface SensorService {
    List<Sensor> findAll();
    Optional<Sensor> findSensorById(String id);
    Sensor createSensor(Sensor sensor);
    Optional<Sensor> removeSensor(String id);
}
