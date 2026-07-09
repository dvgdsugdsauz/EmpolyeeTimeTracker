package com.wilotus.timetracker.dto;

import lombok.Data;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
public class TimesheetResponseDto {
    private Long id;
    private String employeeId;
    private String employeeName;
    private String managerId;
    private String managerName;
    private LocalDate workingDate;
    private int workingHours;
    private String modules;
    private String description;
    private String status;
    private String taskIds;
    private String rejectReason;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
