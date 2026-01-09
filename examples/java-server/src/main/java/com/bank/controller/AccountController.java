package com.bank.controller;

import com.bank.model.Account;
import com.bank.repository.AccountRepository;
import com.bank.repository.TransactionRepository;
import com.bank.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    @Autowired
    private AccountRepository accountRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private UserRepository userRepository;

    private static String maskAccountName(String raw) {
        String cleaned = String.valueOf(raw == null ? "" : raw).trim().replaceAll("\\s+", " ");
        if (cleaned.isBlank()) return "";

        String[] parts = cleaned.split(" ");
        String first = parts.length > 0 ? parts[0] : "";
        String last = parts.length > 1 ? parts[parts.length - 1] : "";

        String firstInitial = first.isEmpty() ? "" : first.substring(0, 1);
        int firstStars = Math.max(0, first.length() - (first.isEmpty() ? 0 : 1));
        String maskedFirst = firstInitial + (firstStars > 0 ? "*".repeat(firstStars) : "");

        if (last.isEmpty()) return maskedFirst;
        String lastInitial = last.substring(0, 1);
        return maskedFirst + " " + lastInitial + ".";
    }

    @GetMapping("/{accountNumber}")
    public ResponseEntity<?> getAccount(@PathVariable String accountNumber) {
        try {
            Optional<Account> account = accountRepository.findById(accountNumber);
            if (account.isEmpty()) return ResponseEntity.notFound().build();
            Account a = account.get();
            Map<String, Object> out = new HashMap<>();
            out.put("account_number", a.getAccountNumber());
            out.put("name", a.getName());
            out.put("balance", a.getBalance());
            out.put("status", a.getStatus());
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

    @PostMapping("/{accountNumber}")
    public ResponseEntity<?> verifyAccount(@PathVariable String accountNumber) {
        try {
            Optional<Account> account = accountRepository.findById(accountNumber);
            if (account.isEmpty()) {
                return ResponseEntity.status(404).body(Map.of("exists", false));
            }
            return ResponseEntity.ok(Map.of(
                    "exists", true,
                    "maskedName", maskAccountName(account.get().getName())
            ));
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

    @PatchMapping("/{accountNumber}")
    @Transactional
    public ResponseEntity<?> depositWithdraw(@PathVariable String accountNumber, @RequestBody Map<String, Object> body) {
        try {
            String op = body.get("op") == null ? null : String.valueOf(body.get("op"));
            Object amountRaw = body.get("amount");
            if (!"deposit".equals(op) && !"withdraw".equals(op)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid op. Use deposit or withdraw."));
            }
            if (!(amountRaw instanceof Number)) {
                return ResponseEntity.badRequest().body(Map.of("error", "Amount must be a positive number."));
            }
            BigDecimal amount = BigDecimal.valueOf(((Number) amountRaw).doubleValue());
            if (amount.compareTo(BigDecimal.ZERO) <= 0) {
                return ResponseEntity.badRequest().body(Map.of("error", "Amount must be a positive number."));
            }

            Optional<Account> opt = accountRepository.findForUpdate(accountNumber);
            if (opt.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Account not found"));
            Account account = opt.get();

            String status = account.getStatus();
            if ("Locked".equalsIgnoreCase(status) || "Archived".equalsIgnoreCase(status)) {
                return ResponseEntity.status(403).body(Map.of("error", "Account unavailable"));
            }

            BigDecimal balance = account.getBalance() == null ? BigDecimal.ZERO : account.getBalance();
            if ("deposit".equals(op)) {
                if (amount.compareTo(new BigDecimal("100")) < 0) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Deposit minimum is 100."));
                }
                account.setBalance(balance.add(amount));
                Account saved = accountRepository.save(account);
                Map<String, Object> out = new HashMap<>();
                out.put("account_number", saved.getAccountNumber());
                out.put("name", saved.getName());
                out.put("balance", saved.getBalance());
                out.put("status", saved.getStatus());
                return ResponseEntity.ok(out);
            } else {
                if (amount.compareTo(new BigDecimal("100")) < 0) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Withdrawal minimum is 100."));
                }
                if (amount.compareTo(balance) > 0) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Insufficient funds."));
                }
                account.setBalance(balance.subtract(amount));
                Account saved = accountRepository.save(account);
                Map<String, Object> out = new HashMap<>();
                out.put("account_number", saved.getAccountNumber());
                out.put("name", saved.getName());
                out.put("balance", saved.getBalance());
                out.put("status", saved.getStatus());
                return ResponseEntity.ok(out);
            }
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


    @DeleteMapping("/{accountNumber}")
    @Transactional
    public ResponseEntity<?> deleteAccount(@PathVariable String accountNumber) {
        if (!accountRepository.existsById(accountNumber)) {
            return ResponseEntity.notFound().build();
        }

        long txDeps = transactionRepository.countByAccountNumber(accountNumber) +
                transactionRepository.countByTargetAccount(accountNumber);
        long userDeps = userRepository.countByAccountNumber(accountNumber);
        if (txDeps > 0 || userDeps > 0) {
            String msg = String.format("Cannot delete account; dependencies exist (transactions=%d, users=%d). Consider archiving.", txDeps, userDeps);
            return ResponseEntity.status(409).body(msg);
        }

        try {
            accountRepository.deleteById(accountNumber);
        } catch (DataIntegrityViolationException e) {
            return ResponseEntity.status(409).body("Delete failed due to database constraints. Consider archiving the account.");
        }
        return ResponseEntity.noContent().build();
    }
}
