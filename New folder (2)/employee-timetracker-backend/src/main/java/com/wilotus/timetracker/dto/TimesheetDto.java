package com.wilotus.timetracker.dto;

import lombok.Data;
import java.time.LocalDate;

@Data
public class TimesheetDto {
    private LocalDate workingDate;
    private int workingHours;
    private String modules;
    private String managerId;
    private String description;
    private String status;
    private String taskIds;
}
