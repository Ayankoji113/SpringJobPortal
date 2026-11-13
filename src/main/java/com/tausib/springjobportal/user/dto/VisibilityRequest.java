package com.tausib.springjobportal.user.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class VisibilityRequest {
    @NotNull(message = "isPublic is required")
    private Boolean isPublic;
}
