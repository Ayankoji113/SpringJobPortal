package com.tausib.springjobportal.admin;

import com.tausib.springjobportal.common.exception.ForbiddenOperationException;
import com.tausib.springjobportal.job.JobMapper;
import com.tausib.springjobportal.job.JobPost;
import com.tausib.springjobportal.job.JobRepo;
import com.tausib.springjobportal.job.JobStatus;
import com.tausib.springjobportal.notification.NotificationRepo;
import com.tausib.springjobportal.notification.NotificationService;
import com.tausib.springjobportal.user.RefreshTokenRepo;
import com.tausib.springjobportal.user.User;
import com.tausib.springjobportal.user.UserRepo;
import com.tausib.springjobportal.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The moderation rules, and the audit trail that is meant to make the role safe to hand out.
 *
 * <p>Only interfaces are mocked — Mockito cannot instrument concrete classes on this JDK — so the
 * notification service is a real one over a mock repository.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminServiceTest {

    private static final int ADMIN = 1;
    private static final int EMPLOYER = 2;
    private static final int JOB = 10;

    @Mock JobRepo jobRepo;
    @Mock JobMapper jobMapper;
    @Mock UserRepo userRepo;
    @Mock RefreshTokenRepo refreshTokenRepo;
    @Mock AdminActionRepo adminActionRepo;
    @Mock NotificationRepo notificationRepo;

    AdminService service;

    @BeforeEach
    void setUp() {
        service = new AdminService(jobRepo, jobMapper, userRepo, refreshTokenRepo, adminActionRepo,
                new NotificationService(notificationRepo));
        when(userRepo.findById(ADMIN)).thenReturn(Optional.of(
                User.builder().id(ADMIN).email("admin@example.com").role(UserRole.ADMIN).build()));
        when(jobRepo.findById(JOB)).thenReturn(Optional.of(pendingJob()));
    }

    private static JobPost pendingJob() {
        return JobPost.builder()
                .postId(JOB)
                .postProfile("Backend Engineer")
                .status(JobStatus.PENDING_REVIEW)
                .isActive(true)
                .postedBy(User.builder().id(EMPLOYER).email("hr@acme.com").build())
                .build();
    }

    @Test
    void publishingClearsAnyEarlierRefusalAndRecordsWhoDidIt() {
        service.decide(JOB, JobStatus.PUBLISHED, null, ADMIN);

        ArgumentCaptor<JobPost> saved = ArgumentCaptor.forClass(JobPost.class);
        verify(jobRepo).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(JobStatus.PUBLISHED);
        assertThat(saved.getValue().getModerationReason()).isNull();
        assertThat(saved.getValue().getReviewedBy().getId()).isEqualTo(ADMIN);
        assertThat(saved.getValue().getReviewedAt()).isNotNull();

        ArgumentCaptor<AdminAction> action = ArgumentCaptor.forClass(AdminAction.class);
        verify(adminActionRepo).save(action.capture());
        assertThat(action.getValue().getAction()).isEqualTo("JOB_PUBLISHED");
        assertThat(action.getValue().getTargetId()).isEqualTo(JOB);
    }

    @Test
    void refusingWithoutAReasonIsNotAllowed() {
        assertThatThrownBy(() -> service.decide(JOB, JobStatus.REJECTED, "  ", ADMIN))
                .isInstanceOf(ForbiddenOperationException.class);

        verify(jobRepo, never()).save(any());
        verify(adminActionRepo, never()).save(any());
    }

    @Test
    void pendingReviewIsNotADecision() {
        assertThatThrownBy(() -> service.decide(JOB, JobStatus.PENDING_REVIEW, "why not", ADMIN))
                .isInstanceOf(ForbiddenOperationException.class);

        verify(jobRepo, never()).save(any());
    }

    @Test
    void onlyAPublishedPostingCanBeFeatured() {
        assertThatThrownBy(() -> service.setFeatured(JOB, true, ADMIN))
                .isInstanceOf(ForbiddenOperationException.class);
    }

    @Test
    void banningEndsTheAccountsSessions() {
        when(userRepo.findById(EMPLOYER)).thenReturn(Optional.of(
                User.builder().id(EMPLOYER).email("hr@acme.com").role(UserRole.EMPLOYER).build()));

        service.setBanned(EMPLOYER, true, "posted fraudulent listings", ADMIN);

        verify(refreshTokenRepo).deleteByUserId(EMPLOYER);
        ArgumentCaptor<AdminAction> action = ArgumentCaptor.forClass(AdminAction.class);
        verify(adminActionRepo).save(action.capture());
        assertThat(action.getValue().getAction()).isEqualTo("USER_BANNED");
        assertThat(action.getValue().getReason()).isEqualTo("posted fraudulent listings");
    }

    @Test
    void reinstatingDoesNotTouchSessions() {
        when(userRepo.findById(EMPLOYER)).thenReturn(Optional.of(
                User.builder().id(EMPLOYER).email("hr@acme.com").role(UserRole.EMPLOYER).build()));

        service.setBanned(EMPLOYER, false, null, ADMIN);

        verify(refreshTokenRepo, never()).deleteByUserId(anyInt());
    }

    @Test
    void anAdminCannotBanTheirOwnAccountOrAnother() {
        assertThatThrownBy(() -> service.setBanned(ADMIN, true, "oops", ADMIN))
                .isInstanceOf(ForbiddenOperationException.class);

        int otherAdmin = 3;
        when(userRepo.findById(otherAdmin)).thenReturn(Optional.of(
                User.builder().id(otherAdmin).email("other@example.com").role(UserRole.ADMIN).build()));
        assertThatThrownBy(() -> service.setBanned(otherAdmin, true, "turf war", ADMIN))
                .isInstanceOf(ForbiddenOperationException.class);
    }
}
