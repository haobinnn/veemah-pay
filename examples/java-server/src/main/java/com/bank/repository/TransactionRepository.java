package com.bank.repository;

import com.bank.model.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {
    long countByAccountNumber(String accountNumber);
    long countByTargetAccount(String accountNumber);
}