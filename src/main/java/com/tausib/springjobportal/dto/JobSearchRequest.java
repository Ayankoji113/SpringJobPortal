package com.tausib.springjobportal.dto;

import com.tausib.springjobportal.model.JobType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class JobSearchRequest {
    private String keyword;
    private String location;
    private JobType jobType;
    private Boolean isRemote;
    private Integer minExperience;
    private Integer maxExperience;
    private Integer page;
    private Integer size;
    private String sortBy;     // "postedDate", "salary", "viewCount"
    private String sortDir;    // "asc", "desc"
}
