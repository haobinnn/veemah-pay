package com.bank.controller;

import com.bank.controller.dto.UpdateRoleRequest;
import com.bank.model.Role;
import com.bank.repository.RoleRepository;
import jakarta.validation.constraints.NotBlank;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/roles")
public class RoleController {

    @Autowired
    private RoleRepository roleRepository;

    @GetMapping
    public List<Role> listRoles() {
        return roleRepository.findAll();
    }

    @PostMapping
    @Transactional
    public ResponseEntity<?> createRole(@RequestParam @NotBlank String name,
                                        @RequestParam(required = false) String description) {
        Optional<Role> existing = roleRepository.findByName(name);
        if (existing.isPresent()) {
            return ResponseEntity.status(409).body("role already exists");
        }
        Role role = new Role();
        role.setName(name);
        role.setDescription(description);
        Role saved = roleRepository.save(role);
        return ResponseEntity.created(URI.create("/api/roles/" + saved.getId())).body(saved);
    }

    @PatchMapping("/{id}")
    @Transactional
    public ResponseEntity<?> updateRole(@PathVariable Long id, @RequestBody UpdateRoleRequest req) {
        Optional<Role> opt = roleRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        Role role = opt.get();
        if (req.getDescription() != null) role.setDescription(req.getDescription());
        if (req.getPermissions() != null) role.setPermissions(req.getPermissions());
        Role saved = roleRepository.save(role);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> deleteRole(@PathVariable Long id) {
        if (!roleRepository.existsById(id)) return ResponseEntity.notFound().build();
        roleRepository.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}