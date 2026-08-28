package com.tausib.springjobportal.repo;

import com.tausib.springjobportal.model.MatchScore;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MatchScoreRepo extends JpaRepository<MatchScore, Integer> {
    Optional<MatchScore> findByUserIdAndJobPostPostId(Integer userId, Integer jobPostId);
}
