package com.wilotus.timetracker.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "wt_live_status")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class EmployeeLiveStatus {

    @Id
    private String employeeId;

    @Column(nullable = false)
    private String status = "NOT_ARRIVED"; // WORKING|BREAK|LUNCH|MISS_PUNCH|OFFLINE|NOT_ARRIVED

    private LocalDateTime entryTime;
    private LocalDateTime lastPunchIn;
    private LocalDateTime lastPunchOut;

    @Column(nullable = false)
    private long totalWorkMs = 0;

    @Column(nullable = false)
    private long totalBreakMs = 0;

    @Column(nullable = false)
    private long totalLunchMs = 0;

    @Column(nullable = false)
    private String lateStatus = "NORMAL"; // NORMAL | LATE | VERY_LATE

    @Column(nullable = false)
    private boolean missPunchNotified = false;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
