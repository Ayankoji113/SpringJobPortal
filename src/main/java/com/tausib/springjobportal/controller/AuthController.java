package com.tausib.springjobportal.controller;

import com.tausib.springjobportal.config.JwtService;
import com.tausib.springjobportal.dto.*;
import com.tausib.springjobportal.model.User;
import com.tausib.springjobportal.repo.UserRepo;
import com.tausib.springjobportal.service.RefreshTokenService;
import com.tausib.springjobportal.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepo repository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final RefreshTokenService refreshTokenService;
    private final UserService userService;

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody RegisterRequest request) {
        if (repository.findByEmail(request.getEmail()).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Email already registered"));
        }

        var user = User.builder()
                .fullName(request.getFullName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .isEmailVerified(false)
                .isProfilePublic(true)
                .isBanned(false)
                .build();

        repository.save(user);

        // Send verification email
        userService.generateVerificationToken(user);

        var jwtToken = jwtService.generateToken(user);
        var refreshToken = refreshTokenService.createRefreshToken(user);

        return ResponseEntity.ok(AuthResponse.builder()
                .token(jwtToken)
                .refreshToken(refreshToken.getToken())
                .id(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .role(user.getRole())
                .build());
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody AuthRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.getEmail(),
                        request.getPassword()
                )
        );
        var user = repository.findByEmail(request.getEmail())
                .orElseThrow();

        if (Boolean.TRUE.equals(user.getIsBanned())) {
            return ResponseEntity.status(403).body(Map.of("error", "Your account has been suspended"));
        }

        var jwtToken = jwtService.generateToken(user);
        var refreshToken = refreshTokenService.createRefreshToken(user);

        return ResponseEntity.ok(AuthResponse.builder()
                .token(jwtToken)
                .refreshToken(refreshToken.getToken())
                .id(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .role(user.getRole())
                .profilePhotoPath(user.getProfilePhotoPath())
                .skills(user.getSkills())
                .build());
    }

    @PostMapping("/refresh-token")
    public ResponseEntity<?> refreshToken(@RequestBody Map<String, String> request) {
        String token = request.get("refreshToken");
        var refreshToken = refreshTokenService.verifyRefreshToken(token);
        var user = refreshToken.getUser();
        var newJwtToken = jwtService.generateToken(user);

        return ResponseEntity.ok(Map.of(
                "token", newJwtToken,
                "refreshToken", token
        ));
    }

    @PostMapping("/verify-email")
    public ResponseEntity<?> verifyEmail(@RequestBody Map<String, String> request) {
        String token = request.get("token");
        boolean verified = userService.verifyEmail(token);
        if (verified) {
            return ResponseEntity.ok(Map.of("message", "Email verified successfully"));
        }
        return ResponseEntity.badRequest().body(Map.of("error", "Invalid or expired verification token"));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody PasswordResetRequest request) {
        userService.requestPasswordReset(request.getEmail());
        return ResponseEntity.ok(Map.of("message", "If a matching account exists, a password reset email has been sent"));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<?> resetPassword(@Valid @RequestBody NewPasswordRequest request) {
        boolean reset = userService.resetPassword(request.getToken(), request.getNewPassword());
        if (reset) {
            return ResponseEntity.ok(Map.of("message", "Password reset successfully"));
        }
        return ResponseEntity.badRequest().body(Map.of("error", "Invalid or expired reset token"));
    }
}
