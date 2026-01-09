package com.bank.crud;

import com.bank.model.User;
import com.bank.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class UserCrudService extends AbstractCrudService<User, Long> {

    @Autowired
    public UserCrudService(UserRepository repository) {
        super(repository);
    }
}