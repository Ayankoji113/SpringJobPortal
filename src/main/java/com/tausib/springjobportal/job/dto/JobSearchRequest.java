package com.tausib.springjobportal.job.dto;

import com.tausib.springjobportal.job.JobType;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class JobSearchRequest {
    private String keyword;
    private String location;
    private JobType jobType;
    private Boolean isRemote;
    private Integer minExperience;
    private Integer maxExperience;
    private Integer page;
    private Integer size;
    private String sortBy;
    private String sortDir;
}
