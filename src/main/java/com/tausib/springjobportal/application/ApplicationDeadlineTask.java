package com.tausib.springjobportal.application;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Enforces the response deadline. Runs hourly rather than nightly so a server that is not up at a
 * fixed time still catches up within the hour it starts.
 */
// ponytail: in-process scheduler, fine for one instance; needs a lock (e.g. ShedLock) before a second instance runs.
@Slf4j
@Component
@RequiredArgsConstructor
public class ApplicationDeadlineTask {

    private final JobApplicationService applicationService;

    @Scheduled(initialDelayString = "PT1M", fixedDelayString = "PT1H")
    public void run() {
        LocalDateTime now = LocalDateTime.now();
        // Lapse first, so an application already past its deadline is not also "reminded".
        int lapsed = applicationService.lapseOverdue(now);
        int reminded = applicationService.sendDeadlineReminders(now);
        if (lapsed > 0 || reminded > 0) {
            log.info("Application deadlines: {} lapsed, {} employers reminded", lapsed, reminded);
        }
    }
}
