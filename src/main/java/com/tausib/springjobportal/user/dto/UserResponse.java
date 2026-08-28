package com.tausib.springjobportal.user.dto;

import com.tausib.springjobportal.user.UserRole;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/** Public projection of a user. Never carries password, tokens, or account-status internals. */
@Data
@Builder
public class UserResponse {
    private Integer id;
    private String fullName;
    private String email;
    private UserRole role;
    private String phone;
    private String bio;
    private String location;
    private String profilePhotoPath;
    private String resumePath;
    private List<String> skills;
    private Integer experienceYears;
    private String currentJobTitle;
    private String linkedinUrl;
    private String githubUrl;
    private String portfolioUrl;
    private Boolean isEmailVerified;
    private Boolean isProfilePublic;
    private LocalDateTime createdAt;
}
