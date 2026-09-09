package com.tausib.springjobportal.user;

import com.tausib.springjobportal.common.exception.ResourceNotFoundException;
import com.tausib.springjobportal.file.FileStorageService;
import com.tausib.springjobportal.user.dto.ProfileUpdateRequest;
import com.tausib.springjobportal.user.dto.UserResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/** Profile management. Authentication concerns live in {@link AuthService}. */
@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepo userRepo;
    private final UserMapper userMapper;
    private final FileStorageService fileStorageService;

    /** Entity accessor for other services. Never returned across a controller boundary. */
    @Transactional(readOnly = true)
    public User getEntityById(Integer id) {
        return userRepo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + id));
    }

    @Transactional(readOnly = true)
    public UserResponse getById(Integer id) {
        return userMapper.toResponse(getEntityById(id));
    }

    /**
     * Another user's profile, honouring their visibility setting. Returns the profile only when
     * it is public or the caller is the owner.
     *
     * <p>"Public" means visible, not fully disclosed: contact details and the resume path are
     * stripped for anyone but the owner. Profiles default to public and ids are sequential, so
     * leaving them in made the whole seeker base harvestable by walking /api/users/{id}.
     */
    @Transactional(readOnly = true)
    public UserResponse getVisibleProfile(Integer targetId, Integer callerId) {
        User user = getEntityById(targetId);
        boolean isOwner = user.getId().equals(callerId);
        if (!isOwner && Boolean.FALSE.equals(user.getIsProfilePublic())) {
            throw new ResourceNotFoundException("User not found with id: " + targetId);
        }

        UserResponse response = userMapper.toResponse(user);
        if (!isOwner) {
            response.setEmail(null);
            response.setPhone(null);
            response.setResumePath(null);
        }
        return response;
    }

    @Transactional
    public UserResponse updateProfile(Integer userId, ProfileUpdateRequest request) {
        User user = getEntityById(userId);

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

        return userMapper.toResponse(userRepo.save(user));
    }

    @Transactional
    public String uploadProfilePhoto(Integer userId, MultipartFile file) {
        User user = getEntityById(userId);
        String path = fileStorageService.storeProfilePhoto(file, userId);
        user.setProfilePhotoPath(path);
        userRepo.save(user);
        return path;
    }

    @Transactional
    public String uploadResume(Integer userId, MultipartFile file) {
        User user = getEntityById(userId);
        String path = fileStorageService.storeResume(file, userId);
        user.setResumePath(path);
        userRepo.save(user);
        return path;
    }

    @Transactional
    public boolean setProfileVisibility(Integer userId, boolean isPublic) {
        User user = getEntityById(userId);
        user.setIsProfilePublic(isPublic);
        return userRepo.save(user).getIsProfilePublic();
    }
}
