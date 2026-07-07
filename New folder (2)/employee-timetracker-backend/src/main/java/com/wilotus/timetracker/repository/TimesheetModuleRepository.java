package com.wilotus.timetracker.repository;

import com.wilotus.timetracker.entity.TimesheetModule;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TimesheetModuleRepository extends JpaRepository<TimesheetModule, Long> {
    boolean existsByModuleNameIgnoreCase(String moduleName);
    List<TimesheetModule> findAllByOrderByModuleNameAsc();
}
