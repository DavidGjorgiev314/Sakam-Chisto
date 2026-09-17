package com.sakamchisto.backend.exception;

public class CleanerNotFoundException extends RuntimeException {
    public CleanerNotFoundException(Long id) {
        super("Cleaner with ID " + id + " not found");
    }
}
