package com.wilotus.timetracker.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "devices")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Device {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String ipAddress;

    // ZKTeco serial number reported in ADMS requests (e.g. "CGXH201360163")
    @Column(unique = true)
    private String serialNumber;

    @Column(nullable = false)
    private int port = 4370;

    private String location;

    @Column(nullable = false)
    private int pollIntervalSeconds = 10;

    @Column(nullable = false)
    private boolean connected = false;

    @Column(nullable = false)
    private boolean active = true;

    private LocalDateTime lastSeen;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
