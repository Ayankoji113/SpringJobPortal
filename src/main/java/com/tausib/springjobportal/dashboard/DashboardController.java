package com.tausib.springjobportal.dashboard;

import com.tausib.springjobportal.job.JobService;

import com.tausib.springjobportal.dashboard.dto.DashboardStats;
import com.tausib.springjobportal.user.UserPrincipal;
import com.tausib.springjobportal.application.JobApplicationService;
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

    @GetMapping("/employer")
    public ResponseEntity<DashboardStats> getEmployerDashboard(@AuthenticationPrincipal UserPrincipal user) {
        long totalJobs = jobService.countByEmployer(user.getId());

        // Calculate total views across all employer's jobs
        long totalViews = jobService.getEntitiesByEmployer(user.getId()).stream()
                .mapToLong(j -> j.getViewCount() != null ? j.getViewCount() : 0)
                .sum();

        // Get total applications for this employer's jobs
        long totalApps = jobService.getEntitiesByEmployer(user.getId()).stream()
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
