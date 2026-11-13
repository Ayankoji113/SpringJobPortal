package com.tausib.springjobportal.common.exception;

/** The caller is authenticated but does not own the resource they are acting on. */
public class ForbiddenOperationException extends RuntimeException {
    public ForbiddenOperationException(String message) {
        super(message);
    }
}
