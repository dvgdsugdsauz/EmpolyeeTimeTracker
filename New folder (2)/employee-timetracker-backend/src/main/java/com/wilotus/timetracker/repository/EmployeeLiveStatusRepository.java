package com.wilotus.timetracker.repository;

import com.wilotus.timetracker.entity.EmployeeLiveStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface EmployeeLiveStatusRepository extends JpaRepository<EmployeeLiveStatus, String> {
    List<EmployeeLiveStatus> findByStatus(String status);
    List<EmployeeLiveStatus> findByStatusIn(List<String> statuses);
    List<EmployeeLiveStatus> findByMissPunchNotifiedFalseAndStatusIn(List<String> statuses);
}
