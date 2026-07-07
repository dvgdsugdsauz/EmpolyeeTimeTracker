package com.wilotus.timetracker.service;

import com.wilotus.timetracker.entity.Timesheet;
import com.wilotus.timetracker.entity.TimesheetModule;
import com.wilotus.timetracker.repository.TimesheetModuleRepository;
import com.wilotus.timetracker.repository.TimesheetRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
public class TimesheetImportService {

    private final TimesheetRepository timesheetRepo;
    private final TimesheetModuleRepository moduleRepo;

    private static final LocalDate MIN_DATE = LocalDate.of(2026, 1, 1);

    private static final Map<String, String> EMPLOYEE_MAP = Map.ofEntries(
        Map.entry("Gundu Bhargavi Seeta Maha Lakshmi", "10067"),
        Map.entry("Vikas K.", "10041"),
        Map.entry("Vikas K", "10041"),
        Map.entry("Deepika S.", "10155"),
        Map.entry("Deepika S", "10155"),
        Map.entry("Upender V.", "10013"),
        Map.entry("Maheshwari B.", "10046"),
        Map.entry("Sanjana M.", "10165"),
        Map.entry("Abhilash Y.", "10040"),
        Map.entry("Harinath A.", "10145"),
        Map.entry("Sahitya K.", "10144"),
        Map.entry("Venkanna B.", "10045"),
        Map.entry("Premchand M.", "10161"),
        Map.entry("Bhargavi S.", "10083"),
        Map.entry("Navya K", "10089"),
        Map.entry("Navya K.", "10089"),
        Map.entry("Sai A.", "10076"),
        Map.entry("Lalitha R.", "10075"),
        Map.entry("Jayasree R.", "10074"),
        Map.entry("Ramya G.", "10146"),
        Map.entry("Sreelakshmi N.", "10043"),
        Map.entry("Naresh N.", "10169"),
        Map.entry("Naresh N", "10169"),
        Map.entry("Surya P.", "10127"),
        Map.entry("Surya P", "10127"),
        Map.entry("Haritha P.", "10084"),
        Map.entry("Aswanth M.", "10071"),
        Map.entry("Pooja G.", "10172"),
        Map.entry("Susmitha N.", "10081"),
        Map.entry("Vamsidhar S.", "10010"),
        Map.entry("Aravind T.", "10168"),
        Map.entry("Kalyan V.", "10152"),
        Map.entry("Vemana Kalyan", "10152"),
        Map.entry("Ravishankar P.", "10073"),
        Map.entry("Ramu G", "10174"),
        Map.entry("Ramu G.", "10174"),
        Map.entry("Divyashri V.", "10151")
    );

    private static final Map<String, String> MANAGER_MAP = Map.of(
        "Surya P.", "10127",
        "Surya P", "10127",
        "Sharan Surya", "10127",
        "Vignesh J.", "10128",
        "Vignesh J", "10128",
        "Kalyan V.", "10152"
    );

    private static final Map<String, String> STATUS_MAP = Map.of(
        "0", "DRAFT",
        "1", "SUBMITTED",
        "2", "REJECTED",
        "3", "APPROVED"
    );

    @Transactional
    public Map<String, Object> importCsv(MultipartFile file) throws Exception {
        int imported = 0, skippedNoEmp = 0, skippedNoDate = 0,
            skippedNotInDb = 0, skippedOldDate = 0, errors = 0;

        Set<String> allModules = new LinkedHashSet<>();

        List<String[]> dataRows = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(file.getInputStream(), "UTF-8"))) {
            String line;
            boolean firstLine = true;
            while ((line = reader.readLine()) != null) {
                if (firstLine) { firstLine = false; continue; } // skip header
                String[] cols = parseCsvLine(line);
                if (cols.length >= 5) {
                    dataRows.add(cols);
                    String mods = cols.length > 4 ? cols[4].trim() : "";
                    for (String m : parseModules(mods)) allModules.add(m);
                }
            }
        }

        // Upsert modules
        for (String mod : allModules) {
            if (!moduleRepo.existsByModuleNameIgnoreCase(mod)) {
                moduleRepo.save(TimesheetModule.builder()
                        .moduleName(mod).createdBy("10127").build());
            }
        }

        // Import timesheets
        for (String[] cols : dataRows) {
            String empName  = cols[0].trim();
            String mgrName  = cols.length > 1 ? cols[1].trim() : "";
            String dateStr  = cols.length > 2 ? cols[2].trim() : "";
            String hoursStr = cols.length > 3 ? cols[3].trim() : "0";
            String modsStr  = cols.length > 4 ? cols[4].trim() : "";
            String desc     = cols.length > 5 ? cols[5].trim() : "";
            String statusStr = cols.length > 6 ? cols[6].trim() : "3";

            if (empName.isEmpty()) { skippedNoEmp++; continue; }
            if (dateStr.isEmpty())  { skippedNoDate++; continue; }

            LocalDate workingDate = parseDate(dateStr);
            if (workingDate == null) { skippedNoDate++; continue; }
            if (workingDate.isBefore(MIN_DATE)) { skippedOldDate++; continue; }

            String empId = EMPLOYEE_MAP.get(empName);
            if (empId == null) { skippedNotInDb++; continue; }

            String mgrId = MANAGER_MAP.get(mgrName);
            int hours;
            try { hours = (int) Double.parseDouble(hoursStr); } catch (Exception e) { hours = 0; }

            List<String> mods = parseModules(modsStr);
            String modules = mods.isEmpty() ? null : String.join(", ", mods);
            String status = STATUS_MAP.getOrDefault(statusStr, "APPROVED");

            try {
                Timesheet ts = Timesheet.builder()
                        .employeeId(empId).managerId(mgrId)
                        .workingDate(workingDate).workingHours(hours)
                        .modules(modules).description(desc)
                        .status(status).build();
                timesheetRepo.save(ts);
                imported++;
            } catch (Exception e) { errors++; }
        }

        return Map.of(
            "imported", imported,
            "skippedNoEmployee", skippedNoEmp,
            "skippedNoDate", skippedNoDate,
            "skippedOldDate", skippedOldDate,
            "skippedNotInDb", skippedNotInDb,
            "errors", errors,
            "modulesCreated", allModules.size()
        );
    }

    private LocalDate parseDate(String s) {
        try { return LocalDate.parse(s, DateTimeFormatter.ofPattern("M/d/yyyy")); } catch (Exception e1) {
            try { return LocalDate.parse(s); } catch (Exception e2) { return null; }
        }
    }

    private List<String> parseModules(String s) {
        s = s.trim();
        if (s.isEmpty() || s.equals("[]")) return List.of();
        // JSON array format: ["Mod1","Mod2"]
        s = s.replaceAll("^\\[|]$", "");
        List<String> result = new ArrayList<>();
        for (String part : s.split(",")) {
            String m = part.trim().replaceAll("^\"|\"$", "").trim();
            if (!m.isEmpty()) result.add(m);
        }
        return result;
    }

    private String[] parseCsvLine(String line) {
        List<String> cols = new ArrayList<>();
        boolean inQuote = false;
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (inQuote && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    sb.append('"'); i++;
                } else { inQuote = !inQuote; }
            } else if (c == ',' && !inQuote) {
                cols.add(sb.toString()); sb.setLength(0);
            } else { sb.append(c); }
        }
        cols.add(sb.toString());
        return cols.toArray(new String[0]);
    }
}
