package com.wilotus.timetracker.repository;

import com.wilotus.timetracker.entity.EmployeeGroup;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmployeeGroupRepository extends JpaRepository<EmployeeGroup, Long> {
    boolean existsByName(String name);
}
