package com.wilotus.timetracker.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "sub_tasks")
public class SubTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sub_task_id", nullable = false, unique = true)
    private String subTaskId;

    @Column(name = "parent_task_id", nullable = false)
    private String parentTaskId;

    @Column(name = "employee_id", nullable = false)
    private String employeeId;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "actual_start_datetime")
    private String actualStartDateTime;

    @Column(name = "actual_end_datetime")
    private String actualEndDateTime;

    @Column(name = "remarks", columnDefinition = "TEXT")
    private String remarks;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() { createdAt = LocalDateTime.now(); updatedAt = LocalDateTime.now(); }

    @PreUpdate
    void preUpdate() { updatedAt = LocalDateTime.now(); }
}
