package com.tausib.springjobportal.service;

import com.tausib.springjobportal.dto.ProfileUpdateRequest;
import com.tausib.springjobportal.exception.ResourceNotFoundException;
import com.tausib.springjobportal.model.User;
import com.tausib.springjobportal.repo.UserRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepo userRepo;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    public User getUserById(Integer id) {
        return userRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
    }

    public User getUserByEmail(String email) {
        return userRepo.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + email));
    }

    public User updateProfile(Integer userId, ProfileUpdateRequest request) {
        User user = getUserById(userId);

        if (request.getFullName() != null) user.setFullName(request.getFullName());
        if (request.getPhone() != null) user.setPhone(request.getPhone());
        if (request.getBio() != null) user.setBio(request.getBio());
        if (request.getLocation() != null) user.setLocation(request.getLocation());
        if (request.getSkills() != null) user.setSkills(request.getSkills());
        if (request.getExperienceYears() != null) user.setExperienceYears(request.getExperienceYears());
        if (request.getCurrentJobTitle() != null) user.setCurrentJobTitle(request.getCurrentJobTitle());
        if (request.getLinkedinUrl() != null) user.setLinkedinUrl(request.getLinkedinUrl());
        if (request.getGithubUrl() != null) user.setGithubUrl(request.getGithubUrl());
        if (request.getPortfolioUrl() != null) user.setPortfolioUrl(request.getPortfolioUrl());
        if (request.getIsProfilePublic() != null) user.setIsProfilePublic(request.getIsProfilePublic());

        return userRepo.save(user);
    }

    public void updateProfilePhoto(Integer userId, String path) {
        User user = getUserById(userId);
        user.setProfilePhotoPath(path);
        userRepo.save(user);
    }

    public void updateResumePath(Integer userId, String path) {
        User user = getUserById(userId);
        user.setResumePath(path);
        userRepo.save(user);
    }

    // Email Verification
    public String generateVerificationToken(User user) {
        String token = UUID.randomUUID().toString();
        user.setEmailVerificationToken(token);
        userRepo.save(user);
        emailService.sendVerificationEmail(user.getEmail(), token);
        return token;
    }

    public boolean verifyEmail(String token) {
        var userOpt = userRepo.findByEmailVerificationToken(token);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            user.setIsEmailVerified(true);
            user.setEmailVerificationToken(null);
            userRepo.save(user);
            return true;
        }
        return false;
    }

    // Password Reset
    public void requestPasswordReset(String email) {
        var userOpt = userRepo.findByEmail(email);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            String token = UUID.randomUUID().toString();
            user.setPasswordResetToken(token);
            user.setPasswordResetExpiry(LocalDateTime.now().plusHours(1));
            userRepo.save(user);
            emailService.sendPasswordResetEmail(email, token);
        }
        // Silently ignore if user not found (security best practice)
    }

    public boolean resetPassword(String token, String newPassword) {
        var userOpt = userRepo.findByPasswordResetToken(token);
        if (userOpt.isPresent()) {
            User user = userOpt.get();
            if (user.getPasswordResetExpiry() != null && user.getPasswordResetExpiry().isAfter(LocalDateTime.now())) {
                user.setPassword(passwordEncoder.encode(newPassword));
                user.setPasswordResetToken(null);
                user.setPasswordResetExpiry(null);
                userRepo.save(user);
                return true;
            }
        }
        return false;
    }

    // Admin functions
    public void banUser(Integer userId) {
        User user = getUserById(userId);
        user.setIsBanned(true);
        userRepo.save(user);
    }

    public void unbanUser(Integer userId) {
        User user = getUserById(userId);
        user.setIsBanned(false);
        userRepo.save(user);
    }

    public void deleteUser(Integer userId) {
        if (!userRepo.existsById(userId)) {
            throw new ResourceNotFoundException("User not found with id: " + userId);
        }
        userRepo.deleteById(userId);
    }

    public List<User> getAllUsers() {
        return userRepo.findAll();
    }

    public List<User> searchUsers(String keyword) {
        return userRepo.searchUsers(keyword);
    }
}
