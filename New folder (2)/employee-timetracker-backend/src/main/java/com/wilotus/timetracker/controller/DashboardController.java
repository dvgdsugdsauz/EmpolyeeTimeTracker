package com.wilotus.timetracker.controller;

import com.wilotus.timetracker.dto.DashboardMetricsDto;
import com.wilotus.timetracker.dto.LiveStatusDto;
import com.wilotus.timetracker.service.AttendanceProcessingService;
import com.wilotus.timetracker.service.DashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final DashboardService dashboardService;
    private final AttendanceProcessingService attendanceService;

    @GetMapping("/metrics")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','HR')")
    public ResponseEntity<DashboardMetricsDto> getMetrics() {
        return ResponseEntity.ok(dashboardService.getMetrics());
    }

    @GetMapping("/live")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','HR')")
    public ResponseEntity<List<LiveStatusDto>> getLive() {
        return ResponseEntity.ok(dashboardService.getLiveAttendance());
    }

    /** Trigger device_sync.py on the server to rebuild attendance data */
    @PostMapping("/admin/rebuild-data")
    @PreAuthorize("hasAnyRole('ADMIN','HR')")
    public ResponseEntity<Map<String, String>> rebuildData() {
        try {
            new ProcessBuilder("python3", "/home/ubuntu/device_sync.py")
                    .redirectErrorStream(true)
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .start();
            return ResponseEntity.ok(Map.of("status", "started"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }
}
