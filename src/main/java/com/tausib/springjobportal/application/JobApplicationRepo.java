package com.tausib.springjobportal.application;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface JobApplicationRepo extends JpaRepository<JobApplication, Integer> {
    List<JobApplication> findByApplicantId(Integer applicantId);
    List<JobApplication> findByJobPostPostId(Integer postId);
    Optional<JobApplication> findByJobPostPostIdAndApplicantId(Integer postId, Integer applicantId);

    long countByJobPostPostId(Integer postId);

    long countByApplicantIdAndAppliedDateAfter(Integer applicantId, LocalDateTime since);

    List<JobApplication> findByJobPostPostIdAndStatusIn(Integer postId,
                                                        Collection<ApplicationStatus> statuses);

    /** Waiting applications whose deadline has passed. */
    List<JobApplication> findByStatusAndRespondByBefore(ApplicationStatus status, LocalDateTime cutoff);

    /** Waiting applications whose deadline is close and whose employer has not been warned yet. */
    List<JobApplication> findByStatusAndRespondByBeforeAndReminderSentAtIsNull(
            ApplicationStatus status, LocalDateTime cutoff);

    @Query("SELECT a.status, COUNT(a) FROM JobApplication a "
            + "WHERE a.jobPost.postedBy.id = :employerId GROUP BY a.status")
    List<Object[]> countByStatusForEmployer(@Param("employerId") Integer employerId);

    /**
     * How reliably an employer answers applicants, over applications made since {@code since}.
     *
     * <p>An application counts once its outcome is known: it was answered, or its deadline passed
     * unanswered. One the applicant withdrew before any answer is left out, since the employer was
     * never given the full window. Rows with no deadline predate the feature and are left out too.
     */
    @Query(value = """
            SELECT COUNT(*) AS decided,
                   COUNT(*) FILTER (WHERE a.responded_at <= a.respond_by) AS onTime,
                   PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY
                       EXTRACT(EPOCH FROM (a.responded_at - a.applied_date)) / 86400.0) AS medianDays
            FROM job_applications a
            JOIN job_post j ON j.post_id = a.job_post_id
            WHERE j.posted_by_id = :employerId
              AND a.applied_date >= :since
              AND a.respond_by IS NOT NULL
              AND (a.responded_at IS NOT NULL
                   OR (a.respond_by < :now AND a.status <> 'WITHDRAWN'))
            """, nativeQuery = true)
    ResponsivenessStats responsiveness(@Param("employerId") Integer employerId,
                                       @Param("since") LocalDateTime since,
                                       @Param("now") LocalDateTime now);

    /** Projection for {@link #responsiveness}. {@code medianDays} is null when nothing was answered. */
    interface ResponsivenessStats {
        long getDecided();
        long getOnTime();
        Double getMedianDays();
    }
}
