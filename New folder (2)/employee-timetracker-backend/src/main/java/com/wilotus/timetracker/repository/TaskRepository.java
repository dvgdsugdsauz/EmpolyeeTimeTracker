package com.wilotus.timetracker.repository;

import com.wilotus.timetracker.entity.Task;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TaskRepository extends JpaRepository<Task, String> {
    List<Task> findByAssignedTo(String assignedTo);
}
