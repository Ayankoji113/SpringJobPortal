package com.tausib.springjobportal.job;

import com.tausib.springjobportal.company.CompanyMapper;
import com.tausib.springjobportal.job.dto.JobResponse;
import com.tausib.springjobportal.job.dto.SavedJobResponse;
import com.tausib.springjobportal.user.UserMapper;
import org.mapstruct.Mapper;

@Mapper(uses = {UserMapper.class, CompanyMapper.class})
public interface JobMapper {

    JobResponse toResponse(JobPost jobPost);

    SavedJobResponse toResponse(SavedJob savedJob);
}
