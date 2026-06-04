package com.wilotus.timetracker.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class PunchRequest {
    private String employeeId;
    private LocalDateTime punchTime;
    private int punchState;   // 0 = IN, 1 = OUT
    private String deviceId;
}
