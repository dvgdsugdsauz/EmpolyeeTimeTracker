package com.wilotus.timetracker.repository;

import com.wilotus.timetracker.entity.Timesheet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDate;
import java.util.List;

public interface TimesheetRepository extends JpaRepository<Timesheet, Long> {
    List<Timesheet> findByEmployeeIdOrderByWorkingDateDesc(String employeeId);
    @Query("SELECT t FROM Timesheet t WHERE t.managerId = :id OR t.managerId LIKE CONCAT(:id,',%') OR t.managerId LIKE CONCAT('%,',:id,',%') OR t.managerId LIKE CONCAT('%,',:id) ORDER BY t.workingDate DESC")
    List<Timesheet> findByManagerIdContainingOrderByWorkingDateDesc(@Param("id") String id);

    List<Timesheet> findByWorkingDateAndStatusIn(LocalDate date, List<String> statuses);

    @Modifying
    @Query("DELETE FROM Timesheet t WHERE t.workingDate < :cutoff")
    int deleteByWorkingDateBefore(@Param("cutoff") LocalDate cutoff);
}
