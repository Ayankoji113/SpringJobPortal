package com.tausib.springjobportal.application;

import com.tausib.springjobportal.common.exception.ForbiddenOperationException;
import com.tausib.springjobportal.file.FileStorageService;
import com.tausib.springjobportal.job.JobPost;
import com.tausib.springjobportal.job.JobRepo;
import com.tausib.springjobportal.user.User;
import com.tausib.springjobportal.user.UserRepo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
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

    JobApplicationService service;

    @BeforeEach
    void setUp(@TempDir Path uploads) throws IOException {
        FileStorageService fileStorageService = new FileStorageService(uploads.toString());
        Files.writeString(uploads.resolve(RESUME), "pdf-bytes");
        service = new JobApplicationService(
                applicationRepo, applicationMapper, jobRepo, userRepo, null, null, fileStorageService);
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
                service.updateApplicationStatus(100, ApplicationStatus.REJECTED, INTRUDER))
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
}
