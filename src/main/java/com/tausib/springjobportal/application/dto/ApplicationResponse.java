package com.tausib.springjobportal.application.dto;

import com.tausib.springjobportal.application.ApplicationStatus;
import com.tausib.springjobportal.job.dto.JobResponse;
import com.tausib.springjobportal.user.dto.UserSummaryResponse;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Wire shape of an application. The module used to return the {@code JobApplication} entity, whose
 * applicant is a {@code User} excluding only password and authorities — so every other column,
 * {@code passwordResetToken} and {@code emailVerificationToken} included, was serialised to whoever
 * could read the applicant list. The applicant is a summary projection here for that reason.
 */
@Data
@Builder
public class ApplicationResponse {
    private Integer id;
    private JobResponse jobPost;
    private UserSummaryResponse applicant;
    private String coverLetter;
    private ApplicationStatus status;
    private LocalDateTime appliedDate;
    private LocalDateTime respondBy;
    private LocalDateTime respondedAt;
    /** The stages the employer may move this application to next. Empty once it is finished. */
    private List<ApplicationStatus> nextStatuses;
}
