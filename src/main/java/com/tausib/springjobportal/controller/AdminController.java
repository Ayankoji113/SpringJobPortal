package com.tausib.springjobportal.controller;

import com.tausib.springjobportal.dto.AdminStats;
import com.tausib.springjobportal.model.JobPost;
import com.tausib.springjobportal.model.User;
import com.tausib.springjobportal.model.UserRole;
import com.tausib.springjobportal.repo.JobApplicationRepo;
import com.tausib.springjobportal.repo.JobRepo;
import com.tausib.springjobportal.repo.UserRepo;
import com.tausib.springjobportal.service.JobService;
import com.tausib.springjobportal.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminController {

    private final UserService userService;
    private final JobService jobService;
    private final UserRepo userRepo;
    private final JobRepo jobRepo;
    private final JobApplicationRepo applicationRepo;

    // ---- Users ----
    @GetMapping("/users")
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userService.getAllUsers());
    }

    @GetMapping("/users/search")
    public ResponseEntity<List<User>> searchUsers(@RequestParam String keyword) {
        return ResponseEntity.ok(userService.searchUsers(keyword));
    }

    @PatchMapping("/users/{id}/ban")
    public ResponseEntity<?> banUser(@PathVariable Integer id) {
        userService.banUser(id);
        return ResponseEntity.ok(Map.of("message", "User banned"));
    }

    @PatchMapping("/users/{id}/unban")
    public ResponseEntity<?> unbanUser(@PathVariable Integer id) {
        userService.unbanUser(id);
        return ResponseEntity.ok(Map.of("message", "User unbanned"));
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable Integer id) {
        userService.deleteUser(id);
        return ResponseEntity.ok(Map.of("message", "User deleted"));
    }

    // ---- Jobs ----
    @GetMapping("/jobs/pending")
    public ResponseEntity<List<JobPost>> getPendingJobs() {
        return ResponseEntity.ok(jobService.getPendingApprovalJobs());
    }

    @PatchMapping("/jobs/{id}/approve")
    public ResponseEntity<?> approveJob(@PathVariable Integer id) {
        jobService.approveJob(id);
        return ResponseEntity.ok(Map.of("message", "Job approved"));
    }

    @PatchMapping("/jobs/{id}/reject")
    public ResponseEntity<?> rejectJob(@PathVariable Integer id) {
        jobService.rejectJob(id);
        return ResponseEntity.ok(Map.of("message", "Job rejected"));
    }

    // ---- Analytics ----
    @GetMapping("/stats")
    public ResponseEntity<AdminStats> getStats() {
        AdminStats stats = AdminStats.builder()
                .totalUsers(userRepo.count())
                .totalEmployers(userRepo.countByRole(UserRole.EMPLOYER))
                .totalJobSeekers(userRepo.countByRole(UserRole.JOB_SEEKER))
                .totalJobs(jobRepo.count())
                .totalApplications(applicationRepo.count())
                .pendingJobApprovals(jobService.getPendingApprovalJobs().size())
                .build();
        return ResponseEntity.ok(stats);
    }
}
