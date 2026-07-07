package com.wilotus.timetracker.controller;

import com.wilotus.timetracker.entity.Device;
import com.wilotus.timetracker.repository.DeviceRepository;
import com.wilotus.timetracker.service.ZktecoTcpService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/devices")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','HR')")
public class DeviceController {

    private final DeviceRepository deviceRepo;
    private final ZktecoTcpService zktecoService;

    @GetMapping
    public ResponseEntity<List<Device>> getAll() {
        return ResponseEntity.ok(deviceRepo.findAll());
    }

    @PostMapping
    public ResponseEntity<Device> create(@RequestBody Device device) {
        device.setId(null);
        device.setConnected(false);
        device.setActive(false);
        return ResponseEntity.ok(deviceRepo.save(device));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Long id, @RequestBody Device body) {
        return deviceRepo.findById(id).map(d -> {
            d.setName(body.getName());
            d.setIpAddress(body.getIpAddress());
            d.setPort(body.getPort());
            d.setLocation(body.getLocation());
            d.setPollIntervalSeconds(body.getPollIntervalSeconds());
            return ResponseEntity.ok(deviceRepo.save(d));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/connect")
    public ResponseEntity<?> connect(@PathVariable Long id) {
        return deviceRepo.findById(id).map(d -> {
            d.setActive(true);
            d.setConnected(true);
            d.setLastSeen(LocalDateTime.now());
            deviceRepo.save(d);
            return ResponseEntity.ok(Map.of("status", "connected"));
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/{id}/disconnect")
    public ResponseEntity<?> disconnect(@PathVariable Long id) {
        return deviceRepo.findById(id).map(d -> {
            d.setActive(false);
            d.setConnected(false);
            deviceRepo.save(d);
            return ResponseEntity.ok(Map.of("status", "disconnected"));
        }).orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Long id) {
        deviceRepo.findById(id).ifPresent(deviceRepo::delete);
        return ResponseEntity.ok(Map.of("status", "removed"));
    }

    @PostMapping("/{id}/toggle")
    public ResponseEntity<?> toggle(@PathVariable Long id) {
        return deviceRepo.findById(id).map(d -> {
            boolean nowConnected = !d.isConnected();
            d.setConnected(nowConnected);
            d.setActive(nowConnected);
            if (nowConnected) d.setLastSeen(LocalDateTime.now());
            deviceRepo.save(d);
            return ResponseEntity.ok(Map.of("connected", d.isConnected()));
        }).orElse(ResponseEntity.notFound().build());
    }

    // Called by Java middleware to update device heartbeat — allowed in SecurityConfig without JWT
    @PostMapping("/{id}/heartbeat")
    public ResponseEntity<?> heartbeat(@PathVariable Long id) {
        deviceRepo.findById(id).ifPresent(d -> {
            d.setConnected(true);
            d.setLastSeen(LocalDateTime.now());
            deviceRepo.save(d);
        });
        return ResponseEntity.ok(Map.of("ok", true));
    }

    // Fetch attendance records for a specific enrollment number directly from device
    @PostMapping("/fetch-employee/{enrollNo}")
    public ResponseEntity<?> fetchEmployee(@PathVariable String enrollNo) {
        return ResponseEntity.ok(zktecoService.fetchAndSaveForEmployee(enrollNo));
    }

    // Push ADMS server address into device via UDP — no physical access needed
    @PostMapping("/configure-adms")
    public ResponseEntity<?> configureAdms(
            @RequestParam(defaultValue = "192.168.1.97") String serverIp,
            @RequestParam(defaultValue = "8080") int serverPort) {
        String result = zktecoService.configureAdms(serverIp, serverPort);
        return ResponseEntity.ok(Map.of("result", result));
    }
}
