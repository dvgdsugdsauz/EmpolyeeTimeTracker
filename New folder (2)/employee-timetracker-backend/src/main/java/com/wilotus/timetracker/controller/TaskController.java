package com.wilotus.timetracker.controller;

import com.wilotus.timetracker.dto.TaskDto;
import com.wilotus.timetracker.service.TaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @GetMapping
    public List<TaskDto> getAllTasks() {
        return taskService.getAllTasks();
    }

    @GetMapping("/my")
    public List<TaskDto> getMyTasks(Authentication auth) {
        return taskService.getMyTasks(auth.getName());
    }

    @PostMapping("/import")
    public ResponseEntity<Map<String, Object>> importTasks(@RequestBody List<TaskDto> tasks) {
        taskService.importTasks(tasks);
        return ResponseEntity.ok(Map.of("imported", tasks.size()));
    }

    @PostMapping("/{taskId}/assign")
    public TaskDto assignTask(
            @PathVariable String taskId,
            @RequestBody Map<String, String> body) {
        return taskService.assignTask(taskId, body.get("employeeId"));
    }

    @PostMapping("/assign-bulk")
    public ResponseEntity<Map<String, Object>> assignBulk(
            @RequestBody Map<String, Object> body,
            Authentication auth) {
        @SuppressWarnings("unchecked")
        List<String> taskIds = (List<String>) body.get("taskIds");
        String employeeId  = (String) body.get("employeeId");
        String targetDate  = (String) body.get("targetDate");
        taskService.assignBulk(taskIds, employeeId, targetDate, auth.getName());
        return ResponseEntity.ok(Map.of("assigned", taskIds.size()));
    }

    @PutMapping("/{taskId}/my-update")
    public TaskDto updateMyTask(
            @PathVariable String taskId,
            @RequestBody TaskDto update,
            Authentication auth) {
        return taskService.updateMyTask(taskId, auth.getName(), update);
    }
}
