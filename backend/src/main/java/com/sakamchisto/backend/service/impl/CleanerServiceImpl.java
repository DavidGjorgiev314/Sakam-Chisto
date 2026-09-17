package com.sakamchisto.backend.service.impl;

import com.sakamchisto.backend.exception.CleanerNotFoundException;
import com.sakamchisto.backend.model.Cleaner;
import com.sakamchisto.backend.repository.CleanerRepository;
import com.sakamchisto.backend.service.CleanerService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;

@Service
public class CleanerServiceImpl implements CleanerService {
    private final CleanerRepository cleanerRepository;

    @Value("${app.uploads.dir:uploads}")
    private String uploadsDir;

    public CleanerServiceImpl(CleanerRepository cleanerRepository) {
        this.cleanerRepository = cleanerRepository;
    }

    @Override
    public List<Cleaner> getAllCleaners() {
        return this.cleanerRepository.findAll();
    }

    @Override
    public Cleaner findById(Long id) {
        return this.cleanerRepository.findById(id).orElseThrow(() -> new CleanerNotFoundException(id));
    }

    @Override
    public Cleaner createCleaner(Cleaner cleaner) {
        return this.cleanerRepository.save(cleaner);
    }

    @Override
    public Cleaner updateCleaner(Long id, String name, String surname, Double pricePerHour, String imageUrl) {
        Cleaner cleaner = this.findById(id);
        cleaner.setName(name);
        cleaner.setSurname(surname);
        cleaner.setPricePerHour(pricePerHour);
        cleaner.setImageUrl(imageUrl);
        return this.cleanerRepository.save(cleaner);
    }

    @Override
    public Cleaner deleteCleaner(Long id) {
        Cleaner cleaner = this.findById(id);
        this.cleanerRepository.delete(cleaner);
        return cleaner;
    }

    @Override
    public Cleaner uploadPhoto(Long id, MultipartFile file) throws IOException {
        System.out.println("Received file: " + file.getOriginalFilename());
        Cleaner cleaner = this.findById(id);
        Path uploadDir = Paths.get(uploadsDir);
        System.out.println("Uploads directory resolved to: " + uploadDir.toAbsolutePath());
        if (!Files.exists(uploadDir)) {
            Files.createDirectories(uploadDir);
        }

        // Build file path: e.g. "uploads/cleaner_5_photo.jpg"
        String filename = "cleaner_" + id + "_" + file.getOriginalFilename();
        Path filePath = uploadDir.resolve(filename);

        // Copy file from request into that folder
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
        System.out.println("Saved file to: " + filePath.toAbsolutePath());

        // Save relative URL to DB
        cleaner.setImageUrl("/uploads/" + filename);
        return this.cleanerRepository.save(cleaner);
    }

}
