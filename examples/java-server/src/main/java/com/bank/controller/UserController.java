package com.bank.controller;

import com.bank.controller.dto.CreateUserRequest;
import com.bank.controller.dto.UpdateUserRequest;
import com.bank.model.Role;
import com.bank.model.User;
import com.bank.repository.AccountRepository;
import com.bank.repository.RoleRepository;
import com.bank.repository.UserRepository;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@RestController
@RequestMapping("/api/users")
public class UserController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RoleRepository roleRepository;

    @Autowired
    private AccountRepository accountRepository;

    @PostMapping
    @Transactional
    public ResponseEntity<?> createUser(@Valid @RequestBody CreateUserRequest req) {
        if (req.getUsername() == null || req.getUsername().isBlank()) {
            return ResponseEntity.badRequest().body("username is required");
        }

        if (userRepository.findByUsernameContainingIgnoreCaseOrFullNameContainingIgnoreCase(req.getUsername(), req.getUsername(), PageRequest.of(0, 1)).hasContent()) {
            // simplistic duplicate check by username exact would be better; using query for brevity
            Optional<User> existing = userRepository.findAll().stream().filter(u -> u.getUsername().equalsIgnoreCase(req.getUsername())).findFirst();
            if (existing.isPresent()) {
                return ResponseEntity.status(409).body("username already exists");
            }
        }

        if (req.getAccountNumber() != null && !req.getAccountNumber().isBlank()) {
            if (!accountRepository.existsById(req.getAccountNumber())) {
                return ResponseEntity.badRequest().body("invalid account_number");
            }
        }

        User user = new User();
        user.setUsername(req.getUsername());
        user.setFullName(req.getFullName());
        user.setEmail(req.getEmail());
        user.setAccountNumber(req.getAccountNumber());
        user.setStatus("ACTIVE");
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());

        if (req.getRoleNames() != null && !req.getRoleNames().isEmpty()) {
            Set<Role> roles = new HashSet<>();
            for (String roleName : req.getRoleNames()) {
                roleRepository.findByName(roleName).ifPresent(roles::add);
            }
            user.setRoles(roles);
        }

        User saved = userRepository.save(user);
        return ResponseEntity.created(URI.create("/api/users/" + saved.getId())).body(saved);
    }

    @GetMapping
    public ResponseEntity<Page<User>> listUsers(
            @RequestParam(value = "q", required = false) String q,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size
    ) {
        PageRequest pr = PageRequest.of(page, size);
        Page<User> result;
        if (status != null && !status.isBlank()) {
            if (q != null && !q.isBlank()) {
                result = userRepository.findByStatusAndUsernameContainingIgnoreCaseOrStatusAndFullNameContainingIgnoreCase(status, q, status, q, pr);
            } else {
                result = userRepository.findByStatus(status, pr);
            }
        } else {
            if (q != null && !q.isBlank()) {
                result = userRepository.findByUsernameContainingIgnoreCaseOrFullNameContainingIgnoreCase(q, q, pr);
            } else {
                result = userRepository.findAll(pr);
            }
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getUser(@PathVariable Long id) {
        return userRepository.findById(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PatchMapping("/{id}")
    @Transactional
    public ResponseEntity<?> updateUser(@PathVariable Long id, @RequestBody UpdateUserRequest req) {
        Optional<User> opt = userRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        User user = opt.get();

        if (req.getFullName() != null) user.setFullName(req.getFullName());
        if (req.getEmail() != null) user.setEmail(req.getEmail());
        if (req.getStatus() != null) user.setStatus(req.getStatus());
        if (req.getAccountNumber() != null) {
            if (!req.getAccountNumber().isBlank() && !accountRepository.existsById(req.getAccountNumber())) {
                return ResponseEntity.badRequest().body("invalid account_number");
            }
            user.setAccountNumber(req.getAccountNumber());
        }
        if (req.getRoleNames() != null) {
            Set<Role> roles = new HashSet<>();
            for (String roleName : req.getRoleNames()) {
                roleRepository.findByName(roleName).ifPresent(roles::add);
            }
            user.setRoles(roles);
        }
        user.setUpdatedAt(OffsetDateTime.now());
        User saved = userRepository.save(user);
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/{id}/deactivate")
    @Transactional
    public ResponseEntity<?> deactivateUser(@PathVariable Long id) {
        Optional<User> opt = userRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        User user = opt.get();
        user.setStatus("INACTIVE");
        user.setUpdatedAt(OffsetDateTime.now());
        userRepository.save(user);
        return ResponseEntity.ok(user);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteUser(@PathVariable Long id) {
        if (!userRepository.existsById(id)) return ResponseEntity.notFound().build();
        userRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}