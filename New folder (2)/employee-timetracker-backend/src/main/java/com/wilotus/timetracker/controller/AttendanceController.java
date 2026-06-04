package com.wilotus.timetracker.controller;

import com.wilotus.timetracker.dto.*;
import com.wilotus.timetracker.entity.AttendanceDailySummary;
import com.wilotus.timetracker.entity.Employee;
import com.wilotus.timetracker.entity.EmployeeLiveStatus;
import com.wilotus.timetracker.repository.*;
import com.wilotus.timetracker.service.AttendanceProcessingService;
import com.wilotus.timetracker.service.DashboardService;
import com.wilotus.timetracker.service.ExportService;
import com.wilotus.timetracker.service.SseService;
import com.wilotus.timetracker.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/attendance")
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceProcessingService processingService;
    private final EmployeeRepository employeeRepo;
    private final EmployeeLiveStatusRepository liveRepo;
    private final AttendanceDailySummaryRepository summaryRepo;
    private final AttendanceRawRepository rawRepo;
    private final ExportService exportService;
    private final SseService sseService;
    private final DashboardService dashboardService;
    private final JwtUtil jwtUtil;

    // Called by biometric middleware — no JWT required (secured by network/device secret)
    @PostMapping("/punch")
    public ResponseEntity<?> receivePunch(@RequestBody PunchRequest req) {
        try {
            processingService.processPunch(req);
            return ResponseEntity.ok(Map.of("status", "processed"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    // Employee's own attendance for today
    @GetMapping("/my")
    public ResponseEntity<LiveStatusDto> getMyAttendance(Authentication auth) {
        String username = auth.getName();
        Employee emp = employeeRepo.findByUsernameOrEmail(username, username)
                .orElseThrow();
        EmployeeLiveStatus live = liveRepo.findById(emp.getId()).orElse(null);

        LiveStatusDto dto = new LiveStatusDto();
        dto.setId(emp.getId());
        dto.setName(emp.getName());
        dto.setDept(emp.getDept());
        dto.setAvatar(emp.getAvatar());
        dto.setRole(emp.getRole());

        if (live != null) {
            dto.setStatus(live.getStatus());
            dto.setEntryTime(live.getEntryTime());
            dto.setLastPunchIn(live.getLastPunchIn());
            dto.setLastPunchOut(live.getLastPunchOut());
            dto.setTotalWorkMs(live.getTotalWorkMs());
            dto.setTotalBreakMs(live.getTotalBreakMs());
            dto.setTotalLunchMs(live.getTotalLunchMs());
            dto.setLateStatus(live.getLateStatus());
        } else {
            dto.setStatus("NOT_ARRIVED");
            dto.setLateStatus("NORMAL");
        }
        return ResponseEntity.ok(dto);
    }

    // Employee's today punch log (raw in/out events)
    @GetMapping("/my/today-punches")
    public ResponseEntity<List<Map<String, Object>>> getTodayPunches(Authentication auth) {
        String username = auth.getName();
        Employee emp = employeeRepo.findByUsernameOrEmail(username, username).orElseThrow();

        LocalDate today = LocalDate.now();
        var punches = rawRepo.findByEmployeeIdAndPunchTimeBetweenOrderByPunchTimeAsc(
                emp.getId(), today.atStartOfDay(), today.atTime(23, 59, 59));

        var result = punches.stream().map(p -> {
            Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("time",  p.getPunchTime());
            m.put("state", p.getPunchState() == 0 ? "IN" : "OUT");
            return m;
        }).toList();
        return ResponseEntity.ok(result);
    }

    // Employee's own history — supports ?days=N OR ?from=YYYY-MM-DD&to=YYYY-MM-DD
    @GetMapping("/my/history")
    public ResponseEntity<List<AttendanceSummaryDto>> getMyHistory(
            Authentication auth,
            @RequestParam(required = false) Integer days,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        String username = auth.getName();
        Employee emp = employeeRepo.findByUsernameOrEmail(username, username).orElseThrow();

        if (from == null || to == null) {
            to   = LocalDate.now();
            from = to.minusDays(days != null ? days : 30);
        }
        List<AttendanceDailySummary> summaries =
                summaryRepo.findByEmployeeIdAndDateBetweenOrderByDateDesc(emp.getId(), from, to);

        return ResponseEntity.ok(summaries.stream().map(s -> toSummaryDto(s, emp)).toList());
    }

    // Admin/Manager: all employees' summaries for a single date
    @GetMapping("/daily")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<List<AttendanceSummaryDto>> getDailySummary(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        List<AttendanceDailySummary> summaries = summaryRepo.findByDateOrderByEmployeeIdAsc(date);
        List<Employee> employees = employeeRepo.findByActiveTrue();
        Map<String, Employee> empMap = employees.stream()
                .collect(Collectors.toMap(Employee::getId, e -> e));
        List<AttendanceSummaryDto> result = summaries.stream()
                .filter(s -> empMap.containsKey(s.getEmployeeId()))
                .map(s -> toSummaryDto(s, empMap.get(s.getEmployeeId())))
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    // Admin/Manager: history for any employee
    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<List<AttendanceSummaryDto>> getHistory(
            @RequestParam String employeeId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

        Employee emp = employeeRepo.findById(employeeId).orElseThrow();
        List<AttendanceDailySummary> summaries =
                summaryRepo.findByEmployeeIdAndDateBetweenOrderByDateDesc(employeeId, from, to);

        return ResponseEntity.ok(summaries.stream().map(s -> toSummaryDto(s, emp)).toList());
    }

    // Approve offline
    @PostMapping("/approve-offline/{employeeId}")
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<?> approveOffline(@PathVariable String employeeId) {
        processingService.approveOffline(employeeId);
        return ResponseEntity.ok(Map.of("status", "approved"));
    }

    // Export to Excel
    @GetMapping("/export")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<byte[]> exportExcel(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) throws Exception {

        byte[] data = exportService.exportAttendanceExcel(from, to);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=attendance_" + from + "_to_" + to + ".xlsx")
                .contentType(MediaType.parseMediaType(
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(data);
    }

    // Real-time SSE stream — token passed as query param (EventSource can't set headers)
    @GetMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamLive(@RequestParam String token) {
        if (!jwtUtil.validateToken(token)) {
            SseEmitter emitter = new SseEmitter();
            emitter.completeWithError(new RuntimeException("Unauthorized"));
            return emitter;
        }
        // Send current state immediately on connect
        SseEmitter emitter = sseService.subscribe();
        try {
            emitter.send(SseEmitter.event()
                    .name("attendance")
                    .data(dashboardService.getLiveAttendance()));
        } catch (Exception ignored) {}
        return emitter;
    }

    private AttendanceSummaryDto toSummaryDto(AttendanceDailySummary s, Employee emp) {
        AttendanceSummaryDto dto = new AttendanceSummaryDto();
        dto.setEmployeeId(s.getEmployeeId());
        dto.setEmployeeName(emp.getName());
        dto.setDept(emp.getDept());
        dto.setDate(s.getDate());
        dto.setEntryTime(s.getEntryTime());
        dto.setExitTime(s.getExitTime());
        dto.setTotalWorkMs(s.getTotalWorkMs());
        dto.setTotalBreakMs(s.getTotalBreakMs());
        dto.setTotalLunchMs(s.getTotalLunchMs());
        dto.setLateStatus(s.getLateStatus());
        dto.setStatus(s.getStatus());
        dto.setApproved(s.isApproved());
        return dto;
    }
}
