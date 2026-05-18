package com.tausib.springjobportal.service;

import com.tausib.springjobportal.model.*;
import com.tausib.springjobportal.repo.MatchScoreRepo;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

/**
 * Rule-based AI service for job matching, resume analysis, and cover letter generation.
 * Uses keyword matching and TF-IDF-like scoring. Can be swapped with OpenAI later.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AIService {

    private final MatchScoreRepo matchScoreRepo;

    /**
     * Calculate match score between a user's skills and a job post's requirements.
     */
    public MatchScore calculateMatchScore(User user, JobPost job) {
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
     * Generate a cover letter based on user profile and job description.
     */
    public String generateCoverLetter(User user, JobPost job) {
        StringBuilder letter = new StringBuilder();

        letter.append("Dear Hiring Manager,\n\n");

        letter.append("I am writing to express my strong interest in the ")
                .append(job.getPostProfile())
                .append(" position");

        if (job.getCompany() != null) {
            letter.append(" at ").append(job.getCompany().getName());
        }
        letter.append(". ");

        if (user.getExperienceYears() != null && user.getExperienceYears() > 0) {
            letter.append("With ").append(user.getExperienceYears())
                    .append(" years of professional experience");
            if (user.getCurrentJobTitle() != null) {
                letter.append(" as a ").append(user.getCurrentJobTitle());
            }
            letter.append(", I am confident in my ability to contribute effectively to your team.\n\n");
        } else {
            letter.append("As an enthusiastic and dedicated professional, I am eager to bring my skills and passion to your team.\n\n");
        }

        // Skills section
        if (user.getSkills() != null && !user.getSkills().isEmpty()) {
            List<String> relevantSkills = new ArrayList<>();
            if (job.getPostTechStack() != null) {
                for (String userSkill : user.getSkills()) {
                    for (String jobSkill : job.getPostTechStack()) {
                        if (userSkill.toLowerCase().contains(jobSkill.toLowerCase()) ||
                                jobSkill.toLowerCase().contains(userSkill.toLowerCase())) {
                            relevantSkills.add(userSkill);
                            break;
                        }
                    }
                }
            }
            if (!relevantSkills.isEmpty()) {
                letter.append("My technical expertise in ")
                        .append(String.join(", ", relevantSkills))
                        .append(" aligns perfectly with the requirements of this role. ");
            }
            letter.append("I bring a strong foundation in ")
                    .append(String.join(", ", user.getSkills().subList(0, Math.min(5, user.getSkills().size()))))
                    .append(".\n\n");
        }

        if (user.getBio() != null && !user.getBio().isEmpty()) {
            letter.append(user.getBio()).append("\n\n");
        }

        letter.append("I am excited about the opportunity to discuss how my background and skills would be a great fit for this position. ")
                .append("Thank you for considering my application.\n\n");

        letter.append("Best regards,\n")
                .append(user.getFullName() != null ? user.getFullName() : "Applicant");

        return letter.toString();
    }

    /**
     * Estimate salary based on skills and experience.
     */
    public Map<String, Object> estimateSalary(User user) {
        Map<String, Object> estimate = new HashMap<>();

        // Base salary tiers based on experience
        int baseSalary;
        if (user.getExperienceYears() == null || user.getExperienceYears() == 0) {
            baseSalary = 300000; // 3 LPA for freshers
        } else if (user.getExperienceYears() <= 2) {
            baseSalary = 500000; // 5 LPA
        } else if (user.getExperienceYears() <= 5) {
            baseSalary = 900000; // 9 LPA
        } else if (user.getExperienceYears() <= 8) {
            baseSalary = 1500000; // 15 LPA
        } else if (user.getExperienceYears() <= 12) {
            baseSalary = 2200000; // 22 LPA
        } else {
            baseSalary = 3000000; // 30 LPA
        }

        // Skill premium (certain skills command higher salaries)
        Set<String> highDemand = Set.of("react", "node", "spring", "java", "python", "aws", "docker",
                "kubernetes", "microservices", "ai", "machine learning", "tensorflow", "golang", "rust");

        int skillBonus = 0;
        if (user.getSkills() != null) {
            long count = user.getSkills().stream()
                    .filter(s -> highDemand.contains(s.toLowerCase()))
                    .count();
            skillBonus = (int) (count * 50000);
        }

        int estimatedMin = baseSalary + skillBonus;
        int estimatedMax = (int) (estimatedMin * 1.3);

        estimate.put("estimatedMinSalary", estimatedMin);
        estimate.put("estimatedMaxSalary", estimatedMax);
        estimate.put("currency", "INR");
        estimate.put("experienceYears", user.getExperienceYears());
        estimate.put("skillCount", user.getSkills() != null ? user.getSkills().size() : 0);
        estimate.put("highDemandSkills", user.getSkills() != null
                ? user.getSkills().stream().filter(s -> highDemand.contains(s.toLowerCase())).collect(Collectors.toList())
                : Collections.emptyList());

        return estimate;
    }

    /**
     * Suggest improvements for user profile/resume.
     */
    public Map<String, Object> suggestImprovements(User user) {
        Map<String, Object> suggestions = new LinkedHashMap<>();
        List<String> improvements = new ArrayList<>();
        int profileScore = 0;
        int totalChecks = 8;

        if (user.getBio() == null || user.getBio().isEmpty()) {
            improvements.add("Add a professional bio/summary to make your profile stand out");
        } else {
            profileScore++;
            if (user.getBio().length() < 50) {
                improvements.add("Expand your bio to at least 100 characters for a stronger profile");
            }
        }

        if (user.getSkills() == null || user.getSkills().isEmpty()) {
            improvements.add("Add your technical skills — this is the #1 factor in job matching");
        } else {
            profileScore++;
            if (user.getSkills().size() < 5) {
                improvements.add("Add more skills (aim for 5-10) to improve your match scores");
            }
        }

        if (user.getResumePath() == null) {
            improvements.add("Upload your resume — many employers filter candidates without resumes");
        } else {
            profileScore++;
        }

        if (user.getExperienceYears() == null) {
            improvements.add("Add your years of experience");
        } else {
            profileScore++;
        }

        if (user.getLocation() == null || user.getLocation().isEmpty()) {
            improvements.add("Add your location to get relevant job recommendations");
        } else {
            profileScore++;
        }

        if (user.getLinkedinUrl() == null || user.getLinkedinUrl().isEmpty()) {
            improvements.add("Add your LinkedIn profile URL for credibility");
        } else {
            profileScore++;
        }

        if (user.getProfilePhotoPath() == null) {
            improvements.add("Upload a professional profile photo");
        } else {
            profileScore++;
        }

        if (user.getCurrentJobTitle() == null || user.getCurrentJobTitle().isEmpty()) {
            improvements.add("Add your current/desired job title");
        } else {
            profileScore++;
        }

        suggestions.put("profileCompleteness", (int) ((profileScore / (double) totalChecks) * 100));
        suggestions.put("improvements", improvements);
        suggestions.put("overallRating", profileScore >= 7 ? "Excellent" : profileScore >= 5 ? "Good" : profileScore >= 3 ? "Fair" : "Needs Work");

        return suggestions;
    }

    /**
     * Auto-apply to jobs that match above the threshold.
     */
    public List<MatchScore> getRecommendedJobs(User user, List<JobPost> jobs, double threshold) {
        List<MatchScore> recommendations = new ArrayList<>();
        for (JobPost job : jobs) {
            MatchScore score = calculateMatchScore(user, job);
            if (score.getScore() >= threshold) {
                recommendations.add(score);
            }
        }
        recommendations.sort((a, b) -> Double.compare(b.getScore(), a.getScore()));
        return recommendations;
    }
}
