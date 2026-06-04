package com.wilotus.timetracker.service;

import com.wilotus.timetracker.entity.AttendanceDailySummary;
import com.wilotus.timetracker.entity.Employee;
import com.wilotus.timetracker.repository.AttendanceDailySummaryRepository;
import com.wilotus.timetracker.repository.EmployeeRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ExportService {

    private final AttendanceDailySummaryRepository summaryRepo;
    private final EmployeeRepository employeeRepo;

    public byte[] exportAttendanceExcel(LocalDate from, LocalDate to) throws Exception {
        List<AttendanceDailySummary> summaries = summaryRepo
                .findByDateBetweenOrderByDateDescEmployeeIdAsc(from, to);

        Map<String, String> empNames = new HashMap<>();
        Map<String, String> empDepts = new HashMap<>();
        for (Employee e : employeeRepo.findByActiveTrue()) {
            empNames.put(e.getId(), e.getName());
            empDepts.put(e.getId(), e.getDept());
        }

        try (Workbook wb = new XSSFWorkbook()) {
            Sheet sheet = wb.createSheet("Attendance");
            DateTimeFormatter dateFmt = DateTimeFormatter.ofPattern("dd-MM-yyyy");

            // Header
            Row header = sheet.createRow(0);
            String[] cols = { "Date", "Employee ID", "Name", "Department",
                    "Entry", "Exit", "Work (hrs)", "Break (min)",
                    "Lunch (min)", "Late Status", "Status" };
            CellStyle headerStyle = wb.createCellStyle();
            Font font = wb.createFont();
            font.setBold(true);
            headerStyle.setFont(font);
            for (int i = 0; i < cols.length; i++) {
                Cell cell = header.createCell(i);
                cell.setCellValue(cols[i]);
                cell.setCellStyle(headerStyle);
            }

            // Data rows
            int rowNum = 1;
            for (AttendanceDailySummary s : summaries) {
                Row row = sheet.createRow(rowNum++);
                row.createCell(0).setCellValue(s.getDate().format(dateFmt));
                row.createCell(1).setCellValue(s.getEmployeeId());
                row.createCell(2).setCellValue(empNames.getOrDefault(s.getEmployeeId(), ""));
                row.createCell(3).setCellValue(empDepts.getOrDefault(s.getEmployeeId(), ""));
                row.createCell(4).setCellValue(s.getEntryTime() != null ? s.getEntryTime().toString() : "");
                row.createCell(5).setCellValue(s.getExitTime()  != null ? s.getExitTime().toString()  : "");
                row.createCell(6).setCellValue(Math.round(s.getTotalWorkMs()  / 3_600_000.0 * 100) / 100.0);
                row.createCell(7).setCellValue(s.getTotalBreakMs()  / 60_000);
                row.createCell(8).setCellValue(s.getTotalLunchMs()  / 60_000);
                row.createCell(9).setCellValue(s.getLateStatus());
                row.createCell(10).setCellValue(s.getStatus());
            }

            for (int i = 0; i < cols.length; i++) sheet.autoSizeColumn(i);

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            wb.write(out);
            return out.toByteArray();
        }
    }
}
