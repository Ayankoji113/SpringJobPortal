package com.tausib.springjobportal.matching;

import com.tausib.springjobportal.job.JobPost;
import com.tausib.springjobportal.job.JobRepo;
import com.tausib.springjobportal.job.SalaryStats;
import com.tausib.springjobportal.matching.dto.SalaryEstimateResponse;
import com.tausib.springjobportal.matching.dto.SalaryEstimateResponse.Confidence;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SalaryEstimateServiceTest {

    private static final String NARRATIVE_JSON = """
            {"rangeDrivers":"Seniority and the Kubernetes requirement.",
             "positioning":"Eight years' experience places this above the median.",
             "outlierAssessment":"The advertised range sits inside the comparables."}
            """;

    @Mock
    JobRepo jobRepo;

    @Mock
    ChatModel chatModel;

    private SalaryEstimateService service() {
        when(chatModel.getDefaultOptions()).thenReturn(ChatOptions.builder().build());
        return new SalaryEstimateService(jobRepo, chatModel, 5000, 200, 10);
    }

    private JobPost job() {
        return JobPost.builder()
                .postId(7)
                .postProfile("Backend Engineer")
                .postDesc("Spring Boot services on Kubernetes.")
                .reqExperience(8)
                .location("Pune")
                .postTechStack(List.of("java", "kubernetes"))
                .salaryMin(new BigDecimal("1800000"))
                .salaryMax(new BigDecimal("2400000"))
                .build();
    }

    /** Plain stand-in, not a mock — a mock here would be built inside an unfinished when(). */
    private record Stats(long sampleSize, Double p25, Double p50, Double p75) implements SalaryStats {
        public long getSampleSize() { return sampleSize; }
        public Double getP25() { return p25; }
        public Double getP50() { return p50; }
        public Double getP75() { return p75; }
    }

    private SalaryStats stats(long sampleSize, Double p25, Double p50, Double p75) {
        return new Stats(sampleSize, p25, p50, p75);
    }

    private void chatReturns(String content) {
        when(chatModel.call(any(Prompt.class)))
                .thenReturn(new ChatResponse(List.of(new Generation(new AssistantMessage(content)))));
    }

    @Test
    void returnsPercentilesAndNarrativeWhenComparablesExist() {
        when(jobRepo.salaryComparables(eq(7), eq("Backend Engineer"), eq("Pune"), eq(8), anyInt()))
                .thenReturn(stats(31, 1_500_000.0, 1_900_000.4, 2_300_000.0));
        chatReturns(NARRATIVE_JSON);

        SalaryEstimateResponse result = service().estimate(job());

        assertThat(result.sampleSize()).isEqualTo(31);
        assertThat(result.confidence()).isEqualTo(Confidence.HIGH);
        assertThat(result.p25()).isEqualByComparingTo("1500000");
        assertThat(result.p50()).isEqualByComparingTo("1900000");
        assertThat(result.p75()).isEqualByComparingTo("2300000");
        assertThat(result.currency()).isEqualTo("INR");
        assertThat(result.narrative()).isNotNull();
        assertThat(result.narrative().rangeDrivers()).contains("Kubernetes");
        assertThat(result.narrative().outlierAssessment()).isNotBlank();
    }

    @Test
    void fallsBackToPercentilesWhenTheModelFails() {
        when(jobRepo.salaryComparables(any(), any(), any(), any(), anyInt()))
                .thenReturn(stats(31, 1_500_000.0, 1_900_000.0, 2_300_000.0));
        when(chatModel.call(any(Prompt.class))).thenThrow(new RuntimeException("upstream 503"));

        SalaryEstimateResponse result = service().estimate(job());

        assertThat(result.narrative()).isNull();
        assertThat(result.sampleSize()).isEqualTo(31);
        assertThat(result.p50()).isEqualByComparingTo("1900000");
        assertThat(result.confidence()).isEqualTo(Confidence.HIGH);
    }

    @Test
    void lowSampleSizeIsFlaggedAndStillNarrated() {
        when(jobRepo.salaryComparables(any(), any(), any(), any(), anyInt()))
                .thenReturn(stats(3, 1_100_000.0, 1_200_000.0, 1_300_000.0));
        chatReturns(NARRATIVE_JSON);

        SalaryEstimateResponse result = service().estimate(job());

        assertThat(result.confidence()).isEqualTo(Confidence.LOW);
        assertThat(result.sampleSize()).isEqualTo(3);
        assertThat(result.narrative()).isNotNull();
    }

    @Test
    void noComparablesMeansNoModelCall() {
        when(jobRepo.salaryComparables(any(), any(), any(), any(), anyInt()))
                .thenReturn(stats(0, null, null, null));

        SalaryEstimateResponse result = service().estimate(job());

        assertThat(result.sampleSize()).isZero();
        assertThat(result.confidence()).isEqualTo(Confidence.LOW);
        assertThat(result.p50()).isNull();
        assertThat(result.narrative()).isNull();
        verify(chatModel, never()).call(any(Prompt.class));
    }

    @Test
    void rateLimitSkipsTheModelAndStillReturnsPercentiles() {
        when(jobRepo.salaryComparables(any(), any(), any(), any(), anyInt()))
                .thenReturn(stats(31, 1_500_000.0, 1_900_000.0, 2_300_000.0));
        chatReturns(NARRATIVE_JSON);
        when(chatModel.getDefaultOptions()).thenReturn(ChatOptions.builder().build());
        SalaryEstimateService service = new SalaryEstimateService(jobRepo, chatModel, 5000, 200, 2);

        // The cache is not in play here (no proxy), so every call reaches the limiter.
        assertThat(service.estimate(job()).narrative()).isNotNull();
        assertThat(service.estimate(job()).narrative()).isNotNull();

        SalaryEstimateResponse throttled = service.estimate(job());
        assertThat(throttled.narrative()).as("third call in the window is refused").isNull();
        assertThat(throttled.p50()).isEqualByComparingTo("1900000");
        verify(chatModel, times(2)).call(any(Prompt.class));
    }

    @Test
    void confidenceBandsFollowSampleSize() {
        assertThat(SalaryEstimateService.confidenceFor(20)).isEqualTo(Confidence.HIGH);
        assertThat(SalaryEstimateService.confidenceFor(19)).isEqualTo(Confidence.MEDIUM);
        assertThat(SalaryEstimateService.confidenceFor(5)).isEqualTo(Confidence.MEDIUM);
        assertThat(SalaryEstimateService.confidenceFor(4)).isEqualTo(Confidence.LOW);
        assertThat(SalaryEstimateService.confidenceFor(0)).isEqualTo(Confidence.LOW);
    }

    @Test
    void missingLocationAndExperienceAreQueriedAsNull() {
        JobPost sparse = JobPost.builder().postId(9).postProfile("Intern").build();
        when(jobRepo.salaryComparables(eq(9), eq("Intern"), isNull(), isNull(), anyInt()))
                .thenReturn(stats(0, null, null, null));

        assertThat(service().estimate(sparse).sampleSize()).isZero();
    }
}
