package com.wilotus.timetracker.dto;

import lombok.Data;
import java.time.LocalDate;
import java.time.LocalTime;

@Data
public class AttendanceSummaryDto {
    private String employeeId;
    private String employeeName;
    private String dept;
    private LocalDate date;
    private LocalTime entryTime;
    private LocalTime exitTime;
    private long totalWorkMs;
    private long totalBreakMs;
    private long totalLunchMs;
    private String lateStatus;
    private String status;
    private boolean approved;
}
