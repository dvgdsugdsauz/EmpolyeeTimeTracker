package com.wilotus.timetracker.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "wt_employees")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Employee {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false, unique = true)
    private String username;

    @Column(nullable = false)
    private String password;

    @Column(nullable = false)
    private String role; // employee | manager | admin

    private String dept;
    private String designation;
    private String avatar;

    // ZKTeco enrollment number (e.g. "1", "2") — set this when enrolling in device
    @Column(name = "biometric_id", unique = true)
    private String biometricId;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "timesheet_access")
    private boolean timesheetAccess;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
