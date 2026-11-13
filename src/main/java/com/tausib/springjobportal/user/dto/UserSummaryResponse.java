package com.tausib.springjobportal.user.dto;

import lombok.Builder;
import lombok.Data;

/** Minimal user projection for embedding in other modules' responses. */
@Data
@Builder
public class UserSummaryResponse {
    private Integer id;
    private String fullName;
    private String email;
    private String profilePhotoPath;
    private String currentJobTitle;
}
