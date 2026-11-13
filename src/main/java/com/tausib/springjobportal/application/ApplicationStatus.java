package com.tausib.springjobportal.application;

import java.util.List;

/**
 * Where an application stands. The employer moves it forward one stage at a time or rejects it;
 * the applicant can withdraw; the system marks it {@link #NO_RESPONSE} when the employer misses
 * the response deadline.
 */
public enum ApplicationStatus {
    PENDING,
    REVIEWED,
    INTERVIEW,
    OFFERED,
    /** Hired. */
    ACCEPTED,
    REJECTED,
    /** The applicant pulled out. */
    WITHDRAWN,
    /** The employer did not act before the deadline. They may still act late; the miss stands. */
    NO_RESPONSE;

    /** The stages an employer may move an application to from here. Empty once it is finished. */
    public List<ApplicationStatus> nextForEmployer() {
        return switch (this) {
            case PENDING, NO_RESPONSE -> List.of(REVIEWED, REJECTED);
            case REVIEWED -> List.of(INTERVIEW, REJECTED);
            case INTERVIEW -> List.of(OFFERED, REJECTED);
            case OFFERED -> List.of(ACCEPTED, REJECTED);
            case ACCEPTED, REJECTED, WITHDRAWN -> List.of();
        };
    }

    /** Still in play: the applicant can withdraw it, and closing the posting must resolve it. */
    public boolean isOpen() {
        return !nextForEmployer().isEmpty();
    }
}
