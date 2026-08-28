package com.tausib.springjobportal.job;

import com.tausib.springjobportal.company.Company;
import com.tausib.springjobportal.user.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/** Persistence-only job record. Never crosses a controller boundary. */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
public class JobPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer postId;

    private String postProfile;

    @Column(columnDefinition = "TEXT")
    private String postDesc;

    private Integer reqExperience;

    @ElementCollection(fetch = FetchType.EAGER)
    private List<String> postTechStack;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "posted_by_id")
    private User postedBy;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "company_id")
    private Company company;

    private BigDecimal salaryMin;
    private BigDecimal salaryMax;
    private String location;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private JobType jobType = JobType.FULL_TIME;

    @Builder.Default
    private Boolean isRemote = false;

    @Builder.Default
    private Boolean isActive = true;

    @Builder.Default
    private Boolean isFeatured = false;

    @Builder.Default
    private Boolean isApproved = true;

    @Builder.Default
    private Integer viewCount = 0;

    @CreationTimestamp
    private LocalDateTime postedDate;
}
