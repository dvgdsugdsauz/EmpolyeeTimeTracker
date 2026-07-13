package com.wilotus.timetracker.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "emp_sub_groups")
public class EmployeeSubGroup {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "group_id", nullable = false)
    private Long groupId;

    @Column(nullable = false)
    private String name;

    private LocalDateTime createdAt;

    @PrePersist
    void pre() { createdAt = LocalDateTime.now(); }
}
