package com.wilotus.timetracker.service;

import com.wilotus.timetracker.dto.DashboardMetricsDto;
import com.wilotus.timetracker.dto.DashboardMetricsDto.ChartDayDto;
import com.wilotus.timetracker.dto.LiveStatusDto;
import com.wilotus.timetracker.entity.*;
import com.wilotus.timetracker.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
public class DashboardService {

    private final EmployeeRepository employeeRepo;
    private final EmployeeLiveStatusRepository liveRepo;
    private final AttendanceDailySummaryRepository summaryRepo;

    public DashboardMetricsDto getMetrics() {
        List<Employee> employees = employeeRepo.findByRoleAndActiveTrue("employee");
        List<EmployeeLiveStatus> allLive = liveRepo.findAll();

        Map<String, EmployeeLiveStatus> liveMap = new HashMap<>();
        for (EmployeeLiveStatus ls : allLive) liveMap.put(ls.getEmployeeId(), ls);

        int total = employees.size();
        int working = 0, outside = 0, miss = 0, notArrived = 0, offline = 0;

        for (Employee emp : employees) {
            EmployeeLiveStatus live = liveMap.get(emp.getId());
            String status = live != null ? live.getStatus() : "NOT_ARRIVED";
            switch (status) {
                case "WORKING"    -> working++;
                case "BREAK", "LUNCH" -> outside++;
                case "MISS_PUNCH" -> miss++;
                case "NOT_ARRIVED"-> notArrived++;
                case "OFFLINE"    -> offline++;
            }
        }

        int presentPct = total > 0 ? Math.round(((float)(total - notArrived) / total) * 100) : 0;

        DashboardMetricsDto dto = new DashboardMetricsDto();
        dto.setTotal(total);
        dto.setWorking(working);
        dto.setOutside(outside);
        dto.setMissPunch(miss);
        dto.setNotArrived(notArrived);
        dto.setOffline(offline);
        dto.setPresentPct(presentPct);
        dto.setChartData(buildChartData(employees));
        return dto;
    }

    private List<ChartDayDto> buildChartData(List<Employee> employees) {
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("dd MMM");
        List<ChartDayDto> chart = new ArrayList<>();

        for (int i = 13; i >= 0; i--) {
            LocalDate date = LocalDate.now().minusDays(i);
            int dayOfWeek = date.getDayOfWeek().getValue(); // 1=Mon … 7=Sun
            boolean isWeekend = dayOfWeek == 6 || dayOfWeek == 7;

            int present = 0, overtime = 0;
            if (!isWeekend) {
                List<AttendanceDailySummary> summaries = summaryRepo.findByDateOrderByEmployeeIdAsc(date);
                for (AttendanceDailySummary s : summaries) {
                    if (!"NOT_ARRIVED".equals(s.getStatus())) {
                        present++;
                        long workHours = s.getTotalWorkMs() / 3_600_000;
                        if (workHours > 9) overtime++;
                    }
                }
            }

            ChartDayDto day = new ChartDayDto();
            day.setLabel(date.format(fmt));
            day.setPresent(present);
            day.setOvertime(overtime);
            day.setWeekend(isWeekend);
            chart.add(day);
        }
        return chart;
    }

    public List<LiveStatusDto> getLiveAttendance() {
        List<Employee> employees = employeeRepo.findByActiveTrue();
        List<EmployeeLiveStatus> allLive = liveRepo.findAll();

        Map<String, EmployeeLiveStatus> liveMap = new HashMap<>();
        for (EmployeeLiveStatus ls : allLive) liveMap.put(ls.getEmployeeId(), ls);

        List<LiveStatusDto> result = new ArrayList<>();
        for (Employee emp : employees) {
            EmployeeLiveStatus live = liveMap.get(emp.getId());
            LiveStatusDto dto = new LiveStatusDto();
            dto.setId(emp.getId());
            dto.setName(emp.getName());
            dto.setEmail(emp.getEmail());
            dto.setUsername(emp.getUsername());
            dto.setDept(emp.getDept());
            dto.setAvatar(emp.getAvatar());
            dto.setRole(emp.getRole());

            if (live != null) {
                dto.setStatus(live.getStatus());
                dto.setEntryTime(live.getEntryTime());
                dto.setLastPunchIn(live.getLastPunchIn());
                dto.setLastPunchOut(live.getLastPunchOut());
                dto.setTotalWorkMs(live.getTotalWorkMs());
                dto.setTotalBreakMs(live.getTotalBreakMs());
                dto.setTotalLunchMs(live.getTotalLunchMs());
                dto.setLateStatus(live.getLateStatus());
            } else {
                dto.setStatus("NOT_ARRIVED");
                dto.setLateStatus("NORMAL");
            }
            result.add(dto);
        }
        return result;
    }
}
