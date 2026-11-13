package com.tausib.springjobportal.application;

import com.tausib.springjobportal.application.dto.ApplicationResponse;
import com.tausib.springjobportal.application.dto.EmployerResponsiveness;
import com.tausib.springjobportal.application.dto.TimelineEntry;
import com.tausib.springjobportal.common.exception.ForbiddenOperationException;
import com.tausib.springjobportal.common.exception.ResourceNotFoundException;
import com.tausib.springjobportal.common.mail.EmailService;
import com.tausib.springjobportal.file.FileStorageService;
import com.tausib.springjobportal.job.JobClosedEvent;
import com.tausib.springjobportal.job.JobPost;
import com.tausib.springjobportal.job.JobRepo;
import com.tausib.springjobportal.job.JobStatus;
import com.tausib.springjobportal.notification.NotificationService;
import com.tausib.springjobportal.notification.NotificationType;
import com.tausib.springjobportal.user.User;
import com.tausib.springjobportal.user.UserRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * The life of an application: submitted, moved through the employer's stages, and always resolved.
 *
 * <p>Every status change goes through {@link #transition}, which writes the timeline row in the
 * same transaction, so the timeline cannot disagree with the status.
 */
@Service
@RequiredArgsConstructor
public class JobApplicationService {

    /** Days an employer has to act on a new application before it is marked unanswered. */
    static final int RESPONSE_DAYS = 14;
    /** The employer is warned this many days before the deadline. */
    static final int REMINDER_DAYS_BEFORE = 4;
    /** Responsiveness is measured over applications made in this many days. */
    static final int RESPONSIVENESS_WINDOW_DAYS = 90;
    /** Applications one person may submit in 24 hours. Every one puts a deadline on an employer. */
    static final int DAILY_APPLICATION_LIMIT = 20;
    /** Below this many known outcomes a response rate is noise, so none is published. */
    static final int RESPONSIVENESS_MIN_SAMPLE = 5;

    private static final List<ApplicationStatus> OPEN_STATUSES =
            Arrays.stream(ApplicationStatus.values()).filter(ApplicationStatus::isOpen).toList();

    private final JobApplicationRepo applicationRepo;
    private final ApplicationStatusEventRepo eventRepo;
    private final ApplicationMapper applicationMapper;
    private final JobRepo jobRepo;
    private final UserRepo userRepo;
    private final NotificationService notificationService;
    private final EmailService emailService;
    private final FileStorageService fileStorageService;

    @Transactional
    public ApplicationResponse applyToJob(Integer jobId, Integer applicantId, String coverLetter) {
        if (applicationRepo.findByJobPostPostIdAndApplicantId(jobId, applicantId).isPresent()) {
            throw new RuntimeException("You have already applied to this job");
        }

        // Only a posting the public can see accepts applications. Looking it up by id alone let
        // anyone apply to one still in review, rejected, or switched off by its employer.
        var job = jobRepo.findById(jobId)
                .filter(j -> j.getStatus() == JobStatus.PUBLISHED && Boolean.TRUE.equals(j.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Job not found with id: " + jobId));
        var applicant = userRepo.findById(applicantId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + applicantId));

        LocalDateTime now = LocalDateTime.now();
        if (applicationRepo.countByApplicantIdAndAppliedDateAfter(applicantId, now.minusDays(1))
                >= DAILY_APPLICATION_LIMIT) {
            throw new ForbiddenOperationException("You have reached the limit of "
                    + DAILY_APPLICATION_LIMIT + " applications in 24 hours");
        }

        JobApplication saved = applicationRepo.save(JobApplication.builder()
                .jobPost(job)
                .applicant(applicant)
                .coverLetter(coverLetter)
                .status(ApplicationStatus.PENDING)
                .respondBy(now.plusDays(RESPONSE_DAYS))
                .build());
        record(saved, null, ApplicationStatus.PENDING, applicant, null, now);

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

    @Transactional(readOnly = true)
    public List<ApplicationResponse> getApplicationsByApplicant(Integer applicantId) {
        return applicationRepo.findByApplicantId(applicantId).stream()
                .map(applicationMapper::toResponse).toList();
    }

    /** Employer-facing: only the employer who posted the job may read its applicants. */
    @Transactional(readOnly = true)
    public List<ApplicationResponse> getApplicationsByJob(Integer jobId, Integer employerId) {
        JobPost job = jobRepo.findById(jobId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found with id: " + jobId));
        requireJobOwner(job, employerId);
        return applicationRepo.findByJobPostPostId(jobId).stream()
                .map(applicationMapper::toResponse).toList();
    }

    /**
     * The employer moves an application to its next stage, or rejects it. Only the moves in
     * {@link ApplicationStatus#nextForEmployer()} are accepted. The first such move is the
     * employer's response; a late one is still recorded, but the missed deadline stands.
     */
    @Transactional
    public ApplicationResponse updateApplicationStatus(Integer applicationId, ApplicationStatus status,
                                                      String note, Integer employerId) {
        JobApplication application = getApplication(applicationId);
        requireJobOwner(application.getJobPost(), employerId);

        ApplicationStatus from = application.getStatus();
        if (!from.nextForEmployer().contains(status)) {
            throw new IllegalStateException("An application that is " + label(from)
                    + " cannot be moved to " + label(status));
        }

        LocalDateTime now = LocalDateTime.now();
        markAnswered(application, now);
        JobApplication updated = transition(application, status,
                userRepo.getReferenceById(employerId), note, now);
        notifyApplicant(updated, note);
        return applicationMapper.toResponse(updated);
    }

    /** The applicant pulls out. Allowed at any point before the application is finished. */
    @Transactional
    public ApplicationResponse withdraw(Integer applicationId, Integer applicantId) {
        JobApplication application = getApplication(applicationId);
        if (!application.getApplicant().getId().equals(applicantId)) {
            throw new ForbiddenOperationException("This is not your application");
        }
        if (!application.getStatus().isOpen()) {
            throw new IllegalStateException("This application is already closed");
        }

        JobApplication updated = transition(application, ApplicationStatus.WITHDRAWN,
                application.getApplicant(), null, LocalDateTime.now());

        User employer = updated.getJobPost().getPostedBy();
        if (employer != null) {
            notificationService.createNotification(
                    employer,
                    "Application withdrawn",
                    updated.getApplicant().getFullName() + " withdrew their application for "
                            + updated.getJobPost().getPostProfile(),
                    NotificationType.APPLICATION_STATUS_CHANGED,
                    "/manage-applications"
            );
        }
        return applicationMapper.toResponse(updated);
    }

    /** Every status change of one application, oldest first. For the applicant and the job owner. */
    @Transactional(readOnly = true)
    public List<TimelineEntry> getTimeline(Integer applicationId, Integer callerId) {
        JobApplication application = getApplication(applicationId);
        requireApplicantOrJobOwner(application, callerId);

        Integer applicantId = application.getApplicant().getId();
        return eventRepo.findByApplicationIdOrderByCreatedAtAscIdAsc(applicationId).stream()
                .map(e -> new TimelineEntry(
                        e.getFromStatus(),
                        e.getToStatus(),
                        e.getActor() == null ? "SYSTEM"
                                : e.getActor().getId().equals(applicantId) ? "APPLICANT" : "EMPLOYER",
                        e.getNote(),
                        e.getCreatedAt()))
                .toList();
    }

    /**
     * A posting was taken down: nobody still in play on it is left waiting. Runs inside the
     * transaction that closed the posting.
     */
    @EventListener
    @Transactional
    public void onJobClosed(JobClosedEvent event) {
        LocalDateTime now = LocalDateTime.now();
        for (JobApplication application :
                applicationRepo.findByJobPostPostIdAndStatusIn(event.postId(), OPEN_STATUSES)) {
            markAnswered(application, now);
            String note = "Position closed";
            notifyApplicant(transition(application, ApplicationStatus.REJECTED, null, note, now), note);
        }
    }

    /**
     * Marks every application the employer left untouched past its deadline, and tells the
     * applicant. Called by {@link ApplicationDeadlineTask}.
     *
     * @return how many lapsed
     */
    @Transactional
    public int lapseOverdue(LocalDateTime now) {
        List<JobApplication> overdue =
                applicationRepo.findByStatusAndRespondByBefore(ApplicationStatus.PENDING, now);
        for (JobApplication application : overdue) {
            String note = "No response within " + RESPONSE_DAYS + " days";
            notifyApplicant(transition(application, ApplicationStatus.NO_RESPONSE, null, note, now), note);
        }
        return overdue.size();
    }

    /**
     * Warns each employer once about applications close to lapsing: one notification and one
     * email per employer, however many applications are waiting.
     *
     * @return how many employers were warned
     */
    @Transactional
    public int sendDeadlineReminders(LocalDateTime now) {
        Map<Integer, List<JobApplication>> byEmployer = applicationRepo
                .findByStatusAndRespondByBeforeAndReminderSentAtIsNull(
                        ApplicationStatus.PENDING, now.plusDays(REMINDER_DAYS_BEFORE))
                .stream()
                .filter(a -> a.getJobPost().getPostedBy() != null)
                .collect(Collectors.groupingBy(a -> a.getJobPost().getPostedBy().getId()));

        byEmployer.values().forEach(waiting -> {
            User employer = waiting.get(0).getJobPost().getPostedBy();
            notificationService.createNotification(
                    employer,
                    "Applications waiting for a response",
                    waiting.size() + " application(s) will be marked unanswered within "
                            + REMINDER_DAYS_BEFORE + " days",
                    NotificationType.APPLICATION_RECEIVED,
                    "/manage-applications"
            );
            emailService.sendResponseReminderEmail(employer.getEmail(), waiting.size());
            waiting.forEach(a -> a.setReminderSentAt(now));
            applicationRepo.saveAll(waiting);
        });
        return byEmployer.size();
    }

    /**
     * How reliably an employer answers applicants. Public: it is shown on their postings. The rate
     * and median are withheld until enough outcomes are known.
     */
    @Transactional(readOnly = true)
    public EmployerResponsiveness getResponsiveness(Integer employerId) {
        LocalDateTime now = LocalDateTime.now();
        var stats = applicationRepo.responsiveness(
                employerId, now.minusDays(RESPONSIVENESS_WINDOW_DAYS), now);
        return summarise(stats.getDecided(), stats.getOnTime(), stats.getMedianDays());
    }

    static EmployerResponsiveness summarise(long decided, long onTime, Double medianDays) {
        if (decided < RESPONSIVENESS_MIN_SAMPLE) {
            return new EmployerResponsiveness(decided, null, null);
        }
        return new EmployerResponsiveness(
                decided,
                (int) Math.round(100.0 * onTime / decided),
                medianDays == null ? null : Math.round(medianDays * 10) / 10.0);
    }

    /**
     * The applicant's resume, readable by the employer who posted the job and by the applicant
     * themselves. Resumes are reachable only this way: the file endpoint is unauthenticated and
     * refuses the resumes directory outright.
     */
    @Transactional(readOnly = true)
    public ResumeDownload getApplicantResume(Integer applicationId, Integer callerId) {
        JobApplication application = getApplication(applicationId);
        requireApplicantOrJobOwner(application, callerId);

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

    @Transactional(readOnly = true)
    public long countByJob(Integer jobId) {
        return applicationRepo.countByJobPostPostId(jobId);
    }

    @Transactional(readOnly = true)
    public Map<String, Long> getStatusBreakdown(Integer employerId) {
        Map<String, Long> breakdown = new LinkedHashMap<>();
        for (Object[] row : applicationRepo.countByStatusForEmployer(employerId)) {
            breakdown.put(((ApplicationStatus) row[0]).name(), (Long) row[1]);
        }
        return breakdown;
    }

    private JobApplication getApplication(Integer applicationId) {
        return applicationRepo.findById(applicationId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Application not found with id: " + applicationId));
    }

    /** The one place a status changes. Saves the application and its timeline row together. */
    private JobApplication transition(JobApplication application, ApplicationStatus to, User actor,
                                      String note, LocalDateTime now) {
        ApplicationStatus from = application.getStatus();
        application.setStatus(to);
        JobApplication saved = applicationRepo.save(application);
        record(saved, from, to, actor, note, now);
        return saved;
    }

    private void record(JobApplication application, ApplicationStatus from, ApplicationStatus to,
                        User actor, String note, LocalDateTime now) {
        eventRepo.save(ApplicationStatusEvent.builder()
                .application(application)
                .fromStatus(from)
                .toStatus(to)
                .actor(actor)
                .note(note == null || note.isBlank() ? null : note.trim())
                .createdAt(now)
                .build());
    }

    /** The first answer is the one that counts; a later stage never moves it. */
    private static void markAnswered(JobApplication application, LocalDateTime now) {
        if (application.getRespondedAt() == null) {
            application.setRespondedAt(now);
        }
    }

    private void notifyApplicant(JobApplication application, String note) {
        String jobTitle = application.getJobPost().getPostProfile();
        String status = label(application.getStatus());
        notificationService.createNotification(
                application.getApplicant(),
                "Application Status Updated",
                "Your application for " + jobTitle + " is now: " + status
                        + (note == null || note.isBlank() ? "" : " (" + note.trim() + ")"),
                NotificationType.APPLICATION_STATUS_CHANGED,
                "/my-applications"
        );
        emailService.sendStatusUpdateEmail(application.getApplicant().getEmail(), jobTitle, status);
    }

    private static String label(ApplicationStatus status) {
        return status.name().toLowerCase().replace('_', ' ');
    }

    private void requireApplicantOrJobOwner(JobApplication application, Integer callerId) {
        if (!application.getApplicant().getId().equals(callerId)) {
            requireJobOwner(application.getJobPost(), callerId);
        }
    }

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
}
