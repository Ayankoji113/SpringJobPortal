package com.tausib.springjobportal.matching.dto;

import com.tausib.springjobportal.job.dto.JobResponse;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Wire shape of a match score. The endpoints used to return the {@code MatchScore} entity, whose
 * {@code user} and {@code jobPost.postedBy} are full {@code User} rows — password hash and reset
 * token included — for the caller and for every employer in the list.
 */
public record MatchScoreResponse(
        Integer id,
        JobResponse jobPost,
        Double score,
        List<String> matchedSkills,
        List<String> missingSkills,
        LocalDateTime generatedAt
) {}
