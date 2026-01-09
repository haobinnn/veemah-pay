package com.bank.crud;

import java.util.List;
import java.util.Optional;

public interface CrudService<T, ID> {
    T create(T entity);
    Optional<T> findById(ID id);
    List<T> findAll();
    Optional<T> update(ID id, java.util.function.Consumer<T> updater);
    boolean deleteById(ID id);
}