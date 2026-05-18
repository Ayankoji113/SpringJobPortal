package com.tausib.springjobportal.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class CompanyRequest {
    @NotBlank(message = "Company name is required")
    private String name;
    private String description;
    private String website;
    private String location;
    private String industry;
    private String size;
}
