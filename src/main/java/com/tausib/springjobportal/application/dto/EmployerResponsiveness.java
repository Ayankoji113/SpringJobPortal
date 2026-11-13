package com.tausib.springjobportal.application.dto;

/**
 * An employer's record of answering applicants over the last 90 days.
 *
 * @param sampleSize          applications whose outcome is known
 * @param responseRatePercent share answered before the deadline; null until the sample is large
 *                            enough to mean something
 * @param medianDays          typical days to a first answer; null under the same condition
 */
public record EmployerResponsiveness(long sampleSize, Integer responseRatePercent, Double medianDays) {}
