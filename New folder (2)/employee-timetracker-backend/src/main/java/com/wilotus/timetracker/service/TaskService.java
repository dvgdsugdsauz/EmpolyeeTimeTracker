package com.wilotus.timetracker.service;

import com.wilotus.timetracker.dto.TaskDto;
import com.wilotus.timetracker.entity.Employee;
import com.wilotus.timetracker.entity.Task;
import com.wilotus.timetracker.repository.EmployeeRepository;
import com.wilotus.timetracker.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;
    private final EmployeeRepository employeeRepository;

    public List<TaskDto> getAllTasks() {
        return taskRepository.findAll().stream().map(this::toDto).collect(Collectors.toList());
    }

    public List<TaskDto> getMyTasks(String username) {
        return taskRepository.findByAssignedTo(username).stream().map(this::toDto).collect(Collectors.toList());
    }

    public void importTasks(List<TaskDto> dtos) {
        List<Task> tasks = dtos.stream().map(dto -> {
            Task t = taskRepository.findById(dto.getTaskId()).orElse(new Task());
            t.setTaskId(dto.getTaskId());
            t.setModule(dto.getModule());
            t.setDescription(dto.getDescription());
            t.setType(dto.getType());
            t.setPriority(dto.getPriority());
            t.setTicketRef(dto.getTicketRef());
            t.setRole(dto.getRole());
            t.setQaAssigned(dto.getQaAssigned());
            t.setTargetDate(dto.getTargetDate());
            t.setStatus(dto.getStatus() != null ? dto.getStatus() : "Pending");
            return t;
        }).collect(Collectors.toList());
        taskRepository.saveAll(tasks);
    }

    public TaskDto assignTask(String taskId, String employeeId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found: " + taskId));
        Employee emp = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new RuntimeException("Employee not found: " + employeeId));
        task.setAssignedTo(emp.getUsername());
        task.setAssignedToName(emp.getName());
        taskRepository.save(task);
        return toDto(task);
    }

    public void assignBulk(List<String> taskIds, String employeeId) {
        Employee emp = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new RuntimeException("Employee not found: " + employeeId));
        List<Task> tasks = taskRepository.findAllById(taskIds);
        tasks.forEach(t -> {
            t.setAssignedTo(emp.getUsername());
            t.setAssignedToName(emp.getName());
        });
        taskRepository.saveAll(tasks);
    }

    public TaskDto updateMyTask(String taskId, String username, TaskDto update) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found: " + taskId));
        if (!username.equals(task.getAssignedTo())) {
            throw new RuntimeException("Not authorized to update this task");
        }
        if (update.getActualStartDateTime() != null) task.setActualStartDateTime(update.getActualStartDateTime());
        if (update.getActualEndDateTime()   != null) task.setActualEndDateTime(update.getActualEndDateTime());
        if (update.getStatus()              != null) task.setStatus(update.getStatus());
        if (update.getRemarks()             != null) task.setRemarks(update.getRemarks());
        taskRepository.save(task);
        return toDto(task);
    }

    private TaskDto toDto(Task t) {
        TaskDto d = new TaskDto();
        d.setTaskId(t.getTaskId());
        d.setModule(t.getModule());
        d.setDescription(t.getDescription());
        d.setType(t.getType());
        d.setPriority(t.getPriority());
        d.setTicketRef(t.getTicketRef());
        d.setRole(t.getRole());
        d.setQaAssigned(t.getQaAssigned());
        d.setTargetDate(t.getTargetDate());
        d.setStatus(t.getStatus());
        d.setActualStartDateTime(t.getActualStartDateTime());
        d.setActualEndDateTime(t.getActualEndDateTime());
        d.setRemarks(t.getRemarks());
        d.setAssignedTo(t.getAssignedTo());
        d.setAssignedToName(t.getAssignedToName());
        return d;
    }
}
