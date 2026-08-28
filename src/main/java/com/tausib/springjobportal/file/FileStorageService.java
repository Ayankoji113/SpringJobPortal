package com.tausib.springjobportal.file;

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

    public byte[] loadFile(String filePath) {
        try {
            Path path = uploadDir.resolve(filePath).normalize();
            return Files.readAllBytes(path);
        } catch (IOException e) {
            throw new RuntimeException("File not found: " + filePath, e);
        }
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
