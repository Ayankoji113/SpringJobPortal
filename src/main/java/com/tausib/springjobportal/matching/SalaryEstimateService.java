package com.tausib.springjobportal.matching;

import com.tausib.springjobportal.job.JobPost;
import com.tausib.springjobportal.job.JobRepo;
import com.tausib.springjobportal.job.SalaryStats;
import com.tausib.springjobportal.matching.dto.SalaryEstimateResponse;
import com.tausib.springjobportal.matching.dto.SalaryEstimateResponse.Confidence;
import com.tausib.springjobportal.matching.dto.SalaryEstimateResponse.Narrative;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Grounded salary estimate: percentiles come from SQL over comparable postings, the explanation
 * comes from the model, and the model is only ever shown the numbers we computed.
 */
@Service
public class SalaryEstimateService {

    private static final Logger log = LoggerFactory.getLogger(SalaryEstimateService.class);

    private static final String CURRENCY = "INR";

    private static final String SYSTEM_PROMPT = """
            You are a compensation analyst explaining a salary range to a candidate.

            You are given percentile statistics computed from real comparable job postings, the
            number of postings behind them, and the text of one target posting.

            Rules, without exception:
            - Every salary figure you write must be one of the supplied percentiles, quoted exactly.
            - Never invent, estimate, extrapolate, average, adjust, or recall a salary number from
              anywhere else, including your own knowledge of the market.
            - If the sample size is too small to support a claim, say so instead of making the claim.
            - If the posting states no salary, say the outlier question cannot be answered.

            Your job is to explain: what drives this range, which specific requirements in this
            posting justify a position within it, and whether the posting's own advertised range is
            an outlier against the comparables.
            """;

    private final JobRepo jobRepo;
    private final ChatClient chatClient;
    private final long llmTimeoutMs;
    private final int comparableLimit;
    private final int maxRequestsPerMinute;

    private long windowStartedAt;
    private int callsThisWindow;

    public SalaryEstimateService(JobRepo jobRepo,
                                 ChatModel chatModel,
                                 @Value("${salary.estimate.llm-timeout-ms:8000}") long llmTimeoutMs,
                                 @Value("${salary.estimate.comparable-limit:200}") int comparableLimit,
                                 @Value("${salary.estimate.max-requests-per-minute:10}") int maxRequestsPerMinute) {
        this.jobRepo = jobRepo;
        this.chatClient = ChatClient.create(chatModel);
        this.llmTimeoutMs = llmTimeoutMs;
        this.comparableLimit = comparableLimit;
        this.maxRequestsPerMinute = maxRequestsPerMinute;
    }

    /**
     * Free-tier quota guard. Refusing here costs the caller a narrative; spending the minute's
     * quota costs every other caller theirs, and the daily quota besides.
     *
     * ponytail: fixed window, counted per instance. Fine for one process against a per-key quota;
     * needs a shared counter (Redis, or the DB) the day this runs on more than one node.
     */
    private synchronized boolean withinRateLimit() {
        long now = System.currentTimeMillis();
        if (now - windowStartedAt >= 60_000) {
            windowStartedAt = now;
            callsThisWindow = 0;
        }
        if (callsThisWindow >= maxRequestsPerMinute) {
            return false;
        }
        callsThisWindow++;
        return true;
    }

    /**
     * Cached per (title, location, experience) — the same inputs produce the same comparables, so
     * an identical request must not pay for a second model call. A response without a narrative is
     * a degraded one and is never cached, so a transient model failure does not stick for the TTL.
     */
    @Cacheable(value = "salaryEstimates",
            key = "{#job.postProfile, #job.location, #job.reqExperience}",
            unless = "#result.narrative() == null")
    public SalaryEstimateResponse estimate(JobPost job) {
        SalaryStats stats = jobRepo.salaryComparables(
                job.getPostId(), job.getPostProfile(), job.getLocation(),
                job.getReqExperience(), comparableLimit);

        long sampleSize = stats == null ? 0 : stats.getSampleSize();
        Confidence confidence = confidenceFor(sampleSize);

        if (sampleSize == 0) {
            // Nothing to ground the model on, so it is not asked.
            return new SalaryEstimateResponse(CURRENCY, null, null, null, 0, confidence, null);
        }

        BigDecimal p25 = round(stats.getP25());
        BigDecimal p50 = round(stats.getP50());
        BigDecimal p75 = round(stats.getP75());

        return new SalaryEstimateResponse(CURRENCY, p25, p50, p75, sampleSize, confidence,
                narrate(job, p25, p50, p75, sampleSize, confidence));
    }

    static Confidence confidenceFor(long sampleSize) {
        if (sampleSize >= 20) return Confidence.HIGH;
        if (sampleSize >= 5) return Confidence.MEDIUM;
        return Confidence.LOW;
    }

    /**
     * Returns null rather than throwing: a slow or unavailable model degrades the response to bare
     * percentiles, it never fails the request.
     *
     * ponytail: the timeout abandons the call, it does not cancel it — a hung request still
     * occupies a common-pool thread until the HTTP client gives up. Give it a dedicated bounded
     * executor if salary estimates ever get heavy traffic.
     */
    private Narrative narrate(JobPost job, BigDecimal p25, BigDecimal p50, BigDecimal p75,
                              long sampleSize, Confidence confidence) {
        String userPrompt = """
                Comparable postings: %d (confidence: %s)
                25th percentile: %s %s
                50th percentile: %s %s
                75th percentile: %s %s

                Target posting
                Title: %s
                Location: %s
                Remote: %s
                Required experience (years): %s
                Advertised range: %s
                Tech stack: %s

                Description:
                %s
                """.formatted(
                sampleSize, confidence,
                CURRENCY, p25, CURRENCY, p50, CURRENCY, p75,
                job.getPostProfile(),
                job.getLocation(),
                Boolean.TRUE.equals(job.getIsRemote()) ? "yes" : "no",
                job.getReqExperience(),
                advertisedRange(job),
                job.getPostTechStack(),
                job.getPostDesc());

        if (!withinRateLimit()) {
            log.info("Salary narrative skipped for job {}: {} calls/minute limit reached",
                    job.getPostId(), maxRequestsPerMinute);
            return null;
        }

        try {
            return CompletableFuture
                    .supplyAsync(() -> chatClient.prompt()
                            .system(SYSTEM_PROMPT)
                            .user(userPrompt)
                            .call()
                            .entity(Narrative.class))
                    .get(llmTimeoutMs, TimeUnit.MILLISECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        } catch (Exception e) {
            log.warn("Salary narrative unavailable for job {}, returning percentiles only: {}",
                    job.getPostId(), e.toString());
            return null;
        }
    }

    private static String advertisedRange(JobPost job) {
        if (job.getSalaryMin() == null || job.getSalaryMax() == null) {
            return "not stated";
        }
        return CURRENCY + " " + job.getSalaryMin() + " - " + job.getSalaryMax();
    }

    private static BigDecimal round(Double value) {
        return value == null ? null : BigDecimal.valueOf(value).setScale(0, RoundingMode.HALF_UP);
    }
}
