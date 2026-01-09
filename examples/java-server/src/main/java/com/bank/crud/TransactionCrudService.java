package com.bank.crud;

import com.bank.model.Transaction;
import com.bank.repository.TransactionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class TransactionCrudService extends AbstractCrudService<Transaction, Long> {

    @Autowired
    public TransactionCrudService(TransactionRepository repository) {
        super(repository);
    }
}