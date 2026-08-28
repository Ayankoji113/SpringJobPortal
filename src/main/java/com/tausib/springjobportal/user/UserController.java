package com.tausib.springjobportal.user;

import com.tausib.springjobportal.user.dto.ProfileUpdateRequest;
import com.tausib.springjobportal.user.dto.UserResponse;
import com.tausib.springjobportal.user.dto.VisibilityRequest;
import jakarta.validation.Valid;
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

    @GetMapping("/me")
    public ResponseEntity<UserResponse> getCurrentUser(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(userService.getById(principal.getId()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<UserResponse> getUserById(
            @PathVariable Integer id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(userService.getVisibleProfile(id, principal.getId()));
    }

    @PutMapping("/me")
    public ResponseEntity<UserResponse> updateProfile(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ProfileUpdateRequest request
    ) {
        return ResponseEntity.ok(userService.updateProfile(principal.getId(), request));
    }

    @PostMapping(value = "/me/photo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadProfilePhoto(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam("file") MultipartFile file
    ) {
        String path = userService.uploadProfilePhoto(principal.getId(), file);
        return ResponseEntity.ok(Map.of("path", path, "message", "Photo uploaded successfully"));
    }

    @PostMapping(value = "/me/resume", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadResume(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam("file") MultipartFile file
    ) {
        String path = userService.uploadResume(principal.getId(), file);
        return ResponseEntity.ok(Map.of("path", path, "message", "Resume uploaded successfully"));
    }

    @PatchMapping("/me/visibility")
    public ResponseEntity<Map<String, Boolean>> toggleVisibility(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody VisibilityRequest request
    ) {
        boolean isPublic = userService.setProfileVisibility(principal.getId(), request.getIsPublic());
        return ResponseEntity.ok(Map.of("isProfilePublic", isPublic));
    }
}
