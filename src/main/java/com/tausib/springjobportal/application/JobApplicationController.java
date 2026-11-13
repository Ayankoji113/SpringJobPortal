package com.tausib.springjobportal.application;

import com.tausib.springjobportal.application.dto.ApplicationResponse;
import com.tausib.springjobportal.application.dto.EmployerResponsiveness;
import com.tausib.springjobportal.application.dto.TimelineEntry;
import com.tausib.springjobportal.user.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/applications")
@RequiredArgsConstructor
public class JobApplicationController {

    /** How many postings one bulk request may name. */
    static final int MAX_BULK_APPLICATIONS = 5;

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

    /**
     * Applies to a handful of postings the seeker picked from their recommendations. This replaced
     * "auto-apply", which applied to every match above a score without the seeker seeing the list.
     * Each posting is its own transaction, so one refusal does not undo the others.
     */
    @PostMapping("/bulk")
    @PreAuthorize("hasRole('JOB_SEEKER')")
    public ResponseEntity<Map<String, Object>> applyToSelected(
            @RequestBody Map<String, List<Integer>> request,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        List<Integer> jobIds = request.getOrDefault("jobIds", List.of()).stream().distinct().toList();
        if (jobIds.isEmpty() || jobIds.size() > MAX_BULK_APPLICATIONS) {
            throw new IllegalArgumentException(
                    "Choose between 1 and " + MAX_BULK_APPLICATIONS + " jobs to apply to at once");
        }

        List<Integer> applied = new ArrayList<>();
        Map<Integer, String> skipped = new LinkedHashMap<>();
        for (Integer jobId : jobIds) {
            try {
                applicationService.applyToJob(jobId, user.getId(), null);
                applied.add(jobId);
            } catch (RuntimeException e) {
                skipped.put(jobId, e.getMessage());
            }
        }
        return ResponseEntity.ok(Map.of("applied", applied, "skipped", skipped));
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
        return ResponseEntity.ok(applicationService.updateApplicationStatus(
                id, status, request.get("note"), user.getId()));
    }

    @PostMapping("/{id}/withdraw")
    @PreAuthorize("hasRole('JOB_SEEKER')")
    public ResponseEntity<ApplicationResponse> withdraw(
            @PathVariable Integer id,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        return ResponseEntity.ok(applicationService.withdraw(id, user.getId()));
    }

    /** The application's history. Readable by the applicant and by the employer who owns the job. */
    @GetMapping("/{id}/timeline")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<TimelineEntry>> getTimeline(
            @PathVariable Integer id,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        return ResponseEntity.ok(applicationService.getTimeline(id, user.getId()));
    }

    /** Public: how reliably an employer answers applicants, shown on their postings. */
    @GetMapping("/employer/{employerId}/responsiveness")
    public ResponseEntity<EmployerResponsiveness> getResponsiveness(@PathVariable Integer employerId) {
        return ResponseEntity.ok(applicationService.getResponsiveness(employerId));
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
