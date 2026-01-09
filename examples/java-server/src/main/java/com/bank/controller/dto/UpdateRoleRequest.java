package com.bank.controller.dto;

import java.util.List;

public class UpdateRoleRequest {
    private String description;
    private List<String> permissions; // replace set

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public List<String> getPermissions() { return permissions; }
    public void setPermissions(List<String> permissions) { this.permissions = permissions; }
}