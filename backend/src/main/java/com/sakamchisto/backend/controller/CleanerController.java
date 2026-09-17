package com.sakamchisto.backend.controller;

import com.sakamchisto.backend.model.Cleaner;
import com.sakamchisto.backend.service.CleanerService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/cleaners")
public class CleanerController {

    private final CleanerService cleanerService;

    public CleanerController(CleanerService cleanerService) {
        this.cleanerService = cleanerService;
    }

    @GetMapping
    public List<Cleaner> getAllCleaners() {
        return this.cleanerService.getAllCleaners();
    }

    @GetMapping("/{id}")
    public Cleaner getCleanerById(@PathVariable Long id) {
        return cleanerService.findById(id);
    }

    @PostMapping
    public Cleaner createCleaner(@RequestBody Cleaner cleaner) {
        return this.cleanerService.createCleaner(cleaner);
    }

    @PutMapping("/update/{id}")
    public Cleaner updateCleaner(@PathVariable Long id,
                                 @RequestParam(required = false) String name,
                                 @RequestParam(required = false) String surname,
                                 @RequestParam(required = false) Double pricePerHour,
                                 @RequestParam(required = false) String imageUrl) {
        return this.cleanerService.updateCleaner(id, name, surname, pricePerHour, imageUrl);
    }

    @DeleteMapping("/delete/{id}")
    public void deleteCleaner(@PathVariable Long id) {
        this.cleanerService.deleteCleaner(id);
    }

    @PostMapping("/{id}/upload-photo")
    public ResponseEntity<?> uploadPhoto(@PathVariable Long id,
                                         @RequestParam("file") MultipartFile file) throws IOException {
        System.out.println("Received multipart file: " + file.getOriginalFilename());
        this.cleanerService.uploadPhoto(id, file);
        return ResponseEntity.ok("Photo uploaded");
    }

}
