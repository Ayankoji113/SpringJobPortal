package com.tausib.springjobportal.dto;

import com.tausib.springjobportal.model.UserRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class AuthResponse {
    private String token;
    private String refreshToken;
    private Integer id;
    private String fullName;
    private String email;
    private UserRole role;
    private String profilePhotoPath;
    private List<String> skills;
}
