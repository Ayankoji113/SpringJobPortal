package com.tausib.springjobportal.repo;

import com.tausib.springjobportal.model.JobApplication;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface JobApplicationRepo extends JpaRepository<JobApplication, Integer> {
    List<JobApplication> findByApplicantId(Integer applicantId);
    List<JobApplication> findByJobPostPostId(Integer postId);
    Optional<JobApplication> findByJobPostPostIdAndApplicantId(Integer postId, Integer applicantId);
}
