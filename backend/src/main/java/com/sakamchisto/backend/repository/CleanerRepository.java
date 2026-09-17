package com.sakamchisto.backend.repository;

import com.sakamchisto.backend.model.Cleaner;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CleanerRepository extends JpaRepository<Cleaner, Long> {
}
