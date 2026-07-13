package com.wilotus.timetracker.repository;

import com.wilotus.timetracker.entity.EmployeeSubGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface EmployeeSubGroupRepository extends JpaRepository<EmployeeSubGroup, Long> {
    List<EmployeeSubGroup> findByGroupId(Long groupId);
    void deleteByGroupId(Long groupId);
}
