package com.wilotus.timetracker.entity;

import jakarta.persistence.*;
import lombok.Data;

@Data
@Entity
@Table(name = "tasks")
public class Task {

    @Id
    @Column(name = "task_id", nullable = false)
    private String taskId;

    @Column(name = "module")
    private String module;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "type")
    private String type;

    @Column(name = "priority")
    private String priority;

    @Column(name = "ticket_ref")
    private String ticketRef;

    @Column(name = "status")
    private String status;

    @Column(name = "assigned_to")
    private String assignedTo;

    @Column(name = "assigned_to_name")
    private String assignedToName;
}
