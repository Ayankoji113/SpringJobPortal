package com.tausib.springjobportal.common.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

import java.util.HashMap;
import java.util.Map;

@ControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, String>> handleResourceNotFound(ResourceNotFoundException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", ex.getMessage());
        return new ResponseEntity<>(error, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidationExceptions(MethodArgumentNotValidException ex) {
        Map<String, String> errors = new HashMap<>();
        ex.getBindingResult().getFieldErrors().forEach(error -> 
            errors.put(error.getField(), error.getDefaultMessage())
        );
        return new ResponseEntity<>(errors, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(ForbiddenOperationException.class)
    public ResponseEntity<Map<String, String>> handleForbidden(ForbiddenOperationException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", ex.getMessage());
        return new ResponseEntity<>(error, HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(org.springframework.security.authentication.DisabledException.class)
    public ResponseEntity<Map<String, String>> handleDisabled(
            org.springframework.security.authentication.DisabledException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", ex.getMessage());
        return new ResponseEntity<>(error, HttpStatus.FORBIDDEN);
    }

    /**
     * Spring Security's AccessDeniedException is a RuntimeException, so without this it fell
     * through to the handler below and every @PreAuthorize rejection was reported as
     * 400 Bad Request — telling the caller their request was malformed when in fact it was
     * refused. Authorization failures must read as 403.
     */
    @ExceptionHandler(org.springframework.security.access.AccessDeniedException.class)
    public ResponseEntity<Map<String, String>> handleAccessDenied(
            org.springframework.security.access.AccessDeniedException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "You do not have permission to do that.");
        return new ResponseEntity<>(error, HttpStatus.FORBIDDEN);
    }

    /** Bad credentials and friends are 401, not 400. */
    @ExceptionHandler(org.springframework.security.core.AuthenticationException.class)
    public ResponseEntity<Map<String, String>> handleAuthentication(
            org.springframework.security.core.AuthenticationException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "Email or password is incorrect.");
        return new ResponseEntity<>(error, HttpStatus.UNAUTHORIZED);
    }

    /** A database or serialization failure is our fault, not the caller's. */
    @ExceptionHandler({ org.springframework.dao.DataAccessException.class,
                        org.springframework.http.converter.HttpMessageConversionException.class })
    public ResponseEntity<Map<String, String>> handleServerSide(Exception ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "The server could not complete that request.");
        return new ResponseEntity<>(error, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Map<String, String>> handleRuntimeException(RuntimeException ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", ex.getMessage());
        return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGlobalException(Exception ex) {
        Map<String, String> error = new HashMap<>();
        error.put("error", "An error occurred: " + ex.getMessage());
        return new ResponseEntity<>(error, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
