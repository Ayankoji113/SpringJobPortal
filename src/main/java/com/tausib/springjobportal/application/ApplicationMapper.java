package com.tausib.springjobportal.application;

import com.tausib.springjobportal.application.dto.ApplicationResponse;
import com.tausib.springjobportal.job.JobMapper;
import com.tausib.springjobportal.user.UserMapper;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/** Applicant maps to {@code UserSummaryResponse} by target type — see the DTO for why that matters. */
@Mapper(uses = {JobMapper.class, UserMapper.class})
public interface ApplicationMapper {

    @Mapping(target = "nextStatuses", expression = "java(application.getStatus().nextForEmployer())")
    ApplicationResponse toResponse(JobApplication application);
}
