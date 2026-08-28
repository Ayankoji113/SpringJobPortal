package com.tausib.springjobportal.service;

import com.tausib.springjobportal.job.JobRepo;

import com.tausib.springjobportal.common.mail.EmailService;
import com.tausib.springjobportal.user.User;

import com.tausib.springjobportal.model.*;
import com.tausib.springjobportal.repo.JobApplicationRepo;
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
    private final JobRepo jobRepo;
    private final UserRepo userRepo;
    private final NotificationService notificationService;
    private final EmailService emailService;

    public JobApplication applyToJob(Integer jobId, Integer applicantId, String coverLetter) {
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

        return saved;
    }

    public List<JobApplication> getApplicationsByApplicant(Integer applicantId) {
        return applicationRepo.findByApplicantId(applicantId);
    }

    public List<JobApplication> getApplicationsByJob(Integer jobId) {
        return applicationRepo.findByJobPostPostId(jobId);
    }

    public JobApplication updateApplicationStatus(Integer applicationId, ApplicationStatus status) {
        var application = applicationRepo.findById(applicationId)
                .orElseThrow(() -> new RuntimeException("Application not found"));

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

        return updated;
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
