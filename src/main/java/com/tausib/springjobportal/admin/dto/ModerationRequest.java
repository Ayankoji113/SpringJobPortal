package com.tausib.springjobportal.admin.dto;

import com.tausib.springjobportal.job.JobStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/** An admin's decision on one posting. A reason is required for anything but publication. */
@Data
public class ModerationRequest {

    @NotNull(message = "A decision is required")
    private JobStatus status;

    private String reason;
}
