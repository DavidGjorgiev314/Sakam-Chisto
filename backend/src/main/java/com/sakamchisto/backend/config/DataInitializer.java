package com.sakamchisto.backend.config;

import com.sakamchisto.backend.model.User;
import com.sakamchisto.backend.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataInitializer {

    @Bean
    CommandLineRunner init(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        return args -> {
            if (userRepository.findByUsername("admin").isEmpty()) {
                User admin = new User();
                admin.setUsername("admin");
                admin.setPassword(passwordEncoder.encode("admin123")); // Use a strong password in production
                admin.setRole("ADMIN"); // Adjust based on your model
                userRepository.save(admin);

                System.out.println("Default admin user created: admin / admin123");
            }
        };
    }
}
