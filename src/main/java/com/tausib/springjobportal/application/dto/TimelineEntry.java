package com.tausib.springjobportal.application.dto;

import com.tausib.springjobportal.application.ApplicationStatus;

import java.time.LocalDateTime;

/**
 * One step in an application's history.
 *
 * @param actor who made the change: {@code APPLICANT}, {@code EMPLOYER} or {@code SYSTEM}. A role,
 *              not a name, so the applicant never learns which person at the employer acted.
 */
public record TimelineEntry(ApplicationStatus fromStatus, ApplicationStatus toStatus, String actor,
                            String note, LocalDateTime createdAt) {}
