package com.wilotus.timetracker.controller;

import com.wilotus.timetracker.service.TimesheetImportService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class TimesheetImportController {

    private final TimesheetImportService importService;

    @PostMapping("/import-timesheets")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> importTimesheets(
            @RequestParam("file") MultipartFile file) {
        try {
            Map<String, Object> result = importService.importCsv(file);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
