package com.tausib.springjobportal.job;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JobRepo extends JpaRepository<JobPost, Integer> {

    /**
     * Every public read goes through one of the three "visible" finders below. The old queries
     * filtered on {@code isActive} alone, so an unreviewed posting was served by five of them.
     */
    Page<JobPost> findByStatusAndIsActiveTrue(JobStatus status, Pageable pageable);

    List<JobPost> findByStatusAndIsActiveTrue(JobStatus status);

    List<JobPost> findByIsFeaturedTrueAndStatusAndIsActiveTrue(JobStatus status);

    @Query("SELECT j FROM JobPost j WHERE j.status = :status AND j.isActive = true "
            + "AND (LOWER(j.postProfile) LIKE LOWER(CONCAT('%', :keyword, '%')) "
            + "     OR LOWER(j.postDesc) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    List<JobPost> searchVisibleByKeyword(@Param("keyword") String keyword,
                                         @Param("status") JobStatus status);

    /** Moderation queue, oldest first so nothing waits behind a newer posting. */
    Page<JobPost> findByStatusOrderByPostedDateAsc(JobStatus status, Pageable pageable);

    long countByStatus(JobStatus status);

    /** Whether anyone has ever applied. Such a posting is closed rather than deleted, to keep their history. */
    @Query("SELECT COUNT(a) > 0 FROM JobApplication a WHERE a.jobPost.postId = :postId")
    boolean hasApplications(@Param("postId") Integer postId);

    List<JobPost> findByPostedById(Integer userId);

    long countByPostedById(Integer userId);

    /** Employer trust signal: have they had a posting published before? */
    boolean existsByPostedByIdAndStatus(Integer userId, JobStatus status);

    /** Atomic increment, so concurrent views cannot lose each other's updates. */
    @Modifying
    @Query("UPDATE JobPost j SET j.viewCount = j.viewCount + 1 WHERE j.postId = :postId")
    void incrementViewCount(@Param("postId") Integer postId);

    @Query("SELECT j FROM JobPost j WHERE j.isActive = true AND j.status = :status "
            // The string parameters are cast explicitly: when they arrive null, Postgres cannot
            // infer a type inside lower() and fails with "function lower(bytea) does not exist".
            + "AND (CAST(:keyword AS string) IS NULL "
            + "     OR LOWER(j.postProfile) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%')) "
            + "     OR LOWER(j.postDesc) LIKE LOWER(CONCAT('%', CAST(:keyword AS string), '%'))) "
            + "AND (CAST(:location AS string) IS NULL "
            + "     OR LOWER(j.location) LIKE LOWER(CONCAT('%', CAST(:location AS string), '%'))) "
            + "AND (:jobType IS NULL OR j.jobType = :jobType) "
            + "AND (:isRemote IS NULL OR j.isRemote = :isRemote) "
            + "AND (:minExp IS NULL OR j.reqExperience >= :minExp) "
            + "AND (:maxExp IS NULL OR j.reqExperience <= :maxExp)")
    Page<JobPost> advancedSearch(
            @Param("status") JobStatus status,
            @Param("keyword") String keyword,
            @Param("location") String location,
            @Param("jobType") JobType jobType,
            @Param("isRemote") Boolean isRemote,
            @Param("minExp") Integer minExp,
            @Param("maxExp") Integer maxExp,
            Pageable pageable
    );

    /**
     * Percentiles of the midpoint salary across comparable active postings: overlapping title,
     * same location (or remote), and a +/-2 year experience band. Computed in SQL so only four
     * numbers cross the wire; capped by :limit, newest first.
     *
     * ponytail: title similarity is a two-way LIKE, not tokenised or fuzzy. Good enough while
     * postings are few; move to pg_trgm similarity() + a GIN index if comparables get noisy.
     */
    @Query(value = """
            SELECT count(*)                                              AS "sampleSize",
                   percentile_cont(0.25) WITHIN GROUP (ORDER BY c.mid)   AS "p25",
                   percentile_cont(0.50) WITHIN GROUP (ORDER BY c.mid)   AS "p50",
                   percentile_cont(0.75) WITHIN GROUP (ORDER BY c.mid)   AS "p75"
            FROM (
                SELECT cast(j.salary_min + j.salary_max AS double precision) / 2 AS mid
                FROM job_post j
                WHERE j.is_active = true AND j.status = 'PUBLISHED'
                  AND j.post_id <> :postId
                  AND j.salary_min IS NOT NULL AND j.salary_max IS NOT NULL
                  AND (LOWER(j.post_profile) LIKE LOWER(CONCAT('%', :title, '%'))
                       OR LOWER(:title) LIKE LOWER(CONCAT('%', j.post_profile, '%')))
                  AND (CAST(:location AS text) IS NULL
                       OR LOWER(j.location) = LOWER(CAST(:location AS text))
                       OR j.is_remote = true)
                  AND (CAST(:experience AS integer) IS NULL
                       OR j.req_experience BETWEEN CAST(:experience AS integer) - 2
                                               AND CAST(:experience AS integer) + 2)
                ORDER BY j.posted_date DESC
                LIMIT :limit
            ) c
            """, nativeQuery = true)
    SalaryStats salaryComparables(@Param("postId") Integer postId,
                                  @Param("title") String title,
                                  @Param("location") String location,
                                  @Param("experience") Integer experience,
                                  @Param("limit") int limit);
}
