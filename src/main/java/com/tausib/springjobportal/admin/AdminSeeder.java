package com.tausib.springjobportal.admin;

import com.tausib.springjobportal.user.User;
import com.tausib.springjobportal.user.UserRepo;
import com.tausib.springjobportal.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Promotes one existing account to {@link UserRole#ADMIN} at startup, named by
 * {@code app.admin.email}. This is the only way the first admin can exist: registration refuses the
 * role, so there is no self-serve path and no default credentials to forget about.
 *
 * <p>The property is empty by default and the seeding is then inert. Set it in the git-ignored
 * {@code config/application.properties}, alongside the JWT secret. The named account must already
 * have registered normally — this promotes, it never creates, so no account exists here without a
 * password its owner chose.
 */
@Component
@RequiredArgsConstructor
public class AdminSeeder implements ApplicationRunner {

    private static final Logger LOGGER = LoggerFactory.getLogger(AdminSeeder.class);

    private final UserRepo userRepo;

    @Value("${app.admin.email:}")
    private String adminEmail;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (adminEmail == null || adminEmail.isBlank()) {
            return;
        }

        userRepo.findByEmail(adminEmail.trim()).ifPresentOrElse(
                this::promote,
                () -> LOGGER.warn("app.admin.email names an account that has not registered yet; "
                        + "no admin was seeded"));
    }

    private void promote(User user) {
        if (user.getRole() == UserRole.ADMIN) {
            return;
        }
        user.setRole(UserRole.ADMIN);
        userRepo.save(user);
        LOGGER.info("Promoted the account named by app.admin.email to ADMIN");
    }
}
