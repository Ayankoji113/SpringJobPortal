package com.tausib.springjobportal.service;

import com.tausib.springjobportal.dto.JobSearchRequest;
import com.tausib.springjobportal.exception.ResourceNotFoundException;
import com.tausib.springjobportal.model.JobPost;
import com.tausib.springjobportal.model.SavedJob;
import com.tausib.springjobportal.model.User;
import com.tausib.springjobportal.repo.JobRepo;
import com.tausib.springjobportal.repo.SavedJobRepo;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class JobService {

    private final JobRepo repo;
    private final SavedJobRepo savedJobRepo;

    public List<JobPost> getAllJobs() {
        return repo.findAll();
    }

    public Page<JobPost> getJobsPaginated(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("postedDate").descending());
        return repo.findByIsActiveTrue(pageable);
    }

    public Page<JobPost> searchJobs(JobSearchRequest request) {
        int page = request.getPage() != null ? request.getPage() : 0;
        int size = request.getSize() != null ? request.getSize() : 10;
        String sortBy = request.getSortBy() != null ? request.getSortBy() : "postedDate";
        Sort.Direction dir = "asc".equalsIgnoreCase(request.getSortDir()) ? Sort.Direction.ASC : Sort.Direction.DESC;

        Pageable pageable = PageRequest.of(page, size, Sort.by(dir, sortBy));

        return repo.advancedSearch(
                request.getKeyword(),
                request.getLocation(),
                request.getJobType(),
                request.getIsRemote(),
                request.getMinExperience(),
                request.getMaxExperience(),
                pageable
        );
    }

    public JobPost addJob(JobPost jobPost) {
        return repo.save(jobPost);
    }

    public JobPost getJob(Integer postId) {
        JobPost job = repo.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Job Post not found with id: " + postId));
        // Increment view count
        job.setViewCount(job.getViewCount() != null ? job.getViewCount() + 1 : 1);
        repo.save(job);
        return job;
    }

    public JobPost updateJob(JobPost jobPost) {
        if (jobPost.getPostId() == null || !repo.existsById(jobPost.getPostId())) {
            throw new ResourceNotFoundException("Job Post not found with id: " + jobPost.getPostId());
        }
        return repo.save(jobPost);
    }

    public void deleteJob(Integer postId) {
        if (!repo.existsById(postId)) {
            throw new ResourceNotFoundException("Job Post not found with id: " + postId);
        }
        repo.deleteById(postId);
    }

    public List<JobPost> search(String keyword) {
        return repo.findByPostProfileContainingOrPostDescContaining(keyword, keyword);
    }

    public List<JobPost> getJobsByEmployer(Integer userId) {
        return repo.findByPostedById(userId);
    }

    public List<JobPost> getFeaturedJobs() {
        return repo.findByIsFeaturedTrueAndIsActiveTrue();
    }

    public List<JobPost> getPendingApprovalJobs() {
        return repo.findByIsApprovedFalse();
    }

    public void approveJob(Integer postId) {
        JobPost job = getJob(postId);
        job.setIsApproved(true);
        repo.save(job);
    }

    public void rejectJob(Integer postId) {
        deleteJob(postId);
    }

    // Saved Jobs / Bookmarks
    public SavedJob saveJob(User user, Integer jobPostId) {
        if (savedJobRepo.existsByUserIdAndJobPostPostId(user.getId(), jobPostId)) {
            throw new RuntimeException("Job already saved");
        }
        JobPost job = repo.findById(jobPostId)
                .orElseThrow(() -> new ResourceNotFoundException("Job not found"));

        SavedJob savedJob = SavedJob.builder()
                .user(user)
                .jobPost(job)
                .build();
        return savedJobRepo.save(savedJob);
    }

    @Transactional
    public void unsaveJob(Integer userId, Integer jobPostId) {
        savedJobRepo.deleteByUserIdAndJobPostPostId(userId, jobPostId);
    }

    public List<SavedJob> getSavedJobs(Integer userId) {
        return savedJobRepo.findByUserId(userId);
    }

    public boolean isJobSaved(Integer userId, Integer jobPostId) {
        return savedJobRepo.existsByUserIdAndJobPostPostId(userId, jobPostId);
    }

    public void load() {
        // Disabled to prevent ID assignment errors
    }
}
