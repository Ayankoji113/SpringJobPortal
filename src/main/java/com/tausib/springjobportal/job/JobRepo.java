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

    List<JobPost> findByPostProfileContainingIgnoreCaseOrPostDescContainingIgnoreCase(
            String postProfile, String postDesc);

    Page<JobPost> findByIsActiveTrue(Pageable pageable);

    List<JobPost> findByPostedById(Integer userId);

    long countByPostedById(Integer userId);

    List<JobPost> findByIsFeaturedTrueAndIsActiveTrue();

    /** Atomic increment, so concurrent views cannot lose each other's updates. */
    @Modifying
    @Query("UPDATE JobPost j SET j.viewCount = j.viewCount + 1 WHERE j.postId = :postId")
    void incrementViewCount(@Param("postId") Integer postId);

    @Query("SELECT j FROM JobPost j WHERE j.isActive = true AND j.isApproved = true "
            + "AND (:keyword IS NULL OR LOWER(j.postProfile) LIKE LOWER(CONCAT('%', :keyword, '%')) "
            + "                      OR LOWER(j.postDesc) LIKE LOWER(CONCAT('%', :keyword, '%'))) "
            + "AND (:location IS NULL OR LOWER(j.location) LIKE LOWER(CONCAT('%', :location, '%'))) "
            + "AND (:jobType IS NULL OR j.jobType = :jobType) "
            + "AND (:isRemote IS NULL OR j.isRemote = :isRemote) "
            + "AND (:minExp IS NULL OR j.reqExperience >= :minExp) "
            + "AND (:maxExp IS NULL OR j.reqExperience <= :maxExp)")
    Page<JobPost> advancedSearch(
            @Param("keyword") String keyword,
            @Param("location") String location,
            @Param("jobType") JobType jobType,
            @Param("isRemote") Boolean isRemote,
            @Param("minExp") Integer minExp,
            @Param("maxExp") Integer maxExp,
            Pageable pageable
    );
}
