package com.tausib.springjobportal.matching.dto;

import java.math.BigDecimal;

/**
 * Salary estimate for one posting. The percentiles are computed in SQL from comparable postings;
 * {@code narrative} is the model's explanation of them and is null whenever the model call was
 * skipped, timed out, or failed — the figures stand on their own.
 */
public record SalaryEstimateResponse(
        String currency,
        BigDecimal p25,
        BigDecimal p50,
        BigDecimal p75,
        long sampleSize,
        Confidence confidence,
        Narrative narrative
) {
    public enum Confidence { HIGH, MEDIUM, LOW }

    /** Model output. Parsed from JSON by Spring AI's structured output converter. */
    public record Narrative(String rangeDrivers, String positioning, String outlierAssessment) {}
}
