package com.tausib.springjobportal.repo;

import com.tausib.springjobportal.model.SavedJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SavedJobRepo extends JpaRepository<SavedJob, Integer> {
    List<SavedJob> findByUserId(Integer userId);
    Optional<SavedJob> findByUserIdAndJobPostPostId(Integer userId, Integer jobPostId);
    boolean existsByUserIdAndJobPostPostId(Integer userId, Integer jobPostId);
    void deleteByUserIdAndJobPostPostId(Integer userId, Integer jobPostId);
}
