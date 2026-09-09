package com.tausib.springjobportal.application;

import com.tausib.springjobportal.application.dto.ApplicationResponse;
import com.tausib.springjobportal.common.exception.ForbiddenOperationException;
import com.tausib.springjobportal.common.exception.ResourceNotFoundException;
import com.tausib.springjobportal.job.JobPost;
import com.tausib.springjobportal.job.JobRepo;
import com.tausib.springjobportal.notification.NotificationType;
import com.tausib.springjobportal.notification.NotificationService;

import com.tausib.springjobportal.common.mail.EmailService;

import com.tausib.springjobportal.file.FileStorageService;

import com.tausib.springjobportal.user.UserRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class JobApplicationService {

    private final JobApplicationRepo applicationRepo;
    private final ApplicationMapper applicationMapper;
    private final JobRepo jobRepo;
    private final UserRepo userRepo;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final FileStorageService fileStorageService;

    public ApplicationResponse applyToJob(Integer jobId, Integer applicantId, String coverLetter) {
        if (applicationRepo.findByJobPostPostIdAndApplicantId(jobId, applicantId).isPresent()) {
            throw new RuntimeException("You have already applied to this job");
        }

        var job = jobRepo.findById(jobId).orElseThrow(() -> new RuntimeException("Job not found"));
        var applicant = userRepo.findById(applicantId).orElseThrow(() -> new RuntimeException("User not found"));

        var application = JobApplication.builder()
                .jobPost(job)
                .applicant(applicant)
                .coverLetter(coverLetter)
                .status(ApplicationStatus.PENDING)
                .build();

        JobApplication saved = applicationRepo.save(application);

        // Notify the employer
        if (job.getPostedBy() != null) {
            notificationService.createNotification(
                    job.getPostedBy(),
                    "New Application",
                    applicant.getFullName() + " applied for " + job.getPostProfile(),
                    NotificationType.APPLICATION_RECEIVED,
                    "/manage-applications"
            );
            emailService.sendApplicationNotification(
                    job.getPostedBy().getEmail(),
                    job.getPostProfile(),
                    applicant.getFullName()
            );
        }

        return applicationMapper.toResponse(saved);
    }

    public List<ApplicationResponse> getApplicationsByApplicant(Integer applicantId) {
        return applicationRepo.findByApplicantId(applicantId).stream()
                .map(applicationMapper::toResponse).toList();
    }

    /** Employer-facing: only the employer who posted the job may read its applicants. */
    public List<ApplicationResponse> getApplicationsByJob(Integer jobId, Integer employerId) {
        JobPost job = jobRepo.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found with id: " + jobId));
        requireJobOwner(job, employerId);
        return applicationRepo.findByJobPostPostId(jobId).stream()
                .map(applicationMapper::toResponse).toList();
    }

    public ApplicationResponse updateApplicationStatus(Integer applicationId, ApplicationStatus status,
                                                      Integer employerId) {
        var application = applicationRepo.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Application not found with id: " + applicationId));

        requireJobOwner(application.getJobPost(), employerId);

        application.setStatus(status);
        JobApplication updated = applicationRepo.save(application);

        // Notify the applicant
        notificationService.createNotification(
                application.getApplicant(),
                "Application Status Updated",
                "Your application for " + application.getJobPost().getPostProfile() + " is now: " + status.name(),
                NotificationType.APPLICATION_STATUS_CHANGED,
                "/my-applications"
        );
        emailService.sendStatusUpdateEmail(
                application.getApplicant().getEmail(),
                application.getJobPost().getPostProfile(),
                status.name()
        );

        return applicationMapper.toResponse(updated);
    }

    /**
     * The applicant's resume, readable by the employer who posted the job and by the applicant
     * themselves. Resumes are reachable only this way: the file endpoint is unauthenticated and
     * refuses the resumes directory outright.
     */
    public ResumeDownload getApplicantResume(Integer applicationId, Integer callerId) {
        JobApplication application = applicationRepo.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Application not found with id: " + applicationId));

        boolean isApplicant = application.getApplicant().getId().equals(callerId);
        if (!isApplicant) {
            requireJobOwner(application.getJobPost(), callerId);
        }

        String path = application.getApplicant().getResumePath();
        if (path == null) {
            throw new ResourceNotFoundException("This applicant has not uploaded a resume");
        }

        return new ResumeDownload(
                fileStorageService.loadFile(path),
                FileStorageService.contentTypeFor(path),
                path.substring(path.lastIndexOf('/') + 1));
    }

    /** A resume's bytes plus what the browser needs to render them. */
    public record ResumeDownload(byte[] content, String contentType, String filename) {}

    /**
     * The authorization rule for everything an employer does to an application: the job it belongs
     * to must be theirs. Enforced here rather than in the controller because the auto-apply path in
     * {@code matching/} calls this service directly, bypassing any controller-level check.
     */
    private void requireJobOwner(JobPost job, Integer employerId) {
        if (job.getPostedBy() == null || !job.getPostedBy().getId().equals(employerId)) {
            throw new ForbiddenOperationException("You do not own this job posting");
        }
    }

    public long countByJob(Integer jobId) {
        return applicationRepo.findByJobPostPostId(jobId).size();
    }

    public Map<String, Long> getStatusBreakdown(Integer employerId) {
        List<JobApplication> all = applicationRepo.findAll().stream()
                .filter(a -> a.getJobPost().getPostedBy() != null &&
                        a.getJobPost().getPostedBy().getId().equals(employerId))
                .collect(Collectors.toList());

        return all.stream()
                .collect(Collectors.groupingBy(
                        a -> a.getStatus().name(),
                        Collectors.counting()
                ));
    }
}
