package com.hbg.psu.ms_padashboard.controller;

import com.hbg.psu.ms_padashboard.model.Sensor;
import com.hbg.psu.ms_padashboard.service.SensorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequiredArgsConstructor
@RequestMapping(value = "/api/v1/sensors")
@CrossOrigin(origins = {
    "http://localhost:5173",
    "http://localhost:3000"
})
public class SensorController {
    private final SensorService sensorService;

    /**
     * Add a sensor to the database given the sensor index, location and type
     * @param sensor
     * @return sensor info
     */
    @PostMapping
    public ResponseEntity<Sensor> save(@RequestBody Sensor sensor) {
        return ResponseEntity.ok(sensorService.createSensor(sensor));
    }

    /**
     * Remove a sensor
     * @param sensorIndex
     * @return Sensor information
     */
    @PutMapping("/{sensorIndex}")
    public ResponseEntity<Optional<Sensor>> update(@PathVariable String sensorIndex) {
        return ResponseEntity.ok(sensorService.removeSensor(sensorIndex));
    }

    /**
     * Retrieve sensor list
     * @return list of sensors
     */
    @GetMapping
    public ResponseEntity<List<Sensor>> findAll() {
        return ResponseEntity.ok(sensorService.findAll());
    }

    /**
     * Retrieve one sensor
     * @param id
     * @return sensor information
     */
    @GetMapping("/{id}")
    public ResponseEntity<Optional<Sensor>> findSensorById(@PathVariable String id) {
        return ResponseEntity.ok(sensorService.findSensorById(id));
    }
}
