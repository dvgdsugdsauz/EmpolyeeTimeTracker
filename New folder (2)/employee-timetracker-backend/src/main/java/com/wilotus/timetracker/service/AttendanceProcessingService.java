package com.wilotus.timetracker.service;

import com.wilotus.timetracker.dto.PunchRequest;
import com.wilotus.timetracker.entity.*;
import com.wilotus.timetracker.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.*;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AttendanceProcessingService {

    private final AttendanceRawRepository rawRepo;
    private final EmployeeLiveStatusRepository liveRepo;
    private final AttendanceDailySummaryRepository summaryRepo;
    private final EmployeeRepository employeeRepo;
    private final NotificationService notificationService;
    private final SseService sseService;
    private final DashboardService dashboardService;

    @Value("${app.attendance.miss-punch-threshold-ms}") private long missPunchThresholdMs;
    @Value("${app.attendance.late-after}")              private String lateAfter;
    @Value("${app.attendance.very-late-after}")         private String veryLateAfter;
    @Value("${app.attendance.lunch-start}")             private String lunchStart;
    @Value("${app.attendance.lunch-end}")               private String lunchEnd;

    // ── Receive punch from biometric middleware ─────────────────────────────

    @Transactional
    public void processPunch(PunchRequest req) {
        // Duplicate guard
        if (rawRepo.existsByEmployeeIdAndPunchTimeAndPunchState(
                req.getEmployeeId(), req.getPunchTime(), req.getPunchState())) {
            log.debug("Duplicate punch ignored: {} {}", req.getEmployeeId(), req.getPunchTime());
            return;
        }

        // Save raw record
        AttendanceRaw raw = AttendanceRaw.builder()
                .employeeId(req.getEmployeeId())
                .punchTime(req.getPunchTime())
                .punchState(req.getPunchState())
                .deviceId(req.getDeviceId())
                .processed(false)
                .build();
        rawRepo.save(raw);

        // Process immediately
        applyPunchToLiveStatus(raw);
        raw.setProcessed(true);
        rawRepo.save(raw);

        // Broadcast real-time update to all connected dashboards
        sseService.broadcastLive(dashboardService.getLiveAttendance());
    }

    // ── Apply a single punch to live status ────────────────────────────────

    private void applyPunchToLiveStatus(AttendanceRaw raw) {
        // Only update live status for today's punches — historical punches don't affect live view
        if (!raw.getPunchTime().toLocalDate().equals(LocalDate.now())) {
            log.debug("Skipping historical punch for live status: {} {}", raw.getEmployeeId(), raw.getPunchTime());
            return;
        }

        EmployeeLiveStatus live = liveRepo.findById(raw.getEmployeeId())
                .orElseGet(() -> {
                    EmployeeLiveStatus s = new EmployeeLiveStatus();
                    s.setEmployeeId(raw.getEmployeeId());
                    s.setStatus("NOT_ARRIVED");
                    s.setLateStatus("NORMAL");
                    return s;
                });

        LocalDateTime punchTime = raw.getPunchTime();

        if (raw.getPunchState() == 0) {
            // ── PUNCH IN ──────────────────────────────────────────────────
            handlePunchIn(live, punchTime);
        } else {
            // ── PUNCH OUT ─────────────────────────────────────────────────
            handlePunchOut(live, punchTime);
        }

        live.setUpdatedAt(LocalDateTime.now());
        liveRepo.save(live);
        updateDailySummary(live, punchTime.toLocalDate());
    }

    private void handlePunchIn(EmployeeLiveStatus live, LocalDateTime punchTime) {
        // Accumulate break/lunch time from last punch-out
        if (live.getLastPunchOut() != null) {
            long outsideMs = Duration.between(live.getLastPunchOut(), punchTime).toMillis();
            if ("LUNCH".equals(live.getStatus())) {
                live.setTotalLunchMs(live.getTotalLunchMs() + outsideMs);
            } else if ("BREAK".equals(live.getStatus()) || "MISS_PUNCH".equals(live.getStatus())) {
                live.setTotalBreakMs(live.getTotalBreakMs() + outsideMs);
            }
        }

        // First punch of day — set entry time and late status
        if (live.getEntryTime() == null) {
            live.setEntryTime(punchTime);
            live.setLateStatus(calculateLateStatus(punchTime.toLocalTime()));

            if (!"NORMAL".equals(live.getLateStatus())) {
                notificationService.createLateNotification(
                        live.getEmployeeId(), live.getLateStatus(), punchTime);
            }
        }

        live.setLastPunchIn(punchTime);
        live.setStatus("WORKING");
        live.setMissPunchNotified(false);
    }

    private void handlePunchOut(EmployeeLiveStatus live, LocalDateTime punchTime) {
        // Accumulate work time from last punch-in
        if (live.getLastPunchIn() != null) {
            long workSegment = Duration.between(live.getLastPunchIn(), punchTime).toMillis();
            live.setTotalWorkMs(live.getTotalWorkMs() + workSegment);
        }

        live.setLastPunchOut(punchTime);

        // Determine LUNCH vs BREAK
        if (isLunchWindow(punchTime.toLocalTime())) {
            live.setStatus("LUNCH");
        } else {
            live.setStatus("BREAK");
        }
    }

    // ── Scheduled: Miss-punch detection every 5 minutes ────────────────────

    @Scheduled(fixedDelay = 300_000)
    @Transactional
    public void checkMissPunches() {
        LocalDateTime now = LocalDateTime.now();
        List<EmployeeLiveStatus> outside = liveRepo.findByStatusIn(
                List.of("BREAK", "LUNCH"));

        for (EmployeeLiveStatus live : outside) {
            if (live.getLastPunchOut() == null) continue;
            long outsideMs = Duration.between(live.getLastPunchOut(), now).toMillis();
            if (outsideMs >= missPunchThresholdMs && !live.isMissPunchNotified()) {
                live.setStatus("MISS_PUNCH");
                live.setMissPunchNotified(true);
                liveRepo.save(live);

                notificationService.createMissPunchNotification(
                        live.getEmployeeId(), outsideMs);
            }
        }
        // Broadcast if any status changed to MISS_PUNCH
        sseService.broadcastLive(dashboardService.getLiveAttendance());
    }

    // ── Scheduled: Daily reset at midnight ─────────────────────────────────

    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void dailyReset() {
        LocalDate today     = LocalDate.now();
        LocalDate yesterday = today.minusDays(1);
        boolean   yWeekend  = yesterday.getDayOfWeek().getValue() >= 6;
        log.info("Running daily attendance reset for {}", today);

        List<EmployeeLiveStatus> allLive = liveRepo.findAll();

        for (EmployeeLiveStatus live : allLive) {
            if (yWeekend) {
                saveHolidaySummary(live.getEmployeeId(), yesterday);
            } else if ("NOT_ARRIVED".equals(live.getStatus())) {
                // No punches at all — mark ABSENT
                AttendanceDailySummary summary = summaryRepo
                        .findByEmployeeIdAndDate(live.getEmployeeId(), yesterday)
                        .orElseGet(() -> AttendanceDailySummary.builder()
                                .employeeId(live.getEmployeeId()).date(yesterday).build());
                summary.setStatus("ABSENT");
                summary.setLateStatus("NORMAL");
                summary.setTotalWorkMs(0);
                summary.setTotalBreakMs(0);
                summary.setTotalLunchMs(0);
                summaryRepo.save(summary);
            } else {
                // Rebuild from raw punches using correct dedup formula — same logic as
                // buildDailySummaryFromRaw so live path and historical path are consistent.
                summaryRepo.findByEmployeeIdAndDate(live.getEmployeeId(), yesterday)
                           .ifPresent(summaryRepo::delete);
                summaryRepo.flush();
                buildDailySummaryFromRaw(live.getEmployeeId(), yesterday);
            }

            // Reset live status for new day
            live.setStatus("NOT_ARRIVED");
            live.setEntryTime(null);
            live.setLastPunchIn(null);
            live.setLastPunchOut(null);
            live.setTotalWorkMs(0);
            live.setTotalBreakMs(0);
            live.setTotalLunchMs(0);
            live.setLateStatus("NORMAL");
            live.setMissPunchNotified(false);
            live.setUpdatedAt(LocalDateTime.now());
        }
        liveRepo.saveAll(allLive);

        // On Monday: also create HOLIDAY for Saturday (Sunday handled above as yesterday)
        if (today.getDayOfWeek().getValue() == 1) {
            LocalDate saturday = yesterday.minusDays(1);
            for (EmployeeLiveStatus live : allLive) {
                saveHolidaySummary(live.getEmployeeId(), saturday);
            }
        }

        log.info("Daily reset complete for {} employees", allLive.size());
    }

    private void saveHolidaySummary(String employeeId, LocalDate date) {
        AttendanceDailySummary s = summaryRepo.findByEmployeeIdAndDate(employeeId, date)
                .orElseGet(() -> AttendanceDailySummary.builder()
                        .employeeId(employeeId).date(date).build());
        if (!"HOLIDAY".equals(s.getStatus())) {
            s.setStatus("HOLIDAY");
            s.setLateStatus("NORMAL");
            s.setTotalWorkMs(0);
            s.setTotalBreakMs(0);
            s.setTotalLunchMs(0);
            summaryRepo.save(s);
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    private void updateDailySummary(EmployeeLiveStatus live, LocalDate date) {
        AttendanceDailySummary summary = summaryRepo.findByEmployeeIdAndDate(live.getEmployeeId(), date)
                .orElseGet(() -> AttendanceDailySummary.builder()
                        .employeeId(live.getEmployeeId())
                        .date(date)
                        .build());

        summary.setEntryTime(live.getEntryTime() != null ? live.getEntryTime().toLocalTime() : null);
        summary.setExitTime(live.getLastPunchOut() != null ? live.getLastPunchOut().toLocalTime() : null);
        summary.setTotalWorkMs(live.getTotalWorkMs());
        summary.setTotalBreakMs(live.getTotalBreakMs());
        summary.setTotalLunchMs(live.getTotalLunchMs());
        summary.setLateStatus(live.getLateStatus());
        summary.setStatus(live.getStatus());
        summaryRepo.save(summary);
    }

    private String calculateLateStatus(LocalTime entryTime) {
        LocalTime late     = LocalTime.parse(lateAfter,     DateTimeFormatter.ofPattern("HH:mm"));
        LocalTime veryLate = LocalTime.parse(veryLateAfter, DateTimeFormatter.ofPattern("HH:mm"));

        if (entryTime.isAfter(veryLate) || entryTime.equals(veryLate)) return "VERY_LATE";
        if (entryTime.isAfter(late))                                    return "LATE";
        return "NORMAL";
    }

    private boolean isLunchWindow(LocalTime time) {
        LocalTime start = LocalTime.parse(lunchStart, DateTimeFormatter.ofPattern("HH:mm"));
        LocalTime end   = LocalTime.parse(lunchEnd,   DateTimeFormatter.ofPattern("HH:mm"));
        return !time.isBefore(start) && !time.isAfter(end);
    }

    // ── Historical: build daily summaries from raw punches ──────────────────
    // Runs every 2 minutes; handles any (employee, date) pair that has raw records but no summary yet.
    // This covers historical device data pushed after a reconnect (Stamp=0).

    @Scheduled(fixedDelay = 120_000)
    @Transactional
    public void computeHistoricalSummaries() {
        List<Object[]> missing = rawRepo.findEmployeeDatesMissingDailySummary();
        if (missing.isEmpty()) return;
        log.info("Historical summary job: {} employee-date pairs to compute", missing.size());
        for (Object[] row : missing) {
            String employeeId = (String) row[0];
            LocalDate date    = ((java.sql.Date) row[1]).toLocalDate();
            buildDailySummaryFromRaw(employeeId, date);
        }
    }

    private void buildDailySummaryFromRaw(String employeeId, LocalDate date) {
        List<AttendanceRaw> punches = rawRepo.findByEmployeeIdAndPunchTimeBetweenOrderByPunchTimeAsc(
                employeeId, date.atStartOfDay(), date.atTime(23, 59, 59));
        if (punches.isEmpty()) return;

        // Step 1: Deduplicate by minute.
        // ZKTeco devices occasionally send both IN and OUT at the same timestamp (ghost punches).
        // When IN+OUT exist at the same minute, keep IN and discard OUT — this matches the
        // official ZKTeco HR software behaviour and gives the correct work duration.
        Map<LocalDateTime, AttendanceRaw> byMinute = new LinkedHashMap<>();
        for (AttendanceRaw p : punches) {
            LocalDateTime minute = p.getPunchTime().truncatedTo(ChronoUnit.MINUTES);
            if (!byMinute.containsKey(minute) || p.getPunchState() == 0) {
                byMinute.put(minute, p);
            }
        }
        List<AttendanceRaw> deduped = new ArrayList<>(byMinute.values());

        // Step 2: First/last from deduplicated list
        LocalDateTime firstPunch = deduped.get(0).getPunchTime();
        LocalDateTime lastPunch  = deduped.get(deduped.size() - 1).getPunchTime();
        LocalTime entryTime = firstPunch.toLocalTime();
        LocalTime exitTime  = lastPunch.toLocalTime();
        String lateStatus   = calculateLateStatus(entryTime);
        long presenceMs     = Duration.between(firstPunch, lastPunch).toMillis();

        // Step 3: Sum state-based IN→OUT pairs (matching official HR software logic)
        long totalWorkMs  = 0;
        long totalBreakMs = 0;
        long totalLunchMs = 0;
        LocalDateTime sessionStart = null;
        for (AttendanceRaw p : deduped) {
            if (p.getPunchState() == 0 && sessionStart == null) {
                sessionStart = p.getPunchTime();
            } else if (p.getPunchState() == 1 && sessionStart != null) {
                totalWorkMs += Duration.between(sessionStart, p.getPunchTime()).toMillis();
                sessionStart = null;
            }
        }
        totalBreakMs = Math.max(0, presenceMs - totalWorkMs);

        String finalStatus = (presenceMs > 0) ? "OFFLINE" : "PRESENT";

        AttendanceDailySummary summary = summaryRepo.findByEmployeeIdAndDate(employeeId, date)
                .orElseGet(() -> AttendanceDailySummary.builder().employeeId(employeeId).date(date).build());
        summary.setEntryTime(entryTime);
        summary.setExitTime(exitTime);
        summary.setTotalWorkMs(totalWorkMs);
        summary.setTotalBreakMs(totalBreakMs);
        summary.setTotalLunchMs(totalLunchMs);
        summary.setLateStatus(lateStatus);
        summary.setStatus(finalStatus);
        summaryRepo.save(summary);
        log.debug("Summary built: emp={} date={} presence={}ms work={}ms break={}ms status={}",
                employeeId, date, presenceMs, totalWorkMs, totalBreakMs, finalStatus);
    }

    // ── Admin: fix raw punch states and rebuild all daily summaries ─────────────

    @Transactional
    public String rebuildHistoricalSummaries() {
        // Step 1: set first punch per (employee, date) to punch_state=0 (IN)
        int fixed = rawRepo.fixFirstPunchStates();
        log.info("Rebuild: fixed {} punch states to IN (first punch per employee/day)", fixed);

        // Step 2: delete and rebuild daily summaries for all dates with raw data
        List<Object[]> allPairs = rawRepo.findAllEmployeeDatePairs();
        LocalDate today = LocalDate.now();
        int rebuilt = 0;

        for (Object[] row : allPairs) {
            String    employeeId = (String) row[0];
            LocalDate date       = ((java.sql.Date) row[1]).toLocalDate();
            if (date.equals(today)) continue; // today handled by rebuildLiveStatusToday()

            summaryRepo.findByEmployeeIdAndDate(employeeId, date)
                       .ifPresent(summaryRepo::delete);
            summaryRepo.flush();
            buildDailySummaryFromRaw(employeeId, date);
            rebuilt++;
        }

        log.info("Rebuild: rebuilt {} daily summaries", rebuilt);
        return String.format("Fixed %d punch states; rebuilt %d daily summaries", fixed, rebuilt);
    }

    // ── Admin: rebuild live status from today's raw punches ─────────────────────

    @Transactional
    public String rebuildLiveStatusToday() {
        LocalDate today = LocalDate.now();

        // Reset all live statuses to NOT_ARRIVED
        List<EmployeeLiveStatus> allLive = liveRepo.findAll();
        for (EmployeeLiveStatus live : allLive) {
            live.setStatus("NOT_ARRIVED");
            live.setEntryTime(null);
            live.setLastPunchIn(null);
            live.setLastPunchOut(null);
            live.setTotalWorkMs(0);
            live.setTotalBreakMs(0);
            live.setTotalLunchMs(0);
            live.setLateStatus("NORMAL");
            live.setMissPunchNotified(false);
            live.setUpdatedAt(LocalDateTime.now());
        }
        liveRepo.saveAll(allLive);

        List<AttendanceRaw> todayPunches = rawRepo.findAllInRangeOrdered(
                today.atStartOfDay(), today.atTime(23, 59, 59));

        if (todayPunches.isEmpty()) {
            log.info("Rebuild live: no punches for today ({})", today);
            sseService.broadcastLive(dashboardService.getLiveAttendance());
            return "No punches found for today — live status reset to NOT_ARRIVED";
        }

        Map<String, List<AttendanceRaw>> byEmp = todayPunches.stream()
                .collect(Collectors.groupingBy(AttendanceRaw::getEmployeeId));

        for (Map.Entry<String, List<AttendanceRaw>> entry : byEmp.entrySet()) {
            String employeeId = entry.getKey();
            EmployeeLiveStatus live = liveRepo.findById(employeeId)
                    .orElseGet(() -> {
                        EmployeeLiveStatus s = new EmployeeLiveStatus();
                        s.setEmployeeId(employeeId);
                        s.setStatus("NOT_ARRIVED");
                        s.setLateStatus("NORMAL");
                        return s;
                    });

            // Deduplicate by minute (same rule as buildDailySummaryFromRaw)
            Map<LocalDateTime, AttendanceRaw> dedupMap = new LinkedHashMap<>();
            for (AttendanceRaw p : entry.getValue()) {
                LocalDateTime minute = p.getPunchTime().truncatedTo(ChronoUnit.MINUTES);
                if (!dedupMap.containsKey(minute) || p.getPunchState() == 0) {
                    dedupMap.put(minute, p);
                }
            }

            for (AttendanceRaw punch : dedupMap.values()) {
                if (punch.getPunchState() == 0) handlePunchIn(live, punch.getPunchTime());
                else                            handlePunchOut(live, punch.getPunchTime());
            }
            live.setUpdatedAt(LocalDateTime.now());
            liveRepo.save(live);
        }

        sseService.broadcastLive(dashboardService.getLiveAttendance());
        log.info("Rebuild live: processed {} employees for today ({})", byEmp.size(), today);
        return String.format("Rebuilt live status for %d employees from today's punches", byEmp.size());
    }

    // ── Approve Offline ─────────────────────────────────────────────────────

    @Transactional
    public void approveOffline(String employeeId) {
        liveRepo.findById(employeeId).ifPresent(live -> {
            live.setStatus("OFFLINE");
            live.setMissPunchNotified(false);
            live.setUpdatedAt(LocalDateTime.now());
            liveRepo.save(live);
            updateDailySummary(live, LocalDate.now());
        });
        sseService.broadcastLive(dashboardService.getLiveAttendance());
    }
}
