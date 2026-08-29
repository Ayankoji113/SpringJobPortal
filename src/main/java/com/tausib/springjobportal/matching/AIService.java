package com.tausib.springjobportal.matching;

import com.tausib.springjobportal.job.JobPost;

import com.tausib.springjobportal.user.User;
import com.tausib.springjobportal.user.UserService;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Rule-based service for job matching and recommendation ranking.
 * Uses keyword/skill overlap scoring. Can be swapped for a real provider later.
 */
@Service
@RequiredArgsConstructor
public class AIService {

    private final MatchScoreRepo matchScoreRepo;
    private final UserService userService;

    /**
     * Calculate match score between a user's skills and a job post's requirements.
     */
    public MatchScore calculateMatchScore(Integer userId, JobPost job) {
        User user = userService.getEntityById(userId);
        // Check if already calculated
        var existing = matchScoreRepo.findByUserIdAndJobPostPostId(user.getId(), job.getPostId());
        if (existing.isPresent()) {
            return existing.get();
        }

        List<String> userSkills = user.getSkills() != null
                ? user.getSkills().stream().map(String::toLowerCase).collect(Collectors.toList())
                : Collections.emptyList();

        List<String> jobSkills = job.getPostTechStack() != null
                ? job.getPostTechStack().stream().map(String::toLowerCase).collect(Collectors.toList())
                : Collections.emptyList();

        // Find matched and missing skills
        List<String> matched = userSkills.stream()
                .filter(skill -> jobSkills.stream().anyMatch(js -> js.contains(skill) || skill.contains(js)))
                .collect(Collectors.toList());

        List<String> missing = jobSkills.stream()
                .filter(js -> userSkills.stream().noneMatch(us -> us.contains(js) || js.contains(us)))
                .collect(Collectors.toList());

        // Calculate score
        double score = 0.0;
        if (!jobSkills.isEmpty()) {
            score = ((double) matched.size() / jobSkills.size()) * 70; // 70% weight for skills
        }

        // Experience bonus (up to 20%)
        if (user.getExperienceYears() != null && job.getReqExperience() != null) {
            if (user.getExperienceYears() >= job.getReqExperience()) {
                score += 20;
            } else {
                score += (double) user.getExperienceYears() / job.getReqExperience() * 20;
            }
        } else {
            score += 10; // neutral if no experience data
        }

        // Profile completeness bonus (up to 10%)
        int completeness = 0;
        if (user.getBio() != null && !user.getBio().isEmpty()) completeness++;
        if (user.getResumePath() != null) completeness++;
        if (user.getLocation() != null) completeness++;
        if (user.getLinkedinUrl() != null) completeness++;
        if (user.getSkills() != null && !user.getSkills().isEmpty()) completeness++;
        score += (completeness / 5.0) * 10;

        score = Math.min(score, 100.0);
        score = Math.round(score * 10.0) / 10.0;

        MatchScore matchScore = MatchScore.builder()
                .user(user)
                .jobPost(job)
                .score(score)
                .matchedSkills(matched)
                .missingSkills(missing)
                .build();

        return matchScoreRepo.save(matchScore);
    }

    /**
     * Auto-apply to jobs that match above the threshold.
     */
    public List<MatchScore> getRecommendedJobs(Integer userId, List<JobPost> jobs, double threshold) {
        List<MatchScore> recommendations = new ArrayList<>();
        for (JobPost job : jobs) {
            MatchScore score = calculateMatchScore(userId, job);
            if (score.getScore() >= threshold) {
                recommendations.add(score);
            }
        }
        recommendations.sort((a, b) -> Double.compare(b.getScore(), a.getScore()));
        return recommendations;
    }
}
