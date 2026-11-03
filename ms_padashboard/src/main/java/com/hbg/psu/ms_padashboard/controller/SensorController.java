package com.hbg.psu.ms_padashboard.controller;

import com.hbg.psu.ms_padashboard.model.Sensor;
import com.hbg.psu.ms_padashboard.repository.SensorRepository;
import com.hbg.psu.ms_padashboard.service.SensorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping(value = "/api/v1/sensors")
public class SensorController {
    private final SensorService sensorService;

    // Add a sensor
    @PostMapping
    public ResponseEntity<Sensor> save(@RequestBody Sensor sensor) {
        return ResponseEntity.ok(sensorService.createSensor(sensor));
    }

    // Remove a sensor
    @PutMapping("/{id}")
    public ResponseEntity<Sensor> update(@PathVariable String id, @RequestBody Sensor sensor) {
        return ResponseEntity.ok(sensorService.removeSensor(id));
    }

    // Retrieve sensor list
    @GetMapping
    public ResponseEntity<List<Sensor>> findAll() {
        return ResponseEntity.ok(sensorService.findAll());
    }

    // Retrieve one sensor
    @GetMapping("/{id}")
    public ResponseEntity<Sensor> findSensorById(@PathVariable String id) {
        return ResponseEntity.ok(sensorService.findSensorById(id));
    }
}
