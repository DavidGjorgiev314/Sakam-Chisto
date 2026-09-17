package com.sakamchisto.backend.exception;

import com.sakamchisto.backend.exception.CleanerNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(CleanerNotFoundException.class)
    public ResponseEntity<String> handleCleanerNotFound(CleanerNotFoundException ex) {
        return new ResponseEntity<>(ex.getMessage(), HttpStatus.NOT_FOUND);
    }
}
