package com.bank.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Entity
@Table(name = "transactions")
public class Transaction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "account_number", length = 5, nullable = false)
    private String accountNumber;

    @Column(name = "target_account", length = 5)
    private String targetAccount;

    @Column(name = "type", length = 10, nullable = false)
    private String type; // deposit, withdraw, transfer, fee

    @Column(name = "status", length = 10, nullable = false)
    private String status; // Pending, Completed, Voided

    @Column(name = "amount", nullable = false)
    private BigDecimal amount;

    @Column(name = "fee", nullable = false)
    private BigDecimal fee = BigDecimal.ZERO;

    @Column(name = "note")
    private String note;

    @Column(name = "created_by", length = 5, nullable = false)
    private String createdBy;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    @Column(name = "completed_at")
    private OffsetDateTime completedAt;

    @Column(name = "voided_at")
    private OffsetDateTime voidedAt;

    @Column(name = "source_balance_before")
    private BigDecimal sourceBalanceBefore;

    @Column(name = "source_balance_after")
    private BigDecimal sourceBalanceAfter;

    @Column(name = "target_balance_before")
    private BigDecimal targetBalanceBefore;

    @Column(name = "target_balance_after")
    private BigDecimal targetBalanceAfter;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getAccountNumber() { return accountNumber; }
    public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }
    public String getTargetAccount() { return targetAccount; }
    public void setTargetAccount(String targetAccount) { this.targetAccount = targetAccount; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public BigDecimal getFee() { return fee; }
    public void setFee(BigDecimal fee) { this.fee = fee; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
    public OffsetDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(OffsetDateTime completedAt) { this.completedAt = completedAt; }
    public OffsetDateTime getVoidedAt() { return voidedAt; }
    public void setVoidedAt(OffsetDateTime voidedAt) { this.voidedAt = voidedAt; }
    public BigDecimal getSourceBalanceBefore() { return sourceBalanceBefore; }
    public void setSourceBalanceBefore(BigDecimal sourceBalanceBefore) { this.sourceBalanceBefore = sourceBalanceBefore; }
    public BigDecimal getSourceBalanceAfter() { return sourceBalanceAfter; }
    public void setSourceBalanceAfter(BigDecimal sourceBalanceAfter) { this.sourceBalanceAfter = sourceBalanceAfter; }
    public BigDecimal getTargetBalanceBefore() { return targetBalanceBefore; }
    public void setTargetBalanceBefore(BigDecimal targetBalanceBefore) { this.targetBalanceBefore = targetBalanceBefore; }
    public BigDecimal getTargetBalanceAfter() { return targetBalanceAfter; }
    public void setTargetBalanceAfter(BigDecimal targetBalanceAfter) { this.targetBalanceAfter = targetBalanceAfter; }
}