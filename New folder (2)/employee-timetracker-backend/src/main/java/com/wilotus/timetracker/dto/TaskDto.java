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
    private String status;
    private String assignedTo;
    private String assignedToName;
}
