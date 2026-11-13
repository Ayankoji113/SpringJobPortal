package com.tausib.springjobportal.file;

import com.tausib.springjobportal.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Set;

/**
 * Serves the uploads that are meant to be public: profile photos and company logos, which are
 * rendered in {@code <img>} tags and so cannot carry an Authorization header.
 *
 * <p>Resumes are deliberately not reachable here. This endpoint needs no authentication, and a
 * resume is only ever disclosed to an employer through an application they own — see
 * {@code GET /api/applications/&#123;id&#125;/resume}.
 */
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private static final Set<String> PUBLIC_DIRS = Set.of("photos/", "logos/");

    private final FileStorageService fileStorageService;

    @GetMapping
    public ResponseEntity<byte[]> getFile(@RequestParam String path) {
        if (PUBLIC_DIRS.stream().noneMatch(path::startsWith)) {
            throw new ResourceNotFoundException("File not found: " + path);
        }

        byte[] fileContent = fileStorageService.loadFile(path);

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(FileStorageService.contentTypeFor(path)))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + path.substring(path.lastIndexOf('/') + 1) + "\"")
                .body(fileContent);
    }
}
