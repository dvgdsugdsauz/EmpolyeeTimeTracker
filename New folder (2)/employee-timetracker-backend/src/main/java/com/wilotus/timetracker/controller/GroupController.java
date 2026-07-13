package com.wilotus.timetracker.controller;

import com.wilotus.timetracker.dto.GroupDetailDto;
import com.wilotus.timetracker.service.GroupService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','HR')")
public class GroupController {

    private final GroupService groupService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','HR','MANAGER')")
    public ResponseEntity<List<GroupDetailDto>> getAll() {
        return ResponseEntity.ok(groupService.getAllGroups());
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, String> body) {
        try {
            return ResponseEntity.ok(groupService.createGroup(body.get("name")));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        groupService.deleteGroup(id);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }

    @PostMapping("/{id}/subgroups")
    public ResponseEntity<?> addSubGroup(@PathVariable Long id, @RequestBody Map<String, String> body) {
        try {
            return ResponseEntity.ok(groupService.addSubGroup(id, body.get("name")));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/subgroups/{sgId}")
    public ResponseEntity<?> deleteSubGroup(@PathVariable Long sgId) {
        groupService.deleteSubGroup(sgId);
        return ResponseEntity.ok(Map.of("status", "deleted"));
    }

    @PutMapping("/assign")
    public ResponseEntity<?> assign(@RequestBody Map<String, Object> body) {
        String empId = (String) body.get("employeeId");
        Long groupId = body.get("groupId") != null ? ((Number) body.get("groupId")).longValue() : null;
        Long subGroupId = body.get("subGroupId") != null ? ((Number) body.get("subGroupId")).longValue() : null;
        groupService.assignEmployee(empId, groupId, subGroupId);
        return ResponseEntity.ok(Map.of("status", "assigned"));
    }

    @DeleteMapping("/assign/{empId}")
    public ResponseEntity<?> removeAssign(@PathVariable String empId) {
        groupService.removeFromGroup(empId);
        return ResponseEntity.ok(Map.of("status", "removed"));
    }
}
