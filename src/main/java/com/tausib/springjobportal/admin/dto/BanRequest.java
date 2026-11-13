package com.tausib.springjobportal.admin.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class BanRequest {

    @NotNull(message = "Say whether the account is banned or not")
    private Boolean banned;

    private String reason;
}
