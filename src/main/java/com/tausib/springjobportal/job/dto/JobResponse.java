package com.tausib.springjobportal.job.dto;

import com.tausib.springjobportal.company.dto.CompanySummaryResponse;
import com.tausib.springjobportal.job.JobStatus;
import com.tausib.springjobportal.job.JobType;
import com.tausib.springjobportal.user.dto.UserSummaryResponse;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class JobResponse {
    private Integer postId;
    private String postProfile;
    private String postDesc;
    private Integer reqExperience;
    private List<String> postTechStack;
    private UserSummaryResponse postedBy;
    private CompanySummaryResponse company;
    private BigDecimal salaryMin;
    private BigDecimal salaryMax;
    private String location;
    private JobType jobType;
    private Boolean isRemote;
    private Boolean isActive;
    private Boolean isFeatured;
    private JobStatus status;
    /** Populated only for rejected or suspended postings; the employer is the audience. */
    private String moderationReason;
    private Integer viewCount;
    private LocalDateTime postedDate;
}
