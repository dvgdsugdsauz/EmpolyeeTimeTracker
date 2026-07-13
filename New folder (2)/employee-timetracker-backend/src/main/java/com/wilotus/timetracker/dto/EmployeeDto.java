package com.wilotus.timetracker.dto;

import lombok.Data;

@Data
public class EmployeeDto {
    private String id;
    private String name;
    private String email;
    private String username;
    private String password; // only for create/update — never returned
    private String role;
    private String dept;
    private String designation;
    private String avatar;
    private boolean active;
    private boolean timesheetAccess;
    private Long groupId;
    private Long subGroupId;
}
