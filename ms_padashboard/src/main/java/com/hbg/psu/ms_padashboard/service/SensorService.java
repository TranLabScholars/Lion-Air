package com.hbg.psu.ms_padashboard.service;

import com.hbg.psu.ms_padashboard.model.Sensor;

import java.util.List;

public interface SensorService {
    List<Sensor> findAll();
    Sensor findSensorById(String id);
    Sensor createSensor(Sensor sensor);
    Sensor removeSensor(String id);
}
