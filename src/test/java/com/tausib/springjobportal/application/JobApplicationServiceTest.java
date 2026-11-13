package com.tausib.springjobportal.application;

import com.tausib.springjobportal.common.exception.ForbiddenOperationException;
import com.tausib.springjobportal.common.exception.ResourceNotFoundException;
import com.tausib.springjobportal.common.mail.EmailService;
import com.tausib.springjobportal.file.FileStorageService;
import com.tausib.springjobportal.job.JobClosedEvent;
import com.tausib.springjobportal.job.JobPost;
import com.tausib.springjobportal.job.JobRepo;
import com.tausib.springjobportal.job.JobStatus;
import com.tausib.springjobportal.notification.NotificationRepo;
import com.tausib.springjobportal.notification.NotificationService;
import com.tausib.springjobportal.user.User;
import com.tausib.springjobportal.user.UserRepo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.javamail.JavaMailSender;
import java.time.LocalDateTime;
import java.util.List;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.eq;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Authorization rules for the applications module. Before these checks existed, an employer id was
 * never compared against the job's owner, so any employer could read or decide any other
 * employer's applications by guessing an id.
 *
 * <p>The notification and email collaborators are deliberately null: every refusal here must throw
 * before reaching them, and a null makes that a loud failure rather than a silent one. Only
 * interfaces are mocked — Mockito cannot instrument concrete classes on this JDK.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class JobApplicationServiceTest {

    private static final int OWNER = 1;
    private static final int INTRUDER = 2;
    private static final int APPLICANT = 3;
    private static final String RESUME = "resumes/resume_3_abcd1234.pdf";

    @Mock JobApplicationRepo applicationRepo;
    @Mock ApplicationMapper applicationMapper;
    @Mock JobRepo jobRepo;
    @Mock UserRepo userRepo;
    @Mock ApplicationStatusEventRepo eventRepo;
    @Mock NotificationRepo notificationRepo;
    @Mock JavaMailSender mailSender;

    JobApplicationService service;

    @BeforeEach
    void setUp(@TempDir Path uploads) throws IOException {
        FileStorageService fileStorageService = new FileStorageService(uploads.toString());
        Files.writeString(uploads.resolve(RESUME), "pdf-bytes");
        service = new JobApplicationService(
                applicationRepo, eventRepo, applicationMapper, jobRepo, userRepo, null, null,
                fileStorageService);
    }

    /** For the paths that succeed and therefore do notify. Real services over mocked interfaces. */
    private JobApplicationService notifyingService() {
        when(applicationRepo.save(any())).thenAnswer(call -> call.getArgument(0));
        return new JobApplicationService(
                applicationRepo, eventRepo, applicationMapper, jobRepo, userRepo,
                new NotificationService(notificationRepo), new EmailService(mailSender), null);
    }

    private ApplicationStatusEvent recordedEvent() {
        ArgumentCaptor<ApplicationStatusEvent> event = ArgumentCaptor.forClass(ApplicationStatusEvent.class);
        verify(eventRepo).save(event.capture());
        return event.getValue();
    }

    private static User user(int id) {
        return User.builder().id(id).fullName("User " + id).build();
    }

    private static JobPost jobOwnedBy(int ownerId) {
        return JobPost.builder().postId(10).postProfile("Backend Engineer").postedBy(user(ownerId)).build();
    }

    private static JobApplication application() {
        User applicant = user(APPLICANT);
        applicant.setResumePath(RESUME);
        return JobApplication.builder()
                .id(100).jobPost(jobOwnedBy(OWNER)).applicant(applicant)
                .status(ApplicationStatus.PENDING).build();
    }

    @Test
    void refusesToListApplicantsForSomeoneElsesJob() {
        when(jobRepo.findById(10)).thenReturn(Optional.of(jobOwnedBy(OWNER)));

        assertThatThrownBy(() -> service.getApplicationsByJob(10, INTRUDER))
                .isInstanceOf(ForbiddenOperationException.class);

        verify(applicationRepo, never()).findByJobPostPostId(anyInt());
    }

    @Test
    void listsApplicantsForYourOwnJob() {
        when(jobRepo.findById(10)).thenReturn(Optional.of(jobOwnedBy(OWNER)));

        service.getApplicationsByJob(10, OWNER);

        verify(applicationRepo).findByJobPostPostId(10);
    }

    @Test
    void refusesToDecideSomeoneElsesApplication() {
        when(applicationRepo.findById(100)).thenReturn(Optional.of(application()));

        assertThatThrownBy(() ->
                service.updateApplicationStatus(100, ApplicationStatus.REJECTED, null, INTRUDER))
                .isInstanceOf(ForbiddenOperationException.class);

        verify(applicationRepo, never()).save(any());
    }

    @Test
    void servesTheResumeToTheHiringEmployerAndToTheApplicant() {
        when(applicationRepo.findById(100)).thenReturn(Optional.of(application()));

        assertThat(service.getApplicantResume(100, OWNER).contentType()).isEqualTo("application/pdf");
        assertThat(service.getApplicantResume(100, APPLICANT).filename())
                .isEqualTo("resume_3_abcd1234.pdf");
        assertThat(service.getApplicantResume(100, OWNER).content()).isEqualTo("pdf-bytes".getBytes());
    }

    @Test
    void refusesTheResumeToAnyoneElse() {
        when(applicationRepo.findById(100)).thenReturn(Optional.of(application()));

        assertThatThrownBy(() -> service.getApplicantResume(100, INTRUDER))
                .isInstanceOf(ForbiddenOperationException.class);
    }

    // --- lifecycle ---

    @Test
    void anEmployerMovesOneStageAtATimeOrRejects() {
        assertThat(ApplicationStatus.PENDING.nextForEmployer())
                .containsExactly(ApplicationStatus.REVIEWED, ApplicationStatus.REJECTED);
        assertThat(ApplicationStatus.OFFERED.nextForEmployer())
                .containsExactly(ApplicationStatus.ACCEPTED, ApplicationStatus.REJECTED);
        assertThat(List.of(ApplicationStatus.ACCEPTED, ApplicationStatus.REJECTED, ApplicationStatus.WITHDRAWN))
                .noneMatch(ApplicationStatus::isOpen);
    }

    @Test
    void refusesToSkipStages() {
        when(applicationRepo.findById(100)).thenReturn(Optional.of(application()));

        assertThatThrownBy(() ->
                service.updateApplicationStatus(100, ApplicationStatus.OFFERED, null, OWNER))
                .isInstanceOf(IllegalStateException.class);

        verify(applicationRepo, never()).save(any());
    }

    @Test
    void theFirstMoveIsTheResponseAndIsWrittenToTheTimeline() {
        JobApplication application = application();
        when(applicationRepo.findById(100)).thenReturn(Optional.of(application));

        notifyingService().updateApplicationStatus(100, ApplicationStatus.REVIEWED, " Strong CV ", OWNER);

        assertThat(application.getStatus()).isEqualTo(ApplicationStatus.REVIEWED);
        assertThat(application.getRespondedAt()).isNotNull();
        ApplicationStatusEvent event = recordedEvent();
        assertThat(event.getFromStatus()).isEqualTo(ApplicationStatus.PENDING);
        assertThat(event.getToStatus()).isEqualTo(ApplicationStatus.REVIEWED);
        assertThat(event.getNote()).isEqualTo("Strong CV");
    }

    @Test
    void aLaterStageDoesNotMoveTheResponseTime() {
        JobApplication application = application();
        LocalDateTime firstAnswer = LocalDateTime.now().minusDays(3);
        application.setStatus(ApplicationStatus.REVIEWED);
        application.setRespondedAt(firstAnswer);
        when(applicationRepo.findById(100)).thenReturn(Optional.of(application));

        notifyingService().updateApplicationStatus(100, ApplicationStatus.INTERVIEW, null, OWNER);

        assertThat(application.getRespondedAt()).isEqualTo(firstAnswer);
    }

    @Test
    void refusesAnApplicationToAPostingThePublicCannotSee() {
        JobPost inReview = jobOwnedBy(OWNER);
        inReview.setStatus(JobStatus.PENDING_REVIEW);
        when(applicationRepo.findByJobPostPostIdAndApplicantId(10, APPLICANT)).thenReturn(Optional.empty());
        when(jobRepo.findById(10)).thenReturn(Optional.of(inReview));

        assertThatThrownBy(() -> service.applyToJob(10, APPLICANT, null))
                .isInstanceOf(ResourceNotFoundException.class);

        verify(applicationRepo, never()).save(any());
    }

    @Test
    void refusesApplicationsBeyondTheDailyLimit() {
        JobPost published = jobOwnedBy(OWNER);
        published.setStatus(JobStatus.PUBLISHED);
        when(applicationRepo.findByJobPostPostIdAndApplicantId(10, APPLICANT)).thenReturn(Optional.empty());
        when(jobRepo.findById(10)).thenReturn(Optional.of(published));
        when(userRepo.findById(APPLICANT)).thenReturn(Optional.of(user(APPLICANT)));
        when(applicationRepo.countByApplicantIdAndAppliedDateAfter(eq(APPLICANT), any()))
                .thenReturn((long) JobApplicationService.DAILY_APPLICATION_LIMIT);

        assertThatThrownBy(() -> service.applyToJob(10, APPLICANT, null))
                .isInstanceOf(ForbiddenOperationException.class);

        verify(applicationRepo, never()).save(any());
    }

    @Test
    void aMissedDeadlineIsMarkedButNeverCountsAsAnAnswer() {
        JobApplication application = application();
        LocalDateTime now = LocalDateTime.now();
        when(applicationRepo.findByStatusAndRespondByBefore(ApplicationStatus.PENDING, now))
                .thenReturn(List.of(application));

        assertThat(notifyingService().lapseOverdue(now)).isEqualTo(1);

        assertThat(application.getStatus()).isEqualTo(ApplicationStatus.NO_RESPONSE);
        assertThat(application.getRespondedAt()).isNull();
        assertThat(recordedEvent().getActor()).isNull();
    }

    @Test
    void onlyTheApplicantCanWithdraw() {
        when(applicationRepo.findById(100)).thenReturn(Optional.of(application()));

        assertThatThrownBy(() -> service.withdraw(100, INTRUDER))
                .isInstanceOf(ForbiddenOperationException.class);

        verify(applicationRepo, never()).save(any());
    }

    @Test
    void closingAPostingRejectsWhateverIsStillOpen() {
        JobApplication application = application();
        when(applicationRepo.findByJobPostPostIdAndStatusIn(eq(10), anyCollection()))
                .thenReturn(List.of(application));

        notifyingService().onJobClosed(new JobClosedEvent(10));

        assertThat(application.getStatus()).isEqualTo(ApplicationStatus.REJECTED);
        assertThat(application.getRespondedAt()).isNotNull();
        assertThat(recordedEvent().getNote()).isEqualTo("Position closed");
    }

    @Test
    void noResponseRateIsPublishedFromAHandfulOfApplications() {
        assertThat(JobApplicationService.summarise(4, 4, 1.0).responseRatePercent()).isNull();

        var enough = JobApplicationService.summarise(8, 6, 2.26);
        assertThat(enough.responseRatePercent()).isEqualTo(75);
        assertThat(enough.medianDays()).isEqualTo(2.3);
    }
}
