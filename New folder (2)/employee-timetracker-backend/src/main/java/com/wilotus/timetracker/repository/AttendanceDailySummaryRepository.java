package com.wilotus.timetracker.repository;

import com.wilotus.timetracker.entity.AttendanceDailySummary;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface AttendanceDailySummaryRepository extends JpaRepository<AttendanceDailySummary, Long> {
    Optional<AttendanceDailySummary> findByEmployeeIdAndDate(String employeeId, LocalDate date);
    List<AttendanceDailySummary> findByEmployeeIdOrderByDateDesc(String employeeId);
    List<AttendanceDailySummary> findByEmployeeIdAndDateBetweenOrderByDateDesc(
            String employeeId, LocalDate from, LocalDate to);
    List<AttendanceDailySummary> findByDateOrderByEmployeeIdAsc(LocalDate date);
    List<AttendanceDailySummary> findByDateBetweenOrderByDateDescEmployeeIdAsc(
            LocalDate from, LocalDate to);
}
