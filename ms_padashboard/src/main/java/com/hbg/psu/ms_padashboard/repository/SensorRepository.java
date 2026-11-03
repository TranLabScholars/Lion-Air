package com.hbg.psu.ms_padashboard.repository;

import com.hbg.psu.ms_padashboard.model.Sensor;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SensorRepository extends JpaRepository<Sensor,String> {
    public List<Sensor> findAllSensor();
    public Sensor save(Sensor sensor);
    public Sensor findSensorById(String id);
}
