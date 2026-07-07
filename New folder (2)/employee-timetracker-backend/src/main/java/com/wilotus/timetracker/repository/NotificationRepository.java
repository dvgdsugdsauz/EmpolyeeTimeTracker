package com.wilotus.timetracker.repository;

import com.wilotus.timetracker.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByReadFalseOrderByCreatedAtDesc();
    List<Notification> findAllByOrderByCreatedAtDesc();
    long countByReadFalse();

    @Modifying
    @Query("UPDATE Notification n SET n.read = true WHERE n.read = false")
    void markAllRead();

    boolean existsByEmployeeIdAndTypeAndReadFalse(String employeeId, String type);

    @Modifying
    @Query("UPDATE Notification n SET n.read = true WHERE n.employeeId = :employeeId AND n.read = false")
    void markAllReadForEmployee(String employeeId);

    @Modifying
    @Query("DELETE FROM Notification n WHERE n.read = true")
    void deleteAllResolved();

    @Modifying
    @Query("DELETE FROM Notification n")
    void deleteAllNotifications();
}
