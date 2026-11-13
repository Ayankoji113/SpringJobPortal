package com.tausib.springjobportal.admin;

import com.tausib.springjobportal.admin.dto.AdminActionResponse;
import com.tausib.springjobportal.admin.dto.BanRequest;
import com.tausib.springjobportal.admin.dto.ModerationRequest;
import com.tausib.springjobportal.job.dto.JobResponse;
import com.tausib.springjobportal.user.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Moderation. The role check sits on the class, so a method added later cannot be reachable without
 * it — the pattern the rest of the codebase learned the hard way.
 */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminController {

    private final AdminService adminService;

    @GetMapping("/jobs/pending")
    public ResponseEntity<Page<JobResponse>> pendingJobs(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(adminService.pendingJobs(page, size));
    }

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Long>> stats() {
        return ResponseEntity.ok(Map.of("pendingReview", adminService.pendingCount()));
    }

    /** Publish, reject or suspend one posting. */
    @PostMapping("/jobs/{postId}/decision")
    public ResponseEntity<JobResponse> decide(
            @PathVariable Integer postId,
            @Valid @RequestBody ModerationRequest request,
            @AuthenticationPrincipal UserPrincipal admin
    ) {
        return ResponseEntity.ok(adminService.decide(
                postId, request.getStatus(), request.getReason(), admin.getId()));
    }

    @PatchMapping("/jobs/{postId}/featured")
    public ResponseEntity<JobResponse> setFeatured(
            @PathVariable Integer postId,
            @RequestBody Map<String, Boolean> request,
            @AuthenticationPrincipal UserPrincipal admin
    ) {
        return ResponseEntity.ok(adminService.setFeatured(
                postId, Boolean.TRUE.equals(request.get("featured")), admin.getId()));
    }

    @PatchMapping("/users/{userId}/banned")
    public ResponseEntity<Map<String, String>> setBanned(
            @PathVariable Integer userId,
            @Valid @RequestBody BanRequest request,
            @AuthenticationPrincipal UserPrincipal admin
    ) {
        adminService.setBanned(userId, request.getBanned(), request.getReason(), admin.getId());
        return ResponseEntity.ok(Map.of("message",
                request.getBanned() ? "Account banned" : "Account reinstated"));
    }

    @GetMapping("/actions")
    public ResponseEntity<Page<AdminActionResponse>> actions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        return ResponseEntity.ok(adminService.actions(page, size));
    }
}
