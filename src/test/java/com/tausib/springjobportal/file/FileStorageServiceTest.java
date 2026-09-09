package com.tausib.springjobportal.file;

import com.tausib.springjobportal.common.exception.ResourceNotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

/**
 * Plain unit test — no Spring context, so it runs without a database.
 * Guards the containment check in {@link FileStorageService#loadFile}: the endpoint in front of it
 * is public, so a traversal here reads any file the JVM can, config/application.properties included.
 */
class FileStorageServiceTest {

    @Test
    void servesAFileInsideTheUploadDirectory(@TempDir Path root) throws IOException {
        FileStorageService service = new FileStorageService(root.resolve("uploads").toString());
        Files.writeString(root.resolve("uploads/logos/logo.png"), "png-bytes");

        assertArrayEquals("png-bytes".getBytes(), service.loadFile("logos/logo.png"));
    }

    @Test
    void refusesToWalkOutOfTheUploadDirectory(@TempDir Path root) throws IOException {
        FileStorageService service = new FileStorageService(root.resolve("uploads").toString());
        Files.writeString(root.resolve("secret.properties"), "jwt.secret=leaked");

        assertThrows(ResourceNotFoundException.class,
                () -> service.loadFile("../secret.properties"));
        assertThrows(ResourceNotFoundException.class,
                () -> service.loadFile("logos/../../secret.properties"));
    }

    @Test
    void refusesAnAbsolutePath(@TempDir Path root) throws IOException {
        FileStorageService service = new FileStorageService(root.resolve("uploads").toString());
        Path outside = root.resolve("secret.properties");
        Files.writeString(outside, "jwt.secret=leaked");

        assertThrows(ResourceNotFoundException.class,
                () -> service.loadFile(outside.toString()));
    }
}
