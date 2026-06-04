package com.wilotus.timetracker.controller;

import com.wilotus.timetracker.dto.PunchRequest;
import com.wilotus.timetracker.entity.Device;
import com.wilotus.timetracker.entity.Employee;
import com.wilotus.timetracker.repository.AttendanceRawRepository;
import com.wilotus.timetracker.repository.DeviceRepository;
import com.wilotus.timetracker.repository.EmployeeRepository;
import com.wilotus.timetracker.service.AttendanceProcessingService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

/**
 * Implements the ZKTeco ADMS (Attendance Data Management System) push protocol.
 *
 * Device configuration (on ZKTeco device settings → Communication → ADMS/Cloud):
 *   Enable ADMS  : ON
 *   Server Addr  : http://<this-server-ip>:8080
 *   (path /iclock is automatically appended by the device firmware)
 *
 * Flow:
 *   1. Device sends GET /iclock/cdata?SN=xxx  (handshake every ~30s)
 *   2. Device sends POST /iclock/cdata?SN=xxx&table=ATTLOG  (real-time punch)
 *   3. Device sends GET /iclock/getrequest?SN=xxx  (polls for commands)
 */
@RestController
@RequestMapping("/iclock")
@RequiredArgsConstructor
@Slf4j
public class BiometricPushController {

    private static final DateTimeFormatter DT_FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final AttendanceProcessingService processingService;
    private final EmployeeRepository          employeeRepo;
    private final DeviceRepository            deviceRepo;
    private final AttendanceRawRepository     rawRepo;

    // ── 1. Device handshake / heartbeat (GET /iclock/cdata or /iclock/cdata.aspx) ──
    @GetMapping(value = {"/cdata", "/cdata.aspx"}, produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> handshake(
            @RequestParam(required = false)              String SN,
            @RequestParam(required = false)              String options,
            @RequestParam(required = false)              String pushver,
            @RequestParam(required = false)              String time,
            HttpServletRequest request) {

        String remoteIp = request.getRemoteAddr();
        String sn = SN != null ? SN : remoteIp;
        log.info("ZKTeco/eSSL handshake — SN={}, IP={}", sn, remoteIp);
        markDeviceOnline(sn, remoteIp);

        // Stamp: epoch-seconds of last punch in DB.
        // Device will only push records newer than this timestamp.
        long stamp = rawRepo.findMaxPunchTimeEpoch();

        // Tell the device: push attendance logs in real-time (Realtime=1)
        String body =
                "GET OPTION FROM: " + sn + "\r\n" +
                "Stamp=" + stamp + "\r\n" +
                "ATTLOGStamp=None\r\n" +
                "OPERLOGStamp=9999\r\n" +
                "ATTPHOTOStamp=None\r\n" +
                "ErrorDelay=30\r\n" +
                "Delay=10\r\n" +
                "TransTimes=00:00;14:05\r\n" +
                "TransInterval=1\r\n" +
                "TransFlag=1111000000\r\n" +
                "Realtime=1\r\n" +
                "Encrypt=None\r\n" +
                "ServerVer=2.4.1\r\n" +
                "PushProtVer=2.4.1\r\n";

        return ResponseEntity.ok(body);
    }

    // ── 2. Receive attendance records (POST /iclock/cdata or /iclock/cdata.aspx) ──
    @PostMapping(value = {"/cdata", "/cdata.aspx"},
                 consumes = MediaType.ALL_VALUE,
                 produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> receiveAttendance(
            @RequestParam(required = false)              String SN,
            @RequestParam(name = "table",  required = false) String table,
            @RequestParam(name = "Stamp",  required = false) String stamp,
            @RequestBody(required = false) String body,
            HttpServletRequest request) {

        String sn = SN != null ? SN : request.getRemoteAddr();
        markDeviceOnline(sn, request.getRemoteAddr());
        log.info("ADMS push — SN={} table={}", sn, table);
        if (body != null) log.info("ADMS body:\n{}", body);

        if (body == null || body.isBlank()) return ResponseEntity.ok("OK: 0");

        // Accept both ATTLOG table push and inline body (some devices skip the table param)
        if (table != null && !table.isBlank() && !"ATTLOG".equalsIgnoreCase(table)) {
            log.debug("Non-ATTLOG push from {}: table={}", sn, table);
            return ResponseEntity.ok("OK: 0");
        }

        int accepted = 0;
        for (String line : body.split("\\r?\\n")) {
            line = line.trim();
            if (line.isEmpty()) continue;

            // Some devices prefix with "ATTLOG:" (colon, no tab) — strip it
            if (line.startsWith("ATTLOG:")) line = line.substring(7).trim();
            // Skip non-data lines
            if (line.startsWith("SN=") || line.startsWith("GET ") || line.equalsIgnoreCase("OK")) continue;

            String[] p = line.split("\t");

            // Two possible formats:
            // Format A (ZKTeco ADMS): ATTLOG\t<Pin>\t<Time>\t<Status>\t...  (p[0]="ATTLOG")
            // Format B (eSSL/older):  <Pin>\t<Time>\t<Status>\t...           (p[0]=employee code)
            int offset = 0;
            if (p.length > 0 && "ATTLOG".equalsIgnoreCase(p[0].trim())) {
                offset = 1; // skip the "ATTLOG" label field
            }

            if (p.length < offset + 3) continue;

            try {
                String raw        = p[offset].trim();
                String dateTime   = p[offset + 1].trim();
                int    inOutState = Integer.parseInt(p[offset + 2].trim());

                // ZKTeco InOutState: 0=Check-In, 1=Check-Out, 4=Break-Out, 5=Break-In
                int punchState = (inOutState == 1 || inOutState == 3 || inOutState == 5) ? 1 : 0;

                Optional<Employee> emp = resolveEmployee(raw);
                if (emp.isEmpty()) {
                    log.warn("No employee for biometric code '{}' — set biometric_id in wt_employees", raw);
                    continue;
                }

                LocalDateTime punchTime = LocalDateTime.parse(dateTime, DT_FMT);

                PunchRequest req = new PunchRequest();
                req.setEmployeeId(emp.get().getId());
                req.setPunchTime(punchTime);
                req.setPunchState(punchState);
                req.setDeviceId(sn);

                processingService.processPunch(req);
                accepted++;
                log.info("Punch OK — emp={} bioCd={} state={} time={}", emp.get().getId(), raw, punchState, punchTime);

            } catch (Exception e) {
                log.error("Failed to process line '{}': {}", line, e.getMessage());
            }
        }

        log.info("ADMS push processed: {} punches accepted", accepted);
        return ResponseEntity.ok("OK: " + accepted);
    }

    // ── 3. Command poll ────────────────────────────────────────────────────
    @GetMapping(value = {"/getrequest", "/getrequest.aspx"}, produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> getRequest(
            @RequestParam(required = false) String SN,
            HttpServletRequest request) {
        log.debug("getrequest SN={}", SN);
        return ResponseEntity.ok("OK");
    }

    // ── 4. Command acknowledgment ──────────────────────────────────────────
    @PostMapping(value = {"/devicecmd", "/devicecmd.aspx"}, produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> deviceCmd(
            @RequestParam(required = false) String SN,
            @RequestBody(required = false) String body) {
        log.debug("devicecmd SN={}: {}", SN, body);
        return ResponseEntity.ok("OK");
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    /**
     * Resolve ZKTeco enrollment code → Employee using three strategies:
     *  1. Direct match on employee.id        (e.g. device code "EMP001")
     *  2. Match on employee.biometricId      (e.g. device code "1" → biometricId="1")
     *  3. Numeric → zero-padded suffix match (e.g. device code "3" → id "EMP003")
     */
    private Optional<Employee> resolveEmployee(String code) {
        // Strategy 1: exact ID match
        Optional<Employee> byId = employeeRepo.findById(code);
        if (byId.isPresent()) return byId;

        // Strategy 2: biometric_id column match
        Optional<Employee> byBio = employeeRepo.findByBiometricId(code);
        if (byBio.isPresent()) return byBio;

        // Strategy 3: numeric → padded suffix (covers EMP001, MGR001, ADM001 prefixes)
        try {
            int num = Integer.parseInt(code);
            String padded = String.format("%03d", num);
            return employeeRepo.findAll().stream()
                    .filter(e -> e.getId().endsWith(padded))
                    .findFirst();
        } catch (NumberFormatException ignored) {}

        return Optional.empty();
    }

    /** Mark device as online and update lastSeen. Registers new device if unknown. */
    private void markDeviceOnline(String sn, String remoteIp) {
        // Try by SN first, then by IP
        Optional<Device> found = deviceRepo.findBySerialNumber(sn);
        if (found.isEmpty()) found = deviceRepo.findByIpAddress(remoteIp);

        if (found.isPresent()) {
            Device d = found.get();
            d.setSerialNumber(sn);
            d.setConnected(true);
            d.setLastSeen(LocalDateTime.now());
            deviceRepo.save(d);
        } else {
            // Auto-register unknown device so it shows up in Device Management
            Device d = Device.builder()
                    .name("ZKTeco Device (" + remoteIp + ")")
                    .ipAddress(remoteIp)
                    .serialNumber(sn)
                    .port(4370)
                    .connected(true)
                    .active(true)
                    .lastSeen(LocalDateTime.now())
                    .build();
            deviceRepo.save(d);
            log.info("Auto-registered new device — SN={}, IP={}", sn, remoteIp);
        }
    }
}
