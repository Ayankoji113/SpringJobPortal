package com.tausib.springjobportal;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The model API key must reach the app from the environment only. This fails the build if a real
 * key is ever pasted into a file, and if the property stops being an environment placeholder.
 */
class NoCommittedApiKeyTest {

    /** Assembled at runtime so this file does not itself contain the literals it searches for. */
    private static final Pattern API_KEY = Pattern.compile(
            "AIza" + "[0-9A-Za-z_-]{35}"              // Google AI Studio, older format
                    + "|AQ" + "[.][A-Za-z0-9_-]{30,}"   // Google AI Studio, current format
                    + "|sk-" + "[A-Za-z0-9_-]{20,}");    // OpenAI-style, incl. sk-ant-

    /** Build output and vendored code, skipped wherever they appear. */
    private static final Set<String> SKIP_ANYWHERE =
            Set.of("target", "node_modules", ".git", "dist", "build", "uploads");

    /**
     * The git-ignored local override directory, skipped ONLY at the repo root — a key there is
     * never committed. Matching "config" at any depth would also skip common/config/ and every
     * *Config.java beside it, which is exactly where a pasted key must still be caught.
     */
    private static final String SKIP_AT_ROOT = "config";

    private static final Path ROOT = Paths.get(".").toAbsolutePath().normalize();

    @Test
    void noModelApiKeyIsCommittedAnywhere() throws IOException {
        try (Stream<Path> files = Files.walk(ROOT)) {
            List<Path> offenders = files
                    .filter(Files::isRegularFile)
                    .filter(NoCommittedApiKeyTest::isScannable)
                    .filter(NoCommittedApiKeyTest::containsKey)
                    .toList();

            assertThat(offenders)
                    .as("files containing what looks like a committed model API key")
                    .isEmpty();
        }
    }

    @Test
    void apiKeyPropertyReadsFromTheEnvironment() throws IOException {
        String properties = Files.readString(Path.of("src/main/resources/application.properties"));

        assertThat(properties)
                .as("the key must be a ${GEMINI_API_KEY} placeholder, never a literal")
                .contains("spring.ai.openai.api-key=${GEMINI_API_KEY");
    }

    private static boolean isScannable(Path path) {
        Path relative = ROOT.relativize(path);
        for (Path segment : relative) {
            if (SKIP_ANYWHERE.contains(segment.toString())) {
                return false;
            }
        }
        return !relative.getName(0).toString().equals(SKIP_AT_ROOT);
    }

    private static boolean containsKey(Path path) {
        try {
            return API_KEY.matcher(Files.readString(path, StandardCharsets.UTF_8)).find();
        } catch (IOException e) {
            return false; // binary or unreadable: cannot hold a pasted key in text form
        }
    }
}
