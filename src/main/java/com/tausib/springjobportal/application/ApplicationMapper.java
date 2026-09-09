package com.tausib.springjobportal.application;

import com.tausib.springjobportal.application.dto.ApplicationResponse;
import com.tausib.springjobportal.job.JobMapper;
import com.tausib.springjobportal.user.UserMapper;
import org.mapstruct.Mapper;

/** Applicant maps to {@code UserSummaryResponse} by target type — see the DTO for why that matters. */
@Mapper(uses = {JobMapper.class, UserMapper.class})
public interface ApplicationMapper {

    ApplicationResponse toResponse(JobApplication application);
}
