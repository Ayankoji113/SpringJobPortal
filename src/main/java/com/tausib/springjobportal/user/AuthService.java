package com.tausib.springjobportal.user;

import com.tausib.springjobportal.common.exception.ForbiddenOperationException;
import com.tausib.springjobportal.common.mail.EmailService;
import com.tausib.springjobportal.common.security.JwtService;
import com.tausib.springjobportal.user.dto.AuthRequest;
import com.tausib.springjobportal.user.dto.AuthResponse;
import com.tausib.springjobportal.user.dto.RegisterRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

/** Registration, login, token refresh, email verification and password reset. */
@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepo userRepo;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuthenticationManager authenticationManager;
    private final RefreshTokenService refreshTokenService;
    private final EmailService emailService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        // The role arrives in the request body, so this endpoint would otherwise hand out ADMIN
        // to anyone who asked for it.
        if (!request.getRole().isSelfAssignable()) {
            throw new ForbiddenOperationException("That role cannot be chosen at registration");
        }

        if (userRepo.findByEmail(request.getEmail()).isPresent()) {
            throw new EmailAlreadyRegisteredException("Email already registered");
        }

        User user = userRepo.save(User.builder()
                .fullName(request.getFullName())
                .email(request.getEmail())
                .password(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .isEmailVerified(false)
                .isProfilePublic(true)
                .isBanned(false)
                .build());

        sendVerificationEmail(user);
        return issueTokens(user);
    }

    @Transactional
    public AuthResponse login(AuthRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

        User user = userRepo.findByEmail(request.getEmail())
                .orElseThrow(() -> new BadCredentialsFailure("Invalid email or password"));

        if (Boolean.TRUE.equals(user.getIsBanned())) {
            throw new DisabledException("Your account has been suspended");
        }

        return issueTokens(user);
    }

    @Transactional
    public AuthResponse refresh(String refreshToken) {
        RefreshToken stored = refreshTokenService.verifyRefreshToken(refreshToken);
        User user = stored.getUser();
        return AuthResponse.builder()
                .token(jwtService.generateToken(UserPrincipal.from(user)))
                .refreshToken(refreshToken)
                .id(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .role(user.getRole())
                .build();
    }

    @Transactional
    public void sendVerificationEmail(User user) {
        String token = UUID.randomUUID().toString();
        user.setEmailVerificationToken(token);
        userRepo.save(user);
        emailService.sendVerificationEmail(user.getEmail(), token);
    }

    @Transactional
    public boolean verifyEmail(String token) {
        return userRepo.findByEmailVerificationToken(token)
                .map(user -> {
                    user.setIsEmailVerified(true);
                    user.setEmailVerificationToken(null);
                    userRepo.save(user);
                    return true;
                })
                .orElse(false);
    }

    /** Always succeeds from the caller's point of view, so it cannot be used to enumerate accounts. */
    @Transactional
    public void requestPasswordReset(String email) {
        userRepo.findByEmail(email).ifPresent(user -> {
            String token = UUID.randomUUID().toString();
            user.setPasswordResetToken(token);
            user.setPasswordResetExpiry(LocalDateTime.now().plusHours(1));
            userRepo.save(user);
            emailService.sendPasswordResetEmail(email, token);
        });
    }

    @Transactional
    public boolean resetPassword(String token, String newPassword) {
        return userRepo.findByPasswordResetToken(token)
                .filter(user -> user.getPasswordResetExpiry() != null
                        && user.getPasswordResetExpiry().isAfter(LocalDateTime.now()))
                .map(user -> {
                    user.setPassword(passwordEncoder.encode(newPassword));
                    user.setPasswordResetToken(null);
                    user.setPasswordResetExpiry(null);
                    userRepo.save(user);
                    return true;
                })
                .orElse(false);
    }

    private AuthResponse issueTokens(User user) {
        return AuthResponse.builder()
                .token(jwtService.generateToken(UserPrincipal.from(user)))
                .refreshToken(refreshTokenService.createRefreshToken(user).getToken())
                .id(user.getId())
                .fullName(user.getFullName())
                .email(user.getEmail())
                .role(user.getRole())
                .profilePhotoPath(user.getProfilePhotoPath())
                .skills(user.getSkills())
                .build();
    }

    /** Thrown when registration collides with an existing account. */
    public static class EmailAlreadyRegisteredException extends RuntimeException {
        public EmailAlreadyRegisteredException(String message) {
            super(message);
        }
    }

    /** Thrown when a user authenticates but cannot then be loaded. */
    public static class BadCredentialsFailure extends RuntimeException {
        public BadCredentialsFailure(String message) {
            super(message);
        }
    }
}
