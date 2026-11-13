package com.tausib.springjobportal.admin;

import com.tausib.springjobportal.user.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

/**
 * One row per admin write, recorded in the same transaction as the change it describes — an action
 * that was not recorded did not happen. The audit trail is what makes the role safe to hand out.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "admin_actions", indexes = {
        @Index(name = "idx_admin_actions_target", columnList = "target_type, target_id"),
        @Index(name = "idx_admin_actions_admin", columnList = "admin_id, created_at")
})
public class AdminAction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "admin_id", nullable = false)
    private User admin;

    @Column(nullable = false, length = 64)
    private String action;

    @Column(name = "target_type", nullable = false, length = 32)
    private String targetType;

    @Column(name = "target_id", nullable = false)
    private Integer targetId;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @CreationTimestamp
    @Column(nullable = false)
    private LocalDateTime createdAt;
}
