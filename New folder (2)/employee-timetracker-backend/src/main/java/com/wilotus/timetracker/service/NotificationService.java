package com.wilotus.timetracker.service;

import com.wilotus.timetracker.entity.Notification;
import com.wilotus.timetracker.repository.EmployeeRepository;
import com.wilotus.timetracker.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepo;
    private final EmployeeRepository employeeRepo;

    @Transactional
    public void createMissPunchNotification(String employeeId, long outsideMs) {
        // Avoid duplicate unread miss-punch notifications
        if (notificationRepo.existsByEmployeeIdAndTypeAndReadFalse(employeeId, "MISS_PUNCH")) return;

        String name = employeeRepo.findById(employeeId)
                .map(e -> e.getName()).orElse(employeeId);

        long hours   = outsideMs / 3_600_000;
        long minutes = (outsideMs % 3_600_000) / 60_000;

        Notification n = Notification.builder()
                .type("MISS_PUNCH")
                .employeeId(employeeId)
                .employeeName(name)
                .message(String.format("%s has been outside for %dh %dm — possible miss punch", name, hours, minutes))
                .read(false)
                .build();
        notificationRepo.save(n);
    }

@Transactional
    public void createEarlyLogoffNotification(String employeeId, long workMs) {
        if (notificationRepo.existsByEmployeeIdAndTypeAndReadFalse(employeeId, "EARLY_LOGOFF")) return;

        String name  = employeeRepo.findById(employeeId).map(e -> e.getName()).orElse(employeeId);
        long hours   = workMs / 3_600_000;
        long minutes = (workMs % 3_600_000) / 60_000;

        Notification n = Notification.builder()
                .type("EARLY_LOGOFF")
                .employeeId(employeeId)
                .employeeName(name)
                .message(String.format("%s left early — %dh %dm worked (target: 9h 30m)", name, hours, minutes))
                .read(false)
                .build();
        notificationRepo.save(n);
    }

    public List<Notification> getAll() {
        return notificationRepo.findAllByOrderByCreatedAtDesc();
    }

    public long getUnreadCount() {
        return notificationRepo.countByReadFalse();
    }

    @Transactional
    public void markAllRead() {
        notificationRepo.markAllRead();
    }

    @Transactional
    public void markOneRead(Long id) {
        notificationRepo.findById(id).ifPresent(n -> {
            n.setRead(true);
            notificationRepo.save(n);
        });
    }

    @Transactional
    public void markAllReadForEmployee(String employeeId) {
        notificationRepo.markAllReadForEmployee(employeeId);
    }

    @Transactional
    public void deleteAllResolved() {
        notificationRepo.deleteAllResolved();
    }

    @Transactional
    public void deleteAll() {
        notificationRepo.deleteAllNotifications();
    }

    @Transactional
    public void createTimesheetNotification(String employeeId, LocalDate workingDate) {
        String name = employeeRepo.findById(employeeId)
                .map(e -> e.getName()).orElse(employeeId);
        Notification n = Notification.builder()
                .type("TIMESHEET_SUBMITTED")
                .employeeId(employeeId)
                .employeeName(name)
                .message(String.format("%s submitted a timesheet for %s", name, workingDate))
                .read(false)
                .build();
        notificationRepo.save(n);
    }
}
