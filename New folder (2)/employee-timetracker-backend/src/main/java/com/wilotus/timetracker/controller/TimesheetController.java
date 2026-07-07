package com.wilotus.timetracker.controller;

import com.wilotus.timetracker.dto.TimesheetDto;
import com.wilotus.timetracker.dto.TimesheetResponseDto;
import com.wilotus.timetracker.entity.TimesheetModule;
import com.wilotus.timetracker.repository.EmployeeRepository;
import com.wilotus.timetracker.service.TimesheetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/timesheets")
@RequiredArgsConstructor
public class TimesheetController {

    private final TimesheetService timesheetService;
    private final EmployeeRepository employeeRepo;

    @PostMapping
    @PreAuthorize("hasAnyRole('EMPLOYEE','MANAGER','ADMIN')")
    public ResponseEntity<TimesheetResponseDto> create(Authentication auth, @RequestBody TimesheetDto dto) {
        return ResponseEntity.ok(timesheetService.create(resolveId(auth), dto));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('EMPLOYEE','MANAGER','ADMIN')")
    public ResponseEntity<TimesheetResponseDto> update(Authentication auth, @PathVariable Long id, @RequestBody TimesheetDto dto) {
        return ResponseEntity.ok(timesheetService.update(resolveId(auth), id, dto));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('EMPLOYEE','MANAGER','ADMIN')")
    public ResponseEntity<Void> delete(Authentication auth, @PathVariable Long id) {
        timesheetService.delete(resolveId(auth), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/my")
    @PreAuthorize("hasAnyRole('EMPLOYEE','MANAGER','ADMIN')")
    public ResponseEntity<List<TimesheetResponseDto>> getMy(Authentication auth) {
        return ResponseEntity.ok(timesheetService.getMyTimesheets(resolveId(auth)));
    }

    @GetMapping("/team")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<List<TimesheetResponseDto>> getTeam(Authentication auth) {
        return ResponseEntity.ok(timesheetService.getTeamTimesheets(resolveId(auth)));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<TimesheetResponseDto> approve(Authentication auth, @PathVariable Long id) {
        return ResponseEntity.ok(timesheetService.approve(id, resolveId(auth)));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<TimesheetResponseDto> reject(Authentication auth, @PathVariable Long id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(timesheetService.reject(id, resolveId(auth), body.get("reason")));
    }

    @GetMapping("/modules")
    @PreAuthorize("hasAnyRole('EMPLOYEE','MANAGER','ADMIN')")
    public ResponseEntity<List<TimesheetModule>> getModules() {
        return ResponseEntity.ok(timesheetService.getAllModules());
    }

    @PostMapping("/modules")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<TimesheetModule> addModule(Authentication auth, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(timesheetService.addModule(body.get("moduleName"), resolveId(auth)));
    }

    @DeleteMapping("/modules/{id}")
    @PreAuthorize("hasAnyRole('MANAGER','ADMIN')")
    public ResponseEntity<Void> deleteModule(@PathVariable Long id) {
        timesheetService.deleteModule(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/managers")
    @PreAuthorize("hasAnyRole('EMPLOYEE','MANAGER','ADMIN','HR')")
    public ResponseEntity<List<Map<String, String>>> getManagers() {
        List<Map<String, String>> managers = employeeRepo.findByRoleAndActiveTrue("manager")
                .stream()
                .map(e -> Map.of("id", e.getId(), "name", e.getName()))
                .toList();
        return ResponseEntity.ok(managers);
    }

    private String resolveId(Authentication auth) {
        String username = auth.getName();
        return employeeRepo.findByUsernameOrEmail(username, username)
                .orElseThrow(() -> new RuntimeException("Employee not found"))
                .getId();
    }
}
