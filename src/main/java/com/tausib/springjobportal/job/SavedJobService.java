package com.tausib.springjobportal.job;

import com.tausib.springjobportal.job.dto.SavedJobResponse;
import com.tausib.springjobportal.user.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Job bookmarks. Split out of JobService, which was doing two unrelated jobs. */
@Service
@RequiredArgsConstructor
public class SavedJobService {

    private final SavedJobRepo savedJobRepo;
    private final JobService jobService;
    private final JobMapper jobMapper;
    private final UserService userService;

    @Transactional
    public SavedJobResponse save(Integer userId, Integer jobPostId) {
        if (savedJobRepo.existsByUserIdAndJobPostPostId(userId, jobPostId)) {
            throw new JobAlreadySavedException("Job already saved");
        }
        SavedJob savedJob = SavedJob.builder()
                .user(userService.getEntityById(userId))
                .jobPost(jobService.getEntityById(jobPostId))
                .build();
        return jobMapper.toResponse(savedJobRepo.save(savedJob));
    }

    @Transactional
    public void unsave(Integer userId, Integer jobPostId) {
        savedJobRepo.deleteByUserIdAndJobPostPostId(userId, jobPostId);
    }

    @Transactional(readOnly = true)
    public List<SavedJobResponse> getByUser(Integer userId) {
        return savedJobRepo.findByUserId(userId).stream().map(jobMapper::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public boolean isSaved(Integer userId, Integer jobPostId) {
        return savedJobRepo.existsByUserIdAndJobPostPostId(userId, jobPostId);
    }

    /** Thrown when a bookmark already exists for this user and job. */
    public static class JobAlreadySavedException extends RuntimeException {
        public JobAlreadySavedException(String message) {
            super(message);
        }
    }
}
