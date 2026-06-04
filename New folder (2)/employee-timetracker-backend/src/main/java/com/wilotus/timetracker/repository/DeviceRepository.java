package com.wilotus.timetracker.repository;

import com.wilotus.timetracker.entity.Device;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DeviceRepository extends JpaRepository<Device, Long> {
    List<Device> findByActiveTrue();
    List<Device> findByConnectedTrue();
    java.util.Optional<Device> findBySerialNumber(String serialNumber);
    java.util.Optional<Device> findByIpAddress(String ipAddress);
}
