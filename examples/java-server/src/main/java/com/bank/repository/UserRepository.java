package com.bank.repository;

import com.bank.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {
    Page<User> findByUsernameContainingIgnoreCaseOrFullNameContainingIgnoreCase(String username, String fullName, Pageable pageable);
    Page<User> findByStatus(String status, Pageable pageable);
    Page<User> findByStatusAndUsernameContainingIgnoreCaseOrStatusAndFullNameContainingIgnoreCase(String status1, String username, String status2, String fullName, Pageable pageable);
    long countByAccountNumber(String accountNumber);
}