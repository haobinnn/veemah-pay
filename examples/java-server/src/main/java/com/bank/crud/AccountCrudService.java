package com.bank.crud;

import com.bank.model.Account;
import com.bank.repository.AccountRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class AccountCrudService extends AbstractCrudService<Account, String> {

    @Autowired
    public AccountCrudService(AccountRepository repository) {
        super(repository);
    }
}