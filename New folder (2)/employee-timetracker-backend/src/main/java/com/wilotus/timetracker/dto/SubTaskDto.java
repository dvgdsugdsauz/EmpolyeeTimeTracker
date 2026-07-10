package com.wilotus.timetracker.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class SubTaskDto {
    private Long id;
    private String subTaskId;
    private String parentTaskId;
    private String employeeId;
    private String description;
    private String actualStartDateTime;
    private String actualEndDateTime;
    private String remarks;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
