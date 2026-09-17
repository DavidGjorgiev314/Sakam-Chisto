package com.sakamchisto.backend.service;

import com.sakamchisto.backend.model.Cleaner;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

public interface CleanerService {
    List<Cleaner> getAllCleaners();
    Cleaner findById(Long id);
    Cleaner createCleaner(Cleaner cleaner);
    Cleaner updateCleaner(Long id, String name, String surname, Double pricePerHour, String imageUrl);
    Cleaner deleteCleaner(Long id);
    Cleaner uploadPhoto(Long id, MultipartFile file) throws IOException;
}
