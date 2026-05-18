package com.tausib.springjobportal.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "companies")
public class Company {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    private String website;
    private String location;
    private String industry;
    private String size; // e.g., "1-10", "11-50", "51-200", "201-500", "500+"
    private String logoPath;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "owner_id", nullable = false)
    @JsonIgnoreProperties({"password", "authorities", "username", "accountNonExpired",
            "accountNonLocked", "credentialsNonExpired", "enabled", "skills",
            "emailVerificationToken", "passwordResetToken", "passwordResetExpiry"})
    private User owner;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
