package com.wilotus.timetracker.repository;

import com.wilotus.timetracker.entity.AttendanceRaw;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface AttendanceRawRepository extends JpaRepository<AttendanceRaw, Long> {

    List<AttendanceRaw> findByProcessedFalseOrderByPunchTimeAsc();

    Optional<AttendanceRaw> findTopByEmployeeIdAndPunchStateOrderByPunchTimeDesc(
            String employeeId, int punchState);

    Optional<AttendanceRaw> findTopByOrderByPunchTimeDesc();

    boolean existsByEmployeeIdAndPunchTimeAndPunchState(
            String employeeId, LocalDateTime punchTime, int punchState);

    List<AttendanceRaw> findByEmployeeIdAndPunchTimeBetweenOrderByPunchTimeAsc(
            String employeeId, LocalDateTime from, LocalDateTime to);

    // Returns epoch-seconds of the most recent punch (used as ADMS Stamp so device only sends newer records)
    @Query(value = "SELECT COALESCE(CAST(EXTRACT(EPOCH FROM MAX(punch_time)) AS bigint), 0) FROM wt_att_raw", nativeQuery = true)
    long findMaxPunchTimeEpoch();

    // Find all (employeeId, date) pairs that have raw records but no daily summary yet
    @Query(value = """
        SELECT DISTINCT r.employee_id, CAST(r.punch_time AS date) AS punch_date
        FROM wt_att_raw r
        WHERE NOT EXISTS (
            SELECT 1 FROM wt_daily_summary s
            WHERE s.employee_id = r.employee_id
              AND s.date = CAST(r.punch_time AS date)
        )
        ORDER BY punch_date
        """, nativeQuery = true)
    List<Object[]> findEmployeeDatesMissingDailySummary();

    // Find all (employeeId, date) pairs that have raw data (for bulk rebuild)
    @Query(value = """
        SELECT DISTINCT employee_id, CAST(punch_time AS date) AS punch_date
        FROM wt_att_raw
        ORDER BY punch_date
        """, nativeQuery = true)
    List<Object[]> findAllEmployeeDatePairs();

    // All punches in a time range ordered by employee then time (for live rebuild)
    @Query(value = "SELECT * FROM wt_att_raw WHERE punch_time BETWEEN :from AND :to ORDER BY employee_id ASC, punch_time ASC", nativeQuery = true)
    List<AttendanceRaw> findAllInRangeOrdered(
            @org.springframework.data.repository.query.Param("from") LocalDateTime from,
            @org.springframework.data.repository.query.Param("to") LocalDateTime to);

    // Set first punch of each employee per day to punch_state=0 (IN)
    @Modifying
    @Query(value = """
        UPDATE wt_att_raw SET punch_state = 0
        WHERE id IN (
            SELECT DISTINCT ON (employee_id, CAST(punch_time AS date)) id
            FROM wt_att_raw
            ORDER BY employee_id, CAST(punch_time AS date), punch_time ASC
        )
        """, nativeQuery = true)
    int fixFirstPunchStates();
}
