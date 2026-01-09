package com.bank.controller.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public class CreateUserRequest {
    @NotBlank
    private String username;
    private String fullName;
    private String email;
    private String accountNumber; // optional for admins
    private List<String> roleNames; // e.g., ["ADMIN"] or ["CUSTOMER"]

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getAccountNumber() { return accountNumber; }
    public void setAccountNumber(String accountNumber) { this.accountNumber = accountNumber; }
    public List<String> getRoleNames() { return roleNames; }
    public void setRoleNames(List<String> roleNames) { this.roleNames = roleNames; }
}