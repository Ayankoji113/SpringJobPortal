package com.tausib.springjobportal.file;

import com.tausib.springjobportal.common.exception.ResourceNotFoundException;
import org.apache.commons.io.FilenameUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Set;
import java.util.UUID;

@Service
public class FileStorageService {

    private final Path uploadDir;

    private static final Set<String> ALLOWED_IMAGE_TYPES = Set.of("jpg", "jpeg", "png", "gif", "webp");
    private static final Set<String> ALLOWED_RESUME_TYPES = Set.of("pdf", "doc", "docx");
    private static final long MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    public FileStorageService(@Value("${app.upload.dir:./uploads}") String uploadPath) {
        this.uploadDir = Paths.get(uploadPath).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.uploadDir);
            Files.createDirectories(this.uploadDir.resolve("photos"));
            Files.createDirectories(this.uploadDir.resolve("resumes"));
            Files.createDirectories(this.uploadDir.resolve("logos"));
        } catch (IOException e) {
            throw new RuntimeException("Could not create upload directories", e);
        }
    }

    public String storeProfilePhoto(MultipartFile file, Integer userId) {
        validateFile(file, ALLOWED_IMAGE_TYPES);
        String filename = "photo_" + userId + "_" + UUID.randomUUID().toString().substring(0, 8)
                + "." + FilenameUtils.getExtension(file.getOriginalFilename());
        return storeFile(file, "photos", filename);
    }

    public String storeResume(MultipartFile file, Integer userId) {
        validateFile(file, ALLOWED_RESUME_TYPES);
        String filename = "resume_" + userId + "_" + UUID.randomUUID().toString().substring(0, 8)
                + "." + FilenameUtils.getExtension(file.getOriginalFilename());
        return storeFile(file, "resumes", filename);
    }

    public String storeCompanyLogo(MultipartFile file, Integer companyId) {
        validateFile(file, ALLOWED_IMAGE_TYPES);
        String filename = "logo_" + companyId + "_" + UUID.randomUUID().toString().substring(0, 8)
                + "." + FilenameUtils.getExtension(file.getOriginalFilename());
        return storeFile(file, "logos", filename);
    }

    /**
     * Reads one stored upload. {@code filePath} arrives straight from a query parameter, so the
     * resolved path is checked back against {@link #uploadDir}: resolve() walks out of the upload
     * directory on "../.." and treats an absolute path as a replacement, either of which turned
     * this into an arbitrary-file-read of the host.
     */
    public byte[] loadFile(String filePath) {
        Path path = uploadDir.resolve(filePath).normalize();
        if (!path.startsWith(uploadDir)) {
            throw new ResourceNotFoundException("File not found: " + filePath);
        }
        try {
            return Files.readAllBytes(path);
        } catch (IOException e) {
            throw new ResourceNotFoundException("File not found: " + filePath);
        }
    }

    /** Content type for a stored upload, by extension. Shared with the resume endpoint. */
    public static String contentTypeFor(String path) {
        String ext = FilenameUtils.getExtension(path).toLowerCase();
        return switch (ext) {
            case "pdf" -> "application/pdf";
            case "jpg", "jpeg" -> "image/jpeg";
            case "png" -> "image/png";
            case "webp" -> "image/webp";
            case "gif" -> "image/gif";
            case "doc" -> "application/msword";
            case "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            default -> "application/octet-stream";
        };
    }

    private String storeFile(MultipartFile file, String subDir, String filename) {
        try {
            Path targetDir = uploadDir.resolve(subDir);
            Path targetPath = targetDir.resolve(filename);
            Files.copy(file.getInputStream(), targetPath, StandardCopyOption.REPLACE_EXISTING);
            return subDir + "/" + filename;
        } catch (IOException e) {
            throw new RuntimeException("Failed to store file", e);
        }
    }

    private void validateFile(MultipartFile file, Set<String> allowedTypes) {
        if (file.isEmpty()) {
            throw new RuntimeException("File is empty");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new RuntimeException("File size exceeds maximum allowed size of 10MB");
        }
        String extension = FilenameUtils.getExtension(file.getOriginalFilename());
        if (extension == null || !allowedTypes.contains(extension.toLowerCase())) {
            throw new RuntimeException("File type not allowed. Allowed types: " + allowedTypes);
        }
    }
}
