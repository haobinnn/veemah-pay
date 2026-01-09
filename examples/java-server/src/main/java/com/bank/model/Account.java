package com.bank.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;

@Entity
@Table(name = "accounts")
public class Account {
    @Id
    @Column(name = "account_number", length = 5)
    private String accountNumber;

    @Column(name = "name")
    private String name;

    @Column(name = "balance")
    private BigDecimal balance;

    @Column(name = "pin", length = 5)
    private String pin;

    @Column(name = "status", length = 10)
    private String status;

    @Column(name = "failed_attempts")
    private Integer failedAttempts;

    @Column(name = "email")
    private String email;

    public String getAccountNumber() { return accountNumber; }
    public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public BigDecimal getBalance() { return balance; }
    public void setBalance(BigDecimal balance) { this.balance = balance; }
    public String getPin() { return pin; }
    public void setPin(String pin) { this.pin = pin; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Integer getFailedAttempts() { return failedAttempts; }
    public void setFailedAttempts(Integer failedAttempts) { this.failedAttempts = failedAttempts; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
}
