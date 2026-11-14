package com.tausib.springjobportal.matching;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.tausib.springjobportal.job.JobMapper;
import com.tausib.springjobportal.job.JobPost;
import com.tausib.springjobportal.job.JobRepo;
import com.tausib.springjobportal.job.JobService;
import com.tausib.springjobportal.job.JobStatus;
import com.tausib.springjobportal.job.dto.JobResponse;
import com.tausib.springjobportal.user.User;
import com.tausib.springjobportal.user.UserMapper;
import com.tausib.springjobportal.user.UserPrincipal;
import com.tausib.springjobportal.user.UserRepo;
import com.tausib.springjobportal.user.UserRole;
import com.tausib.springjobportal.user.UserService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AIControllerTest {

    @Test
    void recommendationsNeverCarryAccountFields() throws Exception {
        User employer = User.builder().id(1).email("boss@example.com").password("employer-hash")
                .passwordResetToken("employer-reset-token").role(UserRole.EMPLOYER).build();
        User seeker = User.builder().id(2).email("me@example.com").password("seeker-hash")
                .role(UserRole.JOB_SEEKER).build();
        JobPost job = JobPost.builder().postId(7).postProfile("Backend Engineer").postedBy(employer).build();
        MatchScore match = MatchScore.builder().id(3).user(seeker).jobPost(job).score(80.0)
                .matchedSkills(List.of("java")).missingSkills(List.of("go")).build();

        // Real services over mocked repositories: Mockito cannot mock concrete classes on newer JDKs.
        UserRepo userRepo = mock(UserRepo.class);
        JobRepo jobRepo = mock(JobRepo.class);
        MatchScoreRepo matchScoreRepo = mock(MatchScoreRepo.class);
        JobMapper jobMapper = mock(JobMapper.class);
        when(userRepo.findById(2)).thenReturn(Optional.of(seeker));
        when(jobRepo.findByStatusAndIsActiveTrue(JobStatus.PUBLISHED)).thenReturn(List.of(job));
        when(matchScoreRepo.findByUserIdAndJobPostPostId(2, 7)).thenReturn(Optional.of(match));
        when(jobMapper.toResponse(job)).thenReturn(
                JobResponse.builder().postId(7).postProfile("Backend Engineer").build());
        UserService userService = new UserService(userRepo, mock(UserMapper.class), null);
        JobService jobService = new JobService(jobRepo, jobMapper, userService, null, null);

        var body = new AIController(new AIService(matchScoreRepo, userService), null, jobService, jobMapper)
                .getRecommendedJobs(UserPrincipal.from(seeker), 50).getBody();
        String json = new ObjectMapper().registerModule(new JavaTimeModule()).writeValueAsString(body);

        assertThat(json).contains("\"score\":80.0", "Backend Engineer", "\"missingSkills\":[\"go\"]");
        assertThat(json).doesNotContain("hash", "reset-token", "password", "example.com");
    }
}
