package com.tausib.springjobportal.repo;

import com.tausib.springjobportal.model.JobAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JobAlertRepo extends JpaRepository<JobAlert, Integer> {
    List<JobAlert> findByUserIdAndIsActiveTrue(Integer userId);
    List<JobAlert> findByIsActiveTrue();
}
