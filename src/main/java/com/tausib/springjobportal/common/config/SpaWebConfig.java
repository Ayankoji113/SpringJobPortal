package com.tausib.springjobportal.common.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;

/**
 * Serves the React build bundled into {@code classpath:/static/} (the Dockerfile puts it there) and
 * answers client-side routes such as {@code /job/3} with {@code index.html}, so deep links and
 * reloads work. Controllers are matched before resource handlers, so {@code /api/**} is untouched;
 * an unknown {@code /api}, actuator or Swagger path still 404s instead of returning the SPA.
 *
 * <p>In development nothing is bundled, {@code index.html} is absent and every non-API path 404s,
 * exactly as before; the Vite dev server serves the frontend.
 */
@Configuration
public class SpaWebConfig implements WebMvcConfigurer {

    private static final Resource INDEX = new ClassPathResource("static/index.html");

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String path, Resource location) throws IOException {
                        Resource requested = location.createRelative(path);
                        if (!path.isEmpty() && requested.exists() && requested.isReadable()) {
                            return requested;
                        }
                        // A missing file (/assets/old-hash.js) should 404, not come back as HTML.
                        boolean looksLikeFile = path.substring(path.lastIndexOf('/') + 1).contains(".");
                        if (looksLikeFile || isBackendPath(path) || !INDEX.exists()) {
                            return null;
                        }
                        return INDEX;
                    }
                });
    }

    static boolean isBackendPath(String path) {
        return path.startsWith("api/") || path.equals("api")
                || path.startsWith("actuator") || path.startsWith("v3/") || path.startsWith("swagger-ui")
                || path.equals("error");
    }
}
