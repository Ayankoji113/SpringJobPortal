package com.tausib.springjobportal.job;

/**
 * Published when an employer takes a posting down. The applications module listens and resolves
 * whatever is still open on it; an event rather than a call because {@code application} already
 * depends on {@code job}, and the reverse would make the two circular.
 */
public record JobClosedEvent(Integer postId) {}
