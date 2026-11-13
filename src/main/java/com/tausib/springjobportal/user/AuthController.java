package com.tausib.springjobportal.user;

import com.tausib.springjobportal.user.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody AuthRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/refresh-token")
    public ResponseEntity<AuthResponse> refreshToken(@Valid @RequestBody RefreshTokenRequest request) {
        return ResponseEntity.ok(authService.refresh(request.getRefreshToken()));
    }

    @PostMapping("/verify-email")
    public ResponseEntity<Map<String, String>> verifyEmail(@Valid @RequestBody TokenRequest request) {
        return authService.verifyEmail(request.getToken())
                ? ResponseEntity.ok(Map.of("message", "Email verified successfully"))
                : ResponseEntity.badRequest().body(Map.of("error", "Invalid or expired verification token"));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(@Valid @RequestBody PasswordResetRequest request) {
        authService.requestPasswordReset(request.getEmail());
        return ResponseEntity.ok(Map.of(
                "message", "If a matching account exists, a password reset email has been sent"));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(@Valid @RequestBody NewPasswordRequest request) {
        return authService.resetPassword(request.getToken(), request.getNewPassword())
                ? ResponseEntity.ok(Map.of("message", "Password reset successfully"))
                : ResponseEntity.badRequest().body(Map.of("error", "Invalid or expired reset token"));
    }
}
