package com.tausib.springjobportal.controller;

import com.tausib.springjobportal.dto.ProfileUpdateRequest;
import com.tausib.springjobportal.model.User;
import com.tausib.springjobportal.service.FileStorageService;
import com.tausib.springjobportal.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final FileStorageService fileStorageService;

    @GetMapping("/me")
    public ResponseEntity<User> getCurrentUser(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(userService.getUserById(user.getId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<User> getUserById(@PathVariable Integer id) {
        User user = userService.getUserById(id);
        // Only return public profiles for non-self lookups
        if (Boolean.FALSE.equals(user.getIsProfilePublic())) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(user);
    }

    @PutMapping("/me")
    public ResponseEntity<User> updateProfile(
            @AuthenticationPrincipal User user,
            @RequestBody ProfileUpdateRequest request
    ) {
        return ResponseEntity.ok(userService.updateProfile(user.getId(), request));
    }

    @PostMapping(value = "/me/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadProfilePhoto(
            @AuthenticationPrincipal User user,
            @RequestParam("file") MultipartFile file
    ) {
        String path = fileStorageService.storeProfilePhoto(file, user.getId());
        userService.updateProfilePhoto(user.getId(), path);
        return ResponseEntity.ok(Map.of("path", path, "message", "Photo uploaded successfully"));
    }

    @PostMapping(value = "/me/resume", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadResume(
            @AuthenticationPrincipal User user,
            @RequestParam("file") MultipartFile file
    ) {
        String path = fileStorageService.storeResume(file, user.getId());
        userService.updateResumePath(user.getId(), path);
        return ResponseEntity.ok(Map.of("path", path, "message", "Resume uploaded successfully"));
    }

    @PatchMapping("/me/visibility")
    public ResponseEntity<?> toggleVisibility(
            @AuthenticationPrincipal User user,
            @RequestBody Map<String, Boolean> request
    ) {
        User u = userService.getUserById(user.getId());
        u.setIsProfilePublic(request.getOrDefault("isPublic", true));
        return ResponseEntity.ok(Map.of("isProfilePublic", u.getIsProfilePublic()));
    }
}
