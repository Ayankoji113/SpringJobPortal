package com.tausib.springjobportal.job;

import com.tausib.springjobportal.common.exception.ForbiddenOperationException;
import com.tausib.springjobportal.common.exception.ResourceNotFoundException;
import com.tausib.springjobportal.company.CompanyService;
import com.tausib.springjobportal.job.dto.JobRequest;
import com.tausib.springjobportal.job.dto.JobResponse;
import com.tausib.springjobportal.job.dto.JobSearchRequest;
import com.tausib.springjobportal.user.User;
import com.tausib.springjobportal.user.UserPrincipal;
import com.tausib.springjobportal.user.UserRole;
import com.tausib.springjobportal.user.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
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

    private static final java.util.Set<String> SORTABLE =
            java.util.Set.of("postedDate", "salaryMin", "salaryMax", "viewCount");

    private final JobRepo jobRepo;
    private final JobMapper jobMapper;
    private final UserService userService;
    private final CompanyService companyService;
    private final ApplicationEventPublisher events;

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

    /**
     * Detail view. A posting that is not published is visible only to the employer who owns it and
     * to an admin — to everyone else it does not exist, so the moderation queue cannot be browsed
     * by walking ids. {@code caller} is null for anonymous visitors; this endpoint is public.
     */
    @Transactional
    public JobResponse viewById(Integer postId, UserPrincipal caller) {
        JobPost job = getEntityById(postId);

        if (!isVisibleTo(job, caller)) {
            throw new ResourceNotFoundException("Job Post not found with id: " + postId);
        }

        jobRepo.incrementViewCount(postId);
        JobResponse response = jobMapper.toResponse(job);
        response.setViewCount(job.getViewCount() == null ? 1 : job.getViewCount() + 1);
        return response;
    }

    private boolean isVisibleTo(JobPost job, UserPrincipal caller) {
        if (job.getStatus() == JobStatus.PUBLISHED && Boolean.TRUE.equals(job.getIsActive())) {
            return true;
        }
        if (caller == null) {
            return false;
        }
        return caller.getRole() == UserRole.ADMIN
                || (job.getPostedBy() != null && job.getPostedBy().getId().equals(caller.getId()));
    }

    @Transactional(readOnly = true)
    public List<JobResponse> getAll() {
        return getAllEntities().stream().map(jobMapper::toResponse).toList();
    }

    /** Entity accessor for other services. Published postings only — matching must not surface others. */
    @Transactional(readOnly = true)
    public List<JobPost> getAllEntities() {
        return jobRepo.findByStatusAndIsActiveTrue(JobStatus.PUBLISHED);
    }

    @Transactional(readOnly = true)
    public Page<JobResponse> getPaginated(int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("postedDate").descending());
        return jobRepo.findByStatusAndIsActiveTrue(JobStatus.PUBLISHED, pageable)
                .map(jobMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<JobResponse> search(JobSearchRequest request) {
        int page = request.getPage() != null ? request.getPage() : 0;
        int size = request.getSize() != null ? request.getSize() : 10;
        // The sort field arrives from the query string; anything outside this list falls back to
        // the default rather than reaching the query as an arbitrary property name.
        String sortBy = request.getSortBy() != null && SORTABLE.contains(request.getSortBy())
                ? request.getSortBy() : "postedDate";
        Sort.Direction dir = "asc".equalsIgnoreCase(request.getSortDir())
                ? Sort.Direction.ASC : Sort.Direction.DESC;

        // Nulls last: sorting by pay must not lead with the postings that disclose none.
        Pageable pageable = PageRequest.of(page, size, Sort.by(new Sort.Order(dir, sortBy).nullsLast()));

        return jobRepo.advancedSearch(
                JobStatus.PUBLISHED,
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
        return jobRepo.searchVisibleByKeyword(keyword, JobStatus.PUBLISHED)
                .stream().map(jobMapper::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<JobResponse> getFeatured() {
        return jobRepo.findByIsFeaturedTrueAndStatusAndIsActiveTrue(JobStatus.PUBLISHED)
                .stream().map(jobMapper::toResponse).toList();
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

    /**
     * Creates a posting in {@link JobStatus#PENDING_REVIEW}. Gate G1 (a verified, unbanned account)
     * and gate G2 (a company the poster owns) are enforced here, before anything is written.
     */
    @Transactional
    public JobResponse create(JobRequest request, Integer employerId) {
        User employer = userService.getEntityById(employerId);
        requirePostingRights(employer);

        JobPost job = JobPost.builder()
                .postProfile(request.getPostProfile())
                .postDesc(request.getPostDesc())
                .reqExperience(request.getReqExperience())
                .postTechStack(request.getPostTechStack())
                .postedBy(employer)
                .company(request.getCompanyId() == null
                        ? null : companyService.getOwnedEntityById(request.getCompanyId(), employerId))
                .salaryMin(request.getSalaryMin())
                .salaryMax(request.getSalaryMax())
                .location(request.getLocation())
                .jobType(request.getJobType() != null ? request.getJobType() : JobType.FULL_TIME)
                .isRemote(request.getIsRemote() != null ? request.getIsRemote() : false)
                .isActive(request.getIsActive() != null ? request.getIsActive() : true)
                .build();
        return jobMapper.toResponse(jobRepo.save(job));
    }

    /**
     * Patch semantics: fields absent from the request keep their stored value.
     *
     * <p>Editing what a posting says sends it back for review. Without that, the gate is bypassed
     * by posting something clean, waiting for approval, then editing it into the advertisement you
     * actually wanted. Flipping {@code isActive} is not a content change and does not re-open review.
     */
    @Transactional
    public JobResponse update(Integer postId, JobRequest request, Integer employerId) {
        JobPost job = requireOwner(postId, employerId);
        boolean contentChanged = changesContent(job, request);

        if (request.getPostProfile() != null) job.setPostProfile(request.getPostProfile());
        if (request.getPostDesc() != null) job.setPostDesc(request.getPostDesc());
        if (request.getReqExperience() != null) job.setReqExperience(request.getReqExperience());
        if (request.getPostTechStack() != null) job.setPostTechStack(request.getPostTechStack());
        if (request.getCompanyId() != null) {
            job.setCompany(companyService.getOwnedEntityById(request.getCompanyId(), employerId));
        }
        if (request.getSalaryMin() != null) job.setSalaryMin(request.getSalaryMin());
        if (request.getSalaryMax() != null) job.setSalaryMax(request.getSalaryMax());
        if (request.getLocation() != null) job.setLocation(request.getLocation());
        if (request.getJobType() != null) job.setJobType(request.getJobType());
        if (request.getIsRemote() != null) job.setIsRemote(request.getIsRemote());
        if (request.getIsActive() != null) {
            boolean closing = Boolean.TRUE.equals(job.getIsActive()) && !request.getIsActive();
            job.setIsActive(request.getIsActive());
            if (closing) {
                events.publishEvent(new JobClosedEvent(postId));
            }
        }

        if (contentChanged && job.getStatus() == JobStatus.PUBLISHED) {
            job.setStatus(JobStatus.PENDING_REVIEW);
            job.setModerationReason(null);
            job.setReviewedAt(null);
            job.setReviewedBy(null);
        }

        return jobMapper.toResponse(jobRepo.save(job));
    }

    /** True when the request would alter what the posting advertises, as opposed to its visibility. */
    private boolean changesContent(JobPost job, JobRequest request) {
        return differs(request.getPostProfile(), job.getPostProfile())
                || differs(request.getPostDesc(), job.getPostDesc())
                || differs(request.getPostTechStack(), job.getPostTechStack())
                || differs(request.getReqExperience(), job.getReqExperience())
                || differs(request.getSalaryMin(), job.getSalaryMin())
                || differs(request.getSalaryMax(), job.getSalaryMax())
                || differs(request.getLocation(), job.getLocation())
                || differs(request.getCompanyId(),
                           job.getCompany() == null ? null : job.getCompany().getId());
    }

    /** Absent from the request means "leave alone", so null is never a change. */
    private static boolean differs(Object incoming, Object stored) {
        return incoming != null && !incoming.equals(stored);
    }

    /**
     * Gate G1. The account must have proved it owns its email address and must not be banned —
     * both flags existed on {@code User} from the start and nothing had ever read them, which is
     * what made a throwaway address enough to publish.
     */
    private void requirePostingRights(User employer) {
        if (Boolean.TRUE.equals(employer.getIsBanned())) {
            throw new ForbiddenOperationException("Your account has been suspended");
        }
        if (!Boolean.TRUE.equals(employer.getIsEmailVerified())) {
            throw new ForbiddenOperationException(
                    "Verify your email address before posting a job");
        }
    }

    @Transactional
    public void delete(Integer postId, Integer employerId) {
        JobPost job = requireOwner(postId, employerId);
        if (jobRepo.hasApplications(postId)) {
            job.setIsActive(false);
            jobRepo.save(job);
            events.publishEvent(new JobClosedEvent(postId));
        } else {
            jobRepo.deleteById(postId);
        }
    }

    private JobPost requireOwner(Integer postId, Integer employerId) {
        JobPost job = getEntityById(postId);
        if (job.getPostedBy() == null || !job.getPostedBy().getId().equals(employerId)) {
            throw new ForbiddenOperationException("You do not own this job posting");
        }
        return job;
    }
}
