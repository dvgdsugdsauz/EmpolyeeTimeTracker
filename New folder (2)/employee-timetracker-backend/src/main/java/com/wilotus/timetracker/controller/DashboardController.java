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
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<DashboardMetricsDto> getMetrics() {
        return ResponseEntity.ok(dashboardService.getMetrics());
    }

    @GetMapping("/live")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<List<LiveStatusDto>> getLive() {
        return ResponseEntity.ok(dashboardService.getLiveAttendance());
    }

    /** One-shot admin endpoint: fix punch states + rebuild all daily summaries + refresh live status */
    @PostMapping("/admin/rebuild-data")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> rebuildData() {
        String historicalResult = attendanceService.rebuildHistoricalSummaries();
        String liveResult       = attendanceService.rebuildLiveStatusToday();
        return ResponseEntity.ok(Map.of(
                "historical", historicalResult,
                "live",       liveResult
        ));
    }
}
