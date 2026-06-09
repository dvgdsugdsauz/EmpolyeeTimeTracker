package com.wilotus.timetracker.service;

import com.wilotus.timetracker.dto.PunchRequest;
import com.wilotus.timetracker.entity.Device;
import com.wilotus.timetracker.repository.DeviceRepository;
import com.wilotus.timetracker.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Connects to ZKTeco / eSSL biometric devices via TCP port 4370
 * and pulls attendance punches every N seconds.
 *
 * Protocol: ZKTeco SDK over TCP.
 * Each packet is prefixed with an 8-byte TCP header:
 *   Bytes 0-3: 0x50 0x50 0x82 0x7D  (PREAMBLE)
 *   Bytes 4-7: inner packet length   (uint32 little-endian)
 * The inner packet is the standard 8-byte ZKTeco header + optional data.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ZktecoTcpService {

    private static final byte[] PREAMBLE    = {0x50, 0x50, (byte)0x82, 0x7D};
    private static final int CMD_CONNECT    = 1000;
    private static final int CMD_AUTH       = 1002;
    private static final int CMD_EXIT       = 3000;
    private static final int CMD_ACK_OK     = 2000;
    private static final int CMD_ACK_UNAUTH = 2005;
    private static final int CMD_PREPARE_DATA = 1500;
    private static final int CMD_DATA         = 1501;
    private static final int CMD_DATA_RDY     = 1502;
    private static final int CMD_ATTLOG_RRQ   = 0x0BD7; // 3031 — modern firmware
    private static final int CMD_ATTLOG_LEGACY = 11;     // older firmware fallback

    private static final int RECORD_BYTES = 40;
    private static final int TIMEOUT_MS   = 10_000;

    private final DeviceRepository            deviceRepo;
    private final AttendanceProcessingService processingService;
    private final EmployeeRepository          employeeRepo;
    private final com.wilotus.timetracker.repository.AttendanceRawRepository rawRepo;

    @Value("${app.biometric.device-password:}")
    private String devicePassword;

    private final Map<Long, LocalDateTime> lastSync = new ConcurrentHashMap<>();

    // ── Scheduled poll: every 30 min, 8 AM – 8 PM only ──────────────────
    // Cron: seconds=0, minute=0 and 30, hours 8..19 (8:00, 8:30 … 19:30, last run before 20:00)

    @Scheduled(cron = "0 0/30 8-19 * * *")
    public void pollAllDevices() {
        log.info("Biometric sync started — {}", java.time.LocalTime.now());
        deviceRepo.findByActiveTrue().forEach(device -> {
            try {
                pullFromDevice(device);
            } catch (Exception e) {
                log.warn("TCP poll failed — {} ({}:{}): {}",
                        device.getName(), device.getIpAddress(), device.getPort(), e.getMessage());
                device.setConnected(false);
                deviceRepo.save(device);
            }
        });
        log.info("Biometric sync done — {}", java.time.LocalTime.now());
    }

    // ── Per-device pull via TCP ───────────────────────────────────────────

    private void pullFromDevice(Device device) throws Exception {
        String ip   = device.getIpAddress();
        int    port = device.getPort() > 0 ? device.getPort() : 4370;

        try (Socket tcp = new Socket()) {
            tcp.connect(new InetSocketAddress(ip, port), TIMEOUT_MS);
            tcp.setSoTimeout(TIMEOUT_MS);
            OutputStream out = tcp.getOutputStream();
            InputStream  in  = tcp.getInputStream();

            // Step 1: CMD_CONNECT
            send(out, buildPacket(CMD_CONNECT, new byte[0], 0, 0));
            byte[] r1    = recv(in);
            int    cmd1  = u16le(r1, 0);
            int    sessionId = u16le(r1, 4);
            int    replyId   = u16le(r1, 6);

            // Step 2: Authenticate if required
            if (cmd1 == CMD_ACK_UNAUTH) {
                byte[] pw = (devicePassword != null && !devicePassword.isBlank())
                        ? devicePassword.getBytes(StandardCharsets.UTF_8)
                        : new byte[0];
                send(out, buildPacket(CMD_AUTH, pw, sessionId, ++replyId));
                byte[] r2 = recv(in);
                if (u16le(r2, 0) != CMD_ACK_OK)
                    throw new Exception("Authentication failed — check app.biometric.device-password");
                replyId = u16le(r2, 6);
            } else if (cmd1 != CMD_ACK_OK) {
                throw new Exception("CMD_CONNECT rejected: " + cmd1);
            }

            device.setConnected(true);
            device.setLastSeen(LocalDateTime.now());
            deviceRepo.save(device);
            log.info("Connected to {} ({}) via TCP — session={}", device.getName(), ip, sessionId);

            // Step 3: Pull attendance logs
            List<byte[]> records = fetchAttendanceLogs(out, in, sessionId, ++replyId);
            log.info("TCP pull — {} — {} raw records from device", device.getName(), records.size());

            // Use last punch time from DB so restart doesn't re-import old records
            LocalDateTime since = lastSync.getOrDefault(device.getId(), null);
            if (since == null) {
                since = rawRepo.findTopByOrderByPunchTimeDesc()
                        .map(r -> r.getPunchTime().minusMinutes(5))
                        .orElse(LocalDateTime.now().minusDays(1));
            }

            // Group new records by employee, sorted by time
            Map<String, List<AttRec>> byEnroll = new java.util.LinkedHashMap<>();
            for (byte[] rec : records) {
                AttRec ar = parseRecord(rec);
                if (ar == null || ar.time.isBefore(since)) continue;
                byEnroll.computeIfAbsent(ar.enrollNo, k -> new ArrayList<>()).add(ar);
            }
            byEnroll.values().forEach(list -> list.sort(java.util.Comparator.comparing(a -> a.time)));

            int saved = 0, skipped = 0;
            for (Map.Entry<String, List<AttRec>> entry : byEnroll.entrySet()) {
                String enrollNo = entry.getKey();
                Optional<String> empId = resolveEmployeeId(enrollNo);
                if (empId.isEmpty()) {
                    log.warn("  No employee match for enrollNo='{}' — update biometric_id in wt_employees", enrollNo);
                    continue;
                }
                String eid = empId.get();

                // Detect the correct in/out state: alternate starting from the opposite of last DB punch
                var lastPunch = rawRepo.findTopByEmployeeIdAndPunchStateOrderByPunchTimeDesc(eid, 0);
                var lastPunchOut = rawRepo.findTopByEmployeeIdAndPunchStateOrderByPunchTimeDesc(eid, 1);
                int nextState;
                if (lastPunch.isEmpty() && lastPunchOut.isEmpty()) {
                    nextState = 0; // no history → start with IN
                } else if (lastPunch.isEmpty()) {
                    nextState = 0; // only OUTs in history → next is IN
                } else if (lastPunchOut.isEmpty()) {
                    nextState = 1; // only INs in history → next is OUT
                } else {
                    // last punch overall: if it was IN → next is OUT, and vice versa
                    boolean lastWasIn = lastPunch.get().getPunchTime().isAfter(lastPunchOut.get().getPunchTime());
                    nextState = lastWasIn ? 1 : 0;
                }

                for (AttRec ar : entry.getValue()) {
                    log.debug("  enrollNo='{}' time={} autoState={}", enrollNo, ar.time, nextState);
                    PunchRequest req = new PunchRequest();
                    req.setEmployeeId(eid);
                    req.setPunchTime(ar.time);
                    req.setPunchState(nextState);
                    req.setDeviceId(ip);
                    try {
                        processingService.processPunch(req);
                        saved++;
                        nextState = 1 - nextState; // alternate: IN→OUT→IN→OUT
                    } catch (Exception e) {
                        log.debug("processPunch skip: {}", e.getMessage());
                        // don't flip state on duplicates
                    }
                }
            }
            skipped = records.size() - saved;

            lastSync.put(device.getId(), LocalDateTime.now());
            log.info("TCP pull done — {} — saved={} skipped(old)={}", device.getName(), saved, skipped);

            // Step 4: Disconnect
            try { send(out, buildPacket(CMD_EXIT, new byte[0], sessionId, ++replyId)); } catch (Exception ignored) {}
        }
    }

    // ── Fetch attendance logs ─────────────────────────────────────────────

    private List<byte[]> fetchAttendanceLogs(OutputStream out, InputStream in,
                                              int sessionId, int replyId) throws Exception {
        // Try modern command (3031) first
        send(out, buildPacket(CMD_ATTLOG_RRQ, new byte[0], sessionId, replyId));
        byte[] resp = recv(in);
        int    cmd  = u16le(resp, 0);
        log.info("  ATTLOG 0x0BD7 response: cmd={} length={}", cmd, resp.length);

        // If modern command rejected, try legacy cmd=11
        if (cmd != CMD_ACK_OK && cmd != CMD_PREPARE_DATA) {
            log.info("  Retrying with legacy CMD_ATTLOG_RRQ=11");
            send(out, buildPacket(CMD_ATTLOG_LEGACY, new byte[0], sessionId, ++replyId));
            resp = recv(in);
            cmd  = u16le(resp, 0);
            log.info("  ATTLOG legacy (11) response: cmd={} length={}", cmd, resp.length);
        }

        if (cmd == CMD_ACK_OK) {
            if (resp.length <= 8) return Collections.emptyList();
            return splitRecords(resp, 8, resp.length - 8);
        }

        if (cmd == CMD_PREPARE_DATA) {
            return readChunkedData(in);
        }

        // Non-standard: ACK and read chunks
        log.info("  Non-standard cmd={} — sending ACK and reading data", cmd);
        send(out, buildPacket(CMD_ACK_OK, new byte[0], sessionId, replyId + 1));
        return readChunkedData(in);
    }

    private List<byte[]> readChunkedData(InputStream in) throws Exception {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        int chunks = 0;
        while (true) {
            byte[] chunk;
            try { chunk = recv(in); } catch (Exception e) { break; }
            if (chunk == null || chunk.length < 2) break;
            int chunkCmd = u16le(chunk, 0);
            log.debug("  chunk cmd={} len={}", chunkCmd, chunk.length);
            if (chunkCmd == CMD_DATA_RDY || chunkCmd == CMD_ACK_OK) break;
            if (chunkCmd == CMD_DATA && chunk.length > 8) {
                buf.write(chunk, 8, chunk.length - 8);
                chunks++;
            }
            if (chunks > 500) break;
        }
        byte[] all = buf.toByteArray();
        log.info("  Total data: {} bytes ({} potential records)", all.length, all.length / RECORD_BYTES);
        return splitRecords(all, 0, all.length);
    }

    // ── Public: fetch + save attendance for a specific enrollment number ──

    public Map<String, Object> fetchAndSaveForEmployee(String enrollNo) {
        Device device = deviceRepo.findByActiveTrue().stream().findFirst().orElse(null);
        if (device == null) return Map.of("error", "No active device");

        String ip   = device.getIpAddress();
        int    port = device.getPort() > 0 ? device.getPort() : 4370;

        try (Socket tcp = new Socket()) {
            tcp.connect(new InetSocketAddress(ip, port), TIMEOUT_MS);
            tcp.setSoTimeout(TIMEOUT_MS);
            OutputStream out = tcp.getOutputStream();
            InputStream  in  = tcp.getInputStream();

            send(out, buildPacket(CMD_CONNECT, new byte[0], 0, 0));
            byte[] r1 = recv(in);
            int    cmd1 = u16le(r1, 0);
            int    sessionId = u16le(r1, 4);
            int    replyId   = u16le(r1, 6);

            if (cmd1 == CMD_ACK_UNAUTH) {
                byte[] pw = (devicePassword != null && !devicePassword.isBlank())
                        ? devicePassword.getBytes(StandardCharsets.UTF_8) : new byte[0];
                send(out, buildPacket(CMD_AUTH, pw, sessionId, ++replyId));
                byte[] r2 = recv(in);
                if (u16le(r2, 0) != CMD_ACK_OK) return Map.of("error", "Auth failed");
                replyId = u16le(r2, 6);
            } else if (cmd1 != CMD_ACK_OK) {
                return Map.of("error", "Connect rejected: cmd=" + cmd1);
            }

            log.info("fetchForEmployee enrollNo='{}' — session={}", enrollNo, sessionId);
            List<byte[]> records = fetchAttendanceLogs(out, in, sessionId, ++replyId);

            Optional<String> empId = resolveEmployeeId(enrollNo);
            int saved = 0;
            List<String> punches = new ArrayList<>();

            for (byte[] rec : records) {
                AttRec ar = parseRecord(rec);
                if (ar == null) continue;
                // If enrollNo filter specified, only process matching records
                if (!enrollNo.isBlank() && !ar.enrollNo.equals(enrollNo)) continue;
                punches.add(ar.time + " state=" + ar.inOut);
                if (empId.isPresent()) {
                    PunchRequest req = new PunchRequest();
                    req.setEmployeeId(empId.get());
                    req.setPunchTime(ar.time);
                    req.setPunchState(ar.inOut == 0 ? 0 : 1);
                    req.setDeviceId(ip);
                    try { processingService.processPunch(req); saved++; }
                    catch (Exception e) { log.debug("processPunch: {}", e.getMessage()); }
                }
            }

            try { send(out, buildPacket(CMD_EXIT, new byte[0], sessionId, 99)); } catch (Exception ignored) {}
            return Map.of(
                "enrollNo", enrollNo,
                "employeeId", empId.orElse("NOT_MATCHED"),
                "totalRecords", punches.size(),
                "savedPunches", saved,
                "punches", punches
            );
        } catch (Exception e) {
            log.error("fetchForEmployee error: {}", e.getMessage());
            return Map.of("error", e.getMessage());
        }
    }

    // ── Parse 40-byte attendance record ───────────────────────────────────

    private List<byte[]> splitRecords(byte[] data, int offset, int length) {
        List<byte[]> list = new ArrayList<>();
        int end = offset + length;
        for (int i = offset; i + RECORD_BYTES <= end; i += RECORD_BYTES)
            list.add(Arrays.copyOfRange(data, i, i + RECORD_BYTES));
        return list;
    }

    private AttRec parseRecord(byte[] r) {
        try {
            int len = 0;
            while (len < 9 && r[len] != 0) len++;
            String enrollNo = new String(r, 0, len).trim();
            if (enrollNo.isEmpty()) return null;

            int epochSec = u32le(r, 10);
            if (epochSec == 0) return null;

            LocalDateTime time = LocalDateTime.ofInstant(
                    Instant.ofEpochSecond(epochSec & 0xFFFFFFFFL), ZoneId.systemDefault());

            int inOut = r[14] & 0xFF;
            return new AttRec(enrollNo, time, inOut);
        } catch (Exception e) {
            return null;
        }
    }

    // ── Employee lookup ───────────────────────────────────────────────────

    private Optional<String> resolveEmployeeId(String code) {
        if (employeeRepo.existsById(code)) return Optional.of(code);
        var byBio = employeeRepo.findByBiometricId(code);
        if (byBio.isPresent()) return Optional.of(byBio.get().getId());
        try {
            String pad = String.format("%03d", Integer.parseInt(code));
            return employeeRepo.findAll().stream()
                    .filter(e -> e.getId().endsWith(pad))
                    .map(com.wilotus.timetracker.entity.Employee::getId)
                    .findFirst();
        } catch (NumberFormatException ignored) {}
        return Optional.empty();
    }

    // ── ADMS configuration via TCP ────────────────────────────────────────

    private static final int CMD_OPTIONS_WRQ = 13;
    private static final int CMD_RESTART     = 3001;

    public String configureAdms(String serverIp, int serverPort) {
        Device device = deviceRepo.findByActiveTrue().stream().findFirst().orElse(null);
        if (device == null) return "No active device found";

        String ip   = device.getIpAddress();
        int    port = device.getPort() > 0 ? device.getPort() : 4370;

        try (Socket tcp = new Socket()) {
            tcp.connect(new InetSocketAddress(ip, port), TIMEOUT_MS);
            tcp.setSoTimeout(TIMEOUT_MS);
            OutputStream out = tcp.getOutputStream();
            InputStream  in  = tcp.getInputStream();

            send(out, buildPacket(CMD_CONNECT, new byte[0], 0, 0));
            byte[] r1 = recv(in);
            int    cmd1 = u16le(r1, 0);
            int    sessionId = u16le(r1, 4);
            int    replyId   = u16le(r1, 6);

            if (cmd1 == CMD_ACK_UNAUTH) {
                byte[] pw = (devicePassword != null && !devicePassword.isBlank())
                        ? devicePassword.getBytes(StandardCharsets.UTF_8) : new byte[0];
                send(out, buildPacket(CMD_AUTH, pw, sessionId, ++replyId));
                byte[] r2 = recv(in);
                if (u16le(r2, 0) != CMD_ACK_OK) return "Authentication failed";
                replyId = u16le(r2, 6);
            } else if (cmd1 != CMD_ACK_OK) {
                return "Device rejected connect: cmd=" + cmd1;
            }

            String[] optionSets = {
                "CloudServerAddr=" + serverIp + "\tCloudServerPort=" + serverPort,
                "ServerAddr=" + serverIp + "\tServerPort=" + serverPort,
                "ATTLOGStamp=0\tOPERLOGStamp=0",
            };
            for (String opts : optionSets) {
                byte[] optBytes = (opts + "\0").getBytes(StandardCharsets.UTF_8);
                send(out, buildPacket(CMD_OPTIONS_WRQ, optBytes, sessionId, ++replyId));
                try {
                    byte[] wr = recv(in);
                    log.info("configureAdms: wrote '{}' → cmd={}", opts, u16le(wr, 0));
                    replyId = u16le(wr, 6);
                } catch (Exception ignored) {
                    log.info("configureAdms: wrote '{}' → no ACK", opts);
                }
            }

            send(out, buildPacket(CMD_RESTART, new byte[0], sessionId, ++replyId));
            log.info("configureAdms: restart sent to {}", ip);
            return "OK — device restarting, will push to http://" + serverIp + ":" + serverPort;
        } catch (Exception e) {
            log.error("configureAdms failed: {}", e.getMessage());
            return "Error: " + e.getMessage();
        }
    }

    // ── TCP packet builder ─────────────────────────────────────────────────
    // ZKTeco TCP framing: PREAMBLE (4 bytes) + inner length (4 bytes LE) + inner packet

    private byte[] buildPacket(int cmd, byte[] data, int sessionId, int replyId) {
        int innerLen = 8 + data.length;
        byte[] inner = new byte[innerLen];
        putU16le(inner, 0, cmd);
        putU16le(inner, 2, 0);
        putU16le(inner, 4, sessionId);
        putU16le(inner, 6, replyId);
        System.arraycopy(data, 0, inner, 8, data.length);
        putU16le(inner, 2, calcChecksum(inner, 0, innerLen));

        // TCP framing
        byte[] pkt = new byte[8 + innerLen];
        System.arraycopy(PREAMBLE, 0, pkt, 0, 4);
        pkt[4] = (byte)(innerLen & 0xFF);
        pkt[5] = (byte)((innerLen >> 8) & 0xFF);
        pkt[6] = (byte)((innerLen >> 16) & 0xFF);
        pkt[7] = (byte)((innerLen >> 24) & 0xFF);
        System.arraycopy(inner, 0, pkt, 8, innerLen);
        return pkt;
    }

    private int calcChecksum(byte[] buf, int start, int len) {
        int sum = 0;
        for (int i = start; i + 1 < start + len; i += 2)
            sum += (buf[i] & 0xFF) | ((buf[i + 1] & 0xFF) << 8);
        if ((len & 1) != 0) sum += buf[start + len - 1] & 0xFF;
        while ((sum >> 16) != 0) sum = (sum & 0xFFFF) + (sum >> 16);
        return (~sum) & 0xFFFF;
    }

    // ── TCP I/O helpers ────────────────────────────────────────────────────

    private void send(OutputStream out, byte[] pkt) throws Exception {
        out.write(pkt);
        out.flush();
    }

    private byte[] recv(InputStream in) throws Exception {
        // Read 8-byte TCP header: PREAMBLE(4) + length(4)
        byte[] header = readExact(in, 8);
        // Verify preamble
        if (header[0] != PREAMBLE[0] || header[1] != PREAMBLE[1]
                || header[2] != PREAMBLE[2] || header[3] != PREAMBLE[3]) {
            // Might be raw packet without framing — treat header as start of inner packet
            // Read more bytes to get a complete inner packet (at least 8 bytes)
            byte[] rest = readExact(in, Math.max(0, 8 - header.length));
            byte[] combined = new byte[header.length + rest.length];
            System.arraycopy(header, 0, combined, 0, header.length);
            System.arraycopy(rest, 0, combined, header.length, rest.length);
            return combined;
        }
        int innerLen = (header[4] & 0xFF) | ((header[5] & 0xFF) << 8)
                     | ((header[6] & 0xFF) << 16) | ((header[7] & 0xFF) << 24);
        if (innerLen <= 0 || innerLen > 1_048_576) throw new Exception("Invalid inner packet length: " + innerLen);
        return readExact(in, innerLen);
    }

    private byte[] readExact(InputStream in, int n) throws Exception {
        if (n <= 0) return new byte[0];
        byte[] buf = new byte[n];
        int off = 0;
        while (off < n) {
            int read = in.read(buf, off, n - off);
            if (read < 0) throw new EOFException("Connection closed after " + off + " of " + n + " bytes");
            off += read;
        }
        return buf;
    }

    // ── Byte utilities ─────────────────────────────────────────────────────

    private int u16le(byte[] b, int off) {
        return (b[off] & 0xFF) | ((b[off + 1] & 0xFF) << 8);
    }

    private int u32le(byte[] b, int off) {
        return (b[off] & 0xFF) | ((b[off+1] & 0xFF) << 8) |
               ((b[off+2] & 0xFF) << 16) | ((b[off+3] & 0xFF) << 24);
    }

    private void putU16le(byte[] b, int off, int v) {
        b[off]     = (byte)(v & 0xFF);
        b[off + 1] = (byte)((v >> 8) & 0xFF);
    }

    private record AttRec(String enrollNo, LocalDateTime time, int inOut) {}
}
