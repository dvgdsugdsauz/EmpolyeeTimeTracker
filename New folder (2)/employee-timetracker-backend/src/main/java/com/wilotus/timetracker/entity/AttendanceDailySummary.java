package com.wilotus.timetracker.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalTime;

@Entity
@Table(
    name = "wt_daily_summary",
    uniqueConstraints = @UniqueConstraint(columnNames = {"employee_id", "date"})
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AttendanceDailySummary {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String employeeId;

    @Column(nullable = false)
    private LocalDate date;

    private LocalTime entryTime;
    private LocalTime exitTime;

    @Column(nullable = false)
    private long totalWorkMs = 0;

    @Column(nullable = false)
    private long totalBreakMs = 0;

    @Column(nullable = false)
    private long totalLunchMs = 0;

    @Column(nullable = false)
    private String lateStatus = "NORMAL";

    @Column(nullable = false)
    private String status = "NOT_ARRIVED";

    @Column(nullable = false)
    private boolean approved = false;

    // Manager/Admin manual override — null means use computed status
    @Column
    private String overrideStatus;

    @Column(length = 500)
    private String overrideComment;
}
