
package com.hbg.psu.ms_padashboard.model;

import jakarta.persistence.*;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Entity
@Table(name = "Sensors")
public class Sensor {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private String id;

    @Column(name = "sensorName", nullable = false)
    private String sensorName;

    @Column(name = "sensorType", nullable = false)
    private String sensorType;

    @Column(name = "location", nullable = false)
    private String location;

    @Column(name = "purchaseEmail", nullable = false)
    private String purchaseEmail;

    @Column(name = "createdAt", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updatedAt", nullable = false)
    private Instant updatedAt;

    @Column(name = "status", nullable = false)
    private String status;

    @PrePersist
    protected void onCreate() {
        if (id == null) {
            id = UUID.randomUUID().toString();
        }

        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = Instant.now();
    }
}
