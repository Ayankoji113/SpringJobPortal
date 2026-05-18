package com.tausib.springjobportal.controller;

import com.tausib.springjobportal.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final FileStorageService fileStorageService;

    @GetMapping
    public ResponseEntity<byte[]> getFile(@RequestParam String path) {
        byte[] fileContent = fileStorageService.loadFile(path);

        String contentType = "application/octet-stream";
        if (path.endsWith(".pdf")) contentType = "application/pdf";
        else if (path.endsWith(".jpg") || path.endsWith(".jpeg")) contentType = "image/jpeg";
        else if (path.endsWith(".png")) contentType = "image/png";
        else if (path.endsWith(".webp")) contentType = "image/webp";
        else if (path.endsWith(".gif")) contentType = "image/gif";
        else if (path.endsWith(".doc")) contentType = "application/msword";
        else if (path.endsWith(".docx")) contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(contentType))
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + path.substring(path.lastIndexOf('/') + 1) + "\"")
                .body(fileContent);
    }
}
