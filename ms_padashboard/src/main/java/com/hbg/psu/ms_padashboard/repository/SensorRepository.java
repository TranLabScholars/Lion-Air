package com.hbg.psu.ms_padashboard.repository;

import com.hbg.psu.ms_padashboard.model.Sensor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SensorRepository extends JpaRepository<Sensor,Integer> {
    public List<Sensor> findAllSensor();
    public Sensor findSensorById(String id);
}
