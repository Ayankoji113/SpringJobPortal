package com.tausib.springjobportal.user;

import com.tausib.springjobportal.user.dto.UserResponse;
import com.tausib.springjobportal.user.dto.UserSummaryResponse;
import org.mapstruct.Mapper;

@Mapper
public interface UserMapper {

    UserResponse toResponse(User user);

    UserSummaryResponse toSummary(User user);
}
