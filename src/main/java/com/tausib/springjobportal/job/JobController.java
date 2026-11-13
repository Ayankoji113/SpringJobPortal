package com.tausib.springjobportal.job;

import com.tausib.springjobportal.job.dto.JobRequest;
import com.tausib.springjobportal.job.dto.JobResponse;
import com.tausib.springjobportal.job.dto.JobSearchRequest;
import com.tausib.springjobportal.job.dto.SavedJobResponse;
import com.tausib.springjobportal.user.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/jobs")
@RequiredArgsConstructor
public class JobController {

    private final JobService jobService;
    private final SavedJobService savedJobService;

    @GetMapping
    public ResponseEntity<List<JobResponse>> getAllJobs() {
        return ResponseEntity.ok(jobService.getAll());
    }

    @GetMapping("/paginated")
    public ResponseEntity<Page<JobResponse>> getJobsPaginated(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return ResponseEntity.ok(jobService.getPaginated(page, size));
    }

    @GetMapping("/search")
    public ResponseEntity<Page<JobResponse>> searchJobs(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) JobType jobType,
            @RequestParam(required = false) Boolean isRemote,
            @RequestParam(required = false) Integer minExp,
            @RequestParam(required = false) Integer maxExp,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "postedDate") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir
    ) {
        JobSearchRequest request = JobSearchRequest.builder()
                .keyword(keyword)
                .location(location)
                .jobType(jobType)
                .isRemote(isRemote)
                .minExperience(minExp)
                .maxExperience(maxExp)
                .page(page)
                .size(size)
                .sortBy(sortBy)
                .sortDir(sortDir)
                .build();
        return ResponseEntity.ok(jobService.search(request));
    }

    @GetMapping("/featured")
    public ResponseEntity<List<JobResponse>> getFeaturedJobs() {
        return ResponseEntity.ok(jobService.getFeatured());
    }

    @GetMapping("/keyword/{keyword}")
    public ResponseEntity<List<JobResponse>> searchByKeyword(@PathVariable String keyword) {
        return ResponseEntity.ok(jobService.searchByKeyword(keyword));
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('EMPLOYER')")
    public ResponseEntity<List<JobResponse>> getMyJobs(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(jobService.getByEmployer(principal.getId()));
    }

    @GetMapping("/saved")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<SavedJobResponse>> getSavedJobs(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(savedJobService.getByUser(principal.getId()));
    }

    /** Public. {@code principal} is null for anonymous visitors, which the service expects. */
    @GetMapping("/{postId}")
    public ResponseEntity<JobResponse> getJob(
            @PathVariable Integer postId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(jobService.viewById(postId, principal));
    }

    @GetMapping("/{postId}/is-saved")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Boolean>> isJobSaved(
            @PathVariable Integer postId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(Map.of("saved", savedJobService.isSaved(principal.getId(), postId)));
    }

    @PostMapping
    @PreAuthorize("hasRole('EMPLOYER')")
    public ResponseEntity<JobResponse> addJob(
            @Valid @RequestBody JobRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(jobService.create(request, principal.getId()));
    }

    @PutMapping("/{postId}")
    @PreAuthorize("hasRole('EMPLOYER')")
    public ResponseEntity<JobResponse> updateJob(
            @PathVariable Integer postId,
            @Valid @RequestBody JobRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(jobService.update(postId, request, principal.getId()));
    }

    @DeleteMapping("/{postId}")
    @PreAuthorize("hasRole('EMPLOYER')")
    public ResponseEntity<Map<String, String>> deleteJob(
            @PathVariable Integer postId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        jobService.delete(postId, principal.getId());
        return ResponseEntity.ok(Map.of("message", "Job deleted successfully"));
    }

    @PostMapping("/{postId}/save")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<SavedJobResponse> saveJob(
            @PathVariable Integer postId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(savedJobService.save(principal.getId(), postId));
    }

    @DeleteMapping("/{postId}/save")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, String>> unsaveJob(
            @PathVariable Integer postId,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        savedJobService.unsave(principal.getId(), postId);
        return ResponseEntity.ok(Map.of("message", "Job unsaved"));
    }
}
