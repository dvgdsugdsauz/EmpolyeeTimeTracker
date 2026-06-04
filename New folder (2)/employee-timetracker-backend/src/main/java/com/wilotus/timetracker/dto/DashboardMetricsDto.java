package com.wilotus.timetracker.dto;

import lombok.Data;
import java.util.List;

@Data
public class DashboardMetricsDto {
    private int total;
    private int working;
    private int outside;
    private int missPunch;
    private int notArrived;
    private int offline;
    private int presentPct;
    private List<ChartDayDto> chartData;

    @Data
    public static class ChartDayDto {
        private String label;
        private int present;
        private int overtime;
        private boolean isWeekend;
    }
}
