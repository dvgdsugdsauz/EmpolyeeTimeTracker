package com.wilotus.timetracker.controller;

import com.wilotus.timetracker.dto.EmployeeDto;
import com.wilotus.timetracker.service.EmployeeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/employees")
@RequiredArgsConstructor
public class EmployeeController {

    private final EmployeeService employeeService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER','HR')")
    public ResponseEntity<List<EmployeeDto>> getAll() {
        return ResponseEntity.ok(
                employeeService.getAll().stream()
                        .map(employeeService::toDto)
                        .toList());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','HR')")
    public ResponseEntity<?> create(@RequestBody EmployeeDto dto) {
        try {
            return ResponseEntity.ok(employeeService.toDto(employeeService.create(dto)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','HR')")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody EmployeeDto dto) {
        try {
            return ResponseEntity.ok(employeeService.toDto(employeeService.update(id, dto)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','HR')")
    public ResponseEntity<?> delete(@PathVariable String id) {
        employeeService.deactivate(id);
        return ResponseEntity.ok(Map.of("status", "deactivated"));
    }

    @PatchMapping("/{id}/timesheet-access")
    @PreAuthorize("hasAnyRole('ADMIN','HR')")
    public ResponseEntity<?> setTimesheetAccess(@PathVariable String id, @RequestBody Map<String, Boolean> body) {
        boolean enabled = Boolean.TRUE.equals(body.get("enabled"));
        employeeService.setTimesheetAccess(id, enabled);
        return ResponseEntity.ok(Map.of("timesheetAccess", enabled));
    }

    /** Admin resets any user's password */
    @PostMapping("/{id}/reset-password")
    @PreAuthorize("hasAnyRole('ADMIN','HR')")
    public ResponseEntity<?> resetPassword(@PathVariable String id, @RequestBody Map<String, String> body) {
        String newPassword = body.get("newPassword");
        if (newPassword == null || newPassword.length() < 6)
            return ResponseEntity.badRequest().body(Map.of("error", "Password must be at least 6 characters"));
        try {
            employeeService.resetPassword(id, newPassword);
            return ResponseEntity.ok(Map.of("message", "Password reset successfully"));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
