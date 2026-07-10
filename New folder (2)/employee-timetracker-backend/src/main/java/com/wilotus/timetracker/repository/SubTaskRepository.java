package com.wilotus.timetracker.repository;

import com.wilotus.timetracker.entity.SubTask;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface SubTaskRepository extends JpaRepository<SubTask, Long> {
    List<SubTask> findByParentTaskIdOrderBySubTaskIdAsc(String parentTaskId);
    List<SubTask> findByEmployeeIdOrderByCreatedAtDesc(String employeeId);
    long countByParentTaskId(String parentTaskId);
}
