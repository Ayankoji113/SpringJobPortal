package com.tausib.springjobportal.job.dto;

import com.tausib.springjobportal.job.JobType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

/**
 * Create/update payload. Moderation state ({@code isFeatured}, {@code status}) is deliberately
 * absent — an employer must not be able to feature or approve their own posting. It is set by
 * {@code admin/} alone.
 */
@Data
public class JobRequest {

    @NotBlank(message = "Job title is required")
    private String postProfile;

    private String postDesc;

    @PositiveOrZero(message = "Required experience cannot be negative")
    private Integer reqExperience;

    private List<String> postTechStack;
    private Integer companyId;

    @PositiveOrZero(message = "Minimum salary cannot be negative")
    private BigDecimal salaryMin;

    @PositiveOrZero(message = "Maximum salary cannot be negative")
    private BigDecimal salaryMax;

    private String location;
    private JobType jobType;
    private Boolean isRemote;
    private Boolean isActive;
}
