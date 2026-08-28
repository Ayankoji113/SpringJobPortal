package com.tausib.springjobportal.job;

import com.tausib.springjobportal.common.exception.ForbiddenOperationException;
import com.tausib.springjobportal.common.exception.ResourceNotFoundException;
import com.tausib.springjobportal.company.CompanyService;
import com.tausib.springjobportal.job.dto.JobRequest;
import com.tausib.springjobportal.job.dto.JobResponse;
import com.tausib.springjobportal.job.dto.JobSearchRequest;
import com.tausib.springjobportal.user.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Job posting lifecycle. Bookmarks live in {@link SavedJobService}. */
@Service
@RequiredArgsConstructor
public class JobService {

    private final JobRepo jobRepo;
    private final JobMapper jobMapper;
    private final UserService userService;
    private final CompanyService companyService;

    /** Entity accessor for other services. Never returned across a controller boundary. */
    @Transactional(readOnly = true)
    public JobPost getEntityById(Integer postId) {
        return jobRepo.findById(postId)
                .orElseThrow(() -> new ResourceNotFoundException("Job Post not found with id: " + postId));
    }

    @Transactional(readOnly = true)
    public JobResponse getById(Integer postId) {
        return jobMapper.toResponse(getEntityById(postId));
    }

    /** Detail view: records the view, then returns the post. */
    @Transactional
    public JobResponse viewById(Integer postId) {
        JobPost job = getEntityById(postId);
        jobRepo.incrementViewCount(postId);
        JobResponse response = jobMapper.toResponse(job);
        response.setViewCount(job.getViewCount() == null ? 1 : job.getViewCount() + 1);
        return response;
    }

    @Transactional(readOnly = true)
    public List<JobResponse> getAll() {
        return jobRepo.findAll().stream().map(jobMapper::toResponse).toList();
    }

    /** Entity accessor for other services. Never returned across a controller boundary. */
    @Transactional(readOnly = true)
    public List<JobPost> getAllEntities() {
        return jobRepo.findAll();
    }

    @Transactional(readOnly = true)
    public Page<JobResponse> getPaginated(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("postedDate").descending());
        return jobRepo.findByIsActiveTrue(pageable).map(jobMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<JobResponse> search(JobSearchRequest request) {
        int page = request.getPage() != null ? request.getPage() : 0;
        int size = request.getSize() != null ? request.getSize() : 10;
        String sortBy = request.getSortBy() != null ? request.getSortBy() : "postedDate";
        Sort.Direction dir = "asc".equalsIgnoreCase(request.getSortDir())
                ? Sort.Direction.ASC : Sort.Direction.DESC;

        Pageable pageable = PageRequest.of(page, size, Sort.by(dir, sortBy));

        return jobRepo.advancedSearch(
                request.getKeyword(),
                request.getLocation(),
                request.getJobType(),
                request.getIsRemote(),
                request.getMinExperience(),
                request.getMaxExperience(),
                pageable
        ).map(jobMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public List<JobResponse> searchByKeyword(String keyword) {
        return jobRepo
                .findByPostProfileContainingIgnoreCaseOrPostDescContainingIgnoreCase(keyword, keyword)
                .stream().map(jobMapper::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<JobResponse> getFeatured() {
        return jobRepo.findByIsFeaturedTrueAndIsActiveTrue().stream().map(jobMapper::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<JobResponse> getByEmployer(Integer employerId) {
        return jobRepo.findByPostedById(employerId).stream().map(jobMapper::toResponse).toList();
    }

    /** Entity accessor for other services. Never returned across a controller boundary. */
    @Transactional(readOnly = true)
    public List<JobPost> getEntitiesByEmployer(Integer employerId) {
        return jobRepo.findByPostedById(employerId);
    }

    @Transactional(readOnly = true)
    public long countByEmployer(Integer employerId) {
        return jobRepo.countByPostedById(employerId);
    }

    @Transactional
    public JobResponse create(JobRequest request, Integer employerId) {
        JobPost job = JobPost.builder()
                .postProfile(request.getPostProfile())
                .postDesc(request.getPostDesc())
                .reqExperience(request.getReqExperience())
                .postTechStack(request.getPostTechStack())
                .postedBy(userService.getEntityById(employerId))
                .company(request.getCompanyId() == null
                        ? null : companyService.getEntityById(request.getCompanyId()))
                .salaryMin(request.getSalaryMin())
                .salaryMax(request.getSalaryMax())
                .location(request.getLocation())
                .jobType(request.getJobType() != null ? request.getJobType() : JobType.FULL_TIME)
                .isRemote(request.getIsRemote() != null ? request.getIsRemote() : false)
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .build();
        return jobMapper.toResponse(jobRepo.save(job));
    }

    /** Patch semantics: fields absent from the request keep their stored value. */
    @Transactional
    public JobResponse update(Integer postId, JobRequest request, Integer employerId) {
        JobPost job = requireOwner(postId, employerId);

        if (request.getPostProfile() != null) job.setPostProfile(request.getPostProfile());
        if (request.getPostDesc() != null) job.setPostDesc(request.getPostDesc());
        if (request.getReqExperience() != null) job.setReqExperience(request.getReqExperience());
        if (request.getPostTechStack() != null) job.setPostTechStack(request.getPostTechStack());
        if (request.getCompanyId() != null) job.setCompany(companyService.getEntityById(request.getCompanyId()));
        if (request.getSalaryMin() != null) job.setSalaryMin(request.getSalaryMin());
        if (request.getSalaryMax() != null) job.setSalaryMax(request.getSalaryMax());
        if (request.getLocation() != null) job.setLocation(request.getLocation());
        if (request.getJobType() != null) job.setJobType(request.getJobType());
        if (request.getIsRemote() != null) job.setIsRemote(request.getIsRemote());
        if (request.getIsActive() != null) job.setIsActive(request.getIsActive());

        return jobMapper.toResponse(jobRepo.save(job));
    }

    @Transactional
    public void delete(Integer postId, Integer employerId) {
        requireOwner(postId, employerId);
        jobRepo.deleteById(postId);
    }

    private JobPost requireOwner(Integer postId, Integer employerId) {
        JobPost job = getEntityById(postId);
        if (job.getPostedBy() == null || !job.getPostedBy().getId().equals(employerId)) {
            throw new ForbiddenOperationException("You do not own this job posting");
        }
        return job;
    }
}
