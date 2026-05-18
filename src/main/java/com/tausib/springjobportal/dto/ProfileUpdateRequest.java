package com.tausib.springjobportal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ProfileUpdateRequest {
    private String fullName;
    private String phone;
    private String bio;
    private String location;
    private List<String> skills;
    private Integer experienceYears;
    private String currentJobTitle;
    private String linkedinUrl;
    private String githubUrl;
    private String portfolioUrl;
    private Boolean isProfilePublic;
}
