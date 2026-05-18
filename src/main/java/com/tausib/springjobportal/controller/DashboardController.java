package com.tausib.springjobportal.controller;

import com.tausib.springjobportal.dto.DashboardStats;
import com.tausib.springjobportal.model.User;
import com.tausib.springjobportal.repo.JobRepo;
import com.tausib.springjobportal.service.JobApplicationService;
import com.tausib.springjobportal.service.JobService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/dashboard")
@PreAuthorize("hasRole('EMPLOYER')")
@RequiredArgsConstructor
public class DashboardController {

    private final JobService jobService;
    private final JobApplicationService applicationService;
    private final JobRepo jobRepo;

    @GetMapping("/employer")
    public ResponseEntity<DashboardStats> getEmployerDashboard(@AuthenticationPrincipal User user) {
        long totalJobs = jobRepo.countByPostedById(user.getId());

        // Calculate total views across all employer's jobs
        long totalViews = jobService.getJobsByEmployer(user.getId()).stream()
                .mapToLong(j -> j.getViewCount() != null ? j.getViewCount() : 0)
                .sum();

        // Get total applications for this employer's jobs
        long totalApps = jobService.getJobsByEmployer(user.getId()).stream()
                .mapToLong(j -> applicationService.countByJob(j.getPostId()))
                .sum();

        var statusBreakdown = applicationService.getStatusBreakdown(user.getId());

        DashboardStats stats = DashboardStats.builder()
                .totalJobs(totalJobs)
                .totalApplications(totalApps)
                .totalViews(totalViews)
                .applicationsByStatus(statusBreakdown)
                .build();

        return ResponseEntity.ok(stats);
    }
}
