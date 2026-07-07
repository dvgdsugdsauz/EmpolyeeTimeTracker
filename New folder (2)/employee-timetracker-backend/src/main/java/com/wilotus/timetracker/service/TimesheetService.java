package com.wilotus.timetracker.service;

import com.wilotus.timetracker.dto.TimesheetDto;
import com.wilotus.timetracker.dto.TimesheetResponseDto;
import com.wilotus.timetracker.entity.Timesheet;
import com.wilotus.timetracker.entity.TimesheetModule;
import com.wilotus.timetracker.repository.EmployeeRepository;
import com.wilotus.timetracker.repository.TimesheetModuleRepository;
import com.wilotus.timetracker.repository.TimesheetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.stream.Collectors;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TimesheetService {

    private final TimesheetRepository timesheetRepo;
    private final TimesheetModuleRepository moduleRepo;
    private final EmployeeRepository employeeRepo;
    private final NotificationService notificationService;

    @Transactional
    public TimesheetResponseDto create(String employeeId, TimesheetDto dto) {
        String status = dto.getStatus() != null ? dto.getStatus() : "DRAFT";
        Timesheet ts = Timesheet.builder()
                .employeeId(employeeId)
                .managerId(dto.getManagerId())
                .workingDate(dto.getWorkingDate())
                .workingHours(dto.getWorkingHours())
                .modules(dto.getModules())
                .description(dto.getDescription())
                .status(status)
                .build();
        Timesheet saved = timesheetRepo.save(ts);
        if ("SUBMITTED".equals(saved.getStatus()) && saved.getManagerId() != null) {
            notificationService.createTimesheetNotification(employeeId, saved.getWorkingDate());
        }
        return toResponse(saved);
    }

    @Transactional
    public TimesheetResponseDto update(String employeeId, Long id, TimesheetDto dto) {
        Timesheet ts = timesheetRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Timesheet not found"));
        if (!ts.getEmployeeId().equals(employeeId)) throw new RuntimeException("Forbidden");
        if (!"DRAFT".equals(ts.getStatus()) && !"REJECTED".equals(ts.getStatus()))
            throw new RuntimeException("Only DRAFT or REJECTED timesheets can be edited");

        String newStatus = dto.getStatus() != null ? dto.getStatus() : ts.getStatus();
        ts.setWorkingDate(dto.getWorkingDate());
        ts.setWorkingHours(dto.getWorkingHours());
        ts.setModules(dto.getModules());
        ts.setManagerId(dto.getManagerId());
        ts.setDescription(dto.getDescription());
        ts.setStatus(newStatus);
        if ("SUBMITTED".equals(newStatus)) ts.setRejectReason(null);

        Timesheet saved = timesheetRepo.save(ts);
        if ("SUBMITTED".equals(saved.getStatus()) && saved.getManagerId() != null) {
            notificationService.createTimesheetNotification(employeeId, saved.getWorkingDate());
        }
        return toResponse(saved);
    }

    @Transactional
    public void delete(String employeeId, Long id) {
        Timesheet ts = timesheetRepo.findById(id)
                .orElseThrow(() -> new RuntimeException("Timesheet not found"));
        if (!ts.getEmployeeId().equals(employeeId)) throw new RuntimeException("Forbidden");
        timesheetRepo.delete(ts);
    }

    public List<TimesheetResponseDto> getMyTimesheets(String employeeId) {
        return timesheetRepo.findByEmployeeIdOrderByWorkingDateDesc(employeeId)
                .stream().map(this::toResponse).toList();
    }

    public List<TimesheetResponseDto> getTeamTimesheets(String managerId) {
        return timesheetRepo.findByManagerIdContainingOrderByWorkingDateDesc(managerId)
                .stream().map(this::toResponse).toList();
    }

    @Transactional
    public TimesheetResponseDto approve(Long id, String managerId) {
        Timesheet ts = timesheetRepo.findById(id).orElseThrow();
        if (ts.getManagerId() == null || !Arrays.asList(ts.getManagerId().split(",")).stream().map(String::trim).anyMatch(managerId::equals)) throw new RuntimeException("Forbidden");
        if (!"SUBMITTED".equals(ts.getStatus())) throw new RuntimeException("Only SUBMITTED timesheets can be approved");
        ts.setStatus("APPROVED");
        return toResponse(timesheetRepo.save(ts));
    }

    @Transactional
    public TimesheetResponseDto reject(Long id, String managerId, String reason) {
        Timesheet ts = timesheetRepo.findById(id).orElseThrow();
        if (ts.getManagerId() == null || !Arrays.asList(ts.getManagerId().split(",")).stream().map(String::trim).anyMatch(managerId::equals)) throw new RuntimeException("Forbidden");
        if (!"SUBMITTED".equals(ts.getStatus())) throw new RuntimeException("Only SUBMITTED timesheets can be rejected");
        ts.setStatus("REJECTED");
        ts.setRejectReason(reason);
        return toResponse(timesheetRepo.save(ts));
    }

    public List<TimesheetModule> getAllModules() {
        return moduleRepo.findAllByOrderByModuleNameAsc();
    }

    @Transactional
    public TimesheetModule addModule(String moduleName, String createdBy) {
        if (moduleRepo.existsByModuleNameIgnoreCase(moduleName.trim()))
            throw new RuntimeException("Module already exists");
        return moduleRepo.save(TimesheetModule.builder()
                .moduleName(moduleName.trim())
                .createdBy(createdBy)
                .build());
    }

    @Transactional
    public void deleteModule(Long id) {
        moduleRepo.deleteById(id);
    }

    // Runs every day at 2:00 AM — deletes timesheets older than 6 months
    @Scheduled(cron = "0 0 2 * * ?")
    @Transactional
    public void cleanupOldTimesheets() {
        LocalDate cutoff = LocalDate.now().minusMonths(6);
        int deleted = timesheetRepo.deleteByWorkingDateBefore(cutoff);
        if (deleted > 0) {
            System.out.printf("[Timesheet Cleanup] Deleted %d records older than %s%n", deleted, cutoff);
        }
    }

    private TimesheetResponseDto toResponse(Timesheet ts) {
        TimesheetResponseDto dto = new TimesheetResponseDto();
        dto.setId(ts.getId());
        dto.setEmployeeId(ts.getEmployeeId());
        dto.setManagerId(ts.getManagerId());
        dto.setWorkingDate(ts.getWorkingDate());
        dto.setWorkingHours(ts.getWorkingHours());
        dto.setModules(ts.getModules());
        dto.setDescription(ts.getDescription());
        dto.setStatus(ts.getStatus());
        dto.setRejectReason(ts.getRejectReason());
        dto.setCreatedAt(ts.getCreatedAt());
        dto.setUpdatedAt(ts.getUpdatedAt());
        employeeRepo.findById(ts.getEmployeeId()).ifPresent(e -> dto.setEmployeeName(e.getName()));
        if (ts.getManagerId() != null) {
            String names = Arrays.stream(ts.getManagerId().split(","))
                .map(String::trim)
                .map(id -> employeeRepo.findById(id).map(e -> e.getName()).orElse(id))
                .collect(Collectors.joining(", "));
            dto.setManagerName(names);
        }
        return dto;
    }
}
