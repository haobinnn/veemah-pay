package com.bank.crud;

import com.bank.model.Role;
import com.bank.repository.RoleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class RoleCrudService extends AbstractCrudService<Role, Long> {

    @Autowired
    public RoleCrudService(RoleRepository repository) {
        super(repository);
    }
}