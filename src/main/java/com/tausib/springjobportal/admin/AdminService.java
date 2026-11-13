package com.tausib.springjobportal.admin;

import com.tausib.springjobportal.admin.dto.AdminActionResponse;
import com.tausib.springjobportal.common.exception.ForbiddenOperationException;
import com.tausib.springjobportal.common.exception.ResourceNotFoundException;
import com.tausib.springjobportal.job.JobMapper;
import com.tausib.springjobportal.job.JobPost;
import com.tausib.springjobportal.job.JobRepo;
import com.tausib.springjobportal.job.JobStatus;
import com.tausib.springjobportal.job.dto.JobResponse;
import com.tausib.springjobportal.notification.NotificationService;
import com.tausib.springjobportal.notification.NotificationType;
import com.tausib.springjobportal.user.RefreshTokenRepo;
import com.tausib.springjobportal.user.User;
import com.tausib.springjobportal.user.UserRepo;
import com.tausib.springjobportal.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Moderation and account administration. Every write here records an {@link AdminAction} in the
 * same transaction as the change it describes, and notifies whoever it affects.
 */
@Service
@RequiredArgsConstructor
public class AdminService {

    private final JobRepo jobRepo;
    private final JobMapper jobMapper;
    private final UserRepo userRepo;
    private final RefreshTokenRepo refreshTokenRepo;
    private final AdminActionRepo adminActionRepo;
    private final NotificationService notificationService;

    /** The review queue, oldest first so nothing waits behind a newer posting. */
    @Transactional(readOnly = true)
    public Page<JobResponse> pendingJobs(int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        return jobRepo.findByStatusOrderByPostedDateAsc(JobStatus.PENDING_REVIEW, pageable)
                .map(jobMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public long pendingCount() {
        return jobRepo.countByStatus(JobStatus.PENDING_REVIEW);
    }

    /**
     * Decide one posting. Anything but publication needs a reason: the employer is shown it, and a
     * refusal with no reason given is not something anyone can act on or appeal.
     */
    @Transactional
    public JobResponse decide(Integer postId, JobStatus decision, String reason, Integer adminId) {
        if (decision == JobStatus.PENDING_REVIEW) {
            throw new ForbiddenOperationException("A decision cannot be pending review");
        }
        if (decision != JobStatus.PUBLISHED && (reason == null || reason.isBlank())) {
            throw new ForbiddenOperationException("A reason is required to reject or suspend");
        }

        JobPost job = jobRepo.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Job Post not found with id: " + postId));
        User admin = adminById(adminId);

        job.setStatus(decision);
        job.setModerationReason(decision == JobStatus.PUBLISHED ? null : reason);
        job.setReviewedAt(LocalDateTime.now());
        job.setReviewedBy(admin);
        jobRepo.save(job);

        record(admin, "JOB_" + decision.name(), "JOB", postId, reason);
        notifyEmployer(job, decision, reason);

        return jobMapper.toResponse(job);
    }

    private void notifyEmployer(JobPost job, JobStatus decision, String reason) {
        if (job.getPostedBy() == null) {
            return;
        }
        boolean published = decision == JobStatus.PUBLISHED;
        notificationService.createNotification(
                job.getPostedBy(),
                published ? "Job published" : "Job " + decision.name().toLowerCase(),
                published
                        ? job.getPostProfile() + " is now live."
                        : job.getPostProfile() + ": " + reason,
                NotificationType.APPLICATION_STATUS_CHANGED,
                "/employer-dashboard");
    }

    @Transactional
    public JobResponse setFeatured(Integer postId, boolean featured, Integer adminId) {
        JobPost job = jobRepo.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Job Post not found with id: " + postId));

        if (featured && job.getStatus() != JobStatus.PUBLISHED) {
            throw new ForbiddenOperationException("Only a published posting can be featured");
        }

        job.setIsFeatured(featured);
        jobRepo.save(job);
        record(adminById(adminId), featured ? "JOB_FEATURED" : "JOB_UNFEATURED", "JOB", postId, null);
        return jobMapper.toResponse(job);
    }

    /**
     * Ban or reinstate an account. A ban deletes the account's refresh tokens; the access token is
     * rejected on its next request by {@code JwtAuthFilter}, which checks the locked flag. Without
     * both halves a ban took up to a day to bite.
     */
    @Transactional
    public void setBanned(Integer userId, boolean banned, String reason, Integer adminId) {
        User admin = adminById(adminId);
        if (userId.equals(adminId)) {
            throw new ForbiddenOperationException("You cannot ban your own account");
        }

        User user = userRepo.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));
        if (banned && user.getRole() == UserRole.ADMIN) {
            throw new ForbiddenOperationException("Demote the admin before banning the account");
        }

        user.setIsBanned(banned);
        userRepo.save(user);

        if (banned) {
            refreshTokenRepo.deleteByUserId(userId);
        }

        record(admin, banned ? "USER_BANNED" : "USER_UNBANNED", "USER", userId, reason);
    }

    @Transactional(readOnly = true)
    public Page<AdminActionResponse> actions(int page, int size) {
        return adminActionRepo.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size))
                .map(a -> AdminActionResponse.builder()
                        .id(a.getId())
                        .adminEmail(a.getAdmin().getEmail())
                        .action(a.getAction())
                        .targetType(a.getTargetType())
                        .targetId(a.getTargetId())
                        .reason(a.getReason())
                        .createdAt(a.getCreatedAt())
                        .build());
    }

    private User adminById(Integer adminId) {
        return userRepo.findById(adminId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + adminId));
    }

    private void record(User admin, String action, String targetType, Integer targetId, String reason) {
        adminActionRepo.save(AdminAction.builder()
                .admin(admin)
                .action(action)
                .targetType(targetType)
                .targetId(targetId)
                .reason(reason)
                .build());
    }
}
