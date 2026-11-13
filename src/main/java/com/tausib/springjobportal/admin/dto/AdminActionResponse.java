package com.tausib.springjobportal.admin.dto;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class AdminActionResponse {
    private Integer id;
    private String adminEmail;
    private String action;
    private String targetType;
    private Integer targetId;
    private String reason;
    private LocalDateTime createdAt;
}
