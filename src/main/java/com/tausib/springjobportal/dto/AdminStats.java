package com.tausib.springjobportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AdminStats {
    private long totalUsers;
    private long totalEmployers;
    private long totalJobSeekers;
    private long totalJobs;
    private long totalApplications;
    private long pendingJobApprovals;
    private Map<String, Long> usersByMonth;
    private Map<String, Long> jobsByMonth;
}
