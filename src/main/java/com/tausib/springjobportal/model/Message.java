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
@Table(name = "messages")
public class Message {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "sender_id", nullable = false)
    @JsonIgnoreProperties({"password", "authorities", "username", "accountNonExpired",
            "accountNonLocked", "credentialsNonExpired", "enabled", "skills",
            "emailVerificationToken", "passwordResetToken", "passwordResetExpiry"})
    private User sender;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "receiver_id", nullable = false)
    @JsonIgnoreProperties({"password", "authorities", "username", "accountNonExpired",
            "accountNonLocked", "credentialsNonExpired", "enabled", "skills",
            "emailVerificationToken", "passwordResetToken", "passwordResetExpiry"})
    private User receiver;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String content;

    @Builder.Default
    private Boolean isRead = false;

    @CreationTimestamp
    private LocalDateTime sentAt;
}
