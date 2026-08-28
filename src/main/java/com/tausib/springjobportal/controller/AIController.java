package com.tausib.springjobportal.controller;

import com.tausib.springjobportal.job.JobPost;
import com.tausib.springjobportal.job.JobService;

import com.tausib.springjobportal.user.UserPrincipal;

import com.tausib.springjobportal.model.*;
import com.tausib.springjobportal.service.AIService;
import com.tausib.springjobportal.service.JobApplicationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AIController {

    private final AIService aiService;
    private final JobService jobService;
    private final JobApplicationService applicationService;

    @GetMapping("/match-score/{jobId}")
    @PreAuthorize("hasRole('JOB_SEEKER')")
    public ResponseEntity<MatchScore> getMatchScore(
            @PathVariable Integer jobId,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        JobPost job = jobService.getEntityById(jobId);
        return ResponseEntity.ok(aiService.calculateMatchScore(user.getId(), job));
    }

    @GetMapping("/salary-estimate")
    @PreAuthorize("hasRole('JOB_SEEKER')")
    public ResponseEntity<Map<String, Object>> estimateSalary(@AuthenticationPrincipal UserPrincipal user) {
        return ResponseEntity.ok(aiService.estimateSalary(user.getId()));
    }

    @GetMapping("/recommended-jobs")
    @PreAuthorize("hasRole('JOB_SEEKER')")
    public ResponseEntity<List<MatchScore>> getRecommendedJobs(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam(defaultValue = "50") double threshold
    ) {
        List<JobPost> allJobs = jobService.getAllEntities();
        return ResponseEntity.ok(aiService.getRecommendedJobs(user.getId(), allJobs, threshold));
    }

    @PostMapping("/auto-apply")
    @PreAuthorize("hasRole('JOB_SEEKER')")
    public ResponseEntity<?> autoApply(
            @AuthenticationPrincipal UserPrincipal user,
            @RequestParam(defaultValue = "70") double threshold
    ) {
        List<JobPost> allJobs = jobService.getAllEntities();
        List<MatchScore> matches = aiService.getRecommendedJobs(user.getId(), allJobs, threshold);

        int applied = 0;
        for (MatchScore match : matches) {
            try {
                applicationService.applyToJob(match.getJobPost().getPostId(), user.getId(), null);
                applied++;
            } catch (Exception e) {
                // Skip jobs already applied to or other errors
            }
        }

        return ResponseEntity.ok(Map.of(
                "matchesFound", matches.size(),
                "applicationsSubmitted", applied,
                "threshold", threshold
        ));
    }
}
