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
    @PreAuthorize("hasAnyRole('ADMIN','MANAGER')")
    public ResponseEntity<List<EmployeeDto>> getAll() {
        return ResponseEntity.ok(
                employeeService.getAll().stream()
                        .map(employeeService::toDto)
                        .toList());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> create(@RequestBody EmployeeDto dto) {
        try {
            return ResponseEntity.ok(employeeService.toDto(employeeService.create(dto)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody EmployeeDto dto) {
        try {
            return ResponseEntity.ok(employeeService.toDto(employeeService.update(id, dto)));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> delete(@PathVariable String id) {
        employeeService.deactivate(id);
        return ResponseEntity.ok(Map.of("status", "deactivated"));
    }
}
