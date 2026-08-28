package com.tausib.springjobportal.job.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class SavedJobResponse {
    private Integer id;
    private JobResponse jobPost;
    private LocalDateTime savedAt;
}
