package com.tausib.springjobportal.company;

import com.tausib.springjobportal.company.dto.CompanyResponse;
import com.tausib.springjobportal.company.dto.CompanySummaryResponse;
import com.tausib.springjobportal.user.UserMapper;
import org.mapstruct.Mapper;

@Mapper(uses = UserMapper.class)
public interface CompanyMapper {

    CompanyResponse toResponse(Company company);

    CompanySummaryResponse toSummary(Company company);
}
