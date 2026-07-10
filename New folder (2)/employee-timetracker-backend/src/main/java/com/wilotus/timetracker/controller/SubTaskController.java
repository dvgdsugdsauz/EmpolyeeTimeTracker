package com.wilotus.timetracker.controller;

import com.wilotus.timetracker.dto.SubTaskDto;
import com.wilotus.timetracker.service.SubTaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/subtasks")
@RequiredArgsConstructor
public class SubTaskController {

    private final SubTaskService subTaskService;

    @PostMapping
    public SubTaskDto create(@RequestBody SubTaskDto dto, Authentication auth) {
        return subTaskService.create(auth.getName(), dto);
    }

    @PutMapping("/{id}")
    public SubTaskDto update(@PathVariable Long id, @RequestBody SubTaskDto dto, Authentication auth) {
        return subTaskService.update(id, auth.getName(), dto);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id, Authentication auth) {
        subTaskService.delete(id, auth.getName());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/by-task/{parentTaskId}")
    public List<SubTaskDto> getByParentTask(@PathVariable String parentTaskId) {
        return subTaskService.getByParentTask(parentTaskId);
    }

    @GetMapping("/my")
    public List<SubTaskDto> getMySubTasks(Authentication auth) {
        return subTaskService.getMySubTasks(auth.getName());
    }
}
