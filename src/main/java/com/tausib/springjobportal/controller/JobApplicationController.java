package com.tausib.springjobportal.controller;

import com.tausib.springjobportal.model.ApplicationStatus;
import com.tausib.springjobportal.model.JobApplication;
import com.tausib.springjobportal.model.User;
import com.tausib.springjobportal.service.JobApplicationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/applications")
@RequiredArgsConstructor
public class JobApplicationController {

    private final JobApplicationService applicationService;

    @PostMapping("/job/{jobId}")
    @PreAuthorize("hasRole('JOB_SEEKER')")
    public ResponseEntity<JobApplication> applyToJob(
            @PathVariable Integer jobId,
            @RequestBody Map<String, String> request,
            @AuthenticationPrincipal User user
    ) {
        String coverLetter = request.get("coverLetter");
        var application = applicationService.applyToJob(jobId, user.getId(), coverLetter);
        return ResponseEntity.ok(application);
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('JOB_SEEKER')")
    public ResponseEntity<List<JobApplication>> getMyApplications(@AuthenticationPrincipal User user) {
        var applications = applicationService.getApplicationsByApplicant(user.getId());
        return ResponseEntity.ok(applications);
    }

    @GetMapping("/job/{jobId}")
    @PreAuthorize("hasRole('EMPLOYER')")
    public ResponseEntity<List<JobApplication>> getApplicationsForJob(@PathVariable Integer jobId) {
        var applications = applicationService.getApplicationsByJob(jobId);
        return ResponseEntity.ok(applications);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('EMPLOYER')")
    public ResponseEntity<JobApplication> updateApplicationStatus(
            @PathVariable Integer id,
            @RequestBody Map<String, String> request
    ) {
        ApplicationStatus status = ApplicationStatus.valueOf(request.get("status").toUpperCase());
        var application = applicationService.updateApplicationStatus(id, status);
        return ResponseEntity.ok(application);
    }
}
