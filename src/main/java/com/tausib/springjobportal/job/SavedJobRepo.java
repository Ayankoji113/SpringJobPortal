package com.tausib.springjobportal.job;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SavedJobRepo extends JpaRepository<SavedJob, Integer> {
    List<SavedJob> findByUserId(Integer userId);
    boolean existsByUserIdAndJobPostPostId(Integer userId, Integer jobPostId);
    void deleteByUserIdAndJobPostPostId(Integer userId, Integer jobPostId);
}
