package com.tausib.springjobportal.common;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Bundled-SPA and operations routing. src/test/resources/static/index.html stands in for the
 * React build the Dockerfile bundles into the jar.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SpaAndOpsEndpointsTest {

    private static final String SPA_MARKER = "spa-test-index";

    @Autowired
    private MockMvc mvc;

    @Test
    void deepLinksReturnTheSpa() throws Exception {
        // "/" is a servlet forward to index.html, which MockMvc does not follow; checked against
        // the running jar instead.
        mvc.perform(get("/job/3")).andExpect(status().isOk()).andExpect(content().string(containsString(SPA_MARKER)));
        mvc.perform(get("/employer/applications")).andExpect(status().isOk())
                .andExpect(content().string(containsString(SPA_MARKER)));
    }

    @Test
    void apiIsUntouchedBySpaFallback() throws Exception {
        mvc.perform(get("/api/jobs/paginated")).andExpect(status().isOk())
                .andExpect(content().string(not(containsString(SPA_MARKER))));
        // Unknown API path without a token: rejected, never the SPA
        mvc.perform(get("/api/no-such-endpoint")).andExpect(status().is4xxClientError());
    }

    @Test
    void missingAssetIs404NotHtml() throws Exception {
        mvc.perform(get("/assets/gone-1234.js")).andExpect(status().isNotFound());
    }

    @Test
    void onlyHealthAndInfoArePublic() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk())
                .andExpect(content().string(containsString("\"status\":\"UP\"")));
        mvc.perform(get("/actuator/info")).andExpect(status().isOk());
        mvc.perform(get("/actuator/env")).andExpect(status().is4xxClientError())
                .andExpect(content().string(not(containsString(SPA_MARKER))));
    }
}
