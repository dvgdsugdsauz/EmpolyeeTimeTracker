package com.wilotus.timetracker.service;

import com.wilotus.timetracker.dto.TaskDto;
import com.wilotus.timetracker.entity.Employee;
import com.wilotus.timetracker.entity.Task;
import com.wilotus.timetracker.repository.EmployeeRepository;
import com.wilotus.timetracker.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Transactional
    public void importTasks(List<TaskDto> dtos) {
        List<Task> tasks = dtos.stream()
            .filter(dto -> dto.getTaskId() != null && !dto.getTaskId().isBlank())
            .map(dto -> {
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
                t.setStatus(dto.getStatus() != null && !dto.getStatus().isBlank() ? dto.getStatus() : "Pending");
                return t;
            }).collect(Collectors.toList());
        if (!tasks.isEmpty()) {
            taskRepository.saveAll(tasks);
        }
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

    @Transactional
    public void unassignTask(String taskId) {
        Task task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found: " + taskId));
        task.setAssignedTo(null);
        task.setAssignedToName(null);
        task.setAssignedBy(null);
        task.setAssignedByName(null);
        task.setStatus(null);
        task.setActualStartDateTime(null);
        task.setActualEndDateTime(null);
        task.setRemarks(null);
        taskRepository.save(task);
    }

    public void assignBulk(List<String> taskIds, String employeeId, String targetDate, String plannedDate, String managerUsername) {
        Employee emp = (employeeId != null && !employeeId.isBlank())
                ? employeeRepository.findById(employeeId)
                        .orElseThrow(() -> new RuntimeException("Employee not found: " + employeeId))
                : null;
        String managerName = employeeRepository.findByUsername(managerUsername)
                .map(Employee::getName).orElse(managerUsername);
        List<Task> tasks = taskRepository.findAllById(taskIds);
        tasks.forEach(t -> {
            if (emp != null) {
                t.setAssignedTo(emp.getUsername());
                t.setAssignedToName(emp.getName());
                t.setAssignedBy(managerUsername);
                t.setAssignedByName(managerName);
                t.setStatus(null);
                t.setActualStartDateTime(null);
                t.setActualEndDateTime(null);
                t.setRemarks(null);
            }
            if (targetDate  != null && !targetDate.isBlank())  t.setTargetDate(targetDate);
            if (plannedDate != null && !plannedDate.isBlank()) t.setPlannedDate(plannedDate);
        });
        taskRepository.saveAll(tasks);
    }

    @Transactional
    public void assignBulkGroup(List<String> taskIds, List<String> employeeIds, String groupName, String targetDate, String plannedDate, String managerUsername) {
        String managerName = employeeRepository.findByUsername(managerUsername)
                .map(Employee::getName).orElse(managerUsername);
        List<Task> sourceTasks = taskRepository.findAllById(taskIds);

        for (Task source : sourceTasks) {
            List<Task> toSave = new java.util.ArrayList<>();
            for (int i = 0; i < employeeIds.size(); i++) {
                Employee emp = employeeRepository.findById(employeeIds.get(i))
                        .orElseThrow(() -> new RuntimeException("Employee not found"));
                Task t = (i == 0) ? source : copyTask(source, source.getTaskId() + "~" + (i + 1));
                t.setAssignedTo(emp.getUsername());
                t.setAssignedToName(emp.getName());
                t.setAssignedBy(managerUsername);
                t.setAssignedByName(managerName);
                t.setAssignedGroupName(groupName);
                t.setStatus(null);
                t.setActualStartDateTime(null);
                t.setActualEndDateTime(null);
                t.setRemarks(null);
                t.setWorkedMinutes(0);
                if (targetDate  != null && !targetDate.isBlank())  t.setTargetDate(targetDate);
                if (plannedDate != null && !plannedDate.isBlank()) t.setPlannedDate(plannedDate);
                toSave.add(t);
            }
            taskRepository.saveAll(toSave);
        }
    }

    private Task copyTask(Task src, String newId) {
        Task t = new Task();
        t.setTaskId(newId);
        t.setModule(src.getModule());
        t.setDescription(src.getDescription());
        t.setType(src.getType());
        t.setPriority(src.getPriority());
        t.setTicketRef(src.getTicketRef());
        t.setRole(src.getRole());
        t.setQaAssigned(src.getQaAssigned());
        return t;
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
        if (update.getWorkedMinutes()       >  0)    task.setWorkedMinutes(update.getWorkedMinutes());
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
        d.setAssignedBy(t.getAssignedBy());
        d.setAssignedByName(t.getAssignedByName());
        d.setPlannedDate(t.getPlannedDate());
        d.setWorkedMinutes(t.getWorkedMinutes());
        d.setAssignedGroupName(t.getAssignedGroupName());
        return d;
    }
}
