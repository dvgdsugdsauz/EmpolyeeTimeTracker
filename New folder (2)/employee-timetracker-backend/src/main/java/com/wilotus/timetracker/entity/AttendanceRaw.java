package com.wilotus.timetracker.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "wt_att_raw",
    uniqueConstraints = @UniqueConstraint(columnNames = {"employee_id", "punch_time", "punch_state"})
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AttendanceRaw {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String employeeId;

    @Column(nullable = false)
    private LocalDateTime punchTime;

    @Column(nullable = false)
    private int punchState; // 0 = IN, 1 = OUT

    private String deviceId;

    @Column(nullable = false)
    private boolean processed = false;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
