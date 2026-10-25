package com.hbg.psu.ms_padashboard.model;

import jakarta.persistence.Column;
import jakarta.persistence.Id;
import lombok.Data;

import java.time.Instant;

@Data
public class Sensor {
    @Id
    String sensorId;

    @Column(name="sensorName", nullable = false)
    private String sensorName;

    @Column(name="sensorType", nullable = false)
    private String sensorType;

    @Column(name="location", nullable = false)
    private String location;

    @Column(name="purchaseEmail", nullable = false)
    private String purchaseEmail;

    @Column(name="createdAt", nullable = false)
    private Instant createdAt;

    @Column(name="updatedAt", nullable = false)
    private Instant updatedAt;

    @Column(name="status", nullable = false)
    private String status;
}
