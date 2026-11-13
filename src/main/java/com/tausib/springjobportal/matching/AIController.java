package com.tausib.springjobportal.matching;

import com.tausib.springjobportal.job.JobPost;
import com.tausib.springjobportal.job.JobService;

import com.tausib.springjobportal.user.UserPrincipal;

import com.tausib.springjobportal.matching.dto.SalaryEstimateResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AIController {

    private final AIService aiService;
    private final SalaryEstimateService salaryEstimateService;
    private final JobService jobService;

    @GetMapping("/match-score/{jobId}")
    @PreAuthorize("hasRole('JOB_SEEKER')")
    public ResponseEntity<MatchScore> getMatchScore(
            @PathVariable Integer jobId,
            @AuthenticationPrincipal UserPrincipal user
    ) {
        JobPost job = jobService.getEntityById(jobId);
        return ResponseEntity.ok(aiService.calculateMatchScore(user.getId(), job));
    }

    /**
     * Salary estimate for one posting, grounded in comparable postings. The percentiles are always
     * present; the narrative is null when the model was slow, down, or had nothing to explain.
     */
    @GetMapping("/salary-estimate/{jobId}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<SalaryEstimateResponse> estimateSalary(@PathVariable Integer jobId) {
        return ResponseEntity.ok(salaryEstimateService.estimate(jobService.getEntityById(jobId)));
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
}
