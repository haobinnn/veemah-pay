package com.bank.controller;

import com.bank.model.Account;
import com.bank.model.Transaction;
import com.bank.repository.AccountRepository;
import com.bank.repository.TransactionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/transactions")
public class TransactionController {

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @PostMapping
    @Transactional
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body) {
        try {
            String type = body.get("type") == null ? null : String.valueOf(body.get("type"));
            String sourceAccount = body.get("source_account") == null ? null : String.valueOf(body.get("source_account"));
            String targetAccount = body.get("target_account") == null ? null : String.valueOf(body.get("target_account"));
            String note = body.get("note") == null ? null : String.valueOf(body.get("note"));
            String pin = body.get("pin") == null ? null : String.valueOf(body.get("pin"));

            Object amountRaw = body.get("amount");
            if (!"deposit".equals(type) && !"withdraw".equals(type) && !"transfer".equals(type)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid type"));
            }
            if (sourceAccount == null || sourceAccount.isBlank()) {
                return ResponseEntity.badRequest().body(Map.of("error", "Missing account(s)"));
            }
            if ("transfer".equals(type) && (targetAccount == null || targetAccount.isBlank())) {
                return ResponseEntity.badRequest().body(Map.of("error", "Missing account(s)"));
            }
            if (!(amountRaw instanceof Number)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Amount must be positive"));
            }
            BigDecimal amount = BigDecimal.valueOf(((Number) amountRaw).doubleValue());
            if (amount.compareTo(BigDecimal.ZERO) <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Amount must be positive"));
            }
            if (("withdraw".equals(type) || "transfer".equals(type)) && (pin == null || pin.isBlank())) {
                return ResponseEntity.badRequest().body(Map.of("error", "PIN is required for this transaction."));
            }

            Account source;
            Account target = null;

            if ("transfer".equals(type)) {
                if (sourceAccount.equals(targetAccount)) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Target account must be different"));
                }
                String first = sourceAccount.compareTo(targetAccount) <= 0 ? sourceAccount : targetAccount;
                String second = first.equals(sourceAccount) ? targetAccount : sourceAccount;

                Optional<Account> firstLocked = accountRepository.findForUpdate(first);
                if (firstLocked.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Source account not found"));
                Optional<Account> secondLocked = accountRepository.findForUpdate(second);
                if (secondLocked.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Target account not found"));

                source = sourceAccount.equals(first) ? firstLocked.get() : secondLocked.get();
                target = sourceAccount.equals(first) ? secondLocked.get() : firstLocked.get();
            } else {
                Optional<Account> srcOpt = accountRepository.findForUpdate(sourceAccount);
                if (srcOpt.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Source account not found"));
                source = srcOpt.get();
            }

            if ("Locked".equalsIgnoreCase(source.getStatus()) || "Archived".equalsIgnoreCase(source.getStatus())) {
                return ResponseEntity.status(403).body(Map.of("error", "Source account unavailable"));
            }
            if ("transfer".equals(type) && (target == null || "Locked".equalsIgnoreCase(target.getStatus()) || "Archived".equalsIgnoreCase(target.getStatus()))) {
                return ResponseEntity.status(403).body(Map.of("error", "Target account unavailable"));
            }
            if (("withdraw".equals(type) || "transfer".equals(type)) && (source.getPin() == null || !source.getPin().equals(pin))) {
                return ResponseEntity.status(400).body(Map.of("error", "Invalid PIN."));
            }

            BigDecimal sourceBefore = source.getBalance() == null ? BigDecimal.ZERO : source.getBalance();
            BigDecimal targetBefore = target == null ? null : (target.getBalance() == null ? BigDecimal.ZERO : target.getBalance());

            BigDecimal sourceAfter = sourceBefore;
            BigDecimal targetAfter = targetBefore;

            if ("deposit".equals(type)) {
                sourceAfter = sourceBefore.add(amount);
                source.setBalance(sourceAfter);
            } else if ("withdraw".equals(type)) {
                if (amount.compareTo(sourceBefore) > 0) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Insufficient funds"));
                }
                sourceAfter = sourceBefore.subtract(amount);
                source.setBalance(sourceAfter);
            } else {
                if (amount.compareTo(sourceBefore) > 0) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Insufficient funds"));
                }
                sourceAfter = sourceBefore.subtract(amount);
                targetAfter = targetBefore.add(amount);
                source.setBalance(sourceAfter);
                target.setBalance(targetAfter);
            }

            accountRepository.save(source);
            if (target != null) accountRepository.save(target);

            OffsetDateTime now = OffsetDateTime.now();
            Transaction tx = new Transaction();
            tx.setAccountNumber(sourceAccount);
            tx.setTargetAccount("transfer".equals(type) ? targetAccount : null);
            tx.setType(type);
            tx.setStatus("Completed");
            tx.setAmount(amount);
            tx.setFee(BigDecimal.ZERO);
            tx.setNote(note);
            tx.setCreatedBy(sourceAccount);
            tx.setCreatedAt(now);
            tx.setCompletedAt(now);
            tx.setVoidedAt(null);
            tx.setSourceBalanceBefore(sourceBefore);
            tx.setSourceBalanceAfter(sourceAfter);
            tx.setTargetBalanceBefore(targetBefore);
            tx.setTargetBalanceAfter(targetAfter);

            Transaction savedTx = transactionRepository.save(tx);
            Map<String, Object> out = new HashMap<>();
            out.put("transaction_id", savedTx.getId());
            out.put("type", type);
            out.put("status", tx.getStatus());
            out.put("source_account", sourceAccount);
            out.put("target_account", "transfer".equals(type) ? targetAccount : null);
            out.put("amount", amount);
            return ResponseEntity.ok(out);
        } catch (DataAccessException e) {
            Map<String, Object> out = new HashMap<>();
            out.put("error", "Database unavailable");
            return ResponseEntity.status(503).body(out);
        } catch (Exception e) {
            Map<String, Object> out = new HashMap<>();
            out.put("error", "Server error");
            return ResponseEntity.status(500).body(out);
        }
    }
}
