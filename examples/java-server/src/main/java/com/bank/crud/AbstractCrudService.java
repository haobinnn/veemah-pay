package com.bank.crud;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public abstract class AbstractCrudService<T, ID> implements CrudService<T, ID> {

    protected final JpaRepository<T, ID> repository;

    protected AbstractCrudService(JpaRepository<T, ID> repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public T create(T entity) {
        return repository.save(entity);
    }

    @Override
    public Optional<T> findById(ID id) {
        return repository.findById(id);
    }

    @Override
    public List<T> findAll() {
        return repository.findAll();
    }

    @Override
    @Transactional
    public Optional<T> update(ID id, java.util.function.Consumer<T> updater) {
        Optional<T> existing = repository.findById(id);
        if (existing.isEmpty()) {
            return Optional.empty();
        }
        T entity = existing.get();
        updater.accept(entity);
        T saved = repository.save(entity);
        return Optional.of(saved);
    }

    @Override
    @Transactional
    public boolean deleteById(ID id) {
        if (!repository.existsById(id)) {
            return false;
        }
        repository.deleteById(id);
        return true;
    }
}