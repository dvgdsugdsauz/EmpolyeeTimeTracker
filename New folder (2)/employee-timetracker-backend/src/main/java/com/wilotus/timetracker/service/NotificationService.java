package com.wilotus.timetracker.service;

import com.wilotus.timetracker.entity.Notification;
import com.wilotus.timetracker.repository.EmployeeRepository;
import com.wilotus.timetracker.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
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
    public void createLateNotification(String employeeId, String lateStatus, LocalDateTime entryTime) {
        if (notificationRepo.existsByEmployeeIdAndTypeAndReadFalse(employeeId, "LATE_ENTRY")) return;

        String name = employeeRepo.findById(employeeId)
                .map(e -> e.getName()).orElse(employeeId);
        String label = "VERY_LATE".equals(lateStatus) ? "Very Late" : "Late";
        String type  = "VERY_LATE".equals(lateStatus) ? "VERY_LATE" : "LATE_ENTRY";

        Notification n = Notification.builder()
                .type(type)
                .employeeId(employeeId)
                .employeeName(name)
                .message(String.format("%s arrived %s at %s",
                        name, label, entryTime.toLocalTime().toString()))
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
}
