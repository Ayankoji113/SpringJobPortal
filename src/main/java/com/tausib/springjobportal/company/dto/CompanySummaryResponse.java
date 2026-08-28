package com.tausib.springjobportal.company.dto;

import lombok.Builder;
import lombok.Data;

/** Minimal company projection for embedding in other modules' responses. */
@Data
@Builder
public class CompanySummaryResponse {
    private Integer id;
    private String name;
    private String logoPath;
    private String location;
}
