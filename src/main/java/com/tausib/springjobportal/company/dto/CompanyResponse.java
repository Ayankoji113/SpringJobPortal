package com.tausib.springjobportal.company.dto;

import com.tausib.springjobportal.user.dto.UserSummaryResponse;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class CompanyResponse {
    private Integer id;
    private String name;
    private String description;
    private String website;
    private String location;
    private String industry;
    private String size;
    private String logoPath;
    private UserSummaryResponse owner;
    private LocalDateTime createdAt;
}
