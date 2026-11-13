package com.tausib.springjobportal.job;

/**
 * Moderation state of a posting, replacing the old {@code isApproved} boolean — which could not
 * carry a rejection reason, and which five of the seven job queries forgot to filter on.
 *
 * <p>Orthogonal to {@code isActive}, the employer's own on/off switch: the public sees a posting
 * only when it is {@link #PUBLISHED} <em>and</em> active.
 */
public enum JobStatus {

    /** Awaiting review. Where every posting from an untrusted employer lands. */
    PENDING_REVIEW,

    /** Cleared. Visible to the public if the employer also has it active. */
    PUBLISHED,

    /** Refused by an admin, with a reason the employer can read. Not reversible by the employer. */
    REJECTED,

    /** Pulled after a report was upheld. Reversible — an admin can publish it again. */
    SUSPENDED
}
