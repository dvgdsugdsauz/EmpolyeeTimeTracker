package com.wilotus.timetracker.service;

import com.wilotus.timetracker.dto.SubTaskDto;
import com.wilotus.timetracker.entity.SubTask;
import com.wilotus.timetracker.repository.SubTaskRepository;
import com.wilotus.timetracker.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SubTaskService {

    private final SubTaskRepository subTaskRepo;
    private final TaskRepository taskRepo;

    @Transactional
    public SubTaskDto create(String employeeId, SubTaskDto dto) {
        String parentId = dto.getParentTaskId();
        if (!taskRepo.existsById(parentId))
            throw new RuntimeException("Parent task not found: " + parentId);

        long count = subTaskRepo.countByParentTaskId(parentId);
        String subTaskId = parentId + "-" + String.format("%03d", count + 1);

        SubTask st = new SubTask();
        st.setSubTaskId(subTaskId);
        st.setParentTaskId(parentId);
        st.setEmployeeId(employeeId);
        st.setDescription(dto.getDescription());
        st.setActualStartDateTime(dto.getActualStartDateTime());
        st.setActualEndDateTime(dto.getActualEndDateTime());
        st.setRemarks(dto.getRemarks());

        return toDto(subTaskRepo.save(st));
    }

    @Transactional
    public SubTaskDto update(Long id, String employeeId, SubTaskDto dto) {
        SubTask st = subTaskRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("SubTask not found"));
        if (!st.getEmployeeId().equals(employeeId))
            throw new RuntimeException("Forbidden");
        st.setDescription(dto.getDescription());
        st.setActualStartDateTime(dto.getActualStartDateTime());
        st.setActualEndDateTime(dto.getActualEndDateTime());
        st.setRemarks(dto.getRemarks());
        return toDto(subTaskRepo.save(st));
    }

    @Transactional
    public void delete(Long id, String employeeId) {
        SubTask st = subTaskRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("SubTask not found"));
        if (!st.getEmployeeId().equals(employeeId))
            throw new RuntimeException("Forbidden");
        subTaskRepo.delete(st);
    }

    public List<SubTaskDto> getByParentTask(String parentTaskId) {
        return subTaskRepo.findByParentTaskIdOrderBySubTaskIdAsc(parentTaskId)
                .stream().map(this::toDto).toList();
    }

    public List<SubTaskDto> getMySubTasks(String employeeId) {
        return subTaskRepo.findByEmployeeIdOrderByCreatedAtDesc(employeeId)
                .stream().map(this::toDto).toList();
    }

    private SubTaskDto toDto(SubTask st) {
        SubTaskDto d = new SubTaskDto();
        d.setId(st.getId());
        d.setSubTaskId(st.getSubTaskId());
        d.setParentTaskId(st.getParentTaskId());
        d.setEmployeeId(st.getEmployeeId());
        d.setDescription(st.getDescription());
        d.setActualStartDateTime(st.getActualStartDateTime());
        d.setActualEndDateTime(st.getActualEndDateTime());
        d.setRemarks(st.getRemarks());
        d.setCreatedAt(st.getCreatedAt());
        d.setUpdatedAt(st.getUpdatedAt());
        return d;
    }
}
