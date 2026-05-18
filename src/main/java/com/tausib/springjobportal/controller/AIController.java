package com.tausib.springjobportal.controller;

import com.tausib.springjobportal.model.*;
import com.tausib.springjobportal.service.AIService;
import com.tausib.springjobportal.service.JobApplicationService;
import com.tausib.springjobportal.service.JobService;
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
            @AuthenticationPrincipal User user
    ) {
        JobPost job = jobService.getJob(jobId);
        return ResponseEntity.ok(aiService.calculateMatchScore(user, job));
    }

    @GetMapping("/cover-letter/{jobId}")
    @PreAuthorize("hasRole('JOB_SEEKER')")
    public ResponseEntity<?> generateCoverLetter(
            @PathVariable Integer jobId,
            @AuthenticationPrincipal User user
    ) {
        JobPost job = jobService.getJob(jobId);
        String letter = aiService.generateCoverLetter(user, job);
        return ResponseEntity.ok(Map.of("coverLetter", letter));
    }

    @GetMapping("/salary-estimate")
    @PreAuthorize("hasRole('JOB_SEEKER')")
    public ResponseEntity<Map<String, Object>> estimateSalary(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(aiService.estimateSalary(user));
    }

    @GetMapping("/resume-suggestions")
    @PreAuthorize("hasRole('JOB_SEEKER')")
    public ResponseEntity<Map<String, Object>> getResumeSuggestions(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(aiService.suggestImprovements(user));
    }

    @GetMapping("/recommended-jobs")
    @PreAuthorize("hasRole('JOB_SEEKER')")
    public ResponseEntity<List<MatchScore>> getRecommendedJobs(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "50") double threshold
    ) {
        List<JobPost> allJobs = jobService.getAllJobs();
        return ResponseEntity.ok(aiService.getRecommendedJobs(user, allJobs, threshold));
    }

    @PostMapping("/auto-apply")
    @PreAuthorize("hasRole('JOB_SEEKER')")
    public ResponseEntity<?> autoApply(
            @AuthenticationPrincipal User user,
            @RequestParam(defaultValue = "70") double threshold
    ) {
        List<JobPost> allJobs = jobService.getAllJobs();
        List<MatchScore> matches = aiService.getRecommendedJobs(user, allJobs, threshold);

        int applied = 0;
        for (MatchScore match : matches) {
            try {
                String coverLetter = aiService.generateCoverLetter(user, match.getJobPost());
                applicationService.applyToJob(match.getJobPost().getPostId(), user.getId(), coverLetter);
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
