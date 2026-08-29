package com.tausib.springjobportal.matching;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface MatchScoreRepo extends JpaRepository<MatchScore, Integer> {
    Optional<MatchScore> findByUserIdAndJobPostPostId(Integer userId, Integer jobPostId);
}
