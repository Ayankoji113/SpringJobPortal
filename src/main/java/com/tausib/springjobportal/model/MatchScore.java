package com.tausib.springjobportal.model;

import com.tausib.springjobportal.job.JobPost;

import com.tausib.springjobportal.user.User;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "match_scores")
public class MatchScore {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "job_post_id", nullable = false)
    private JobPost jobPost;

    @Column(nullable = false)
    private Double score; // 0.0 to 100.0

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "matched_skills", joinColumns = @JoinColumn(name = "match_score_id"))
    @Column(name = "skill")
    private List<String> matchedSkills;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "missing_skills", joinColumns = @JoinColumn(name = "match_score_id"))
    @Column(name = "skill")
    private List<String> missingSkills;

    @CreationTimestamp
    private LocalDateTime generatedAt;
}
