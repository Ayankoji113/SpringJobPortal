package com.tausib.springjobportal.user;

public enum UserRole {
    EMPLOYER,
    JOB_SEEKER,

    /**
     * Moderation and account administration. Never self-assignable: registration rejects it (see
     * {@code AuthService.register}) and the first admin is promoted at startup from
     * {@code app.admin.email}. Admins promote admins after that.
     */
    ADMIN;

    /** The roles a person may choose for themselves when registering. */
    public boolean isSelfAssignable() {
        return this != ADMIN;
    }
}
