package com.wilotus.timetracker.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class LiveStatusDto {
    // Employee info
    private String id;
    private String name;
    private String email;
    private String username;
    private String dept;
    private String designation;
    private String avatar;
    private String role;

    // Live status
    private String status;
    private LocalDateTime entryTime;
    private LocalDateTime lastPunchIn;
    private LocalDateTime lastPunchOut;
    private long totalWorkMs;
    private long totalBreakMs;
    private long totalLunchMs;
    private String lateStatus;
}
