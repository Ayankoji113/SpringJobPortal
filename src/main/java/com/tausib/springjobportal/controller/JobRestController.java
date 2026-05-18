package com.tausib.springjobportal.controller;

import com.tausib.springjobportal.dto.JobSearchRequest;
import com.tausib.springjobportal.model.JobPost;
import com.tausib.springjobportal.model.JobType;
import com.tausib.springjobportal.model.SavedJob;
import com.tausib.springjobportal.model.User;
import com.tausib.springjobportal.service.JobService;
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
public class JobRestController {

    private final JobService service;

    @GetMapping
    public ResponseEntity<List<JobPost>> getAllJobs() {
        return ResponseEntity.ok(service.getAllJobs());
    }

    @GetMapping("/paginated")
    public ResponseEntity<Page<JobPost>> getJobsPaginated(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        return ResponseEntity.ok(service.getJobsPaginated(page, size));
    }

    @GetMapping("/search")
    public ResponseEntity<Page<JobPost>> searchJobs(
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
        return ResponseEntity.ok(service.searchJobs(request));
    }

    @GetMapping("/{postId}")
    public ResponseEntity<JobPost> getJob(@PathVariable Integer postId) {
        return ResponseEntity.ok(service.getJob(postId));
    }

    @GetMapping("/keyword/{keyword}")
    public ResponseEntity<List<JobPost>> searchByKeyword(@PathVariable String keyword) {
        return ResponseEntity.ok(service.search(keyword));
    }

    @GetMapping("/featured")
    public ResponseEntity<List<JobPost>> getFeaturedJobs() {
        return ResponseEntity.ok(service.getFeaturedJobs());
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('EMPLOYER')")
    public ResponseEntity<List<JobPost>> getMyJobs(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(service.getJobsByEmployer(user.getId()));
    }

    @PostMapping
    @PreAuthorize("hasRole('EMPLOYER')")
    public ResponseEntity<JobPost> addJob(@RequestBody JobPost jobPost, @AuthenticationPrincipal User user) {
        jobPost.setPostedBy(user);
        return ResponseEntity.ok(service.addJob(jobPost));
    }

    @PutMapping("/{postId}")
    @PreAuthorize("hasRole('EMPLOYER')")
    public ResponseEntity<JobPost> updateJob(@PathVariable Integer postId, @RequestBody JobPost jobPost) {
        jobPost.setPostId(postId);
        return ResponseEntity.ok(service.updateJob(jobPost));
    }

    @DeleteMapping("/{postId}")
    @PreAuthorize("hasRole('EMPLOYER')")
    public ResponseEntity<?> deleteJob(@PathVariable Integer postId) {
        service.deleteJob(postId);
        return ResponseEntity.ok(Map.of("message", "Job deleted successfully"));
    }

    // Saved Jobs
    @PostMapping("/{postId}/save")
    public ResponseEntity<SavedJob> saveJob(@PathVariable Integer postId, @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(service.saveJob(user, postId));
    }

    @DeleteMapping("/{postId}/save")
    public ResponseEntity<?> unsaveJob(@PathVariable Integer postId, @AuthenticationPrincipal User user) {
        service.unsaveJob(user.getId(), postId);
        return ResponseEntity.ok(Map.of("message", "Job unsaved"));
    }

    @GetMapping("/saved")
    public ResponseEntity<List<SavedJob>> getSavedJobs(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(service.getSavedJobs(user.getId()));
    }

    @GetMapping("/{postId}/is-saved")
    public ResponseEntity<?> isJobSaved(@PathVariable Integer postId, @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(Map.of("saved", service.isJobSaved(user.getId(), postId)));
    }

    @GetMapping("/load")
    public ResponseEntity<String> loadData() {
        service.load();
        return ResponseEntity.ok("success");
    }
}