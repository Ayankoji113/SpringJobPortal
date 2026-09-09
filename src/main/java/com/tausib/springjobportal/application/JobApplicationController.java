package com.tausib.springjobportal.application;

import com.tausib.springjobportal.application.dto.ApplicationResponse;
import com.tausib.springjobportal.user.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
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
    public ResponseEntity<ApplicationResponse> applyToJob(
            @PathVariable Integer jobId,
            @RequestBody Map<String, String> request,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        String coverLetter = request.get("coverLetter");
        var application = applicationService.applyToJob(jobId, user.getId(), coverLetter);
        return ResponseEntity.ok(application);
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('JOB_SEEKER')")
    public ResponseEntity<List<ApplicationResponse>> getMyApplications(@AuthenticationPrincipal UserPrincipal user) {
        var applications = applicationService.getApplicationsByApplicant(user.getId());
        return ResponseEntity.ok(applications);
    }

    @GetMapping("/job/{jobId}")
    @PreAuthorize("hasRole('EMPLOYER')")
    public ResponseEntity<List<ApplicationResponse>> getApplicationsForJob(
            @PathVariable Integer jobId,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        return ResponseEntity.ok(applicationService.getApplicationsByJob(jobId, user.getId()));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('EMPLOYER')")
    public ResponseEntity<ApplicationResponse> updateApplicationStatus(
            @PathVariable Integer id,
            @RequestBody Map<String, String> request,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        ApplicationStatus status = ApplicationStatus.valueOf(request.get("status").toUpperCase());
        return ResponseEntity.ok(applicationService.updateApplicationStatus(id, status, user.getId()));
    }

    /** The applicant's resume. Employers reach it only through their own job's application. */
    @GetMapping("/{id}/resume")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<byte[]> getApplicantResume(
            @PathVariable Integer id,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        var resume = applicationService.getApplicantResume(id, user.getId());
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(resume.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + resume.filename() + "\"")
                .body(resume.content());
    }
}
