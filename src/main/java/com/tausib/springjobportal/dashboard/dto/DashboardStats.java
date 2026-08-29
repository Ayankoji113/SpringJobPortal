package com.tausib.springjobportal.dashboard.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class DashboardStats {
    private long totalJobs;
    private long totalApplications;
    private long totalViews;
    private Map<String, Long> applicationsByStatus;
}
