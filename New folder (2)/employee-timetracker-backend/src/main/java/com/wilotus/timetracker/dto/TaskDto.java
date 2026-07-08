package com.wilotus.timetracker.dto;

import lombok.Data;

@Data
public class TaskDto {
    private String taskId;
    private String module;
    private String description;
    private String type;
    private String priority;
    private String ticketRef;
    private String role;
    private String qaAssigned;
    private String targetDate;
    private String status;
    private String actualStartDateTime;
    private String actualEndDateTime;
    private String remarks;
    private String assignedTo;
    private String assignedToName;
}
