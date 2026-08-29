package com.tausib.springjobportal.job;

/** Percentile projection over comparable postings. All percentiles are null when sampleSize is 0. */
public interface SalaryStats {
    long getSampleSize();
    Double getP25();
    Double getP50();
    Double getP75();
}
